import { readFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { pool } from './pool.js';
import { assertStrongPassword } from '../utils/password.js';

const DEFAULT_WAREHOUSES = [
  ['Lagos Warehouse', 'Ikeja', 'Lagos', 'Update this address in Admin > Warehouses'],
  ['Abuja Warehouse', 'Garki', 'FCT', 'Update this address in Admin > Warehouses'],
  ['Port Harcourt Warehouse', 'Port Harcourt', 'Rivers', 'Update this address in Admin > Warehouses'],
  ['Kano Warehouse', 'Kano', 'Kano', 'Update this address in Admin > Warehouses'],
];

async function migrate() {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Schema applied');

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM warehouses');
  if (rows[0].n === 0) {
    for (const w of DEFAULT_WAREHOUSES) {
      await pool.query('INSERT INTO warehouses (name, city, state, address) VALUES ($1,$2,$3,$4)', w);
    }
    console.log('Seeded default warehouses');
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      assertStrongPassword(ADMIN_PASSWORD);
    const email = ADMIN_EMAIL.toLowerCase().trim();
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows[0] && existing.rows[0].role !== 'admin') {
      throw new Error('ADMIN_EMAIL is already assigned to a non-admin account');
    }
    if (existing.rows[0] && process.env.ADMIN_RESET_PASSWORD === 'true') {
      const hash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
      await pool.query(
        `UPDATE users SET full_name = $2, phone = $3, password_hash = $4, active = TRUE,
         failed_logins = 0, locked_until = NULL WHERE id = $1`,
        [existing.rows[0].id, ADMIN_NAME || 'Administrator', ADMIN_PHONE || 'N/A', hash],
      );
      console.log(`Bootstrap admin credentials updated: ${email}`);
    } else if (!existing.rows[0]) {
      const hash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
      await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [ADMIN_NAME || 'Administrator', email, ADMIN_PHONE || 'N/A', hash],
      );
      console.log(`Bootstrap admin created: ${email}`);
    }
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
