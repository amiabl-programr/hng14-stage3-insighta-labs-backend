import app from './app.js';
import { logger } from './config/logger.js';
import { startWorker, stopWorker } from './workers/upload.worker.js';
import { closeQueue } from './queues/upload.queue.js';
import { closeRedis } from './lib/queue.js';

const PORT = process.env.PORT || 3000;

async function main() {
  await startWorker();

  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });

  async function shutdown(signal: string) {
    logger.info(`[server] ${signal} received — shutting down gracefully`);
    server.close();
    await stopWorker();
    await closeQueue();
    await closeRedis();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('[server] Failed to start', {
    error: err instanceof Error ? err.message : 'unknown',
  });
  process.exit(1);
});
