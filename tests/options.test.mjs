import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { optionsRouter } from '../src/routes/options.ts';
import { poolsRouter } from '../src/routes/pools.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

const prizes = {
  geldEtappeHoog: 2.50,
  geldEtappeTotaal: 1.00,
  geldEtappeLaagTTL: 0.10,
};

test('Options persist the new stage prizes', async (t) => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/options', optionsRouter);
  app.use('/pools', poolsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let stored = {
    poolID: 1, inleg: 10, PloegRennerAantal: 15, PloegReserveAantal: 5,
    AantalEtapPlaatsen: 7, AantalKlasGeel: 1, AantalKlasGroen: 1,
    AantalKlasBol: 1, AantalKlasWit: 0, AantalEindKlasGeel: 3,
    AantalEindKlasGroen: 1, AantalEindKlasBol: 1, AantalEindKlasWit: 1,
    ...prizes, PrijsNr1Percentage: 0.5, PrijsNr2Percentage: 0.35,
    PrijsNr3Percentage: 0.15, PrijsNr4Percentage: 0, PrijsNrLaatstBedrag: 10,
  };
  const writes = [];
  pool.query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.includes('SELECT * FROM tblOpties')) return [{ ...stored }];
    if (sql.includes('UPDATE tblOpties')) {
      const columns = [...sql.matchAll(/(\w+) = \?/g)].map((match) => match[1]);
      for (const [index, column] of columns.entries()) {
        if (column !== 'poolID') stored[column] = params[index];
      }
      writes.push({ sql, params });
      return {};
    }
    if (sql.includes('INSERT INTO tblOpties')) {
      writes.push({ sql, params });
      return {};
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const request = (path, method, body) => fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const assertInsertedPrizes = (write, expected) => {
    const columns = write.sql.match(/INSERT INTO tblOpties \(([\s\S]*?)\)/)[1]
      .split(',').map((column) => column.trim());
    assert.equal(columns.length, write.params.length);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(write.params[columns.indexOf(key)], value);
    }
  };

  try {
    await t.test('Update and reload retain cents and zero amounts', async () => {
      const updatedPrizes = { geldEtappeHoog: 99.99, geldEtappeTotaal: 0, geldEtappeLaagTTL: 0.01 };
      const response = await request('/options/1', 'PUT', updatedPrizes);
      assert.equal(response.status, 200);
      const body = await response.json();
      for (const [key, value] of Object.entries(updatedPrizes)) assert.equal(body[key], value);
      const reloaded = await (await fetch(`${base}/options/1`)).json();
      assert.deepEqual(reloaded, stored);
      assert.equal(reloaded.PrijsNr1Percentage, 0.5);
      const partial = await request('/options/1', 'PUT', { inleg: 12 });
      assert.equal(partial.status, 200);
      for (const [key, value] of Object.entries(updatedPrizes)) assert.equal(stored[key], value);
    });
    await t.test('Create accepts all three fields and defaults omitted amounts to zero', async () => {
      assert.equal((await request('/options', 'POST', { poolID: 2, ...prizes })).status, 201);
      assertInsertedPrizes(writes.at(-1), prizes);
      assert.equal((await request('/options', 'POST', { poolID: 3 })).status, 201);
      assertInsertedPrizes(writes.at(-1), {
        geldEtappeHoog: 0, geldEtappeTotaal: 0, geldEtappeLaagTTL: 0,
      });
    });
    await t.test('Rider count accepts 25 and rejects larger or fractional counts', async () => {
      assert.equal((await request('/options/1', 'PUT', { PloegRennerAantal: 25 })).status, 200);
      assert.equal(stored.PloegRennerAantal, 25);
      const count = writes.length;
      for (const value of [26, 25.5]) {
        assert.equal((await request('/options/1', 'PUT', { PloegRennerAantal: value })).status, 400);
        assert.equal((await request('/options', 'POST', { poolID: 2, PloegRennerAantal: value })).status, 400);
      }
      assert.equal(writes.length, count);
    });
    await t.test('Invalid amounts are rejected without database writes', async () => {
      const count = writes.length;
      for (const key of Object.keys(prizes)) {
        for (const value of [-0.01, 100, 1.001, '2.50', '']) {
          assert.equal((await request('/options/1', 'PUT', { [key]: value })).status, 400);
        }
      }
      assert.equal(writes.length, count);
    });
    await t.test('New pools copy options and seed standard points', async () => {
      const events = [];
      let inserted;
      let pointSeedQuery;
      pool.getConnection = async () => ({
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release'),
        query: async (sql, params = []) => {
          assert.equal((sql.match(/\?/g) ?? []).length, params.length);
          if (sql.includes('FROM tblOpties o')) {
            for (const key of Object.keys(prizes)) assert.ok(sql.includes(`o.${key}`));
            return [stored];
          }
          if (sql.includes('INSERT INTO tblPools')) return { insertId: 4 };
          if (sql.includes('INSERT INTO tblPuntenToekenning')) {
            pointSeedQuery = sql;
            assert.deepEqual(params, [4]);
            events.push('seed-points');
            return {};
          }
          if (sql.includes('INSERT INTO tblOpties')) {
            inserted = { sql, params };
            return {};
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      });
      assert.equal((await request('/pools', 'POST', { tourID: 1, Naam: 'Test' })).status, 201);
      assertInsertedPrizes(inserted, Object.fromEntries(
        Object.keys(prizes).map((key) => [key, stored[key]]),
      ));
      assert.match(pointSeedQuery, /SELECT prestatieID, \?, Omschrijving, punten, uitslagtype, plaats, volgorde\s+FROM tblStandaardPunten/);
      assert.deepEqual(events, ['begin', 'seed-points', 'commit', 'release']);
    });
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
