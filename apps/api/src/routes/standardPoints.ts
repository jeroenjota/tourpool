import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const standardPointsRouter = Router();

const createStandardPointSchema = z.object({
  Omschrijving: z.string().max(100).nullable().optional(),
  punten: z.number().int().default(0),
  volgorde: z.number().int().nullable().optional()
});

const updateStandardPointSchema = createStandardPointSchema.partial();

const presetsSchema = z.object({
  items: z.array(z.object({
    Omschrijving: z.string().max(100),
    uitslagtype: z.enum(['rit', 'klasGeel', 'klasGroen', 'klasBol', 'klasWit', 'eindKlas', 'eindPunt', 'eindBerg', 'eindJon']),
    plaats: z.number().int().min(1),
    punten: z.number().int(),
    volgorde: z.number().int().nullable().optional()
  })).min(1)
});

standardPointsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT prestatieID, uitslagtype, plaats, Omschrijving, punten, volgorde FROM tblStandaardPunten ORDER BY COALESCE(volgorde, 9999), prestatieID');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

standardPointsRouter.put('/presets', async (request, response, next) => {
  let payload: z.infer<typeof presetsSchema>;
  try {
    payload = presetsSchema.parse(request.body);
  } catch (error) {
    next(error);
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM tblStandaardPunten');
    for (const item of payload.items) {
      await connection.query(
        'INSERT INTO tblStandaardPunten (uitslagtype, plaats, Omschrijving, punten, volgorde) VALUES (?, ?, ?, ?, ?)',
        [item.uitslagtype, item.plaats, item.Omschrijving, item.punten, item.volgorde ?? null]
      );
    }
    await connection.commit();
    response.json({ success: true, inserted: payload.items.length });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

standardPointsRouter.get('/:prestatieID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const rows = await pool.query('SELECT prestatieID, uitslagtype, plaats, Omschrijving, punten, volgorde FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
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
      'INSERT INTO tblStandaardPunten (Omschrijving, punten, volgorde) VALUES (?, ?, ?)',
      [payload.Omschrijving ?? null, payload.punten ?? 0, payload.volgorde ?? null]
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

    const rows = await pool.query('SELECT prestatieID, Omschrijving, punten, volgorde FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Standard point definition not found' });
      return;
    }

    const updated = {
      Omschrijving: payload.Omschrijving !== undefined ? payload.Omschrijving : current.Omschrijving,
      punten: payload.punten !== undefined ? payload.punten : current.punten,
      volgorde: payload.volgorde !== undefined ? payload.volgorde : current.volgorde
    };

    await pool.query(
      'UPDATE tblStandaardPunten SET Omschrijving = ?, punten = ?, volgorde = ? WHERE prestatieID = ?',
      [updated.Omschrijving, updated.punten, updated.volgorde ?? null, prestatieID]
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
