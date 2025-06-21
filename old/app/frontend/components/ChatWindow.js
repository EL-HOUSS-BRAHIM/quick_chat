/**
 * Chat Window Component - Organized Architecture
 * 
 * Main chat interface component that manages the complete chat experience
 * Handles private and group chats with real-time messaging
 * Migrated from assets/js/features/chat/index.js
 */

import { apiClient } from '../services/apiClient.js';
import { websocketManager } from '../services/websocketManager.js';
import { EventBus } from '../services/EventBus.js';
import { chatStore } from '../state/chatStore.js';
import { userStore } from '../state/userStore.js';
import { logger } from '../utils/logger.js';
import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { Sidebar } from './Sidebar.js';

export class ChatWindow {
  constructor(config = {}) {
    this.config = {
      chatType: config.chatType || 'private', // 'private' or 'group'
      targetUserId: config.targetUserId || null,
      groupId: config.groupId || null,
      currentUserId: config.currentUserId,
      container: config.container || document.getElementById('chat-container'),
      messageLimit: config.messageLimit || 50,
      loadMoreIncrement: config.loadMoreIncrement || 20,
      ...config
    };

    // Initialize event bus
    this.eventBus = new EventBus();
    
    // Component state
    this.state = {
      isInitialized: false,
      isLoading: false,
      hasMoreMessages: true,
      lastMessageId: 0,
      connectionStatus: 'disconnected',
      typingUsers: new Set(),
      activeCall: null
    };

    // Sub-components
    this.messageList = null;
    this.messageInput = null;
    this.sidebar = null;

    // DOM elements
    this.container = null;
    this.messagesContainer = null;
    this.inputContainer = null;
    this.sidebarContainer = null;
  }

  /**
   * Initialize the chat window
   */
  async init() {
    try {
      logger.info('Initializing Chat Window', this.config);

      // Validate configuration
      this.validateConfig();

      // Setup DOM structure
      this.setupDOM();

      // Initialize sub-components
      await this.initComponents();

      // Setup event listeners
      this.setupEventListeners();

      // Load initial data
      await this.loadInitialData();

      // Connect to real-time updates
      this.connectWebSocket();

      this.state.isInitialized = true;
      this.eventBus.emit('chatwindow:initialized', this.config);

      logger.info('Chat Window initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Chat Window:', error);
      this.handleError(error);
    }
  }

  /**
   * Validate configuration
   */
  validateConfig() {
    if (!this.config.currentUserId) {
      throw new Error('Current user ID is required');
    }

    if (this.config.chatType === 'group' && !this.config.groupId) {
      throw new Error('Group ID is required for group chats');
    }

    if (this.config.chatType === 'private' && !this.config.targetUserId) {
      throw new Error('Target user ID is required for private chats');
    }

    if (!this.config.container) {
      throw new Error('Container element is required');
    }
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    this.container = this.config.container;
    
    // Clear existing content
    this.container.innerHTML = '';

    // Create main structure
    this.container.innerHTML = `
      <div class="chat-window" data-chat-type="${this.config.chatType}">
        <div class="chat-header">
          <div class="chat-title">
            <h2 id="chat-title">Loading...</h2>
            <div class="chat-status" id="chat-status"></div>
          </div>
          <div class="chat-actions">
            <button class="btn-voice-call" id="btn-voice-call" title="Voice Call">
              <i class="fas fa-phone"></i>
            </button>
            <button class="btn-video-call" id="btn-video-call" title="Video Call">
              <i class="fas fa-video"></i>
            </button>
            <button class="btn-info" id="btn-info" title="Chat Info">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
        
        <div class="chat-main">
          <div class="chat-messages" id="chat-messages">
            <!-- MessageList component will be mounted here -->
          </div>
          
          <div class="chat-sidebar" id="chat-sidebar" style="display: none;">
            <!-- Sidebar component will be mounted here -->
          </div>
        </div>
        
        <div class="chat-input-container" id="chat-input-container">
          <!-- MessageInput component will be mounted here -->
        </div>
        
        <div class="typing-indicator" id="typing-indicator" style="display: none;">
          <span class="typing-text"></span>
        </div>
      </div>
    `;

    // Get DOM element references
    this.messagesContainer = this.container.querySelector('#chat-messages');
    this.inputContainer = this.container.querySelector('#chat-input-container');
    this.sidebarContainer = this.container.querySelector('#chat-sidebar');
    this.headerTitle = this.container.querySelector('#chat-title');
    this.statusElement = this.container.querySelector('#chat-status');
    this.typingIndicator = this.container.querySelector('#typing-indicator');
  }

