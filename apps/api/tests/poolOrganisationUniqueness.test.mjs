import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { poolsRouter } from '../src/routes/pools.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('A tour can have only one pool per organisation', async () => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/pools', poolsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let rollbacks = 0;
  const currentPool = {
    poolID: 4,
    tourID: 7,
    Naam: 'Bestaande pool',
    Org: 'Organisatie',
    orgID: 3,
    StartInschr: null,
    EindInschr: null,
    visibleToUsers: 1,
  };
  pool.query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.includes('SELECT poolID, tourID')) return [{ ...currentPool }];
    if (sql.includes('SELECT naam FROM tblOrganisaties')) return [{ naam: 'Organisatie' }];
    if (sql.includes('SELECT poolID FROM tblPools')) return [{ poolID: 5 }];
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => { rollbacks += 1; },
    release() {},
    query: async (sql, params = []) => {
      assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.includes('SELECT poolID FROM tblPools')) return [{ poolID: 5 }];
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  const request = (path, method, body) => fetch(
    `http://127.0.0.1:${server.address().port}${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  try {
    const createResponse = await request('/pools', 'POST', {
      tourID: 7,
      Naam: 'Nieuwe pool',
      orgID: 3,
    });
    assert.equal(createResponse.status, 409);
    assert.match((await createResponse.json()).message, /één pool per tour/);
    assert.equal(rollbacks, 1);

    const updateResponse = await request('/pools/4', 'PUT', { tourID: 7 });
    assert.equal(updateResponse.status, 409);
    assert.match((await updateResponse.json()).message, /één pool per tour/);
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
