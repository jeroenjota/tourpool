import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { recalculatePoolPoints } from './stageResults.js';

type DatabaseConnection = Awaited<ReturnType<typeof pool.getConnection>>;
class AllocationNotFoundError extends Error {}

const changePoolAllocations = async <T>(
  poolID: number, change: (connection: DatabaseConnection) => Promise<T>
): Promise<T> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const rows = await connection.query(
      'SELECT poolID, tourID FROM tblPools WHERE poolID = ? FOR UPDATE', [poolID]
    ) as Array<{ poolID: number; tourID: number }>;
    if (!rows[0]) throw new AllocationNotFoundError('Pool not found');
    const result = await change(connection);
    await recalculatePoolPoints(connection, poolID, rows[0].tourID);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const pointAllocationsRouter = Router();

const createPointAllocationSchema = z.object({
  prestatieID: z.number().int(),
  poolID: z.number().int(),
  Omschrijving: z.string().max(100).nullable().optional(),
  Punten: z.number().int().nullable().optional(),
  uitslagtype: z.string().max(10).nullable().optional(),
  plaats: z.number().int().nullable().optional(),
  volgorde: z.number().int().nullable().optional()
});

const updatePointAllocationSchema = z.object({
  Omschrijving: z.string().max(100).nullable().optional(),
  Punten: z.number().int().nullable().optional(),
  uitslagtype: z.string().max(10).nullable().optional(),
  plaats: z.number().int().nullable().optional()
});

pointAllocationsRouter.get('/', async (request, response, next) => {
  try {
    const { poolID, prestatieID } = request.query;
    let query = 'SELECT prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde FROM tblPuntenToekenning';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (poolID !== undefined && poolID !== '') {
      conditions.push('poolID = ?');
      params.push(Number(poolID));
    }

    if (prestatieID !== undefined && prestatieID !== '') {
      conditions.push('prestatieID = ?');
      params.push(Number(prestatieID));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY poolID, prestatieID';

    const rows = await pool.query(query, params);
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.get('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);

    const rows = await pool.query(
      'SELECT prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ? ORDER BY prestatieID',
      [prestatieID, poolID]
    );
    const item = (rows as Array<Record<string, unknown>>)[0];

    if (!item) {
      response.status(404).json({ message: 'Point allocation not found' });
      return;
    }

    response.json(item);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.post('/', async (request, response, next) => {
  try {
    const payload = createPointAllocationSchema.parse(request.body);
    await changePoolAllocations(payload.poolID, connection => connection.query(
      'INSERT INTO tblPuntenToekenning (prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [payload.prestatieID, payload.poolID, payload.Omschrijving ?? null, payload.Punten ?? null, payload.uitslagtype ?? null, payload.plaats ?? null, payload.volgorde ?? null]
    ));

    response.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.put('/load/:poolID', async (request, response, next) => {
  try {
    const poolID = z.coerce.number().int().positive().parse(request.params.poolID);
    await changePoolAllocations(poolID, async connection => {
      await connection.query('DELETE FROM tblPuntenToekenning WHERE poolID = ?', [poolID]);
      await connection.query(
        `INSERT INTO tblPuntenToekenning
          (prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde)
         SELECT prestatieID, ?, Omschrijving, punten, uitslagtype, plaats, volgorde
         FROM tblStandaardPunten`,
        [poolID]
      );
    });
    response.json({ poolID, success: true });
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.put('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);
    const payload = updatePointAllocationSchema.parse(request.body);

    const result = await changePoolAllocations(poolID, async connection => {
      const rows = await connection.query(
        'SELECT prestatieID, poolID, Omschrijving, Punten, uitslagtype, plaats, volgorde FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ?',
        [prestatieID, poolID]
      );
      const current = (rows as Array<Record<string, unknown>>)[0];

      if (!current) throw new AllocationNotFoundError('Point allocation not found');

      const updated = {
        Omschrijving: payload.Omschrijving !== undefined ? payload.Omschrijving : current.Omschrijving,
        Punten: payload.Punten !== undefined ? payload.Punten : current.Punten,
        uitslagtype: payload.uitslagtype !== undefined ? payload.uitslagtype : current.uitslagtype,
        plaats: payload.plaats !== undefined ? payload.plaats : current.plaats,
      };

      await connection.query(
        'UPDATE tblPuntenToekenning SET Omschrijving = ?, Punten = ?, uitslagtype = ?, plaats = ? WHERE prestatieID = ? AND poolID = ?',
        [updated.Omschrijving, updated.Punten, updated.uitslagtype, updated.plaats, prestatieID, poolID]
      );

      return { prestatieID, poolID, ...updated, volgorde: current.volgorde };
    });

    response.json(result);
  } catch (error) {
    next(error);
  }
});

pointAllocationsRouter.delete('/:prestatieID/:poolID', async (request, response, next) => {
  try {
    const prestatieID = Number(request.params.prestatieID);
    const poolID = Number(request.params.poolID);

    await changePoolAllocations(poolID, connection => connection.query(
      'DELETE FROM tblPuntenToekenning WHERE prestatieID = ? AND poolID = ?',
      [prestatieID, poolID]
    ));

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

const allocationErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (error instanceof AllocationNotFoundError) {
    response.status(404).json({ message: error.message });
    return;
  }
  next(error);
};
pointAllocationsRouter.use(allocationErrorHandler);
