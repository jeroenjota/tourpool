import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { stagesRouter } from '../src/routes/stages.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Stage deletion guards results and points; rest days use date and null stage number', async () => {
  const original = pool.query;
  let affectedRows = 1;
  let exists = true;
  pool.query = async (sql, params) => {
    if (sql.startsWith('SELECT')) return exists ? [{ etappeNr: 1 }] : [];
    if (sql.includes('etappeNr IS NULL')) {
      assert.deepEqual(params, ['1', '2026-07-13']);
    } else {
      assert.match(sql, /NOT EXISTS.*tblEtappeUitslag/);
      assert.match(sql, /tblDeelnemerPunten/);
      assert.match(sql, /d.deelnID = dp.deelnemID/);
      assert.deepEqual(params, ['1', 1, '1', 1, '1', 1]);
    }
    return { affectedRows };
  };
  const app = express();
  app.use('/stages', stagesRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const remove = path => fetch(`http://127.0.0.1:${server.address().port}/stages/${path}`, { method: 'DELETE' });
  try {
    assert.equal((await remove('1/1')).status, 204);
    affectedRows = 0;
    const blocked = await remove('1/1');
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).message, /uitslagen of punten/);
    exists = false;
    assert.equal((await remove('1/1')).status, 404);
    affectedRows = 1;
    assert.equal((await remove('rest-day/1/2026-07-13')).status, 204);
    affectedRows = 0;
    assert.equal((await remove('rest-day/1/2026-07-13')).status, 404);
    assert.equal((await remove('rest-day/1/invalid')).status, 400);
  } finally {
    pool.query = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
