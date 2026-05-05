import axios from 'axios';
import { countryMap } from './profile.service.js';

const countryCodeToName: Record<string, string> = {
  NG: 'Nigeria',
  KE: 'Kenya',
  GH: 'Ghana',
  UG: 'Uganda',
  TZ: 'Tanzania',
  BJ: 'Benin',
  SD: 'Sudan',
  EG: 'Egypt',
  ZA: 'South Africa',
  ET: 'Ethiopia',
  CM: 'Cameroon',
  MZ: 'Mozambique',
  MW: 'Malawi',
  ZW: 'Zimbabwe',
  BW: 'Botswana',
  NA: 'Namibia',
  LS: 'Lesotho',
  SZ: 'Eswatini',
  MU: 'Mauritius',
  DZ: 'Algeria',
  TN: 'Tunisia',
  MA: 'Morocco',
  LR: 'Liberia',
  SL: 'Sierra Leone',
  GN: 'Guinea',
  ML: 'Mali',
  SN: 'Senegal',
  MR: 'Mauritania',
  YE: 'Yemen',
  CD: 'Congo',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  AO: 'Angola',
};

interface GenderizeResponse {
  gender: string | null;
  probability: number;
  count: number;
}

interface AgifyResponse {
  age: number | null;
  count: number;
}

interface NationalizeResponse {
  country: { country_id: string; probability: number }[];
}

export interface ExternalData {
  gender: string;
  gender_probability: number;
  sample_size: number;
  age: number;
  country_id: string;
  country_probability: number;
  country_name: string;
}

export const fetchExternalData = async (
  name: string,
): Promise<ExternalData> => {
  const [genderRes, agifyRes, nationalizeRes] = await Promise.all([
    axios.get<GenderizeResponse>(
      `https://api.genderize.io?name=${encodeURIComponent(name)}`,
    ),
    axios.get<AgifyResponse>(
      `https://api.agify.io?name=${encodeURIComponent(name)}`,
    ),
    axios.get<NationalizeResponse>(
      `https://api.nationalize.io?name=${encodeURIComponent(name)}`,
    ),
  ]);

  const {
    gender,
    probability: gender_probability,
    count: sample_size,
  } = genderRes.data;
  if (!gender || sample_size === 0) {
    throw { statusCode: 502, api: 'Genderize' };
  }

  const { age } = agifyRes.data;
  if (age === null || age === undefined) {
    throw { statusCode: 502, api: 'Agify' };
  }

  const { country } = nationalizeRes.data;
  if (!country || country.length === 0) {
    throw { statusCode: 502, api: 'Nationalize' };
  }

  // highest probability country
  const topCountry = country.reduce((prev, curr) =>
    curr.probability > prev.probability ? curr : prev,
  );

  let country_name = '';
  if (countryCodeToName[topCountry.country_id]) {
    country_name = countryCodeToName[topCountry.country_id];
  }

  return {
    gender,
    gender_probability,
    sample_size,
    age,
    country_id: topCountry.country_id,
    country_probability: topCountry.probability,
    country_name,
  };
};
