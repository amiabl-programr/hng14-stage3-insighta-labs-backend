import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  logger.warn('[queue] REDIS_URL not set — BullMQ unavailable');
}

export const connection = REDIS_URL
  ? new Redis(REDIS_URL, { maxRetriesPerRequest: null })
  : null;

connection?.on('error', (err: Error) => {
  logger.error('[queue-redis] Connection error', { error: err.message });
});

export async function closeRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    logger.info('[queue-redis] Connection closed');
  }
}
