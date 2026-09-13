import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const addressesRouter = Router();

const createAddressSchema = z.object({
  adrID: z.number().int(),
  vNaam: z.string().max(24).nullable().optional(),
  tNaam: z.string().max(12).nullable().optional(),
  aNaam: z.string().max(24).nullable().optional(),
  plaats: z.string().max(24).nullable().optional(),
  tel: z.string().max(12).nullable().optional(),
  email: z.string().email().max(64).nullable().optional()
});

const updateAddressSchema = createAddressSchema.omit({ adrID: true }).partial();

addressesRouter.get('/', async (_request, response, next) => {
  try {
    const rows = await pool.query(`SELECT adrID, vNaam, tNaam, aNaam,CONCAT(vNaam, ', ', TRIM(CONCAT(COALESCE(aNaam, ''), ' ', COALESCE(tNaam, '')))) AS Naam, plaats, tel, email FROM tblAdressen ORDER BY adrID`);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

addressesRouter.get('/:adrID', async (request, response, next) => {
  try {
    const adrID = Number(request.params.adrID);
    const rows = await pool.query(`SELECT adrID, vNaam, tNaam, aNaam, CONCAT(vNaam, ', ', TRIM(CONCAT(COALESCE(aNaam, ''), ' ', COALESCE(tNaam, '')))) AS Naam, plaats, tel, email FROM tblAdressen WHERE adrID = ?`, [adrID]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Address not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

addressesRouter.post('/', async (request, response, next) => {
  try {
    const payload = createAddressSchema.parse(request.body);
    await pool.query(
      'INSERT INTO tblAdressen (adrID, vNaam, tNaam, aNaam, plaats, tel, email) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [payload.adrID, payload.vNaam ?? null, payload.tNaam ?? null, payload.aNaam ?? null, payload.plaats ?? null, payload.tel ?? null, payload.email ?? null]
    );

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

addressesRouter.put('/:adrID', async (request, response, next) => {
  try {
    const adrID = Number(request.params.adrID);
    const payload = updateAddressSchema.parse(request.body);

    const rows = await pool.query('SELECT adrID, vNaam, tNaam, aNaam, plaats, tel, email FROM tblAdressen WHERE adrID = ?', [adrID]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Address not found' });
      return;
    }

    const updatedAddress = {
      vNaam: payload.vNaam !== undefined ? payload.vNaam : current.vNaam,
      tNaam: payload.tNaam !== undefined ? payload.tNaam : current.tNaam,
      aNaam: payload.aNaam !== undefined ? payload.aNaam : current.aNaam,
      plaats: payload.plaats !== undefined ? payload.plaats : current.plaats,
      tel: payload.tel !== undefined ? payload.tel : current.tel,
      email: payload.email !== undefined ? payload.email : current.email
    };

    await pool.query(
      'UPDATE tblAdressen SET vNaam = ?, tNaam = ?, aNaam = ?, plaats = ?, tel = ?, email = ? WHERE adrID = ?',
      [updatedAddress.vNaam, updatedAddress.tNaam, updatedAddress.aNaam, updatedAddress.plaats, updatedAddress.tel, updatedAddress.email, adrID]
    );

    response.json({ adrID, ...updatedAddress });
  } catch (error) {
    next(error);
  }
});

addressesRouter.delete('/:adrID', async (request, response, next) => {
  try {
    const adrID = Number(request.params.adrID);
    await pool.query('DELETE FROM tblAdressen WHERE adrID = ?', [adrID]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});