import 'dotenv/config';
import mariadb from 'mariadb';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'jeroen',
  DB_PASSWORD = 'dev9046',
  DB_NAME = 'tourpool'
} = process.env;

export const pool = mariadb.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  acquireTimeout: 60000
});