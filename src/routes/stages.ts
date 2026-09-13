import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const stagesRouter = Router();

const createStageSchema = z.object({
  tour: z.string().max(10),
  etappeNr: z.number().int(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  Start: z.string().max(100).nullable().optional(),
  Finish: z.string().max(100).nullable().optional(),
  kms: z.number().nullable().optional(),
  type: z.string().max(24).nullable().optional()
});

const updateStageSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  Start: z.string().max(100).nullable().optional(),
  Finish: z.string().max(100).nullable().optional(),
  kms: z.number().nullable().optional(),
  type: z.string().max(24).nullable().optional()
});

stagesRouter.get('/', async (request, response, next) => {
  try {
    const { tour } = request.query;
    let query = 'SELECT tour, etappeNr, datum, Start, Finish, kms, type FROM tblEtappes';
    const params: unknown[] = [];

    if (typeof tour === 'string' && tour.trim() !== '') {
      query += ' WHERE tour = ?';
      params.push(tour.trim());
    }

    query += ' ORDER BY tour, etappeNr';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

stagesRouter.get('/:tour/:etappeNr', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const etappeNr = Number(request.params.etappeNr);

    const rows = await pool.query(
      'SELECT tour, etappeNr, datum, Start, Finish, kms, type FROM tblEtappes WHERE tour = ? AND etappeNr = ?',
      [tour, etappeNr]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Stage not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

stagesRouter.post('/', async (request, response, next) => {
  try {
    const payload = createStageSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblEtappes (tour, etappeNr, datum, Start, Finish, kms, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [payload.tour, payload.etappeNr, payload.datum ?? null, payload.Start ?? null, payload.Finish ?? null, payload.kms ?? null, payload.type ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

stagesRouter.put('/:tour/:etappeNr', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const etappeNr = Number(request.params.etappeNr);
    const payload = updateStageSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT tour, etappeNr, datum, Start, Finish, kms, type FROM tblEtappes WHERE tour = ? AND etappeNr = ?',
      [tour, etappeNr]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Stage not found' });
      return;
    }

    const updated = {
      datum: payload.datum !== undefined ? payload.datum : current.datum,
      Start: payload.Start !== undefined ? payload.Start : current.Start,
      Finish: payload.Finish !== undefined ? payload.Finish : current.Finish,
      kms: payload.kms !== undefined ? payload.kms : current.kms,
      type: payload.type !== undefined ? payload.type : current.type
    };

    await pool.query(
      'UPDATE tblEtappes SET datum = ?, Start = ?, Finish = ?, kms = ?, type = ? WHERE tour = ? AND etappeNr = ?',
      [updated.datum, updated.Start, updated.Finish, updated.kms, updated.type, tour, etappeNr]
    );

    response.json({ tour, etappeNr, ...updated });
  } catch (error) {
    next(error);
  }
});

stagesRouter.delete('/:tour/:etappeNr', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const etappeNr = Number(request.params.etappeNr);

    await pool.query('DELETE FROM tblEtappes WHERE tour = ? AND etappeNr = ?', [tour, etappeNr]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
