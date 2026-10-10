import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const stageResultsRouter = Router();

type DatabaseConnection = Awaited<ReturnType<typeof pool.getConnection>>;

type ParticipantStagePoints = {
  deelnemID: number;
  etappeNr: number;
  etapPnt: number;
  ttlPnt: number;
};

const splitPrize = (amount: number | string | null, winners: number[]) => {
  const shares = new Map<number, number>();
  if (winners.length === 0) return shares;

  const share = Math.max(Number(amount ?? 0), 0) / winners.length;
  winners.forEach(deelnemID => {
    shares.set(deelnemID, share);
  });
  return shares;
};

const rankByScore = (participants: Array<{ deelnemID: number; score: number }>) => {
  const sorted = [...participants].sort((a, b) => b.score - a.score || a.deelnemID - b.deelnemID);
  const ranks = new Map<number, number>();
  let previousScore: number | undefined;
  let previousRank = 0;

  sorted.forEach((participant, index) => {
    if (participant.score !== previousScore) {
      previousRank = index + 1;
      previousScore = participant.score;
    }
    ranks.set(participant.deelnemID, previousRank);
  });
  return ranks;
};

const recalculateParticipantTotals = async (connection: DatabaseConnection, tourID: number, poolID?: number) => {
  const rows = await connection.query(`
    SELECT dp.deelnemID, dp.etappeNr, dp.etapPnt
    FROM tblDeelnemerPunten dp
    INNER JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID
    INNER JOIN tblPools p ON p.poolID = d.poolID
    WHERE p.tourID = ?
    ${poolID === undefined ? '' : 'AND p.poolID = ?'}
    ORDER BY p.poolID, dp.deelnemID, dp.etappeNr
  `, poolID === undefined ? [tourID] : [tourID, poolID]) as Array<Omit<ParticipantStagePoints, 'ttlPnt'>>;
  const totalsByParticipant = new Map<number, number>();

  for (const row of rows) {
    const totalPoints = (totalsByParticipant.get(row.deelnemID) ?? 0) + Number(row.etapPnt ?? 0);
    totalsByParticipant.set(row.deelnemID, totalPoints);
    await connection.query(
      'UPDATE tblDeelnemerPunten SET ttlPnt = ? WHERE deelnemID = ? AND etappeNr = ?',
      [totalPoints, row.deelnemID, row.etappeNr]
    );
  }
};

const recalculateStagePrizes = async (connection: DatabaseConnection, tourID: number, poolID?: number) => {
  const poolRows = await connection.query(`
    SELECT p.poolID, o.geldEtappeHoog, o.geldEtappeTotaal, o.geldEtappeLaagTTL
    FROM tblPools p
    LEFT JOIN tblOpties o ON o.poolID = p.poolID
    WHERE p.tourID = ?
    ${poolID === undefined ? '' : 'AND p.poolID = ?'}
  `, poolID === undefined ? [tourID] : [tourID, poolID]) as Array<{
    poolID: number;
    geldEtappeHoog: number | string | null;
    geldEtappeTotaal: number | string | null;
    geldEtappeLaagTTL: number | string | null;
  }>;

  for (const poolRow of poolRows) {
    const rows = await connection.query(`
      SELECT dp.deelnemID, dp.etappeNr, dp.etapPnt, dp.ttlPnt
      FROM tblDeelnemerPunten dp
      INNER JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID
      WHERE d.poolID = ?
      ORDER BY dp.etappeNr
    `, [poolRow.poolID]) as ParticipantStagePoints[];
    const stages = new Map<number, ParticipantStagePoints[]>();
    for (const row of rows) {
      const stageRows = stages.get(row.etappeNr) ?? [];
      stageRows.push({ ...row, etapPnt: Number(row.etapPnt ?? 0) });
      stages.set(row.etappeNr, stageRows);
    }

    const cumulativeMoney = new Map<number, number>();
    for (const [etappeNr, stageRows] of stages) {
      const dailyScores = stageRows.map(row => ({ deelnemID: row.deelnemID, score: row.etapPnt }));
      const totalScores = stageRows.map(row => ({
        deelnemID: row.deelnemID,
        score: Number(row.ttlPnt ?? 0)
      }));
      const highestDailyScore = Math.max(...dailyScores.map(row => row.score));
      const highestTotalScore = Math.max(...totalScores.map(row => row.score));
      const lowestTotalScore = Math.min(...totalScores.map(row => row.score));
      const dailyWinners = highestDailyScore > 0
        ? dailyScores.filter(row => row.score === highestDailyScore).map(row => row.deelnemID)
        : [];
      const highestTotalWinners = highestTotalScore > 0
        ? totalScores.filter(row => row.score === highestTotalScore).map(row => row.deelnemID)
        : [];
      const lowestTotalWinners = highestTotalScore > 0
        ? totalScores.filter(row => row.score === lowestTotalScore).map(row => row.deelnemID)
        : [];
      const prizeShares = [
        splitPrize(poolRow.geldEtappeHoog, dailyWinners),
        splitPrize(poolRow.geldEtappeTotaal, highestTotalWinners),
        splitPrize(poolRow.geldEtappeLaagTTL, lowestTotalWinners)
      ];
      const dailyRanks = rankByScore(dailyScores);
      const totalRanks = rankByScore(totalScores);

      for (const row of stageRows) {
        const stageMoney = prizeShares.reduce(
          (total, shares) => total + (shares.get(row.deelnemID) ?? 0),
          0
        );
        const totalMoney = (cumulativeMoney.get(row.deelnemID) ?? 0) + stageMoney;
        cumulativeMoney.set(row.deelnemID, totalMoney);
        await connection.query(`
          UPDATE tblDeelnemerPunten
          SET etapPlaats = ?, etapGeld = ?, ttlPnt = ?, ttlPlaats = ?, ttlGeld = ?
          WHERE deelnemID = ? AND etappeNr = ?
        `, [
          dailyRanks.get(row.deelnemID) ?? 0,
          stageMoney,
          Number(row.ttlPnt ?? 0),
          totalRanks.get(row.deelnemID) ?? 0,
          totalMoney,
          row.deelnemID,
          etappeNr
        ]);
      }
    }
  }
};

