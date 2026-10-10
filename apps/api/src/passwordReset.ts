import { hashToken, newToken } from './auth.js';
import { pool } from './db.js';
import { emailService } from './email.js';

export async function startPasswordReset(accountID: number, email: string) {
  const token = newToken();
  await pool.query('DELETE FROM tblPasswordResets WHERE accountID = ? OR expiresAt <= UTC_TIMESTAMP()', [accountID]);
  await pool.query(
    'INSERT INTO tblPasswordResets (tokenHash, accountID, expiresAt) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))',
    [hashToken(token), accountID]
  );
  await emailService.sendPasswordReset(email, token);
}
