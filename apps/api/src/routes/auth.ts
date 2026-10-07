import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db.js';
import {
  authenticate, cookieName, cookieOptions, emailSchema, getAccount, hashPassword,
  hashToken, HttpError, isDuplicate, newToken, passwordSchema, profileSchema,
  sessionLifetime, verifyPassword
} from '../auth.js';

export const authRouter = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  message: { message: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' },
  standardHeaders: 'draft-8', legacyHeaders: false
});
const registrationSchema = z.object({
  email: emailSchema, password: passwordSchema, profile: profileSchema
}).strict();
const loginSchema = z.object({
  email: emailSchema, password: z.string().min(1).max(128)
}).strict();
// Even unknown accounts perform a password derivation.
const dummyHash = hashPassword(newToken());

authRouter.post('/register', limit, async (request, response, next) => {
  let connection;
  try {
    const payload = registrationSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const p = payload.profile;
    const address = await connection.query(
      'INSERT INTO tblAdressen (vNaam, tNaam, aNaam, plaats, tel, email) VALUES (?, ?, ?, ?, ?, ?)',
      [p.vNaam, p.tNaam, p.aNaam, p.plaats, p.tel, payload.email]
    );
    await connection.query(
      "INSERT INTO tblAccounts (adrID, email, passwordHash, role) VALUES (?, ?, ?, 'user')",
      [Number(address.insertId), payload.email, passwordHash]
    );
    await connection.commit();
    response.status(201).json({ message: 'Account aangemaakt. Je kunt nu inloggen.' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Dit e-mailadres heeft al een account.') : error);
  } finally {
    connection?.release();
  }
});

authRouter.post('/login', limit, async (request, response, next) => {
  try {
    const payload = loginSchema.parse(request.body);
    const rows = await pool.query(
      'SELECT accountID, adrID, email, role, passwordHash FROM tblAccounts WHERE email = ?', [payload.email]
    ) as Array<{ accountID: number; adrID: number; email: string; role: 'admin' | 'user'; passwordHash: string }>;
    const account = rows[0];
    const valid = await verifyPassword(payload.password, account?.passwordHash ?? await dummyHash);
    if (!account || !valid) throw new HttpError(401, 'E-mailadres of wachtwoord is onjuist.');
    const token = newToken();
    const csrfToken = newToken();
    await pool.query('DELETE FROM tblSessions WHERE expiresAt <= UTC_TIMESTAMP()');
    await pool.query(
      'INSERT INTO tblSessions (tokenHash, accountID, csrfToken, expiresAt) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR))',
      [hashToken(token), account.accountID, csrfToken]
    );
    response.cookie(cookieName, token, { ...cookieOptions(), maxAge: sessionLifetime });
    response.set('Cache-Control', 'no-store').json({
      account: { accountID: account.accountID, adrID: account.adrID, email: account.email, role: account.role }, csrfToken
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/session', authenticate, (request, response) => {
  response.json({ account: getAccount(request), csrfToken: request.session!.csrfToken });
});

authRouter.post('/logout', authenticate, async (request, response, next) => {
  try {
    await pool.query('DELETE FROM tblSessions WHERE tokenHash = ?', [request.session!.tokenHash]);
    response.clearCookie(cookieName, cookieOptions()).status(204).send();
  } catch (error) {
    next(error);
  }
});
