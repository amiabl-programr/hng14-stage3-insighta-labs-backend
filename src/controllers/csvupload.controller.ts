import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { classifyAgeGroup } from '../utils/classify.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccessResponse } from '../utils/responseHandler.js';
import { logger } from '../config/logger.js';
import csv from 'fast-csv';
import { Readable } from 'stream';

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

export const uploadCSV = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ status: 'error', message: 'No file uploaded' });
  }

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

  const stream = Readable.from(req.file.buffer);
  const csvStream = csv
    .parse({ headers: true })
    .on('data', async (row: CSVRow) => {
      summary.total_rows++;
      csvStream.pause();

      if (!row.name || !row.gender || !row.age || !row.country_id) {
        summary.skipped++;
        summary.reasons.missing_fields++;
        csvStream.resume();
        return;
      }

      const age = typeof row.age === 'string' ? parseInt(row.age, 10) : row.age;
      if (isNaN(age) || age < 0) {
        summary.skipped++;
        summary.reasons.invalid_age++;
        csvStream.resume();
        return;
      }

      const gender = row.gender.toLowerCase();
      if (!['male', 'female'].includes(gender)) {
        summary.skipped++;
        summary.reasons.invalid_gender++;
        csvStream.resume();
        return;
      }

      if (
        existingNames.has(row.name) ||
        (await prisma.profile.findUnique({ where: { name: row.name! } }))
      ) {
        summary.skipped++;
        summary.reasons.duplicate_name++;
        csvStream.resume();
        return;
      }

      existingNames.add(row.name);
      batch.push({
        name: row.name,
        gender,
        age,
        country_id: row.country_id.toUpperCase(),
      });

      if (batch.length >= batchSize) {
        const inserted = await processBatch(batch, summary);
        summary.inserted += inserted;
        batch = [];
      }

      csvStream.resume();
    })
    .on('end', async () => {
      if (batch.length > 0) {
        const inserted = await processBatch(batch, summary);
        summary.inserted += inserted;
      }
      logger.info('[csv] Upload complete', { summary });
      sendSuccessResponse(res, 200, 'CSV upload processed', summary);
    })
    .on('error', (err) => {
      logger.error('[csv] Processing error', { error: err.message });
      res
        .status(500)
        .json({ status: 'error', message: 'CSV processing failed' });
    });

  stream.pipe(csvStream);
});

async function processBatch(
  batch: CSVRow[],
  _summary: UploadSummary,
): Promise<number> {
  try {
    const profiles = batch.map((row) => ({
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

    const result = await prisma.profile.createMany({
      data: profiles,
      skipDuplicates: true,
    });

    return result.count;
  } catch (err) {
    logger.error('[csv] Batch insert error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return 0;
  }
}
