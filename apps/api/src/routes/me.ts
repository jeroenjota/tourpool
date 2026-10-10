import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { pool } from '../db.js';
import { emailSchema, getAccount, HttpError, isDuplicate, profileSchema, usernameSchema } from '../auth.js';
import { guestEntryLifetimeHours } from '../guestCleanup.js';
import { assertEnrollmentOpen, enrollmentStatus, validateRiders, type EnrollmentPool } from '../enrollment.js';

export const meRouter = Router();
const require = createRequire(import.meta.url);
const garamondLatin = require.resolve('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff');
const garamondLatinExt = require.resolve('@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff');
const lato = require.resolve('lato-font/fonts/lato-normal/lato-normal.woff');
// Works from both src/routes (dev) and dist/routes (build): assets live in apps/api/assets.
const pdfAsset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));
const jotaLogo = pdfAsset('jota-logo.png');
const cyclistImage = pdfAsset('tour_logo.png');
const latinExtCharacter = /[\u0100-\u024f\u1e00-\u1eff\u2c60-\u2c7f\ua720-\ua7ff]/u;

type PdfTextOptions = {
  heading?: boolean;
  lineGap?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
};
function drawPdfLine(doc: InstanceType<typeof PDFDocument>, color = '#a16207') {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.moveDown(0.5);
  doc.save().moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor(color).stroke().restore();
  doc.moveDown(0.5);
}
// Gecentreerde tekst gevolgd door een (aangevinkt) vakje; het vinkje wordt getekend omdat Lato geen ✓ heeft.
function writePaidLine(doc: InstanceType<typeof PDFDocument>, text: string, checked: boolean) {
  doc.font(lato);
  const left = doc.page.margins.left;
  const available = doc.page.width - left - doc.page.margins.right;
  const size = doc.currentLineHeight() * 0.8;
  const gap = size / 2;
  const x = left + (available - doc.widthOfString(text) - gap - size) / 2;
  const y = doc.y;
  doc.text(text, x, y, { lineBreak: false });
  const boxX = x + doc.widthOfString(text) + gap;
  const boxY = y + (doc.currentLineHeight() - size) / 2;
  doc.save().lineWidth(1).rect(boxX, boxY, size, size).stroke();
  if (checked) {
    doc.lineWidth(1.8).lineCap('round').lineJoin('round')
      .moveTo(boxX + size * 0.2, boxY + size * 0.55)
      .lineTo(boxX + size * 0.42, boxY + size * 0.78)
      .lineTo(boxX + size * 0.82, boxY + size * 0.25)
      .stroke();
  }
  doc.restore();
  doc.x = left;
  doc.y = y + doc.currentLineHeight(true);
}
function writePdfText(doc: InstanceType<typeof PDFDocument>, text: string, { heading = false, lineGap, align }: PdfTextOptions = {}) {
  const textOptions = { ...(lineGap === undefined ? {} : { lineGap }), ...(align ? { align } : {}) };
  if (!heading) {
    doc.font(lato).text(text, textOptions);
    return;
  }
  const parts: { text: string; extended: boolean }[] = [];
  for (const character of text) {
    const extended = latinExtCharacter.test(character);
    const lastPart = parts.at(-1);
    if (lastPart?.extended === extended) lastPart.text += character;
    else parts.push({ text: character, extended });
  }
  const partFont = (part: { extended: boolean }) => part.extended ? garamondLatinExt : garamondLatin;
  const left = doc.page.margins.left;
  const available = doc.page.width - left - doc.page.margins.right;
  const totalWidth = parts.reduce((sum, part) => sum + doc.font(partFont(part)).widthOfString(part.text), 0);
  // PDFKit misaligns centered text that is split over several fonts, so single-line headings are positioned manually.
  if ((align === 'center' || align === 'right') && totalWidth <= available) {
    const x = left + (align === 'center' ? (available - totalWidth) / 2 : available - totalWidth);
    const y = doc.y;
    let offset = 0;
    for (const part of parts) {
      doc.font(partFont(part)).text(part.text, x + offset, y, { lineBreak: false });
      offset += doc.widthOfString(part.text);
    }
    doc.x = left;
    doc.y = y + doc.currentLineHeight(true) + (lineGap ?? 0);
    return;
  }
  parts.forEach((part, index) => {
    doc.font(partFont(part)).text(part.text, {
      continued: index < parts.length - 1,
      ...textOptions
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
    org.straat AS orgStraat, org.huisnummer AS orgHuisnummer, org.postcode AS orgPostcode,
    org.plaats AS orgPlaats, org.email AS orgEmail, org.tel AS orgTel,
    DATE_FORMAT(t.StartDatum, '%Y-%m-%dT%H:%i:%s') AS tourStart,
    DATE_FORMAT(p.StartInschr, '%Y-%m-%d') AS registrationStart,
    DATE_FORMAT(p.EindInschr, '%Y-%m-%d') AS registrationEnd,
    o.inleg, o.PloegRennerAantal, o.PloegReserveAantal
  FROM tblPools p JOIN tblTours t ON t.tourID = p.tourID
  LEFT JOIN tblOpties o ON o.poolID = p.poolID
  LEFT JOIN tblOrganisaties org ON org.orgID = p.orgID`;
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

meRouter.put('/username', async (request, response, next) => {
  try {
    const { username } = z.object({ username: usernameSchema }).strict().parse(request.body);
    const account = getAccount(request);
    await pool.query('UPDATE tblAccounts SET username = ? WHERE accountID = ?', [username, account.accountID]);
    response.json({ username });
  } catch (error) {
    next(isDuplicate(error) ? new HttpError(409, 'Deze gebruikersnaam is al in gebruik.') : error);
  }
});

const listPools: RequestHandler = async (_request, response, next) => {
  try {
    const rows = await pool.query(`${poolSelect} WHERE p.visibleToUsers = TRUE ORDER BY t.StartDatum DESC, p.poolID DESC`) as EnrollmentPool[];
    response.json(rows.map(p => ({ ...p, ...enrollmentStatus(p) })));
  } catch (error) { next(error); }
};
const listPoolRiders: RequestHandler = async (request, response, next) => {
  let connection;
  try {
    const poolID = idSchema.parse(request.params.poolID);
    connection = await pool.getConnection();
    const p = await loadPool(connection, poolID);
    response.json(await availableRiders(connection, p.tourID));
  } catch (error) { next(error); } finally { connection?.release(); }
};
meRouter.get('/pools', listPools);
meRouter.get('/pools/:poolID/riders', listPoolRiders);

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

    const buffer = await renderEntryPdf({ deelnID, p, entry, profile, email: getAccount(request).email, riders });
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tourpool-inschrijving-${deelnID}.pdf"`
    }).send(buffer);
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});

// Beheer: PDF van elke deelname; toegang tot de pool wordt al door poolScope gecontroleerd.
export const participantPdf: RequestHandler = async (request, response, next) => {
  try {
    const deelnID = idSchema.parse(request.params.deelnID);
    const rows = await pool.query(
      `SELECT d.deelnID, d.poolID, d.roepnaam AS ploegnaam, d.Betaald, d.gast, d.adrID,
        d.aangemaakt + INTERVAL ? HOUR AS gastDeadline,
        (SELECT ac.email FROM tblAccounts ac WHERE ac.adrID = d.adrID ORDER BY ac.accountID LIMIT 1) AS accountEmail
       FROM tblDeelnemers d WHERE d.deelnID = ?`, [guestEntryLifetimeHours, deelnID]
    ) as Array<Entry & { gast: number | null; adrID: number; gastDeadline: Date | null; accountEmail: string | null }>;
    const entry = rows[0];
    if (!entry) throw new HttpError(404, 'Deelname niet gevonden.');
    const pools = await pool.query(`${poolSelect} WHERE p.poolID = ?`, [entry.poolID]) as EnrollmentPool[];
    const p = pools[0];
    if (!p) throw new HttpError(404, 'Pool niet gevonden.');
    const profiles = await pool.query(profileSelect, [entry.adrID]) as Profile[];
    const profile = profiles[0];
    if (!profile) throw new HttpError(404, 'Persoon niet gevonden.');
    const riders = await pool.query(
      `SELECT dr.rennerID, dr.positie, r.vnaam, r.tnaam, r.anaam, pr.Rugnummer, pl.naam AS ploegNaam
       FROM tblDeelnemRenners dr JOIN tblRenners r ON r.rennerID = dr.rennerID
       LEFT JOIN tblPloegRenners pr ON pr.tourID = ? AND pr.rennerID = dr.rennerID
       LEFT JOIN tblPloegen pl ON pl.ploegID = pr.ploegID
       WHERE dr.deelnID = ? ORDER BY dr.positie, dr.rennerID`, [p.tourID, deelnID]
    ) as Rider[];
    const guestDeadline = entry.gast && !entry.Betaald && entry.gastDeadline ? new Date(entry.gastDeadline) : undefined;
    const buffer = await renderEntryPdf({
      deelnID, p, entry, profile, email: entry.accountEmail || profile.email || null, riders, guestDeadline
    });
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="tourpool-inschrijving-${deelnID}.pdf"`,
      'Cache-Control': 'no-store'
    }).send(buffer);
  } catch (error) {
    next(error);
  }
};

interface EntryPdfData {
  deelnID: number; p: EnrollmentPool; entry: Entry; profile: Profile; email: string | null; riders: Rider[];
  guestDeadline?: Date;
}
function dropOffAddress(p: EnrollmentPool) {
  const street = [p.orgStraat, p.orgHuisnummer].filter(Boolean).join(' ');
  const town = [p.orgPostcode, p.orgPlaats].filter(Boolean).join(' ');
  const contact = [p.orgTel && `tel. ${p.orgTel}`, p.orgEmail].filter(Boolean).join(' / ');
  if (!street && !town && !contact) return null;
  return [street, town, contact].filter(Boolean).join('\n');
}

function poolOrg(p: EnrollmentPool){
  return p.Org || 'de organisatie';
}

async function renderEntryPdf({ deelnID, p, entry, profile, email, riders, guestDeadline }: EntryPdfData) {
    const doc = new PDFDocument({ size: 'A4', margin: 45, info: { Title: `Tourpool inschrijving ${deelnID}` } });
    const chunks: Buffer[] = [];
    const pdf = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    const headerTop = doc.y;
    const headerImage = { width: 90, height: 60 };
    doc.image(jotaLogo, doc.page.margins.left, headerTop, { fit: [headerImage.width, headerImage.height], valign: 'center' });
    doc.image(cyclistImage, doc.page.width - doc.page.margins.right - headerImage.width, headerTop, { fit: [headerImage.width, headerImage.height], align: 'right', valign: 'center' });
    doc.x = doc.page.margins.left;
    doc.y = headerTop;
    doc.fontSize(28);
    writePdfText(doc, 'Jota\'s Tourpool', { heading: true, align: 'center' });
    doc.fontSize(20)
    writePdfText(doc, `${p.tourNaam}`, { heading: true, align: 'center' });
    drawPdfLine(doc);
    doc.fontSize(24);
    writePdfText(doc, 'Inschrijfformulier', { heading: true, align: 'center' });
    doc.moveDown().fontSize(20);
    writePdfText(doc, `${p.Org || 'Organisatie'} - ${p.Naam}`, { heading: true, align: 'center' });
    doc.moveDown();
    doc.fontSize(16)
    writePdfText(doc, `Pool van: ${[profile.vNaam, profile.tNaam, profile.aNaam].filter(Boolean).join(' ')}`,{heading: true, align: 'center'});
    writePdfText(doc, `${email ? `email:${email}` : ''} ${profile.tel ?? ''}`,{heading: true, align: 'center'});
    writePaidLine(doc, `Inleg: EUR ${Number(p.inleg ?? 0).toFixed(2)} | Betaald:`, Boolean(entry.Betaald));
    if (guestDeadline) {
      doc.moveDown(0.5).fillColor('#b91c1c').fontSize(12);
      writePdfText(doc, 'LET OP: deze ploeg doet pas mee nadat de inleg is betaald.', { heading: true, align: 'center' });
      writePdfText(doc, `Niet betaald voor ${guestDeadline.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', dateStyle: 'long', timeStyle: 'short' })}? Dan wordt de inschrijving automatisch verwijderd.`, { align: 'center' });
      doc.fillColor('black');
    }
    doc.moveDown();
    drawPdfLine(doc);
    doc.fontSize(24);
    writePdfText(doc, `Mijn Tourploeg: ${entry.ploegnaam}`,{heading: true, align: 'center'});
    doc.moveDown().fontSize(14);
    const mainCount = p.PloegRennerAantal! - p.PloegReserveAantal!;
    const columnGap = 20;
    const left = doc.page.margins.left;
    const columnWidth = (doc.page.width - left - doc.page.margins.right - columnGap) / 2;
    const top = doc.y;
    const writeColumn = (x: number, title: string, list: typeof riders, label: (index: number) => string) => {
      doc.font(lato).fontSize(12).text(title, x, top, { width: columnWidth });
      doc.moveDown(0.3).fontSize(10);
      list.forEach((r, index) => {
        doc.text(
          `${label(index)} ${[r.vnaam, r.tnaam, r.anaam].filter(Boolean).join(' ')} (${r.Rugnummer ?? '-'}) - ${r.ploegNaam || '-'}`,
          x,
          doc.y,
          { width: columnWidth, lineGap: 3 }
        );
      });
      return doc.y;
    };
    const leftBottom = writeColumn(left, 'Renners', riders.slice(0, mainCount), index => `${index + 1}.`);
    const rightBottom = writeColumn(left + columnWidth + columnGap, 'Reserves', riders.slice(mainCount), index => `R${index + 1}.`);
    doc.x = left;
    doc.y = Math.max(leftBottom, rightBottom);
    
    drawPdfLine(doc);
    doc.moveDown().fontSize(10);
    const dropOff = dropOffAddress(p);
    const org = poolOrg(p); 
    if (!entry.Betaald) {
    writePdfText(doc,`Lever dit formulier in en betaal de inleg bij:`, { align: 'center' });
    } else {
      writePdfText(doc,`Veel plezier met de pool. Controleer de stand en je positie elke dag bij:`, { align: 'center' });
    }
    doc.moveDown().fontSize(16);
    writePdfText(doc,  org ? `${org}`:``, { align: 'center' , heading: true });
    doc.fontSize(12);
    writePdfText(doc,  dropOff ? `${dropOff}.`:``, { align: 'center' , heading: false});
    doc.moveDown();
    doc.moveDown().fontSize(10);
    writePdfText(doc, `Formulier afgedrukt: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`, { align: 'center' });
    doc.end();
    return pdf;
}

// Inschrijven zonder account: de ploeg wordt als "niet betaald" opgeslagen bij een nieuw adres
// en kan daarna alleen nog door de organisatie worden gewijzigd.
export const publicRouter = Router();
const guestEntryLimit = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 20,
  message: { message: 'Te veel inschrijvingen vanaf dit adres. Probeer het later opnieuw.' },
  standardHeaders: 'draft-8', legacyHeaders: false
});
const guestEntrySchema = entrySchema.extend({
  profile: profileSchema.extend({ email: z.union([z.literal(''), emailSchema]).default('') }).strict()
}).strict();

