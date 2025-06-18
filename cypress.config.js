/**
 * Cypress configuration
 */
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false,
  screenshotOnRunFailure: true,
  defaultCommandTimeout: 10000,
  e2e: {
    setupNodeEvents(on, config) {
      // Implement node event listeners here
    },
    baseUrl: 'http://localhost',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    excludeSpecPattern: ['**/node_modules/**', '**/__snapshots__/**'],
    supportFile: 'cypress/support/e2e.js',
  },
  env: {
    TEST_USER: 'testuser',
    TEST_PASSWORD: 'testpassword'
  }
});
