import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import express from 'express';
import { pool } from '../src/db.ts';
import { apiRouter } from '../src/routes/index.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';
import { checkOrigin, hashPassword, hashToken, verifyPassword } from '../src/auth.ts';
import { dutchDateTime, enrollmentStatus, enrollmentDateSchema } from '../src/enrollment.ts';

test('Dutch enrollment boundaries are exact, including DST and missing configuration', () => {
  const p = {
    tourStart: '2027-07-04T15:00:00', registrationStart: null, registrationEnd: null
  };
  const boundary = Date.parse('2027-07-03T22:00:00Z');
  assert.equal(dutchDateTime('2027-07-04T00:00:00'), boundary);
  assert.equal(dutchDateTime('2027-01-04T00:00:00'), Date.parse('2027-01-03T23:00:00Z'));
  assert.equal(enrollmentStatus(p, boundary - 1).editable, true);
  assert.equal(enrollmentStatus(p, boundary).editable, false);
  assert.equal(enrollmentStatus(p, boundary + 1).editable, false);
  assert.equal(enrollmentStatus(p, boundary).closesAt, '2027-07-03T22:00:00.000Z');
  const earlier = { ...p, registrationEnd: '2027-07-01T18:00:00' };
  assert.equal(enrollmentStatus(earlier, Date.parse('2027-07-01T21:59:59.999Z')).editable, true);
  assert.equal(enrollmentStatus(earlier, Date.parse('2027-07-01T22:00:00Z')).editable, false);
  assert.equal(enrollmentStatus({ ...p, registrationEnd: '2027-08-01T00:00:00' }, boundary).editable, false);
  const opening = { ...p, registrationStart: '2027-06-01T09:00:00' };
  assert.equal(enrollmentStatus(opening, Date.parse('2027-05-31T21:59:59.999Z')).editable, false);
  assert.equal(enrollmentStatus(opening, Date.parse('2027-05-31T22:00:00Z')).editable, true);
  assert.equal(enrollmentStatus({ ...p, tourStart: null }, 0).editable, false);
  assert.equal(enrollmentDateSchema.parse('2027-07-01'), '2027-07-01');
  assert.equal(enrollmentDateSchema.parse('2027-07-01T18:00'), '2027-07-01');
  assert.equal(enrollmentDateSchema.parse('2027-07-01T18:00:00Z'), '2027-07-01');
  assert.equal(enrollmentDateSchema.safeParse('2027-02-31').success, false);
  assert.equal(enrollmentDateSchema.safeParse('2027-02-31T18:00').success, false);
  for (const [end, cutoff] of [
    ['2027-03-28', '2027-03-28T22:00:00Z'],
    ['2027-10-31', '2027-10-31T23:00:00Z'],
    ['2027-12-31', '2027-12-31T23:00:00Z']
  ]) {
    const period = { ...p, tourStart: '2028-07-01', registrationStart: end, registrationEnd: end };
    const time = Date.parse(cutoff);
    assert.equal(enrollmentStatus(period, time - 1).editable, true);
    assert.equal(enrollmentStatus(period, time).editable, false);
    assert.equal(enrollmentStatus(period, time).closesAt, new Date(time).toISOString());
  }
});

