/**
 * Custom Cypress commands
 */

// Import file upload plugin
import 'cypress-file-upload';

// Custom command for simulating another user typing
Cypress.Commands.add('simulateUserTyping', (userId) => {
  // This would normally call your API to simulate another user typing
  cy.request({
    method: 'POST',
    url: '/api/messages.php',
    body: {
      action: 'typing',
      user_id: userId,
      is_typing: true
    },
    headers: {
      'X-CSRF-Token': Cypress.env('CSRF_TOKEN') || 'test-csrf-token'
    }
  });
});

// Custom command for clearing a user's message history
Cypress.Commands.add('clearMessageHistory', (userId) => {
  cy.request({
    method: 'POST',
    url: '/api/messages.php',
    body: {
      action: 'clear_history',
      user_id: userId
    },
    headers: {
      'X-CSRF-Token': Cypress.env('CSRF_TOKEN') || 'test-csrf-token'
    }
  });
});

// Custom command for creating a test group
Cypress.Commands.add('createTestGroup', (groupName, members = []) => {
  return cy.request({
    method: 'POST',
    url: '/api/groups.php',
    body: {
      action: 'create',
      name: groupName,
      members: members
    },
    headers: {
      'X-CSRF-Token': Cypress.env('CSRF_TOKEN') || 'test-csrf-token'
    }
  }).then((response) => {
    return response.body.group_id;
  });
});

// Custom command for deleting a test group
Cypress.Commands.add('deleteTestGroup', (groupId) => {
  cy.request({
    method: 'POST',
    url: '/api/groups.php',
    body: {
      action: 'delete',
      group_id: groupId
    },
    headers: {
      'X-CSRF-Token': Cypress.env('CSRF_TOKEN') || 'test-csrf-token'
    }
  });
});

// Custom command to wait for WebSocket connection
Cypress.Commands.add('waitForWebSocket', () => {
  // Check for a global websocket connection object
  cy.window().should((win) => {
    expect(win.webSocketConnected).to.be.true;
  });
});

// Custom command to check if an element is scrolled into view
Cypress.Commands.add('isScrolledTo', { prevSubject: true }, (subject) => {
  cy.get(subject).should(($el) => {
    const rect = $el[0].getBoundingClientRect();
    expect(rect.top).to.be.greaterThan(-1);
    expect(rect.bottom).to.be.lessThan(Cypress.config('viewportHeight') + 1);
  });
});
