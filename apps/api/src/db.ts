import 'dotenv/config';
import mariadb from 'mariadb';
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME
} = process.env;

if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  throw new Error('Missing required database environment variables');
}

export const pool = mariadb.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  // MariaDB 10.11 (productie) levert o.a. TIMESTAMPDIFF als BIGINT; dat kan niet naar JSON.
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  acquireTimeout: 60000
});