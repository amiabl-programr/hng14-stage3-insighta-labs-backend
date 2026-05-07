import type { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { uploadQueue } from '../queues/upload.queue.js';
import { logger } from '../config/logger.js';

export const getJobStatus = catchAsync(async (req: Request, res: Response) => {
  const jobId = req.params.jobId as string;

  if (!uploadQueue) {
    return res
      .status(503)
      .json({ status: 'error', message: 'Queue service unavailable' });
  }

  const job = await uploadQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({ status: 'error', message: 'Job not found' });
  }

  const state = await job.getState();

  const response: Record<string, unknown> = {
    status: 'success',
    data: {
      job_id: job.id,
      state,
      progress: job.progress,
      file: job.data.originalName,
    },
  };

  if (state === 'completed' && job.returnvalue) {
    response.data = {
      ...(response.data as Record<string, unknown>),
      result: job.returnvalue,
    };
  }

  if (state === 'failed') {
    response.data = {
      ...(response.data as Record<string, unknown>),
      error: job.failedReason,
    };
  }

  logger.debug('[job] Status check', {
    job_id: jobId,
    state,
    progress: job.progress,
  });

  return res.json(response);
});
