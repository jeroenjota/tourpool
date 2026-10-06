import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { pointAllocationsRouter } from '../src/routes/pointAllocations.ts';

test('Allocation mutations recalculate existing stages only for their pool atomically', async (t) => {
  const originalGetConnection = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/point-allocations', pointAllocationsRouter);
  app.use((error, _request, response, _next) => response.status(500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/point-allocations`;
  try {
    for (const scenario of [
      { name: 'Changed points', method: 'PUT', path: '/81/3', body: { Punten: 25 }, expected: 25 },
      { name: 'Deleted rule no longer earns standard points', method: 'DELETE', path: '/81/3', expected: 0 },
      {
        name: 'Added rule',
        method: 'POST', path: '',
        body: { prestatieID: 81, poolID: 3, uitslagtype: 'rit', plaats: 1, Punten: 15 },
        expected: 15, initiallyMissing: true,
      },
      { name: 'Reloaded standard rules', method: 'PUT', path: '/load/3', expected: 10 },
      { name: 'Scoring failure rolls back rule and scores', method: 'PUT', path: '/81/3', body: { Punten: 25 }, fail: true },
      { name: 'Missing allocation remains a 404', method: 'PUT', path: '/81/3', body: { Punten: 25 }, initiallyMissing: true, missing: true },
    ]) {
      await t.test(scenario.name, async () => {
        let allocation = scenario.initiallyMissing ? null : {
          prestatieID: 81, poolID: 3, uitslagtype: 'rit', plaats: 1, Punten: 7,
          Omschrijving: 'Winnaar etappe', volgorde: 1,
        };
        const scores = new Map([
          [1, { deelnemID: 4, etappeNr: 1, etapPnt: 7, ttlPnt: 7 }],
          [2, { deelnemID: 4, etappeNr: 2, etapPnt: 7, ttlPnt: 14 }],
          [3, { deelnemID: 4, etappeNr: 3, etapPnt: 0, ttlPnt: 14 }],
        ]);
        const beforeAllocation = structuredClone(allocation);
        const beforeScores = structuredClone(scores);
        const events = [];
        const prizeUpdates = [];
        pool.getConnection = async () => ({
          beginTransaction: async () => events.push('begin'),
          commit: async () => events.push('commit'),
          rollback: async () => {
            events.push('rollback');
            allocation = beforeAllocation;
            scores.clear();
            beforeScores.forEach((value, key) => scores.set(key, value));
          },
          release: () => events.push('release'),
          query: async (sql, params = []) => {
            assert.equal((sql.match(/\?/g) ?? []).length, params.length);
            if (sql.includes('FROM tblPools WHERE')) {
              assert.deepEqual(params, [3]);
              assert.match(sql, /FOR UPDATE/);
              return [{ poolID: 3, tourID: 2 }];
            }
            if (sql.startsWith('SELECT prestatieID')) return allocation ? [allocation] : [];
            if (sql.startsWith('SELECT uitslagtype, plaats')) return allocation ? [allocation] : [];
            if (sql.startsWith('SELECT plaats FROM tblPuntenToekenning')) {
              assert.deepEqual(params, [3, 'rit']);
              return allocation ? [{ plaats: allocation.plaats }] : [];
            }
            if (sql.startsWith('UPDATE tblPuntenToekenning')) {
              assert.deepEqual(params.slice(-2), [81, 3]);
              allocation = { ...allocation, Punten: params[1] };
              return {};
            }
            if (sql.startsWith('DELETE FROM tblPuntenToekenning')) {
              assert.deepEqual(params, scenario.path === '/load/3' ? [3] : [81, 3]);
              allocation = null;
              return {};
            }
            if (sql.startsWith('INSERT INTO tblPuntenToekenning')) {
              allocation = { prestatieID: 81, poolID: 3, uitslagtype: 'rit', plaats: 1, Punten: scenario.expected };
              return {};
            }
            if (sql.includes('UNION')) {
              assert.deepEqual(params, [2, 3]);
              assert.match(sql, /WHERE d.poolID = \?/);
              return [1, 2, 3].map(etappeNr => ({ etappeNr }));
            }
            if (sql.includes('FROM tblPools p')) {
              assert.deepEqual(params, [2, 3]);
              assert.match(sql, /AND p.poolID = \?/);
              return [{
                poolID: 3, PloegRennerAantal: 1, PloegReserveAantal: 0,
                AantalEtapPlaatsen: 1, AantalKlasGeel: 0, AantalKlasGroen: 0,
                AantalKlasBol: 0, AantalKlasWit: 0,
                geldEtappeHoog: 1, geldEtappeTotaal: 2, geldEtappeLaagTTL: 0,
              }];
            }
            if (sql.includes('SELECT uitslagType, plaats, rennerID')) {
              assert.equal(params[0], 2);
              return params[1] === 3 ? [] : [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }];
            }
            if (sql.includes('FROM tblStandaardPunten sp')) {
              assert.deepEqual(params, [3]);
              assert.match(sql, /INNER JOIN tblPuntenToekenning pa/);
              assert.doesNotMatch(sql, /COALESCE\(pa.Punten, sp.punten/);
              return allocation ? [allocation] : [];
            }
            if (sql.includes('SELECT deelnID FROM tblDeelnemers')) {
              assert.deepEqual(params, [3]);
              return [{ deelnID: 4 }];
            }
            if (sql.includes('FROM tblDeelnemRenners dr')) {
              assert.equal(params[0], 3);
              return [{ deelnID: 4, rennerID: 10 }];
            }
            if (sql.includes('DELETE dp FROM tblDeelnemerPunten')) {
              assert.equal(params[0], 3);
              scores.delete(params[1]);
              return {};
            }
            if (sql.includes('INSERT INTO tblDeelnemerPunten')) {
              if (scenario.fail && params[1] === 2) throw new Error('Recalculation failed');
              const [deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt] = params;
              assert.equal(deelnemID, 4);
              assert.deepEqual([ritPnt, geelPnt, groenPnt, bolPnt, witPnt], [etapPnt, 0, 0, 0, 0]);
              scores.set(etappeNr, { deelnemID, etappeNr, etapPnt });
              return {};
            }
            if (sql.includes('FROM tblDeelnemerPunten dp')) {
              assert.deepEqual(params, sql.includes('dp.ttlPnt') ? [3] : [2, 3]);
              return [...scores.values()];
            }
            if (sql.startsWith('UPDATE tblDeelnemerPunten SET ttlPnt')) {
              const [ttlPnt, deelnemID, etappeNr] = params;
              assert.equal(deelnemID, 4);
              scores.get(etappeNr).ttlPnt = ttlPnt;
              return {};
            }
            if (sql.includes('UPDATE tblDeelnemerPunten')) {
              prizeUpdates.push(params);
              return {};
            }
            throw new Error(`Unexpected query: ${sql}`);
          },
        });
        const response = await fetch(`${endpoint}${scenario.path}`, {
          method: scenario.method,
          headers: { 'Content-Type': 'application/json' },
          ...(scenario.body ? { body: JSON.stringify(scenario.body) } : {}),
        });
        assert.equal(response.status, scenario.fail ? 500 : scenario.missing ? 404 : scenario.method === 'DELETE' ? 204 : scenario.method === 'POST' ? 201 : 200);
        if (scenario.fail || scenario.missing) {
          assert.deepEqual(events, ['begin', 'rollback', 'release']);
          assert.deepEqual(allocation, beforeAllocation);
          assert.deepEqual(scores, beforeScores);
        } else {
          assert.deepEqual(events, ['begin', 'commit', 'release']);
          assert.deepEqual([...scores.values()].map(row => [row.etapPnt, row.ttlPnt]), [
            [scenario.expected, scenario.expected],
            [scenario.expected, scenario.expected * 2],
            [0, scenario.expected * 2],
          ]);
          assert.deepEqual(prizeUpdates, scenario.expected ? [
            [1, 3, scenario.expected, 1, 3, 4, 1],
            [1, 3, scenario.expected * 2, 1, 6, 4, 2],
            [1, 2, scenario.expected * 2, 1, 8, 4, 3],
          ] : [
            [1, 0, 0, 1, 0, 4, 1],
            [1, 0, 0, 1, 0, 4, 2],
            [1, 0, 0, 1, 0, 4, 3],
          ]);
        }
      });
    }
  } finally {
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
