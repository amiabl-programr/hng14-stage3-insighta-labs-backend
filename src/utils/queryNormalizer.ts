interface NormalizedFilters {
  gender?: string;
  country_id?: string;
  age_group?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
}

interface NormalizedOptions {
  page: number;
  limit: number;
  sort_by?: 'age' | 'created_at' | 'gender_probability';
  order?: 'asc' | 'desc';
}

export function normalizeQuery(
  filters: Record<string, unknown>,
  options: Record<string, unknown>,
): string {
  const normalizedFilters: NormalizedFilters = {};
  const normalizedOptions: NormalizedOptions = {
    page: Number(options.page) || 1,
    limit: Number(options.limit) || 10,
  };

  const filterKeys = Object.keys(filters).sort();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    switch (key) {
      case 'gender':
        if (typeof value === 'string') {
          normalizedFilters.gender = value.toLowerCase();
        }
        break;
      case 'country_id':
        if (typeof value === 'string') {
          normalizedFilters.country_id = value.toUpperCase();
        }
        break;
      case 'age_group':
        if (typeof value === 'string') {
          normalizedFilters.age_group = value.toLowerCase();
        }
        break;
      case 'min_age':
      case 'max_age':
      case 'min_gender_probability':
      case 'min_country_probability':
        if (typeof value === 'number') {
          normalizedFilters[key] = value;
        }
        break;
    }
  }

  const optionKeys = Object.keys(options).sort();
  for (const key of optionKeys) {
    const value = options[key];
    if (
      key === 'sort_by' &&
      (value === 'age' ||
        value === 'created_at' ||
        value === 'gender_probability')
    ) {
      normalizedOptions.sort_by = value;
    }
    if (key === 'order' && (value === 'asc' || value === 'desc')) {
      normalizedOptions.order = value;
    }
  }

  return JSON.stringify({
    filters: normalizedFilters,
    options: normalizedOptions,
  });
}
