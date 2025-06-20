/**
 * Chat Module
 * Handles chat functionality, real-time messaging and UI
 * Enhanced with optimized WebSocket connection management
 */

import app from '../../core/app.js';
import eventBus from '../../core/event-bus.js';
import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { state } from '../../core/state.js';
import utils from '../../core/utils.js';
import WebSocketManager from '../../core/websocket-manager.js';
import ChatUI from './ui.js';
import MessageStore from './message-store.js';
import VoiceMessages from './voice-messages.js';
import ChatReplies from './replies.js';
import ChatReactions from './reactions.js';
import ThreadManager from './thread-manager.js';
import ChatSearch from './search.js';
import { UserMentions } from './mentions.js';

class ChatModule {
  constructor(options = {}) {
    // Configuration
    this.config = {
      chatType: options.chatType || 'private', // 'private' or 'group'
      targetUserId: options.targetUserId || null,
      groupId: options.groupId || null,
      currentUserId: app.getCurrentUserId(),
      container: options.container || document.getElementById('chat-container'),
      messageLimit: options.messageLimit || 50,
      loadMoreIncrement: options.loadMoreIncrement || 20,
      typingIndicatorTimeout: options.typingIndicatorTimeout || 3000,
      ...options
    };
    
    // State
    this.state = {
      isInitialized: false,
      connectionStatus: 'disconnected',
      lastMessageId: 0,
      lastMessageTime: 0,
      isTyping: false,
      lastTypingTime: 0,
      typingUsers: new Set(),
      isLoadingMessages: false,
      hasMoreMessages: true,
      typingTimeout: null,
      reconnectTimeout: null
    };
    
    // Sub-modules
    this.ui = new ChatUI(this.config);
    this.messageStore = new MessageStore(this.config);
    this.wsManager = new WebSocketManager({
      reconnectDelay: 2000,
      heartbeatInterval: 30000,
      debug: this.config.debug || false,
      batchingEnabled: true
    });
    
    // Feature modules
    this.voiceMessages = new VoiceMessages();
    this.replies = new ChatReplies();
    this.reactions = new ChatReactions();
    this.threadManager = new ThreadManager();
    this.search = new ChatSearch();
    this.mentions = new UserMentions(this);
    
    // Initialize chat module
    this.init();
  }
  
