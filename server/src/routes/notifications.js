import { Router } from 'express';
import { Expo } from 'expo-server-sdk';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, order_id, title, body, read_at, created_at FROM notifications
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id],
  );
  const unread = rows.filter((n) => !n.read_at).length;
  res.json({
    unread,
    notifications: rows.map((n) => ({
      id: n.id,
      orderId: n.order_id,
      title: n.title,
      body: n.body,
      read: Boolean(n.read_at),
      createdAt: n.created_at,
    })),
  });
});

router.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.status(204).end();
});

router.post('/:id/read', validate(z.object({ id: z.uuid() }), 'params'), async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2', [
    req.valid.params.id,
    req.user.id,
  ]);
  res.status(204).end();
});

const tokenSchema = z.object({ token: z.string().max(200) });

router.post('/push-token', validate(tokenSchema), async (req, res) => {
  const { token } = req.valid.body;
  if (!Expo.isExpoPushToken(token)) throw new HttpError(400, 'Invalid push token');
  // A device belongs to whoever signed in on it last.
  await query(
    `INSERT INTO push_tokens (token, user_id) VALUES ($1, $2)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, created_at = now()`,
    [token, req.user.id],
  );
  res.status(204).end();
});

router.delete('/push-token', validate(tokenSchema), async (req, res) => {
  await query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [req.valid.body.token, req.user.id]);
  res.status(204).end();
});

export default router;
