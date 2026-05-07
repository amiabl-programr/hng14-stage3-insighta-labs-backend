import type { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { logger } from '../config/logger.js';
import { uploadQueue } from '../queues/upload.queue.js';

export const uploadCSV = catchAsync(async (req: Request, res: Response) => {
  if (!req.file?.path) {
    return res
      .status(400)
      .json({ status: 'error', message: 'No file uploaded' });
  }

  if (!uploadQueue) {
    return res
      .status(503)
      .json({ status: 'error', message: 'Queue service unavailable' });
  }

  const job = await uploadQueue.add('process-csv', {
    filePath: req.file.path,
    originalName: req.file.originalname,
    uploadedBy: req.user?.id,
  });

  logger.info('[csv] Upload queued', {
    job_id: job.id,
    file: req.file.originalname,
  });

  return res.status(202).json({
    status: 'success',
    message: 'Upload queued for processing',
    data: { job_id: job.id },
  });
});