  /**
   * Initialize sub-components
   */
  async initComponents() {
    // Initialize message list
    this.messageList = new MessageList({
      container: this.messagesContainer,
      chatType: this.config.chatType,
      chatId: this.getChatId(),
      currentUserId: this.config.currentUserId,
      messageLimit: this.config.messageLimit
    });
    await this.messageList.init();

    // Initialize message input
    this.messageInput = new MessageInput({
      container: this.inputContainer,
      chatType: this.config.chatType,
      chatId: this.getChatId(),
      currentUserId: this.config.currentUserId
    });
    await this.messageInput.init();

    // Initialize sidebar
    this.sidebar = new Sidebar({
      container: this.sidebarContainer,
      chatType: this.config.chatType,
      chatId: this.getChatId()
    });
    await this.sidebar.init();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Header button events
    const voiceCallBtn = this.container.querySelector('#btn-voice-call');
    const videoCallBtn = this.container.querySelector('#btn-video-call');
    const infoBtn = this.container.querySelector('#btn-info');

    voiceCallBtn?.addEventListener('click', () => this.startVoiceCall());
    videoCallBtn?.addEventListener('click', () => this.startVideoCall());
    infoBtn?.addEventListener('click', () => this.toggleSidebar());

    // Message input events
    this.messageInput.eventBus.on('message:send', (data) => {
      this.sendMessage(data);
    });

    this.messageInput.eventBus.on('typing:start', () => {
      this.sendTypingIndicator(true);
    });

    this.messageInput.eventBus.on('typing:stop', () => {
      this.sendTypingIndicator(false);
    });

    // Message list events
    this.messageList.eventBus.on('message:edit', (data) => {
      this.editMessage(data);
    });

    this.messageList.eventBus.on('message:delete', (data) => {
      this.deleteMessage(data);
    });

    this.messageList.eventBus.on('message:react', (data) => {
      this.reactToMessage(data);
    });

    this.messageList.eventBus.on('load:more', () => {
      this.loadMoreMessages();
    });

    // Store events
    chatStore.on('messages:updated', (data) => {
      this.messageList.updateMessages(data.messages);
    });

    userStore.on('user:status_changed', (data) => {
      this.updateUserStatus(data);
    });
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket() {
    // Subscribe to relevant WebSocket events
    websocketManager.subscribe('message', (data) => {
      if (this.isRelevantMessage(data)) {
        this.handleIncomingMessage(data);
      }
    });

    websocketManager.subscribe('typing', (data) => {
      if (this.isRelevantTyping(data)) {
        this.handleTypingIndicator(data);
      }
    });

    websocketManager.subscribe('user_status', (data) => {
      this.handleUserStatusChange(data);
    });

    // Monitor connection status
    websocketManager.eventBus.on('websocket:connected', () => {
      this.updateConnectionStatus('connected');
    });

    websocketManager.eventBus.on('websocket:disconnected', () => {
      this.updateConnectionStatus('disconnected');
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.state.isLoading = true;
      this.updateLoadingState(true);

      // Load chat info
      await this.loadChatInfo();

      // Load initial messages
      await this.loadMessages();

      // Load user info if private chat
      if (this.config.chatType === 'private') {
        await this.loadUserInfo();
      }

    } catch (error) {
      logger.error('Failed to load initial data:', error);
      this.handleError(error);
    } finally {
      this.state.isLoading = false;
      this.updateLoadingState(false);
    }
  }

  /**
   * Load chat information
   */
  async loadChatInfo() {
    try {
      let chatInfo;

      if (this.config.chatType === 'group') {
        chatInfo = await apiClient.getGroup(this.config.groupId);
        this.updateChatTitle(chatInfo.name);
      } else {
        chatInfo = await apiClient.getUser(this.config.targetUserId);
        this.updateChatTitle(chatInfo.display_name || chatInfo.username);
      }

      // Store chat info
      chatStore.setChatInfo(this.getChatId(), chatInfo);

    } catch (error) {
      logger.error('Failed to load chat info:', error);
      this.updateChatTitle('Unknown Chat');
    }
  }

  /**
   * Load messages
   */
  async loadMessages(offset = 0) {
    try {
      const messages = await apiClient.getMessages(
        this.config.chatType,
        this.getChatId(),
        {
          limit: this.config.messageLimit,
          offset
        }
      );

      // Update state
      if (messages.length < this.config.messageLimit) {
        this.state.hasMoreMessages = false;
      }

      if (messages.length > 0) {
        this.state.lastMessageId = messages[messages.length - 1].id;
      }

      // Store messages
      chatStore.addMessages(this.getChatId(), messages);

      return messages;

    } catch (error) {
      logger.error('Failed to load messages:', error);
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage(messageData) {
    try {
      const message = await apiClient.sendMessage(
        this.config.chatType,
        this.getChatId(),
        {
          content: messageData.content,
          type: messageData.type || 'text',
          reply_to: messageData.replyTo || null,
          ...messageData
        }
      );

      // Add to local store
      chatStore.addMessage(this.getChatId(), message);

      // Send via WebSocket for real-time delivery
      websocketManager.send({
        type: 'message',
        action: 'send',
        chat_type: this.config.chatType,
        chat_id: this.getChatId(),
        message
      });

      this.eventBus.emit('message:sent', { message });

    } catch (error) {
      logger.error('Failed to send message:', error);
      this.handleError(error);
    }
  }

  /**
   * Handle incoming real-time message
   */
  handleIncomingMessage(data) {
    if (data.message) {
      chatStore.addMessage(this.getChatId(), data.message);
      this.eventBus.emit('message:received', { message: data.message });
    }
  }

  /**
   * Get chat ID based on chat type
   */
  getChatId() {
    return this.config.chatType === 'group' 
      ? this.config.groupId 
      : this.config.targetUserId;
  }

  /**
   * Check if message is relevant to current chat
   */
  isRelevantMessage(data) {
    if (this.config.chatType === 'group') {
      return data.group_id === this.config.groupId;
    } else {
      return (
        (data.sender_id === this.config.targetUserId && data.recipient_id === this.config.currentUserId) ||
        (data.sender_id === this.config.currentUserId && data.recipient_id === this.config.targetUserId)
      );
    }
  }

  /**
   * Update chat title
   */
  updateChatTitle(title) {
    if (this.headerTitle) {
      this.headerTitle.textContent = title;
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    this.state.connectionStatus = status;
    
    if (this.statusElement) {
      this.statusElement.textContent = status === 'connected' ? 'Online' : 'Offline';
      this.statusElement.className = `chat-status ${status}`;
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState(isLoading) {
    if (isLoading) {
      this.container.classList.add('loading');
    } else {
      this.container.classList.remove('loading');
    }
  }

  /**
   * Handle errors
   */
  handleError(error) {
    logger.error('Chat Window error:', error);
    
    // Emit error event for global error handling
    this.eventBus.emit('error', { error, component: 'ChatWindow' });
    
    // Show user-friendly error message
    // This could be enhanced with a proper notification system
    console.error('Chat error:', error.message);
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    // Cleanup sub-components
    if (this.messageList) {
      this.messageList.destroy();
    }
    
    if (this.messageInput) {
      this.messageInput.destroy();
    }
    
    if (this.sidebar) {
      this.sidebar.destroy();
    }

    // Disconnect WebSocket subscriptions
    websocketManager.unsubscribe('message');
    websocketManager.unsubscribe('typing');
    websocketManager.unsubscribe('user_status');

    // Clear DOM
    if (this.container) {
      this.container.innerHTML = '';
    }

    this.eventBus.emit('chatwindow:destroyed');
  }

  // Additional methods for calls, typing, etc. can be added here
  startVoiceCall() {
    logger.info('Starting voice call');
    // WebRTC voice call implementation
  }

  startVideoCall() {
    logger.info('Starting video call');
    // WebRTC video call implementation
  }

  toggleSidebar() {
    const isVisible = this.sidebarContainer.style.display !== 'none';
    this.sidebarContainer.style.display = isVisible ? 'none' : 'block';
  }

  sendTypingIndicator(isTyping) {
    websocketManager.send({
      type: 'typing',
      chat_type: this.config.chatType,
      chat_id: this.getChatId(),
      user_id: this.config.currentUserId,
      is_typing: isTyping
    });
  }

  handleTypingIndicator(data) {
    if (data.is_typing) {
      this.state.typingUsers.add(data.user_id);
    } else {
      this.state.typingUsers.delete(data.user_id);
    }
    
    this.updateTypingIndicator();
  }

  updateTypingIndicator() {
    const typingCount = this.state.typingUsers.size;
    
    if (typingCount === 0) {
      this.typingIndicator.style.display = 'none';
    } else {
      const typingText = typingCount === 1 
        ? 'Someone is typing...'
        : `${typingCount} people are typing...`;
      
      this.typingIndicator.querySelector('.typing-text').textContent = typingText;
      this.typingIndicator.style.display = 'block';
    }
  }

  async loadMoreMessages() {
    if (this.state.isLoading || !this.state.hasMoreMessages) {
      return;
    }

    try {
      const currentMessageCount = chatStore.getMessages(this.getChatId()).length;
      await this.loadMessages(currentMessageCount);
    } catch (error) {
      logger.error('Failed to load more messages:', error);
    }
  }

  loadUserInfo() {
    // Load additional user information for private chats
    // Implementation depends on specific requirements
  }

  editMessage(data) {
    // Implement message editing
    logger.info('Editing message:', data);
  }

  deleteMessage(data) {
    // Implement message deletion
    logger.info('Deleting message:', data);
  }

  reactToMessage(data) {
    // Implement message reactions
    logger.info('Reacting to message:', data);
  }

  updateUserStatus(data) {
    // Update user online/offline status
    logger.info('User status changed:', data);
  }

  isRelevantTyping(data) {
    // Check if typing indicator is relevant to current chat
    return this.isRelevantMessage(data);
  }

  handleUserStatusChange(data) {
    // Handle user status changes
    this.updateUserStatus(data);
  }
}

export default ChatWindow;
