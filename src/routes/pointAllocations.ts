import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const pointAllocationsRouter = Router();

const createPointAllocationSchema = z.object({
  prestatieID: z.number().int(),
  poolID: z.number().int(),
  Omschrijving: z.string().max(100).nullable().optional(),
  Punten: z.number().int().nullable().optional()
});

const updatePointAllocationSchema = z.object({
  Omschrijving: z.string().max(100).nullable().optional(),
  Punten: z.number().int().nullable().optional()
});

pointAllocationsRouter.get('/', async (request, response, next) => {
  try {
    const { poolID, prestatieID } = request.query;
    let query = 'SELECT prestatieID, poolID, Omschrijving, Punten FROM tblPuntenToekenning';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (poolID !== undefined && poolID !== '') {
      conditions.push('poolID = ?');
      params.push(Number(poolID));
    }

    if (prestatieID !== undefined && prestatieID !== '') {
      conditions.push('prestatieID = ?');
      params.push(Number(prestatieID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY poolID, prestatieID';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.get('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);

    const rows = await pool.query(
      'SELECT prestatieID, poolID, Omschrijving, Punten FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ?',
      [prestatieID, poolID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Point allocation not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createPointAllocationSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblPuntenToekenning (prestatieID, poolID, Omschrijving, Punten) VALUES (?, ?, ?, ?)',
      [payload.prestatieID, payload.poolID, payload.Omschrijving ?? null, payload.Punten ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.put('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);
    const payload = updatePointAllocationSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT prestatieID, poolID, Omschrijving, Punten FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ?',
      [prestatieID, poolID]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Point allocation not found' });
      return;
    }

    const updated = {
      Omschrijving: payload.Omschrijving !== undefined ? payload.Omschrijving : current.Omschrijving,
      Punten: payload.Punten !== undefined ? payload.Punten : current.Punten
    };

    await pool.query(
      'UPDATE tblPuntenToekenning SET Omschrijving = ?, Punten = ? WHERE prestatieID = ? AND poolID = ?',
      [updated.Omschrijving, updated.Punten, prestatieID, poolID]
    );

    response.json({ prestatieID, poolID, ...updated });
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.delete('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);

    await pool.query(
      'DELETE FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ?',
      [prestatieID, poolID]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
