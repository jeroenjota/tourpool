import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { enrollmentDateSchema } from '../enrollment.js';
import { HttpError } from '../auth.js';

export const poolsRouter = Router();

const createPoolSchema = z.object({
  tourID: z.number().int(),
  Naam: z.string().max(255).nullable().optional(),
  Org: z.string().max(255).nullable().optional(),
  StartInschr: enrollmentDateSchema.nullable().optional(),
  EindInschr: enrollmentDateSchema.nullable().optional()
});

const updatePoolSchema = createPoolSchema.partial();

const toMariaDbDateTime = (value: string | null | undefined) =>
  value ? `${value} 00:00:00` : null;

const validatePeriod = (start: string | null | undefined, end: string | null | undefined) => {
  if (start && end && start > end) {
    throw new HttpError(400, 'De einddatum van de inschrijving mag niet voor de begindatum liggen.');
  }
};

poolsRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query(`
      SELECT
        p.poolID,
        p.tourID,
        p.Naam,
        p.Org,
        DATE_FORMAT(p.StartInschr, '%Y-%m-%d') AS StartInschr,
        DATE_FORMAT(p.EindInschr, '%Y-%m-%d') AS EindInschr,
        t.naam AS tourNaam,
        t.StartDatum AS tourStartDatum
      FROM tblPools p
      LEFT JOIN tblTours t ON t.tourID = p.tourID
      ORDER BY COALESCE(t.StartDatum, '9999-12-31') ASC, p.poolID DESC
    `);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

