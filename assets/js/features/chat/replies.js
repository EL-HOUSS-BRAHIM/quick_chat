/**
 * Chat Replies Module
 * Handles replying to messages
 */

import eventBus from '../../core/event-bus.js';

class ChatReplies {
  constructor() {
    this.replyContainer = null;
    this.replyToMessageId = null;
    
    // Bind methods
    this.replyToMessage = this.replyToMessage.bind(this);
    this.cancelReply = this.cancelReply.bind(this);
    this.getReplyData = this.getReplyData.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize replies module
   */
  init() {
    // Get reply container
    this.replyContainer = document.getElementById('replyContainer');
    
    if (!this.replyContainer) {
      this.createReplyContainer();
    }
    
    // Subscribe to events
    eventBus.subscribe('message:reply', this.replyToMessage);
    eventBus.subscribe('message:reply:cancel', this.cancelReply);
  }
  
  /**
   * Create reply container if it doesn't exist
   */
  createReplyContainer() {
    this.replyContainer = document.createElement('div');
    this.replyContainer.id = 'replyContainer';
    this.replyContainer.className = 'reply-container';
    this.replyContainer.style.display = 'none';
    
    // Insert at the top of message input area
    const messageInputArea = document.querySelector('.message-input-area');
    if (messageInputArea) {
      messageInputArea.prepend(this.replyContainer);
    } else {
      // If no message input area found, add to body (can be moved later)
      document.body.appendChild(this.replyContainer);
    }
  }
  
  /**
   * Reply to a message
   * @param {Object} data - Contains messageId and optional targetElement
   */
  replyToMessage(data) {
    const { messageId, targetElement } = data;
    const messageElement = targetElement || document.querySelector(`.message-item[data-id="${messageId}"]`);
    
    if (!messageElement || !this.replyContainer) return;
    
    // Get message data
    const sender = messageElement.querySelector('.message-sender')?.textContent || 'User';
    const content = messageElement.querySelector('.message-content')?.textContent || '';
    
    // Create reply indicator
    this.replyContainer.innerHTML = `
      <div class="reply-preview">
        <div class="reply-info">
          <strong>Replying to ${sender}</strong>
          <p>${content.substring(0, 50)}${content.length > 50 ? '...' : ''}</p>
        </div>
        <button class="reply-close" id="cancelReplyBtn">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add event listener to close button
    const cancelBtn = document.getElementById('cancelReplyBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', this.cancelReply);
    }
    
    // Show reply container
    this.replyContainer.style.display = 'block';
    
    // Store the message ID for sending with the reply
    this.replyToMessageId = messageId;
    
    // Focus message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.focus();
    }
    
    // Publish event that we're replying (for other components to know)
    eventBus.publish('message:replying', { messageId });
  }
  
  /**
   * Cancel reply and clear reply UI
   */
  cancelReply() {
    if (!this.replyContainer) return;
    
    this.replyContainer.style.display = 'none';
    this.replyContainer.innerHTML = '';
    this.replyToMessageId = null;
    
    // Publish event that we're no longer replying
    eventBus.publish('message:replying:cancelled');
  }
  
  /**
   * Get reply data for including with a new message
   * @returns {Object|null} Reply data or null if not replying
   */
  getReplyData() {
    if (!this.replyToMessageId) return null;
    
    return {
      reply_to_id: this.replyToMessageId
    };
  }
}

export default ChatReplies;
