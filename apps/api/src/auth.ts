import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from './db.js';

const scryptAsync = promisify(scrypt);
export const cookieName = 'tourpool_session';
export const sessionLifetime = 12 * 60 * 60 * 1000;
export interface Account {
  accountID: number;
  adrID: number;
  email: string;
  role: 'admin' | 'user';
}
declare global {
  namespace Express {
    interface Request {
      account?: Account;
      session?: { tokenHash: string; csrfToken: string };
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const profileSchema = z.object({
  vNaam: z.string().trim().min(1).max(24),
  tNaam: z.string().trim().max(12).default(''),
  aNaam: z.string().trim().min(1).max(24),
  plaats: z.string().trim().max(24).default(''),
  tel: z.string().trim().max(12).default('')
}).strict();
export const emailSchema = z.string().trim().email().max(64).transform(value => value.toLowerCase());
export const passwordSchema = z.string().min(12).max(128);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, hex] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) {
    throw new Error('Ongeldige opgeslagen wachtwoordhash');
  }
  const key = await scryptAsync(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
});

export const allowedOrigins = () => (process.env.AUTH_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(value => value.trim()).filter(Boolean);

export const checkOrigin: RequestHandler = (request, response, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('Origin');
    if (origin && !allowedOrigins().includes(origin)) {
      response.status(403).json({ message: 'Deze herkomst is niet toegestaan.' });
      return;
    }
  }
  next();
};

export const authenticate: RequestHandler = async (request, response, next) => {
  try {
    response.set('Cache-Control', 'no-store');
    const cookie = request.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) {
      response.status(401).json({ message: 'Log eerst in.' });
      return;
    }
    const rows = await pool.query(
      `SELECT a.accountID, a.adrID, a.email, a.role, s.csrfToken
       FROM tblSessions s JOIN tblAccounts a ON a.accountID = s.accountID
       WHERE s.tokenHash = ? AND s.expiresAt > UTC_TIMESTAMP()`, [hashToken(cookie)]
    ) as Array<Account & { csrfToken: string }>;
    const account = rows[0];
    if (!account) {
      response.status(401).json({ message: 'Je sessie is verlopen. Log opnieuw in.' });
      return;
    }
    request.account = { accountID: account.accountID, adrID: account.adrID, email: account.email, role: account.role };
    request.session = { tokenHash: hashToken(cookie), csrfToken: account.csrfToken };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.get('X-CSRF-Token') !== account.csrfToken) {
      response.status(403).json({ message: 'Ongeldige beveiligingstoken. Log opnieuw in.' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (request, response, next) => {
  if (request.account?.role !== 'admin') {
    response.status(403).json({ message: 'Alleen beheerders hebben toegang.' });
    return;
  }
  next();
};

export function getAccount(request: Express.Request): Account {
  if (!request.account) throw new HttpError(401, 'Log eerst in.');
  return request.account;
}

export const isDuplicate = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ER_DUP_ENTRY';
