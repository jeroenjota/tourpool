import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../auth.js';

export const organisationsRouter = Router();

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform(value => value ? value : null);

export const organisationSchema = z.object({
  naam: z.string().trim().min(1, 'Naam van de organisatie is verplicht.').max(255),
  straat: optionalText(255),
  huisnummer: optionalText(20),
  postcode: optionalText(10),
  plaats: optionalText(100),
  email: z.union([z.literal(''), z.string().trim().email('Ongeldig e-mailadres.').max(255)]).nullable().optional()
    .transform(value => value ? value : null),
  tel: optionalText(30)
});

const toID = (value: string | undefined) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Ongeldige organisatie.');
  return id;
};
const isDuplicate = (error: unknown) => (error as { code?: string }).code === 'ER_DUP_ENTRY';

organisationsRouter.get('/', async (_request, response, next) => {
  try {
    response.json(await pool.query(`
      SELECT o.orgID, o.naam, o.straat, o.huisnummer, o.postcode, o.plaats, o.email, o.tel,
        (SELECT COUNT(*) FROM tblPools p WHERE p.orgID = o.orgID) AS poolCount
      FROM tblOrganisaties o ORDER BY o.naam`));
  } catch (error) {
    next(error);
  }
});

organisationsRouter.post('/', async (request, response, next) => {
  try {
    const org = organisationSchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblOrganisaties (naam, straat, huisnummer, postcode, plaats, email, tel) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [org.naam, org.straat, org.huisnummer, org.postcode, org.plaats, org.email, org.tel]
    );
    response.status(201).json({ orgID: Number(result.insertId), ...org });
  } catch (error) {
    next(isDuplicate(error) ? new HttpError(409, 'Er bestaat al een organisatie met deze naam.') : error);
  }
});

organisationsRouter.put('/:orgID', async (request, response, next) => {
  const connection = await pool.getConnection();
  try {
    const orgID = toID(request.params.orgID);
    const org = organisationSchema.parse(request.body);
    await connection.beginTransaction();
    const result = await connection.query(
      'UPDATE tblOrganisaties SET naam = ?, straat = ?, huisnummer = ?, postcode = ?, plaats = ?, email = ?, tel = ? WHERE orgID = ?',
      [org.naam, org.straat, org.huisnummer, org.postcode, org.plaats, org.email, org.tel, orgID]
    );
    if (!result.affectedRows) throw new HttpError(404, 'Organisatie niet gevonden.');
    // Org is de weergavenaam van de pool en volgt de organisatie.
    await connection.query('UPDATE tblPools SET Org = ? WHERE orgID = ?', [org.naam, orgID]);
    await connection.commit();
    response.json({ orgID, ...org });
  } catch (error) {
    await connection.rollback();
    next(isDuplicate(error) ? new HttpError(409, 'Er bestaat al een organisatie met deze naam.') : error);
  } finally {
    connection.release();
  }
});

organisationsRouter.delete('/:orgID', async (request, response, next) => {
  try {
    const orgID = toID(request.params.orgID);
    const result = await pool.query('DELETE FROM tblOrganisaties WHERE orgID = ?', [orgID]);
    if (!result.affectedRows) throw new HttpError(404, 'Organisatie niet gevonden.');
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