  /**
   * Initialize the chat module
   */
  async init() {
    try {
      // Initialize UI
      await this.ui.initialize();
      
      // Load initial messages
      await this.loadInitialMessages();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Initialize feature modules
      this.voiceMessages.init(this);
      this.replies.init(this);
      this.reactions.init(this);
      this.threadManager.init(this);
      this.search.init(this);
      // Mentions module is already initialized in constructor
      
      // Connect to WebSocket if available
      this.connectWebSocket();
      
      this.state.isInitialized = true;
      console.log('Chat module initialized successfully');
      
      // Emit ready event
      eventBus.emit('chat:ready');
      
      return true;
    } catch (error) {
      errorHandler.handleError('Failed to initialize chat module', error);
      
      // Show error in UI
      this.ui.showError('Failed to initialize chat. Please refresh the page.');
      
      // Emit error event
      eventBus.emit('chat:error', {
        type: 'initialization',
        message: 'Failed to initialize chat module',
        error
      });
      
      return false;
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for message send events
    eventBus.on('message:send', (data) => this.sendMessage(data));
    
    // Listen for typing indicator events
    eventBus.on('chat:typing', () => this.sendTypingIndicator());
    
    // Listen for online/offline events
    eventBus.on('state:changed', ({ state }) => {
      if (state.isOnline !== undefined) {
        if (state.isOnline) {
          this.reconnect();
        } else {
          this.disconnectWebSocket();
        }
      }
    });
    
    // Listen for visibility change
    eventBus.on('visibility:change', ({ isVisible }) => {
      if (isVisible) {
        this.loadNewMessages();
      }
    });
  }

  /**
   * Load initial messages
   */
  async loadInitialMessages() {
    try {
      this.ui.showLoading(true);
      
      const endpoint = this.config.chatType === 'private'
        ? `/messages?user_id=${this.config.targetUserId}&limit=${this.config.messageLimit}`
        : `/groups/${this.config.groupId}/messages?limit=${this.config.messageLimit}`;
      
      const response = await apiClient.get(endpoint);
      
      if (response && response.messages) {
        // Store messages
        this.messageStore.addMessages(response.messages);
        
        // Update last message ID
        if (response.messages.length > 0) {
          this.state.lastMessageId = Math.max(...response.messages.map(m => m.id));
          this.state.lastMessageTime = Math.max(...response.messages.map(m => new Date(m.created_at).getTime()));
        }
        
        // Render messages
        this.ui.renderMessages(response.messages);
        
        // Mark as read
        this.markAsRead();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      app.core.errorHandler.handleError(error);
    } finally {
      this.ui.showLoading(false);
    }
  }

  /**
   * Load older messages
   */
  async loadOlderMessages() {
    if (this.state.loadingHistory || this.state.noMoreHistory) {
      return;
    }
    
    try {
      this.state.loadingHistory = true;
      this.ui.showHistoryLoading(true);
      
      const oldestMessage = this.messageStore.getOldestMessage();
      if (!oldestMessage) return;
      
      const endpoint = this.config.chatType === 'private'
        ? `/messages?user_id=${this.config.targetUserId}&before=${oldestMessage.id}&limit=${this.config.messageLimit}`
        : `/groups/${this.config.groupId}/messages?before=${oldestMessage.id}&limit=${this.config.messageLimit}`;
      
      const response = await apiClient.get(endpoint);
      
      if (response && response.messages) {
        if (response.messages.length === 0) {
          this.state.noMoreHistory = true;
          this.ui.showNoMoreHistory();
          return;
        }
        
        // Store messages
        this.messageStore.addMessages(response.messages);
        
        // Render messages
        this.ui.renderOlderMessages(response.messages);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
      app.core.errorHandler.handleError(error);
    } finally {
      this.state.loadingHistory = false;
      this.ui.showHistoryLoading(false);
    }
  }

  /**
   * Load new messages
   */
  async loadNewMessages() {
    try {
      const endpoint = this.config.chatType === 'private'
        ? `/messages?user_id=${this.config.targetUserId}&after=${this.state.lastMessageId}&limit=${this.config.messageLimit}`
        : `/groups/${this.config.groupId}/messages?after=${this.state.lastMessageId}&limit=${this.config.messageLimit}`;
      
      const response = await apiClient.get(endpoint);
      
      if (response && response.messages && response.messages.length > 0) {
        // Store messages
        this.messageStore.addMessages(response.messages);
        
        // Update last message ID
        this.state.lastMessageId = Math.max(...response.messages.map(m => m.id), this.state.lastMessageId);
        this.state.lastMessageTime = Math.max(...response.messages.map(m => new Date(m.created_at).getTime()), this.state.lastMessageTime);
        
        // Render new messages
        this.ui.renderNewMessages(response.messages);
        
        // Mark as read
        this.markAsRead();
      }
    } catch (error) {
      console.error('Error loading new messages:', error);
      app.core.errorHandler.handleError(error);
    }
  }

  /**
   * Start polling for new messages
   */
  startPolling() {
    // Clear existing interval
    this.stopPolling();
    
    // Start new polling interval
    this.pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.loadNewMessages();
      }
    }, this.config.pollInterval);
  }

