import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const optionsRouter = Router();

const createOptionSchema = z.object({
  poolID: z.number().int(),
  inleg: z.number().nullable().optional(),
  PloegRennerAantal: z.number().int().nullable().optional(),
  PloegReserveAantal: z.number().int().nullable().optional(),
  AantalEtapPlaatsen: z.number().int().nullable().optional(),
  AantalKlasGeel: z.number().int().nullable().optional(),
  AantalKlasGroen: z.number().int().nullable().optional(),
  AantalKlasBol: z.number().int().nullable().optional(),
  AantalKlasWit: z.number().int().nullable().optional(),
  AantalEindKlasGeel: z.number().int().nullable().optional(),
  AantalEindKlasGroen: z.number().int().nullable().optional(),
  AantalEindKlasBol: z.number().int().nullable().optional(),
  AantalEindKlasWit: z.number().int().nullable().optional(),
  PrijsNr1Percentage: z.number().nullable().optional(),
  PrijsNr2Percentage: z.number().nullable().optional(),
  PrijsNr3Percentage: z.number().nullable().optional(),
  PrijsNr4Percentage: z.number().nullable().optional(),
  PrijsNrLaatstBedrag: z.number().nullable().optional()
});

const updateOptionSchema = createOptionSchema.omit({ poolID: true }).partial();

optionsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query('SELECT * FROM tblOpties ORDER BY poolID');
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

optionsRouter.get('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const rows = await pool.query('SELECT * FROM tblOpties WHERE poolID = ?', [poolID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Options for pool not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

optionsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createOptionSchema.parse(request.body);
    await pool.query(
      `INSERT INTO tblOpties (
        poolID, inleg, PloegRennerAantal, PloegReserveAantal, AantalEtapPlaatsen,
        AantalKlasGeel, AantalKlasGroen, AantalKlasBol, AantalKlasWit,
        AantalEindKlasGeel, AantalEindKlasGroen, AantalEindKlasBol, AantalEindKlasWit,
        PrijsNr1Percentage, PrijsNr2Percentage, PrijsNr3Percentage, PrijsNr4Percentage, PrijsNrLaatstBedrag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.poolID,
        payload.inleg ?? 10.00,
        payload.PloegRennerAantal ?? 15,
        payload.PloegReserveAantal ?? 5,
        payload.AantalEtapPlaatsen ?? 7,
        payload.AantalKlasGeel ?? 3,
        payload.AantalKlasGroen ?? 3,
        payload.AantalKlasBol ?? 3,
        payload.AantalKlasWit ?? 1,
        payload.AantalEindKlasGeel ?? 3,
        payload.AantalEindKlasGroen ?? 1,
        payload.AantalEindKlasBol ?? 1,
        payload.AantalEindKlasWit ?? 1,
        payload.PrijsNr1Percentage ?? 1.00,
        payload.PrijsNr2Percentage ?? 0.35,
        payload.PrijsNr3Percentage ?? 0.15,
        payload.PrijsNr4Percentage ?? 0.00,
        payload.PrijsNrLaatstBedrag ?? 10.00
      ]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

optionsRouter.put('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const payload = updateOptionSchema.parse(request.body);

    const rows = await pool.query('SELECT * FROM tblOpties WHERE poolID = ?', [poolID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Options for pool not found' });
      return;
    }

    const updated = {
      inleg: payload.inleg !== undefined ? payload.inleg : current.inleg,
      PloegRennerAantal: payload.PloegRennerAantal !== undefined ? payload.PloegRennerAantal : current.PloegRennerAantal,
      PloegReserveAantal: payload.PloegReserveAantal !== undefined ? payload.PloegReserveAantal : current.PloegReserveAantal,
      AantalEtapPlaatsen: payload.AantalEtapPlaatsen !== undefined ? payload.AantalEtapPlaatsen : current.AantalEtapPlaatsen,
      AantalKlasGeel: payload.AantalKlasGeel !== undefined ? payload.AantalKlasGeel : current.AantalKlasGeel,
      AantalKlasGroen: payload.AantalKlasGroen !== undefined ? payload.AantalKlasGroen : current.AantalKlasGroen,
      AantalKlasBol: payload.AantalKlasBol !== undefined ? payload.AantalKlasBol : current.AantalKlasBol,
      AantalKlasWit: payload.AantalKlasWit !== undefined ? payload.AantalKlasWit : current.AantalKlasWit,
      AantalEindKlasGeel: payload.AantalEindKlasGeel !== undefined ? payload.AantalEindKlasGeel : current.AantalEindKlasGeel,
      AantalEindKlasGroen: payload.AantalEindKlasGroen !== undefined ? payload.AantalEindKlasGroen : current.AantalEindKlasGroen,
      AantalEindKlasBol: payload.AantalEindKlasBol !== undefined ? payload.AantalEindKlasBol : current.AantalEindKlasBol,
      AantalEindKlasWit: payload.AantalEindKlasWit !== undefined ? payload.AantalEindKlasWit : current.AantalEindKlasWit,
      PrijsNr1Percentage: payload.PrijsNr1Percentage !== undefined ? payload.PrijsNr1Percentage : current.PrijsNr1Percentage,
      PrijsNr2Percentage: payload.PrijsNr2Percentage !== undefined ? payload.PrijsNr2Percentage : current.PrijsNr2Percentage,
      PrijsNr3Percentage: payload.PrijsNr3Percentage !== undefined ? payload.PrijsNr3Percentage : current.PrijsNr3Percentage,
      PrijsNr4Percentage: payload.PrijsNr4Percentage !== undefined ? payload.PrijsNr4Percentage : current.PrijsNr4Percentage,
      PrijsNrLaatstBedrag: payload.PrijsNrLaatstBedrag !== undefined ? payload.PrijsNrLaatstBedrag : current.PrijsNrLaatstBedrag
    };

    await pool.query(
      `UPDATE tblOpties SET 
        inleg = ?, PloegRennerAantal = ?, PloegReserveAantal = ?, AantalEtapPlaatsen = ?,
        AantalKlasGeel = ?, AantalKlasGroen = ?, AantalKlasBol = ?, AantalKlasWit = ?,
        AantalEindKlasGeel = ?, AantalEindKlasGroen = ?, AantalEindKlasBol = ?, AantalEindKlasWit = ?,
        PrijsNr1Percentage = ?, PrijsNr2Percentage = ?, PrijsNr3Percentage = ?, PrijsNr4Percentage = ?, PrijsNrLaatstBedrag = ?
      WHERE poolID = ?`,
      [
        updated.inleg,
        updated.PloegRennerAantal,
        updated.PloegReserveAantal,
        updated.AantalEtapPlaatsen,
        updated.AantalKlasGeel,
        updated.AantalKlasGroen,
        updated.AantalKlasBol,
        updated.AantalKlasWit,
        updated.AantalEindKlasGeel,
        updated.AantalEindKlasGroen,
        updated.AantalEindKlasBol,
        updated.AantalEindKlasWit,
        updated.PrijsNr1Percentage,
        updated.PrijsNr2Percentage,
        updated.PrijsNr3Percentage,
        updated.PrijsNr4Percentage,
        updated.PrijsNrLaatstBedrag,
        poolID
      ]
    );

    response.json({ poolID, ...updated });
  } catch (error) {
    next(error);
  }
});

optionsRouter.delete('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    await pool.query('DELETE FROM tblOpties WHERE poolID = ?', [poolID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
