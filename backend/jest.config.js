const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^(\\..*)\\.js$": "$1",
  },
  // dist/ is tsc build output, not a second copy of the test suite — without
  // this, Jest also runs the compiled .test.js files raw, and jest.mock()
  // isn't hoisted in plain compiled JS the way ts-jest hoists it for .ts,
  // so any test relying on module-level jest.mock() spuriously fails there.
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};