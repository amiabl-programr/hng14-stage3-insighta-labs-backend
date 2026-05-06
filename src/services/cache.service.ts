import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  : null;

redisClient?.on('error', (err: Error) =>
  logger.error('[redis] Client error', { error: err.message }),
);

let redisConnection: Promise<void> | null = null;

const getRedisClient = async (): Promise<Redis | null> => {
  if (!redisClient) return null;
  if (redisClient.status === 'ready') return redisClient;

  try {
    redisConnection ??= redisClient.connect().finally(() => {
      redisConnection = null;
    });
    await redisConnection;
    return redisClient;
  } catch (err) {
    logger.warn('[redis] Connection skipped', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
};

export const getCache = async (key: string): Promise<string | null> => {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    return await client.get(key);
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
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setex(key, ttlSeconds, value);
  } catch (err) {
    logger.warn('[redis] Cache write skipped', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (err) {
    logger.warn('[redis] Cache delete skipped', {
      key,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};

export const deleteCacheByPattern = async (pattern: string): Promise<void> => {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream as AsyncIterable<string[]>) {
      if (keys.length > 0) {
        await client.del(...keys);
      }
    }
  } catch (err) {
    logger.warn('[redis] Cache pattern delete skipped', {
      pattern,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
};

export default redisClient;
