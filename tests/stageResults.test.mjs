import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { stageResultsRouter } from '../src/routes/stageResults.ts';

test('Saving stage results calculates category points and rolls back on failure', async (t) => {
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/stage-results', stageResultsRouter);
  app.use((error, _request, response, _next) => {
    response.status(500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/stage-results/batch`;

  try {
    for (const scenario of [
      { name: 'Individual stage', includeRit: true, fail: false },
      { name: 'Tied winners retain full prize shares', includeRit: true, fail: false, tie: true },
      {
        name: 'Fractional prize shares are stored without cent rounding',
        includeRit: true,
        fail: false,
        tie: true,
        prizes: { daily: 1.01, total: 0, lowest: 0 },
        expectedTieMoney: 0.505,
      },
      { name: 'Non-starters are excluded from stage points', includeRit: true, fail: false, nonStarter: true },
      { name: 'Pool-specific result category and place are used', includeRit: true, fail: false, poolOverride: true },
      { name: 'TTT with only jersey classifications', includeRit: false, fail: false },
      { name: 'Database error', includeRit: false, fail: true },
    ]) {
      await t.test(scenario.name, async () => {
        const results = ['geel', 'groen', 'bol', 'wit'].map((uitslagType) => ({
          uitslagType,
          plaats: scenario.poolOverride && uitslagType === 'geel' ? 2 : 1,
          rennerID: 10,
        }));
        if (scenario.includeRit) {
          results.push({ uitslagType: 'rit', plaats: 1, rennerID: 10 });
        }
        const events = [];
        const pointInserts = [];
        const savedResults = [];
        const totalUpdates = [];
        const prizeUpdates = [];
        const nonStarterUpdates = [];
        pool.getConnection = async () => ({
          beginTransaction: async () => events.push('begin'),
          commit: async () => events.push('commit'),
          rollback: async () => events.push('rollback'),
          release: () => events.push('release'),
          query: async (sql, params = []) => {
            assert.equal((sql.match(/\?/g) ?? []).length, params.length);
            if (sql.includes('FROM tblPools p')) {
              assert.deepEqual(params, [2]);
              return [{
                poolID: 3,
                PloegRennerAantal: 15,
                PloegReserveAantal: 5,
                AantalEtapPlaatsen: 7,
                AantalKlasGeel: 3,
                AantalKlasGroen: 3,
                AantalKlasBol: 3,
                AantalKlasWit: 1,
                geldEtappeHoog: scenario.prizes?.daily ?? 1.01,
                geldEtappeTotaal: scenario.prizes?.total ?? 2.05,
                geldEtappeLaagTTL: scenario.prizes?.lowest ?? 0.50,
              }];
            }
            if (sql.includes('SELECT uitslagType, plaats, rennerID')) return results;
            if (sql.includes('FROM tblStandaardPunten sp')) {
              assert.deepEqual(params, [3]);
              assert.match(sql, /sp\.uitslagtype/);
              assert.match(sql, /sp\.plaats/);
              assert.match(sql, /COALESCE\(pa\.uitslagtype, sp\.uitslagtype\)/);
              assert.match(sql, /COALESCE\(pa\.plaats, sp\.plaats\)/);
              assert.match(sql, /COALESCE\(pa\.Punten, 0\)/);
              assert.match(sql, /INNER JOIN tblPuntenToekenning pa/);
              assert.match(sql, /COALESCE\(pa\.uitslagtype, sp\.uitslagtype\)\s+IN \('rit', 'klasGeel', 'klasGroen', 'klasBol', 'klasWit'\)/);
              assert.doesNotMatch(sql, /Omschrijving LIKE/);
              return [
                { uitslagtype: 'rit', plaats: 1, Punten: 10 },
                { uitslagtype: 'klasGeel', plaats: scenario.poolOverride ? 2 : 1, Punten: scenario.poolOverride ? 12 : 8 },
                { uitslagtype: 'klasGroen', plaats: 1, Punten: 3 },
                { uitslagtype: 'klasBol', plaats: 1, Punten: 3 },
                { uitslagtype: 'klasWit', plaats: 1, Punten: 3 },
              ];
            }
            if (sql.includes('SELECT deelnID FROM tblDeelnemers')) {
              return [{ deelnID: 4 }, { deelnID: 5 }];
            }
            if (sql.includes('FROM tblDeelnemRenners dr')) {
              assert.deepEqual(params, [3, 10, 1]);
              if (scenario.nonStarter) return [];
              return scenario.tie
                ? [{ deelnID: 4, rennerID: 10 }, { deelnID: 5, rennerID: 10 }]
                : [{ deelnID: 4, rennerID: 10 }];
            }
            if (sql.includes('SELECT ploegID, rennerID')) {
              return [{ ploegID: 8, rennerID: 10 }];
            }
            if (sql.includes('UPDATE tblPloegRenners')) {
              nonStarterUpdates.push(params);
              return {};
            }
            if (sql.includes('INSERT INTO tblEtappeUitslag')) {
              savedResults.push(params);
              return {};
            }
            if (sql.includes('INSERT INTO tblDeelnemerPunten')) {
              if (scenario.fail) throw new Error('Point insert failed');
              pointInserts.push(params);
              return {};
            }
            if (sql.includes('FROM tblDeelnemerPunten dp')) {
              const rows = pointInserts.map(([deelnemID, etappeNr, , , , , , etapPnt]) => ({
                deelnemID,
                etappeNr,
                etapPnt
              }));
              if (sql.includes('dp.ttlPnt')) {
                const totals = new Map(totalUpdates.map(([ttlPnt, deelnemID]) => [deelnemID, ttlPnt]));
                return rows.map(row => ({ ...row, ttlPnt: totals.get(row.deelnemID) ?? 0 }));
              }
              return rows;
            }
            if (sql.includes('UPDATE tblDeelnemerPunten SET ttlPnt')) {
              totalUpdates.push(params);
              return {};
            }
            if (sql.includes('UPDATE tblDeelnemerPunten')) {
              prizeUpdates.push(params);
              return {};
            }
            if (sql.includes('DELETE')) return {};
            throw new Error(`Unexpected query: ${sql}`);
          },
        });

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tourID: 2,
            etappeNr: 1,
            results,
            ...(scenario.nonStarter ? { nietGestartRenners: [10] } : {}),
          }),
        });
        const body = await response.json();
        if (scenario.fail) {
          assert.equal(response.status, 500);
          assert.deepEqual(body, { message: 'Point insert failed' });
          assert.deepEqual(events, ['begin', 'rollback', 'release']);
        } else {
          assert.equal(response.status, 200);
          assert.deepEqual(body, { tourID: 2, etappeNr: 1, count: results.length });
          assert.deepEqual(savedResults, results.map((result) => [
            2, 1, result.uitslagType, result.plaats, result.rennerID,
          ]));
          const participantPoints = scenario.nonStarter ? 0 : scenario.poolOverride ? 31 : scenario.includeRit ? 27 : 17;
          const riderPoints = !scenario.nonStarter;
          assert.deepEqual(pointInserts, [
            [4, 1, scenario.includeRit && riderPoints ? 10 : 0, riderPoints ? (scenario.poolOverride ? 12 : 8) : 0, riderPoints ? 3 : 0, riderPoints ? 3 : 0, riderPoints ? 3 : 0, participantPoints],
            [5, 1, scenario.tie && scenario.includeRit ? 10 : 0, scenario.tie ? 8 : 0, scenario.tie ? 3 : 0, scenario.tie ? 3 : 0, scenario.tie ? 3 : 0, scenario.tie ? participantPoints : 0],
          ]);
          assert.deepEqual(totalUpdates, [
            [participantPoints, 4, 1],
            [scenario.tie ? participantPoints : 0, 5, 1],
          ]);
          if (scenario.nonStarter) {
            assert.deepEqual(nonStarterUpdates, [[2, 1], [1, 2, 10, 1]]);
          } else {
            assert.deepEqual(nonStarterUpdates, [[2, 1]]);
          }
          const expectedPrizeUpdates = scenario.nonStarter
            ? [
                [1, 0, 0, 1, 0, 4, 1],
                [1, 0, 0, 1, 0, 5, 1],
              ]
            : scenario.tie
            ? [
                [1, scenario.expectedTieMoney ?? 1.78, participantPoints, 1, scenario.expectedTieMoney ?? 1.78, 4, 1],
                [1, scenario.expectedTieMoney ?? 1.78, participantPoints, 1, scenario.expectedTieMoney ?? 1.78, 5, 1],
              ]
            : [
                [1, 3.06, participantPoints, 1, 3.06, 4, 1],
                [2, 0.50, 0, 2, 0.50, 5, 1],
              ];
          assert.equal(prizeUpdates.length, expectedPrizeUpdates.length);
          prizeUpdates.forEach((actual, index) => {
            const expected = expectedPrizeUpdates[index];
            assert.deepEqual(
              actual.filter((_, parameterIndex) => parameterIndex !== 1 && parameterIndex !== 4),
              expected.filter((_, parameterIndex) => parameterIndex !== 1 && parameterIndex !== 4)
            );
            assert.ok(Math.abs(actual[1] - expected[1]) < 1e-12);
            assert.ok(Math.abs(actual[4] - expected[4]) < 1e-12);
          });
          assert.deepEqual(events, ['begin', 'commit', 'release']);
        }
      });

    }
  } finally {
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});

test('Changing an individual stage result recalculates participant points', async (t) => {
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/stage-results', stageResultsRouter);
  app.use((error, _request, response, _next) => {
    response.status(500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/stage-results`;

  try {
    for (const scenario of [
      { name: 'Create result', method: 'POST', path: '', body: { tourID: 2, etappeNr: 1, uitslagType: 'rit', plaats: 1, rennerID: 10 }, expectedPoints: 10 },
      { name: 'Update result', method: 'PUT', path: '/2/1/rit/1', body: { rennerID: 10 }, expectedPoints: 10 },
      { name: 'Delete result', method: 'DELETE', path: '/2/1/rit/1', expectedPoints: 0 },
    ]) {
      await t.test(scenario.name, async () => {
        const events = [];
        const pointInserts = [];
        const totalUpdates = [];
        const prizeUpdates = [];
        pool.getConnection = async () => ({
          beginTransaction: async () => events.push('begin'),
          commit: async () => events.push('commit'),
          rollback: async () => events.push('rollback'),
          release: () => events.push('release'),
          query: async (sql, params = []) => {
            assert.equal((sql.match(/\?/g) ?? []).length, params.length);
            if (sql.includes('FROM tblPools p')) {
              return [{
                poolID: 3,
                PloegRennerAantal: 15,
                PloegReserveAantal: 5,
                AantalEtapPlaatsen: 7,
                AantalKlasGeel: 3,
                AantalKlasGroen: 3,
                AantalKlasBol: 3,
                AantalKlasWit: 1,
                geldEtappeHoog: 0.45,
                geldEtappeTotaal: 0.75,
                geldEtappeLaagTTL: 0.25,
              }];
            }
            if (sql.includes('SELECT uitslagType, plaats, rennerID')) {
              return scenario.method === 'DELETE'
                ? []
                : [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }];
            }
            if (sql.includes('FROM tblStandaardPunten sp')) {
              return [{ uitslagtype: 'rit', plaats: 1, Punten: 10 }];
            }
            if (sql.includes('SELECT deelnID FROM tblDeelnemers')) return [{ deelnID: 4 }];
            if (sql.includes('FROM tblDeelnemRenners dr')) return [{ deelnID: 4, rennerID: 10 }];
            if (sql.includes('SELECT tourID, etappeNr, uitslagType, plaats, rennerID FROM tblEtappeUitslag')) {
              return [{ tourID: 2, etappeNr: 1, uitslagType: 'rit', plaats: 1, rennerID: 9 }];
            }
            if (sql.includes('INSERT INTO tblDeelnemerPunten')) {
              pointInserts.push(params);
              return {};
            }
            if (sql.includes('FROM tblDeelnemerPunten dp')) {
              const rows = pointInserts.map(([deelnemID, etappeNr, , , , , , etapPnt]) => ({
                deelnemID,
                etappeNr,
                etapPnt
              }));
              if (sql.includes('dp.ttlPnt')) {
                const totals = new Map(totalUpdates.map(([ttlPnt, deelnemID]) => [deelnemID, ttlPnt]));
                return rows.map(row => ({ ...row, ttlPnt: totals.get(row.deelnemID) ?? 0 }));
              }
              return rows;
            }
            if (sql.includes('UPDATE tblDeelnemerPunten SET ttlPnt')) {
              totalUpdates.push(params);
              return {};
            }
            if (sql.includes('UPDATE tblDeelnemerPunten')) {
              prizeUpdates.push(params);
              return {};
            }
            return {};
          },
        });

        const response = await fetch(`${endpoint}${scenario.path}`, {
          method: scenario.method,
          headers: { 'Content-Type': 'application/json' },
          ...(scenario.body ? { body: JSON.stringify(scenario.body) } : {}),
        });

        assert.equal(response.status, scenario.method === 'POST' ? 201 : scenario.method === 'PUT' ? 200 : 204);
        assert.deepEqual(pointInserts, [[4, 1, scenario.expectedPoints, 0, 0, 0, 0, scenario.expectedPoints]]);
        assert.deepEqual(prizeUpdates, [[1, scenario.expectedPoints > 0 ? 1.45 : 0, scenario.expectedPoints, 1, scenario.expectedPoints > 0 ? 1.45 : 0, 4, 1]]);
        assert.deepEqual(events, ['begin', 'commit', 'release']);
      });
    }
  } finally {
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('TTL points add the current stage points to the previous total', async (t) => {
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/stage-results', stageResultsRouter);
  app.use((error, _request, response, _next) => {
    response.status(500).json({ message: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const totalUpdates = [];
  const prizeUpdates = [];

  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.includes('FROM tblPools p')) {
        return [{
          poolID: 3,
          PloegRennerAantal: 15,
          PloegReserveAantal: 5,
          AantalEtapPlaatsen: 7,
          AantalKlasGeel: 3,
          AantalKlasGroen: 3,
          AantalKlasBol: 3,
          AantalKlasWit: 1,
          geldEtappeHoog: 1,
          geldEtappeTotaal: 1,
          geldEtappeLaagTTL: 1,
        }];
      }
      if (sql.includes('SELECT uitslagType, plaats, rennerID')) {
        return [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }];
      }
      if (sql.includes('FROM tblStandaardPunten sp')) {
        return [{ uitslagtype: 'rit', plaats: 1, Punten: 7 }];
      }
      if (sql.includes('SELECT deelnID FROM tblDeelnemers')) return [{ deelnID: 4 }];
      if (sql.includes('FROM tblDeelnemRenners dr')) return [{ deelnID: 4, rennerID: 10 }];
      if (sql.includes('INSERT INTO tblDeelnemerPunten')) return {};
      if (sql.includes('FROM tblDeelnemerPunten dp') && sql.includes('dp.ttlPnt')) {
        return [
          { deelnemID: 4, etappeNr: 1, etapPnt: 12, ttlPnt: 12 },
          { deelnemID: 4, etappeNr: 2, etapPnt: 7, ttlPnt: 19 },
        ];
      }
      if (sql.includes('FROM tblDeelnemerPunten dp')) {
        return [
          { deelnemID: 4, etappeNr: 1, etapPnt: 12 },
          { deelnemID: 4, etappeNr: 2, etapPnt: 7 },
        ];
      }
      if (sql.includes('UPDATE tblDeelnemerPunten SET ttlPnt')) {
        totalUpdates.push(params);
        return {};
      }
      if (sql.includes('UPDATE tblDeelnemerPunten')) {
        prizeUpdates.push(params);
        return {};
      }
      return {};
    },
  });

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/stage-results/batch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tourID: 2,
        etappeNr: 2,
        results: [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }],
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(totalUpdates, [[12, 4, 1], [19, 4, 2]]);
    assert.deepEqual(prizeUpdates.map(params => [params[2], params[5], params[6]]), [
      [12, 4, 1],
      [19, 4, 2],
    ]);
  } finally {
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
