import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { pointAllocationsRouter } from '../src/routes/pointAllocations.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Point allocations support reading and editing without an uitleg column', async (t) => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/point-allocations', pointAllocationsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/point-allocations`;
  let stored = {
    prestatieID: 81,
    poolID: 1,
    Omschrijving: 'Winnaar etappe',
    Punten: 10,
    uitslagtype: 'rit',
    plaats: 1,
    volgorde: 7,
  };
  const writes = [];
  pool.query = async (sql, params = []) => {
    assert.doesNotMatch(sql, /\buitleg\b/i);
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.startsWith('SELECT')) {
      assert.match(sql, /SELECT prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde FROM tblPuntenToekenning/);
      assert.deepEqual(params, sql.includes('prestatieID = ?') ? [81, 1] : [1]);
      return [{ ...stored }];
    }
    if (sql.startsWith('UPDATE')) {
      assert.deepEqual(params.slice(-2), [81, 1]);
      const [Omschrijving, Punten, uitslagtype, plaats] = params;
      stored = { ...stored, Omschrijving, Punten, uitslagtype, plaats };
      writes.push({ sql, params });
      return {};
    }
    if (sql.startsWith('INSERT')) {
      assert.deepEqual(params, [82, 1, 'Tweede plaats etappe', 0, 'rit', 2, 8]);
      writes.push({ sql, params });
      return {};
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM tblPools WHERE')) return [{ poolID: 1, tourID: 2 }];
      if (sql.includes('UNION') || sql.includes('FROM tblDeelnemerPunten dp') || sql.includes('FROM tblPools p')) return [];
      return pool.query(sql, params);
    },
  });
  const request = (path, method, body) => fetch(`${endpoint}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  await t.test('Loading standard points replaces only the requested pool atomically', async (t) => {
    const originalGetConnection = pool.getConnection;
    const app = express();
    app.use('/point-allocations', pointAllocationsRouter);
    app.use((error, _request, response, _next) => response.status(500).json({ message: error.message }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const endpoint = `http://127.0.0.1:${server.address().port}/point-allocations/load/3`;
    try {
      for (const scenario of [
        { name: 'Copy every standard field and commit', exists: true, fail: false },
        { name: 'Roll back deletion when copying fails', exists: true, fail: true },
        { name: 'Missing pool does not delete or insert', exists: false, fail: false },
      ]) {
        await t.test(scenario.name, async () => {
          const events = [];
          pool.getConnection = async () => ({
            beginTransaction: async () => events.push('begin'),
            commit: async () => events.push('commit'),
            rollback: async () => events.push('rollback'),
            release: () => events.push('release'),
            query: async (sql, params) => {
              if (sql.includes('UNION')) {
                assert.deepEqual(params, [2, 3]);
                return [];
              }
              if (sql.includes('FROM tblDeelnemerPunten dp') || sql.includes('FROM tblPools p')) {
                assert.deepEqual(params, [2, 3]);
                return [];
              }
              if (sql.startsWith('SELECT poolID')) {
                assert.deepEqual(params, [3]);
                assert.match(sql, /FOR UPDATE/);
                return scenario.exists ? [{ poolID: 3, tourID: 2 }] : [];
              }
              if (sql.startsWith('DELETE')) {
                assert.deepEqual(params, [3]);
                assert.equal(sql, 'DELETE FROM tblPuntenToekenning WHERE poolID = ?');
                events.push('delete');
                return {};
              }
              assert.match(sql, /INSERT INTO tblPuntenToekenning\s+\(prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde\)\s+SELECT prestatieID, \?, Omschrijving, punten, uitslagtype, plaats, volgorde\s+FROM tblStandaardPunten/);
              assert.deepEqual(params, [3]);
              events.push('copy');
              if (scenario.fail) throw new Error('Copy failed');
              return {};
            },
          });
          const response = await fetch(endpoint, { method: 'PUT' });
          assert.equal(response.status, !scenario.exists ? 404 : scenario.fail ? 500 : 200);
          assert.deepEqual(events, !scenario.exists
            ? ['begin', 'rollback', 'release']
            : ['begin', 'delete', 'copy', scenario.fail ? 'rollback' : 'commit', 'release']);
          if (response.status === 200) assert.deepEqual(await response.json(), { poolID: 3, success: true });
        });
      }
    } finally {
      pool.getConnection = originalGetConnection;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  try {
    await t.test('List and detail use only supported database columns', async () => {
      const list = await fetch(`${endpoint}?poolID=1`);
      assert.equal(list.status, 200);
      assert.deepEqual(await list.json(), [stored]);
      const detail = await fetch(`${endpoint}/81/1`);
      assert.equal(detail.status, 200);
      assert.deepEqual(await detail.json(), stored);
    });
    await t.test('Updating points preserves the other fields', async () => {
      const response = await request('/81/1', 'PUT', { Punten: 15 });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ...stored, Punten: 15 });
      assert.equal(stored.Punten, 15);
      assert.equal(stored.uitslagtype, 'rit');
      assert.equal(stored.plaats, 1);
      assert.equal(stored.volgorde, 7);
      assert.equal(writes.length, 1);
    });
    await t.test('Adding a standard performance supports zero points', async () => {
      const body = {
        prestatieID: 82, poolID: 1, Omschrijving: 'Tweede plaats etappe',
        Punten: 0, uitslagtype: 'rit', plaats: 2, volgorde: 8,
      };
      const response = await request('', 'POST', body);
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), body);
      assert.equal(writes.length, 2);
    });
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
