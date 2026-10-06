import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const tourTeamsRouter = Router();

const createTourTeamSchema = z.object({
  tourID: z.number().int(),
  ploegID: z.number().int(),
  volgorde: z.number().int().nullable().optional()
});

const updateTourTeamSchema = z.object({
  volgorde: z.number().int().nullable().optional()
});

tourTeamsRouter.get('/', async (request, response, next) => {
  try {
    const { tourID, ploegID } = request.query;
    let query = `
      SELECT 
        tp.tourID, 
        t.naam AS tourNaam,
        tp.ploegID, 
        p.naam AS ploegNaam, 
        p.ploegCode, 
        p.landID AS ploegLand,
        tp.volgorde
      FROM tblTourPloegen tp
      JOIN tblTours t ON tp.tourID = t.tourID
      JOIN tblPloegen p ON tp.ploegID = p.ploegID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (tourID !== undefined && tourID !== '') {
      conditions.push('tp.tourID = ?');
      params.push(Number(tourID));
    }

    if (ploegID !== undefined && ploegID !== '') {
      conditions.push('tp.ploegID = ?');
      params.push(Number(ploegID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY tp.tourID, COALESCE(tp.volgorde, 9999), p.naam';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

tourTeamsRouter.get('/:tourID/:ploegID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);

    const rows = await pool.query(
      `SELECT 
        tp.tourID, 
        t.naam AS tourNaam,
        tp.ploegID, 
        p.naam AS ploegNaam, 
        p.ploegCode, 
        p.landID AS ploegLand,
        tp.volgorde
      FROM tblTourPloegen tp
      JOIN tblTours t ON tp.tourID = t.tourID
      JOIN tblPloegen p ON tp.ploegID = p.ploegID
      WHERE tp.tourID = ? AND tp.ploegID = ?`,
      [tourID, ploegID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Tour team entry not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

tourTeamsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createTourTeamSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblTourPloegen (tourID, ploegID, volgorde) VALUES (?, ?, ?)',
      [payload.tourID, payload.ploegID, payload.volgorde ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

tourTeamsRouter.put('/:tourID/:ploegID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);
    const payload = updateTourTeamSchema.parse(request.body);

    await pool.query(
      'UPDATE tblTourPloegen SET volgorde = ? WHERE tourID = ? AND ploegID = ?',
      [payload.volgorde ?? null, tourID, ploegID]
    );

    response.json({ tourID, ploegID, volgorde: payload.volgorde ?? null });
  } catch (error) {
    next(error);
  }
});

tourTeamsRouter.delete('/:tourID/:ploegID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);

    await pool.query(
      'DELETE FROM tblTourPloegen WHERE tourID = ? AND ploegID = ?',
      [tourID, ploegID]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
