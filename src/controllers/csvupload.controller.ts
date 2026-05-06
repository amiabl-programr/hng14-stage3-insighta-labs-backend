import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { classifyAgeGroup } from '../utils/classify.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccessResponse } from '../utils/responseHandler.js';
import { logger } from '../config/logger.js';
import { invalidateProfilesCache } from '../models/profile.model.js';
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

export const uploadCSV = catchAsync(async (req: Request, res: Response) => {
  if (!req.file?.path) {
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

  try {
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
            }

            csvStream.resume();
          } catch (err) {
            reject(err);
          }
        })
        .on('end', resolve);

      fs.createReadStream(req.file!.path).pipe(csvStream);
    });

    if (batch.length > 0) {
      summary.inserted += await processBatch(batch, summary);
    }

    if (summary.inserted > 0) {
      await invalidateProfilesCache();
    }

    logger.info('[csv] Upload complete', { summary });
    return sendSuccessResponse(res, 200, 'CSV upload processed', summary);
  } catch (err) {
    logger.error('[csv] Processing error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return res
      .status(500)
      .json({ status: 'error', message: 'CSV processing failed' });
  } finally {
    await unlink(req.file.path).catch((err) => {
      logger.warn('[csv] Failed to remove uploaded temp file', {
        path: req.file?.path,
        error: err instanceof Error ? err.message : 'unknown',
      });
    });
  }
});

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
  return {
    name,
    gender: genderRaw,
    age,
    country_id: countryId,
  };
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

    if (profiles.length === 0) {
      return 0;
    }

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
    logger.error('[csv] Batch insert error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return 0;
  }
}
