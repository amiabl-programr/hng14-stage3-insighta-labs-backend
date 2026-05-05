import { createClient } from 'redis';
import { logger } from '../config/logger.js';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) =>
  logger.error('[redis] Client error', { error: err.message }),
);

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

connectRedis();

export const getCache = async (key: string): Promise<string | null> => {
  return await redisClient.get(key);
};

export const setCache = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  await redisClient.setEx(key, ttlSeconds, value);
};

export const deleteCache = async (key: string): Promise<void> => {
  await redisClient.del(key);
};

export default redisClient;
