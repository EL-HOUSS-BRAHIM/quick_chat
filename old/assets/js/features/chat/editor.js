/**
 * Chat Message Editor Module
 * Handles editing of existing messages
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class MessageEditor {
  constructor() {
    this.currentEditId = null;
    this.originalContent = null;
    this.messageInput = null;
    
    // Bind methods
    this.editMessage = this.editMessage.bind(this);
    this.cancelEdit = this.cancelEdit.bind(this);
    this.saveEdit = this.saveEdit.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize message editor
   */
  init() {
    // Get message input
    this.messageInput = document.getElementById('messageInput');
    
    // Subscribe to events
    eventBus.subscribe('message:edit', this.editMessage);
    eventBus.subscribe('message:edit:cancel', this.cancelEdit);
    eventBus.subscribe('message:edit:save', this.saveEdit);
    
    // Listen for escape key to cancel edit
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentEditId) {
        this.cancelEdit();
      }
    });
  }
  
  /**
   * Start editing a message
   * @param {Object} data - Contains messageId and optional targetElement
   */
  editMessage(data) {
    const { messageId, targetElement } = data;
    const messageElement = targetElement || document.querySelector(`.message-item[data-id="${messageId}"]`);
    
    if (!messageElement || !this.messageInput) return;
    
    // Get message content
    const contentElement = messageElement.querySelector('.message-content');
    if (!contentElement) return;
    
    // Store original content
    this.originalContent = contentElement.innerText;
    this.currentEditId = messageId;
    
    // Set content in input
    this.messageInput.value = this.originalContent;
    
    // Add editing class to message
    messageElement.classList.add('editing');
    
    // Show edit indicator
    const editIndicator = document.getElementById('editIndicator') || this.createEditIndicator();
    editIndicator.style.display = 'block';
    
    // Focus input
    this.messageInput.focus();
    
    // Publish event that we're editing
    eventBus.publish('message:editing', { messageId });
  }
  
  /**
   * Create edit indicator if it doesn't exist
   * @returns {HTMLElement} Edit indicator element
   */
  createEditIndicator() {
    const editIndicator = document.createElement('div');
    editIndicator.id = 'editIndicator';
    editIndicator.className = 'edit-indicator';
    editIndicator.innerHTML = `
      <div class="edit-info">
        <i class="fas fa-edit"></i>
        <span>Editing message</span>
      </div>
      <button class="cancel-edit" id="cancelEditBtn">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add cancel button handler
    editIndicator.querySelector('#cancelEditBtn').addEventListener('click', this.cancelEdit);
    
    // Insert before or after message input
    const messageInputContainer = this.messageInput.closest('.message-input-area');
    if (messageInputContainer) {
      messageInputContainer.prepend(editIndicator);
    } else {
      // Fallback - add after input
      this.messageInput.parentNode.insertBefore(editIndicator, this.messageInput.nextSibling);
    }
    
    return editIndicator;
  }
  
  /**
   * Cancel message editing
   */
  cancelEdit() {
    if (!this.currentEditId) return;
    
    // Remove editing class
    const messageElement = document.querySelector(`.message-item[data-id="${this.currentEditId}"]`);
    if (messageElement) {
      messageElement.classList.remove('editing');
    }
    
    // Hide edit indicator
    const editIndicator = document.getElementById('editIndicator');
    if (editIndicator) {
      editIndicator.style.display = 'none';
    }
    
    // Clear input
    if (this.messageInput) {
      this.messageInput.value = '';
    }
    
    // Reset state
    this.currentEditId = null;
    this.originalContent = null;
    
    // Publish event
    eventBus.publish('message:editing:cancelled');
  }
  
  /**
   * Save edited message
   * @param {Object} data - Optional data containing content
   */
  saveEdit(data = {}) {
    if (!this.currentEditId) return;
    
    // Get content from data or input
    const content = data.content || (this.messageInput ? this.messageInput.value.trim() : '');
    
    if (!content) {
      this.cancelEdit();
      return;
    }
    
    // If content hasn't changed, just cancel
    if (content === this.originalContent) {
      this.cancelEdit();
      return;
    }
    
    // Send to API
    apiClient.post('/messages.php', {
      action: 'edit',
      message_id: this.currentEditId,
      content: content
    })
      .then(data => {
        if (data.success) {
          // Update UI
          const messageElement = document.querySelector(`.message-item[data-id="${this.currentEditId}"]`);
          if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
              contentElement.innerText = content;
            }
            
            // Add edited indicator if not already present
            if (!messageElement.querySelector('.edited-indicator')) {
              const timeElement = messageElement.querySelector('.message-time');
              if (timeElement) {
                const editedSpan = document.createElement('span');
                editedSpan.className = 'edited-indicator';
                editedSpan.textContent = ' (edited)';
                timeElement.appendChild(editedSpan);
              }
            }
            
            // Remove editing class
            messageElement.classList.remove('editing');
          }
          
          // Publish event
          eventBus.publish('message:edited', {
            messageId: this.currentEditId,
            content: content
          });
        } else {
          throw new Error(data.error || 'Failed to edit message');
        }
      })
      .catch(error => {
        console.error('Error editing message:', error);
        
        // Publish error
        eventBus.publish('error', {
          message: 'Failed to edit message',
          error
        });
      })
      .finally(() => {
        // Reset state
        this.cancelEdit();
      });
  }
  
  /**
   * Check if a message is being edited
   * @returns {boolean} True if editing
   */
  isEditing() {
    return !!this.currentEditId;
  }
  
  /**
   * Get data about current edit
   * @returns {Object|null} Edit data or null if not editing
   */
  getEditData() {
    if (!this.currentEditId) return null;
    
    return {
      messageId: this.currentEditId,
      originalContent: this.originalContent
    };
  }
}

export default MessageEditor;
