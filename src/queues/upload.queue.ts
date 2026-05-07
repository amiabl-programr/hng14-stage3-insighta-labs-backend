import { Queue } from 'bullmq';
import { connection } from '../lib/queue.js';
import { logger } from '../config/logger.js';

export const uploadQueue = connection
  ? new Queue('csv-upload', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    })
  : null;

uploadQueue?.on('error', (err: Error) => {
  logger.error('[queue] csv-upload error', { error: err.message });
});

export async function closeQueue(): Promise<void> {
  await uploadQueue?.close();
}
