import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../auth.js';

export const stagesRouter = Router();

const stageSelect = "SELECT tour, etappeNr, DATE_FORMAT(datum, '%Y-%m-%d') AS datum, Start, Finish, kms, type FROM tblEtappes";

const createStageSchema = z.object({
  tour: z.string().max(10),
  etappeNr: z.number().int().nullable().optional(),
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
    let query = stageSelect;
    const params: unknown[] = [];

    if (typeof tour === 'string' && tour.trim() !== '') {
      query += ' WHERE tour = ?';
      params.push(tour.trim());
    }

    query += ' ORDER BY tour, datum, etappeNr';

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
      `${stageSelect} WHERE tour = ? AND etappeNr = ?`,
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
      [payload.tour, payload.etappeNr ?? null, payload.datum ?? null, payload.Start ?? null, payload.Finish ?? null, payload.kms ?? null, payload.type ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

stagesRouter.put('/rest-day/:tour/:datum', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(request.params.datum);
    const payload = updateStageSchema.parse(request.body);
    const rows = await pool.query(
      `${stageSelect} WHERE tour = ? AND datum = ? AND etappeNr IS NULL`,
      [tour, datum]
    ) as Array<Record<string, unknown>>;

    if (rows.length === 0) {
      response.status(404).json({ message: 'Rest day not found' });
      return;
    }
    if (rows.length > 1) {
      response.status(409).json({ message: 'Multiple rest days found for this date' });
      return;
    }

    const current = rows[0];
    const updated = {
      datum: payload.datum !== undefined ? payload.datum : current.datum,
      Start: payload.Start !== undefined ? payload.Start : current.Start,
      Finish: payload.Finish !== undefined ? payload.Finish : current.Finish,
      kms: payload.kms !== undefined ? payload.kms : current.kms,
      type: payload.type !== undefined ? payload.type : current.type
    };

    await pool.query(
      'UPDATE tblEtappes SET datum = ?, Start = ?, Finish = ?, kms = ?, type = ? WHERE tour = ? AND datum = ? AND etappeNr IS NULL',
      [updated.datum, updated.Start, updated.Finish, updated.kms, updated.type, tour, datum]
    );

    response.json({ tour, etappeNr: null, ...updated });
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
      `${stageSelect} WHERE tour = ? AND etappeNr = ?`,
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

stagesRouter.delete('/rest-day/:tour/:datum', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const datum = z.string().date().parse(request.params.datum);
    const result = await pool.query(
      'DELETE FROM tblEtappes WHERE tour = ? AND datum = ? AND etappeNr IS NULL',
      [tour, datum]
    );
    if (!result.affectedRows) throw new HttpError(404, 'Rustdag niet gevonden.');
    response.status(204).send();
  } catch (error) { next(error); }
});

stagesRouter.delete('/:tour/:etappeNr', async (request, response, next) => {
  try {
    const tour = String(request.params.tour);
    const etappeNr = Number(request.params.etappeNr);

    const result = await pool.query(
      `DELETE FROM tblEtappes WHERE tour = ? AND etappeNr = ?
       AND NOT EXISTS (SELECT 1 FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ?)
       AND NOT EXISTS (SELECT 1 FROM tblDeelnemerPunten dp
         JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID JOIN tblPools p ON p.poolID = d.poolID
         WHERE p.tourID = ? AND dp.etappeNr = ?)`,
      [tour, etappeNr, tour, etappeNr, tour, etappeNr]
    );
    if (!result.affectedRows) {
      const rows = await pool.query('SELECT etappeNr FROM tblEtappes WHERE tour = ? AND etappeNr = ?', [tour, etappeNr]);
      if (!rows.length) throw new HttpError(404, 'Etappe niet gevonden.');
      throw new HttpError(409, 'Deze etappe heeft uitslagen of punten en kan niet worden verwijderd.');
    }
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
