import { Router } from 'express';
import { requireAdmin } from '../auth.js';
import { pool } from '../db.js';

export const accountsRouter = Router();
accountsRouter.use(requireAdmin);
accountsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query(
      `SELECT a.accountID, a.adrID, a.email, p.vNaam, p.tNaam, p.aNaam
       FROM tblAccounts a JOIN tblAdressen p ON p.adrID = a.adrID
       WHERE a.role = 'user' ORDER BY p.aNaam, p.vNaam, a.email`
    );
    response.json(rows);
  } catch (error) { next(error); }
});
