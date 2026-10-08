import { Router } from 'express';
import { createRequire } from 'node:module';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { getAccount, HttpError, isDuplicate, profileSchema, usernameSchema } from '../auth.js';
import { assertEnrollmentOpen, enrollmentStatus, validateRiders, type EnrollmentPool } from '../enrollment.js';

export const meRouter = Router();
const require = createRequire(import.meta.url);
const garamondLatin = require.resolve('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff');
const garamondLatinExt = require.resolve('@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff');
const lato = require.resolve('lato-font/fonts/lato-normal/lato-normal.woff');
const latinExtCharacter = /[\u0100-\u024f\u1e00-\u1eff\u2c60-\u2c7f\ua720-\ua7ff]/u;

function writePdfText(doc: InstanceType<typeof PDFDocument>, text: string, heading = false, lineGap?: number) {
  if (!heading) {
    doc.font(lato).text(text, lineGap === undefined ? {} : { lineGap });
    return;
  }
  const parts: { text: string; extended: boolean }[] = [];
  for (const character of text) {
    const extended = latinExtCharacter.test(character);
    const lastPart = parts.at(-1);
    if (lastPart?.extended === extended) lastPart.text += character;
    else parts.push({ text: character, extended });
  }
  parts.forEach((part, index) => {
    doc.font(part.extended ? garamondLatinExt : garamondLatin).text(part.text, {
      continued: index < parts.length - 1,
      ...(lineGap === undefined ? {} : { lineGap })
    });
  });
}

type Connection = Awaited<ReturnType<typeof pool.getConnection>>;
const idSchema = z.coerce.number().int().positive();
const entrySchema = z.object({
  poolID: z.number().int().positive(),
  ploegnaam: z.string().trim().min(1).max(255),
  riders: z.array(z.number().int().positive()).max(25)
}).strict();
const poolSelect = `
  SELECT p.poolID, p.tourID, p.Naam, p.Org, t.naam AS tourNaam,
    DATE_FORMAT(t.StartDatum, '%Y-%m-%dT%H:%i:%s') AS tourStart,
    DATE_FORMAT(p.StartInschr, '%Y-%m-%d') AS registrationStart,
    DATE_FORMAT(p.EindInschr, '%Y-%m-%d') AS registrationEnd,
    o.inleg, o.PloegRennerAantal, o.PloegReserveAantal
  FROM tblPools p JOIN tblTours t ON t.tourID = p.tourID
  LEFT JOIN tblOpties o ON o.poolID = p.poolID`;
interface Profile {
  vNaam: string; tNaam: string | null; aNaam: string; email: string;
  plaats: string | null; tel: string | null;
}
interface Entry {
  deelnID: number; poolID: number; ploegnaam: string; Betaald: boolean | number | null;
}
interface Rider {
  rennerID: number; Rugnummer: number | null; vnaam: string | null;
  tnaam: string | null; anaam: string; ploegNaam: string | null; positie?: number;
}
const profileSelect = 'SELECT vNaam, tNaam, aNaam, email, plaats, tel FROM tblAdressen WHERE adrID = ?';
const profileUpdateSchema = profileSchema.extend({ username: usernameSchema }).strict();

async function loadPool(connection: Connection, poolID: number, lock = false) {
  const rows = await connection.query(`${poolSelect} WHERE p.poolID = ? AND p.visibleToUsers = TRUE${lock ? ' FOR UPDATE' : ''}`, [poolID]) as EnrollmentPool[];
  if (!rows[0]) throw new HttpError(404, 'Pool niet gevonden.');
  return rows[0];
}
async function ownedEntry(connection: Connection, deelnID: number, adrID: number, lock = false) {
  const rows = await connection.query(
    `SELECT deelnID, poolID, roepnaam AS ploegnaam, Betaald FROM tblDeelnemers WHERE deelnID = ? AND adrID = ?
     AND EXISTS (SELECT 1 FROM tblPools p WHERE p.poolID = tblDeelnemers.poolID AND p.visibleToUsers = TRUE)${lock ? ' FOR UPDATE' : ''}`,
    [deelnID, adrID]
  ) as Entry[];
  if (!rows[0]) throw new HttpError(404, 'Tourploeg niet gevonden.');
  return rows[0];
}
async function availableRiders(connection: Connection, tourID: number): Promise<Rider[]> {
  return connection.query(
    `SELECT pr.rennerID, pr.Rugnummer, r.vnaam, r.tnaam, r.anaam, pl.naam AS ploegNaam
     FROM tblPloegRenners pr JOIN tblRenners r ON r.rennerID = pr.rennerID
     JOIN tblPloegen pl ON pl.ploegID = pr.ploegID WHERE pr.tourID = ? ORDER BY pr.Rugnummer`,
    [tourID]
  );
}
async function entryRiders(connection: Connection, deelnID: number): Promise<Rider[]> {
  return connection.query(
    `SELECT dr.rennerID, dr.positie, r.vnaam, r.tnaam, r.anaam, pr.Rugnummer, pl.naam AS ploegNaam
     FROM tblDeelnemRenners dr JOIN tblRenners r ON r.rennerID = dr.rennerID
     JOIN tblDeelnemers d ON d.deelnID = dr.deelnID JOIN tblPools p ON p.poolID = d.poolID
     LEFT JOIN tblPloegRenners pr ON pr.tourID = p.tourID AND pr.rennerID = dr.rennerID
     LEFT JOIN tblPloegen pl ON pl.ploegID = pr.ploegID
     WHERE dr.deelnID = ? ORDER BY dr.positie, dr.rennerID`, [deelnID]
  );
}

