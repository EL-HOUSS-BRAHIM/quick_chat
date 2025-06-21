/**
 * Private Chat Module
 * Handles one-on-one chat functionality
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';

class PrivateChat {
  constructor() {
    this.currentChat = null;
    this.messageHistory = [];
    this.isLoading = false;
    this.hasMoreMessages = true;
    this.lastMessageTimestamp = null;
    
    // Bind methods
    this.loadChat = this.loadChat.bind(this);
    this.loadMoreMessages = this.loadMoreMessages.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.handleNewMessage = this.handleNewMessage.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize private chat module
   */
  init() {
    // Subscribe to events
    eventBus.subscribe('private:chat:load', this.loadChat);
    eventBus.subscribe('private:chat:message:send', this.sendMessage);
    eventBus.subscribe('private:chat:message:new', this.handleNewMessage);
    eventBus.subscribe('private:chat:load:more', this.loadMoreMessages);
  }
  
  /**
   * Load chat with a specific user
   * @param {Object} data Chat data
   */
  async loadChat(data) {
    const { userId, username } = data;
    
    if (!userId) {
      console.error('No user ID provided for private chat');
      return;
    }
    
    try {
      this.isLoading = true;
      this.currentChat = userId;
      
      // Publish loading state
      eventBus.publish('private:chat:loading', { userId });
      
      // Reset state
      this.messageHistory = [];
      this.hasMoreMessages = true;
      this.lastMessageTimestamp = null;
      
      // Load messages
      const response = await apiClient.get('/api/messages.php', {
        action: 'getPrivateMessages',
        userId,
        limit: 50
      });
      
      if (response.success) {
        this.messageHistory = response.data.messages || [];
        this.hasMoreMessages = response.data.hasMore || false;
        
        if (this.messageHistory.length > 0) {
          this.lastMessageTimestamp = this.messageHistory[0].timestamp;
        }
        
        // Update state
        state.update('currentPrivateChat', {
          userId,
          username: username || response.data.username || 'Unknown User',
          messages: this.messageHistory,
          hasMoreMessages: this.hasMoreMessages
        });
        
        // Publish loaded event
        eventBus.publish('private:chat:loaded', {
          userId,
          messages: this.messageHistory,
          hasMoreMessages: this.hasMoreMessages
        });
      } else {
        throw new Error(response.error || 'Failed to load private chat');
      }
    } catch (error) {
      console.error('Error loading private chat:', error);
      eventBus.publish('private:chat:error', {
        userId,
        error: error.message || 'Failed to load chat'
      });
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Load more messages for the current chat
   */
  async loadMoreMessages() {
    if (!this.currentChat || this.isLoading || !this.hasMoreMessages) {
      return;
    }
    
    try {
      this.isLoading = true;
      
      // Publish loading state
      eventBus.publish('private:chat:loading:more', { userId: this.currentChat });
      
      // Load older messages
      const response = await apiClient.get('/api/messages.php', {
        action: 'getPrivateMessages',
        userId: this.currentChat,
        before: this.lastMessageTimestamp,
        limit: 30
      });
      
      if (response.success) {
        const olderMessages = response.data.messages || [];
        this.hasMoreMessages = response.data.hasMore || false;
        
        if (olderMessages.length > 0) {
          // Update timestamp for pagination
          this.lastMessageTimestamp = olderMessages[0].timestamp;
          
          // Prepend to message history
          this.messageHistory = [...olderMessages, ...this.messageHistory];
          
          // Update state
          const currentChat = state.get('currentPrivateChat');
          if (currentChat && currentChat.userId === this.currentChat) {
            state.update('currentPrivateChat', {
              ...currentChat,
              messages: this.messageHistory,
              hasMoreMessages: this.hasMoreMessages
            });
          }
          
          // Publish loaded more event
          eventBus.publish('private:chat:loaded:more', {
            userId: this.currentChat,
            messages: olderMessages,
            hasMoreMessages: this.hasMoreMessages
          });
        } else {
          this.hasMoreMessages = false;
        }
      } else {
        throw new Error(response.error || 'Failed to load more messages');
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      eventBus.publish('private:chat:error', {
        userId: this.currentChat,
        error: error.message || 'Failed to load more messages'
      });
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Send a message in the current chat
   * @param {Object} data Message data
   */
  async sendMessage(data) {
    const { text, attachments = [] } = data;
    
    if (!this.currentChat) {
      console.error('No active private chat');
      return;
    }
    
    try {
      // Create temporary message for optimistic UI update
      const tempId = 'temp_' + Date.now();
      const tempMessage = {
        id: tempId,
        sender: state.get('currentUser').id,
        text,
        attachments,
        timestamp: Math.floor(Date.now() / 1000),
        isPending: true
      };
      
      // Add to message history for optimistic update
      this.messageHistory.push(tempMessage);
      
      // Update state
      const currentChat = state.get('currentPrivateChat');
      if (currentChat && currentChat.userId === this.currentChat) {
        state.update('currentPrivateChat', {
          ...currentChat,
          messages: [...this.messageHistory]
        });
      }
      
      // Publish pending message event
      eventBus.publish('private:chat:message:pending', {
        userId: this.currentChat,
        message: tempMessage
      });
      
      // Send message to server
      const response = await apiClient.post('/api/messages.php', {
        action: 'sendPrivateMessage',
        userId: this.currentChat,
        text,
        attachments
      });
      
      if (response.success) {
        // Replace temp message with actual message
        const actualMessage = response.data.message;
        
        // Update message history
        this.messageHistory = this.messageHistory.map(msg => 
          msg.id === tempId ? { ...actualMessage, isPending: false } : msg
        );
        
        // Update state
        if (currentChat && currentChat.userId === this.currentChat) {
          state.update('currentPrivateChat', {
            ...currentChat,
            messages: [...this.messageHistory]
          });
        }
        
        // Publish sent message event
        eventBus.publish('private:chat:message:sent', {
          userId: this.currentChat,
          message: actualMessage,
          tempId
        });
        
        return actualMessage;
      } else {
        // Mark message as failed
        this.messageHistory = this.messageHistory.map(msg => 
          msg.id === tempId ? { ...msg, isPending: false, isFailed: true } : msg
        );
        
        // Update state
        if (currentChat && currentChat.userId === this.currentChat) {
          state.update('currentPrivateChat', {
            ...currentChat,
            messages: [...this.messageHistory]
          });
        }
        
        // Publish error event
        eventBus.publish('private:chat:message:error', {
          userId: this.currentChat,
          tempId,
          error: response.error || 'Failed to send message'
        });
        
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending private message:', error);
      throw error;
    }
  }
  
  /**
   * Handle new incoming message
   * @param {Object} data Message data
   */
  handleNewMessage(data) {
    const { message } = data;
    
    // Only process if it's for the current chat
    if (
      this.currentChat && 
      ((message.sender === this.currentChat && message.recipient === state.get('currentUser').id) ||
       (message.sender === state.get('currentUser').id && message.recipient === this.currentChat))
    ) {
      // Add to message history
      this.messageHistory.push(message);
      
      // Update state
      const currentChat = state.get('currentPrivateChat');
      if (currentChat && currentChat.userId === this.currentChat) {
        state.update('currentPrivateChat', {
          ...currentChat,
          messages: [...this.messageHistory]
        });
      }
      
      // Publish received event
      eventBus.publish('private:chat:message:received', {
        userId: this.currentChat,
        message
      });
    }
  }
}

export default PrivateChat;
