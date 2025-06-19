/**
 * Jest configuration file
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/assets/js'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'assets/js/**/*.js',
    '!assets/js/dist/**',
    '!assets/js/**/*.spec.js',
    '!assets/js/**/*.test.js',
    '!assets/js/__tests__/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/assets/js/test-utils/setup.js'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  },
  transform: {
    "^.+\\.js$": "babel-jest"
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/assets/js/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/assets/js/test-utils/jest-setup.js'],
  // Add support for ES Modules
  moduleFileExtensions: ['js', 'json', 'node'],
  transformIgnorePatterns: [
    '/node_modules/(?!.*\\.mjs$)'
  ]
};