meRouter.get('/profile', async (request, response, next) => {
  try {
    const account = getAccount(request);
    const rows = await pool.query(profileSelect, [account.adrID]) as Profile[];
    if (!rows[0]) throw new HttpError(404, 'Profiel niet gevonden.');
    response.json({ ...rows[0], username: account.username });
  } catch (error) { next(error); }
});

meRouter.put('/profile', async (request, response, next) => {
  let connection;
  try {
    const p = profileUpdateSchema.parse(request.body);
    const account = getAccount(request);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const conflicts = await connection.query(
      'SELECT accountID FROM tblAccounts WHERE username = ? AND accountID <> ? FOR UPDATE',
      [p.username, account.accountID]
    );
    if (conflicts.length) throw new HttpError(409, 'Deze gebruikersnaam is al in gebruik.');
    await connection.query('UPDATE tblAccounts SET username = ? WHERE accountID = ?', [p.username, account.accountID]);
    await connection.query(
      'UPDATE tblAdressen SET vNaam = ?, tNaam = ?, aNaam = ?, plaats = ?, tel = ? WHERE adrID = ?',
      [p.vNaam, p.tNaam, p.aNaam, p.plaats, p.tel, account.adrID]
    );
    await connection.commit();
    response.json(p);
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Deze gebruikersnaam is al in gebruik.') : error);
  } finally { connection?.release(); }
});

meRouter.get('/pools', async (_request, response, next) => {
  try {
    const rows = await pool.query(`${poolSelect} WHERE p.visibleToUsers = TRUE ORDER BY t.StartDatum DESC, p.poolID DESC`) as EnrollmentPool[];
    response.json(rows.map(p => ({ ...p, ...enrollmentStatus(p) })));
  } catch (error) { next(error); }
});

meRouter.get('/pools/:poolID/riders', async (request, response, next) => {
  let connection;
  try {
    const poolID = idSchema.parse(request.params.poolID);
    connection = await pool.getConnection();
    const p = await loadPool(connection, poolID);
    response.json(await availableRiders(connection, p.tourID));
  } catch (error) { next(error); } finally { connection?.release(); }
});

meRouter.get('/entries', async (request, response, next) => {
  try {
    const rows = await pool.query(
      `SELECT d.deelnID, d.poolID, d.roepnaam AS ploegnaam, d.Betaald, p.Naam AS poolNaam
       FROM tblDeelnemers d JOIN tblPools p ON p.poolID = d.poolID
       WHERE d.adrID = ? AND p.visibleToUsers = TRUE ORDER BY d.deelnID DESC`, [getAccount(request).adrID]
    );
    response.json(rows);
  } catch (error) { next(error); }
});

meRouter.get('/entries/:deelnID', async (request, response, next) => {
  let connection;
  try {
    const deelnID = idSchema.parse(request.params.deelnID);
    connection = await pool.getConnection();
    const entry = await ownedEntry(connection, deelnID, getAccount(request).adrID);
    response.json({ ...entry, riders: await entryRiders(connection, deelnID) });
  } catch (error) { next(error); } finally { connection?.release(); }
});

async function saveEntry(connection: Connection, adrID: number, payload: z.infer<typeof entrySchema>, deelnID?: number) {
  await connection.beginTransaction();
  // Lock the pool/options before checking the deadline and changing the roster.
  const p = await loadPool(connection, payload.poolID, true);
  assertEnrollmentOpen(p);
  if (deelnID) {
    const current = await ownedEntry(connection, deelnID, adrID, true);
    if (current.poolID !== payload.poolID) throw new HttpError(400, 'Een bestaande tourploeg kan niet naar een andere pool worden verplaatst.');
  }
  const available = await availableRiders(connection, p.tourID);
  validateRiders(p, payload.riders, available.map(r => r.rennerID));
  if (deelnID) {
    await connection.query('UPDATE tblDeelnemers SET roepnaam = ? WHERE deelnID = ? AND adrID = ?', [payload.ploegnaam, deelnID, adrID]);
    await connection.query('DELETE FROM tblDeelnemRenners WHERE deelnID = ?', [deelnID]);
  } else {
    const result = await connection.query(
      'INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald) VALUES (?, ?, ?, 0)',
      [payload.poolID, adrID, payload.ploegnaam]
    );
    deelnID = Number(result.insertId);
  }
  for (const [index, rennerID] of payload.riders.entries()) {
    await connection.query('INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)', [deelnID, rennerID, index + 1]);
  }
  // Check again after any slow writes; crossing the deadline rolls everything back.
  assertEnrollmentOpen(p);
  await connection.commit();
  return deelnID;
}

