/**
 * Cypress test for login functionality
 */
describe('Login Flow', () => {
  beforeEach(() => {
    // Visit the login page before each test
    cy.visit('/');
    
    // Clear cookies and local storage to ensure a clean state
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('displays login form with required fields', () => {
    cy.get('form').should('be.visible');
    cy.get('input[name="username"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('shows validation errors for empty form submission', () => {
    cy.get('button[type="submit"]').click();
    
    // Check for validation messages
    cy.get('.form-error').should('be.visible');
  });

  it('shows error for invalid credentials', () => {
    // Enter invalid credentials
    cy.get('input[name="username"]').type('invaliduser');
    cy.get('input[name="password"]').type('invalidpassword');
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Check for error message
    cy.get('.alert-error').should('be.visible')
      .and('contain', 'Invalid username or password');
  });

  it('successfully logs in with valid credentials', () => {
    // Use environment variables or test credentials
    cy.get('input[name="username"]').type(Cypress.env('TEST_USER') || 'testuser');
    cy.get('input[name="password"]').type(Cypress.env('TEST_PASSWORD') || 'testpassword');
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Verify successful login - should redirect to dashboard
    cy.url().should('include', '/dashboard.php');
    cy.get('.user-greeting').should('contain', 'Welcome');
  });

  it('remembers login with "Remember me" option', () => {
    cy.get('input[name="username"]').type(Cypress.env('TEST_USER') || 'testuser');
    cy.get('input[name="password"]').type(Cypress.env('TEST_PASSWORD') || 'testpassword');
    
    // Check the remember me box
    cy.get('input[name="remember"]').check();
    
    // Submit the form
    cy.get('button[type="submit"]').click();
    
    // Verify successful login
    cy.url().should('include', '/dashboard.php');
    
    // Now close the browser and revisit (simulate by clearing cookies but not localStorage)
    cy.clearCookies();
    cy.visit('/');
    
    // Should still be logged in due to remember me
    cy.url().should('include', '/dashboard.php');
  });

  it('can logout successfully', () => {
    // Login first
    cy.get('input[name="username"]').type(Cypress.env('TEST_USER') || 'testuser');
    cy.get('input[name="password"]').type(Cypress.env('TEST_PASSWORD') || 'testpassword');
    cy.get('button[type="submit"]').click();
    
    // Verify successful login
    cy.url().should('include', '/dashboard.php');
    
    // Find and click logout button
    cy.get('.logout-button').click();
    
    // Verify redirect to login page
    cy.url().should('include', '/index.php');
    cy.get('form').should('be.visible');
  });
});
