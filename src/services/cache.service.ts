import { connection } from '../lib/queue.js';
import { logger } from '../config/logger.js';

export const getCache = async (key: string): Promise<string | null> => {
  if (!connection) return null;

  try {
    return await connection.get(key);
  } catch (err) {
    logger.warn('[redis] Cache read skipped', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
};

export const setCache = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  if (!connection) return;

  try {
    await connection.setex(key, ttlSeconds, value);
  } catch (err) {
    logger.warn('[redis] Cache write skipped', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  if (!connection) return;

  try {
    await connection.del(key);
  } catch (err) {
    logger.warn('[redis] Cache delete skipped', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};

export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  if (!connection) return;

  try {
    const stream = connection.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) {
        await connection.del(...keys);
      }
    }
  } catch (err) {
    logger.warn('[redis] Cache pattern delete skipped', {
      pattern,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};
