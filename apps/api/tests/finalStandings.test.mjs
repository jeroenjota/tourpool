import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { recalculatePoolPoints, stageResultsRouter } from '../src/routes/stageResults.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';

test('Final standings score each classification, add final prizes once, and preserve daily prizes', async () => {
  const options = {
    poolID: 1, lastStage: 21, stageCount: 21, paidParticipantCount: 6,
    inleg: 10, geldEtappeHoog: 2, geldEtappeTotaal: 0.5, geldEtappeLaagTTL: 0.1,
    PrijsNr1Percentage: 0.5, PrijsNr2Percentage: 0.35, PrijsNr3Percentage: 0.15,
    PrijsNr4Percentage: 0, PrijsNrLaatstBedrag: 10,
    PloegRennerAantal: 2, PloegReserveAantal: 0,
    AantalEtapPlaatsen: 1, AantalKlasGeel: 1,
    AantalKlasGroen: 1, AantalKlasBol: 1, AantalKlasWit: 1,
    AantalEindKlasGeel: 1, AantalEindKlasGroen: 1,
    AantalEindKlasBol: 1, AantalEindKlasWit: 1
  };
  const results = [
    { uitslagType: 'eindKlas', plaats: 1, rennerID: 10 },
    { uitslagType: 'eindKlas', plaats: 2, rennerID: 20 },
    { uitslagType: 'eindPunt', plaats: 1, rennerID: 11 },
    { uitslagType: 'eindBerg', plaats: 1, rennerID: 12 },
    { uitslagType: 'eindJon', plaats: 1, rennerID: 13 }
  ];
  const rules = [
    { uitslagtype: 'rit', plaats: 1, Punten: 10 },
    { uitslagtype: 'eindKlas', plaats: 1, Punten: 50 },
    { uitslagtype: 'eindKlas', plaats: 2, Punten: 30 },
    { uitslagtype: 'eindPunt', plaats: 1, Punten: 15 },
    { uitslagtype: 'eindBerg', plaats: 1, Punten: 15 },
    { uitslagtype: 'eindJon', plaats: 1, Punten: 15 }
  ];
  const rosters = [
    [1, 10], [1, 11], [2, 10], [2, 11], [3, 12], [3, 13],
    [4, 20], [5, 21], [6, 22]
  ].map(([deelnID, rennerID]) => ({ deelnID, rennerID }));
  const scores = new Map();
  const connection = {
    query: async (sql, params = []) => {
      assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.includes('UNION')) return [{ etappeNr: 21 }, { etappeNr: 22 }];
      if (sql.includes('FROM tblPools p')) return [options];
      if (sql.includes('SELECT uitslagType, plaats, rennerID')) {
        return params[1] === 22 ? results : [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }];
      }
      if (sql.includes('FROM tblPuntenToekenning pa')) {
        assert.match(sql, /LEFT JOIN tblStandaardPunten sp/);
        return rules;
      }
      if (sql.includes('SELECT deelnID FROM tblDeelnemers')) {
        assert.match(sql, /Betaald = 1/);
        return [1, 2, 3, 4, 5, 6].map(deelnID => ({ deelnID }));
      }
      if (sql.includes('FROM tblDeelnemRenners dr')) return rosters;
      if (sql.includes('DELETE dp FROM tblDeelnemerPunten')) {
        for (const [key, row] of scores) if (row.etappeNr === params[1]) scores.delete(key);
        return {};
      }
      if (sql.includes('INSERT INTO tblDeelnemerPunten')) {
        const [deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt] = params;
        scores.set(`${deelnemID}:${etappeNr}`, { deelnemID, etappeNr, ritPnt, geelPnt, groenPnt, bolPnt, witPnt, etapPnt });
        return {};
      }
      if (sql.includes('FROM tblDeelnemerPunten dp')) {
        const rows = [...scores.values()];
        return rows.sort(sql.includes('dp.ttlPnt')
          ? (a, b) => a.etappeNr - b.etappeNr
          : (a, b) => a.deelnemID - b.deelnemID || a.etappeNr - b.etappeNr);
      }
      if (sql.startsWith('UPDATE tblDeelnemerPunten SET ttlPnt')) {
        scores.get(`${params[1]}:${params[2]}`).ttlPnt = params[0];
        return {};
      }
      if (sql.includes('UPDATE tblDeelnemerPunten')) {
        const [etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld, id, stage] = params;
        Object.assign(scores.get(`${id}:${stage}`), { etapPlaats, etapGeld, ttlPnt, ttlPlaats, ttlGeld });
        return {};
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  try {
    await recalculatePoolPoints(connection, 1, 1);
    const first = scores.get('1:22');
    assert.equal(first.ritPnt, 50);
    assert.equal(first.groenPnt, 15);
    assert.equal(first.geelPnt, 0);
    assert.equal(first.etapPnt, 65);
    assert.equal(first.ttlPnt, 75);
    const third = scores.get('3:22');
    assert.equal(third.bolPnt, 15);
    assert.equal(third.witPnt, 15);
    assert.equal(third.etapPnt, 30);
    assert.equal(scores.get('4:22').etapPnt, 0, 'Only configured final places earn points');
    const dailyMoney = [...scores.values()].filter(row => row.etappeNr === 21).reduce((sum, row) => sum + row.etapGeld, 0);
    assert.ok(Math.abs(dailyMoney - 1.04) < 1e-9);
    // 6 * 10 - 21 * 1.04 - 4 = 34.16; tied winners share first and second prizes.
    assert.equal(first.etapGeld, (17.08 + 11.96) / 2);
    assert.equal(third.etapGeld, 5.12);
    for (const id of [4, 5, 6]) assert.equal(scores.get(`${id}:22`).etapGeld, 4 / 3);
    assert.equal(first.ttlGeld, scores.get('1:21').ttlGeld + first.etapGeld);
    const initial = structuredClone(scores);
    await recalculatePoolPoints(connection, 1, 1);
    assert.deepEqual(scores, initial, 'Recalculating never adds the final prize twice');
    options.AantalEindKlasGeel = 2;
    options.PrijsNr1Percentage = 40;
    options.PrijsNr2Percentage = 30;
    options.PrijsNr3Percentage = 20;
    options.PrijsNr4Percentage = 10;
    rosters.find(row => row.deelnID === 2 && row.rennerID === 11).rennerID = 21;
    rosters.find(row => row.deelnID === 3 && row.rennerID === 13).rennerID = 21;
    await recalculatePoolPoints(connection, 1, 1);
    assert.equal(scores.get('1:22').etapGeld, 13.66);
    assert.equal(scores.get('2:22').etapGeld, 10.25);
    assert.equal(scores.get('4:22').etapGeld, 6.83);
    assert.equal(scores.get('3:22').etapGeld, 3.42, 'Fourth prize is paid using the configured percentage');
    results.length = 0;
    await recalculatePoolPoints(connection, 1, 1);
    assert.equal([...scores.values()].filter(row => row.etappeNr === 22).length, 0, 'Clearing finals removes awards');
  } finally {
    await pool.end();
  }
});

test('Final input rejects wrong stage, duplicate riders and invalid categories before writing', async () => {
  const original = pool.getConnection;
  const events = [];
  pool.getConnection = async () => ({
    beginTransaction: async () => {},
    rollback: async () => events.push('rollback'),
    release: () => {},
    query: async (sql) => {
      assert.match(sql, /SELECT MAX\(etappeNr\)/);
      return [{ lastStage: 21 }];
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/stage-results', stageResultsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const body of [
      { tourID: 1, etappeNr: 21, results: [] },
      { tourID: 2, etappeNr: 22, results: [] },
      { tourID: 1, etappeNr: 22, results: [{ uitslagType: 'rit', plaats: 1, rennerID: 10 }] },
      { tourID: 1, etappeNr: 22, results: [1, 2].map(plaats => ({ uitslagType: 'eindKlas', plaats, rennerID: 10 })) },
      { tourID: 1, etappeNr: 22, results: [{ uitslagType: 'eindKlas', plaats: 2, rennerID: 10 }] },
      { tourID: 1, etappeNr: 22, results: [{ uitslagType: 'eindKlas', plaats: 1, rennerID: 0 }] }
    ]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/stage-results/final/1`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(response.status, 400);
    }
    assert.equal(events.length, 6);
  } finally {
    pool.getConnection = original;
    await new Promise(resolve => server.close(resolve));
  }
});

test('Saving and clearing finals use the tour-specific last stage plus one and roll back failed writes', async () => {
  const original = pool.getConnection;
  const app = express();
  app.use(express.json());
  app.use('/stage-results', stageResultsRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const scenario of ['save', 'clear', 'fail']) {
      const events = [];
      const saved = [];
      pool.getConnection = async () => ({
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release'),
        query: async (sql, params = []) => {
          if (sql.includes('SELECT MAX(etappeNr)')) return [{ lastStage: 4 }];
          assert.doesNotMatch(sql, /UPDATE tblPloegRenners/);
          if (sql.includes('DELETE FROM tblEtappeUitslag')) {
            assert.deepEqual(params, [2, 5]);
            assert.doesNotMatch(sql, /uitslagType <>/);
            events.push('delete');
            return {};
          }
          if (sql.includes('INSERT INTO tblEtappeUitslag')) {
            if (scenario === 'fail') throw new Error('Write failed');
            saved.push(params);
            return {};
          }
          if (sql.includes('FROM tblPools p') || sql.includes('FROM tblDeelnemerPunten dp')) return [];
          if (sql.includes('SELECT uitslagType, plaats, rennerID')) return [];
          throw new Error(`Unexpected query: ${sql}`);
        }
      });
      const response = await fetch(`http://127.0.0.1:${server.address().port}/stage-results/final/2`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourID: 2, etappeNr: 5,
          results: scenario === 'clear' ? [] : [{ uitslagType: 'eindKlas', plaats: 1, rennerID: 10 }]
        })
      });
      assert.equal(response.status, scenario === 'fail' ? 500 : 200);
      assert.deepEqual(events, ['begin', 'delete', scenario === 'fail' ? 'rollback' : 'commit', 'release']);
      assert.deepEqual(saved, scenario === 'save' ? [[2, 5, 'eindKlas', 1, 10]] : []);
    }
  } finally {
    pool.getConnection = original;
    await new Promise(resolve => server.close(resolve));
  }
});
