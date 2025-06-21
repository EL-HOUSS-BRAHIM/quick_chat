/**
 * Message Input Component - Organized Architecture
 * 
 * Handles message composition, file uploads, and other input features
 * Includes typing indicators, emoji picker, and voice messages
 * Migrated from assets/js/features/chat/editor.js
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/helpers.js';

export class MessageInput {
  constructor(config = {}) {
    this.config = {
      container: config.container,
      chatType: config.chatType,
      chatId: config.chatId,
      currentUserId: config.currentUserId,
      maxMessageLength: config.maxMessageLength || 4000,
      enableFileUpload: config.enableFileUpload !== false,
      enableVoiceMessage: config.enableVoiceMessage !== false,
      enableEmoji: config.enableEmoji !== false,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.inputElement = null;
    this.sendButton = null;
    this.fileInput = null;
    
    // State
    this.isTyping = false;
    this.typingTimeout = null;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.replyToMessage = null;
    
    this.initialized = false;
  }

  /**
   * Initialize the message input
   */
  async init() {
    try {
      logger.info('Initializing Message Input');

      this.container = this.config.container;
      this.setupDOM();
      this.setupEventListeners();
      
      this.initialized = true;
      this.eventBus.emit('messageinput:initialized');

    } catch (error) {
      logger.error('Failed to initialize Message Input:', error);
      throw error;
    }
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    this.container.innerHTML = `
      <div class="message-input">
        <div class="input-main">
          <div class="input-actions-left">
            <button class="btn-attach" id="btn-attach" title="Attach File">
              <i class="fas fa-paperclip"></i>
            </button>
          </div>
          
          <div class="input-field-container">
            <textarea 
              class="message-textarea" 
              id="message-input"
              placeholder="Type a message..."
              rows="1"
              maxlength="${this.config.maxMessageLength}"></textarea>
          </div>
          
          <div class="input-actions-right">
            <button class="btn-send" id="btn-send" title="Send" disabled>
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
        
        <input type="file" 
               class="file-input-hidden" 
               id="file-input" 
               multiple 
               style="display: none;">
      </div>
    `;

    // Get DOM element references
    this.inputElement = this.container.querySelector('#message-input');
    this.sendButton = this.container.querySelector('#btn-send');
    this.attachButton = this.container.querySelector('#btn-attach');
    this.fileInput = this.container.querySelector('#file-input');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input field events
    this.inputElement.addEventListener('input', (e) => {
      this.handleInput(e);
    });

    this.inputElement.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Send button
    this.sendButton.addEventListener('click', () => {
      this.sendMessage();
    });

    // Attach button
    this.attachButton?.addEventListener('click', () => {
      this.fileInput.click();
    });

    // File input
    this.fileInput.addEventListener('change', (e) => {
      this.handleFileSelection(e);
    });
  }

  /**
   * Handle input changes
   */
  handleInput(event) {
    const value = event.target.value;
    
    // Update send button state
    this.updateSendButton(value.trim().length > 0);
    
    // Handle typing indicator
    this.handleTypingIndicator(value.length > 0);
  }

  /**
   * Handle key down events
   */
  handleKeyDown(event) {
    // Send message on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Send message
   */
  async sendMessage() {
    const content = this.inputElement.value.trim();
    
    if (!content) {
      return;
    }

    try {
      // Prepare message data
      const messageData = {
        content,
        type: 'text',
        replyTo: this.replyToMessage?.id || null
      };

      // Clear input immediately for better UX
      this.clearInput();

      // Emit send event
      this.eventBus.emit('message:send', messageData);

      logger.info('Message sent:', messageData);

    } catch (error) {
      logger.error('Failed to send message:', error);
      // Restore content on error
      this.inputElement.value = content;
      this.updateSendButton(true);
    }
  }

  /**
   * Handle file selection
   */
  async handleFileSelection(event) {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      await this.uploadFile(file);
    }

    // Clear file input
    event.target.value = '';
  }

  /**
   * Upload file
   */
  async uploadFile(file) {
    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chat_type', this.config.chatType);
      formData.append('chat_id', this.config.chatId);

      // Upload file
      const result = await apiClient.upload('/upload', formData);

      // Emit file uploaded event
      this.eventBus.emit('message:send', {
        content: file.name,
        type: this.getFileType(file),
        file_url: result.file_url,
        file_name: file.name,
        file_size: file.size
      });

      logger.info('File uploaded successfully:', result);

    } catch (error) {
      logger.error('Failed to upload file:', error);
    }
  }

  /**
   * Get file type for message
   */
  getFileType(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  }

  /**
   * Handle typing indicator
   */
  handleTypingIndicator(isTyping) {
    if (isTyping && !this.isTyping) {
      this.isTyping = true;
      this.eventBus.emit('typing:start');
    }

    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Set new timeout to stop typing indicator
    this.typingTimeout = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        this.eventBus.emit('typing:stop');
      }
    }, 1000);
  }

  /**
   * Update send button state
   */
  updateSendButton(enabled) {
    this.sendButton.disabled = !enabled;
    this.sendButton.classList.toggle('enabled', enabled);
  }

  /**
   * Clear input
   */
  clearInput() {
    this.inputElement.value = '';
    this.updateSendButton(false);
  }

  /**
   * Focus input
   */
  focus() {
    this.inputElement?.focus();
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    this.eventBus.emit('messageinput:destroyed');
  }
}

export default MessageInput;
