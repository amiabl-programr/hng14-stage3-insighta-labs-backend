import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

const redisClient = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
);

redisClient.on('error', (err: Error) =>
  logger.error('[redis] Client error', { error: err.message }),
);

export const getCache = async (key: string): Promise<string | null> => {
  return await redisClient.get(key);
};

export const setCache = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  await redisClient.setex(key, ttlSeconds, value);
};

export const deleteCache = async (key: string): Promise<void> => {
  await redisClient.del(key);
};

export default redisClient;
