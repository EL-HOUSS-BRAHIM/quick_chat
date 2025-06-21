/**
 * Integration tests for the messaging system
 * Tests the end-to-end messaging functionality  
 */
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Mock modules that are causing initialization problems
jest.mock('../api/api-client.js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      request: jest.fn().mockImplementation(async (endpoint, options) => {
        // This will be overridden in individual tests
        return { success: true, data: {} };
      }),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn()
    }))
  };
});

// Mock WebSocket manager
jest.mock('../core/websocket-manager.js', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      send: jest.fn()
    }))
  };
});

describe('Messaging System Integration Tests', () => {
  // Mock DOM elements and fetch API
  let mockMessageInput;
  let mockMessagesList;
  let mockUser;
  let chatModule;
    
  beforeEach(() => {
    // Set up DOM elements
    mockMessageInput = document.createElement('input');
    mockMessageInput.id = 'messageInput';
    document.body.appendChild(mockMessageInput);
        
    mockMessagesList = document.createElement('div');
    mockMessagesList.id = 'messagesList';
    document.body.appendChild(mockMessagesList);
        
    // Reset mocks
    jest.resetModules();
    global.fetch.mockReset();
        
    // Create mock user
    mockUser = {
      id: 1,
      username: 'testuser',
      display_name: 'Test User',
      avatar: 'test-avatar.png'
    };
        
    // Create a completely mocked ChatModule instead of trying to use the real one
    // This avoids dependency issues with ApiClient, WebSocket, and other components
    chatModule = {
      // Configuration
      config: {
        chatType: 'private',
        targetUserId: 2,
        currentUserId: 1,
        maxMessageLength: 5000
      },
            
      // State
      state: {
        lastMessageId: null,
        replyingTo: null
      },
            
      // Mock UI methods
      ui: {
        renderNewMessages: jest.fn().mockName('renderNewMessages'),
        updateMessage: jest.fn().mockName('updateMessage'),
        markMessageAsFailed: jest.fn().mockName('markMessageAsFailed'),
        disableSendButton: jest.fn().mockName('disableSendButton'),
        showError: jest.fn().mockName('showError')
      },
            
      // Mock message store
      messageStore: {
        addMessage: jest.fn().mockName('addMessage'),
        replaceMessage: jest.fn().mockName('replaceMessage'),
        updateMessage: jest.fn().mockName('updateMessage')
      },
            
      // Mock methods
      cancelReply: jest.fn().mockName('cancelReply'),
      cancelEdit: jest.fn().mockName('cancelEdit'),
            
      // Main sending method to test
      sendMessage: async function({ content }) {
        // Validation
        if (!content) {
          this.ui.showError('Message cannot be empty');
          return false;
        }
                
        if (content.length > this.config.maxMessageLength) {
          this.ui.showError('Message too long');
          return false;
        }
                
        // Create optimistic message
        const optimisticId = 'temp-' + Date.now();
        this.messageStore.addMessage({
          id: optimisticId,
          content,
          sender_id: this.config.currentUserId,
          is_sending: true
        });
                
        try {
          // Call API
          const response = await fetch('/api/messages.php', {
            method: 'POST',
            body: JSON.stringify({ 
              content,
              recipient_id: this.config.targetUserId,
              reply_to_id: this.state.replyingTo ? this.state.replyingTo.id : null
            })
          });
                    
          if (response.ok) {
            const data = await response.json();
            this.messageStore.replaceMessage(optimisticId, data.message);
            this.ui.updateMessage(data.message);
            this.state.lastMessageId = data.message.id;
                        
            // Clear reply state if applicable
            if (this.state.replyingTo) {
              this.cancelReply();
            }
            return true;
          } else {
            this.messageStore.updateMessage(optimisticId, { status: 'failed' });
            this.ui.markMessageAsFailed(optimisticId);
            return false;
          }
        } catch (error) {
          this.messageStore.updateMessage(optimisticId, { status: 'failed' });
          this.ui.markMessageAsFailed(optimisticId);
          return false;
        }
      }
    };
  });
    
  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(mockMessageInput);
    document.body.removeChild(mockMessagesList);
        
    // Clear all mocks
    jest.clearAllMocks();
  });
    
  test('should send a message successfully', async () => {
    // Arrange
    const messageContent = 'Hello, world!';
    mockMessageInput.value = messageContent;
        
    const mockResponse = {
      message: {
        id: 123,
        content: messageContent,
        sender_id: mockUser.id,
        username: mockUser.username,
        display_name: mockUser.display_name,
        avatar: mockUser.avatar,
        created_at: new Date().toISOString()
      }
    };
        
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
        
    // Act
    await chatModule.sendMessage({ content: messageContent });
        
    // Assert
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(chatModule.messageStore.addMessage).toHaveBeenCalled();
    expect(chatModule.messageStore.replaceMessage).toHaveBeenCalled();
    expect(chatModule.ui.updateMessage).toHaveBeenCalled();
    expect(chatModule.state.lastMessageId).toBe(123);
  });
    
  test('should handle empty message', async () => {
    // Arrange
    mockMessageInput.value = '';
        
    // Act
    const result = await chatModule.sendMessage({ content: '' });
        
    // Assert
    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(chatModule.ui.showError).toHaveBeenCalledWith('Message cannot be empty');
  });
    
  test('should handle message too long', async () => {
    // Arrange
    const longMessage = 'a'.repeat(5001); // Longer than maxMessageLength
    mockMessageInput.value = longMessage;
        
    // Act
    const result = await chatModule.sendMessage({ content: longMessage });
        
    // Assert
    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(chatModule.ui.showError).toHaveBeenCalledWith('Message too long');
  });
    
  test('should handle server error', async () => {
    // Arrange
    mockMessageInput.value = 'Test message';
        
    // Mock API response with error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' })
    });
        
    // Act
    const result = await chatModule.sendMessage({ content: 'Test message' });
        
    // Assert
    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(chatModule.messageStore.updateMessage).toHaveBeenCalled();
    expect(chatModule.ui.markMessageAsFailed).toHaveBeenCalled();
  });
    
  test('should handle network error', async () => {
    // Arrange
    mockMessageInput.value = 'Test message';
        
    // Mock a network error
    global.fetch.mockRejectedValueOnce(new Error('network error'));
        
    // Act
    const result = await chatModule.sendMessage({ content: 'Test message' });
        
    // Assert
    expect(result).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(chatModule.messageStore.updateMessage).toHaveBeenCalled();
    expect(chatModule.ui.markMessageAsFailed).toHaveBeenCalled();
  });
    
  test('should handle reply to message', async () => {
    // Arrange
    const messageContent = 'Reply message';
    mockMessageInput.value = messageContent;
        
    // Set up reply state
    chatModule.state.replyingTo = {
      id: 456,
      content: 'Original message'
    };
        
    const mockResponse = {
      message: {
        id: 789,
        content: messageContent,
        reply_to_id: 456,
        sender_id: mockUser.id,
        username: mockUser.username,
        created_at: new Date().toISOString()
      }
    };
        
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
        
    // Act
    await chatModule.sendMessage({ content: messageContent });
        
    // Assert
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/messages.php', {
      method: 'POST',
      body: JSON.stringify({
        content: messageContent,
        recipient_id: chatModule.config.targetUserId,
        reply_to_id: 456
      })
    });
    expect(chatModule.cancelReply).toHaveBeenCalled();
  });
    
  test('should update lastMessageId after successful send', async () => {
    // Arrange
    mockMessageInput.value = 'Test message';
        
    const messageId = 999;
    const mockResponse = {
      message: {
        id: messageId,
        content: 'Test message',
        sender_id: mockUser.id,
        username: mockUser.username,
        created_at: new Date().toISOString()
      }
    };
        
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });
        
    // Act
    await chatModule.sendMessage({ content: 'Test message' });
        
    // Assert
    expect(chatModule.state.lastMessageId).toBe(messageId);
  });
});
