/**
 * Cypress test for chat functionality
 */
describe('Chat Functionality', () => {
  beforeEach(() => {
    // Login before each test
    cy.visit('/');
    cy.get('input[name="username"]').type(Cypress.env('TEST_USER') || 'testuser');
    cy.get('input[name="password"]').type(Cypress.env('TEST_PASSWORD') || 'testpassword');
    cy.get('button[type="submit"]').click();
    
    // Navigate to private chat
    cy.visit('/private-chat.php?user_id=2'); // Assuming user_id 2 is a test contact
    
    // Wait for chat to load
    cy.get('.chat-container').should('be.visible');
  });

  it('displays chat interface elements', () => {
    // Check for main chat components
    cy.get('.chat-messages').should('exist');
    cy.get('.message-input').should('exist');
    cy.get('.send-button').should('exist');
  });

  it('can send and receive messages', () => {
    // Type a message
    const testMessage = `Test message ${Date.now()}`;
    cy.get('.message-input').type(testMessage);
    
    // Send the message
    cy.get('.send-button').click();
    
    // Verify message appears in chat
    cy.get('.chat-messages .message-content')
      .should('contain', testMessage);
      
    // Verify message has sent status
    cy.get('.message-status').should('contain', 'Sent');
  });

  it('can send emoji in messages', () => {
    // Open emoji picker
    cy.get('.emoji-button').click();
    
    // Wait for emoji picker to appear
    cy.get('.emoji-picker').should('be.visible');
    
    // Select an emoji
    cy.get('.emoji-picker .emoji').first().click();
    
    // Verify emoji is added to input
    cy.get('.message-input').should('not.be.empty');
    
    // Send the message
    cy.get('.send-button').click();
    
    // Verify message is sent and contains emoji
    cy.get('.chat-messages .message-content').last()
      .should('not.be.empty');
  });

  it('can upload and send images', () => {
    // Upload an image
    cy.fixture('test-image.jpg', 'base64').then(fileContent => {
      cy.get('input[type="file"]').attachFile({
        fileContent,
        fileName: 'test-image.jpg',
        mimeType: 'image/jpeg'
      });
    });
    
    // Verify upload preview appears
    cy.get('.file-preview').should('be.visible');
    
    // Send the message with image
    cy.get('.send-button').click();
    
    // Verify image appears in chat
    cy.get('.chat-messages .message-image').should('be.visible');
  });

  it('shows typing indicator when other user is typing', () => {
    // Simulate other user typing (we would normally do this via API or WebSocket)
    // For test purposes, we'll use a custom command that calls our API
    cy.simulateUserTyping(2); // Call a custom command that would trigger typing
    
    // Verify typing indicator appears
    cy.get('.typing-indicator').should('be.visible');
    
    // Wait for typing indicator to disappear
    cy.wait(3000); // Assuming typing timeout is set to less than this
    cy.get('.typing-indicator').should('not.be.visible');
  });

  it('can delete own messages', () => {
    // Send a message first
    const testMessage = `Delete test ${Date.now()}`;
    cy.get('.message-input').type(testMessage);
    cy.get('.send-button').click();
    
    // Wait for message to appear
    cy.get('.chat-messages .message-content')
      .contains(testMessage)
      .should('be.visible');
    
    // Open message options menu
    cy.get('.chat-messages .message').last()
      .find('.message-options-button')
      .click();
    
    // Click delete option
    cy.get('.message-options-menu .delete-option').click();
    
    // Confirm deletion
    cy.get('.confirm-dialog .confirm-button').click();
    
    // Verify message is deleted or marked as deleted
    cy.get('.chat-messages .message-content')
      .contains(testMessage)
      .should('not.exist');
  });
});
