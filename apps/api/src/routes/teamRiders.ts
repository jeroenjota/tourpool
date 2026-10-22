import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { recalculatePoolPoints } from './stageResults.js';

export const teamRidersRouter = Router();

const createTeamRiderSchema = z.object({
  tourID: z.number().int(),
  ploegID: z.number().int(),
  rennerID: z.number().int(),
  Rugnummer: z.number().int(),
  nietGestartEtappe: z.number().int().nullable().optional(),
  neemtDeel: z.boolean().optional()
});

const updateTeamRiderSchema = z.object({
  Rugnummer: z.number().int().optional(),
  nietGestartEtappe: z.number().int().nullable().optional(),
  neemtDeel: z.boolean().optional()
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
    const { tourID, ploegID, rennerID, activeOnly } = request.query;
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
        pr.neemtDeel,
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
    if (activeOnly === '1') conditions.push('pr.neemtDeel = 1');

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
      'SELECT tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe, neemtDeel FROM tblPloegRenners WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
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
      'INSERT INTO tblPloegRenners (tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe, neemtDeel) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.tourID, payload.ploegID, payload.rennerID, payload.Rugnummer, payload.nietGestartEtappe ?? null, payload.neemtDeel === false ? 0 : 1]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

teamRidersRouter.put('/:tourID/:ploegID/:rennerID', async (request, response, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const tourID = Number(request.params.tourID);
    const ploegID = Number(request.params.ploegID);
    const rennerID = Number(request.params.rennerID);
    const payload = updateTeamRiderSchema.parse(request.body);

    await connection.beginTransaction();
    const rows = await connection.query(
      'SELECT tourID, ploegID, rennerID, Rugnummer, nietGestartEtappe, neemtDeel FROM tblPloegRenners WHERE tourID = ? AND ploegID = ? AND rennerID = ? FOR UPDATE',
      [tourID, ploegID, rennerID]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      await connection.rollback();
      response.status(404).json({ message: 'Team rider entry not found' });
      return;
    }

    const updated = {
      Rugnummer: payload.Rugnummer !== undefined ? payload.Rugnummer : current.Rugnummer,
      nietGestartEtappe: payload.nietGestartEtappe !== undefined ? payload.nietGestartEtappe : current.nietGestartEtappe,
      neemtDeel: payload.neemtDeel !== undefined ? (payload.neemtDeel ? 1 : 0) : current.neemtDeel
    };

    await connection.query(
      'UPDATE tblPloegRenners SET Rugnummer = ?, nietGestartEtappe = ?, neemtDeel = ? WHERE tourID = ? AND ploegID = ? AND rennerID = ?',
      [updated.Rugnummer, updated.nietGestartEtappe, updated.neemtDeel, tourID, ploegID, rennerID]
    );
    if (updated.neemtDeel !== current.neemtDeel || updated.nietGestartEtappe !== current.nietGestartEtappe) {
      const pools = await connection.query('SELECT poolID FROM tblPools WHERE tourID = ?', [tourID]) as Array<{ poolID: number }>;
      for (const item of pools) await recalculatePoolPoints(connection, item.poolID, tourID);
    }
    await connection.commit();
    response.json({ tourID, ploegID, rennerID, ...updated });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
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
