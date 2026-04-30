import { prisma } from '../lib/prisma.js';
import { Profile } from '../generated/prisma/client.js';

export interface CreateProfileData {
  id: string;
  name: string;
  gender: string;
  gender_probability: number;
  sample_size: number;
  age: number;
  age_group: string;
  country_id: string;
  country_probability: number;
  country_name: string;
}
export const findProfileByName = async (
  name: string,
): Promise<Profile | null> => {
  return prisma.profile.findUnique({ where: { name } });
};

export const findProfileById = async (id: string): Promise<Profile | null> => {
  return prisma.profile.findUnique({ where: { id } });
};

export const createProfile = async (
  data: CreateProfileData,
): Promise<Profile> => {
  return prisma.profile.create({ data });
};

export interface ProfileFilters {
  gender?: string;
  country_id?: string;
  age_group?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
}

export interface QueryOptions {
  page: number;
  limit: number;
  sort_by?: 'age' | 'created_at' | 'gender_probability';
  order?: 'asc' | 'desc';
}

export interface PaginatedResult {
  data: Profile[];
  page: number;
  limit: number;
  total: number;
}

export const getAllProfiles = async (
  filters: ProfileFilters,
  options: QueryOptions,
): Promise<PaginatedResult> => {
  const where: Record<string, unknown> = {};

  if (filters.gender) {
    where.gender = filters.gender.toLowerCase();
  }
  if (filters.country_id) {
    where.country_id = filters.country_id.toUpperCase();
  }
  if (filters.age_group) {
    where.age_group = filters.age_group.toLowerCase();
  }
  if (filters.min_age !== undefined) {
    where.age = { ...(where.age || {}), gte: filters.min_age };
  }
  if (filters.max_age !== undefined) {
    where.age = { ...(where.age || {}), lte: filters.max_age };
  }
  if (filters.min_gender_probability !== undefined) {
    where.gender_probability = {
      ...(where.gender_probability || {}),
      gte: filters.min_gender_probability,
    };
  }
  if (filters.min_country_probability !== undefined) {
    where.country_probability = {
      ...(where.country_probability || {}),
      gte: filters.min_country_probability,
    };
  }

  const skip = (options.page - 1) * options.limit;
  const orderBy: Record<string, string> = {};

  if (options.sort_by) {
    orderBy[options.sort_by] = options.order || 'asc';
  }

  const [data, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      skip,
      take: options.limit,
      orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
    }),
    prisma.profile.count({ where }),
  ]);

  return { data, page: options.page, limit: options.limit, total };
};

export const deleteProfile = async (id: string): Promise<Profile> => {
  return prisma.profile.delete({ where: { id } });
};
