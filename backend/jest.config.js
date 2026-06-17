// ============================================================
// MPloyChek v4.0 — Jest Configuration
// - Unit tests:        npm test           (schemas, services, routes, flows)
// - Integration tests: npm run test:integration (real DB, skipped if no DB)
// - Coverage:          npm run test:coverage
// ============================================================
/** @type {import('jest').Config} */
module.exports = {
  preset:           'ts-jest',
  testEnvironment:  'node',
  roots:            ['<rootDir>/src'],

  // Only treat *.test.ts / *.spec.ts as suites — never the helpers,
  // factories, setup or __mocks__ that also live under __tests__.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],

  // Default run excludes integration (needs real DB)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'prisma\\.integration\\.test\\.ts',
  ],

  // Run setup.ts before every test file (sets NODE_ENV, JWT_SECRET etc.)
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  clearMocks:   true,    // reset mock.calls between tests
  restoreMocks: true,    // restore spies between tests

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**',
    '!src/__mocks__/**',
    '!src/index.ts',
    '!src/prisma/seed.ts',
  ],
  coverageDirectory:  'coverage',
  coverageReporters:  ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  // ts-jest transform (modern form; tsconfig.json already sets esModuleInterop)
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
};
