import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { poolsRouter } from '../src/routes/pools.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Admin pool visibility persists on creation, reload and partial updates', async () => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  let stored = {
    poolID: 1, tourID: 1, Naam: 'Testpool', Org: 'Jota',
    StartInschr: null, EindInschr: null, visibleToUsers: 1
  };
  const query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.includes('SELECT poolID, tourID')) {
      assert.ok(sql.includes('visibleToUsers'));
      return [{ ...stored }];
    }
    if (sql.includes('p.visibleToUsers')) return [{ ...stored }];
    if (sql.includes('UPDATE tblPools SET')) {
      const columns = [...sql.matchAll(/(\w+) = \?/g)].map(match => match[1]);
      for (const [index, column] of columns.entries()) {
        if (column !== 'poolID') stored[column] = params[index];
      }
      return {};
    }
    if (sql.includes('SELECT') && sql.includes('FROM tblOpties')) return [];
    if (sql.includes('INSERT INTO tblPools')) {
      const columns = sql.match(/INSERT INTO tblPools \(([^)]+)\)/)[1].split(',').map(column => column.trim());
      stored = { poolID: 1, ...Object.fromEntries(columns.map((column, index) => [column, params[index]])) };
      return { insertId: 1 };
    }
    if (sql.includes('INSERT INTO tblOpties') || sql.includes('INSERT INTO tblPuntenToekenning')) return {};
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.query = query;
  pool.getConnection = async () => ({
    query, beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => {}, release() {}
  });
  const app = express();
  app.use(express.json());
  app.use('/pools', poolsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  try {
    const hidden = await request('/pools/1', 'PUT', { visibleToUsers: false });
    assert.equal(hidden.status, 200);
    assert.equal((await hidden.json()).visibleToUsers, false);
    assert.equal((await (await request('/pools/1')).json()).visibleToUsers, false);
    assert.equal((await (await request('/pools')).json())[0].visibleToUsers, false);
    stored.visibleToUsers = 0;
    assert.equal((await request('/pools/1', 'PUT', { Naam: 'Nieuwe naam' })).status, 200);
    assert.equal(stored.visibleToUsers, false);
    assert.equal((await request('/pools/1', 'PUT', { visibleToUsers: true })).status, 200);
    assert.equal(stored.visibleToUsers, true);
    stored.visibleToUsers = 1;
    assert.equal((await request('/pools/1', 'PUT', { Org: 'Nieuwe organisator' })).status, 200);
    assert.equal(stored.visibleToUsers, true);
    for (const invalid of ['false', 0, null]) {
      assert.equal((await request('/pools/1', 'PUT', { visibleToUsers: invalid })).status, 400);
    }
    const defaultPool = await request('/pools', 'POST', { tourID: 1, Naam: 'Standaard' });
    assert.equal(defaultPool.status, 201);
    assert.equal((await defaultPool.json()).visibleToUsers, true);
    assert.equal(stored.visibleToUsers, true);
    const newHiddenPool = await request('/pools', 'POST', { tourID: 1, Naam: 'Concept', visibleToUsers: false });
    assert.equal(newHiddenPool.status, 201);
    assert.equal((await newHiddenPool.json()).visibleToUsers, false);
    assert.equal(stored.visibleToUsers, false);
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
