import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, isDuplicate } from '../auth.js';
import { recalculatePoolPoints } from './stageResults.js';
import { participantPdf } from './me.js';

export const participantsRouter = Router();

const newAddressSchema = z.object({
  vNaam: z.string().trim().max(24).nullable().optional(),
  tNaam: z.string().trim().max(12).nullable().optional(),
  aNaam: z.string().trim().min(1).max(24),
  plaats: z.string().trim().max(24).nullable().optional(),
  tel: z.string().trim().max(12).nullable().optional(),
  email: z.string().trim().email().max(64).nullable().optional()
}).strict();

const createParticipantSchema = z.object({
  poolID: z.number().int(),
  adrID: z.number().int(),
  ploegnaam: z.string().max(255).nullable().optional(),
  Betaald: z.union([z.boolean(), z.number().int().min(0).max(1)]).nullable().optional(),
  riders: z.array(z.object({
    rennerID: z.number().int(),
    positie: z.number().int().nullable().optional()
  })).optional()
});

const updateParticipantSchema = createParticipantSchema.partial();
const newParticipantSchema = createParticipantSchema.extend({
  adrID: z.number().int().optional(),
  newAddress: newAddressSchema.optional()
}).refine(payload => (payload.adrID === undefined) !== (payload.newAddress === undefined), {
  path: ['adrID'], message: 'Kies een bestaande persoon of vul een nieuwe persoon in.'
});