publicRouter.get('/pools', listPools);
publicRouter.get('/pools/:poolID/riders', listPoolRiders);

publicRouter.post('/entries', guestEntryLimit, async (request, response, next) => {
  let connection;
  try {
    const { profile, ...payload } = guestEntrySchema.parse(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const p = await loadPool(connection, payload.poolID, true);
    assertEnrollmentOpen(p);
    const available = await availableRiders(connection, p.tourID);
    validateRiders(p, payload.riders, available.map(r => r.rennerID), true);
    const address = await connection.query(
      'INSERT INTO tblAdressen (vNaam, tNaam, aNaam, plaats, tel, email) VALUES (?, ?, ?, ?, ?, ?)',
      [profile.vNaam, profile.tNaam, profile.aNaam, profile.plaats, profile.tel, profile.email || null]
    );
    const result = await connection.query(
      'INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald, gast) VALUES (?, ?, ?, 0, 1)',
      [payload.poolID, Number(address.insertId), payload.ploegnaam]
    );
    const deelnID = Number(result.insertId);
    for (const [index, rennerID] of payload.riders.entries()) {
      await connection.query('INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, ?, ?)', [deelnID, rennerID, index + 1]);
    }
    assertEnrollmentOpen(p);
    const riders = await entryRiders(connection, deelnID);
    await connection.commit();
    connection.release();
    connection = undefined;

    const entry: Entry = { deelnID, poolID: payload.poolID, ploegnaam: payload.ploegnaam, Betaald: 0 };
    const guestDeadline = new Date(Date.now() + guestEntryLifetimeHours * 60 * 60 * 1000);
    const buffer = await renderEntryPdf({ deelnID, p, entry, profile, email: profile.email || null, riders, guestDeadline });
    response.status(201).json({ deelnID, deadline: guestDeadline.toISOString(), pdf: buffer.toString('base64') });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally { connection?.release(); }
});
