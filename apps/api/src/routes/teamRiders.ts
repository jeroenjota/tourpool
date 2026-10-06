import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const teamRidersRouter = Router();

const createTeamRiderSchema = z.object({
  tourID: z.number().int(),
  ploegID: z.number().int(),
  rennerID: z.number().int(),
  Rugnummer: z.number().int(),
  nietGestartEtappe: z.number().int().nullable().optional()
});

const updateTeamRiderSchema = z.object({
  Rugnummer: z.number().int().optional(),
  nietGestartEtappe: z.number().int().nullable().optional()
});

teamRidersRouter.get('/view', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT rennerID, Renner, uit, nr, ploeg, land, Opgave FROM vwPloegRenners');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.get('/', async (request, response, next) => {
  try {
    const { tourID, ploegID, rennerID } = request.query;
    let query = `
      SELECT 
        pr.tourID, 
        pr.ploegID, 
        p.naam AS ploegNaam,
        p.ploegCode,
        p.landID AS ploegLand,
        pr.rennerID, 
        pr.Rugnummer, 
        pr.nietGestartEtappe,
        r.anaam,
        r.vnaam,
        r.tnaam,
        r.landID AS rennerLand
      FROM tblPloegRenners pr
      JOIN tblPloegen p ON pr.ploegID = p.ploegID
      JOIN tblRenners r ON pr.rennerID = r.rennerID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (tourID !== undefined && tourID !== '') {
      conditions.push('pr.tourID = ?');
      params.push(Number(tourID));
    }

    if (ploegID !== undefined && ploegID !== '') {
      conditions.push('pr.ploegID = ?');
      params.push(Number(ploegID));
    }

    if (rennerID !== undefined && rennerID !== '') {
      conditions.push('pr.rennerID = ?');
      params.push(Number(rennerID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY pr.tourID, p.naam, pr.Rugnummer';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.get('/:tourID/:ploegID/:rennerID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);
    const rennerID = Number(request.params.rennerID);

    const rows = await pool.query(
      'SELECT tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe FROM tblPloegRenners WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
      [tourID, ploegID, rennerID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Team rider entry not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.post('/', async (request, response, next) => {
  try {
    const payload = createTeamRiderSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblPloegRenners (tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.ploegID, payload.rennerID, payload.Rugnummer, payload.nietGestartEtappe ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.put('/:tourID/:ploegID/:rennerID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);
    const rennerID = Number(request.params.rennerID);
    const payload = updateTeamRiderSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe FROM tblPloegRenners WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
      [tourID, ploegID, rennerID]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Team rider entry not found' });
      return;
    }

    const updated = {
      Rugnummer: payload.Rugnummer !== undefined ? payload.Rugnummer : current.Rugnummer,
      nietGestartEtappe: payload.nietGestartEtappe !== undefined ? payload.nietGestartEtappe : current.nietGestartEtappe
    };

    await pool.query(
      'UPDATE tblPloegRenners SET Rugnummer = ?, nietGestartEtappe = ? WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
      [updated.Rugnummer, updated.nietGestartEtappe, tourID, ploegID, rennerID]
    );

    response.json({ tourID, ploegID, rennerID, ...updated });
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.delete('/:tourID/:ploegID/:rennerID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);
    const rennerID = Number(request.params.rennerID);

    await pool.query(
      'DELETE FROM tblPloegRenners WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
      [tourID, ploegID, rennerID]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
