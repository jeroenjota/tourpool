import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const teamsRouter = Router();

const createTeamSchema = z.object({
  naam: z.string().max(255).nullable().optional(),
  landID: z.string().max(10).nullable().optional(),
  ploegCode: z.string().max(10).nullable().optional()
});

const updateTeamSchema = createTeamSchema.partial();

teamsRouter.get('/', async (request, response, next) => {
  try {
    const { landID, search } = request.query;
    let query = 'SELECT ploegID, naam, landID, ploegCode FROM tblPloegen';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (typeof landID === 'string' && landID.trim() !== '') {
      conditions.push('landID = ?');
      params.push(landID.trim());
    }

    if (typeof search === 'string' && search.trim() !== '') {
      conditions.push('(naam LIKE ? OR ploegCode LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY naam';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

teamsRouter.get('/:ploegID', async (request, response, next) => {
  try {
    const ploegID = Number(request.params.ploegID);
    const rows = await pool.query('SELECT ploegID, naam, landID, ploegCode FROM tblPloegen WHERE ploegID = ?', [ploegID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Team not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

teamsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createTeamSchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblPloegen (naam, landID, ploegCode) VALUES (?, ?, ?)',
      [payload.naam ?? null, payload.landID ?? null, payload.ploegCode ?? null]
    );

    response.status(201).json({
      ...payload,
      ploegID: Number((result as { insertId: number | bigint }).insertId)
    });
  } catch (error) {
    next(error);
  }
});

teamsRouter.put('/:ploegID', async (request, response, next) => {
  try {
    const ploegID = Number(request.params.ploegID);
    const payload = updateTeamSchema.parse(request.body);

    const rows = await pool.query('SELECT ploegID, naam, landID, ploegCode FROM tblPloegen WHERE ploegID = ?', [ploegID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Team not found' });
      return;
    }

    const updatedTeam = {
      naam: payload.naam !== undefined ? payload.naam : current.naam,
      landID: payload.landID !== undefined ? payload.landID : current.landID,
      ploegCode: payload.ploegCode !== undefined ? payload.ploegCode : current.ploegCode
    };

    await pool.query(
      'UPDATE tblPloegen SET naam = ?, landID = ?, ploegCode = ? WHERE ploegID = ?',
      [updatedTeam.naam, updatedTeam.landID, updatedTeam.ploegCode, ploegID]
    );

    response.json({ ploegID, ...updatedTeam });
  } catch (error) {
    next(error);
  }
});

teamsRouter.delete('/:ploegID', async (request, response, next) => {
  try {
    const ploegID = Number(request.params.ploegID);
    await pool.query('DELETE FROM tblPloegen WHERE ploegID = ?', [ploegID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
