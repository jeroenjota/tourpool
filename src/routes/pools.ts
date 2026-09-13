import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const poolsRouter = Router();

const createPoolSchema = z.object({
  tourID: z.number().int(),
  Naam: z.string().max(255).nullable().optional(),
  Org: z.string().max(255).nullable().optional(),
  StartInschr: z.string().datetime().nullable().optional(),
  EindInschr: z.string().datetime().nullable().optional()
});

const updatePoolSchema = createPoolSchema.partial();

poolsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT poolID, tourID, Naam, Org, StartInschr, EindInschr FROM tblPools ORDER BY poolID DESC');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

poolsRouter.get('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const rows = await pool.query('SELECT poolID, tourID, Naam, Org, StartInschr, EindInschr FROM tblPools WHERE poolID = ?', [poolID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Pool not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

poolsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createPoolSchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblPools (tourID, Naam, Org, StartInschr, EindInschr) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.Naam ?? null, payload.Org ?? null, payload.StartInschr ?? null, payload.EindInschr ?? null]
    );

    response.status(201).json({
      ...payload,
      poolID: Number((result as { insertId: number | bigint }).insertId)
    });
  } catch (error) {
    next(error);
  }
});

poolsRouter.put('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const payload = updatePoolSchema.parse(request.body);

    const rows = await pool.query('SELECT poolID, tourID, Naam, Org, StartInschr, EindInschr FROM tblPools WHERE poolID = ?', [poolID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Pool not found' });
      return;
    }

    const updatedPool = {
      tourID: payload.tourID !== undefined ? payload.tourID : current.tourID,
      Naam: payload.Naam !== undefined ? payload.Naam : current.Naam,
      Org: payload.Org !== undefined ? payload.Org : current.Org,
      StartInschr: payload.StartInschr !== undefined ? payload.StartInschr : current.StartInschr,
      EindInschr: payload.EindInschr !== undefined ? payload.EindInschr : current.EindInschr
    };

    await pool.query(
      'UPDATE tblPools SET tourID = ?, Naam = ?, Org = ?, StartInschr = ?, EindInschr = ? WHERE poolID = ?',
      [updatedPool.tourID, updatedPool.Naam, updatedPool.Org, updatedPool.StartInschr, updatedPool.EindInschr, poolID]
    );

    response.json({ poolID, ...updatedPool });
  } catch (error) {
    next(error);
  }
});

poolsRouter.delete('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    await pool.query('DELETE FROM tblPools WHERE poolID = ?', [poolID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});