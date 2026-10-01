import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';

export async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'], issuer: 'jetlog' });
  } catch {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  // Re-read the user so deactivation or role changes take effect immediately.
  const { rows } = await query(
    'SELECT id, full_name, email, phone, role, state, preferred_warehouse_id, active FROM users WHERE id = $1',
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.active) throw new HttpError(401, 'Account unavailable');
  req.user = user;
  next();
}

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission for this action');
    next();
  };
