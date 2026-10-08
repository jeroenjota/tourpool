import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import express from 'express';
import { pool } from '../src/db.ts';
import { emailService, smtpFailureMessage } from '../src/email.ts';
import { apiRouter } from '../src/routes/index.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';
import { checkOrigin, hashPassword, hashToken, HttpError, verifyPassword } from '../src/auth.ts';
import { dutchDateTime, enrollmentStatus, enrollmentDateSchema } from '../src/enrollment.ts';

function pdfText(buffer) {
  try {
    return execFileSync('pdftotext', ['-', '-'], { input: buffer, encoding: 'utf8' });
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function pdfUnicodeMaps(buffer) {
  const source = buffer.toString('latin1');
  const objects = new Map([...source.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)]
    .map(([, id, body]) => [id, body]));
  const mapIDs = [...objects.values()]
    .flatMap(body => [...body.matchAll(/\/ToUnicode (\d+) 0 R/g)].map(([, id]) => id));
  return mapIDs.map(id => {
    const compressed = objects.get(id)?.match(/stream\r?\n([\s\S]*?)\r?\nendstream/)?.[1];
    if (!compressed) throw new Error(`Missing PDF ToUnicode stream ${id}`);
    return inflateSync(Buffer.from(compressed, 'latin1')).toString('latin1');
  })
    .join('\n');
}

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
  const user = { accountID: 1, adrID: 10, username: 'jan', email: 'jan@example.test', emailVerified: true, role: 'user' };
  const admin = { accountID: 2, adrID: 20, username: 'admin', email: 'admin@example.test', emailVerified: true, role: 'admin' };
  let currentPool = {
    poolID: 1, tourID: 1, Naam: 'Testpool', Org: 'Organisatie', tourNaam: 'Tour 2099',
    visibleToUsers: true,
    tourStart: '2099-07-04T00:00:00', registrationStart: null, registrationEnd: null,
    PloegRennerAantal: 2, PloegReserveAantal: 1, inleg: '10.00'
  };
  const profile = { vNaam: 'Jan', tNaam: 'van', aNaam: 'Jansen', plaats: 'Utrecht', tel: '0612345678', email: user.email };
  const available = [101, 102, 103].map((id, i) => ({
    rennerID: id, Rugnummer: i + 1, vnaam: 'Renner', tnaam: null,
    anaam: i === 1 ? 'Pogačar' : `Test ${i}`, ploegNaam: 'Ploeg'
  }));
  let entries = [{ deelnID: 1, poolID: 1, adrID: 10, roepnaam: 'Jan', Betaald: 0 }];
  let selections = { 1: [101, 102] };
  let nextID = 2;
  const writes = [];
  const events = [];
  let failRiderInsert = false;
  let onRiderInsert;
  let registered;
  const registeredAccounts = [];
  const verificationRecords = new Map();
  const verificationEmails = [];
  const registrationNotifications = [];
  const testEmailDeliveries = [];
  let testEmailFailure;
  emailService.sendVerification = async (email, token) => verificationEmails.push({ email, token });
  emailService.sendRegistrationNotice = async details => registrationNotifications.push(details);
  emailService.sendTestEmail = async () => {
    if (testEmailFailure) throw new HttpError(502, smtpFailureMessage(testEmailFailure));
    testEmailDeliveries.push(true);
  };
  let issuedSession;
  let deletes = 0;
  const query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    if (sql.includes('FROM tblSessions s')) {
      if (expired) return [];
      const account = params[0] === hashToken(userToken) ? user : params[0] === hashToken(adminToken) ? admin : null;
      return account ? [{ ...account, csrfToken: csrf }] : [];
    }
    if (sql.includes('FROM tblAccounts WHERE username = ? OR email = ?')) {
      return [user, admin, ...registeredAccounts]
        .filter(account => params.includes(account.username) || params.includes(account.email))
        .map(account => ({ ...account, passwordHash: account.passwordHash ?? passwordHash }));
    }
    if (sql.includes('SELECT accountID FROM tblAccounts WHERE email = ? AND emailVerified = FALSE')) {
      return registeredAccounts.filter(account => account.email === params[0] && !account.emailVerified);
    }
    if (sql.includes('SELECT accountID FROM tblEmailVerifications WHERE tokenHash = ?')) {
      const record = verificationRecords.get(params[0]);
      return record ? [{ accountID: record.accountID }] : [];
    }
    if (sql.includes('INSERT INTO tblEmailVerifications')) {
      verificationRecords.set(params[0], { accountID: params[1] });
      return {};
    }
    if (sql.includes('DELETE FROM tblEmailVerifications WHERE accountID = ?')) {
      for (const [tokenHash, record] of verificationRecords) {
        if (record.accountID === params[0]) verificationRecords.delete(tokenHash);
      }
      return {};
    }
    if (sql.includes('UPDATE tblAccounts SET emailVerified = TRUE')) {
      const account = registeredAccounts.find(item => item.accountID === params[0]);
      if (account) account.emailVerified = true;
      return {};
    }
    if (sql.includes('SELECT accountID FROM tblAccounts WHERE username = ? AND accountID <> ?')) {
      return [user, admin].filter(account => account.accountID !== params[1] && account.username === params[0])
        .map(account => ({ accountID: account.accountID }));
    }
    if (sql.includes('UPDATE tblAccounts SET username = ?')) {
      const account = [user, admin].find(item => item.accountID === params[1]);
      if (account) account.username = params[0];
      writes.push(sql); return {};
    }
    if (sql.includes('UPDATE tblAdressen SET vNaam')) { writes.push(sql); return {}; }
    if (sql.includes('FROM tblAccounts WHERE username IN')) return [];
    if (sql.includes('INSERT INTO tblSessions')) { issuedSession = params; return {}; }
    if (sql.includes('DELETE FROM tblSessions')) { deletes++; return {}; }
    if (sql.includes('INSERT INTO tblAdressen')) { writes.push(sql); return { insertId: 11 }; }
    if (sql.includes('INSERT INTO tblAccounts')) {
      registered = { sql, params };
      registeredAccounts.push({
        accountID: 30, adrID: params[0], username: params[1], email: params[2],
        emailVerified: false, role: 'user', passwordHash: params[3]
      });
      writes.push(sql); return { insertId: 30 };
    }
    if (sql.includes('FROM tblPools p JOIN tblTours')) {
      assert.ok(sql.includes('p.visibleToUsers = TRUE'));
      if (!currentPool.visibleToUsers) return [];
      return params.length && params[0] !== 1 ? [] : [{ ...currentPool }];
    }
    if (sql.includes('FROM tblAdressen WHERE adrID')) return params[0] === 10 ? [profile] : [];
    if (sql.includes('FROM tblPloegRenners pr JOIN tblRenners')) return available;
    if (sql.includes('FROM tblDeelnemRenners dr JOIN')) {
      return (selections[params[0]] || []).map((id, index) => ({
        ...available.find(r => r.rennerID === id), positie: index + 1
      }));
    }
    if (sql.includes('SELECT deelnID, poolID, roepnaam AS ploegnaam, Betaald FROM tblDeelnemers')) {
      assert.ok(sql.includes('p.visibleToUsers = TRUE'));
      if (!currentPool.visibleToUsers) return [];
      return entries.filter(e => e.deelnID === params[0] && e.adrID === params[1])
        .map(({ roepnaam, ...entry }) => ({ ...entry, ploegnaam: roepnaam }));
    }
    if (sql.includes('JOIN tblAdressen a')) {
      return entries.map(({ roepnaam, ...entry }) => ({ ...entry, ploegnaam: roepnaam }));
    }
    if (sql.includes('FROM tblDeelnemers d JOIN tblPools')) {
      assert.ok(sql.includes('p.visibleToUsers = TRUE'));
      if (!currentPool.visibleToUsers) return [];
      const results = params.length ? entries.filter(e => e.adrID === params[0]) : entries;
      return results.map(({ roepnaam, ...entry }) => ({ ...entry, ploegnaam: roepnaam }));
    }
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
    if (sql.includes('SELECT deelnID, poolID, adrID, roepnaam AS ploegnaam, Betaald FROM tblDeelnemers')) {
      return entries.filter(e => e.deelnID === params[0])
        .map(({ roepnaam, ...entry }) => ({ ...entry, ploegnaam: roepnaam }));
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
  const payload = { poolID: 1, ploegnaam: 'Jan tweede ploeg', riders: [102, 101] };
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
    await t.test('SMTP test email is available to admins only', async () => {
      assert.equal((await request('/admin/test-email', 'POST', undefined, null, null)).status, 401);
      assert.equal((await request('/admin/test-email', 'POST')).status, 403);
      const result = await request('/admin/test-email', 'POST', undefined, adminToken);
      assert.equal(result.status, 200);
      assert.match((await result.json()).message, /CONTACT_RECEIVER/);
      assert.equal(testEmailDeliveries.length, 1);
      testEmailFailure = Object.assign(new Error('SMTP authentication failed'), { code: 'EAUTH', responseCode: 535 });
      const failedResult = await request('/admin/test-email', 'POST', undefined, adminToken);
      assert.equal(failedResult.status, 502);
      assert.match((await failedResult.json()).message, /controleer SMTP_USER en SMTP_PASSWORD/i);
      testEmailFailure = undefined;
    });
    await t.test('Users see only their own entries and cannot read, edit or download another user roster', async () => {
      entries.push({ deelnID: 99, poolID: 1, adrID: 99, roepnaam: 'Another person', Betaald: 1 });
      assert.deepEqual((await (await request('/me/entries')).json()).map(e => e.deelnID), [1]);
      for (const id of [99, 999]) {
        assert.equal((await request(`/me/entries/${id}`)).status, 404);
        assert.equal((await request(`/me/entries/${id}/pdf`)).status, 404);
        assert.equal((await request(`/me/entries/${id}`, 'PUT', payload)).status, 404);
      }
      const participantList = await (await request('/participants', 'GET', undefined, adminToken)).json();
      assert.equal(participantList[0].ploegnaam, 'Jan');
      assert.equal('roepnaam' in participantList[0], false);
      assert.equal((await request('/me/entries/no-id')).status, 400);
    });
    await t.test('Hidden pools and their entries are inaccessible through every user endpoint', async () => {
      const snapshot = structuredClone({ entries, selections });
      const count = writes.length;
      currentPool.visibleToUsers = false;
      try {
        assert.deepEqual(await (await request('/me/pools')).json(), []);
        assert.deepEqual(await (await request('/me/entries')).json(), []);
        for (const endpoint of ['/me/pools/1/riders', '/me/entries/1', '/me/entries/1/pdf']) {
          assert.equal((await request(endpoint)).status, 404, endpoint);
        }
        assert.equal((await request('/me/entries', 'POST', payload)).status, 404);
        assert.equal((await request('/me/entries/1', 'PUT', payload)).status, 404);
        assert.equal(writes.length, count);
        assert.deepEqual({ entries, selections }, snapshot);
        const adminEntries = await (await request('/participants', 'GET', undefined, adminToken)).json();
        assert.ok(adminEntries.some(entry => entry.deelnID === 1));
      } finally {
        currentPool.visibleToUsers = true;
      }
      assert.equal((await request('/me/entries/1')).status, 200);
      assert.equal((await request('/me/entries/1/pdf')).status, 200);
      assert.equal((await request('/me/pools/1/riders')).status, 200);
      assert.equal((await (await request('/me/pools')).json()).length, 1);
      const restoredEntries = await (await request('/me/entries')).json();
      assert.ok(restoredEntries.some(entry => entry.deelnID === 1));
    });
    await t.test('Multiple rosters in the same pool are supported; ownership and payment cannot be supplied', async () => {
      const first = await request('/me/entries', 'POST', payload);
      assert.equal(first.status, 201);
      const id = (await first.json()).deelnID;
      assert.equal(entries.find(e => e.deelnID === id).adrID, 10);
      assert.equal(entries.find(e => e.deelnID === id).Betaald, 0);
      assert.deepEqual(selections[id], [102, 101]);
      assert.equal((await request('/me/entries', 'POST', { ...payload, ploegnaam: 'Third' })).status, 201);
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
      assert.equal((await request('/me/entries/1', 'PUT', { ...payload, ploegnaam: 'Should rollback' })).status, 500);
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
      assert.match(buffer.toString('latin1'), /EBGaramond-Regular/);
      assert.match(buffer.toString('latin1'), /Lato-Regular/);
      const text = pdfText(buffer);
      if (text !== undefined) {
        for (const expected of [
          'Inschrijfformulier', 'Testpool', 'Organisatie', 'Inschrijving #1', 'Jan van Jansen',
          'Jan tweede ploeg', user.email, 'Utrecht', '0612345678', 'EUR 10.00', 'Betaald: Ja',
          'Reserves', 'Renner Pogačar', 'Renner Test 0', 'Lever dit formulier in'
        ]) assert.ok(text.includes(expected), `PDF lacks: ${expected}`);
        assert.ok(text.indexOf('Renner Pogačar') < text.indexOf('Reserves'));
        assert.ok(text.indexOf('Reserves') < text.indexOf('Renner Test 0'));
      } else {
        assert.match(pdfUnicodeMaps(buffer), /<010d>/i, 'PDF must map the č in Pogačar to a Unicode glyph');
      }
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
        assert.equal((await request('/me/entries/1', 'PUT', { ...payload, ploegnaam: 'Too late' })).status, 403);
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
      const registration = {
        username: 'jan_nieuw', email: 'New@Example.test',
        password: 'new-account-password', profile: registrationProfile
      };
      assert.equal((await request('/auth/register', 'POST', { ...registration, role: 'admin' }, null)).status, 400);
      assert.equal((await request('/auth/register', 'POST', { ...registration, username: 'Jan Nieuw' }, null)).status, 400);
      const noticeCount = registrationNotifications.length;
      assert.equal((await request('/auth/register', 'POST', { ...registration, website: 'spam.example' }, null)).status, 201);
      assert.equal(registrationNotifications.length, noticeCount);
      assert.equal((await request('/auth/register', 'POST', registration, null)).status, 201);
      assert.match(registered.sql, /'user'/);
      assert.match(registered.sql, /emailVerified/);
      assert.equal(registered.params[0], 11);
      assert.equal(registered.params[1], 'jan_nieuw');
      assert.equal(registered.params[2], 'new@example.test');
      assert.equal(await verifyPassword(registration.password, registered.params[3]), true);
      assert.deepEqual(registrationNotifications.at(-1), {
        username: 'jan_nieuw', email: 'new@example.test', fullName: 'Jan van Jansen'
      });
      assert.equal((await request('/auth/login', 'POST', {
        username: registration.username, password: registration.password
      }, null)).status, 403);
      const firstVerificationToken = verificationEmails.at(-1).token;
      assert.equal((await request('/auth/resend-verification', 'POST', { email: registration.email }, null)).status, 202);
      const replacementVerificationToken = verificationEmails.at(-1).token;
      assert.notEqual(replacementVerificationToken, firstVerificationToken);
      assert.equal((await request(`/auth/verify-email?token=${firstVerificationToken}`, 'GET', undefined, null)).status, 400);
      const verification = await request(`/auth/verify-email?token=${replacementVerificationToken}`, 'GET', undefined, null);
      assert.equal(verification.status, 200);
      assert.match(await verification.text(), /E-mailadres bevestigd/);
      assert.equal(registeredAccounts[0].emailVerified, true);
      assert.equal((await request('/auth/login', 'POST', { username: 'unknown', password: 'x' }, null)).status, 401);
      assert.equal((await request('/auth/login', 'POST', { password: 'x' }, null)).status, 400);
      assert.equal((await request('/auth/login', 'POST', {
        username: user.username, email: user.email, password: 'x'
      }, null)).status, 400);
      const login = await request('/auth/login', 'POST', { username: user.username, password: 'a-strong-test-password' }, null);
      assert.equal(login.status, 200);
      assert.equal((await login.clone().json()).account.username, user.username);
      const cookie = login.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Max-Age=43200/);
      const token = cookie.match(/tourpool_session=([a-f0-9]{64})/)[1];
      assert.equal(issuedSession[0], hashToken(token));
      assert.notEqual(issuedSession[0], token);
      assert.equal((await login.json()).csrfToken, issuedSession[2]);
      assert.equal((await request('/auth/login', 'POST', {
        email: user.email, password: 'a-strong-test-password'
      }, null)).status, 200);
      const before = deletes;
      assert.equal((await request('/auth/logout', 'POST')).status, 204);
      assert.equal(deletes, before + 1);
    });
    await t.test('Users can update their username without taking another account name', async () => {
      const { email: _email, ...profileFields } = profile;
      const updated = await request('/me/profile', 'PUT', {
        ...profileFields, username: 'jan-nieuw'
      });
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).username, 'jan-nieuw');
      assert.equal(user.username, 'jan-nieuw');
      assert.equal((await request('/me/profile', 'PUT', {
        ...profileFields, username: admin.username
      })).status, 409);
      assert.equal((await request('/me/profile', 'PUT', {
        ...profileFields, username: 'ongeldige naam'
      })).status, 400);
      assert.equal(user.username, 'jan-nieuw');
      assert.equal((await request('/auth/login', 'POST', {
        username: 'jan-nieuw', password: 'a-strong-test-password'
      }, null)).status, 200);
      assert.equal((await request('/auth/login', 'POST', {
        username: 'jan', password: 'a-strong-test-password'
      }, null)).status, 401);
    });
  } finally {
    pool.query = originalQuery; pool.getConnection = originalGetConnection;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