poolsRouter.get('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const rows = await pool.query(`SELECT poolID, tourID, Naam, Org,
      DATE_FORMAT(StartInschr, '%Y-%m-%d') AS StartInschr,
      DATE_FORMAT(EindInschr, '%Y-%m-%d') AS EindInschr
      FROM tblPools WHERE poolID = ?`, [poolID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Pool not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

poolsRouter.post('/', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const payload = createPoolSchema.parse(request.body);
    validatePeriod(payload.StartInschr, payload.EindInschr);
    await connection.beginTransaction();
    // Get the last options for the most recently created pool
    const optionRows = await connection.query(`
      SELECT
        o.inleg,
        o.PloegRennerAantal,
        o.PloegReserveAantal,
        o.AantalEtapPlaatsen,
        o.AantalKlasGeel,
        o.AantalKlasGroen,
        o.AantalKlasBol,
        o.AantalKlasWit,
        o.AantalEindKlasGeel,
        o.AantalEindKlasGroen,
        o.AantalEindKlasBol,
        o.AantalEindKlasWit,
        o.geldEtappeHoog,
        o.geldEtappeTotaal,
        o.geldEtappeLaagTTL,
        o.PrijsNr1Percentage,
        o.PrijsNr2Percentage,
        o.PrijsNr3Percentage,
        o.PrijsNr4Percentage,
        o.PrijsNrLaatstBedrag
      FROM tblOpties o
      INNER JOIN tblPools p ON p.poolID = o.poolID
      ORDER BY p.poolID DESC
      LIMIT 1
    `) as Array<Record<string, number | null>>;
    const lastOptions = optionRows[0];
    // Add new pool
    const result = await connection.query(
      'INSERT INTO tblPools (tourID, Naam, Org, StartInschr, EindInschr) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.Naam ?? null, payload.Org ?? null, toMariaDbDateTime(payload.StartInschr), toMariaDbDateTime(payload.EindInschr)]
    );
    const poolID = Number((result as { insertId: number | bigint }).insertId);
    await connection.query(
      `INSERT INTO tblPuntenToekenning
        (prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde)
       SELECT prestatieID, ?, Omschrijving, punten, uitslagtype, plaats, volgorde
       FROM tblStandaardPunten`,
      [poolID]
    );
    // Add new options for the newly created pool
    await connection.query(
      `INSERT INTO tblOpties (
        poolID, inleg, PloegRennerAantal, PloegReserveAantal, AantalEtapPlaatsen,
        AantalKlasGeel, AantalKlasGroen, AantalKlasBol, AantalKlasWit,
        AantalEindKlasGeel, AantalEindKlasGroen, AantalEindKlasBol, AantalEindKlasWit,
        geldEtappeHoog, geldEtappeTotaal, geldEtappeLaagTTL,
        PrijsNr1Percentage, PrijsNr2Percentage, PrijsNr3Percentage, PrijsNr4Percentage, PrijsNrLaatstBedrag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        poolID,
        lastOptions?.inleg ?? 0,
        lastOptions?.PloegRennerAantal ?? 0,
        lastOptions?.PloegReserveAantal ?? 0,
        lastOptions?.AantalEtapPlaatsen ?? 0,
        lastOptions?.AantalKlasGeel ?? 0,
        lastOptions?.AantalKlasGroen ?? 0,
        lastOptions?.AantalKlasBol ?? 0,
        lastOptions?.AantalKlasWit ?? 0,
        lastOptions?.AantalEindKlasGeel ?? 0,
        lastOptions?.AantalEindKlasGroen ?? 0,
        lastOptions?.AantalEindKlasBol ?? 0,
        lastOptions?.AantalEindKlasWit ?? 0,
        lastOptions?.geldEtappeHoog ?? 0,
        lastOptions?.geldEtappeTotaal ?? 0,
        lastOptions?.geldEtappeLaagTTL ?? 0,
        lastOptions?.PrijsNr1Percentage ?? 0,
        lastOptions?.PrijsNr2Percentage ?? 0,
        lastOptions?.PrijsNr3Percentage ?? 0,
        lastOptions?.PrijsNr4Percentage ?? 0,
        lastOptions?.PrijsNrLaatstBedrag ?? 0
      ]
    );

    await connection.commit();

    response.status(201).json({
      ...payload,
      poolID
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

poolsRouter.put('/:poolID', async (request, response, next) => {
  try {
    const poolID = Number(request.params.poolID);
    const payload = updatePoolSchema.parse(request.body);

    const rows = await pool.query(`SELECT poolID, tourID, Naam, Org,
      DATE_FORMAT(StartInschr, '%Y-%m-%d') AS StartInschr,
      DATE_FORMAT(EindInschr, '%Y-%m-%d') AS EindInschr
      FROM tblPools WHERE poolID = ?`, [poolID]) as Array<{
        poolID: number; tourID: number; Naam: string | null; Org: string | null;
        StartInschr: string | null; EindInschr: string | null;
      }>;
    const current = rows[0];

    if (!current) {
      response.status(404).json({ message: 'Pool not found' });
      return;
    }

    const updatedPool = {
      tourID: payload.tourID !== undefined ? payload.tourID : current.tourID,
      Naam: payload.Naam !== undefined ? payload.Naam : current.Naam,
      Org: payload.Org !== undefined ? payload.Org : current.Org,
      StartInschr: payload.StartInschr !== undefined ? payload.StartInschr : current.StartInschr,
      EindInschr: payload.EindInschr !== undefined ? payload.EindInschr : current.EindInschr
    };
    validatePeriod(updatedPool.StartInschr, updatedPool.EindInschr);

    await pool.query(
      'UPDATE tblPools SET tourID = ?, Naam = ?, Org = ?, StartInschr = ?, EindInschr = ? WHERE poolID = ?',
      [updatedPool.tourID, updatedPool.Naam, updatedPool.Org, toMariaDbDateTime(updatedPool.StartInschr), toMariaDbDateTime(updatedPool.EindInschr), poolID]
    );

    response.json({ poolID, ...updatedPool });
  } catch (error) {
    next(error);
  }
});

poolsRouter.delete('/:poolID', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const poolID = Number(request.params.poolID);
    await connection.beginTransaction();
    await connection.query('DELETE FROM tblPuntenToekenning WHERE poolID = ?', [poolID]);
    await connection.query('DELETE FROM tblOpties WHERE poolID = ?', [poolID]);
    await connection.query(
      'DELETE dp FROM tblDeelnemerPunten dp INNER JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID WHERE d.poolID = ?',
      [poolID]
    );
    await connection.query('DELETE FROM tblDeelnemers WHERE poolID = ?', [poolID]);
    await connection.query('DELETE FROM tblPools WHERE poolID = ?', [poolID]);
    await connection.commit();
    response.status(204).send();
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});