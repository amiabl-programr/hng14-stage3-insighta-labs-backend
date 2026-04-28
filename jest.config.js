import { createDefaultEsmPreset } from "ts-jest";

const defaultEsmPreset = createDefaultEsmPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  ...defaultEsmPreset,

  testEnvironment: "node",

  extensionsToTreatAsEsm: [".ts"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@prisma/client$": "<rootDir>/node_modules/@prisma/client"
  },

  transform: {
    ...defaultEsmPreset.transform
  },

  detectOpenHandles: true,
  forceExit: true
};