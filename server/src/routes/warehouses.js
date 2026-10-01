import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

const toDto = (w) => ({
  id: w.id,
  name: w.name,
  city: w.city,
  state: w.state,
  address: w.address,
  phone: w.phone,
  active: w.active,
});

// Public: needed on the sign-up screen.
router.get('/', async (_req, res) => {
  const { rows } = await query('SELECT * FROM warehouses WHERE active ORDER BY state, name');
  res.json({ warehouses: rows.map(toDto) });
});

const warehouseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  address: z.string().trim().min(5).max(300),
  phone: z.string().trim().max(30).optional(),
  active: z.boolean().optional(),
});

router.post('/', authenticate, requireRole('admin'), validate(warehouseSchema), async (req, res) => {
  const w = req.valid.body;
  const { rows } = await query(
    'INSERT INTO warehouses (name, city, state, address, phone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [w.name, w.city, w.state, w.address, w.phone],
  );
  res.status(201).json({ warehouse: toDto(rows[0]) });
});

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(z.object({ id: z.uuid() }), 'params'),
  validate(warehouseSchema),
  async (req, res) => {
    const w = req.valid.body;
    const { rows } = await query(
      `UPDATE warehouses SET name=$2, city=$3, state=$4, address=$5, phone=$6, active=COALESCE($7, active)
       WHERE id = $1 RETURNING *`,
      [req.valid.params.id, w.name, w.city, w.state, w.address, w.phone, w.active ?? null],
    );
    if (!rows[0]) throw new HttpError(404, 'Warehouse not found');
    res.json({ warehouse: toDto(rows[0]) });
  },
);

export default router;
