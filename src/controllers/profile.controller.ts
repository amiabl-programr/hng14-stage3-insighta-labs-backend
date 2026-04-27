import { Request, Response } from 'express';
import {
  listProfiles,
  parseNaturalLanguageQuery,
} from '../services/profile.service.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccessResponse } from '../utils/responseHandler.js';
import { Profile } from '../generated/prisma/client.js';

const formatProfileFull = (profile: Profile) => ({
  id: profile.id,
  name: profile.name,
  gender: profile.gender,
  gender_probability: profile.gender_probability,
  age: profile.age,
  age_group: profile.age_group,
  country_id: profile.country_id,
  country_name: profile.country_name,
  country_probability: profile.country_probability,
  created_at: profile.created_at,
});

export const getProfiles = catchAsync(async (req: Request, res: Response) => {
  const {
    gender,
    country_id,
    age_group,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
    page = '1',
    limit = '10',
  } = req.query;

  let pageNum = parseInt(page as string, 10);
  let limitNum = parseInt(limit as string, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new AppError('Invalid query parameters', 422);
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    throw new AppError('Invalid query parameters', 422);
  }

  // Parse numeric filters
  const minAge = min_age ? parseInt(min_age as string, 10) : undefined;
  const maxAge = max_age ? parseInt(max_age as string, 10) : undefined;
  const minGenderProb = min_gender_probability
    ? parseFloat(min_gender_probability as string)
    : undefined;
  const minCountryProb = min_country_probability
    ? parseFloat(min_country_probability as string)
    : undefined;

  if ((min_age && isNaN(minAge!)) || (max_age && isNaN(maxAge!))) {
    throw new AppError('Invalid query parameters', 422);
  }

  if (
    (min_gender_probability && isNaN(minGenderProb!)) ||
    (min_country_probability && isNaN(minCountryProb!))
  ) {
    throw new AppError('Invalid query parameters', 422);
  }

  // Validate sort parameters
  const validSortFields = ['age', 'created_at', 'gender_probability'];
  const validOrders = ['asc', 'desc'];

  if (sort_by && !validSortFields.includes(sort_by as string)) {
    throw new AppError('Invalid query parameters', 422);
  }

  if (order && !validOrders.includes(order as string)) {
    throw new AppError('Invalid query parameters', 422);
  }

  const result = await listProfiles(
    {
      gender: gender as string | undefined,
      country_id: country_id as string | undefined,
      age_group: age_group as string | undefined,
      min_age: minAge,
      max_age: maxAge,
      min_gender_probability: minGenderProb,
      min_country_probability: minCountryProb,
    },
    {
      page: pageNum,
      limit: limitNum,
      sort_by: sort_by as
        | 'age'
        | 'created_at'
        | 'gender_probability'
        | undefined,
      order: order as 'asc' | 'desc' | undefined,
    },
  );

  return sendSuccessResponse(
    res,
    200,
    'Profiles retrieved successfully',
    result.data.map((p: unknown) => formatProfileFull(p as Profile)),
    {
      page: result.page,
      limit: result.limit,
      total: result.total,
    },
  );
});

export const searchProfiles = catchAsync(
  async (req: Request, res: Response) => {
    const { q, page = '1', limit = '10' } = req.query;

    // Validate query parameter
    if (!q || typeof q !== 'string' || q.trim() === '') {
      throw new AppError('Query parameter q is required', 400);
    }

    const filters = parseNaturalLanguageQuery(q);

    if (filters === null) {
      throw new AppError('Unable to interpret query', 422);
    }

    let pageNum = parseInt(page as string, 10);
    let limitNum = parseInt(limit as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      limitNum = 10;
    }

    const result = await listProfiles(filters, {
      page: pageNum,
      limit: limitNum,
    });

    return sendSuccessResponse(
      res,
      200,
      'Profiles retrieved successfully',
      result.data.map((p: unknown) => formatProfileFull(p as Profile)),
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    );
  },
);
