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

const bulkUpdateSchema = z.object({
  riders: z.array(z.object({
    rennerID: z.number().int(),
    positie: z.number().int().nullable().optional()
  }))
});

participantRidersRouter.get('/', async (request, response, next) => {
  try {
    const { deelnID, rennerID } = request.query;
    let query = `
      SELECT 
        dr.deelnID, 
        dr.rennerID, 
        dr.positie,
        r.anaam,
        r.vnaam,
        r.tnaam,
        r.landID AS rennerLand,
        pr.Rugnummer,
        p.naam AS ploegNaam,
        p.ploegCode
      FROM tblDeelnemRenners dr
      JOIN tblRenners r ON dr.rennerID = r.rennerID
      LEFT JOIN tblDeelnemers d ON dr.deelnID = d.deelnID
      LEFT JOIN tblPools pl ON d.poolID = pl.poolID
      LEFT JOIN tblPloegRenners pr ON (dr.rennerID = pr.rennerID AND pl.tourID = pr.tourID)
      LEFT JOIN tblPloegen p ON pr.ploegID = p.ploegID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (deelnID !== undefined && deelnID !== '') {
      conditions.push('dr.deelnID = ?');
      params.push(Number(deelnID));
    }

    if (rennerID !== undefined && rennerID !== '') {
      conditions.push('dr.rennerID = ?');
      params.push(Number(rennerID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY dr.deelnID, dr.positie, dr.rennerID';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

participantRidersRouter.put('/batch/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const payload = bulkUpdateSchema.parse(request.body);

    // Verwijder oude opstelling voor deze deelnemer
    await pool.query('DELETE FROM tblDeelnemRenners WHERE deelnID = ?', [deelnID]);

    // Voeg nieuwe renners toe
    for (let i = 0; i < payload.riders.length; i++) {
      const r = payload.riders[i];
      const positie = r.positie ?? (i + 1);
      await pool.query(
        'INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)',
        [deelnID, r.rennerID, positie]
      );
    }

    response.json({ deelnID, count: payload.riders.length });
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
