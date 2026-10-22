import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { apiRouter } from '../src/routes/index.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Participants and guests can read only visible pool point allocations', async () => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const allocations = [
    { prestatieID: 1, Omschrijving: 'Etappewinnaar', Punten: 30, uitslagtype: 'rit', plaats: 1, volgorde: 1 },
    { prestatieID: 2, Omschrijving: 'Tweede plaats', Punten: 0, uitslagtype: 'rit', plaats: 2, volgorde: 2 }
  ];
  let allocationsRead = 0;
  let released = 0;
  let failRead = false;
  const query = async (sql, params = []) => {
    if (sql.includes('FROM tblSessions s')) {
      return [{ accountID: 1, adrID: 1, username: 'test', role: 'user', emailVerified: true, csrfToken: 'test' }];
    }
    if (sql.includes('FROM tblPools p')) {
      assert.ok(sql.includes('p.visibleToUsers = TRUE'));
      return params[0] === 1 ? [{ poolID: 1, tourID: 1 }] : [];
    }
    if (sql.includes('FROM tblPuntenToekenning')) {
      assert.deepEqual(params, [1]);
      assert.ok(sql.includes('WHERE poolID = ?'));
      allocationsRead++;
      if (failRead) throw new Error('Test database failure');
      return allocations;
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.query = query;
  pool.getConnection = async () => ({ query, release() { released++; } });
  const app = express();
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = (prefix, id, authenticated = false, method = 'GET') => fetch(
    `http://127.0.0.1:${server.address().port}/api/${prefix}/pools/${id}/point-allocations`,
    { method, headers: authenticated ? { Cookie: `tourpool_session=${'a'.repeat(64)}` } : {} }
  );
  try {
    assert.equal((await request('me', 1)).status, 401);
    for (const prefix of ['public', 'me']) {
      const response = await request(prefix, 1, prefix === 'me');
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), allocations);
      const readCount = allocationsRead;
      for (const id of [2, 999]) {
        assert.equal((await request(prefix, id, prefix === 'me')).status, 404);
      }
      for (const id of ['invalid', 0, -1, 1.5]) {
        assert.equal((await request(prefix, id, prefix === 'me')).status, 400);
      }
      assert.equal(allocationsRead, readCount);
    }
    allocations.length = 0;
    assert.deepEqual(await (await request('public', 1)).json(), []);
    failRead = true;
    assert.equal((await request('public', 1)).status, 500);
    assert.equal(released, 8);
    assert.equal((await request('public', 1, false, 'POST')).status, 401);
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
