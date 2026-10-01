import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';
import { isStrongPassword, PASSWORD_RULES } from '../utils/password.js';
import { revokeAllForUser } from '../services/tokens.js';
import { publicUser } from './auth.js';

const router = Router();
const STAFF_ROLES = ['manager', 'procurement', 'admin'];

// Lightweight staff directory so managers can assign procurement.
router.get('/procurement', requireRole('manager', 'admin'), async (_req, res) => {
  const { rows } = await query(
    "SELECT id, full_name FROM users WHERE role = 'procurement' AND active ORDER BY full_name",
  );
  res.json({ users: rows.map((u) => ({ id: u.id, fullName: u.full_name })) });
});

router.use(requireRole('admin'));

router.get('/', validate(z.object({ role: z.enum(['customer', ...STAFF_ROLES]).optional() }), 'query'), async (req, res) => {
  const { role } = req.valid.query;
  const { rows } = await query(
    `SELECT * FROM users ${role ? 'WHERE role = $1' : ''} ORDER BY created_at DESC LIMIT 500`,
    role ? [role] : [],
  );
  res.json({ users: rows.map((u) => ({ ...publicUser(u), active: u.active, createdAt: u.created_at })) });
});

const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9 ]{7,20}$/, 'Enter a valid phone number'),
  role: z.enum(STAFF_ROLES),
  password: z.string().refine(isStrongPassword, PASSWORD_RULES),
});

router.post('/', validate(createStaffSchema), async (req, res) => {
  const { fullName, email, phone, role, password } = req.valid.body;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const { rows } = await query(
    'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [fullName, email, phone, hash, role],
  );
  res.status(201).json({ user: publicUser(rows[0]) });
});

router.patch(
  '/:id',
  validate(z.object({ id: z.uuid() }), 'params'),
  validate(z.object({ active: z.boolean().optional(), role: z.enum(['customer', ...STAFF_ROLES]).optional() })),
  async (req, res) => {
    const { id } = req.valid.params;
    const { active, role } = req.valid.body;
    if (id === req.user.id) throw new HttpError(400, 'You cannot change your own account here');
    const { rows } = await query(
      'UPDATE users SET active = COALESCE($2, active), role = COALESCE($3, role) WHERE id = $1 RETURNING *',
      [id, active ?? null, role ?? null],
    );
    if (!rows[0]) throw new HttpError(404, 'User not found');
    if (active === false || role) await revokeAllForUser(id);
    res.json({ user: { ...publicUser(rows[0]), active: rows[0].active } });
  },
);

export default router;
