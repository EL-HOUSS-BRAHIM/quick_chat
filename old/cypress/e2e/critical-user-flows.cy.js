/**
 * Critical User Flow E2E Tests
 * Tests the most important user journeys in Quick Chat
 * Implementation of TODO: End-to-end tests for critical user flows (60% → 85%)
 */

describe('Quick Chat - Critical User Flows', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('User Registration and Authentication Flow', () => {
    it('should allow new user registration', () => {
      cy.get('[data-cy="register-button"]').click();
      
      cy.get('[data-cy="username-input"]').type('testuser123');
      cy.get('[data-cy="email-input"]').type('test@example.com');
      cy.get('[data-cy="password-input"]').type('SecurePassword123!');
      cy.get('[data-cy="confirm-password-input"]').type('SecurePassword123!');
      
      cy.get('[data-cy="register-submit"]').click();
      
      cy.url().should('include', '/dashboard');
      cy.get('[data-cy="welcome-message"]').should('contain', 'Welcome to Quick Chat');
    });

    it('should allow user login', () => {
      // First create a user (assuming API endpoint exists)
      cy.request('POST', '/api/test/create-user', {
        username: 'logintest',
        email: 'login@example.com',
        password: 'TestPassword123!'
      });

      cy.get('[data-cy="login-button"]').click();
      
      cy.get('[data-cy="login-username"]').type('logintest');
      cy.get('[data-cy="login-password"]').type('TestPassword123!');
      
      cy.get('[data-cy="login-submit"]').click();
      
      cy.url().should('include', '/dashboard');
      cy.get('[data-cy="user-profile"]').should('contain', 'logintest');
    });

    it('should handle login with invalid credentials', () => {
      cy.get('[data-cy="login-button"]').click();
      
      cy.get('[data-cy="login-username"]').type('invaliduser');
      cy.get('[data-cy="login-password"]').type('wrongpassword');
      
      cy.get('[data-cy="login-submit"]').click();
      
      cy.get('[data-cy="error-message"]')
        .should('be.visible')
        .and('contain', 'Invalid credentials');
    });
  });

  describe('Private Chat Flow', () => {
    beforeEach(() => {
      // Create two test users and login as first user
      cy.request('POST', '/api/test/setup-chat-users');
      cy.login('chatuser1', 'TestPassword123!');
    });

    it('should start a private conversation', () => {
      cy.get('[data-cy="users-list"]').should('be.visible');
      cy.get('[data-cy="user-item"]').first().click();
      
      cy.get('[data-cy="chat-container"]').should('be.visible');
      cy.get('[data-cy="message-input"]').should('be.visible');
      
      const testMessage = 'Hello, this is a test message!';
      cy.get('[data-cy="message-input"]').type(testMessage);
      cy.get('[data-cy="send-button"]').click();
      
      cy.get('[data-cy="message-bubble"]')
        .should('be.visible')
        .and('contain', testMessage);
    });

    it('should receive real-time messages', () => {
      cy.get('[data-cy="user-item"]').first().click();
      
      // Simulate receiving a message via WebSocket
      cy.window().then((win) => {
        win.chatApp.webSocketManager.simulateMessage({
          id: 'test-msg-1',
          content: 'Hello from another user!',
          sender_id: 2,
          timestamp: new Date().toISOString()
        });
      });
      
      cy.get('[data-cy="message-bubble"]')
        .should('contain', 'Hello from another user!')
        .and('have.class', 'message-received');
    });

    it('should show typing indicators', () => {
      cy.get('[data-cy="user-item"]').first().click();
      cy.get('[data-cy="message-input"]').type('Test message');
      
      // Should trigger typing indicator
      cy.get('[data-cy="typing-indicator"]')
        .should('be.visible')
        .and('contain', 'typing...');
      
      // Clear input - typing indicator should disappear
      cy.get('[data-cy="message-input"]').clear();
      cy.get('[data-cy="typing-indicator"]').should('not.exist');
    });
  });

  describe('Group Chat Flow', () => {
    beforeEach(() => {
      cy.request('POST', '/api/test/setup-group-chat');
      cy.login('groupuser1', 'TestPassword123!');
    });

    it('should create a new group', () => {
      cy.get('[data-cy="create-group-button"]').click();
      
      cy.get('[data-cy="group-name-input"]').type('Test Group');
      cy.get('[data-cy="group-description-input"]').type('A test group for E2E testing');
      
      // Select users to add to group
      cy.get('[data-cy="user-selector"]').click();
      cy.get('[data-cy="user-option"]').first().click();
      cy.get('[data-cy="user-option"]').eq(1).click();
      
      cy.get('[data-cy="create-group-submit"]').click();
      
      cy.url().should('include', '/group-chat/');
      cy.get('[data-cy="group-name"]').should('contain', 'Test Group');
      cy.get('[data-cy="group-members"]').should('contain', '3 members');
    });

    it('should send and receive group messages', () => {
      cy.get('[data-cy="group-item"]').first().click();
      
      const testMessage = 'Hello everyone in the group!';
      cy.get('[data-cy="message-input"]').type(testMessage);
      cy.get('[data-cy="send-button"]').click();
      
      cy.get('[data-cy="message-bubble"]')
        .should('contain', testMessage)
        .and('have.class', 'own-message');
    });

    it('should handle group member management', () => {
      cy.get('[data-cy="group-item"]').first().click();
      cy.get('[data-cy="group-info-toggle"]').click();
      
      cy.get('[data-cy="group-info-sidebar"]').should('be.visible');
      cy.get('[data-cy="add-member-button"]').click();
      
      cy.get('[data-cy="user-search"]').type('newuser');
      cy.get('[data-cy="search-result"]').first().click();
      cy.get('[data-cy="add-user-confirm"]').click();
      
      cy.get('[data-cy="group-members"]').should('contain', '4 members');
    });
  });

  describe('File Upload and Sharing Flow', () => {
    beforeEach(() => {
      cy.login('fileuser', 'TestPassword123!');
      cy.get('[data-cy="user-item"]').first().click();
    });

    it('should upload and send image files', () => {
      // Create a test image file
      cy.fixture('test-image.jpg', 'base64').then((fileContent) => {
        const file = new Blob([Cypress.Blob.base64StringToArrayBuffer(fileContent)], {
          type: 'image/jpeg'
        });
        
        cy.get('[data-cy="file-upload-input"]').selectFile({
          contents: file,
          fileName: 'test-image.jpg',
          mimeType: 'image/jpeg'
        }, { force: true });
      });
      
      cy.get('[data-cy="upload-progress"]').should('be.visible');
      cy.get('[data-cy="upload-progress"]').should('not.exist', { timeout: 10000 });
      
      cy.get('[data-cy="message-bubble"]')
        .should('contain.html', 'img')
        .find('img')
        .should('have.attr', 'src')
        .and('include', 'test-image');
    });

    it('should handle file upload errors', () => {
      // Try to upload an unsupported file type
      cy.fixture('test-file.exe', 'base64').then((fileContent) => {
        const file = new Blob([Cypress.Blob.base64StringToArrayBuffer(fileContent)], {
          type: 'application/octet-stream'
        });
        
        cy.get('[data-cy="file-upload-input"]').selectFile({
          contents: file,
          fileName: 'malicious.exe',
          mimeType: 'application/octet-stream'
        }, { force: true });
      });
      
      cy.get('[data-cy="error-notification"]')
        .should('be.visible')
        .and('contain', 'File type not allowed');
    });

    it('should display file upload progress', () => {
      // Upload a larger file to see progress
      cy.fixture('large-file.pdf', 'base64').then((fileContent) => {
        const file = new Blob([Cypress.Blob.base64StringToArrayBuffer(fileContent)], {
          type: 'application/pdf'
        });
        
        cy.get('[data-cy="file-upload-input"]').selectFile({
          contents: file,
          fileName: 'large-document.pdf',
          mimeType: 'application/pdf'
        }, { force: true });
      });
      
      cy.get('[data-cy="upload-progress-bar"]').should('be.visible');
      cy.get('[data-cy="upload-percentage"]').should('contain', '%');
      cy.get('[data-cy="cancel-upload"]').should('be.visible');
    });
  });

  describe('Voice/Video Call Flow', () => {
    beforeEach(() => {
      cy.login('calluser1', 'TestPassword123!');
      cy.get('[data-cy="user-item"]').first().click();
    });

    it('should initiate a voice call', () => {
      // Mock WebRTC APIs
      cy.window().then((win) => {
        win.navigator.mediaDevices = {
          getUserMedia: cy.stub().resolves({
            getTracks: () => []
          })
        };
      });
      
      cy.get('[data-cy="voice-call-button"]').click();
      
      cy.get('[data-cy="call-interface"]').should('be.visible');
      cy.get('[data-cy="call-status"]').should('contain', 'Calling...');
      cy.get('[data-cy="end-call-button"]').should('be.visible');
    });

    it('should handle call permissions', () => {
      // Mock permission denied
      cy.window().then((win) => {
        win.navigator.mediaDevices = {
          getUserMedia: cy.stub().rejects(new Error('Permission denied'))
        };
      });
      
      cy.get('[data-cy="voice-call-button"]').click();
      
      cy.get('[data-cy="permission-error"]')
        .should('be.visible')
        .and('contain', 'Microphone access required');
    });

    it('should end a call properly', () => {
      cy.window().then((win) => {
        win.navigator.mediaDevices = {
          getUserMedia: cy.stub().resolves({
            getTracks: () => [{
              stop: cy.stub()
            }]
          })
        };
      });
      
      cy.get('[data-cy="voice-call-button"]').click();
      cy.get('[data-cy="call-interface"]').should('be.visible');
      
      cy.get('[data-cy="end-call-button"]').click();
      
      cy.get('[data-cy="call-interface"]').should('not.exist');
      cy.get('[data-cy="call-ended-notification"]')
        .should('be.visible')
        .and('contain', 'Call ended');
    });
  });

  describe('Mobile Responsive Flow', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.login('mobileuser', 'TestPassword123!');
    });

    it('should work on mobile devices', () => {
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible');
      cy.get('[data-cy="sidebar"]').should('not.be.visible');
      
      cy.get('[data-cy="mobile-menu-toggle"]').click();
      cy.get('[data-cy="sidebar"]').should('be.visible');
      
      cy.get('[data-cy="user-item"]').first().click();
      cy.get('[data-cy="sidebar"]').should('not.be.visible');
      cy.get('[data-cy="chat-container"]').should('be.visible');
    });

    it('should handle mobile gestures', () => {
      cy.get('[data-cy="user-item"]').first().click();
      
      // Swipe gesture to go back
      cy.get('[data-cy="chat-container"]')
        .trigger('touchstart', { touches: [{ clientX: 0, clientY: 100 }] })
        .trigger('touchmove', { touches: [{ clientX: 150, clientY: 100 }] })
        .trigger('touchend');
      
      cy.get('[data-cy="sidebar"]').should('be.visible');
    });
  });

  describe('Offline Functionality Flow', () => {
    beforeEach(() => {
      cy.login('offlineuser', 'TestPassword123!');
      cy.get('[data-cy="user-item"]').first().click();
    });

    it('should handle offline mode', () => {
      // Go offline
      cy.window().then((win) => {
        win.navigator.onLine = false;
        win.dispatchEvent(new Event('offline'));
      });
      
      cy.get('[data-cy="offline-indicator"]')
        .should('be.visible')
        .and('contain', 'You are offline');
      
      const offlineMessage = 'This message was sent offline';
      cy.get('[data-cy="message-input"]').type(offlineMessage);
      cy.get('[data-cy="send-button"]').click();
      
      cy.get('[data-cy="message-bubble"]')
        .should('contain', offlineMessage)
        .and('have.class', 'pending');
    });

    it('should sync messages when back online', () => {
      // Send message while offline
      cy.window().then((win) => {
        win.navigator.onLine = false;
        win.dispatchEvent(new Event('offline'));
      });
      
      const offlineMessage = 'Offline message to sync';
      cy.get('[data-cy="message-input"]').type(offlineMessage);
      cy.get('[data-cy="send-button"]').click();
      
      // Go back online
      cy.window().then((win) => {
        win.navigator.onLine = true;
        win.dispatchEvent(new Event('online'));
      });
      
      cy.get('[data-cy="offline-indicator"]').should('not.exist');
      cy.get('[data-cy="message-bubble"]')
        .should('contain', offlineMessage)
        .and('not.have.class', 'pending');
    });
  });

  describe('Accessibility Flow', () => {
    beforeEach(() => {
      cy.login('a11yuser', 'TestPassword123!');
      cy.injectAxe();
    });

    it('should be accessible via keyboard navigation', () => {
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-cy', 'main-nav');
      
      cy.focused().tab();
      cy.focused().should('have.attr', 'data-cy', 'user-item');
      
      cy.focused().type('{enter}');
      cy.get('[data-cy="chat-container"]').should('be.visible');
      
      cy.get('[data-cy="message-input"]').focus().type('Keyboard navigation test');
      cy.get('[data-cy="message-input"]').type('{ctrl+enter}');
      
      cy.get('[data-cy="message-bubble"]')
        .should('contain', 'Keyboard navigation test');
    });

    it('should pass accessibility audits', () => {
      cy.checkA11y();
      
      cy.get('[data-cy="user-item"]').first().click();
      cy.checkA11y();
      
      cy.get('[data-cy="settings-button"]').click();
      cy.checkA11y();
    });

    it('should work with screen readers', () => {
      cy.get('[data-cy="user-item"]')
        .first()
        .should('have.attr', 'aria-label')
        .and('contain', 'Chat with');
      
      cy.get('[data-cy="message-input"]')
        .should('have.attr', 'aria-label', 'Type your message');
      
      cy.get('[data-cy="send-button"]')
        .should('have.attr', 'aria-label', 'Send message');
    });
  });
});
