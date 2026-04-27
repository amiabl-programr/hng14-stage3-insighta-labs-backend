import { createDefaultEsmPreset } from 'ts-jest';

const defaultEsmPreset = createDefaultEsmPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...defaultEsmPreset,
  testEnvironment: "node",
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    ...defaultEsmPreset.transform,
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
};