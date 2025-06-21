# Testing Guide

## Overview
Quick Chat has comprehensive testing infrastructure with:
- Unit Tests: 111/111 passing (100%)
- Integration Tests: 25/26 passing (96%)
- Performance Tests: 5/6 passing (83%)
- E2E Tests: Cypress setup complete
- Accessibility Tests: WCAG AA compliant

## Running Tests

### Unit Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
npm run test:e2e:open
```

### All Tests
```bash
npm run test:all
```

## Test Structure

### Unit Tests
- `app/frontend/tests/unit/` - Component unit tests
- `app/frontend/tests/services/` - Service tests
- `app/frontend/tests/utils/` - Utility function tests

### E2E Tests
- `cypress/e2e/auth.cy.js` - Authentication flows
- `cypress/e2e/chat-features.cy.js` - Chat functionality
- `cypress/e2e/admin.cy.js` - Admin panel tests

### Custom Commands
- `cy.login()` - Quick login
- `cy.sendMessage()` - Send chat message
- `cy.mockWebRTC()` - Mock WebRTC APIs
- `cy.checkA11y()` - Accessibility checks

## Test Environment Setup

1. Start development server:
   ```bash
   npm run serve
   ```

2. Run E2E tests:
   ```bash
   npm run test:e2e
   ```

## Accessibility Testing

The application includes comprehensive accessibility testing:
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Color contrast compliance
- Focus management

## Performance Testing

Performance benchmarks:
- Bundle sizes < 244KB target
- Load times < 3 seconds
- First contentful paint < 2 seconds
- Accessibility score > 95%
