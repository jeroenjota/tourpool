import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/db.ts';
import { addMissingUciRiders, loadUciTeams, syncUciTeams } from '../src/uciTeams.ts';
import { selectRankedTeams } from '../src/uciRanking.ts';

test('Official UCI synchronization', async t => {
  const originalFetch = globalThis.fetch;
  const originalConnection = pool.getConnection;
  const wtt = { teamName: 'TEAM NEW NAME', teamCode: 'ABC', countryCode: 'NED', categoryName: 'WTT', url: '/team-details/1' };
  const prt = { teamName: 'PRO TEAM', teamCode: 'PRO', countryCode: 'BEL', categoryName: 'PRT', url: '/team-details/2' };
  const worldTeams = Array.from({ length: 18 }, (_, index) => ({
    ...wtt, teamCode: index === 0 ? 'ABC' : `W${String(index).padStart(2, '0')}`,
    teamName: index === 0 ? wtt.teamName : `World ${index}`, url: `/team-details/${index + 1}`
  }));
  const proTeams = Array.from({ length: 6 }, (_, index) => ({
    ...prt, teamCode: `P${String(index).padStart(2, '0')}`, teamName: `Pro ${index}`,
    url: `/team-details/${index + 19}`
  }));
  const allTeams = [...worldTeams, ...proTeams];
  const metadata = { teams: { filters: [{ queryParam: 'year', items: [{ code: '2026', selected: true }] }] } };
  const events = [];
  const writes = [];
  let duplicate = false;
  let fail = false;
  let invalid = false;
  let alreadyImported = false;
  globalThis.fetch = async url => {
    if (url.includes('GetDisciplineSeasons')) return Response.json([{ Id: 464, Year: 2026 }]);
    if (url.includes('RankingsDiscipline')) return Response.json([{ Rankings: [
      { Id: 238, MomentId: 123, CategoryId: 22, RankingTypeId: 2 }
    ] }]);
    if (url.includes('ObjectRankings')) return Response.json({
      total: allTeams.length,
      data: allTeams.map((team, index) => ({ TeamCode: team.teamCode, Rank: index + 1, ComputationDate: '/Date(1792274400000)/' }))
    });
    if (url.includes('/team-details/')) {
      const id = Number(url.split('/').at(-1));
      const team = allTeams[id - 1];
      const details = {
        details: { teamCode: team.teamCode },
        riders: { panels: [
          { label: 'Riders', riders: [{ givenName: 'Test', familyName: `RIDER ${id}`, countryCode: 'NED', url: `/rider-details/${id}` }] },
          { label: 'Neo', riders: [{ givenName: 'Test', familyName: `RIDER ${id}`, countryCode: 'NED', url: `/rider-details/${id}` }] },
          { label: 'Management', riders: [{ givenName: 'Not', familyName: 'A RIDER' }] }
        ] }
      };
      return new Response(`<div data-component="TeamDetailsModule" data-props="${JSON.stringify(details).replaceAll('"', '&quot;')}"></div>`);
    }
    if (!url.includes('/api/')) return new Response(`<div data-component="RidersModule" data-props="${JSON.stringify(metadata).replaceAll('"', '&quot;')}"></div>`);
    const teams = url.includes('category=WTT') ? worldTeams : proTeams;
    return Response.json({ totalItems: teams.length, page: 1, pageSize: 25, items: invalid ? [{ ...wtt, categoryName: 'WTW' }] : teams });
  };
  pool.getConnection = async () => ({
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql, params) => {
      assert.doesNotMatch(sql, /tblTours|tblPloegRenners|tblTourPloegen/);
      if (sql.includes('FROM tblLanden')) return [{ code: 'NLD', iso2: 'NL' }, { code: 'BEL', iso2: 'BE' }];
      if (sql.includes('FROM tblRenners')) return allTeams.map((_, index) => ({
        rennerID: index + 1, anaam: `Rider ${index + 1}`, tnaam: null, vnaam: 'Test', landID: 'NL'
      }));
      if (sql.includes('FROM tblPloegen')) return alreadyImported ? allTeams.map((team, index) => ({
        ploegID: index + 1, naam: team.teamName, ploegCode: team.teamCode,
        landID: team.categoryName === 'WTT' ? 'NL' : 'BE'
      })) : [
        { ploegID: 1, naam: 'OLD NAME', ploegCode: 'ABC', landID: 'NL' },
        { ploegID: 2, naam: 'HISTORICAL TEAM', ploegCode: 'OLD', landID: 'BE' },
        ...(duplicate ? [{ ploegID: 3, naam: 'OTHER', ploegCode: 'ABC', landID: 'NL' }] : [])
      ];
      if (fail) throw new Error('Write failed');
      writes.push({ sql, params });
      assert.doesNotMatch(sql, /DELETE|tblPloegRenners|tblTourPloegen/);
      return { insertId: 100 + writes.length };
    }
  });
  try {
    await t.test('Updates by code, adds missing teams, preserves old teams and maps sporting countries', async () => {
      const result = await syncUciTeams();
      assert.equal(result.year, '2026');
      assert.equal(result.added, 22);
      assert.equal(result.updated, 1);
      assert.equal(result.total, 23);
      assert.equal(result.rankingDate, '2026-10-18');
      assert.deepEqual(result.riders, { added: 0, unchanged: 23, skipped: [], total: 23 });
      assert.deepEqual(writes[0].params, ['TEAM NEW NAME', 'NL', 'ABC', 1]);
      assert.ok(writes.every(write => !/tblTourPloegen|tblPloegRenners/.test(write.sql)));
      assert.deepEqual(events, ['begin', 'commit', 'release']);
    });
    await t.test('Reimport leaves unchanged records and never accesses Tour tables', async () => {
      alreadyImported = true;
      writes.length = 0;
      const result = await syncUciTeams();
      assert.equal(result.added, 0);
      assert.equal(result.updated, 0);
      assert.equal(result.unchanged, 23);
      assert.equal(writes.length, 0);
      alreadyImported = false;
    });
    await t.test('Ambiguous matches roll back without guessing', async () => {
      events.length = 0;
      duplicate = true;
      await assert.rejects(() => syncUciTeams(), /niet eenduidig/);
      assert.deepEqual(events, ['begin', 'rollback', 'release']);
      duplicate = false;
    });
    await t.test('Write errors roll back', async () => {
      events.length = 0;
      fail = true;
      await assert.rejects(() => syncUciTeams(), /Write failed/);
      assert.deepEqual(events, ['begin', 'rollback', 'release']);
      fail = false;
    });
    await t.test('Unexpected UCI category fails before database writes', async () => {
      invalid = true;
      await assert.rejects(loadUciTeams);
    });
    await t.test('Rider matching preserves existing data, handles prefixes and skips ambiguous names', async () => {
      const inserted = [];
      const existing = [
        { rennerID: 1, anaam: 'Poel', tnaam: 'van der', vnaam: 'Mathieu', landID: 'NL' },
        { rennerID: 2, anaam: 'Groves', tnaam: null, vnaam: 'Kaden', landID: 'AU' },
        { rennerID: 3, anaam: 'Smith', tnaam: null, vnaam: 'John', landID: 'GB' },
        { rennerID: 4, anaam: 'Smith', tnaam: null, vnaam: 'John', landID: 'GB' }
      ];
      const rider = (givenName, familyName, countryCode, id) => ({ givenName, familyName, countryCode, url: `/rider-details/${id}` });
      const { ids, ...result } = await addMissingUciRiders({
        query: async (sql, params) => {
          if (sql.includes('SELECT')) return existing;
          assert.match(sql, /^INSERT INTO tblRenners/);
          inserted.push(params);
          return { insertId: 5 };
        }
      }, [
        rider('Mathieu', 'VAN DER POEL', 'NED', 1),
        rider('Kaden Alexander', 'GROVES', 'AUS', 2),
        rider('John', 'SMITH', 'GBR', 3),
        rider('New', 'RIDER', 'NED', 5),
        rider('Unknown', 'COUNTRY', 'TPE', 6)
      ], [{ code: 'NLD', iso2: 'NL' }, { code: 'AUS', iso2: 'AU' }, { code: 'GBR', iso2: 'GB' }]);
      assert.deepEqual(result, {
        added: 1, unchanged: 2,
        skipped: ['John SMITH', 'Unknown COUNTRY (onbekend of dubbel land: TPE)'], total: 5
      });
      assert.deepEqual(inserted, [['RIDER', 'New', 'NL']]);
      assert.equal(ids.get('/rider-details/1'), 1);
      const { ids: againIDs, ...again } = await addMissingUciRiders({
        query: async sql => {
          assert.match(sql, /^SELECT/);
          return existing;
        }
      }, [rider('New', 'RIDER', 'NED', 5)], [{ code: 'NLD', iso2: 'NL' }]);
      assert.deepEqual(again, { added: 0, unchanged: 1, skipped: [], total: 1 });
      assert.equal(againIDs.get('/rider-details/5'), 5);
    });
    await t.test('Selects 18 WorldTeams and the best five ProTeams, not alphabetic order', () => {
      const ranks = new Map(allTeams.map((team, index) => [team.teamCode, index + 1]));
      ranks.set('P05', 1);
      const selected = selectRankedTeams([...allTeams].reverse(), ranks);
      assert.equal(selected.filter(team => team.categoryName === 'WTT').length, 18);
      assert.deepEqual(selected.filter(team => team.categoryName === 'PRT').map(team => team.teamCode), ['P05', 'P00', 'P01', 'P02', 'P03']);
      ranks.delete('ABC');
      assert.throws(() => selectRankedTeams(allTeams, ranks), /Niet alle/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    pool.getConnection = originalConnection;
    await pool.end();
  }
});
