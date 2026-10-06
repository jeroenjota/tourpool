import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const standardPointsRouter = Router();

const uitslagtypeSchema = z.enum(['rit', 'klasGeel', 'klasGroen', 'klasBol', 'klasWit', 'eindKlas', 'eindPunt', 'eindBerg', 'eindJon']);

const createStandardPointSchema = z.object({
  Omschrijving: z.string().max(100).nullable().optional(),
  uitslagtype: uitslagtypeSchema.nullable().optional(),
  plaats: z.number().int().min(1).nullable().optional(),
  punten: z.number().int().default(0),
  volgorde: z.number().int().nullable().optional()
});

const updateStandardPointSchema = createStandardPointSchema.partial();

const presetsSchema = z.object({
  items: z.array(z.object({
    Omschrijving: z.string().max(100),
    uitslagtype: uitslagtypeSchema,
    plaats: z.number().int().min(1),
    punten: z.number().int(),
    volgorde: z.number().int().nullable().optional()
  })).min(1)
});

const duplicatePlaceMessage = async (
  uitslagtype: string | null | undefined,
  plaats: number | null | undefined,
  excludeID?: number
) => {
  if (!uitslagtype || plaats == null) return null;
  const rows = await pool.query(
    'SELECT Omschrijving FROM tblStandaardPunten WHERE uitslagtype = ? AND plaats = ? AND prestatieID <> ? LIMIT 1',
    [uitslagtype, plaats, excludeID ?? 0]
  ) as Array<{ Omschrijving: string | null }>;
  return rows[0]
    ? `Plaats ${plaats} voor ${uitslagtype} bestaat al ("${rows[0].Omschrijving ?? ''}")`
    : null;
};

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
    const duplicate = await duplicatePlaceMessage(payload.uitslagtype, payload.plaats);
    if (duplicate) {
      response.status(409).json({ message: duplicate });
      return;
    }
    const result = await pool.query(
      'INSERT INTO tblStandaardPunten (uitslagtype, plaats, Omschrijving, punten, volgorde) VALUES (?, ?, ?, ?, ?)',
      [payload.uitslagtype ?? null, payload.plaats ?? null, payload.Omschrijving ?? null, payload.punten ?? 0, payload.volgorde ?? null]
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

    const rows = await pool.query('SELECT prestatieID, uitslagtype, plaats, Omschrijving, punten, volgorde FROM tblStandaardPunten WHERE prestatieID = ?', [prestatieID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Standard point definition not found' });
      return;
    }

    const updated = {
      uitslagtype: payload.uitslagtype !== undefined ? payload.uitslagtype : current.uitslagtype as string | null,
      plaats: payload.plaats !== undefined ? payload.plaats : current.plaats as number | null,
      Omschrijving: payload.Omschrijving !== undefined ? payload.Omschrijving : current.Omschrijving,
      punten: payload.punten !== undefined ? payload.punten : current.punten,
      volgorde: payload.volgorde !== undefined ? payload.volgorde : current.volgorde
    };

    const duplicate = await duplicatePlaceMessage(updated.uitslagtype, updated.plaats, prestatieID);
    if (duplicate) {
      response.status(409).json({ message: duplicate });
      return;
    }

    await pool.query(
      'UPDATE tblStandaardPunten SET uitslagtype = ?, plaats = ?, Omschrijving = ?, punten = ?, volgorde = ? WHERE prestatieID = ?',
      [updated.uitslagtype ?? null, updated.plaats ?? null, updated.Omschrijving, updated.punten, updated.volgorde ?? null, prestatieID]
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
