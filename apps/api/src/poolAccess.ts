import type { Request, RequestHandler } from 'express';
import { pool } from './db.js';
import { HttpError } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      // Only set for pool managers; admins see every pool.
      managedPoolIDs?: number[];
    }
  }
}

type PoolResolver = (request: Request, match: RegExpMatchArray) => Promise<Array<number | undefined>> | Array<number | undefined>;
export interface PoolRule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: RegExp;
  pools: PoolResolver | 'any';
}

export const toPoolID = (value: unknown) => {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

export async function poolOfParticipant(deelnID: unknown) {
  const id = toPoolID(deelnID);
  if (id === undefined) return undefined;
  const rows = await pool.query('SELECT poolID FROM tblDeelnemers WHERE deelnID = ?', [id]) as Array<{ poolID: number }>;
  return rows[0] ? Number(rows[0].poolID) : undefined;
}

export async function loadManagedPoolIDs(accountID: number) {
  const rows = await pool.query(
    'SELECT poolID FROM tblPoolManagers WHERE accountID = ? ORDER BY poolID', [accountID]
  ) as Array<{ poolID: number }>;
  return rows.map(row => Number(row.poolID));
}

export const requireStaff: RequestHandler = (request, response, next) => {
  if (request.account?.role !== 'admin' && request.account?.role !== 'poolbeheerder') {
    response.status(403).json({ message: 'Alleen beheerders hebben toegang.' });
    return;
  }
  next();
};

/** Admins pass; pool managers only reach the listed endpoints for pools they manage. */
export function poolScope(rules: PoolRule[]): RequestHandler {
  return async (request, _response, next) => {
    try {
      const account = request.account;
      if (account?.role === 'admin') return next();
      if (account?.role !== 'poolbeheerder') throw new HttpError(403, 'Alleen beheerders hebben toegang.');
      const method = request.method === 'HEAD' ? 'GET' : request.method;
      const found = rules.map(item => ({ rule: item, match: item.method === method ? request.path.match(item.path) : null }))
        .find(item => item.match);
      if (!found?.match) throw new HttpError(403, 'Dit onderdeel is alleen beschikbaar voor beheerders.');
      const { rule, match } = found;
      const managed = await loadManagedPoolIDs(account.accountID);
      request.managedPoolIDs = managed;
      if (rule.pools === 'any') return next();
      const poolIDs = await rule.pools(request, match);
      if (!poolIDs.length || poolIDs.some(poolID => poolID === undefined || !managed.includes(poolID))) {
        throw new HttpError(403, 'Je hebt geen toegang tot deze pool.');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

const readOnly: PoolRule[] = [{ method: 'GET', path: /^\//, pools: 'any' }];

export const poolRules = {
  pools: [
    { method: 'GET', path: /^\/?$/, pools: 'any' },
    { method: 'GET', path: /^\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] }
  ],
  participants: [
    { method: 'GET', path: /^\/?$/, pools: request => [toPoolID(request.query.poolID)] },
    { method: 'GET', path: /^\/(\d+)\/?$/, pools: async (_request, match) => [await poolOfParticipant(match[1])] },
    { method: 'POST', path: /^\/?$/, pools: request => [toPoolID(request.body?.poolID)] },
    { method: 'PUT', path: /^\/(\d+)\/account\/?$/, pools: async (_request, match) => [await poolOfParticipant(match[1])] },
    {
      method: 'PUT', path: /^\/(\d+)\/?$/, pools: async (request, match) => {
        if (request.body?.adrID !== undefined) throw new HttpError(403, 'Alleen beheerders kunnen de persoon van een deelname wijzigen.');
        const current = await poolOfParticipant(match[1]);
        return request.body?.poolID === undefined ? [current] : [current, toPoolID(request.body.poolID)];
      }
    },
    { method: 'DELETE', path: /^\/(\d+)\/?$/, pools: async (_request, match) => [await poolOfParticipant(match[1])] }
  ],
  participantRiders: [
    {
      method: 'GET', path: /^\/?$/, pools: async request => request.query.poolID !== undefined
        ? [toPoolID(request.query.poolID)]
        : [await poolOfParticipant(request.query.deelnID)]
    },
    { method: 'PUT', path: /^\/batch\/(\d+)\/?$/, pools: async (_request, match) => [await poolOfParticipant(match[1])] }
  ],
  participantPoints: [
    { method: 'GET', path: /^\/?$/, pools: request => [toPoolID(request.query.poolID)] }
  ],
  options: [
    { method: 'GET', path: /^\/?$/, pools: request => [toPoolID(request.query.poolID)] },
    { method: 'GET', path: /^\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] },
    { method: 'PUT', path: /^\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] }
  ],
  pointAllocations: [
    { method: 'GET', path: /^\/?$/, pools: request => [toPoolID(request.query.poolID)] },
    { method: 'GET', path: /^\/\d+\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] },
    { method: 'POST', path: /^\/?$/, pools: request => [toPoolID(request.body?.poolID)] },
    { method: 'PUT', path: /^\/load\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] },
    { method: 'PUT', path: /^\/\d+\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] },
    { method: 'DELETE', path: /^\/\d+\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] }
  ],
  stageResults: [
    ...readOnly,
    { method: 'POST', path: /^\/recalculate\/(\d+)\/?$/, pools: (_request, match) => [toPoolID(match[1])] }
  ],
  readOnly
} satisfies Record<string, PoolRule[]>;
