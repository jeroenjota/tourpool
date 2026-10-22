import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { teamRidersRouter } from '../src/routes/teamRiders.ts';

test('Tour participation updates preserve withdrawals and roll back errors', async () => {
  const original = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/team-riders', teamRidersRouter);
  app.use((error, _request, response, _next) => response.status(500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const events = [];
  let fail = false;
  pool.getConnection = async () => ({
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql, params) => {
      if (sql.includes('SELECT tourID')) return [{ Rugnummer: 42, nietGestartEtappe: 8, neemtDeel: 1 }];
      if (sql.startsWith('UPDATE tblPloegRenners')) {
        assert.deepEqual(params, [42, 8, 0, 2, 3, 4]);
        if (fail) throw new Error('Write failed');
        return {};
      }
      if (sql.includes('SELECT poolID')) return [];
      throw new Error(`Unexpected query: ${sql}`);
    }
  });
  try {
    const update = () => fetch(`http://127.0.0.1:${server.address().port}/team-riders/2/3/4`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neemtDeel: false })
    });
    const response = await update();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.neemtDeel, 0);
    assert.equal(body.nietGestartEtappe, 8);
    assert.deepEqual(events, ['begin', 'commit', 'release']);
    events.length = 0;
    fail = true;
    assert.equal((await update()).status, 500);
    assert.deepEqual(events, ['begin', 'rollback', 'release']);
  } finally {
    pool.getConnection = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
