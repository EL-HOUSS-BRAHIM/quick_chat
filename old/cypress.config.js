/**
 * Cypress configuration for Quick Chat E2E Testing
 */
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  viewportWidth: 1280,
  viewportHeight: 720,
  video: true,
  screenshotOnRunFailure: true,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
  e2e: {
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        // Database cleanup task
        clearTestData() {
          // This would connect to test database and clear test data
          console.log('Clearing test data...');
          return null;
        }
      });
    },
    baseUrl: 'http://localhost:8000',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    excludeSpecPattern: ['**/node_modules/**', '**/__snapshots__/**'],
    supportFile: 'cypress/support/e2e.js',
    experimentalStudio: true
  },
  env: {
    TEST_USER: 'testuser@example.com',
    TEST_PASSWORD: 'TestPassword123!',
    ADMIN_USER: 'admin@example.com',
    ADMIN_PASSWORD: 'AdminPassword123!',
    API_URL: 'http://localhost:8000/api'
  },
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
  },
});
