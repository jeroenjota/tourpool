import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { stagesRouter } from '../src/routes/stages.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Stage and rest-day reads and edits keep calendar dates without timezone conversion', async () => {
  const original = pool.query;
  let date = '2026-07-04';
  const writes = [];
  pool.query = async (sql, params = []) => {
    if (sql.startsWith('SELECT')) {
      assert.ok(sql.includes("DATE_FORMAT(datum, '%Y-%m-%d') AS datum"));
      return [{ tour: '1', etappeNr: sql.includes('IS NULL') ? null : 1, datum: date, Start: 'Start', Finish: 'Finish', kms: 180, type: 'vlak' }];
    }
    writes.push(params);
    assert.equal(params[0], date);
    return {};
  };
  const app = express();
  app.use(express.json());
  app.use('/stages', stagesRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/stages${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  try {
    for (date of ['2026-07-04', '2026-01-04', '2026-03-29', '2026-10-25']) {
      assert.equal((await (await request('?tour=1')).json())[0].datum, date);
      const stage = await (await request('/1/1')).json();
      assert.equal(stage.datum, date);
      for (const path of ['/1/1', `/rest-day/1/${date}`]) {
        assert.equal((await request(path, 'PUT', { datum: stage.datum, Start: 'Andere start' })).status, 200);
        const partial = await request(path, 'PUT', { Finish: 'Andere finish' });
        assert.equal(partial.status, 200);
        assert.equal((await partial.json()).datum, date);
      }
    }
    assert.equal(writes.length, 16);
  } finally {
    pool.query = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
