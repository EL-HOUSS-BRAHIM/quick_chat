/**
 * Thread Module
 * Handles threaded conversations in group chats
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class ThreadManager {
  constructor() {
    this.currentThreadId = null;
    this.threadContainer = null;
    this.threadMessagesList = null;
    this.threadInput = null;
    this.threadMessages = new Map();
    
    // Bind methods
    this.openThread = this.openThread.bind(this);
    this.closeThread = this.closeThread.bind(this);
    this.createThreadUI = this.createThreadUI.bind(this);
    this.loadThreadMessages = this.loadThreadMessages.bind(this);
    this.renderThreadMessages = this.renderThreadMessages.bind(this);
    this.sendThreadMessage = this.sendThreadMessage.bind(this);
    this.handleNewThreadMessage = this.handleNewThreadMessage.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize thread manager
   */
  init() {
    // Subscribe to events
    eventBus.subscribe('thread:open', this.openThread);
    eventBus.subscribe('thread:close', this.closeThread);
    eventBus.subscribe('thread:message:new', this.handleNewThreadMessage);
    
    // Create thread UI if it doesn't exist
    this.createThreadUI();
  }
  
  /**
   * Create the thread UI components
   */
  createThreadUI() {
    // Create thread container if it doesn't exist
    if (!this.threadContainer) {
      this.threadContainer = document.createElement('div');
      this.threadContainer.id = 'threadContainer';
      this.threadContainer.className = 'thread-container';
      this.threadContainer.style.display = 'none';
      
      // Create thread header
      const threadHeader = document.createElement('div');
      threadHeader.className = 'thread-header';
      threadHeader.innerHTML = `
        <h3>Thread</h3>
        <button id="closeThreadBtn" class="close-thread-btn">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      // Create thread content
      const threadContent = document.createElement('div');
      threadContent.className = 'thread-content';
      
      // Create parent message container
      const parentMessageContainer = document.createElement('div');
      parentMessageContainer.id = 'threadParentMessage';
      parentMessageContainer.className = 'thread-parent-message';
      
      // Create thread messages list
      this.threadMessagesList = document.createElement('div');
      this.threadMessagesList.id = 'threadMessagesList';
      this.threadMessagesList.className = 'thread-messages-list';
      
      // Create thread input area
      const threadInputArea = document.createElement('div');
      threadInputArea.className = 'thread-input-area';
      
      this.threadInput = document.createElement('input');
      this.threadInput.id = 'threadMessageInput';
      this.threadInput.className = 'thread-message-input';
      this.threadInput.type = 'text';
      this.threadInput.placeholder = 'Reply in thread...';
      
      const threadSendBtn = document.createElement('button');
      threadSendBtn.id = 'threadSendBtn';
      threadSendBtn.className = 'thread-send-btn';
      threadSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      
      // Assemble components
      threadInputArea.appendChild(this.threadInput);
      threadInputArea.appendChild(threadSendBtn);
      
      threadContent.appendChild(parentMessageContainer);
      threadContent.appendChild(this.threadMessagesList);
      
      this.threadContainer.appendChild(threadHeader);
      this.threadContainer.appendChild(threadContent);
      this.threadContainer.appendChild(threadInputArea);
      
      // Add to document
      document.body.appendChild(this.threadContainer);
      
      // Add event listeners
      document.getElementById('closeThreadBtn').addEventListener('click', this.closeThread);
      threadSendBtn.addEventListener('click', this.sendThreadMessage);
      this.threadInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendThreadMessage();
        }
      });
    }
  }
  
  /**
   * Open a thread for a specific message
   * @param {Object} data - Contains messageId and optional element
   */
  async openThread(data) {
    const { messageId, element } = data;
    
    if (!messageId || !this.threadContainer) return;
    
    this.currentThreadId = messageId;
    
    // Show thread container
    this.threadContainer.style.display = 'flex';
    
    // Update parent message display
    const parentMessage = element || document.querySelector(`.message-item[data-id="${messageId}"]`);
    const parentMessageContainer = document.getElementById('threadParentMessage');
    
    if (parentMessage && parentMessageContainer) {
      // Clone the message content without action buttons
      const clonedMessage = parentMessage.cloneNode(true);
      
      // Remove action buttons
      const actionButtons = clonedMessage.querySelector('.message-actions');
      if (actionButtons) {
        actionButtons.remove();
      }
      
      parentMessageContainer.innerHTML = '';
      parentMessageContainer.appendChild(clonedMessage);
    }
    
    // Load thread messages
    await this.loadThreadMessages(messageId);
    
    // Focus input
    this.threadInput.focus();
    
    // Publish event that thread is open
    eventBus.publish('thread:opened', { messageId });
    
    // Update thread count on original message
    this.updateThreadCount(messageId);
  }
  
  /**
   * Close the current thread
   */
  closeThread() {
    if (!this.threadContainer) return;
    
    // Hide thread container
    this.threadContainer.style.display = 'none';
    
    // Clear current thread ID
    const previousThreadId = this.currentThreadId;
    this.currentThreadId = null;
    
    // Clear thread messages list
    if (this.threadMessagesList) {
      this.threadMessagesList.innerHTML = '';
    }
    
    // Clear parent message
    const parentMessageContainer = document.getElementById('threadParentMessage');
    if (parentMessageContainer) {
      parentMessageContainer.innerHTML = '';
    }
    
    // Publish event that thread is closed
    eventBus.publish('thread:closed', { messageId: previousThreadId });
  }
  
  /**
   * Load thread messages from the server
   * @param {string} messageId - The parent message ID
   */
  async loadThreadMessages(messageId) {
    try {
      // Show loading indicator
      this.threadMessagesList.innerHTML = '<div class="loading-indicator">Loading thread...</div>';
      
      // Fetch thread messages
      const response = await apiClient.get(`/api/v1/threads/${messageId}`);
      
      if (response && response.success) {
        // Store thread messages
        this.threadMessages.set(messageId, response.messages || []);
        
        // Render thread messages
        this.renderThreadMessages(messageId);
      } else {
        throw new Error(response.error || 'Failed to load thread messages');
      }
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      
      // Show error message
      this.threadMessagesList.innerHTML = '<div class="error-message">Failed to load thread messages.</div>';
      
      // Publish error event
      eventBus.publish('error', {
        message: 'Failed to load thread messages',
        error
      });
    }
  }
  
  /**
   * Render thread messages in the UI
   * @param {string} messageId - The parent message ID
   */
  renderThreadMessages(messageId) {
    if (!this.threadMessagesList) return;
    
    // Get thread messages
    const messages = this.threadMessages.get(messageId) || [];
    
    // Clear messages list
    this.threadMessagesList.innerHTML = '';
    
    if (messages.length === 0) {
      // Show empty state
      this.threadMessagesList.innerHTML = '<div class="empty-thread-message">No replies yet. Be the first to reply.</div>';
      return;
    }
    
    // Render each message
    messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = 'thread-message';
      messageElement.dataset.id = message.id;
      
      messageElement.innerHTML = `
        <div class="thread-message-header">
          <span class="thread-message-sender">${message.sender_name}</span>
          <span class="thread-message-time">${message.created_at}</span>
        </div>
        <div class="thread-message-content">${message.content}</div>
      `;
      
      this.threadMessagesList.appendChild(messageElement);
    });
    
    // Scroll to bottom
    this.threadMessagesList.scrollTop = this.threadMessagesList.scrollHeight;
  }
  
  /**
   * Send a new message in the thread
   */
  async sendThreadMessage() {
    if (!this.threadInput || !this.currentThreadId) return;
    
    const content = this.threadInput.value.trim();
    
    if (!content) return;
    
    try {
      // Clear input
      this.threadInput.value = '';
      
      // Send message to server
      const response = await apiClient.post('/api/v1/threads/message', {
        parent_id: this.currentThreadId,
        content
      });
      
      if (response && response.success) {
        // Add new message to local thread messages
        const messages = this.threadMessages.get(this.currentThreadId) || [];
        messages.push(response.message);
        this.threadMessages.set(this.currentThreadId, messages);
        
        // Render thread messages
        this.renderThreadMessages(this.currentThreadId);
        
        // Update thread count on original message
        this.updateThreadCount(this.currentThreadId);
      } else {
        throw new Error(response.error || 'Failed to send thread message');
      }
    } catch (error) {
      console.error('Failed to send thread message:', error);
      
      // Restore input value
      this.threadInput.value = content;
      
      // Publish error event
      eventBus.publish('error', {
        message: 'Failed to send thread message',
        error
      });
    }
  }
  
  /**
   * Handle a new thread message from the server
   * @param {Object} data - The new thread message data
   */
  handleNewThreadMessage(data) {
    const { parentId, message } = data;
    
    // Add message to thread messages if we have this thread loaded
    if (this.threadMessages.has(parentId)) {
      const messages = this.threadMessages.get(parentId);
      messages.push(message);
      this.threadMessages.set(parentId, messages);
      
      // If this thread is currently open, render the new message
      if (this.currentThreadId === parentId) {
        this.renderThreadMessages(parentId);
      }
    }
    
    // Update thread count on original message
    this.updateThreadCount(parentId);
  }
  
  /**
   * Update the thread count displayed on the original message
   * @param {string} messageId - The parent message ID
   */
  updateThreadCount(messageId) {
    const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Get thread count
    const threadCount = (this.threadMessages.get(messageId) || []).length;
    
    // Update thread count badge
    let threadBadge = messageElement.querySelector('.thread-count');
    
    if (!threadBadge && threadCount > 0) {
      // Create thread badge if it doesn't exist
      const messageActions = messageElement.querySelector('.message-actions');
      
      if (messageActions) {
        threadBadge = document.createElement('span');
        threadBadge.className = 'thread-count';
        messageActions.appendChild(threadBadge);
      }
    }
    
    if (threadBadge) {
      if (threadCount > 0) {
        threadBadge.textContent = threadCount;
        threadBadge.style.display = 'inline-block';
      } else {
        threadBadge.style.display = 'none';
      }
    }
  }
}

export default ThreadManager;
