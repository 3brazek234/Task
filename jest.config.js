'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Runs in the main process, once, before all suites
  globalSetup: './tests/globalSetup.js',
  // Runs in the main process, once, after all suites
  globalTeardown: './tests/globalTeardown.js',
  // Runs inside each worker, after Jest framework is installed
  setupFilesAfterEnv: ['./tests/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  // Serial: prevents concurrent DB access across test files
  maxWorkers: 1,
};
