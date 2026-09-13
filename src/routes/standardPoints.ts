import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const standardPointsRouter = Router();

const createStandardPointSchema = z.object({
  Omschrijving: z.string().max(100).nullable().optional(),
  punten: z.number().int().default(0)
});

const updateStandardPointSchema = createStandardPointSchema.partial();

standardPointsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT prestatieID, Omschrijving, punten FROM tblStandaardPunten ORDER BY prestatieID');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

standardPointsRouter.get('/:prestatieID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const rows = await pool.query('SELECT prestatieID, Omschrijving, punten FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Standard point definition not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

standardPointsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createStandardPointSchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblStandaardPunten (Omschrijving, punten) VALUES (?, ?)',
      [payload.Omschrijving ?? null, payload.punten ?? 0]
    );

    response.status(201).json({
      ...payload,
      prestatieID: Number((result as { insertId: number | bigint }).insertId)
    });
  } catch (error) {
    next(error);
  }
});

standardPointsRouter.put('/:prestatieID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const payload = updateStandardPointSchema.parse(request.body);

    const rows = await pool.query('SELECT prestatieID, Omschrijving, punten FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Standard point definition not found' });
      return;
    }

    const updated = {
      Omschrijving: payload.Omschrijving !== undefined ? payload.Omschrijving : current.Omschrijving,
      punten: payload.punten !== undefined ? payload.punten : current.punten
    };

    await pool.query(
      'UPDATE tblStandaardPunten SET Omschrijving = ?, punten = ? WHERE prestatieID = ?',
      [updated.Omschrijving, updated.punten, prestatieID]
    );

    response.json({ prestatieID, ...updated });
  } catch (error) {
    next(error);
  }
});

standardPointsRouter.delete('/:prestatieID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    await pool.query('DELETE FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
