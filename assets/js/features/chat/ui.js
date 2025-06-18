/**
 * Chat UI Component
 * Handles all UI-related functionality for the chat
 */

import utils from '../../core/utils.js';
import eventBus from '../../core/event-bus.js';

class ChatUI {
  constructor(chatModule) {
    this.chat = chatModule;
    
    // Elements
    this.elements = {
      messagesContainer: null,
      messagesList: null,
      messageForm: null,
      messageInput: null,
      sendBtn: null,
      charCounter: null,
      typingIndicator: null,
      emojiPickerContainer: null,
      emojiButton: null,
      fileButton: null,
      fileInput: null,
      loadingIndicator: null,
      connectionStatus: null,
      replyingToContainer: null,
      editingMessageContainer: null,
      noMoreHistoryIndicator: null
    };
    
    // Observer for infinite scroll
    this.scrollObserver = null;
  }

  /**
   * Initialize UI
   */
  init() {
    this.findElements();
    this.setupEventListeners();
    this.setupInfiniteScroll();
  }

  /**
   * Find all required DOM elements
   */
  findElements() {
    this.elements.messagesContainer = document.getElementById('messagesContainer');
    this.elements.messagesList = document.getElementById('messagesList');
    this.elements.messageForm = document.getElementById('messageForm');
    this.elements.messageInput = document.getElementById('messageInput');
    this.elements.sendBtn = document.getElementById('sendBtn');
    this.elements.charCounter = document.querySelector('.char-counter');
    this.elements.typingIndicator = document.getElementById('typingIndicator');
    this.elements.emojiPickerContainer = document.getElementById('emojiPickerContainer');
    this.elements.emojiButton = document.getElementById('emojiButton');
    this.elements.fileButton = document.getElementById('fileButton');
    this.elements.fileInput = document.getElementById('fileInput');
    this.elements.loadingIndicator = document.getElementById('messagesLoading');
    this.elements.connectionStatus = document.getElementById('connectionStatus');
    this.elements.replyingToContainer = document.getElementById('replyingToContainer');
    this.elements.editingMessageContainer = document.getElementById('editingMessageContainer');
    this.elements.noMoreHistoryIndicator = document.getElementById('noMoreHistory');
    
    // Create missing elements if needed
    this.createMissingElements();
  }

  /**
   * Create any missing UI elements
   */
  createMissingElements() {
    // Create loading indicator if it doesn't exist
    if (!this.elements.loadingIndicator && this.elements.messagesContainer) {
      this.elements.loadingIndicator = document.createElement('div');
      this.elements.loadingIndicator.id = 'messagesLoading';
      this.elements.loadingIndicator.className = 'messages-loading';
      this.elements.loadingIndicator.innerHTML = '<div class="spinner"></div><span>Loading messages...</span>';
      this.elements.messagesContainer.insertBefore(this.elements.loadingIndicator, this.elements.messagesContainer.firstChild);
    }
    
    // Create connection status indicator if it doesn't exist
    if (!this.elements.connectionStatus && this.elements.messagesContainer) {
      this.elements.connectionStatus = document.createElement('div');
      this.elements.connectionStatus.id = 'connectionStatus';
      this.elements.connectionStatus.className = 'connection-status';
      this.elements.messagesContainer.insertBefore(this.elements.connectionStatus, this.elements.messagesContainer.firstChild);
    }
    
    // Create "no more history" indicator if it doesn't exist
    if (!this.elements.noMoreHistoryIndicator && this.elements.messagesList) {
      this.elements.noMoreHistoryIndicator = document.createElement('div');
      this.elements.noMoreHistoryIndicator.id = 'noMoreHistory';
      this.elements.noMoreHistoryIndicator.className = 'no-more-history';
      this.elements.noMoreHistoryIndicator.textContent = 'No more messages';
      this.elements.noMoreHistoryIndicator.style.display = 'none';
      this.elements.messagesList.insertBefore(this.elements.noMoreHistoryIndicator, this.elements.messagesList.firstChild);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Message form submission
    if (this.elements.messageForm) {
      this.elements.messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleMessageSubmit();
      });
    }
    
