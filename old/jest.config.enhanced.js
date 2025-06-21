/**
 * Enhanced Jest Configuration for Frontend Testing
 * Comprehensive test setup with coverage and performance monitoring
 */

import { jest } from '@jest/globals';

export default {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/app/frontend/tests/setup.js',
    '<rootDir>/app/frontend/tests/jest-setup.js'
  ],
  
  // Module name mapping for ES6 imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/app/frontend/$1',
    '^@core/(.*)$': '<rootDir>/app/frontend/services/$1',
    '^@components/(.*)$': '<rootDir>/app/frontend/components/$1',
    '^@utils/(.*)$': '<rootDir>/app/frontend/utils/$1',
    '^@assets/(.*)$': '<rootDir>/app/frontend/assets/$1'
  },
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    '^.+\\.css$': 'jest-transform-css',
    '^.+\\.(png|jpg|jpeg|gif|webp|svg)$': 'jest-transform-file'
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/app/frontend/**/__tests__/**/*.(js|jsx|ts|tsx)',
    '<rootDir>/app/frontend/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/tests/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'app/frontend/**/*.{js,jsx,ts,tsx}',
    '!app/frontend/**/*.d.ts',
    '!app/frontend/**/__tests__/**',
    '!app/frontend/**/*.test.{js,jsx,ts,tsx}',
    '!app/frontend/**/*.spec.{js,jsx,ts,tsx}',
    '!app/frontend/tests/**',
    '!**/node_modules/**'
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical modules
    'app/frontend/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'app/frontend/components/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Retry failed tests
  retry: 2,
  
  // Parallel execution
  maxWorkers: '50%',
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
    'vue'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backups/',
    '/uploads/',
    '/logs/'
  ],
  
  // Module directories
  moduleDirectories: [
    'node_modules',
    '<rootDir>/app/frontend',
    '<rootDir>'
  ],
  
  // Global variables
  globals: {
    'FRONTEND_VERSION': '3.0.0',
    'TEST_ENVIRONMENT': true,
    'API_BASE_URL': 'http://localhost:8000',
    'WS_URL': 'ws://localhost:8001'
  },
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-reports',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporters', {
      publicPath: 'test-reports',
      filename: 'report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Quick Chat Frontend Test Report'
    }]
  ],
  
  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Custom resolver for ES modules
  resolver: '<rootDir>/app/frontend/tests/jest-resolver.js'
};
