import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const participantsRouter = Router();

const createParticipantSchema = z.object({
  poolID: z.number().int(),
  adrID: z.number().int(),
  roepnaam: z.string().max(255).nullable().optional(),
  Betaald: z.union([z.boolean(), z.number().int().min(0).max(1)]).nullable().optional(),
  riders: z.array(z.object({
    rennerID: z.number().int(),
    positie: z.number().int().nullable().optional()
  })).optional()
});

const updateParticipantSchema = createParticipantSchema.partial();

participantsRouter.get('/', async (request, response, next) => {
  try {
    const { poolID, adrID } = request.query;
    let query = `
      SELECT 
        d.deelnID, 
        d.poolID, 
        p.Naam AS poolNaam,
        d.adrID, 
        a.vNaam,
        a.tNaam,
        a.aNaam,
        a.plaats,
        a.tel,
        a.email,
        d.roepnaam, 
        d.Betaald 
      FROM tblDeelnemers d
      JOIN tblAdressen a ON d.adrID = a.adrID
      LEFT JOIN tblPools p ON d.poolID = p.poolID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (poolID !== undefined && poolID !== '') {
      conditions.push('d.poolID = ?');
      params.push(Number(poolID));
    }

    if (adrID !== undefined && adrID !== '') {
      conditions.push('d.adrID = ?');
      params.push(Number(adrID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY d.poolID, a.aNaam, a.vNaam';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

participantsRouter.get('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const rows = await pool.query(
      `SELECT 
        d.deelnID, 
        d.poolID, 
        p.Naam AS poolNaam,
        d.adrID, 
        a.vNaam,
        a.tNaam,
        a.aNaam,
        a.plaats,
        a.tel,
        a.email,
        d.roepnaam, 
        d.Betaald 
      FROM tblDeelnemers d
      JOIN tblAdressen a ON d.adrID = a.adrID
      LEFT JOIN tblPools p ON d.poolID = p.poolID
      WHERE d.deelnID = ?`,
      [deelnID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Participant not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

participantsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createParticipantSchema.parse(request.body);
    const betaaldVal = payload.Betaald === undefined || payload.Betaald === null ? null : (payload.Betaald ? 1 : 0);

    const result = await pool.query(
      'INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald) VALUES (?, ?, ?, ?)',
      [payload.poolID, payload.adrID, payload.roepnaam ?? null, betaaldVal]
    );

    const deelnID = Number((result as { insertId: number | bigint }).insertId);

    if (payload.riders && payload.riders.length > 0) {
      for (let i = 0; i < payload.riders.length; i++) {
        const r = payload.riders[i];
        const positie = r.positie ?? (i + 1);
        await pool.query(
          'INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)',
          [deelnID, r.rennerID, positie]
        );
      }
    }

    response.status(201).json({
      ...payload,
      deelnID
    });
  } catch (error) {
    next(error);
  }
});

participantsRouter.put('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const payload = updateParticipantSchema.parse(request.body);

    const rows = await pool.query('SELECT deelnID, poolID, adrID, roepnaam, Betaald FROM tblDeelnemers WHERE deelnID = ?', [deelnID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Participant not found' });
      return;
    }

    const betaaldVal = payload.Betaald !== undefined
      ? (payload.Betaald === null ? null : (payload.Betaald ? 1 : 0))
      : current.Betaald;

    const updated = {
      poolID: payload.poolID !== undefined ? payload.poolID : current.poolID,
      adrID: payload.adrID !== undefined ? payload.adrID : current.adrID,
      roepnaam: payload.roepnaam !== undefined ? payload.roepnaam : current.roepnaam,
      Betaald: betaaldVal
    };

    await pool.query(
      'UPDATE tblDeelnemers SET poolID = ?, adrID = ?, roepnaam = ?, Betaald = ? WHERE deelnID = ?',
      [updated.poolID, updated.adrID, updated.roepnaam, updated.Betaald, deelnID]
    );

    response.json({ deelnID, ...updated });
  } catch (error) {
    next(error);
  }
});

participantsRouter.delete('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    await pool.query('DELETE FROM tblDeelnemers WHERE deelnID = ?', [deelnID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