    // Message input events
    if (this.elements.messageInput) {
      // Typing event
      this.elements.messageInput.addEventListener('input', (e) => {
        this.updateCharCounter();
        eventBus.emit('chat:typing');
      });
      
      // Key events (e.g., for Enter to send)
      this.elements.messageInput.addEventListener('keydown', (e) => {
        // Enter to send (without shift for new line)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleMessageSubmit();
        }
        
        // Escape to cancel reply/edit
        if (e.key === 'Escape') {
          if (this.chat.state.replyingTo) {
            this.chat.cancelReply();
          }
          if (this.chat.state.editingMessage) {
            this.chat.cancelEdit();
          }
        }
      });
    }
    
    // Emoji picker toggle
    if (this.elements.emojiButton) {
      this.elements.emojiButton.addEventListener('click', () => {
        this.toggleEmojiPicker();
      });
    }
    
    // File upload
    if (this.elements.fileButton && this.elements.fileInput) {
      this.elements.fileButton.addEventListener('click', () => {
        this.elements.fileInput.click();
      });
      
      this.elements.fileInput.addEventListener('change', () => {
        this.handleFileUpload();
      });
    }
  }

  /**
   * Set up infinite scroll for message history
   */
  setupInfiniteScroll() {
    if (!this.elements.messagesList) return;
    
    // Create a sentinel element for intersection observer
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'scroll-sentinel';
    this.elements.messagesList.insertBefore(sentinel, this.elements.messagesList.firstChild);
    
    // Set up intersection observer
    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.chat.state.loadingHistory && !this.chat.state.noMoreHistory) {
        this.chat.loadOlderMessages();
      }
    }, {
      root: this.elements.messagesContainer,
      threshold: 0.1
    });
    
    this.scrollObserver.observe(sentinel);
  }

  /**
   * Handle message form submission
   */
  handleMessageSubmit() {
    if (!this.elements.messageInput) return;
    
    const content = this.elements.messageInput.value.trim();
    if (!content) return;
    
    // Determine message type (always text for now)
    const type = 'text';
    
    // Check if editing
    if (this.chat.state.editingMessage) {
      this.handleMessageEdit(content);
      return;
    }
    
    // Send message
    eventBus.emit('message:send', {
      content,
      type
    });
    
    // Clear input
    this.elements.messageInput.value = '';
    this.updateCharCounter();
  }

  /**
   * Handle message edit
   * @param {string} content - New message content
   */
  async handleMessageEdit(content) {
    if (!this.chat.state.editingMessage) return;
    
    try {
      const messageId = this.chat.state.editingMessage.id;
      
      // Update in UI first (optimistic)
      this.updateMessageContent(messageId, content);
      
      // Clear input and editing state
      this.elements.messageInput.value = '';
      this.chat.cancelEdit();
      
      // Send to server
      const endpoint = `/messages/${messageId}`;
      await this.chat.apiClient.put(endpoint, { content });
      
      // Update in store
      this.chat.messageStore.updateMessage(messageId, { content });
      
      // Emit event
      eventBus.emit('message:edited', { messageId, content });
    } catch (error) {
      console.error('Error editing message:', error);
      utils.showToast('Failed to edit message', 'error');
    }
  }

  /**
   * Handle file upload
   */
  async handleFileUpload() {
    if (!this.elements.fileInput || !this.elements.fileInput.files.length) return;
    
    const file = this.elements.fileInput.files[0];
    
    try {
      // Show upload progress
      utils.showToast(`Uploading ${file.name}...`, 'info');
      
      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await this.chat.fileUploader.uploadFile(formData);
      
      if (response && response.url) {
        // Determine message type based on file
        let type = 'file';
        if (file.type.startsWith('image/')) {
          type = 'image';
        } else if (file.type.startsWith('video/')) {
          type = 'video';
        } else if (file.type.startsWith('audio/')) {
          type = 'audio';
        }
        
        // Send message with file
        eventBus.emit('message:send', {
          content: response.url,
          type,
          filename: file.name,
          filesize: file.size,
          filetype: file.type
        });
        
        // Reset file input
        this.elements.fileInput.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      utils.showToast('Failed to upload file', 'error');
    }
  }

  /**
   * Toggle emoji picker
   */
  toggleEmojiPicker() {
    if (!this.elements.emojiPickerContainer) return;
    
    const isVisible = this.elements.emojiPickerContainer.style.display !== 'none';
    
    if (isVisible) {
      this.elements.emojiPickerContainer.style.display = 'none';
    } else {
      this.elements.emojiPickerContainer.style.display = 'block';
      
      // Position the picker
      const inputRect = this.elements.messageInput.getBoundingClientRect();
      this.elements.emojiPickerContainer.style.bottom = `${window.innerHeight - inputRect.top + 10}px`;
      this.elements.emojiPickerContainer.style.left = `${inputRect.left}px`;
    }
  }

  /**
   * Update character counter
   */
  updateCharCounter() {
    if (!this.elements.messageInput || !this.elements.charCounter) return;
    
    const maxLength = parseInt(this.elements.messageInput.getAttribute('maxlength') || '2000', 10);
    const currentLength = this.elements.messageInput.value.length;
    
    this.elements.charCounter.textContent = `${currentLength}/${maxLength}`;
    
    // Highlight if approaching limit
    if (currentLength > maxLength * 0.8) {
      this.elements.charCounter.classList.add('char-counter-warning');
    } else {
      this.elements.charCounter.classList.remove('char-counter-warning');
    }
  }

  /**
   * Show loading indicator
   * @param {boolean} show - Whether to show or hide
   */
  showLoading(show) {
    if (!this.elements.loadingIndicator) return;
    
    this.elements.loadingIndicator.style.display = show ? 'flex' : 'none';
  }

  /**
   * Show history loading indicator
   * @param {boolean} show - Whether to show or hide
   */
  showHistoryLoading(show) {
    if (!this.elements.noMoreHistoryIndicator) return;
    
    if (show) {
      this.elements.noMoreHistoryIndicator.textContent = 'Loading older messages...';
      this.elements.noMoreHistoryIndicator.style.display = 'block';
    } else {
      this.elements.noMoreHistoryIndicator.style.display = 'none';
    }
  }

  /**
   * Show "no more history" indicator
   */
  showNoMoreHistory() {
    if (!this.elements.noMoreHistoryIndicator) return;
    
    this.elements.noMoreHistoryIndicator.textContent = 'No more messages';
    this.elements.noMoreHistoryIndicator.style.display = 'block';
  }

  /**
   * Update connection status
   * @param {string} status - Connection status
   */
  updateConnectionStatus(status) {
    if (!this.elements.connectionStatus) return;
    
    // Remove all status classes
    this.elements.connectionStatus.classList.remove(
      'status-connected',
      'status-connecting',
      'status-disconnected',
      'status-error'
    );
    
    // Add current status class
    this.elements.connectionStatus.classList.add(`status-${status}`);
    
    // Update text
    switch (status) {
      case 'connected':
        this.elements.connectionStatus.textContent = 'Connected';
        this.elements.connectionStatus.style.display = 'none'; // Hide when connected
        break;
      case 'connecting':
        this.elements.connectionStatus.textContent = 'Connecting...';
        this.elements.connectionStatus.style.display = 'block';
        break;
      case 'disconnected':
        this.elements.connectionStatus.textContent = 'Disconnected. Trying to reconnect...';
        this.elements.connectionStatus.style.display = 'block';
        break;
      case 'error':
        this.elements.connectionStatus.textContent = 'Connection error. Please refresh the page.';
        this.elements.connectionStatus.style.display = 'block';
        break;
    }
  }

  /**
   * Render messages
   * @param {Array} messages - Messages to render
   */
  renderMessages(messages) {
    if (!this.elements.messagesList) return;
    
    // Clear current messages
    this.elements.messagesList.innerHTML = '';
    
    // Add sentinel back
    const sentinel = document.createElement('div');
    sentinel.id = 'scroll-sentinel';
    sentinel.className = 'scroll-sentinel';
    this.elements.messagesList.appendChild(sentinel);
    
    // Render messages
    messages.forEach(message => {
      this.elements.messagesList.appendChild(this.createMessageElement(message));
    });
    
    // Scroll to bottom
    this.scrollToBottom();
  }

  /**
   * Render new messages
   * @param {Array} messages - New messages to render
   */
  renderNewMessages(messages) {
    if (!this.elements.messagesList) return;
    
    // Remember scroll position
    const wasAtBottom = this.isScrolledToBottom();
    
    // Add new messages
    messages.forEach(message => {
      this.elements.messagesList.appendChild(this.createMessageElement(message));
    });
    
    // Scroll to bottom if was at bottom
    if (wasAtBottom) {
      this.scrollToBottom();
    } else {
      // Show new message indicator
      this.showNewMessageIndicator(messages.length);
    }
  }

  /**
   * Render older messages
   * @param {Array} messages - Older messages to render
   */
  renderOlderMessages(messages) {
    if (!this.elements.messagesList) return;
    
    // Remember scroll position (height from bottom)
    const scrollBottom = this.elements.messagesContainer.scrollHeight - this.elements.messagesContainer.scrollTop;
    
    // Remove sentinel
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) {
      sentinel.remove();
    }
    
    // Add older messages at the beginning
    messages.forEach(message => {
      this.elements.messagesList.insertBefore(this.createMessageElement(message), this.elements.messagesList.firstChild);
    });
    
    // Add sentinel back
    const newSentinel = document.createElement('div');
    newSentinel.id = 'scroll-sentinel';
    newSentinel.className = 'scroll-sentinel';
    this.elements.messagesList.insertBefore(newSentinel, this.elements.messagesList.firstChild);
    
    // Observe the new sentinel
    if (this.scrollObserver) {
      this.scrollObserver.observe(newSentinel);
    }
    
    // Restore scroll position
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight - scrollBottom;
  }

  /**
   * Create a message element
   * @param {Object} message - Message data
   * @returns {HTMLElement} Message element
   */
  createMessageElement(message) {
    // Create message container
    const messageEl = document.createElement('div');
    messageEl.className = 'message';
    messageEl.id = `message-${message.id}`;
    messageEl.dataset.messageId = message.id;
    messageEl.dataset.senderId = message.sender_id;
    
    // Add appropriate classes
    if (message.sender_id === this.chat.config.currentUserId) {
      messageEl.classList.add('message-outgoing');
    } else {
      messageEl.classList.add('message-incoming');
    }
    
    if (message.isOptimistic) {
      messageEl.classList.add('message-sending');
    }
    
    if (message.status === 'failed') {
      messageEl.classList.add('message-failed');
    }
    
    // Create message structure
    messageEl.innerHTML = this.getMessageTemplate(message);
    
    // Add event listeners
    this.addMessageEventListeners(messageEl, message);
    
    return messageEl;
  }

  /**
   * Get message HTML template
   * @param {Object} message - Message data
   * @returns {string} HTML template
   */
  getMessageTemplate(message) {
    // Format timestamp
    const timestamp = utils.formatDate(message.created_at, { shortFormat: true });
    
    // Base message structure
    let template = `
      <div class="message-avatar">
        <img src="/uploads/avatars/${message.sender_id}.jpg" alt="Avatar" onerror="this.src='/assets/images/default-avatar.svg'">
      </div>
      <div class="message-content">
        <div class="message-meta">
          <span class="message-sender">${message.sender_name || 'User ' + message.sender_id}</span>
          <span class="message-time">${timestamp}</span>
        </div>
        <div class="message-body">
    `;
    
    // Add reply info if this is a reply
    if (message.reply_to) {
      template += `
        <div class="message-reply-info">
          <div class="reply-icon">↩</div>
          <div class="reply-preview">${message.reply_preview || 'Original message'}</div>
        </div>
      `;
    }
    
    // Add appropriate content based on message type
    switch (message.type) {
      case 'image':
        template += `
          <div class="message-image">
            <img src="${utils.escapeHtml(message.content)}" alt="Image" loading="lazy">
          </div>
        `;
        break;
        
      case 'video':
        template += `
          <div class="message-video">
            <video controls src="${utils.escapeHtml(message.content)}" preload="metadata"></video>
          </div>
        `;
        break;
        
      case 'audio':
        template += `
          <div class="message-audio">
            <audio controls src="${utils.escapeHtml(message.content)}" preload="metadata"></audio>
          </div>
        `;
        break;
        
      case 'file':
        template += `
          <div class="message-file">
            <div class="file-icon">📎</div>
            <div class="file-info">
              <div class="file-name">${message.filename || 'File'}</div>
              <div class="file-size">${message.filesize ? utils.formatFileSize(message.filesize) : ''}</div>
            </div>
            <a href="${utils.escapeHtml(message.content)}" target="_blank" class="file-download">Download</a>
          </div>
        `;
        break;
        
      case 'text':
      default:
        template += `
          <div class="message-text">${utils.escapeHtml(message.content).replace(/\n/g, '<br>')}</div>
        `;
        break;
    }
    
    // Add message status for outgoing messages
    if (message.sender_id === this.chat.config.currentUserId) {
      let statusIcon = '✓';
      let statusText = 'Sent';
      
      if (message.isOptimistic) {
        statusIcon = '⏱';
        statusText = 'Sending...';
      } else if (message.status === 'failed') {
        statusIcon = '❌';
        statusText = 'Failed to send';
      } else if (message.read_at) {
        statusIcon = '✓✓';
        statusText = 'Read';
      } else if (message.delivered_at) {
        statusIcon = '✓✓';
        statusText = 'Delivered';
      }
      
      template += `
        <div class="message-status" title="${statusText}">
          <span class="status-icon">${statusIcon}</span>
        </div>
      `;
    }
    
    // Close message structure
    template += `
        </div>
        <div class="message-actions">
          <button class="action-reply" title="Reply">↩</button>
          ${message.sender_id === this.chat.config.currentUserId ? 
            `<button class="action-edit" title="Edit">✏️</button>
             <button class="action-delete" title="Delete">🗑️</button>` : ''}
        </div>
      </div>
    `;
    
    return template;
  }

  /**
   * Add event listeners to message element
   * @param {HTMLElement} messageEl - Message element
   * @param {Object} message - Message data
   */
  addMessageEventListeners(messageEl, message) {
    // Reply button
    const replyBtn = messageEl.querySelector('.action-reply');
    if (replyBtn) {
      replyBtn.addEventListener('click', () => {
        this.chat.setReplyTo(message);
      });
    }
    
    // Edit button
    const editBtn = messageEl.querySelector('.action-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.chat.setEditingMessage(message);
      });
    }
    
    // Delete button
    const deleteBtn = messageEl.querySelector('.action-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        // Confirm deletion
        if (confirm('Are you sure you want to delete this message?')) {
          this.chat.deleteMessage(message.id);
        }
      });
    }
    
    // Retry button for failed messages
    if (message.status === 'failed') {
      messageEl.addEventListener('click', () => {
        // Confirm retry
        if (confirm('Try to send this message again?')) {
          this.retryFailedMessage(message);
        }
      });
    }
  }

  /**
   * Show replying to message
   * @param {Object} message - Message being replied to
   */
  showReplyingTo(message) {
    if (!this.elements.replyingToContainer) return;
    
    // Update content
    let content = message.content;
    if (message.type !== 'text') {
      content = `[${message.type}]`;
    }
    
    this.elements.replyingToContainer.innerHTML = `
      <div class="reply-info">
        <span>Replying to</span>
        <strong>${message.sender_name || 'User ' + message.sender_id}</strong>
      </div>
      <div class="reply-content">${content.length > 50 ? content.substring(0, 50) + '...' : content}</div>
      <button class="reply-cancel">×</button>
    `;
    
    // Show container
    this.elements.replyingToContainer.style.display = 'flex';
    
    // Add cancel button listener
    const cancelBtn = this.elements.replyingToContainer.querySelector('.reply-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.chat.cancelReply();
      });
    }
    
    // Focus input
    if (this.elements.messageInput) {
      this.elements.messageInput.focus();
    }
  }

  /**
   * Hide replying to message
   */
  hideReplyingTo() {
    if (!this.elements.replyingToContainer) return;
    
    this.elements.replyingToContainer.style.display = 'none';
    this.elements.replyingToContainer.innerHTML = '';
  }

  /**
   * Show editing message
   * @param {Object} message - Message being edited
   */
  showEditingMessage(message) {
    if (!this.elements.editingMessageContainer || !this.elements.messageInput) return;
    
    // Only text messages can be edited
    if (message.type !== 'text') {
      utils.showToast('Only text messages can be edited', 'error');
      return;
    }
    
    // Update container
    this.elements.editingMessageContainer.innerHTML = `
      <div class="edit-info">
        <span>Editing message</span>
      </div>
      <button class="edit-cancel">×</button>
    `;
    
    // Show container
    this.elements.editingMessageContainer.style.display = 'flex';
    
    // Set input value
    this.elements.messageInput.value = message.content;
    this.updateCharCounter();
    
    // Add cancel button listener
    const cancelBtn = this.elements.editingMessageContainer.querySelector('.edit-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.chat.cancelEdit();
      });
    }
    
    // Focus input
    this.elements.messageInput.focus();
  }

  /**
   * Hide editing message
   */
  hideEditingMessage() {
    if (!this.elements.editingMessageContainer || !this.elements.messageInput) return;
    
    this.elements.editingMessageContainer.style.display = 'none';
    this.elements.editingMessageContainer.innerHTML = '';
    this.elements.messageInput.value = '';
    this.updateCharCounter();
  }

  /**
   * Update message
   * @param {string|number} messageId - Message ID
   * @param {Object} newMessage - New message data
   */
  updateMessage(messageId, newMessage) {
    const messageEl = document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    // Update ID if changed (temp ID to real ID)
    if (messageId !== newMessage.id) {
      messageEl.id = `message-${newMessage.id}`;
      messageEl.dataset.messageId = newMessage.id;
    }
    
    // Remove sending class
    messageEl.classList.remove('message-sending');
    
    // Update message content
    messageEl.innerHTML = this.getMessageTemplate(newMessage);
    
    // Add event listeners
    this.addMessageEventListeners(messageEl, newMessage);
  }

  /**
   * Update message content
   * @param {string|number} messageId - Message ID
   * @param {string} content - New content
   */
  updateMessageContent(messageId, content) {
    const messageEl = document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    const contentEl = messageEl.querySelector('.message-text');
    if (contentEl) {
      contentEl.innerHTML = utils.escapeHtml(content).replace(/\n/g, '<br>');
    }
  }

  /**
   * Mark message as failed
   * @param {string|number} messageId - Message ID
   */
  markMessageAsFailed(messageId) {
    const messageEl = document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    // Add failed class
    messageEl.classList.remove('message-sending');
    messageEl.classList.add('message-failed');
    
    // Update status
    const statusEl = messageEl.querySelector('.message-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="status-icon">❌</span>';
      statusEl.title = 'Failed to send';
    }
  }

  /**
   * Retry failed message
   * @param {Object} message - Failed message
   */
  retryFailedMessage(message) {
    // Remove the failed message
    this.removeMessage(message.id);
    
    // Send again
    eventBus.emit('message:send', {
      content: message.content,
      type: message.type
    });
  }

  /**
   * Remove message
   * @param {string|number} messageId - Message ID
   */
  removeMessage(messageId) {
    const messageEl = document.getElementById(`message-${messageId}`);
    if (!messageEl) return;
    
    // Add fade-out animation
    messageEl.classList.add('message-removing');
    
    // Remove after animation
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 300);
  }

  /**
   * Update read receipts
   * @param {string|number} userId - User ID
   * @param {string} timestamp - Read timestamp
   */
  updateReadReceipts(userId, timestamp) {
    // Only matters for outgoing messages
    if (userId === this.chat.config.currentUserId) return;
    
    // Find all outgoing messages
    const outgoingMessages = Array.from(document.querySelectorAll('.message-outgoing'));
    
    outgoingMessages.forEach(messageEl => {
      const statusEl = messageEl.querySelector('.message-status');
      if (statusEl) {
        statusEl.innerHTML = '<span class="status-icon">✓✓</span>';
        statusEl.title = 'Read';
      }
    });
  }

  /**
   * Show user typing indicator
   * @param {string|number} userId - User ID
   */
  showUserTyping(userId) {
    if (!this.elements.typingIndicator) return;
    
    // Set content
    this.elements.typingIndicator.innerHTML = 'Someone is typing...';
    
    // Show indicator
    this.elements.typingIndicator.style.display = 'block';
    
    // Auto-hide after timeout
    clearTimeout(this._typingTimeout);
    this._typingTimeout = setTimeout(() => {
      this.elements.typingIndicator.style.display = 'none';
    }, 3000);
  }

  /**
   * Show new message indicator
   * @param {number} count - Number of new messages
   */
  showNewMessageIndicator(count) {
    // Create indicator if it doesn't exist
    let indicator = document.getElementById('new-message-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'new-message-indicator';
      indicator.className = 'new-message-indicator';
      
      // Add click handler to scroll to bottom
      indicator.addEventListener('click', () => {
        this.scrollToBottom();
        indicator.style.display = 'none';
      });
      
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.appendChild(indicator);
      }
    }
    
    // Update text
    indicator.textContent = count === 1 ? '1 new message' : `${count} new messages`;
    
    // Show indicator
    indicator.style.display = 'block';
  }

  /**
   * Check if scrolled to bottom
   * @returns {boolean} Whether scrolled to bottom
   */
  isScrolledToBottom() {
    if (!this.elements.messagesContainer) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = this.elements.messagesContainer;
    const threshold = 50; // pixels
    
    return scrollHeight - scrollTop - clientHeight < threshold;
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    if (!this.elements.messagesContainer) return;
    
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    
    // Hide new message indicator
    const indicator = document.getElementById('new-message-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Disable send button
   * @param {boolean} disabled - Whether to disable
   */
  disableSendButton(disabled) {
    if (!this.elements.sendBtn) return;
    
    this.elements.sendBtn.disabled = disabled;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Disconnect intersection observer
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }
    
    // Clear typing timeout
    clearTimeout(this._typingTimeout);
  }
}

export default ChatUI;
