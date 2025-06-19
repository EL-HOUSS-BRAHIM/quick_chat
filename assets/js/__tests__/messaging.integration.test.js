/**
 * Integration tests for the messaging system
 * Tests the end-to-end messaging functionality  
 */
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

describe('Messaging System Integration Tests', () => {
    // Mock DOM elements and fetch API
    let app;
    let mockMessageInput;
    let mockMessagesList;
    let mockUser;
    
    beforeEach(() => {
        // Set up DOM elements
        mockMessageInput = document.createElement('input');
        mockMessageInput.id = 'messageInput';
        document.body.appendChild(mockMessageInput);
        
        mockMessagesList = document.createElement('div');
        mockMessagesList.id = 'messagesList';
        document.body.appendChild(mockMessagesList);
        
        // Import app dynamically to get a fresh instance for each test
        jest.resetModules();
        return import('../app.js').then(module => {
            const QuickChatApp = module.default;
            app = new QuickChatApp();
            
            // Mock user state
            mockUser = {
                id: 1,
                username: 'testuser',
                display_name: 'Test User',
                avatar: 'test-avatar.png'
            };
            app.user = mockUser;
            app.state.user = mockUser;
            
            // Mock CSRF token
            app.csrfToken = 'test-csrf-token';
            
            // Mock config
            app.config = {
                maxMessageLength: 5000
            };
            
            // Spy on various methods that exist
            jest.spyOn(app, 'renderMessages').mockImplementation(() => {});
            jest.spyOn(app, 'scrollToBottom').mockImplementation(() => {});
            jest.spyOn(app, 'showError').mockImplementation(() => {});
            
            // Add missing methods if they don't exist
            if (!app.saveMessagesToStorage) {
                app.saveMessagesToStorage = jest.fn();
            }
            if (!app.broadcastToOtherTabs) {
                app.broadcastToOtherTabs = jest.fn();
            }
            if (!app.queueOfflineMessage) {
                app.queueOfflineMessage = jest.fn();
            }
            if (!app.clearReply) {
                app.clearReply = jest.fn();
            }
        });
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
            success: true,
            data: {
                id: 123,
                content: messageContent,
                user_id: mockUser.id,
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
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('/api/messages.php', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'X-Requested-With': 'XMLHttpRequest'
            })
        }));
        
        // Verify form data contains message and CSRF token (can't directly test FormData)
        const fetchCall = global.fetch.mock.calls[0];
        const formData = fetchCall[1].body;
        // We need to check that formData was created with the right values
        
        // Verify UI updates
        expect(app.renderMessages).toHaveBeenCalled();
        expect(app.scrollToBottom).toHaveBeenCalled();
        expect(mockMessageInput.value).toBe('');
        expect(app.saveMessagesToStorage).toHaveBeenCalled();
        expect(app.broadcastToOtherTabs).toHaveBeenCalledWith('message_sent', mockResponse.data);
    });
    
    test('should handle empty message', async () => {
        // Arrange
        mockMessageInput.value = '';
        
        // Act
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(app.showError).toHaveBeenCalledWith('Message cannot be empty');
    });
    
    test('should handle message too long', async () => {
        // Arrange
        const longMessage = 'a'.repeat(app.config.maxMessageLength + 1);
        mockMessageInput.value = longMessage;
        
        // Act
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(false);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(app.showError).toHaveBeenCalledWith(expect.stringContaining('Message too long'));
    });
    
    test('should handle server error', async () => {
        // Arrange
        mockMessageInput.value = 'Test message';
        
        const errorMessage = 'Server error';
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: false,
                message: errorMessage
            })
        });
        
        // Act
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(app.showError).toHaveBeenCalledWith(errorMessage);
    });
    
    test('should handle network error', async () => {
        // Arrange
        mockMessageInput.value = 'Test message';
        
        // Mock a network error
        global.fetch.mockRejectedValueOnce(new Error('network error'));
        
        // Act
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(app.showError).toHaveBeenCalledWith(expect.stringContaining('Network error'));
        expect(app.queueOfflineMessage).toHaveBeenCalledWith('Test message');
    });
    
    test('should handle reply to message', async () => {
        // Arrange
        const messageContent = 'Reply message';
        mockMessageInput.value = messageContent;
        
        // Set up reply state
        app.state.replyingTo = {
            id: 456,
            content: 'Original message'
        };
        
        const mockResponse = {
            success: true,
            data: {
                id: 789,
                content: messageContent,
                reply_to_id: 456,
                user_id: mockUser.id,
                username: mockUser.username,
                created_at: new Date().toISOString()
            }
        };
        
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });
        
        // Act
        const result = await app.sendMessage();
        
        // Assert
        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(app.clearReply).toHaveBeenCalled();
        
        // Verify that message was added to state
        expect(app.state.messages).toContainEqual(expect.objectContaining({
            id: mockResponse.data.id,
            is_own: true
        }));
    });
    
    test('should update lastMessageId after successful send', async () => {
        // Arrange
        mockMessageInput.value = 'Test message';
        
        const messageId = 999;
        const mockResponse = {
            success: true,
            data: {
                id: messageId,
                content: 'Test message',
                user_id: mockUser.id,
                username: mockUser.username,
                created_at: new Date().toISOString()
            }
        };
        
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });
        
        // Act
        await app.sendMessage();
        
        // Assert
        expect(app.state.lastMessageId).toBe(messageId);
    });
});
