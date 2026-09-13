import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const stageResultsRouter = Router();

const createStageResultSchema = z.object({
  tourID: z.number().int(),
  etappeNr: z.number().int(),
  uitslagType: z.string().max(10),
  plaats: z.number().int(),
  rennerID: z.number().int()
});

const updateStageResultSchema = z.object({
  rennerID: z.number().int()
});

stageResultsRouter.get('/', async (request, response, next) => {
  try {
    const { tourID, etappeNr, uitslagType, rennerID } = request.query;
    let query = 'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (tourID !== undefined && tourID !== '') {
      conditions.push('tourID = ?');
      params.push(Number(tourID));
    }

    if (etappeNr !== undefined && etappeNr !== '') {
      conditions.push('etappeNr = ?');
      params.push(Number(etappeNr));
    }

    if (typeof uitslagType === 'string' && uitslagType.trim() !== '') {
      conditions.push('uitslagType = ?');
      params.push(uitslagType.trim());
    }

    if (rennerID !== undefined && rennerID !== '') {
      conditions.push('rennerID = ?');
      params.push(Number(rennerID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY tourID, etappeNr, uitslagType, plaats';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.get('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);

    const rows = await pool.query(
      'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Stage result not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createStageResultSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblEtappeUitslag (tourID, etappeNr, uitslagType, plaats, rennerID) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.etappeNr, payload.uitslagType, payload.plaats, payload.rennerID]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.put('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);
    const payload = updateStageResultSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Stage result not found' });
      return;
    }

    await pool.query(
      'UPDATE tblEtappeUitslag SET rennerID = ? WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [payload.rennerID, tourID, etappeNr, uitslagType, plaats]
    );

    response.json({ tourID, etappeNr, uitslagType, plaats, rennerID: payload.rennerID });
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.delete('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);

    await pool.query(
      'DELETE FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
