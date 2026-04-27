import {
  getAllProfiles,
  ProfileFilters,
  QueryOptions,
  PaginatedResult,
} from '../models/profile.model.js';

export const listProfiles = async (
  filters: ProfileFilters,
  options: QueryOptions,
): Promise<PaginatedResult> => {
  return getAllProfiles(filters, options);
};

export const parseNaturalLanguageQuery = (
  query: string,
): ProfileFilters | null => {
  const changeQueryToLowerCase = query.toLowerCase().trim();
  const filters: ProfileFilters = {};

  const hasMale = changeQueryToLowerCase.includes('male');
  const hasFemale = changeQueryToLowerCase.includes('female');

  // If both male and female are mentioned, we should not set gender filter
  if (hasMale && !hasFemale) {
    filters.gender = 'male';
  } else if (hasFemale && !hasMale) {
    filters.gender = 'female';
  }

  // Parse age groups
  if (
    changeQueryToLowerCase.includes('child') ||
    changeQueryToLowerCase.includes('children')
  ) {
    filters.age_group = 'child';
  } else if (
    changeQueryToLowerCase.includes('teenager') ||
    changeQueryToLowerCase.includes('teens')
  ) {
    filters.age_group = 'teenager';
  } else if (
    changeQueryToLowerCase.includes('adult') &&
    !changeQueryToLowerCase.includes('senior')
  ) {
    filters.age_group = 'adult';
  } else if (changeQueryToLowerCase.includes('senior')) {
    filters.age_group = 'senior';
  }

  if (changeQueryToLowerCase.includes('young')) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // Check for "above X" or "over X" patterns
  const aboveMatch = changeQueryToLowerCase.match(/(?:above|over)\s+(\d+)/);
  if (aboveMatch) {
    const age = parseInt(aboveMatch[1], 10);
    if (!isNaN(age)) {
      filters.min_age = age;
    }
  }

  // Check for "below X" or "under X" patterns
  const belowMatch = changeQueryToLowerCase.match(/(?:below|under)\s+(\d+)/);
  if (belowMatch) {
    const age = parseInt(belowMatch[1], 10);
    if (!isNaN(age)) {
      filters.max_age = age;
    }
  }

  const countryMap: Record<string, string> = {
    nigeria: 'NG',
    nigerian: 'NG',
    kenya: 'KE',
    kenyan: 'KE',
    ghana: 'GH',
    ghanaian: 'GH',
    uganda: 'UG',
    ugandan: 'UG',
    tanzania: 'TZ',
    tanzanian: 'TZ',
    benin: 'BJ',
    beninese: 'BJ',
    sudan: 'SD',
    sudanese: 'SD',
    egypt: 'EG',
    egyptian: 'EG',
    'south africa': 'ZA',
    'south african': 'ZA',
    ethiopia: 'ET',
    ethiopian: 'ET',
    cameroon: 'CM',
    cameroonian: 'CM',
    mozambique: 'MZ',
    mozambican: 'MZ',
    malawi: 'MW',
    malawian: 'MW',
    zimbabwe: 'ZW',
    zimbabwean: 'ZW',
    botswana: 'BW',
    motswana: 'BW',
    namibia: 'NA',
    namibian: 'NA',
    lesotho: 'LS',
    basotho: 'LS',
    eswatini: 'SZ',
    swazi: 'SZ',
    mauritius: 'MU',
    mauritian: 'MU',
    algeria: 'DZ',
    algerian: 'DZ',
    tunisia: 'TN',
    tunisian: 'TN',
    morocco: 'MA',
    moroccan: 'MA',
    liberia: 'LR',
    liberian: 'LR',
    'sierra leone': 'SL',
    'sierra leonean': 'SL',
    guinea: 'GN',
    guinean: 'GN',
    mali: 'ML',
    malian: 'ML',
    senegal: 'SN',
    senegalese: 'SN',
    mauritania: 'MR',
    mauritanian: 'MR',
    yemen: 'YE',
    yemeni: 'YE',
    congo: 'CD',
    congolese: 'CD',
    'united states': 'US',
    usa: 'US',
    american: 'US',
    'united kingdom': 'GB',
    uk: 'GB',
    british: 'GB',
    canada: 'CA',
    canadian: 'CA',
    australia: 'AU',
    australian: 'AU',
    angola: 'AO',
    angolan: 'AO',
  };

  for (const [country, code] of Object.entries(countryMap)) {
    if (changeQueryToLowerCase.includes(country)) {
      filters.country_id = code;
      break;
    }
  }

  if (Object.keys(filters).length === 0) {
    throw new Error('No filters found in the query');
  }

  return filters;
};
