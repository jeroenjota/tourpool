import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const participantRidersRouter = Router();

const createParticipantRiderSchema = z.object({
  deelnID: z.number().int(),
  rennerID: z.number().int(),
  positie: z.number().int().nullable().optional()
});

const updateParticipantRiderSchema = z.object({
  positie: z.number().int().nullable().optional()
});

participantRidersRouter.get('/', async (request, response, next) => {
  try {
    const { deelnID, rennerID } = request.query;
    let query = 'SELECT deelnID, rennerID, positie FROM tblDeelnemRenners';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (deelnID !== undefined && deelnID !== '') {
      conditions.push('deelnID = ?');
      params.push(Number(deelnID));
    }

    if (rennerID !== undefined && rennerID !== '') {
      conditions.push('rennerID = ?');
      params.push(Number(rennerID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY deelnID, positie, rennerID';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

participantRidersRouter.get('/:deelnID/:rennerID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const rennerID = Number(request.params.rennerID);

    const rows = await pool.query(
      'SELECT deelnID, rennerID, positie FROM tblDeelnemRenners WHERE deelnID = ? AND rennerID = ?',
      [deelnID, rennerID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Participant rider not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

participantRidersRouter.post('/', async (request, response, next) => {
  try {
    const payload = createParticipantRiderSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)',
      [payload.deelnID, payload.rennerID, payload.positie ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

participantRidersRouter.put('/:deelnID/:rennerID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const rennerID = Number(request.params.rennerID);
    const payload = updateParticipantRiderSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT deelnID, rennerID, positie FROM tblDeelnemRenners WHERE deelnID = ? AND rennerID = ?',
      [deelnID, rennerID]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Participant rider not found' });
      return;
    }

    const updatedPositie = payload.positie !== undefined ? payload.positie : current.positie;

    await pool.query(
      'UPDATE tblDeelnemRenners SET positie = ? WHERE deelnID = ? AND rennerID = ?',
      [updatedPositie, deelnID, rennerID]
    );

    response.json({ deelnID, rennerID, positie: updatedPositie });
  } catch (error) {
    next(error);
  }
});

participantRidersRouter.delete('/:deelnID/:rennerID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const rennerID = Number(request.params.rennerID);

    await pool.query(
      'DELETE FROM tblDeelnemRenners WHERE deelnID = ? AND rennerID = ?',
      [deelnID, rennerID]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
