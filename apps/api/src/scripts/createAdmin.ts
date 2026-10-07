import 'dotenv/config';
import { pool } from '../db.js';
import { emailSchema, hashPassword, passwordSchema } from '../auth.js';

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const existing = await connection.query('SELECT accountID FROM tblAccounts WHERE email = ?', [email]);
    if (existing.length) throw new Error('Dit account bestaat al; er wordt niets overschreven.');
    const result = await connection.query(
      'INSERT INTO tblAdressen (vNaam, aNaam, email) VALUES (?, ?, ?)', ['Beheerder', 'Tourpool', email]
    );
    await connection.query(
      "INSERT INTO tblAccounts (adrID, email, passwordHash, role) VALUES (?, ?, ?, 'admin')",
      [Number(result.insertId), email, await hashPassword(password)]
    );
    await connection.commit();
    console.log('Beheerdersaccount aangemaakt.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Beheerdersaccount aanmaken mislukt.');
  process.exitCode = 1;
}).finally(() => pool.end());
