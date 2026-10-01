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
    const existing = await pool.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rowCount === 0) {
      assertStrongPassword(ADMIN_PASSWORD);
      const hash = await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id });
      await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
        [ADMIN_NAME || 'Administrator', ADMIN_EMAIL.toLowerCase().trim(), ADMIN_PHONE || 'N/A', hash],
      );
      console.log(`Bootstrap admin created: ${ADMIN_EMAIL}`);
    }
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