const calculateParticipantPoints = async (
  connection: DatabaseConnection, tourID: number, etappeNr: number,
  poolID?: number, recalculateTotals = true
) => {
  const poolRows = await connection.query(`
    SELECT p.poolID, o.PloegRennerAantal, o.PloegReserveAantal, o.AantalEtapPlaatsen,
      o.AantalKlasGeel, o.AantalKlasGroen, o.AantalKlasBol, o.AantalKlasWit,
      o.geldEtappeHoog, o.geldEtappeTotaal, o.geldEtappeLaagTTL
    FROM tblPools p
    LEFT JOIN tblOpties o ON o.poolID = p.poolID
    WHERE p.tourID = ?
    ${poolID === undefined ? '' : 'AND p.poolID = ?'}
  `, poolID === undefined ? [tourID] : [tourID, poolID]) as Array<Record<string, number | string | null>>;
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
      SELECT
        COALESCE(pa.uitslagtype, sp.uitslagtype) AS uitslagtype,
        COALESCE(pa.plaats, sp.plaats) AS plaats,
        COALESCE(pa.Punten, 0) AS Punten
      FROM tblStandaardPunten sp
      INNER JOIN tblPuntenToekenning pa
        ON pa.prestatieID = sp.prestatieID AND pa.poolID = ?
      WHERE COALESCE(pa.uitslagtype, sp.uitslagtype)
        IN ('rit', 'klasGeel', 'klasGroen', 'klasBol', 'klasWit')
    `, [poolID]) as Array<{ uitslagtype: string; plaats: number; Punten: number | null }>;
    const points = new Map(pointRows.map(row => [
      `${row.uitslagtype.toLowerCase()}:${row.plaats}`,
      Number(row.Punten ?? 0)
    ]));
    const participants = await connection.query(
      // Alleen betaalde ploegen doen mee in de punten en standen.
      'SELECT deelnID FROM tblDeelnemers WHERE poolID = ? AND Betaald = 1',
      [poolID]
    ) as Array<{ deelnID: number }>;
    const participantRiders = await connection.query(`
      SELECT dr.deelnID, dr.rennerID
      FROM tblDeelnemRenners dr
      INNER JOIN tblDeelnemers d ON d.deelnID = dr.deelnID
      INNER JOIN tblPools p ON p.poolID = d.poolID
      INNER JOIN tblPloegRenners tr
        ON tr.tourID = p.tourID AND tr.rennerID = dr.rennerID
      WHERE d.poolID = ?
        AND (tr.nietGestartEtappe IS NULL OR tr.nietGestartEtappe > ?)
      ORDER BY dr.deelnID, dr.positie, dr.rennerID
    `, [poolID, etappeNr]) as Array<{ deelnID: number; rennerID: number }>;
    const ridersByParticipant = new Map<number, Set<number>>();

    // Uitgevallen renners zijn al weggefilterd; reserves schuiven zo door naar de basisplaatsen.
    for (const rider of participantRiders) {
      const riderSet = ridersByParticipant.get(rider.deelnID) ?? new Set<number>();
      if (riderSet.size < activeRiderCount) {
        riderSet.add(rider.rennerID);
      }
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
      const pointCategories = {
        rit: 'rit',
        geel: 'klasgeel',
        groen: 'klasgroen',
        bol: 'klasbol',
        wit: 'klaswit'
      };
      for (const category of Object.keys(categoryLimits) as Array<keyof typeof categoryLimits>) {
        for (const result of resultRows) {
          if (result.uitslagType.toLowerCase() !== category || result.plaats > categoryLimits[category]) continue;
          if (riderSet.has(result.rennerID)) {
            categoryPoints[category] += points.get(`${pointCategories[category]}:${result.plaats}`) ?? 0;
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

  if (recalculateTotals) {
    await recalculateParticipantTotals(connection, tourID, poolID);
    await recalculateStagePrizes(connection, tourID, poolID);
  }
};

export const recalculatePoolPoints = async (connection: DatabaseConnection, poolID: number, tourID: number) => {
  const stages = await connection.query(`
    SELECT etappeNr FROM tblEtappeUitslag WHERE tourID = ?
    UNION
    SELECT dp.etappeNr FROM tblDeelnemerPunten dp
    INNER JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID
    WHERE d.poolID = ?
    ORDER BY etappeNr
  `, [tourID, poolID]) as Array<{ etappeNr: number }>;
  for (const stage of stages) {
    await calculateParticipantPoints(connection, tourID, stage.etappeNr, poolID, false);
  }
  await recalculateParticipantTotals(connection, tourID, poolID);
  await recalculateStagePrizes(connection, tourID, poolID);
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
  nietGestartRenners: z.array(z.number().int()).optional(),
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

    const nonStarterRiderIDs = [...new Set(payload.nietGestartRenners ?? [])];
    if (nonStarterRiderIDs.length > 0) {
      const placeholders = nonStarterRiderIDs.map(() => '?').join(', ');
      const eligibleRiders = await connection.query(
        `SELECT ploegID, rennerID
         FROM tblPloegRenners
         WHERE tourID = ? AND rennerID IN (${placeholders})
           AND (nietGestartEtappe IS NULL OR nietGestartEtappe >= ?)`,
        [payload.tourID, ...nonStarterRiderIDs, payload.etappeNr]
      ) as Array<{ ploegID: number; rennerID: number }>;
      const eligibleRiderIDs = new Set(eligibleRiders.map(rider => rider.rennerID));
      const invalidRiderIDs = nonStarterRiderIDs.filter(rennerID => !eligibleRiderIDs.has(rennerID));
      if (invalidRiderIDs.length > 0) {
        await connection.rollback();
        response.status(400).json({
          message: `Renners zijn niet beschikbaar voor deze etappe: ${invalidRiderIDs.join(', ')}`
        });
        return;
      }
    }

    await connection.query(
      'UPDATE tblPloegRenners SET nietGestartEtappe = NULL WHERE tourID = ? AND nietGestartEtappe = ?',
      [payload.tourID, payload.etappeNr]
    );
    for (const rennerID of nonStarterRiderIDs) {
      await connection.query(
        `UPDATE tblPloegRenners
         SET nietGestartEtappe = ?
         WHERE tourID = ? AND rennerID = ?
           AND (nietGestartEtappe IS NULL OR nietGestartEtappe >= ?)`,
        [payload.etappeNr, payload.tourID, rennerID, payload.etappeNr]
      );
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

stageResultsRouter.post('/recalculate/:poolID', async (request, response, next) => {
  const poolID = Number(request.params.poolID);
  if (!Number.isInteger(poolID)) {
    response.status(400).json({ message: 'Ongeldig poolID' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await connection.query(
      'SELECT tourID FROM tblPools WHERE poolID = ? FOR UPDATE', [poolID]
    ) as Array<{ tourID: number }>;
    if (!rows[0]) {
      await connection.rollback();
      response.status(404).json({ message: 'Pool niet gevonden' });
      return;
    }
    await recalculatePoolPoints(connection, poolID, rows[0].tourID);
    await connection.commit();
    response.json({ poolID, tourID: rows[0].tourID });
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
  const connection = await pool.getConnection();

  try {
    const payload = createStageResultSchema.parse(request.body);
    await connection.beginTransaction();
    await connection.query(
      'INSERT INTO tblEtappeUitslag (tourID, etappeNr, uitslagType, plaats, rennerID) VALUES (?, ?, ?, ?, ?)',
      [payload.tourID, payload.etappeNr, payload.uitslagType, payload.plaats, payload.rennerID]
    );

    await calculateParticipantPoints(connection, payload.tourID, payload.etappeNr);
    await connection.commit();
    response.status(201).json(payload);
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

stageResultsRouter.put('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);
    const payload = updateStageResultSchema.parse(request.body);
    await connection.beginTransaction();

    const rows = await connection.query(
      'SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      await connection.rollback();
      response.status(404).json({ message: 'Stage result not found' });
      return;
    }

    await connection.query(
      'UPDATE tblEtappeUitslag SET rennerID = ? WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [payload.rennerID, tourID, etappeNr, uitslagType, plaats]
    );

    await calculateParticipantPoints(connection, tourID, etappeNr);
    await connection.commit();
    response.json({ tourID, etappeNr, uitslagType, plaats, rennerID: payload.rennerID });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

stageResultsRouter.delete('/:tourID/:etappeNr/:uitslagType/:plaats', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const tourID = Number(request.params.tourID);
    const etappeNr = Number(request.params.etappeNr);
    const uitslagType = String(request.params.uitslagType);
    const plaats = Number(request.params.plaats);

    await connection.beginTransaction();
    await connection.query(
      'DELETE FROM tblEtappeUitslag WHERE tourID = ? AND etappeNr = ? AND uitslagType = ? AND plaats = ?',
      [tourID, etappeNr, uitslagType, plaats]
    );

    await calculateParticipantPoints(connection, tourID, etappeNr);
    await connection.commit();
    response.status(204).send();
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});
