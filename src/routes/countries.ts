import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';

export const countriesRouter = Router();

const createCountrySchema = z.object({
  country: z.string().max(100),
  land: z.string().max(100),
  iso2: z.string().max(10),
  code: z.string().max(3),
  continent: z.string().max(50),
  vlag: z.string().max(10)
});

const updateCountrySchema = createCountrySchema.partial();

countriesRouter.get('/', async (request, response, next) => {
  try {
    const { iso2, continent, search } = request.query;
    let query = 'SELECT id, country, land, iso2, code, continent, vlag FROM tblLanden';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (typeof iso2 === 'string' && iso2.trim() !== '') {
      conditions.push('iso2 = ?');
      params.push(iso2.trim().toUpperCase());
    }

    if (typeof continent === 'string' && continent.trim() !== '') {
      conditions.push('continent = ?');
      params.push(continent.trim());
    }

    if (typeof search === 'string' && search.trim() !== '') {
      conditions.push('(land LIKE ? OR country LIKE ? OR code LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY land';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

countriesRouter.get('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const rows = await pool.query('SELECT id, country, land, iso2, code, continent, vlag FROM tblLanden WHERE id = ?', [id]);
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Country not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

countriesRouter.post('/', async (request, response, next) => {
  try {
    const payload = createCountrySchema.parse(request.body);
    const result = await pool.query(
      'INSERT INTO tblLanden (country, land, iso2, code, continent, vlag) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.country, payload.land, payload.iso2, payload.code, payload.continent, payload.vlag]
    );

    response.status(201).json({
      ...payload,
      id: Number((result as { insertId: number | bigint }).insertId)
    });
  } catch (error) {
    next(error);
  }
});

countriesRouter.put('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const payload = updateCountrySchema.parse(request.body);

    const rows = await pool.query('SELECT id, country, land, iso2, code, continent, vlag FROM tblLanden WHERE id = ?', [id]);
    const current = (rows as Array<Record<string, unknown>>)[0];

    if (!current) {
      response.status(404).json({ message: 'Country not found' });
      return;
    }

    const updatedCountry = {
      country: payload.country !== undefined ? payload.country : current.country,
      land: payload.land !== undefined ? payload.land : current.land,
      iso2: payload.iso2 !== undefined ? payload.iso2 : current.iso2,
      code: payload.code !== undefined ? payload.code : current.code,
      continent: payload.continent !== undefined ? payload.continent : current.continent,
      vlag: payload.vlag !== undefined ? payload.vlag : current.vlag
    };

    await pool.query(
      'UPDATE tblLanden SET country = ?, land = ?, iso2 = ?, code = ?, continent = ?, vlag = ? WHERE id = ?',
      [updatedCountry.country, updatedCountry.land, updatedCountry.iso2, updatedCountry.code, updatedCountry.continent, updatedCountry.vlag, id]
    );

    response.json({ id, ...updatedCountry });
  } catch (error) {
    next(error);
  }
});

countriesRouter.delete('/:id', async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    await pool.query('DELETE FROM tblLanden WHERE id = ?', [id]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
