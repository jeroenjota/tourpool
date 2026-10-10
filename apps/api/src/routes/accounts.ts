import { Router } from 'express';
import { z } from 'zod';
import { HttpError, requireAdmin } from '../auth.js';
import { pool } from '../db.js';
import { startPasswordReset } from '../passwordReset.js';

export const accountsRouter = Router();
const idSchema = z.coerce.number().int().positive();
const accountUpdateSchema = z.object({
  role: z.enum(['admin', 'poolbeheerder', 'user']),
  poolIDs: z.array(z.number().int().positive()).max(200).default([])
}).strict();

// Accounts that can be linked to a participation; also available to pool managers.
accountsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query(
      `SELECT a.accountID, a.adrID, a.username, a.email, p.vNaam, p.tNaam, p.aNaam
       FROM tblAccounts a JOIN tblAdressen p ON p.adrID = a.adrID
       WHERE a.role IN ('user', 'poolbeheerder') AND a.emailVerified = TRUE
       ORDER BY p.aNaam, p.vNaam, a.email`
    );
    response.json(rows);
  } catch (error) { next(error); }
});

accountsRouter.use(requireAdmin);

accountsRouter.get('/manage', async (_request, response, next) => {
  try {
    const rows = await pool.query(
      `SELECT a.accountID, a.adrID, a.username, a.email, a.emailVerified, a.role,
         p.vNaam, p.tNaam, p.aNaam,
         (SELECT GROUP_CONCAT(pm.poolID ORDER BY pm.poolID) FROM tblPoolManagers pm WHERE pm.accountID = a.accountID) AS poolIDs
       FROM tblAccounts a
       JOIN tblAdressen p ON p.adrID = a.adrID
       ORDER BY a.username`
    ) as Array<Record<string, unknown> & { poolIDs: string | null; emailVerified: number | boolean }>;
    response.json(rows.map(row => ({
      ...row,
      emailVerified: Boolean(row.emailVerified),
      poolIDs: row.poolIDs ? String(row.poolIDs).split(',').map(Number) : []
    })));
  } catch (error) { next(error); }
});

accountsRouter.put('/:accountID', async (request, response, next) => {
  let connection;
  try {
    const accountID = idSchema.parse(request.params.accountID);
    const payload = accountUpdateSchema.parse(request.body);
    if (accountID === request.account?.accountID && payload.role !== 'admin') {
      throw new HttpError(400, 'Je kunt je eigen beheerdersrol niet intrekken.');
    }
    const poolIDs = payload.role === 'poolbeheerder' ? [...new Set(payload.poolIDs)] : [];
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const accounts = await connection.query(
      'SELECT accountID FROM tblAccounts WHERE accountID = ? FOR UPDATE', [accountID]
    ) as Array<{ accountID: number }>;
    if (!accounts[0]) throw new HttpError(404, 'Account niet gevonden.');
    if (poolIDs.length) {
      const pools = await connection.query(
        `SELECT poolID FROM tblPools WHERE poolID IN (${poolIDs.map(() => '?').join(', ')})`, poolIDs
      ) as Array<{ poolID: number }>;
      if (pools.length !== poolIDs.length) throw new HttpError(400, 'Een of meer pools bestaan niet.');
    }
    await connection.query('UPDATE tblAccounts SET role = ? WHERE accountID = ?', [payload.role, accountID]);
    await connection.query('DELETE FROM tblPoolManagers WHERE accountID = ?', [accountID]);
    for (const poolID of poolIDs) {
      await connection.query('INSERT INTO tblPoolManagers (accountID, poolID) VALUES (?, ?)', [accountID, poolID]);
    }
    await connection.commit();
    response.json({ accountID, role: payload.role, poolIDs });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});

accountsRouter.post('/:accountID/password-reset', async (request, response, next) => {
  try {
    const accountID = idSchema.parse(request.params.accountID);
    const rows = await pool.query('SELECT accountID, email FROM tblAccounts WHERE accountID = ?', [accountID]) as
      Array<{ accountID: number; email: string }>;
    if (!rows[0]) throw new HttpError(404, 'Account niet gevonden.');
    try {
      await startPasswordReset(rows[0].accountID, rows[0].email);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('Could not send the password-reset email:', error);
      throw new HttpError(503, 'De resetmail kon niet worden verstuurd.');
    }
    response.status(202).json({ message: `Er is een resetlink verstuurd naar ${rows[0].email}.` });
  } catch (error) { next(error); }
});
