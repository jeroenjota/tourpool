import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db.js';
import { emailService } from '../email.js';
import {
  authenticate, cookieName, cookieOptions, emailSchema, getAccount, hashPassword,
  hashToken, HttpError, isDuplicate, newToken, passwordSchema, profileSchema, type Role,
  sessionLifetime, usernameSchema, verifyPassword
} from '../auth.js';
import { startPasswordReset } from '../passwordReset.js';

export const authRouter = Router();
const limit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  message: { message: 'Te veel pogingen. Probeer het over 15 minuten opnieuw.' },
  standardHeaders: 'draft-8', legacyHeaders: false
});
const registrationLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10,
  message: { message: 'Te veel registraties. Probeer het later opnieuw.' },
  standardHeaders: 'draft-8', legacyHeaders: false
});
const registrationSchema = z.object({
  username: usernameSchema,
  email: emailSchema, password: passwordSchema, profile: profileSchema,
  website: z.string().max(200).optional().default('')
}).strict();
const resendVerificationSchema = z.object({ email: emailSchema }).strict();
const registrationResponse = {
  message: 'Als de registratie geldig is, ontvang je een e-mail om je adres te bevestigen.'
};
const loginSchema = z.object({
  username: z.string().trim().min(1).max(64).transform(value => value.toLowerCase()).optional(),
  email: emailSchema.optional(),
  password: z.string().min(1).max(128)
}).strict().refine(payload => Boolean(payload.username || payload.email), {
  path: ['username'], message: 'Vul je gebruikersnaam of e-mailadres in.'
}).refine(payload => !(payload.username && payload.email), {
  path: ['username'], message: 'Vul alleen je gebruikersnaam of e-mailadres in.'
});
// Even unknown accounts perform a password derivation.
const dummyHash = hashPassword(newToken());

authRouter.post('/register', registrationLimit, limit, async (request, response, next) => {
  let connection;
  try {
    const payload = registrationSchema.parse(request.body);
    if (payload.website.trim()) {
      response.status(201).json(registrationResponse);
      return;
    }
    const passwordHash = await hashPassword(payload.password);
    const verificationToken = newToken();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const conflicts = await connection.query(
      'SELECT accountID FROM tblAccounts WHERE username IN (?, ?) OR email IN (?, ?) LIMIT 1 FOR UPDATE',
      [payload.username, payload.email, payload.username, payload.email]
    );
    if (conflicts.length) throw new HttpError(409, 'Deze gebruikersnaam of dit e-mailadres is al in gebruik.');
    const p = payload.profile;
    const address = await connection.query(
      'INSERT INTO tblAdressen (vNaam, tNaam, aNaam, plaats, tel, email) VALUES (?, ?, ?, ?, ?, ?)',
      [p.vNaam, p.tNaam, p.aNaam, p.plaats, p.tel, payload.email]
    );
    const accountResult = await connection.query(
      "INSERT INTO tblAccounts (adrID, username, email, emailVerified, passwordHash, role) VALUES (?, ?, ?, FALSE, ?, 'user')",
      [Number(address.insertId), payload.username, payload.email, passwordHash]
    );
    const accountID = Number((accountResult as { insertId: number | bigint }).insertId);
    await connection.query(
      'INSERT INTO tblEmailVerifications (tokenHash, accountID, expiresAt) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))',
      [hashToken(verificationToken), accountID]
    );
    await connection.commit();

    const [verificationResult, notificationResult] = await Promise.allSettled([
      emailService.sendVerification(payload.email, verificationToken),
      emailService.sendRegistrationNotice({
        username: payload.username,
        email: payload.email,
        fullName: [p.vNaam, p.tNaam, p.aNaam].filter(Boolean).join(' ')
      })
    ]);
    if (notificationResult.status === 'rejected') {
      console.error('Could not send the new-registration notification email:', notificationResult.reason);
    }
    if (verificationResult.status === 'rejected') {
      console.error('Could not send the email-verification message:', verificationResult.reason);
      response.status(503).json({
        message: 'Account aangemaakt, maar de bevestigingsmail kon niet worden verstuurd. Vraag hieronder een nieuwe bevestigingsmail aan.'
      });
      return;
    }
    response.status(201).json(registrationResponse);
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Deze gebruikersnaam of dit e-mailadres is al in gebruik.') : error);
  } finally {
    connection?.release();
  }
});

