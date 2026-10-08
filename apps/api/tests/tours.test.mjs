import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { toursRouter } from '../src/routes/tours.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Tour creation and renaming store SQL-compatible dates and preserve omitted values', async () => {
  const originalQuery = pool.query;
  const writes = [];
  const start = new Date('2026-07-04T00:00:00Z');
  const end = new Date('2026-07-26T00:00:00Z');
  pool.query = async (sql, params = []) => {
    if (sql.startsWith('SELECT')) return [{ tourID: 1, naam: 'Tour', StartDatum: start, EindDatum: end }];
    for (const value of params) {
      if (typeof value === 'string') assert.ok(!/^\d{4}-\d{2}-\d{2}T/.test(value), 'ISO date must not be sent to MariaDB');
    }
    writes.push({ sql, params });
    return {};
  };
  const app = express();
  app.use(express.json());
  app.use('/tours', toursRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = (path, method, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const dates = { StartDatum: '2026-07-04T00:00:00.000Z', EindDatum: '2026-07-26T00:00:00Z' };
  try {
    const renamed = await request('/tours/1', 'PUT', { naam: 'Tour de France', ...dates });
    assert.equal(renamed.status, 200);
    assert.equal((await renamed.json()).naam, 'Tour de France');
    assert.deepEqual(writes.at(-1).params, ['Tour de France', '2026-07-04 00:00:00.000', '2026-07-26 00:00:00', 1]);
    assert.equal((await request('/tours', 'POST', { tourID: 2, naam: 'Nieuwe tour', ...dates })).status, 201);
    assert.deepEqual(writes.at(-1).params, [2, 'Nieuwe tour', '2026-07-04 00:00:00.000', '2026-07-26 00:00:00']);
    assert.equal((await request('/tours/1', 'PUT', { naam: 'Alleen naam' })).status, 200);
    assert.deepEqual(writes.at(-1).params, ['Alleen naam', start, end, 1]);
    assert.equal((await request('/tours/1', 'PUT', { StartDatum: null, EindDatum: null })).status, 200);
    assert.deepEqual(writes.at(-1).params, ['Tour', null, null, 1]);
    const count = writes.length;
    assert.equal((await request('/tours/1', 'PUT', { StartDatum: 'ongeldig' })).status, 400);
    assert.equal(writes.length, count);
  } finally {
    pool.query = originalQuery;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
