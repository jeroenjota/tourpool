import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const participantPointsRouter = Router();

const createParticipantPointsSchema = z.object({
  deelnemID: z.number().int(),
  etappeNr: z.number().int(),
  ritPnt: z.number().int().nullable().optional(),
  geelPnt: z.number().int().nullable().optional(),
  groenPnt: z.number().int().nullable().optional(),
  bolPnt: z.number().int().nullable().optional(),
  witPnt: z.number().int().nullable().optional(),
  etapPnt: z.number().int().nullable().optional(),
  etapPlaats: z.number().int().nullable().optional(),
  etapGeld: z.number().nullable().optional(),
  ttlPnt: z.number().int().nullable().optional(),
  ttlPlaats: z.number().int().nullable().optional(),
  ttlGeld: z.number().nullable().optional()
});

const updateParticipantPointsSchema = createParticipantPointsSchema.omit({ deelnemID: true, etappeNr: true }).partial();

participantPointsRouter.get('/', async (request, response, next) => {
  try {
    const { deelnemID, etappeNr } = request.query;
    let query = 'SELECT deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt, etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld FROM tblDeelnemerPunten';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (deelnemID !== undefined && deelnemID !== '') {
      conditions.push('deelnemID = ?');
      params.push(Number(deelnemID));
    }

    if (etappeNr !== undefined && etappeNr !== '') {
      conditions.push('etappeNr = ?');
      params.push(Number(etappeNr));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY etappeNr, ttlPlaats, deelnemID';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

participantPointsRouter.get('/:deelnemID/:etappeNr', async (request, response, next) => {
  try {
    const deelnemID = Number(request.params.deelnemID);
    const etappeNr = Number(request.params.etappeNr);

    const rows = await pool.query(
      'SELECT deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt, etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld FROM tblDeelnemerPunten WHERE deelnemID = ? AND etappeNr = ?',
      [deelnemID, etappeNr]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Participant points entry not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

participantPointsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createParticipantPointsSchema.parse(request.body);
    await pool.query(
      `INSERT INTO tblDeelnemerPunten 
      (deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt, etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.deelnemID,
        payload.etappeNr,
        payload.ritPnt ?? 0,
        payload.geelPnt ?? 0,
        payload.groenPnt ?? 0,
        payload.bolPnt ?? 0,
        payload.witPnt ?? 0,
        payload.etapPnt ?? 0,
        payload.etapPlaats ?? 0,
        payload.etapGeld ?? 0,
        payload.ttlPnt ?? 0,
        payload.ttlPlaats ?? 0,
        payload.ttlGeld ?? 0
      ]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

participantPointsRouter.put('/:deelnemID/:etappeNr', async (request, response, next) => {
  try {
    const deelnemID = Number(request.params.deelnemID);
    const etappeNr = Number(request.params.etappeNr);
    const payload = updateParticipantPointsSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt, etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld FROM tblDeelnemerPunten WHERE deelnemID = ? AND etappeNr = ?',
      [deelnemID, etappeNr]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Participant points entry not found' });
      return;
    }

    const updated = {
      ritPnt: payload.ritPnt !== undefined ? payload.ritPnt : current.ritPnt,
      geelPnt: payload.geelPnt !== undefined ? payload.geelPnt : current.geelPnt,
      groenPnt: payload.groenPnt !== undefined ? payload.groenPnt : current.groenPnt,
      bolPnt: payload.bolPnt !== undefined ? payload.bolPnt : current.bolPnt,
      witPnt: payload.witPnt !== undefined ? payload.witPnt : current.witPnt,
      etapPnt: payload.etapPnt !== undefined ? payload.etapPnt : current.etapPnt,
      etapPlaats: payload.etapPlaats !== undefined ? payload.etapPlaats : current.etapPlaats,
      etapGeld: payload.etapGeld !== undefined ? payload.etapGeld : current.etapGeld,
      ttlPnt: payload.ttlPnt !== undefined ? payload.ttlPnt : current.ttlPnt,
      ttlPlaats: payload.ttlPlaats !== undefined ? payload.ttlPlaats : current.ttlPlaats,
      ttlGeld: payload.ttlGeld !== undefined ? payload.ttlGeld : current.ttlGeld
    };

    await pool.query(
      `UPDATE tblDeelnemerPunten SET 
      ritPnt = ?, geelPnt = ?, groenPnt = ?, bolPnt = ?, witPnt = ?, etapPnt = ?, etapPlaats = ?, etapGeld = ?, ttlPnt = ?, ttlPlaats = ?, ttlGeld = ? 
      WHERE deelnemID = ? AND etappeNr = ?`,
      [
        updated.ritPnt,
        updated.geelPnt,
        updated.groenPnt,
        updated.bolPnt,
        updated.witPnt,
        updated.etapPnt,
        updated.etapPlaats,
        updated.etapGeld,
        updated.ttlPnt,
        updated.ttlPlaats,
        updated.ttlGeld,
        deelnemID,
        etappeNr
      ]
    );

    response.json({ deelnemID, etappeNr, ...updated });
  } catch (error) {
    next(error);
  }
});

participantPointsRouter.delete('/:deelnemID/:etappeNr', async (request, response, next) => {
  try {
    const deelnemID = Number(request.params.deelnemID);
    const etappeNr = Number(request.params.etappeNr);

    await pool.query(
      'DELETE FROM tblDeelnemerPunten WHERE deelnemID = ? AND etappeNr = ?',
      [deelnemID, etappeNr]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
