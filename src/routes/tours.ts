import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const toursRouter = Router();

const createTourSchema = z.object({
  tourID: z.number().int(),
  naam: z.string().max(255).nullable().optional(),
  StartDatum: z.string().datetime().nullable().optional(),
  EindDatum: z.string().datetime().nullable().optional()
});

const updateTourSchema = createTourSchema.omit({ tourID: true }).partial();

toursRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT tourID, naam, StartDatum, EindDatum FROM tblTours ORDER BY tourID');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

toursRouter.get('/:tourID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const rows = await pool.query('SELECT tourID, naam, StartDatum, EindDatum FROM tblTours WHERE tourID = ?', [tourID]);
    const tour = (rows as Array<Record<string, unknown>>)[0];

    if (!tour) {
      response.status(404).json({ message: 'Tour not found' });
      return;
    }

    response.json(tour);
  } catch (error) {
    next(error);
  }
});

toursRouter.post('/', async (request, response, next) => {
  try {
    const payload = createTourSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblTours (tourID, naam, StartDatum, EindDatum) VALUES (?, ?, ?, ?)',
      [payload.tourID, payload.naam ?? null, payload.StartDatum ?? null, payload.EindDatum ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

toursRouter.put('/:tourID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const payload = updateTourSchema.parse(request.body);

    const rows = await pool.query('SELECT tourID, naam, StartDatum, EindDatum FROM tblTours WHERE tourID = ?', [tourID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Tour not found' });
      return;
    }

    const updatedTour = {
      naam: payload.naam !== undefined ? payload.naam : current.naam,
      StartDatum: payload.StartDatum !== undefined ? payload.StartDatum : current.StartDatum,
      EindDatum: payload.EindDatum !== undefined ? payload.EindDatum : current.EindDatum
    };

    await pool.query(
      'UPDATE tblTours SET naam = ?, StartDatum = ?, EindDatum = ? WHERE tourID = ?',
      [updatedTour.naam, updatedTour.StartDatum, updatedTour.EindDatum, tourID]
    );

    response.json({ tourID, ...updatedTour });
  } catch (error) {
    next(error);
  }
});

toursRouter.delete('/:tourID', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    await pool.query('DELETE FROM tblTours WHERE tourID = ?', [tourID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});