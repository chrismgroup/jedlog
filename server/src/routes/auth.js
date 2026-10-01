import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { isStrongPassword, PASSWORD_RULES } from '../utils/password.js';
import { issueTokens, rotateRefreshToken, revokeRefreshToken, revokeAllForUser } from '../services/tokens.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z.string().refine(isStrongPassword, PASSWORD_RULES);
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{7,20}$/, 'Enter a valid phone number');

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  email,
  phone,
  password,
  state: z.string().trim().min(2).max(50),
  preferredWarehouseId: z.uuid('Choose a pickup warehouse'),
});

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

// Used so that login takes the same time whether or not the email exists.
const dummyHashPromise = argon2.hash('timing-equaliser-not-a-real-password');

const publicUser = (u) => ({
  id: u.id,
  fullName: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  state: u.state,
  preferredWarehouseId: u.preferred_warehouse_id,
});

// Customers self-register. Staff accounts are created only by an admin.
router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { fullName, email, phone, password, state, preferredWarehouseId } = req.valid.body;
  const wh = await query('SELECT 1 FROM warehouses WHERE id = $1 AND active', [preferredWarehouseId]);
  if (wh.rowCount === 0) throw new HttpError(400, 'Selected warehouse is not available');

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw new HttpError(409, 'An account with this email already exists');

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const { rows } = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, state, preferred_warehouse_id)
     VALUES ($1,$2,$3,$4,'customer',$5,$6) RETURNING *`,
    [fullName, email, phone, hash, state, preferredWarehouseId],
  );
  const user = rows[0];
  res.status(201).json({ user: publicUser(user), ...(await issueTokens(user)) });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const invalid = new HttpError(401, 'Incorrect email or password');

  if (!user) {
    await argon2.verify(await dummyHashPromise, password);
    throw invalid;
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new HttpError(423, 'Too many failed attempts. Try again in a few minutes.');
  }

  const ok = await argon2.verify(user.password_hash, password);
  if (!ok) {
    const failed = user.failed_logins + 1;
    const lock = failed >= config.maxFailedLogins;
    await query(
      `UPDATE users SET failed_logins = $2,
         locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) ELSE locked_until END
       WHERE id = $1`,
      [user.id, lock ? 0 : failed, lock, config.lockoutMinutes],
    );
    throw invalid;
  }
  if (!user.active) throw new HttpError(403, 'This account has been deactivated. Contact support.');

  await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
  res.json({ user: publicUser(user), ...(await issueTokens(user)) });
});

router.post('/refresh', authLimiter, validate(refreshSchema), async (req, res) => {
  res.json(await rotateRefreshToken(req.valid.body.refreshToken));
});

router.post('/logout', validate(refreshSchema), async (req, res) => {
  await revokeRefreshToken(req.valid.body.refreshToken);
  res.status(204).end();
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', authenticate, authLimiter, validate(changePasswordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await argon2.verify(rows[0].password_hash, currentPassword))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
  // Sign out every other device.
  await revokeAllForUser(req.user.id);
  const tokens = await issueTokens(req.user);
  res.json(tokens);
});

export { publicUser };
export default router;
