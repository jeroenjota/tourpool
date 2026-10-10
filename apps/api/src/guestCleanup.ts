import { pool } from './db.js';

export const guestEntryLifetimeHours = 48;

// Verwijdert gastploegen (zonder account) die na 48 uur nog niet betaald zijn.
export async function removeExpiredGuestEntries() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const expired = await connection.query(
      `SELECT deelnID, adrID FROM tblDeelnemers
       WHERE gast = 1 AND COALESCE(Betaald, 0) = 0 AND aangemaakt < NOW() - INTERVAL ? HOUR FOR UPDATE`,
      [guestEntryLifetimeHours]
    ) as Array<{ deelnID: number; adrID: number }>;
    if (!expired.length) {
      await connection.commit();
      return 0;
    }
    const deelnIDs = expired.map(row => row.deelnID);
    const adrIDs = [...new Set(expired.map(row => row.adrID))];
    await connection.query('DELETE FROM tblDeelnemerPunten WHERE deelnemID IN (?)', [deelnIDs]);
    await connection.query('DELETE FROM tblDeelnemRenners WHERE deelnID IN (?)', [deelnIDs]);
    await connection.query('DELETE FROM tblDeelnemers WHERE deelnID IN (?)', [deelnIDs]);
    await connection.query(
      `DELETE FROM tblAdressen WHERE adrID IN (?)
       AND NOT EXISTS (SELECT 1 FROM tblDeelnemers d WHERE d.adrID = tblAdressen.adrID)
       AND NOT EXISTS (SELECT 1 FROM tblAccounts a WHERE a.adrID = tblAdressen.adrID)`,
      [adrIDs]
    );
    await connection.commit();
    return deelnIDs.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export function scheduleGuestCleanup(intervalMs = 60 * 60 * 1000) {
  const run = () => removeExpiredGuestEntries()
    .then(count => { if (count) console.log(`Niet-betaalde gastploegen verwijderd: ${count}`); })
    .catch(error => console.error('Opruimen gastploegen mislukt:', error));
  run();
  setInterval(run, intervalMs).unref();
}
