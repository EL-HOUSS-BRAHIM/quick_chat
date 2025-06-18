/**
 * Chat Module
 * Central file for chat functionality
 */

import app from '../../core/app.js';
import eventBus from '../../core/event-bus.js';
import apiClient from '../../api/api-client.js';
import utils from '../../core/utils.js';
import MessageRenderer from './message-renderer.js';
import EmojiPicker from './emoji-picker.js';
import FileUploader from './file-uploader.js';
import MessageStore from './message-store.js';
import ChatUI from './ui.js';
import ChatReactions from './reactions.js';
import ChatReplies from './replies.js';
import VoiceRecorder from './recording.js';
import ChatSettings from './settings.js';
import GroupInfo from './group-info.js';
import MessageEditor from './editor.js';

class ChatModule {
  constructor(options = {}) {
    // Configuration
    this.config = {
      currentUserId: null,
      targetUserId: null,
      groupId: null,
      chatType: 'private', // 'private' or 'group'
      messageLimit: 50,
      typingTimeout: 3000,
      pollInterval: 5000,
      ...options
    };
    
    // State
    this.state = {
      isTyping: false,
      typingTimeout: null,
      replyingTo: null,
      editingMessage: null,
      loadingHistory: false,
      noMoreHistory: false,
      lastMessageId: 0,
      lastMessageTime: 0,
      connectionStatus: 'connecting'
    };
    
    // Components
    this.messageStore = new MessageStore();
    this.messageRenderer = new MessageRenderer();
    this.emojiPicker = new EmojiPicker();
    this.fileUploader = new FileUploader();
    this.reactions = new ChatReactions();
    this.replies = new ChatReplies();
    this.voiceRecorder = new VoiceRecorder();
    this.settings = new ChatSettings();
    this.groupInfo = new GroupInfo();
    this.editor = new MessageEditor();
    this.ui = new ChatUI(this);
    
    // Polling interval
    this.pollingInterval = null;
  }

  /**
   * Initialize chat module
   */
  async init() {
    try {
      // Get current user
      const user = app.core.state.getState('user');
      if (user) {
        this.config.currentUserId = user.id;
      }
      
      // Setup UI
      this.ui.init();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load initial messages
      await this.loadInitialMessages();
      
      // Start polling for new messages
      this.startPolling();
      
      // Connect to WebSocket if available
      this.connectWebSocket();
      
      // Emit initialized event
      eventBus.emit('chat:initialized', this.config);
    } catch (error) {
      console.error('Error initializing chat module:', error);
      app.core.errorHandler.handleError(error);
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
      
      const messageData = {
        content: data.content,
        type: data.type || 'text',
        reply_to: this.state.replyingTo ? this.state.replyingTo.id : null,
        ...data
      };
      
      // Cancel reply if active
      this.cancelReply();
      
      // Cancel editing if active
      this.cancelEdit();
      
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
    }, this.config.typingTimeout);
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
    // Implement WebSocket connection
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.state.connectionStatus = 'connected';
        this.ui.updateConnectionStatus('connected');
        
        // Send authentication
        const authToken = utils.storage.get('auth_token');
        if (authToken) {
          this.socket.send(JSON.stringify({
            type: 'auth',
            token: authToken
          }));
        }
        
        // Subscribe to chat
        const subscriptionData = this.config.chatType === 'private' 
          ? { type: 'subscribe', chat: 'private', user_id: this.config.targetUserId }
          : { type: 'subscribe', chat: 'group', group_id: this.config.groupId };
        
        this.socket.send(JSON.stringify(subscriptionData));
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message':
              if (data.message.sender_id !== this.config.currentUserId) {
                this.messageStore.addMessage(data.message);
                this.ui.renderNewMessages([data.message]);
                this.state.lastMessageId = Math.max(data.message.id, this.state.lastMessageId);
                this.state.lastMessageTime = Math.max(new Date(data.message.created_at).getTime(), this.state.lastMessageTime);
              }
              break;
              
            case 'typing':
              if (data.user_id !== this.config.currentUserId) {
                this.ui.showUserTyping(data.user_id);
              }
              break;
              
            case 'read_receipt':
              this.ui.updateReadReceipts(data.user_id, data.timestamp);
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.state.connectionStatus = 'disconnected';
        this.ui.updateConnectionStatus('disconnected');
        
        // Try to reconnect if closed unexpectedly
        if (app.core.state.getState('isOnline')) {
          setTimeout(() => this.connectWebSocket(), 3000);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.state.connectionStatus = 'error';
        this.ui.updateConnectionStatus('error');
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.state.connectionStatus = 'error';
      this.ui.updateConnectionStatus('error');
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
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
    
    // Clear event listeners
    eventBus.off('message:send');
    eventBus.off('chat:typing');
  }
}

export default ChatModule;