authRouter.post('/resend-verification', limit, async (request, response, next) => {
  let connection;
  let transactionStarted = false;
  try {
    const { email } = resendVerificationSchema.parse(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const rows = await connection.query(
      'SELECT accountID FROM tblAccounts WHERE email = ? AND emailVerified = FALSE FOR UPDATE',
      [email]
    ) as Array<{ accountID: number }>;
    const account = rows[0];
    if (!account) {
      await connection.commit();
      transactionStarted = false;
      response.status(202).json({ message: 'Als er voor dit adres een onbevestigd account bestaat, wordt een e-mail verstuurd.' });
      return;
    }

    const verificationToken = newToken();
    await connection.query('DELETE FROM tblEmailVerifications WHERE accountID = ?', [account.accountID]);
    await connection.query(
      'INSERT INTO tblEmailVerifications (tokenHash, accountID, expiresAt) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))',
      [hashToken(verificationToken), account.accountID]
    );
    await connection.commit();
    transactionStarted = false;
    try {
      await emailService.sendVerification(email, verificationToken);
    } catch (error) {
      console.error('Could not resend the email-verification message:', error);
      throw new HttpError(503, 'De bevestigingsmail kon niet worden verstuurd. Probeer het later opnieuw.');
    }
    response.status(202).json({ message: 'Als er voor dit adres een onbevestigd account bestaat, wordt een e-mail verstuurd.' });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

authRouter.get('/verify-email', limit, async (request, response, next) => {
  let connection;
  let transactionStarted = false;
  try {
    const token = z.string().regex(/^[a-f0-9]{64}$/).parse(request.query.token);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const rows = await connection.query(
      'SELECT accountID FROM tblEmailVerifications WHERE tokenHash = ? AND expiresAt > UTC_TIMESTAMP() FOR UPDATE',
      [hashToken(token)]
    ) as Array<{ accountID: number }>;
    if (!rows[0]) {
      await connection.rollback();
      transactionStarted = false;
      response.set('Cache-Control', 'no-store').status(400).type('html').send(verificationPage(false));
      return;
    }
    await connection.query('UPDATE tblAccounts SET emailVerified = TRUE WHERE accountID = ?', [rows[0].accountID]);
    await connection.query('DELETE FROM tblEmailVerifications WHERE accountID = ?', [rows[0].accountID]);
    await connection.commit();
    transactionStarted = false;
    response.set('Cache-Control', 'no-store').type('html').send(verificationPage(true));
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

function verificationPage(verified: boolean) {
  const title = verified ? 'E-mailadres bevestigd' : 'Bevestigingslink ongeldig';
  const message = verified
    ? 'Je e-mailadres is bevestigd. Je kunt nu teruggaan naar Tourpool en inloggen.'
    : 'Deze link is ongeldig of verlopen. Vraag in Tourpool een nieuwe bevestigingsmail aan.';
  return `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${message}</p></body></html>`;
}

authRouter.post('/login', limit, async (request, response, next) => {
  try {
    const payload = loginSchema.parse(request.body);
    const identity = payload.username ?? payload.email!;
    const rows = await pool.query(
      'SELECT accountID, adrID, username, email, emailVerified, role, passwordHash FROM tblAccounts WHERE username = ? OR email = ? LIMIT 2',
      [identity, identity]
    ) as Array<{ accountID: number; adrID: number; username: string; email: string; emailVerified: boolean; role: Role; passwordHash: string }>;
    const account = rows[0];
    const valid = await verifyPassword(payload.password, rows.length === 1 ? account.passwordHash : await dummyHash);
    if (rows.length !== 1 || !valid) throw new HttpError(401, 'Gebruikersnaam/e-mailadres of wachtwoord is onjuist.');
    if (!account.emailVerified) {
      throw new HttpError(403, 'Bevestig eerst je e-mailadres via de link in de e-mail. Je kunt ook een nieuwe bevestigingsmail aanvragen.');
    }
    const token = newToken();
    const csrfToken = newToken();
    await pool.query('DELETE FROM tblSessions WHERE expiresAt <= UTC_TIMESTAMP()');
    await pool.query(
      'INSERT INTO tblSessions (tokenHash, accountID, csrfToken, expiresAt) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 12 HOUR))',
      [hashToken(token), account.accountID, csrfToken]
    );
    response.cookie(cookieName, token, { ...cookieOptions(), maxAge: sessionLifetime });
    response.set('Cache-Control', 'no-store').json({
      account: {
        accountID: account.accountID, adrID: account.adrID, username: account.username,
        email: account.email, role: account.role
      }, csrfToken
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/session', authenticate, (request, response) => {
  response.json({ account: getAccount(request), csrfToken: request.session!.csrfToken });
});

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1).max(64).transform(value => value.toLowerCase())
}).strict();
const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: passwordSchema
}).strict();
const forgotPasswordResponse = {
  message: 'Als dit account bestaat, ontvang je binnen enkele minuten een e-mail met een link om een nieuw wachtwoord te kiezen.'
};

authRouter.post('/forgot-password', limit, async (request, response, next) => {
  try {
    const { identifier } = forgotPasswordSchema.parse(request.body);
    const rows = await pool.query(
      'SELECT accountID, email FROM tblAccounts WHERE username = ? OR email = ? LIMIT 2',
      [identifier, identifier]
    ) as Array<{ accountID: number; email: string }>;
    if (rows.length === 1) {
      // Not awaited, so the response time does not reveal whether the account exists.
      startPasswordReset(rows[0].accountID, rows[0].email)
        .catch(error => console.error('Could not send the password-reset email:', error));
    }
    response.status(202).json(forgotPasswordResponse);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', limit, async (request, response, next) => {
  let connection;
  let transactionStarted = false;
  try {
    const payload = resetPasswordSchema.parse(request.body);
    const passwordHash = await hashPassword(payload.password);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const rows = await connection.query(
      'SELECT accountID FROM tblPasswordResets WHERE tokenHash = ? AND expiresAt > UTC_TIMESTAMP() FOR UPDATE',
      [hashToken(payload.token)]
    ) as Array<{ accountID: number }>;
    if (!rows[0]) throw new HttpError(400, 'Deze resetlink is ongeldig of verlopen. Vraag een nieuwe link aan.');
    const { accountID } = rows[0];
    // The reset link proves access to the mailbox, so the address counts as verified.
    await connection.query(
      'UPDATE tblAccounts SET passwordHash = ?, emailVerified = TRUE WHERE accountID = ?', [passwordHash, accountID]
    );
    await connection.query('DELETE FROM tblPasswordResets WHERE accountID = ?', [accountID]);
    await connection.query('DELETE FROM tblEmailVerifications WHERE accountID = ?', [accountID]);
    await connection.query('DELETE FROM tblSessions WHERE accountID = ?', [accountID]);
    await connection.commit();
    transactionStarted = false;
    response.json({ message: 'Je wachtwoord is gewijzigd. Je kunt nu inloggen met je nieuwe wachtwoord.' });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

authRouter.post('/password', limit, authenticate, async (request, response, next) => {
  try {
    const account = getAccount(request);
    const payload = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema
    }).strict().parse(request.body);
    const rows = await pool.query(
      'SELECT passwordHash FROM tblAccounts WHERE accountID = ?', [account.accountID]
    ) as Array<{ passwordHash: string }>;
    if (!rows[0] || !await verifyPassword(payload.currentPassword, rows[0].passwordHash)) {
      throw new HttpError(400, 'Het huidige wachtwoord is onjuist.');
    }
    await pool.query(
      'UPDATE tblAccounts SET passwordHash = ? WHERE accountID = ?',
      [await hashPassword(payload.newPassword), account.accountID]
    );
    // Sign out other devices, keep the current session.
    await pool.query(
      'DELETE FROM tblSessions WHERE accountID = ? AND tokenHash <> ?', [account.accountID, request.session!.tokenHash]
    );
    await pool.query('DELETE FROM tblPasswordResets WHERE accountID = ?', [account.accountID]);
    response.json({ message: 'Je wachtwoord is gewijzigd. Andere apparaten zijn uitgelogd.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', authenticate, async (request, response, next) => {
  try {
    await pool.query('DELETE FROM tblSessions WHERE tokenHash = ?', [request.session!.tokenHash]);
    response.clearCookie(cookieName, cookieOptions()).status(204).send();
  } catch (error) {
    next(error);
  }
});
