/**
 * Message List Component - Organized Architecture
 * 
 * Handles the display and rendering of chat messages
 * Includes virtual scrolling for performance and message interactions
 * Migrated from assets/js/features/chat/message-renderer.js
 */

import { EventBus } from '../services/EventBus.js';
import { chatStore } from '../state/chatStore.js';
import { userStore } from '../state/userStore.js';
import { logger } from '../utils/logger.js';
import { formatTime, formatDate, escapeHtml } from '../utils/helpers.js';

export class MessageList {
  constructor(config = {}) {
    this.config = {
      container: config.container,
      chatType: config.chatType,
      chatId: config.chatId,
      currentUserId: config.currentUserId,
      messageLimit: config.messageLimit || 50,
      virtualScrolling: config.virtualScrolling !== false,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.messagesContainer = null;
    this.loadMoreButton = null;
    
    // Virtual scrolling state
    this.virtualScrollEnabled = this.config.virtualScrolling;
    this.visibleMessages = [];
    this.messageHeight = 60; // Estimated message height
    this.viewportHeight = 0;
    this.scrollTop = 0;
    this.totalHeight = 0;
    
    // Message state
    this.messages = [];
    this.renderedMessages = new Map();
    this.messageElements = new Map();
    
    // Intersection observer for lazy loading
    this.intersectionObserver = null;
    
    this.initialized = false;
  }

  /**
   * Initialize the message list
   */
  async init() {
    try {
      logger.info('Initializing Message List');

      this.container = this.config.container;
      this.setupDOM();
      this.setupEventListeners();
      this.setupIntersectionObserver();
      
      // Load initial messages
      await this.loadMessages();
      
      this.initialized = true;
      this.eventBus.emit('messagelist:initialized');

    } catch (error) {
      logger.error('Failed to initialize Message List:', error);
      throw error;
    }
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    this.container.innerHTML = `
      <div class="message-list">
        <div class="load-more-container" style="display: none;">
          <button class="btn-load-more" id="btn-load-more">Load More Messages</button>
        </div>
        
        <div class="messages-container" id="messages-container">
          <div class="messages-viewport" id="messages-viewport">
            <!-- Messages will be rendered here -->
          </div>
        </div>
        
        <div class="scroll-to-bottom" id="scroll-to-bottom" style="display: none;">
          <button class="btn-scroll-bottom">
            <i class="fas fa-chevron-down"></i>
            <span class="unread-count" style="display: none;"></span>
          </button>
        </div>
      </div>
    `;

    this.messagesContainer = this.container.querySelector('#messages-container');
    this.messagesViewport = this.container.querySelector('#messages-viewport');
    this.loadMoreButton = this.container.querySelector('#btn-load-more');
    this.scrollToBottomBtn = this.container.querySelector('#scroll-to-bottom');

    // Setup virtual scrolling if enabled
    if (this.virtualScrollEnabled) {
      this.setupVirtualScrolling();
    }
  }

  /**
   * Setup virtual scrolling
   */
  setupVirtualScrolling() {
    this.messagesContainer.style.overflowY = 'auto';
    this.messagesContainer.style.height = '100%';
    
    this.viewportHeight = this.messagesContainer.clientHeight;
    
    // Create virtual scroll container
    this.virtualContainer = document.createElement('div');
    this.virtualContainer.className = 'virtual-scroll-container';
    this.messagesViewport.appendChild(this.virtualContainer);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Load more button
    this.loadMoreButton?.addEventListener('click', () => {
      this.eventBus.emit('load:more');
    });

    // Scroll to bottom button
    this.scrollToBottomBtn?.addEventListener('click', () => {
      this.scrollToBottom();
    });

    // Scroll events for virtual scrolling and scroll-to-bottom button
    this.messagesContainer?.addEventListener('scroll', () => {
      this.handleScroll();
    });

    // Listen for message store updates
    chatStore.on('messages:added', (data) => {
      if (data.chatId === this.config.chatId) {
        this.addMessages(data.messages);
      }
    });

    chatStore.on('message:updated', (data) => {
      if (data.chatId === this.config.chatId) {
        this.updateMessage(data.message);
      }
    });

    chatStore.on('message:deleted', (data) => {
      if (data.chatId === this.config.chatId) {
        this.removeMessage(data.messageId);
      }
    });

    // Window resize for virtual scrolling
    window.addEventListener('resize', () => {
      if (this.virtualScrollEnabled) {
        this.viewportHeight = this.messagesContainer.clientHeight;
        this.updateVirtualScrolling();
      }
    });
  }

  /**
   * Load messages from store
   */
  async loadMessages() {
    try {
      this.messages = chatStore.getMessages(this.config.chatId) || [];
      this.renderMessages();
      
      // Scroll to bottom if this is the initial load
      if (this.messages.length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }

    } catch (error) {
      logger.error('Failed to load messages:', error);
    }
  }

  /**
   * Add new messages to the list
   */
  addMessages(newMessages) {
    if (!Array.isArray(newMessages)) {
      newMessages = [newMessages];
    }

    const wasAtBottom = this.isScrolledToBottom();
    
    // Add messages to local array
    this.messages.push(...newMessages);
    
    // Sort by timestamp to maintain order
    this.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Re-render messages
    this.renderMessages();
    
    // Auto-scroll to bottom if user was already at bottom
    if (wasAtBottom) {
      setTimeout(() => this.scrollToBottom(), 50);
    } else {
      // Show scroll-to-bottom button with unread indicator
      this.showScrollToBottomButton(true);
    }
  }

  /**
   * Render all messages
   */
  renderMessages() {
    if (this.virtualScrollEnabled && this.messages.length > 100) {
      this.renderVirtualMessages();
    } else {
      this.renderAllMessages();
    }
  }

  /**
   * Render all messages (non-virtual)
   */
  renderAllMessages() {
    // Clear existing messages
    this.messagesViewport.innerHTML = '';
    this.messageElements.clear();

    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();

    this.messages.forEach((message, index) => {
      const messageElement = this.createMessageElement(message, index);
      fragment.appendChild(messageElement);
      this.messageElements.set(message.id, messageElement);
    });

    this.messagesViewport.appendChild(fragment);
  }

  /**
   * Create message element
   */
  createMessageElement(message, index) {
    const messageDiv = document.createElement('div');
    messageDiv.className = this.getMessageClasses(message);
    messageDiv.dataset.messageId = message.id;
    messageDiv.dataset.messageIndex = index;

    const isOwn = message.sender_id === this.config.currentUserId;

    messageDiv.innerHTML = `
      <div class="message-content">
        ${!isOwn ? `<div class="message-name">${escapeHtml(message.sender_name || 'Unknown')}</div>` : ''}
        
        <div class="message-body">
          ${this.renderMessageContent(message)}
        </div>
        
        <div class="message-meta">
          <span class="message-time">${formatTime(message.created_at)}</span>
        </div>
      </div>
    `;

    return messageDiv;
  }

  /**
   * Get CSS classes for message
   */
  getMessageClasses(message) {
    const classes = ['message'];
    
    if (message.sender_id === this.config.currentUserId) {
      classes.push('message-own');
    } else {
      classes.push('message-other');
    }
    
    if (message.type) {
      classes.push(`message-type-${message.type}`);
    }
    
    return classes.join(' ');
  }

  /**
   * Render message content based on type
   */
  renderMessageContent(message) {
    switch (message.type) {
      case 'text':
      default:
        return this.renderTextMessage(message);
    }
  }

  /**
   * Render text message
   */
  renderTextMessage(message) {
    let content = escapeHtml(message.content);
    return `<div class="message-text">${content}</div>`;
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    this.scrollTop = this.messagesContainer.scrollTop;
    
    // Update scroll-to-bottom button visibility
    const isAtBottom = this.isScrolledToBottom();
    this.showScrollToBottomButton(!isAtBottom);
    
    // Load more messages when scrolled to top
    if (this.scrollTop < 100) {
      this.eventBus.emit('load:more');
    }
  }

  /**
   * Check if scrolled to bottom
   */
  isScrolledToBottom() {
    const threshold = 50;
    return (
      this.messagesContainer.scrollTop + this.messagesContainer.clientHeight >=
      this.messagesContainer.scrollHeight - threshold
    );
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Show/hide scroll to bottom button
   */
  showScrollToBottomButton(show) {
    if (this.scrollToBottomBtn) {
      this.scrollToBottomBtn.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Update an existing message
   */
  updateMessage(updatedMessage) {
    const index = this.messages.findIndex(msg => msg.id === updatedMessage.id);
    if (index !== -1) {
      this.messages[index] = { ...this.messages[index], ...updatedMessage };
      this.renderMessages();
    }
  }

  /**
   * Remove a message from the list
   */
  removeMessage(messageId) {
    this.messages = this.messages.filter(msg => msg.id !== messageId);
    this.renderMessages();
  }

  /**
   * Update messages from external source
   */
  updateMessages(messages) {
    this.messages = messages;
    this.renderMessages();
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    this.eventBus.emit('messagelist:destroyed');
  }

  // Stub methods for virtual scrolling
  setupIntersectionObserver() {}
  renderVirtualMessages() {}
  updateVirtualScrolling() {}
}

export default MessageList;