const generatePloegnaam = async (connection: Awaited<ReturnType<typeof pool.getConnection>>, poolID: number, adrID: number) => {
  const addressRows = await connection.query(
    'SELECT vNaam, aNaam FROM tblAdressen WHERE adrID = ?',
    [adrID]
  ) as Array<{ vNaam?: string | null; aNaam?: string | null }>;
  const address = addressRows[0];

  if (!address) {
    return 'Deelnemer';
  }

  const firstName = (address.vNaam || 'Deelnemer').trim();
  const lastName = (address.aNaam || '').trim();
  const existingRows = await connection.query(
    'SELECT roepnaam AS ploegnaam FROM tblDeelnemers WHERE poolID = ? AND roepnaam IS NOT NULL',
    [poolID]
  ) as Array<{ ploegnaam?: string | null }>;
  const existingNames = new Set(existingRows.map(row => row.ploegnaam?.trim().toLocaleLowerCase()).filter(Boolean));
  const normalizedFirstName = firstName.toLocaleLowerCase();
  const normalizedLastName = lastName.toLocaleLowerCase();

  for (let length = 1; length <= lastName.length; length++) {
    const candidate = `${firstName} ${lastName.slice(0, length)}`;
    if (!existingNames.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
  }

  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  if (!existingNames.has(`${normalizedFirstName} ${normalizedLastName}`.trim())) {
    return fullName;
  }

  let suffix = 2;
  while (existingNames.has(`${fullName} ${suffix}`.toLocaleLowerCase())) {
    suffix++;
  }

  return `${fullName} ${suffix}`;
};

participantsRouter.get('/', async (request, response, next) => {
  try {
    const { poolID, adrID } = request.query;
    let query = `
      SELECT 
        d.deelnID, 
        d.poolID, 
        p.Naam AS poolNaam,
        d.adrID, 
        a.vNaam,
        a.tNaam,
        a.aNaam,
        a.plaats,
        a.tel,
        a.email,
        d.roepnaam AS ploegnaam,
        d.Betaald,
        d.gast,
        TIMESTAMPDIFF(SECOND, NOW(), d.aangemaakt + INTERVAL 48 HOUR) AS gastSecondenOver
      FROM tblDeelnemers d
      JOIN tblAdressen a ON d.adrID = a.adrID
      LEFT JOIN tblPools p ON d.poolID = p.poolID
    `;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (poolID !== undefined && poolID !== '') {
      conditions.push('d.poolID = ?');
      params.push(Number(poolID));
    }

    if (adrID !== undefined && adrID !== '') {
      conditions.push('d.adrID = ?');
      params.push(Number(adrID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY d.poolID, a.aNaam, a.vNaam';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

participantsRouter.get('/:deelnID/pdf', participantPdf);

participantsRouter.get('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const rows = await pool.query(
      `SELECT 
        d.deelnID, 
        d.poolID, 
        p.Naam AS poolNaam,
        d.adrID, 
        a.vNaam,
        a.tNaam,
        a.aNaam,
        a.plaats,
        a.tel,
        a.email,
        d.roepnaam AS ploegnaam,
        d.Betaald,
        d.gast,
        TIMESTAMPDIFF(SECOND, NOW(), d.aangemaakt + INTERVAL 48 HOUR) AS gastSecondenOver
      FROM tblDeelnemers d
      JOIN tblAdressen a ON d.adrID = a.adrID
      LEFT JOIN tblPools p ON d.poolID = p.poolID
      WHERE d.deelnID = ?`,
      [deelnID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Participant not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

participantsRouter.post('/', async (request, response, next) => {
  const connection = await pool.getConnection();

  try {
    const { newAddress, ...payload } = newParticipantSchema.parse(request.body);
    const betaaldVal = payload.Betaald === undefined || payload.Betaald === null ? null : (payload.Betaald ? 1 : 0);

    await connection.beginTransaction();
    let adrID = payload.adrID;
    if (newAddress) {
      const address = await connection.query(
        'INSERT INTO tblAdressen (vNaam, tNaam, aNaam, plaats, tel, email) VALUES (?, ?, ?, ?, ?, ?)',
        [newAddress.vNaam || null, newAddress.tNaam || null, newAddress.aNaam, newAddress.plaats || null,
          newAddress.tel || null, newAddress.email?.toLowerCase() || null]
      );
      adrID = Number((address as { insertId: number | bigint }).insertId);
    } else if (request.managedPoolIDs) {
      // Pool managers have no address book: only registered accounts or people already in their pools.
      const managed = request.managedPoolIDs;
      const allowed = await connection.query(
        `SELECT 1 FROM tblAccounts WHERE adrID = ? AND emailVerified = TRUE AND role IN ('user', 'poolbeheerder')
         UNION SELECT 1 FROM tblDeelnemers WHERE adrID = ? AND poolID IN (${managed.map(() => '?').join(', ') || 'NULL'})
         LIMIT 1`,
        [adrID, adrID, ...managed]
      );
      if (!allowed.length) throw new HttpError(403, 'Kies een geregistreerd account of voeg een nieuwe persoon toe.');
    }
    const ploegnaam = payload.ploegnaam?.trim() || await generatePloegnaam(connection, payload.poolID, adrID!);
    const result = await connection.query(
      'INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald) VALUES (?, ?, ?, ?)',
      [payload.poolID, adrID, ploegnaam, betaaldVal]
    );

    const deelnID = Number((result as { insertId: number | bigint }).insertId);

    if (payload.riders && payload.riders.length > 0) {
      for (let i = 0; i < payload.riders.length; i++) {
        const r = payload.riders[i];
        const positie = r.positie ?? (i + 1);
        await connection.query(
          'INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)',
          [deelnID, r.rennerID, positie]
        );
      }
    }

    await connection.commit();

    response.status(201).json({
      ...payload,
      adrID,
      ploegnaam,
      deelnID
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

participantsRouter.put('/:deelnID/account', async (request, response, next) => {
  let connection;
  try {
    const deelnID = z.coerce.number().int().positive().parse(request.params.deelnID);
    const payload = z.object({
      accountID: z.number().int().positive(),
      expectedAdrID: z.number().int().positive()
    }).strict().parse(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const accounts = await connection.query(
      "SELECT adrID FROM tblAccounts WHERE accountID = ? AND role IN ('user', 'poolbeheerder') FOR UPDATE",
      [payload.accountID]
    ) as Array<{ adrID: number }>;
    if (!accounts[0]) throw new HttpError(404, 'Gebruikersaccount niet gevonden.');
    const participants = await connection.query(
      'SELECT adrID FROM tblDeelnemers WHERE deelnID = ? FOR UPDATE', [deelnID]
    ) as Array<{ adrID: number }>;
    if (!participants[0]) throw new HttpError(404, 'Deelnemer niet gevonden.');
    if (participants[0].adrID !== payload.expectedAdrID) {
      throw new HttpError(409, 'De deelnemer is ondertussen gewijzigd. Ververs het overzicht voordat je koppelt.');
    }
    await connection.query('UPDATE tblDeelnemers SET adrID = ? WHERE deelnID = ?', [accounts[0].adrID, deelnID]);
    await connection.commit();
    response.json({ deelnID, adrID: accounts[0].adrID });
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error)
      ? new HttpError(409, 'Dit account heeft al een ploeg met dezelfde ploegnaam in deze pool. Pas eerst de ploegnaam aan.')
      : error);
  } finally { connection?.release(); }
});

participantsRouter.put('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    const payload = updateParticipantSchema.parse(request.body);

    const rows = await pool.query('SELECT deelnID, poolID, adrID, roepnaam AS ploegnaam, Betaald FROM tblDeelnemers WHERE deelnID = ?', [deelnID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Participant not found' });
      return;
    }

    const betaaldVal = payload.Betaald !== undefined
      ? (payload.Betaald === null ? null : (payload.Betaald ? 1 : 0))
      : current.Betaald;

    const updated = {
      poolID: payload.poolID !== undefined ? payload.poolID : current.poolID,
      adrID: payload.adrID !== undefined ? payload.adrID : current.adrID,
      ploegnaam: payload.ploegnaam !== undefined ? payload.ploegnaam : current.ploegnaam,
      Betaald: betaaldVal
    };

    await pool.query(
      'UPDATE tblDeelnemers SET poolID = ?, adrID = ?, roepnaam = ?, Betaald = ? WHERE deelnID = ?',
      [updated.poolID, updated.adrID, updated.ploegnaam, updated.Betaald, deelnID]
    );

    // Alleen betaalde ploegen tellen mee: punten en standen opnieuw berekenen bij een wijziging.
    if (Boolean(updated.Betaald) !== Boolean(current.Betaald) || updated.poolID !== current.poolID) {
      const poolIDs = [...new Set([Number(current.poolID), Number(updated.poolID)])];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const poolID of poolIDs) {
          const pools = await connection.query('SELECT tourID FROM tblPools WHERE poolID = ?', [poolID]) as Array<{ tourID: number }>;
          if (pools[0]) await recalculatePoolPoints(connection, poolID, pools[0].tourID);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    }

    response.json({ deelnID, ...updated });
  } catch (error) {
    next(error);
  }
});

participantsRouter.delete('/:deelnID', async (request, response, next) => {
  try {
    const deelnID = Number(request.params.deelnID);
    await pool.query('DELETE FROM tblDeelnemers WHERE deelnID = ?', [deelnID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
