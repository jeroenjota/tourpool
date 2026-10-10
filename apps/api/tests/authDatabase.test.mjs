import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import mariadb from 'mariadb';
import express from 'express';

test('Accounts and enrollment work against actual MariaDB in an isolated temporary schema', {
  skip: process.env.TOURPOOL_DB_TEST !== '1'
}, async () => {
  dotenv.config({ path: new URL('../.env', import.meta.url).pathname, quiet: true });
  const database = `tourpool_auth_test_${randomBytes(8).toString('hex')}`;
  const connection = await mariadb.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD
  });
  let created = false;
  let apiPool;
  let server;
  let emailService;
  let originalSendVerification;
  let originalSendRegistrationNotice;
  const verificationTokens = [];
  const oldDatabase = process.env.DB_NAME;
  try {
    await connection.query(`CREATE DATABASE \`${database}\``);
    created = true;
    await connection.query(`USE \`${database}\``);
    const dump = await readFile(new URL('../../../tourpool.sql', import.meta.url), 'utf8');
    // Only schema definitions are copied, never contacts or other dump data.
    const tables = [...dump.matchAll(/CREATE TABLE `[^`]+` \([\s\S]*?\) ENGINE[^;]*;/g)].map(match => match[0]);
    assert.ok(tables.length >= 10);
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const sql of tables) await connection.query(sql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    for (const filename of ['20261004_copy_point_allocation_order.sql', '20261007_add_accounts.sql']) {
      const migration = await readFile(new URL(`../migrations/${filename}`, import.meta.url), 'utf8');
      for (const sql of migration.split(';').map(value => value.trim()).filter(Boolean)) await connection.query(sql);
    }
    const legacyAdminAddress = await connection.query(
      "INSERT INTO tblAdressen (vNaam, aNaam, email) VALUES ('Legacy', 'Admin', 'legacy-admin@example.test')"
    );
    await connection.query(
      "INSERT INTO tblAccounts (adrID, email, passwordHash, role) VALUES (?, ?, ?, 'admin')",
      [Number(legacyAdminAddress.insertId), 'legacy-admin@example.test', 'legacy-password-hash']
    );
    const usernameMigration = await readFile(
      new URL('../migrations/20261008_add_account_usernames.sql', import.meta.url), 'utf8'
    );
    for (const sql of usernameMigration.split(';').map(value => value.trim()).filter(Boolean)) {
      await connection.query(sql);
    }
    const emailMigration = await readFile(
      new URL('../migrations/20261009_add_email_verification.sql', import.meta.url), 'utf8'
    );
    for (const sql of emailMigration.split(';').map(value => value.trim()).filter(Boolean)) {
      await connection.query(sql);
    }
    const poolManagerMigration = await readFile(
      new URL('../migrations/20261010_add_pool_managers_and_password_reset.sql', import.meta.url), 'utf8'
    );
    for (const sql of poolManagerMigration.split(';').map(value => value.trim()).filter(Boolean)) {
      await connection.query(sql);
    }
    const [legacyUsername] = await connection.query(
      'SELECT username FROM tblAccounts WHERE email = ?', ['legacy-admin@example.test']
    );
    assert.equal(legacyUsername.username, 'legacy-admin@example.test');
    process.env.DB_NAME = database;
    const { pool } = await import('../src/db.ts');
    apiPool = pool;
    ({ emailService } = await import('../src/email.ts'));
    originalSendVerification = emailService.sendVerification;
    originalSendRegistrationNotice = emailService.sendRegistrationNotice;
    emailService.sendVerification = async (email, token) => verificationTokens.push({ email, token });
    emailService.sendRegistrationNotice = async () => {};
    const { apiRouter } = await import('../src/routes/index.ts');
    const { errorHandler } = await import('../src/middleware/errorHandler.ts');
    const app = express();
    app.use(express.json()); app.use('/api', apiRouter); app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = (path, method = 'GET', body, session) => fetch(`${base}${path}`, {
      method, headers: {
        'Content-Type': 'application/json',
        ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrfToken } : {})
      }, body: body === undefined ? undefined : JSON.stringify(body)
    });
    const profile = { vNaam: 'Test', tNaam: '', aNaam: 'Deelnemer', plaats: '', tel: '' };
    async function account(email, username = email.split('@')[0]) {
      const registration = await request('/auth/register', 'POST', {
        username, email, password: 'test-password-for-accounts', profile
      });
      assert.equal(registration.status, 201, await registration.text());
      const verification = verificationTokens.at(-1);
      assert.equal(verification.email, email);
      const verified = await request(`/auth/verify-email?token=${verification.token}`);
      assert.equal(verified.status, 200, await verified.text());
      const login = await request('/auth/login', 'POST', { username, password: 'test-password-for-accounts' });
      assert.equal(login.status, 200);
      const body = await login.json();
      assert.equal(body.account.username, username);
      return { ...body, cookie: login.headers.get('set-cookie').split(';')[0] };
    }
    const user = await account('user@example.test', 'testuser');
    const other = await account('other@example.test', 'otheruser');
    const admin = await account('admin@example.test');
    for (const duplicate of [
      { username: 'testuser', email: 'another@example.test' },
      { username: 'anotheruser', email: 'user@example.test' }
    ]) {
      assert.equal((await request('/auth/register', 'POST', {
        ...duplicate, password: 'test-password-for-accounts', profile
      })).status, 409);
    }
    await connection.query("UPDATE tblAccounts SET role = 'admin' WHERE accountID = ?", [admin.account.accountID]);
    assert.equal((await request('/auth/session', 'GET', undefined, admin)).status, 200);
    assert.equal((await request('/auth/login', 'POST', {
      email: 'user@example.test', password: 'test-password-for-accounts'
    })).status, 200);
    assert.equal((await request('/participants', 'GET', undefined, user)).status, 403);
    assert.equal((await request('/participants')).status, 401);
    await connection.query("INSERT INTO tblTours (tourID, naam, StartDatum) VALUES (1, 'Tour test', '2099-07-04 00:00:00')");
    await connection.query("INSERT INTO tblPools (poolID, tourID, Naam, Org) VALUES (1, 1, 'Testpool', 'Organisatie')");
    await connection.query('INSERT INTO tblOpties (poolID, PloegRennerAantal, PloegReserveAantal) VALUES (1, 2, 1)');
    await connection.query("INSERT INTO tblPloegen (ploegID, naam) VALUES (1, 'Testploeg')");
    await connection.query("INSERT INTO tblRenners (rennerID, vnaam, anaam) VALUES (1, 'Eerste', 'Renner'), (2, 'Tweede', 'Renner')");
    await connection.query('INSERT INTO tblPloegRenners (tourID, ploegID, rennerID, Rugnummer) VALUES (1, 1, 1, 11), (1, 1, 2, 12)');
    const pools = await (await request('/me/pools', 'GET', undefined, user)).json();
    assert.equal(pools[0].editable, true);
    assert.equal(pools[0].closesAt, '2099-07-03T22:00:00.000Z');
    const riders = await (await request('/me/pools/1/riders', 'GET', undefined, user)).json();
    assert.deepEqual(riders.map(r => r.rennerID), [1, 2]);
    const payload = { poolID: 1, ploegnaam: 'Test ploeg', riders: [1, 2] };
    const saved = await request('/me/entries', 'POST', payload, user);
    assert.equal(saved.status, 201, await saved.clone().text());
    const { deelnID } = await saved.json();
    assert.equal((await request('/me/entries', 'POST', { ...payload, ploegnaam: 'Tweede ploeg' }, user)).status, 201);
    assert.equal((await request('/me/entries', 'POST', payload, user)).status, 409);
    assert.equal((await request(`/me/entries/${deelnID}`, 'GET', undefined, other)).status, 404);
    assert.equal((await request(`/me/entries/${deelnID}`, 'PUT', payload, other)).status, 404);
    assert.equal((await request(`/me/entries/${deelnID}/pdf`, 'GET', undefined, other)).status, 404);
    assert.equal((await request('/me/entries', 'GET', undefined, other)).status, 200);
    assert.deepEqual(await (await request('/me/entries', 'GET', undefined, other)).json(), []);
    assert.equal((await request(`/me/entries/${deelnID}`, 'PUT', { ...payload, Betaald: true }, user)).status, 400);
    assert.equal((await request(`/participants/${deelnID}`, 'PUT', { Betaald: true }, admin)).status, 200);
    const updated = await request(`/me/entries/${deelnID}`, 'PUT', { ...payload, riders: [2, 1] }, user);
    assert.equal(updated.status, 200, await updated.text());
    const roster = await (await request(`/me/entries/${deelnID}`, 'GET', undefined, user)).json();
    assert.equal(roster.Betaald, 1);
    assert.deepEqual(roster.riders.map(r => [r.rennerID, r.positie]), [[2, 1], [1, 2]]);
    assert.equal((await request(`/me/entries/${deelnID}`, 'PUT', { ...payload, riders: [1, 1] }, user)).status, 400);
    const profileUpdate = await request('/me/profile', 'PUT', {
      ...profile, username: 'renamed-user', plaats: 'Utrecht'
    }, user);
    assert.equal(profileUpdate.status, 200);
    assert.equal((await profileUpdate.json()).username, 'renamed-user');
    const updatedProfile = await (await request('/me/profile', 'GET', undefined, user)).json();
    assert.equal(updatedProfile.username, 'renamed-user');
    assert.equal(updatedProfile.plaats, 'Utrecht');
    assert.equal((await request('/auth/login', 'POST', {
      username: 'renamed-user', password: 'test-password-for-accounts'
    })).status, 200);
    assert.equal((await request('/me/profile', 'PUT', {
      ...profile, username: 'otheruser'
    }, user)).status, 409);
    const afterConflict = await (await request('/me/profile', 'GET', undefined, user)).json();
    assert.equal(afterConflict.username, 'renamed-user');
    assert.equal((await request('/auth/login', 'POST', {
      username: 'testuser', password: 'test-password-for-accounts'
    })).status, 401);
    // Admin linking transfers a legacy entry, not the contact or other entries.
    const accountsResponse = await request('/accounts', 'GET', undefined, admin);
    assert.equal(accountsResponse.status, 200);
    const accounts = await accountsResponse.json();
    assert.deepEqual(accounts.map(a => a.accountID).sort(), [user.account.accountID, other.account.accountID].sort());
    assert.equal(accounts.find(a => a.accountID === user.account.accountID).username, 'renamed-user');
    assert.ok(accounts.every(a => !('passwordHash' in a)));
    assert.equal((await request('/accounts', 'GET', undefined, user)).status, 403);
    const legacyAddress = await connection.query(
      "INSERT INTO tblAdressen (vNaam, aNaam, email) VALUES ('Legacy', 'Contact', 'legacy@example.test')"
    );
    const legacyAdrID = Number(legacyAddress.insertId);
    const legacyEntry = await connection.query(
      "INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald) VALUES (1, ?, 'Legacy ploeg', 1)", [legacyAdrID]
    );
    const legacyID = Number(legacyEntry.insertId);
    await connection.query(
      'INSERT INTO tblDeelnemRenners (deelnID, rennerID, positie) VALUES (?, 2, 1), (?, 1, 2)', [legacyID, legacyID]
    );
    const untouchedEntry = await connection.query(
      "INSERT INTO tblDeelnemers (poolID, adrID, roepnaam, Betaald) VALUES (1, ?, 'Andere legacy ploeg', 0)", [legacyAdrID]
    );
    const linkPayload = { accountID: other.account.accountID, expectedAdrID: legacyAdrID };
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', linkPayload, user)).status, 403);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', linkPayload)).status, 401);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', { ...linkPayload, accountID: admin.account.accountID }, admin)).status, 404);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', { ...linkPayload, accountID: 999999 }, admin)).status, 404);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', { ...linkPayload, expectedAdrID: user.account.adrID }, admin)).status, 409);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', linkPayload, admin)).status, 200);
    const linked = await (await request(`/me/entries/${legacyID}`, 'GET', undefined, other)).json();
    assert.equal(linked.ploegnaam, 'Legacy ploeg');
    assert.equal(linked.Betaald, 1);
    assert.deepEqual(linked.riders.map(r => [r.rennerID, r.positie]), [[2, 1], [1, 2]]);
    assert.equal((await request(`/me/entries/${legacyID}/pdf`, 'GET', undefined, other)).status, 200);
    assert.equal((await request(`/me/entries/${legacyID}`, 'GET', undefined, user)).status, 404);
    const untouched = await connection.query('SELECT adrID FROM tblDeelnemers WHERE deelnID = ?', [Number(untouchedEntry.insertId)]);
    assert.equal(untouched[0].adrID, legacyAdrID);
    assert.equal((await connection.query('SELECT adrID FROM tblAdressen WHERE adrID = ?', [legacyAdrID])).length, 1);
    // Conflicting names roll back and keep access with the previous owner.
    await connection.query('UPDATE tblDeelnemers SET roepnaam = ? WHERE deelnID = ?', [payload.ploegnaam, legacyID]);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', {
      accountID: user.account.accountID, expectedAdrID: other.account.adrID
    }, admin)).status, 409);
    assert.equal((await request(`/me/entries/${legacyID}`, 'GET', undefined, other)).status, 200);
    assert.equal((await request(`/me/entries/${legacyID}`, 'GET', undefined, user)).status, 404);
    await connection.query("UPDATE tblDeelnemers SET roepnaam = 'Legacy ploeg' WHERE deelnID = ?", [legacyID]);
    assert.equal((await request(`/participants/${legacyID}/account`, 'PUT', {
      accountID: user.account.accountID, expectedAdrID: other.account.adrID
    }, admin)).status, 200);
    assert.equal((await request(`/me/entries/${legacyID}`, 'GET', undefined, other)).status, 404);
    assert.equal((await request(`/me/entries/${legacyID}`, 'GET', undefined, user)).status, 200);
    // Date-only enrollment values survive create/update, reload and partial edits.
    const period = { StartInschr: '2026-01-01', EindInschr: '2099-07-01' };
    await connection.query(
      `INSERT INTO tblStandaardPunten (prestatieID, Omschrijving, punten, uitslagtype, plaats, volgorde)
       VALUES (1, 'Ritwinnaar', 25, 'rit', 1, 10), (2, 'Gele trui', 0, 'klasGeel', 1, 20)`
    );
    const standards = await connection.query(
      'SELECT prestatieID, Omschrijving, punten AS Punten, uitslagtype, plaats, volgorde FROM tblStandaardPunten ORDER BY prestatieID'
    );
    const createdPoolResponse = await request('/pools', 'POST', { tourID: 1, Naam: 'Date test pool', ...period }, admin);
    assert.equal(createdPoolResponse.status, 201, await createdPoolResponse.clone().text());
    const createdPool = await createdPoolResponse.json();
    const readPoolPoints = () => connection.query(
      'SELECT prestatieID, Omschrijving, Punten, uitslagtype, plaats, volgorde FROM tblPuntenToekenning WHERE poolID = ? ORDER BY prestatieID',
      [createdPool.poolID]
    );
    assert.deepEqual(await readPoolPoints(), standards);
    await connection.query('UPDATE tblPuntenToekenning SET Punten = 99 WHERE poolID = ? AND prestatieID = 1', [createdPool.poolID]);
    const customized = await readPoolPoints();
    assert.equal((await request(`/pools/${createdPool.poolID}`, 'PUT', { Naam: 'Updated pool', ...period }, admin)).status, 200);
    assert.deepEqual(await readPoolPoints(), customized);
    for (const [key, value] of Object.entries(period)) assert.equal(createdPool[key], value);
    const createdReload = await (await request(`/pools/${createdPool.poolID}`, 'GET', undefined, admin)).json();
    for (const [key, value] of Object.entries(period)) assert.equal(createdReload[key], value);
    assert.equal((await request('/pools/1', 'PUT', period, admin)).status, 200);
    assert.equal((await request('/pools/1', 'PUT', { Naam: 'Renamed test pool' }, admin)).status, 200);
    const adminPool = await (await request('/pools/1', 'GET', undefined, admin)).json();
    assert.equal(adminPool.StartInschr, period.StartInschr);
    assert.equal(adminPool.EindInschr, period.EindInschr);
    const overview = await (await request('/pools', 'GET', undefined, admin)).json();
    const overviewPool = overview.find(p => p.poolID === 1);
    assert.equal(overviewPool.StartInschr, period.StartInschr);
    assert.equal(overviewPool.EindInschr, period.EindInschr);
    const userPool = (await (await request('/me/pools', 'GET', undefined, user)).json()).find(p => p.poolID === 1);
    assert.equal(userPool.registrationStart, period.StartInschr);
    assert.equal(userPool.registrationEnd, period.EindInschr);
    assert.equal(userPool.closesAt, '2099-07-01T22:00:00.000Z');
    const storedPeriod = await connection.query(
      "SELECT DATE_FORMAT(StartInschr, '%Y-%m-%d %H:%i:%s') AS start, DATE_FORMAT(EindInschr, '%Y-%m-%d %H:%i:%s') AS end FROM tblPools WHERE poolID = 1"
    );
    assert.equal(storedPeriod[0].start, '2026-01-01 00:00:00');
    assert.equal(storedPeriod[0].end, '2099-07-01 00:00:00');
    for (const invalid of [
      { StartInschr: '2099-07-02' }, { EindInschr: '2025-12-31' },
      { StartInschr: '2027-02-31' }, { EindInschr: 'not-a-date' }
    ]) assert.equal((await request('/pools/1', 'PUT', invalid, admin)).status, 400);
    assert.equal((await request('/pools', 'POST', { tourID: 1, StartInschr: '2027-07-02', EindInschr: '2027-07-01' }, admin)).status, 400);
    assert.equal((await request('/pools/1', 'PUT', { StartInschr: null, EindInschr: null }, admin)).status, 200);
    const cleared = await (await request('/pools/1', 'GET', undefined, admin)).json();
    assert.equal(cleared.StartInschr, null);
    assert.equal(cleared.EindInschr, null);
    assert.equal((await request('/pools/1', 'PUT', period, admin)).status, 200);
    await connection.query("UPDATE tblPools SET EindInschr = '2000-01-01 00:00:00' WHERE poolID = 1");
    assert.equal((await request(`/me/entries/${deelnID}`, 'PUT', payload, user)).status, 403);
    assert.equal((await request('/me/entries', 'POST', payload, user)).status, 403);
    const pdf = await request(`/me/entries/${deelnID}/pdf`, 'GET', undefined, user);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.equal((await request('/auth/logout', 'POST', undefined, user)).status, 204);
    assert.equal((await request('/auth/session', 'GET', undefined, user)).status, 401);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (apiPool) await apiPool.end();
    if (emailService) {
      emailService.sendVerification = originalSendVerification;
      emailService.sendRegistrationNotice = originalSendRegistrationNotice;
    }
    if (oldDatabase === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = oldDatabase;
    if (created) await connection.query(`DROP DATABASE \`${database}\``);
    await connection.end();
  }
});