meRouter.post('/entries', async (request, response, next) => {
  let connection;
  try {
    const payload = entrySchema.parse(request.body);
    connection = await pool.getConnection();
    const deelnID = await saveEntry(connection, getAccount(request).adrID, payload);
    response.status(201).json({ deelnID });
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Je hebt al een tourploeg met deze ploegnaam in deze pool.') : error);
  } finally { connection?.release(); }
});

meRouter.put('/entries/:deelnID', async (request, response, next) => {
  let connection;
  try {
    const deelnID = idSchema.parse(request.params.deelnID);
    const payload = entrySchema.parse(request.body);
    connection = await pool.getConnection();
    await saveEntry(connection, getAccount(request).adrID, payload, deelnID);
    response.json({ deelnID });
  } catch (error) {
    if (connection) await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Je hebt al een tourploeg met deze ploegnaam in deze pool.') : error);
  } finally { connection?.release(); }
});

meRouter.get('/entries/:deelnID/pdf', async (request, response, next) => {
  let connection;
  try {
    const deelnID = idSchema.parse(request.params.deelnID);
    const adrID = getAccount(request).adrID;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const entry = await ownedEntry(connection, deelnID, adrID);
    const p = await loadPool(connection, entry.poolID);
    const profiles = await connection.query(profileSelect, [adrID]) as Profile[];
    const profile = profiles[0];
    if (!profile) throw new HttpError(404, 'Profiel niet gevonden.');
    const riders = await entryRiders(connection, deelnID);
    const available = await availableRiders(connection, p.tourID);
    validateRiders(p, riders.map(r => r.rennerID), available.map(r => r.rennerID), true);
    await connection.commit();
    connection.release();
    connection = undefined;

    const doc = new PDFDocument({ size: 'A4', margin: 45, info: { Title: `Tourpool inschrijving ${deelnID}` } });
    const chunks: Buffer[] = [];
    const pdf = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.fontSize(20);
    writePdfText(doc, 'Tourpool - Inschrijfformulier', true);
    doc.moveDown().fontSize(12);
    writePdfText(doc, `${p.Org || 'Organisatie'} - ${p.Naam || `Pool ${p.poolID}`}`);
    writePdfText(doc, `${p.tourNaam} | Inschrijving #${deelnID}`);
    doc.moveDown();
    writePdfText(doc, `Naam: ${[profile.vNaam, profile.tNaam, profile.aNaam].filter(Boolean).join(' ')}`);
    writePdfText(doc, `Ploegnaam: ${entry.ploegnaam}`);
    writePdfText(doc, `E-mail: ${getAccount(request).email}`);
    if (profile.plaats) writePdfText(doc, `Woonplaats: ${profile.plaats}`);
    if (profile.tel) writePdfText(doc, `Telefoon: ${profile.tel}`);
    writePdfText(doc, `Inleg: EUR ${Number(p.inleg ?? 0).toFixed(2)} | Betaald: ${entry.Betaald ? 'Ja' : 'Nee'}`);
    doc.moveDown().fontSize(14);
    writePdfText(doc, 'Tourploeg (op volgorde)', true);
    const mainCount = p.PloegRennerAantal! - p.PloegReserveAantal!;
    for (const [index, r] of riders.entries()) {
      if (index === mainCount) {
        doc.moveDown(0.4).fontSize(12);
        writePdfText(doc, 'Reserves');
      }
      doc.fontSize(10);
      writePdfText(doc,
        `${index + 1}. ${r.Rugnummer ?? '-'} - ${[r.vnaam, r.tnaam, r.anaam].filter(Boolean).join(' ')} (${r.ploegNaam || '-'})`,
        false,
        3
      );
    }
    doc.moveDown().fontSize(10);
    writePdfText(doc, 'Lever dit formulier in bij de organisatie en betaal daar de inleg. Alleen de organisatie bevestigt de betaling.');
    writePdfText(doc, `Gegenereerd: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
    doc.end();
    const buffer = await pdf;
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tourpool-inschrijving-${deelnID}.pdf"`
    }).send(buffer);
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});
