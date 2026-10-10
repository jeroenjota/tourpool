import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db.ts';
import { emailService } from '../src/email.ts';
import { apiRouter } from '../src/routes/index.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';
import { hashPassword, hashToken, verifyPassword } from '../src/auth.ts';

test('Pool managers, account roles and password resets are enforced by the API', async t => {
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  const originalSendPasswordReset = emailService.sendPasswordReset;
  const csrf = 'c'.repeat(64);
  const tokens = { admin: 'a'.repeat(64), manager: 'b'.repeat(64), user: 'd'.repeat(64) };
  const passwordHash = await hashPassword('old-strong-password');
  const accounts = [
    { accountID: 1, adrID: 10, username: 'admin', email: 'admin@example.test', role: 'admin', emailVerified: true, passwordHash },
    { accountID: 2, adrID: 20, username: 'beheer', email: 'beheer@example.test', role: 'poolbeheerder', emailVerified: true, passwordHash },
    { accountID: 3, adrID: 30, username: 'jan', email: 'jan@example.test', role: 'user', emailVerified: true, passwordHash }
  ];
  let managers = [{ accountID: 2, poolID: 1 }];
  const participants = [
    { deelnID: 1, poolID: 1, adrID: 30, ploegnaam: 'Jan', Betaald: 0 },
    { deelnID: 2, poolID: 2, adrID: 40, ploegnaam: 'Piet', Betaald: 0 }
  ];
  const accountIDs = { admin: 1, manager: 2, user: 3 };
  let sessions = Object.entries(tokens).map(([name, token]) => ({ tokenHash: hashToken(token), accountID: accountIDs[name] }));
  const resets = new Map();
  const resetEmails = [];
  const executed = [];
  emailService.sendPasswordReset = async (email, token) => { resetEmails.push({ email, token }); };

  const query = async (sql, params = []) => {
    assert.equal((sql.match(/\?/g) ?? []).length, params.length, sql);
    executed.push({ sql, params });
    if (sql.includes('FROM tblSessions s')) {
      const session = sessions.find(item => item.tokenHash === params[0]);
      const account = session && accounts.find(item => item.accountID === session.accountID);
      return account ? [{ ...account, csrfToken: csrf }] : [];
    }
    if (sql.includes('SELECT') && sql.includes('FROM tblPoolManagers WHERE accountID = ?')) {
      return managers.filter(item => item.accountID === params[0]).map(({ poolID }) => ({ poolID }));
    }
    if (sql.includes('FROM tblDeelnemers WHERE deelnID = ?')) {
      return participants.filter(item => item.deelnID === params[0]);
    }
    if (sql.includes('FROM tblPools p') && sql.includes('LEFT JOIN tblTours')) {
      const ids = sql.includes('IN (') ? params : [1, 2];
      return ids.map(poolID => ({ poolID, tourID: 1, Naam: `Pool ${poolID}` }));
    }
    if (sql.includes('SELECT * FROM tblOpties WHERE poolID = ?')) return [{ poolID: params[0], inleg: 10 }];
    if (sql.includes('FROM tblAccounts WHERE adrID = ? AND emailVerified = TRUE')) {
      const adrID = params[0];
      const managed = params.slice(2);
      const isAccount = accounts.some(account => account.adrID === adrID && account.role !== 'admin');
      const inPool = participants.some(item => item.adrID === adrID && managed.includes(item.poolID));
      return isAccount || inPool ? [{ 1: 1 }] : [];
    }
    if (sql.includes('INSERT INTO tblAdressen')) return { insertId: 99 };
    if (sql.includes('INSERT INTO tblDeelnemers')) return { insertId: 50 };
    if (sql.includes('FROM tblAccounts WHERE username = ? OR email = ?') && sql.includes('passwordHash')) {
      return accounts.filter(account => params.includes(account.username) || params.includes(account.email));
    }
    if (sql.includes('SELECT accountID, email FROM tblAccounts WHERE username = ? OR email = ?')) {
      return accounts.filter(account => params.includes(account.username) || params.includes(account.email));
    }
    if (sql.includes('INSERT INTO tblPasswordResets')) { resets.set(params[0], params[1]); return {}; }
    if (sql.includes('DELETE FROM tblPasswordResets')) {
      for (const [hash, accountID] of resets) if (accountID === params[0]) resets.delete(hash);
      return {};
    }
    if (sql.includes('SELECT accountID FROM tblPasswordResets WHERE tokenHash = ?')) {
      return resets.has(params[0]) ? [{ accountID: resets.get(params[0]) }] : [];
    }
    if (sql.includes('UPDATE tblAccounts SET passwordHash = ?')) {
      accounts.find(account => account.accountID === params[1]).passwordHash = params[0];
      return {};
    }
    if (sql.includes('SELECT passwordHash FROM tblAccounts WHERE accountID = ?')) {
      return accounts.filter(account => account.accountID === params[0]);
    }
    if (sql.includes('DELETE FROM tblSessions WHERE accountID = ? AND tokenHash <> ?')) {
      sessions = sessions.filter(item => item.accountID !== params[0] || item.tokenHash === params[1]);
      return {};
    }
    if (sql.includes('DELETE FROM tblSessions WHERE accountID = ?')) {
      sessions = sessions.filter(item => item.accountID !== params[0]);
      return {};
    }
    if (sql.includes('SELECT accountID FROM tblAccounts WHERE accountID = ? FOR UPDATE')) {
      return accounts.filter(account => account.accountID === params[0]);
    }
    if (sql.includes('SELECT poolID FROM tblPools WHERE poolID IN')) {
      return params.filter(poolID => poolID <= 2).map(poolID => ({ poolID }));
    }
    if (sql.includes('UPDATE tblAccounts SET role = ?')) {
      accounts.find(account => account.accountID === params[1]).role = params[0];
      return {};
    }
    if (sql.includes('DELETE FROM tblPoolManagers WHERE accountID = ?')) {
      managers = managers.filter(item => item.accountID !== params[0]);
      return {};
    }
    if (sql.includes('INSERT INTO tblPoolManagers')) {
      managers.push({ accountID: params[0], poolID: params[1] });
      return {};
    }
    if (sql.trim().startsWith('SELECT')) return [];
    return { affectedRows: 1 };
  };
  pool.query = query;
  pool.getConnection = async () => ({
    query, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}
  });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const request = (path, method = 'GET', body, who = 'manager') => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(who ? { Cookie: `tourpool_session=${tokens[who]}`, 'X-CSRF-Token': csrf } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  try {
    await t.test('Pool managers only see and change their own pools', async () => {
      const pools = await request('/pools');
      assert.equal(pools.status, 200);
      assert.deepEqual((await pools.json()).map(item => item.poolID), [1]);
      assert.equal((await request('/participants?poolID=1')).status, 200);
      assert.equal((await request('/participants?poolID=2')).status, 403);
      assert.equal((await request('/participants')).status, 403);
      assert.equal((await request('/participants/1', 'PUT', { Betaald: 1 })).status, 200);
      assert.equal((await request('/participants/2', 'PUT', { Betaald: 1 })).status, 403);
      assert.equal((await request('/participants/1', 'PUT', { poolID: 2 })).status, 403);
      assert.equal((await request('/participants/1', 'PUT', { adrID: 40 })).status, 403);
      assert.equal((await request('/participants/2', 'DELETE')).status, 403);
      assert.equal((await request('/participant-riders?poolID=1')).status, 200);
      assert.equal((await request('/participant-riders')).status, 403);
      assert.equal((await request('/participant-riders/batch/2', 'PUT', { riders: [] })).status, 403);
      assert.equal((await request('/participant-points?poolID=1')).status, 200);
      assert.ok(executed.some(item => item.sql.includes('JOIN tblDeelnemers d ON d.deelnID = dp.deelnemID')));
      assert.equal((await request('/participant-points')).status, 403);
      assert.equal((await request('/options/1')).status, 200);
      assert.equal((await request('/options/2', 'PUT', { inleg: 5 })).status, 403);
      assert.equal((await request('/options')).status, 403);
      assert.equal((await request('/point-allocations?poolID=2')).status, 403);
      assert.equal((await request('/point-allocations/load/2', 'PUT', {})).status, 403);
      assert.equal((await request('/point-allocations/7/2', 'DELETE')).status, 403);
      assert.equal((await request('/stage-results/recalculate/2', 'POST')).status, 403);
      assert.equal((await request('/stages')).status, 200);
      assert.equal((await request('/standard-points')).status, 200);
      assert.equal((await request('/accounts')).status, 200);
    });

    await t.test('Pool managers cannot reach admin-only resources or the address book', async () => {
      for (const path of ['/tours', '/addresses', '/riders', '/teams', '/admin/email-test', '/accounts/manage']) {
        assert.equal((await request(path)).status, 403, path);
      }
      assert.equal((await request('/pools', 'POST', { tourID: 1, Naam: 'Nieuw' })).status, 403);
      assert.equal((await request('/pools/1', 'DELETE')).status, 403);
      assert.equal((await request('/stages', 'POST', {})).status, 403);
      assert.equal((await request('/accounts/3', 'PUT', { role: 'admin' })).status, 403);
      assert.equal((await request('/pools', 'GET', undefined, 'user')).status, 403);
    });

    await t.test('Pool managers add registered accounts or new people, never arbitrary addresses', async () => {
      assert.equal((await request('/participants', 'POST', { poolID: 1, adrID: 40 })).status, 403);
      assert.equal((await request('/participants', 'POST', { poolID: 2, adrID: 30 })).status, 403);
      const fromAccount = await request('/participants', 'POST', { poolID: 1, adrID: 30, ploegnaam: 'Jan 2' });
      assert.equal(fromAccount.status, 201);
      const created = await request('/participants', 'POST', {
        poolID: 1, ploegnaam: 'Nieuwe ploeg', newAddress: { vNaam: 'Kees', aNaam: 'Nieuw', email: 'KEES@example.test' }
      });
      assert.equal(created.status, 201);
      assert.equal((await created.json()).adrID, 99);
      const insert = executed.find(item => item.sql.includes('INSERT INTO tblAdressen'));
      assert.equal(insert.params[5], 'kees@example.test');
      assert.equal((await request('/participants', 'POST', {
        poolID: 1, adrID: 30, newAddress: { aNaam: 'Dubbel' }
      })).status, 400);
    });

    await t.test('Admins assign roles and managed pools, but cannot demote themselves', async () => {
      const updated = await request('/accounts/3', 'PUT', { role: 'poolbeheerder', poolIDs: [2, 2] }, 'admin');
      assert.equal(updated.status, 200);
      assert.deepEqual((await updated.json()).poolIDs, [2]);
      assert.deepEqual(managers.filter(item => item.accountID === 3), [{ accountID: 3, poolID: 2 }]);
      assert.equal((await request('/accounts/3', 'PUT', { role: 'poolbeheerder', poolIDs: [9] }, 'admin')).status, 400);
      const demoted = await request('/accounts/3', 'PUT', { role: 'user', poolIDs: [2] }, 'admin');
      assert.equal(demoted.status, 200);
      assert.equal(managers.some(item => item.accountID === 3), false);
      assert.equal((await request('/accounts/1', 'PUT', { role: 'user' }, 'admin')).status, 400);
      assert.equal((await request('/accounts/manage', 'GET', undefined, 'admin')).status, 200);
    });

    await t.test('Password changes require the current password and sign out other sessions', async () => {
      assert.equal((await request('/auth/password', 'POST', {
        currentPassword: 'wrong-password', newPassword: 'new-strong-password'
      }, 'user')).status, 400);
      sessions.push({ tokenHash: hashToken('e'.repeat(64)), accountID: 3 });
      const changed = await request('/auth/password', 'POST', {
        currentPassword: 'old-strong-password', newPassword: 'new-strong-password'
      }, 'user');
      assert.equal(changed.status, 200);
      assert.equal(await verifyPassword('new-strong-password', accounts[2].passwordHash), true);
      assert.deepEqual(sessions.filter(item => item.accountID === 3).map(item => item.tokenHash), [hashToken(tokens.user)]);
      assert.equal((await request('/auth/password', 'POST', {
        currentPassword: 'new-strong-password', newPassword: 'short'
      }, 'user')).status, 400);
    });

    await t.test('Forgotten passwords are reset with a single-use e-mail token', async () => {
      const unknown = await request('/auth/forgot-password', 'POST', { identifier: 'nobody@example.test' }, null);
      assert.equal(unknown.status, 202);
      const known = await request('/auth/forgot-password', 'POST', { identifier: 'JAN' }, null);
      assert.equal(known.status, 202);
      assert.deepEqual(await unknown.json(), await known.json());
      await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(resetEmails.length, 1);
      assert.equal(resetEmails[0].email, 'jan@example.test');
      assert.equal((await request('/auth/reset-password', 'POST', {
        token: 'f'.repeat(64), password: 'reset-strong-password'
      }, null)).status, 400);
      const reset = await request('/auth/reset-password', 'POST', {
        token: resetEmails[0].token, password: 'reset-strong-password'
      }, null);
      assert.equal(reset.status, 200);
      assert.equal(await verifyPassword('reset-strong-password', accounts[2].passwordHash), true);
      assert.equal(sessions.some(item => item.accountID === 3), false);
      assert.equal((await request('/auth/reset-password', 'POST', {
        token: resetEmails[0].token, password: 'another-strong-password'
      }, null)).status, 400);
    });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    emailService.sendPasswordReset = originalSendPasswordReset;
    await pool.end();
  }
});
