'use strict';

// ESLint 9 flat config (the old .eslintrc.json is ignored by ESLint 9).
const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  console: 'readonly',
  __dirname: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  fetch: 'readonly',
};

const jestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  jest: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
};

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: 'error',
      curly: 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...nodeGlobals, ...jestGlobals } },
  },
];
