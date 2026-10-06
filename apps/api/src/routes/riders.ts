import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const ridersRouter = Router();

const createRiderSchema = z.object({
  anaam: z.string().max(255).nullable().optional(),
  tnaam: z.string().max(255).nullable().optional(),
  vnaam: z.string().max(255).nullable().optional(),
  landID: z.string().max(10).nullable().optional(),
  gebDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

const updateRiderSchema = createRiderSchema.partial();

ridersRouter.get('/', async (request, response, next) => {
  try {
    const { landID, search } = request.query;
    let query = `SELECT rennerID, anaam, tnaam, vnaam, CONCAT(anaam, ', ', TRIM(CONCAT(COALESCE(vnaam, ''), ' ', COALESCE(tnaam, '')))) AS Naam, landID, gebDatum FROM tblRenners`;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (typeof landID === 'string' && landID.trim() !== '') {
      conditions.push('landID = ?');
      params.push(landID.trim());
    }

    if (typeof search === 'string' && search.trim() !== '') {
      conditions.push('(anaam LIKE ? OR vnaam LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY anaam, vnaam';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

ridersRouter.get('/:rennerID', async (request, response, next) => {
  try {
    const rennerID = Number(request.params.rennerID);
    const rows = await pool.query(`SELECT rennerID, anaam, tnaam, vnaam, CONCAT(anaam, ', ', TRIM(CONCAT(COALESCE(vnaam, ''), ' ', COALESCE(tnaam, '')))) AS volledigeNaam, landID, gebDatum FROM tblRenners WHERE rennerID = ?`, [rennerID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Rider not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

ridersRouter.post('/', async (request, response, next) => {
  try {
    const payload = createRiderSchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblRenners (anaam, tnaam, vnaam, landID, gebDatum) VALUES (?, ?, ?, ?, ?)',
      [payload.anaam ?? null, payload.tnaam ?? null, payload.vnaam ?? null, payload.landID ?? null, payload.gebDatum ?? null]
    );

    response.status(201).json({
      ...payload,
      rennerID: Number((result as { insertId: number | bigint }).insertId)
    });
  } catch (error) {
    next(error);
  }
});

ridersRouter.put('/:rennerID', async (request, response, next) => {
  try {
    const rennerID = Number(request.params.rennerID);
    const payload = updateRiderSchema.parse(request.body);

    const rows = await pool.query('SELECT rennerID, anaam, tnaam, vnaam, landID, gebDatum FROM tblRenners WHERE rennerID = ?', [rennerID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Rider not found' });
      return;
    }

    const updatedRider = {
      anaam: payload.anaam !== undefined ? payload.anaam : current.anaam,
      tnaam: payload.tnaam !== undefined ? payload.tnaam : current.tnaam,
      vnaam: payload.vnaam !== undefined ? payload.vnaam : current.vnaam,
      landID: payload.landID !== undefined ? payload.landID : current.landID,
      gebDatum: payload.gebDatum !== undefined ? payload.gebDatum : current.gebDatum
    };

    await pool.query(
      'UPDATE tblRenners SET anaam = ?, tnaam = ?, vnaam = ?, landID = ?, gebDatum = ? WHERE rennerID = ?',
      [updatedRider.anaam, updatedRider.tnaam, updatedRider.vnaam, updatedRider.landID, updatedRider.gebDatum, rennerID]
    );

    response.json({ rennerID, ...updatedRider });
  } catch (error) {
    next(error);
  }
});

ridersRouter.delete('/:rennerID', async (request, response, next) => {
  try {
    const rennerID = Number(request.params.rennerID);
    await pool.query('DELETE FROM tblRenners WHERE rennerID = ?', [rennerID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