test('Account ownership, deadlines, payment and PDF are enforced at the API boundary', async t => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const userToken = 'a'.repeat(64);
  const adminToken = 'b'.repeat(64);
  const csrf = 'c'.repeat(64);
  let expired = false;
  const passwordHash = await hashPassword('a-strong-test-password');
  const user = { accountID: 1, adrID: 10, email: 'jan@example.test', role: 'user' };
  const admin = { accountID: 2, adrID: 20, email: 'admin@example.test', role: 'admin' };
  let currentPool = {
    poolID: 1, tourID: 1, Naam: 'Testpool', Org: 'Organisatie', tourNaam: 'Tour 2099',
    tourStart: '2099-07-04T00:00:00', registrationStart: null, registrationEnd: null,
    PloegRennerAantal: 2, PloegReserveAantal: 1, inleg: '10.00'
  };
  const profile = { vNaam: 'Jan', tNaam: 'van', aNaam: 'Jansen', plaats: 'Utrecht', tel: '0612345678', email: user.email };
  const available = [101, 102, 103].map((id, i) => ({
    rennerID: id, Rugnummer: i + 1, vnaam: 'Renner', tnaam: null, anaam: `Test ${i}`, ploegNaam: 'Ploeg'
  }));
  let entries = [{ deelnID: 1, poolID: 1, adrID: 10, roepnaam: 'Jan', Betaald: 0 }];
  let selections = { 1: [101, 102] };
  let nextID = 2;
  const writes = [];
  const events = [];
  let failRiderInsert = false;
  let onRiderInsert;
  let registered;
  let issuedSession;
  let deletes = 0;
  const query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.includes('FROM tblSessions s')) {
      if (expired) return [];
      const account = params[0] === hashToken(userToken) ? user : params[0] === hashToken(adminToken) ? admin : null;
      return account ? [{ ...account, csrfToken: csrf }] : [];
    }
    if (sql.includes('FROM tblAccounts WHERE email')) {
      return params[0] === user.email ? [{ ...user, passwordHash }] : [];
    }
    if (sql.includes('INSERT INTO tblSessions')) { issuedSession = params; return {}; }
    if (sql.includes('DELETE FROM tblSessions')) { deletes++; return {}; }
    if (sql.includes('INSERT INTO tblAdressen')) { writes.push(sql); return { insertId: 11 }; }
    if (sql.includes('INSERT INTO tblAccounts')) { registered = { sql, params }; writes.push(sql); return {}; }
    if (sql.includes('FROM tblPools p JOIN tblTours')) {
      return params.length && params[0] !== 1 ? [] : [{ ...currentPool }];
    }
    if (sql.includes('FROM tblAdressen WHERE adrID')) return params[0] === 10 ? [profile] : [];
    if (sql.includes('FROM tblPloegRenners pr JOIN tblRenners')) return available;
    if (sql.includes('FROM tblDeelnemRenners dr JOIN')) {
      return (selections[params[0]] || []).map((id, index) => ({
        ...available.find(r => r.rennerID === id), positie: index + 1
      }));
    }
    if (sql.includes('SELECT deelnID, poolID, roepnaam, Betaald FROM tblDeelnemers')) {
      return entries.filter(e => e.deelnID === params[0] && e.adrID === params[1]);
    }
    if (sql.includes('FROM tblDeelnemers d JOIN tblPools')) return entries.filter(e => e.adrID === params[0]);
    if (sql.includes('INSERT INTO tblDeelnemers')) {
      const deelnID = nextID++;
      entries.push({ deelnID, poolID: params[0], adrID: params[1], roepnaam: params[2], Betaald: 0 });
      writes.push(sql); return { insertId: deelnID };
    }
    if (sql.includes('UPDATE tblDeelnemers SET roepnaam')) {
      entries.find(e => e.deelnID === params[1] && e.adrID === params[2]).roepnaam = params[0];
      writes.push(sql); return {};
    }
    if (sql.includes('DELETE FROM tblDeelnemRenners')) {
      selections[params[0]] = []; writes.push(sql); return {};
    }
    if (sql.includes('INSERT INTO tblDeelnemRenners')) {
      if (failRiderInsert) throw new Error('Simulated roster failure');
      onRiderInsert?.();
      (selections[params[0]] ||= []).push(params[1]); writes.push(sql); return {};
    }
    if (sql.includes('SELECT deelnID, poolID, adrID, roepnaam, Betaald FROM tblDeelnemers')) {
      return entries.filter(e => e.deelnID === params[0]);
    }
    if (sql.includes('UPDATE tblDeelnemers SET poolID')) {
      const entry = entries.find(e => e.deelnID === params[4]);
      Object.assign(entry, { poolID: params[0], adrID: params[1], roepnaam: params[2], Betaald: params[3] });
      writes.push(sql); return {};
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.query = query;
  pool.getConnection = async () => {
    let snapshot;
    return {
      query,
      beginTransaction: async () => {
        snapshot = structuredClone({ entries, selections }); events.push('begin');
      },
      commit: async () => events.push('commit'),
      rollback: async () => {
        if (snapshot) { entries = snapshot.entries; selections = snapshot.selections; }
        events.push('rollback');
      },
      release: () => events.push('release')
    };
  };
  const app = express();
  app.use(express.json()); app.use(checkOrigin); app.use('/api', apiRouter); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = (path, method = 'GET', body, token = userToken, csrfToken = csrf, origin) => fetch(`${base}${path}`, {
    method, headers: {
      ...(token ? { Cookie: `tourpool_session=${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(origin ? { Origin: origin } : {}),
      'Content-Type': 'application/json'
    }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = { poolID: 1, roepnaam: 'Jan tweede ploeg', riders: [102, 101] };
  try {
    await t.test('Scrypt hashes are salted and reject wrong passwords', async () => {
      assert.notEqual(await hashPassword('a-strong-test-password'), passwordHash);
      assert.equal(await verifyPassword('a-strong-test-password', passwordHash), true);
      assert.equal(await verifyPassword('incorrect', passwordHash), false);
    });
    await t.test('Every legacy resource rejects anonymous and ordinary users, including payment writes', async () => {
      const resources = [
        'tours', 'pools', 'addresses', 'riders', 'countries', 'teams', 'tour-teams',
        'team-riders', 'stages', 'stage-results', 'participants', 'participant-riders',
        'participant-points', 'options', 'standard-points', 'point-allocations', 'accounts'
      ];
      for (const resource of resources) {
        for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
          assert.equal((await request(`/${resource}`, method, undefined, null)).status, 401);
          assert.equal((await request(`/${resource}`, method)).status, 403);
        }
      }
      assert.equal((await request('/participants/1', 'PUT', { Betaald: true })).status, 403);
    });
    await t.test('Sessions expire and CSRF/origin are enforced', async () => {
      assert.equal((await request('/auth/session')).status, 200);
      expired = true;
      assert.equal((await request('/me/entries')).status, 401);
      expired = false;
      assert.equal((await request('/me/entries', 'POST', payload, userToken, null)).status, 403);
      assert.equal((await request('/me/entries', 'POST', payload, userToken, 'invalid')).status, 403);
      assert.equal((await request('/auth/login', 'POST', {}, null, null, 'https://untrusted.test')).status, 403);
    });
    await t.test('Users see only their own entries and cannot read, edit or download another user roster', async () => {
      entries.push({ deelnID: 99, poolID: 1, adrID: 99, roepnaam: 'Another person', Betaald: 1 });
      assert.deepEqual((await (await request('/me/entries')).json()).map(e => e.deelnID), [1]);
      for (const id of [99, 999]) {
        assert.equal((await request(`/me/entries/${id}`)).status, 404);
        assert.equal((await request(`/me/entries/${id}/pdf`)).status, 404);
        assert.equal((await request(`/me/entries/${id}`, 'PUT', payload)).status, 404);
      }
      assert.equal((await request('/me/entries/no-id')).status, 400);
    });
    await t.test('Multiple rosters in the same pool are supported; ownership and payment cannot be supplied', async () => {
      const first = await request('/me/entries', 'POST', payload);
      assert.equal(first.status, 201);
      const id = (await first.json()).deelnID;
      assert.equal(entries.find(e => e.deelnID === id).adrID, 10);
      assert.equal(entries.find(e => e.deelnID === id).Betaald, 0);
      assert.deepEqual(selections[id], [102, 101]);
      assert.equal((await request('/me/entries', 'POST', { ...payload, roepnaam: 'Third' })).status, 201);
      for (const extra of [{ Betaald: true }, { adrID: 99 }, { role: 'admin' }]) {
        assert.equal((await request('/me/entries', 'POST', { ...payload, ...extra })).status, 400);
        assert.equal((await request('/me/entries/1', 'PUT', { ...payload, ...extra })).status, 400);
      }
      assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 200);
    });
    await t.test('Only admins confirm payments and roster edits preserve payment', async () => {
      assert.equal((await request('/participants/1', 'PUT', { Betaald: true }, adminToken)).status, 200);
      assert.equal(entries.find(e => e.deelnID === 1).Betaald, 1);
      assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 200);
      assert.equal(entries.find(e => e.deelnID === 1).Betaald, 1);
    });
    await t.test('Invalid riders never write; storage failure restores the whole roster', async () => {
      const count = writes.length;
      for (const riders of [[101, 101], [999], [101, 102, 103]]) {
        assert.equal((await request('/me/entries/1', 'PUT', { ...payload, riders })).status, 400);
      }
      assert.equal(writes.length, count);
      const snapshot = structuredClone({ entries, selections });
      failRiderInsert = true;
      assert.equal((await request('/me/entries/1', 'PUT', { ...payload, roepnaam: 'Should rollback' })).status, 500);
      failRiderInsert = false;
      assert.deepEqual({ entries, selections }, snapshot);
      assert.deepEqual(events.slice(-3), ['begin', 'rollback', 'release']);
    });
    await t.test('Closed or unopened pools reject creating and modifying; existing PDF remains downloadable', async () => {
      const future = { ...currentPool };
      currentPool.tourStart = '2000-07-01T00:00:00';
      const count = writes.length;
      assert.equal((await request('/me/entries', 'POST', payload)).status, 403);
      assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 403);
      assert.equal(writes.length, count);
      const pdf = await request('/me/entries/1/pdf');
      assert.equal(pdf.status, 200);
      assert.equal(pdf.headers.get('content-type'), 'application/pdf');
      assert.match(pdf.headers.get('content-disposition'), /tourpool-inschrijving-1\.pdf/);
      const buffer = Buffer.from(await pdf.arrayBuffer());
      assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
      assert.ok(buffer.length > 1000);
      const text = [...buffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
        .flatMap(match => [...inflateSync(Buffer.from(match[1], 'latin1')).toString().matchAll(/<([a-f0-9]+)>/gi)]
          .map(hex => Buffer.from(hex[1], 'hex').toString('latin1'))).join('');
      for (const expected of [
        'Inschrijfformulier', 'Testpool', 'Organisatie', 'Inschrijving #1', 'Jan van Jansen',
        'Jan tweede ploeg', user.email, 'Utrecht', '0612345678', 'EUR 10.00', 'Betaald: Ja',
        'Reserves', 'Renner Test 1', 'Renner Test 0', 'Lever dit formulier in'
      ]) assert.ok(text.includes(expected), `PDF lacks: ${expected}`);
      assert.ok(text.indexOf('Renner Test 1') < text.indexOf('Reserves'));
      assert.ok(text.indexOf('Reserves') < text.indexOf('Renner Test 0'));
      currentPool = { ...future, registrationEnd: '2000-01-01T00:00:00' };
      assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 403);
      currentPool = { ...future, registrationStart: '2099-01-01T00:00:00' };
      assert.equal((await request('/me/entries', 'POST', payload)).status, 403);
      currentPool = { ...future, tourStart: null };
      assert.equal((await request('/me/entries', 'POST', payload)).status, 403);
      currentPool = future;
    });
    await t.test('Requests at the exact cutoff are rejected and writes crossing it are rolled back', async () => {
      const originalNow = Date.now;
      const boundary = Date.parse('2099-07-03T22:00:00Z');
      let now = boundary - 1;
      Date.now = () => now;
      try {
        assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 200);
        now = boundary;
        const count = writes.length;
        assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 403);
        assert.equal((await request('/me/entries', 'POST', payload)).status, 403);
        assert.equal(writes.length, count);
        now = boundary - 1;
        const snapshot = structuredClone({ entries, selections });
        onRiderInsert = () => { now = boundary; };
        assert.equal((await request('/me/entries/1', 'PUT', { ...payload, roepnaam: 'Too late' })).status, 403);
        assert.deepEqual({ entries, selections }, snapshot);
        assert.deepEqual(events.slice(-3), ['begin', 'rollback', 'release']);
      } finally {
        Date.now = originalNow;
        onRiderInsert = undefined;
      }
    });
    await t.test('Drafts can be saved but not printed as a completed registration', async () => {
      assert.equal((await request('/me/entries/1', 'PUT', { ...payload, riders: [101] })).status, 200);
      assert.equal((await request('/me/entries/1/pdf')).status, 400);
      assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 200);
    });
    await t.test('Registration always creates a user and login issues a secure session cookie', async () => {
      const { email: _email, ...registrationProfile } = profile;
      const registration = { email: 'New@Example.test', password: 'new-account-password', profile: registrationProfile };
      assert.equal((await request('/auth/register', 'POST', { ...registration, role: 'admin' }, null)).status, 400);
      assert.equal((await request('/auth/register', 'POST', registration, null)).status, 201);
      assert.match(registered.sql, /'user'/);
      assert.equal(registered.params[0], 11);
      assert.equal(registered.params[1], 'new@example.test');
      assert.equal(await verifyPassword(registration.password, registered.params[2]), true);
      assert.equal((await request('/auth/login', 'POST', { email: 'unknown@example.test', password: 'x' }, null)).status, 401);
      const login = await request('/auth/login', 'POST', { email: user.email, password: 'a-strong-test-password' }, null);
      assert.equal(login.status, 200);
      const cookie = login.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Max-Age=43200/);
      const token = cookie.match(/tourpool_session=([a-f0-9]{64})/)[1];
      assert.equal(issuedSession[0], hashToken(token));
      assert.notEqual(issuedSession[0], token);
      assert.equal((await login.json()).csrfToken, issuedSession[2]);
      const before = deletes;
      assert.equal((await request('/auth/logout', 'POST')).status, 204);
      assert.equal(deletes, before + 1);
    });
  } finally {
    pool.query = originalQuery; pool.getConnection = originalGetConnection;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
