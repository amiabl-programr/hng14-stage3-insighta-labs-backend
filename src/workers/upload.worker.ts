import { Worker, type Job } from 'bullmq';
import { connection } from '../lib/queue.js';
import { prisma } from '../lib/prisma.js';
import { classifyAgeGroup } from '../utils/classify.js';
import { invalidateProfilesCache } from '../models/profile.model.js';
import { logger } from '../config/logger.js';
import csv from 'fast-csv';
import fs from 'fs';
import { unlink } from 'fs/promises';

interface CSVRow {
  name?: string;
  gender?: string;
  age?: string | number;
  country_id?: string;
}

interface UploadSummary {
  total_rows: number;
  inserted: number;
  skipped: number;
  reasons: {
    duplicate_name: number;
    invalid_age: number;
    missing_fields: number;
    invalid_gender: number;
  };
}

interface CSVJobData {
  filePath: string;
  originalName: string;
  uploadedBy?: string;
}

function normalizeRow(
  row: CSVRow,
  summary: UploadSummary,
  existingNames: Set<string>,
): CSVRow | null {
  const name = row.name?.trim().toLowerCase();
  const genderRaw = row.gender?.trim().toLowerCase();
  const countryId = row.country_id?.trim().toUpperCase();

  if (!name || !genderRaw || row.age === undefined || !countryId) {
    summary.skipped++;
    summary.reasons.missing_fields++;
    return null;
  }

  const age = typeof row.age === 'string' ? parseInt(row.age, 10) : row.age;
  if (isNaN(age) || age < 0) {
    summary.skipped++;
    summary.reasons.invalid_age++;
    return null;
  }

  if (!['male', 'female'].includes(genderRaw)) {
    summary.skipped++;
    summary.reasons.invalid_gender++;
    return null;
  }

  if (existingNames.has(name)) {
    summary.skipped++;
    summary.reasons.duplicate_name++;
    return null;
  }

  existingNames.add(name);
  return { name, gender: genderRaw, age, country_id: countryId };
}

async function processBatch(
  batch: CSVRow[],
  summary: UploadSummary,
): Promise<number> {
  try {
    const names = batch.map((row) => row.name!);
    const existingProfiles = await prisma.profile.findMany({
      where: { name: { in: names } },
      select: { name: true },
    });
    const existingNames = new Set(
      existingProfiles.map((profile) => profile.name),
    );

    const profiles = batch
      .filter((row) => {
        if (existingNames.has(row.name!)) {
          summary.skipped++;
          summary.reasons.duplicate_name++;
          return false;
        }
        return true;
      })
      .map((row) => ({
        id: crypto.randomUUID(),
        name: row.name!,
        gender: row.gender!,
        gender_probability: 0,
        sample_size: 0,
        age: row.age as number,
        age_group: classifyAgeGroup(row.age as number),
        country_id: row.country_id!,
        country_probability: 0,
        country_name: '',
      }));

    if (profiles.length === 0) return 0;

    const result = await prisma.profile.createMany({
      data: profiles,
      skipDuplicates: true,
    });

    const skippedByCreateMany = profiles.length - result.count;
    if (skippedByCreateMany > 0) {
      summary.skipped += skippedByCreateMany;
      summary.reasons.duplicate_name += skippedByCreateMany;
    }

    return result.count;
  } catch (err) {
    logger.error('[worker] Batch insert error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return 0;
  }
}

async function processCSV(
  filePath: string,
  onProgress: (pct: number) => void,
): Promise<UploadSummary> {
  const summary: UploadSummary = {
    total_rows: 0,
    inserted: 0,
    skipped: 0,
    reasons: {
      duplicate_name: 0,
      invalid_age: 0,
      missing_fields: 0,
      invalid_gender: 0,
    },
  };

  const batchSize = 1000;
  let batch: CSVRow[] = [];
  const existingNames = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const csvStream = csv
      .parse<CSVRow, CSVRow>({ headers: true })
      .on('error', reject)
      .on('data', async (row: CSVRow) => {
        csvStream.pause();

        try {
          summary.total_rows++;

          const normalized = normalizeRow(row, summary, existingNames);
          if (normalized) {
            batch.push(normalized);
          }

          if (batch.length >= batchSize) {
            summary.inserted += await processBatch(batch, summary);
            batch = [];
            onProgress(0.5);
          }

          csvStream.resume();
        } catch (err) {
          reject(err);
        }
      })
      .on('end', resolve);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(csvStream);
  });

  if (batch.length > 0) {
    summary.inserted += await processBatch(batch, summary);
  }

  onProgress(1);

  if (summary.inserted > 0) {
    await invalidateProfilesCache();
  }

  return summary;
}

export const worker = connection
  ? new Worker<CSVJobData, UploadSummary>(
      'csv-upload',
      async (job: Job<CSVJobData>) => {
        const { filePath, originalName } = job.data;

        logger.info('[worker] Processing CSV', {
          job_id: job.id,
          file: originalName,
        });

        try {
          const summary = await processCSV(filePath, (pct) => {
            job.updateProgress(pct);
          });

          logger.info('[worker] CSV processed', {
            job_id: job.id,
            file: originalName,
            summary,
          });

          return summary;
        } finally {
          await unlink(filePath).catch((err) => {
            logger.warn('[worker] Failed to remove temp file', {
              path: filePath,
              error: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
      },
      { connection, concurrency: 1 },
    )
  : null;

worker?.on('completed', (job: Job) => {
  logger.info('[worker] Job completed', {
    job_id: job.id,
    file: job.data.originalName,
  });
});

worker?.on('failed', (job: Job | undefined, err: Error) => {
  logger.error('[worker] Job failed', {
    job_id: job?.id,
    file: job?.data?.originalName,
    error: err.message,
  });

  if (job?.data?.filePath) {
    unlink(job.data.filePath).catch(() => {});
  }
});

export async function startWorker(): Promise<void> {
  if (!worker) {
    logger.warn('[worker] Cannot start — no Redis connection');
    return;
  }
  logger.info('[worker] CSV upload worker started');
}

export async function stopWorker(): Promise<void> {
  await worker?.close();
  logger.info('[worker] CSV upload worker stopped');
}
