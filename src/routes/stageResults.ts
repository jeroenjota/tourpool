import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const stageResultsRouter = Router();

type DatabaseConnection = Awaited<ReturnType<typeof pool.getConnection>>;

const calculateParticipantPoints = async (connection: DatabaseConnection, tourID: number, etappeNr: number) => {
  const poolRows = await connection.query(`
    SELECT p.poolID, o.PloegRennerAantal, o.PloegReserveAantal, o.AantalEtapPlaatsen,
      o.AantalKlasGeel, o.AantalKlasGroen, o.AantalKlasBol, o.AantalKlasWit
    FROM tblPools p
    LEFT JOIN tblOpties o ON o.poolID = p.poolID
    WHERE p.tourID = ?
  `) as Array<Record<string, number | null>>;
  const resultRows = await connection.query(
    'SELECT uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ?',
    [tourID, etappeNr]
  ) as Array<{ uitslagType: string; plaats: number; rennerID: number }>;

  for (const poolRow of poolRows) {
    const poolID = Number(poolRow.poolID);
    const activeRiderCount = Math.max(
      Number(poolRow.PloegRennerAantal ?? 0) - Number(poolRow.PloegReserveAantal ?? 0),
      0
    );
    const categoryLimits = {
      rit: Number(poolRow.AantalEtapPlaatsen ?? 0),
      geel: Number(poolRow.AantalKlasGeel ?? 0),
      groen: Number(poolRow.AantalKlasGroen ?? 0),
      bol: Number(poolRow.AantalKlasBol ?? 0),
      wit: Number(poolRow.AantalKlasWit ?? 0)
    };
    const pointRows = await connection.query(`
      SELECT sp.Omschrijving, COALESCE(pa.Punten, sp.punten, 0) AS Punten
      FROM tblStandaardPunten sp
      LEFT JOIN tblPuntenToekenning pa
        ON pa.prestatieID = sp.prestatieID AND pa.poolID = ?
      WHERE sp.Omschrijving LIKE 'etap%'
    `, [poolID]) as Array<{ Omschrijving: string; Punten: number | null }>;
    const points = new Map(pointRows.map(row => [row.Omschrijving, Number(row.Punten ?? 0)]));
    const participants = await connection.query(
      'SELECT deelnID FROM tblDeelnemers WHERE poolID = ?',
      [poolID]
    ) as Array<{ deelnID: number }>;
    const participantRiders = await connection.query(`
      SELECT dr.deelnID, dr.rennerID
      FROM tblDeelnemRenners dr
      INNER JOIN tblDeelnemers d ON d.deelnID = dr.deelnID
      WHERE d.poolID = ? AND dr.positie <= ?
    `, [poolID, activeRiderCount]) as Array<{ deelnID: number; rennerID: number }>;
    const ridersByParticipant = new Map<number, Set<number>>();

    for (const rider of participantRiders) {
      const riderSet = ridersByParticipant.get(rider.deelnID) ?? new Set<number>();
      riderSet.add(rider.rennerID);
      ridersByParticipant.set(rider.deelnID, riderSet);
    }

    await connection.query(
      `DELETE dp FROM tblDeelnemerPunten dp
       INNER JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID
       WHERE d.poolID = ? AND dp.etappeNr = ?`,
      [poolID, etappeNr]
    );

    for (const participant of participants) {
      const riderSet = ridersByParticipant.get(participant.deelnID) ?? new Set<number>();
      const categoryPoints = { rit: 0, geel: 0, groen: 0, bol: 0, wit: 0 };
      const pointNamePrefixes = {
        rit: 'etapPl',
        geel: 'etapGeel',
        groen: 'etapGroenPl',
        bol: 'etapBolPl',
        wit: 'etapWitPl'
      };

      for (const category of Object.keys(categoryLimits) as Array<keyof typeof categoryLimits>) {
        for (const result of resultRows) {
          if (result.uitslagType.toLowerCase() !== category || result.plaats > categoryLimits[category]) continue;
          if (riderSet.has(result.rennerID)) {
            categoryPoints[category] += points.get(`${pointNamePrefixes[category]}${result.plaats}`) ?? 0;
          }
        }
      }

      const etapPnt = Object.values(categoryPoints).reduce((total, value) => total + value, 0);
      await connection.query(
        `INSERT INTO tblDeelnemerPunten
          (deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [participant.deelnID, etappeNr, categoryPoints.rit, categoryPoints.geel, categoryPoints.groen, categoryPoints.bol, categoryPoints.wit, etapPnt]
      );
    }
  }
};

const createStageResultSchema = z.object({
  tourID: z.number().int(),
  etappeNr: z.number().int(),
  uitslagType: z.string().max(10),
  plaats: z.number().int(),
  rennerID: z.number().int()
});

const updateStageResultSchema = z.object({
  rennerID: z.number().int()
});

const bulkSaveSchema = z.object({
  tourID: z.number().int(),
  etappeNr: z.number().int(),
  results: z.array(z.object({
    uitslagType: z.string().max(10),
    plaats: z.number().int(),
    rennerID: z.number().int()
  }))
});

stageResultsRouter.get('/', async (request, response, next) => {
  try {
    const { tourID, etappeNr, uitslagType, rennerID } = request.query;
    let query = `
      SELECT 
        eu.tourID, 
        eu.etappeNr, 
        eu.uitslagType, 
        eu.plaats, 
        eu.rennerID,
        r.anaam,
        r.vnaam,
        r.tnaam,
        r.landID AS rennerLand,
        pr.Rugnummer,
        p.naam AS ploegNaam,
        p.ploegCode
      FROM tblEtappeUitslag eu
      JOIN tblRenners r ON eu.rennerID = r.rennerID
      LEFT JOIN tblPloegRenners pr ON (eu.rennerID = pr.rennerID AND eu.tourID = pr.tourID)
      LEFT JOIN tblPloegen p ON pr.ploegID = p.ploegID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (tourID !== undefined && tourID !== '') {
      conditions.push('eu.tourID = ?');
      params.push(Number(tourID));
    }

    if (etappeNr !== undefined && etappeNr !== '') {
      conditions.push('eu.etappeNr = ?');
      params.push(Number(etappeNr));
    }

    if (typeof uitslagType === 'string' && uitslagType.trim() !== '') {
      conditions.push('eu.uitslagType = ?');
      params.push(uitslagType.trim());
    }

    if (rennerID !== undefined && rennerID !== '') {
      conditions.push('eu.rennerID = ?');
      params.push(Number(rennerID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY eu.tourID, eu.etappeNr, eu.uitslagType, eu.plaats';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.put('/batch', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const payload = bulkSaveSchema.parse(request.body);
    await connection.beginTransaction();

    // Verwijder alle bestaande uitslagen van deze etappe voor deze tour
    await connection.query(
      'DELETE FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ?',
      [payload.tourID, payload.etappeNr]
    );

    // Voeg alle nieuwe uitslagen in
    for (const item of payload.results) {
      if (item.rennerID) {
        await connection.query(
          'INSERT INTO tblEtappeUitslag (tourID, etappeNr, uitslagType, plaats, rennerID) VALUES (?, ?, ?, ?, ?)',
          [payload.tourID, payload.etappeNr, item.uitslagType, item.plaats, item.rennerID]
        );
      }
    }

    await calculateParticipantPoints(connection, payload.tourID, payload.etappeNr);
    await connection.commit();

    response.json({
      tourID: payload.tourID,
      etappeNr: payload.etappeNr,
      count: payload.results.length
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

stageResultsRouter.get('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);

    const rows = await pool.query(
      'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Stage result not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createStageResultSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblEtappeUitslag (tourID, etappeNr, uitslagType, plaats, rennerID) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.etappeNr, payload.uitslagType, payload.plaats, payload.rennerID]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.put('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);
    const payload = updateStageResultSchema.parse(request.body);

    const rows = await pool.query(
      'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Stage result not found' });
      return;
    }

    await pool.query(
      'UPDATE tblEtappeUitslag SET rennerID = ? WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [payload.rennerID, tourID, etappeNr, uitslagType, plaats]
    );

    response.json({ tourID, etappeNr, uitslagType, plaats, rennerID: payload.rennerID });
  } catch (error) {
    next(error);
  }
});

stageResultsRouter.delete('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);

    await pool.query(
      'DELETE FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
