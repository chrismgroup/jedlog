import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError } from '../utils/httpError.js';

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function signAccess(user) {
  return jwt.sign({ role: user.role }, config.jwtAccessSecret, {
    subject: user.id,
    expiresIn: config.accessTokenTtl,
    issuer: 'jetlog',
    algorithm: 'HS256',
  });
}

async function storeRefresh(userId, familyId) {
  const token = crypto.randomBytes(48).toString('base64url');
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(days => $4))`,
    [userId, sha256(token), familyId, config.refreshTokenTtlDays],
  );
  return token;
}

export async function issueTokens(user) {
  return {
    accessToken: signAccess(user),
    refreshToken: await storeRefresh(user.id, crypto.randomUUID()),
  };
}

export async function rotateRefreshToken(rawToken) {
  const { rows } = await query(
    `SELECT rt.*, u.role, u.active FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [sha256(rawToken)],
  );
  const record = rows[0];
  if (!record) throw new HttpError(401, 'Session expired. Please sign in again.');

  if (record.revoked_at) {
    // A revoked token being reused indicates theft: kill the whole session family.
    await query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [
      record.family_id,
    ]);
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  if (new Date(record.expires_at) < new Date() || !record.active) {
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [record.id]);
  const user = { id: record.user_id, role: record.role };
  return {
    accessToken: signAccess(user),
    refreshToken: await storeRefresh(user.id, record.family_id),
  };
}

export async function revokeRefreshToken(rawToken) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    sha256(rawToken),
  ]);
}

export async function revokeAllForUser(userId) {
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}
