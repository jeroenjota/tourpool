import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test from 'node:test';
import { pool } from '../src/db.ts';
import { meRouter, publicRouter } from '../src/routes/me.ts';
import { errorHandler } from '../src/middleware/errorHandler.ts';
import { suggestTeamName } from '../src/teamName.ts';

test('suggestTeamName appends the shortest unused surname prefix in uppercase', () => {
  assert.equal(suggestTeamName('Alex', 'Verstegen', []), 'Alex V');
  assert.equal(suggestTeamName('Alex', 'Verstegen', ['Alex V']), 'Alex VE');
  assert.equal(suggestTeamName('Alex', 'Verstegen', ['Alex V', 'Alex VE']), 'Alex VER');
});

test('suggestTeamName uses a numbered suffix after all surname letters are used', () => {
  assert.equal(
    suggestTeamName('Ada', 'Li', ['Ada L', 'Ada LI']),
    'Ada LI 2',
  );
  assert.equal(suggestTeamName('Ada', null, ['Ada']), 'Ada 2');
});

test('suggestTeamName compares names without case or accent differences', () => {
  assert.equal(suggestTeamName('José', 'Élan', ['josé é']), 'José ÉL');
});

test('account and guest endpoints suggest a unique name within the selected pool', async () => {
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => ({
    query: async (sql) => {
      if (sql.includes('FROM tblPools p JOIN tblTours')) {
        return [{
          poolID: 4, tourID: 7, Naam: 'Pool', Org: 'Organisatie',
          tourNaam: 'Tour 2027', tourStart: '2027-07-04T00:00:00',
          registrationStart: null, registrationEnd: null,
          PloegRennerAantal: 8, PloegReserveAantal: 2, inleg: 5,
        }];
      }
      if (sql.includes('SELECT vNaam, aNaam FROM tblAdressen')) {
        return [{ vNaam: 'Alex', aNaam: 'Verstegen' }];
      }
      if (sql.includes('SELECT roepnaam FROM tblDeelnemers')) {
        return [{ roepnaam: 'Alex V' }, { roepnaam: 'Alex VE' }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    release() {},
  });
  const app = express();
  app.use((request, _response, next) => {
    request.account = { accountID: 1, adrID: 2, username: 'alex', email: '', role: 'user' };
    next();
  });
  app.use('/me', meRouter);
  app.use('/public', publicRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const accountResponse = await fetch(`${base}/me/pools/4/suggested-team-name`);
    assert.equal(accountResponse.status, 200);
    assert.deepEqual(await accountResponse.json(), { ploegnaam: 'Alex VER' });

    const guestResponse = await fetch(
      `${base}/public/pools/4/suggested-team-name?firstName=Alex&lastName=Verstegen`,
    );
    assert.equal(guestResponse.status, 200);
    assert.deepEqual(await guestResponse.json(), { ploegnaam: 'Alex VER' });
  } finally {
    pool.getConnection = originalGetConnection;
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
});