  /**
   * Stop polling for new messages
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Send a message
   * @param {Object} data - Message data
   */
  async sendMessage(data) {
    try {
      this.ui.disableSendButton(true);
      
      // Extract mentions from message content
      const mentions = this.state.currentMessageMentions || this.mentions.getMentionsInText(data.content);
      
      const messageData = {
        content: data.content,
        type: data.type || 'text',
        reply_to: this.state.replyingTo ? this.state.replyingTo.id : null,
        mentions: mentions,
        ...data
      };
      
      // Cancel reply if active
      this.cancelReply();
      
      // Cancel editing if active
      this.cancelEdit();
      
      // Clear current mentions
      if (this.mentions) {
        this.mentions.clearCurrentMentions();
      }
      
      // Add optimistic message
      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: optimisticId,
        content: messageData.content,
        type: messageData.type,
        sender_id: this.config.currentUserId,
        recipient_id: this.config.chatType === 'private' ? this.config.targetUserId : null,
        group_id: this.config.chatType === 'group' ? this.config.groupId : null,
        created_at: new Date().toISOString(),
        status: 'sending',
        mentions: messageData.mentions,
        isOptimistic: true
      };
      
      // Add to store and render
      this.messageStore.addMessage(optimisticMessage);
      this.ui.renderNewMessages([optimisticMessage]);
      
      // Determine endpoint
      const endpoint = this.config.chatType === 'private'
        ? `/messages?user_id=${this.config.targetUserId}`
        : `/groups/${this.config.groupId}/messages`;
      
      // Send message to server
      const response = await apiClient.post(endpoint, messageData);
      
      if (response && response.message) {
        // Replace optimistic message with real one
        this.messageStore.replaceMessage(optimisticId, response.message);
        
        // Update UI
        this.ui.updateMessage(optimisticId, response.message);
        
        // Update last message ID
        this.state.lastMessageId = Math.max(response.message.id, this.state.lastMessageId);
        this.state.lastMessageTime = Math.max(new Date(response.message.created_at).getTime(), this.state.lastMessageTime);
        
        // Emit event
        eventBus.emit('message:sent', response.message);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Mark optimistic message as failed
      this.messageStore.updateMessage(optimisticId, { status: 'failed' });
      this.ui.markMessageAsFailed(optimisticId);
      
      app.core.errorHandler.handleError(error);
    } finally {
      this.ui.disableSendButton(false);
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator() {
    // Clear existing timeout
    if (this.state.typingTimeout) {
      clearTimeout(this.state.typingTimeout);
    }
    
    // Only send if not already typing
    if (!this.state.isTyping) {
      this.state.isTyping = true;
      
      // Send to server
      const endpoint = this.config.chatType === 'private'
        ? `/users/${this.config.targetUserId}/typing`
        : `/groups/${this.config.groupId}/typing`;
      
      apiClient.post(endpoint)
        .catch(error => {
          console.error('Error sending typing indicator:', error);
        });
    }
    
    // Set timeout to clear typing state
    this.state.typingTimeout = setTimeout(() => {
      this.state.isTyping = false;
    }, this.config.typingIndicatorTimeout);
  }

  /**
   * Mark messages as read
   */
  markAsRead() {
    const endpoint = this.config.chatType === 'private'
      ? `/messages/read?user_id=${this.config.targetUserId}`
      : `/groups/${this.config.groupId}/messages/read`;
    
    apiClient.post(endpoint)
      .catch(error => {
        console.error('Error marking messages as read:', error);
      });
  }

  /**
   * Set replying to a message
   * @param {Object} message - Message to reply to
   */
  setReplyTo(message) {
    this.state.replyingTo = message;
    this.ui.showReplyingTo(message);
  }

  /**
   * Cancel reply
   */
  cancelReply() {
    this.state.replyingTo = null;
    this.ui.hideReplyingTo();
  }

  /**
   * Set editing a message
   * @param {Object} message - Message to edit
   */
  setEditingMessage(message) {
    this.state.editingMessage = message;
    this.ui.showEditingMessage(message);
  }

  /**
   * Cancel edit
   */
  cancelEdit() {
    this.state.editingMessage = null;
    this.ui.hideEditingMessage();
  }

  /**
   * Delete a message
   * @param {number|string} messageId - ID of message to delete
   */
  async deleteMessage(messageId) {
    try {
      const endpoint = `/messages/${messageId}`;
      
      await apiClient.delete(endpoint);
      
      // Remove from store
      this.messageStore.removeMessage(messageId);
      
      // Remove from UI
      this.ui.removeMessage(messageId);
      
      // Emit event
      eventBus.emit('message:deleted', { messageId });
    } catch (error) {
      console.error('Error deleting message:', error);
      app.core.errorHandler.handleError(error);
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    // Set up WebSocket URL
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    // Initialize WebSocket manager
    this.wsManager.init(wsUrl, utils.storage.get('auth_token'), this.config.currentUserId)
      .then(() => {
        this.state.connectionStatus = 'connected';
        this.ui.updateConnectionStatus('connected');
        
        // Subscribe to appropriate chat channel
        if (this.config.chatType === 'private') {
          this.wsManager.subscribe('private_chat', { user_id: this.config.targetUserId });
        } else {
          this.wsManager.subscribe('group_chat', { group_id: this.config.groupId });
        }
        
        // Set up message handlers
        this.setupMessageHandlers();
      })
      .catch(error => {
        console.error('Failed to connect WebSocket:', error);
        this.state.connectionStatus = 'error';
        this.ui.updateConnectionStatus('error');
      });
    
    // Listen for WebSocket status changes
    eventBus.on('websocket:status-change', (data) => {
      this.state.connectionStatus = data.status;
      this.ui.updateConnectionStatus(data.status);
      
      if (data.status === 'connected') {
        // Mark messages as read when reconnecting
        this.markMessagesAsRead();
      }
    });
  }
  
  /**
   * Set up WebSocket message handlers
   */
  setupMessageHandlers() {
    // Handle new messages
    this.wsManager.registerHandler('message', (data) => {
      if (data.message.sender_id !== this.config.currentUserId) {
        this.messageStore.addMessage(data.message);
        this.ui.renderNewMessages([data.message]);
        this.state.lastMessageId = Math.max(data.message.id, this.state.lastMessageId);
        this.state.lastMessageTime = Math.max(new Date(data.message.created_at).getTime(), this.state.lastMessageTime);
        
        // Mark as read if chat is visible
        if (document.visibilityState === 'visible') {
          this.markMessagesAsRead();
        }
      }
    });
    
    // Handle typing indicators
    this.wsManager.registerHandler('typing', (data) => {
      if (data.user_id !== this.config.currentUserId) {
        this.ui.showUserTyping(data.user_id);
        
        // Add to typing users set
        this.state.typingUsers.add(data.user_id);
        
        // Remove after timeout
        setTimeout(() => {
          this.state.typingUsers.delete(data.user_id);
          if (this.state.typingUsers.size === 0) {
            this.ui.hideTypingIndicator();
          }
        }, this.config.typingIndicatorTimeout);
      }
    });
    
    // Handle read receipts
    this.wsManager.registerHandler('read_receipt', (data) => {
      this.ui.updateReadReceipts(data.user_id, data.timestamp);
    });
    
    // Handle message edited
    this.wsManager.registerHandler('message_edited', (data) => {
      this.messageStore.updateMessage(data.message_id, data.message);
      this.ui.updateMessage(data.message_id, data.message);
    });
    
    // Handle message deleted
    this.wsManager.registerHandler('message_deleted', (data) => {
      this.messageStore.removeMessage(data.message_id);
      this.ui.removeMessage(data.message_id);
    });
  }
  
  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    this.wsManager.disconnect();
  }

  /**
   * Reconnect to services
   */
  reconnect() {
    // Reconnect WebSocket
    this.connectWebSocket();
    
    // Fetch new messages
    this.loadNewMessages();
    
    // Restart polling
    this.startPolling();
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Stop polling
    this.stopPolling();
    
    // Disconnect WebSocket
    this.disconnectWebSocket();
    
    // Clean up UI
    this.ui.destroy();
    
    // Clean up feature modules
    if (this.voiceMessages && typeof this.voiceMessages.destroy === 'function') {
      this.voiceMessages.destroy();
    }
    
    if (this.replies && typeof this.replies.destroy === 'function') {
      this.replies.destroy();
    }
    
    if (this.reactions && typeof this.reactions.destroy === 'function') {
      this.reactions.destroy();
    }
    
    if (this.threadManager && typeof this.threadManager.destroy === 'function') {
      this.threadManager.destroy();
    }
    
    if (this.search && typeof this.search.destroy === 'function') {
      this.search.destroy();
    }
    
    // Clear event listeners
    eventBus.off('message:send');
    eventBus.off('chat:typing');
  }
}

export default ChatModule;
