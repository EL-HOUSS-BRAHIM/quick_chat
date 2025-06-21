/**
 * Chat Reactions Module
 * Handles emoji reactions to messages
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class ChatReactions {
  constructor() {
    this.pickerElement = null;
    this.currentMessageId = null;
    this.emojis = [
      '👍', '👎', '❤️', '😂', '😢', '😡', '🔥', '🎉', '✅', '👏'
    ];
    
    // Bind methods
    this.showPicker = this.showPicker.bind(this);
    this.hidePicker = this.hidePicker.bind(this);
    this.addReaction = this.addReaction.bind(this);
    this.removeReaction = this.removeReaction.bind(this);
    this.updateMessageReactions = this.updateMessageReactions.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize reactions module
   */
  init() {
    // Create picker element if not exists
    if (!document.getElementById('reactionPicker')) {
      this.createReactionPicker();
    } else {
      this.pickerElement = document.getElementById('reactionPicker');
      this.populateEmojiPicker();
    }
    
    // Subscribe to events
    eventBus.subscribe('message:reaction:show', this.showPicker);
    eventBus.subscribe('message:reaction:update', this.updateMessageReactions);
  }
  
  /**
   * Create reaction picker element
   */
  createReactionPicker() {
    this.pickerElement = document.createElement('div');
    this.pickerElement.id = 'reactionPicker';
    this.pickerElement.className = 'reaction-picker';
    this.pickerElement.style.display = 'none';
    
    // Populate with emojis
    this.populateEmojiPicker();
    
    // Add to DOM
    document.body.appendChild(this.pickerElement);
  }
  
  /**
   * Populate the emoji picker with reaction options
   */
  populateEmojiPicker() {
    if (!this.pickerElement) return;
    
    this.pickerElement.innerHTML = '';
    
    this.emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => this.addReaction(emoji));
      this.pickerElement.appendChild(btn);
    });
  }
  
  /**
   * Show reaction picker for a message
   * @param {Object} data - Data containing messageId and event/position info
   */
  showPicker(data) {
    if (!this.pickerElement) return;
    
    const { messageId, event } = data;
    this.currentMessageId = messageId;
    
    // Position the picker
    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      this.pickerElement.style.position = 'absolute';
      this.pickerElement.style.bottom = `${window.innerHeight - rect.top + 10}px`;
      this.pickerElement.style.left = `${rect.left}px`;
    }
    
    // Show the picker
    this.pickerElement.style.display = 'block';
    
    // Handle click outside to close
    setTimeout(() => {
      document.addEventListener('click', this.hidePicker);
    }, 100);
  }
  
  /**
   * Hide the reaction picker
   * @param {Event} event - Click event
   */
  hidePicker(event) {
    if (!this.pickerElement) return;
    
    // If clicking inside the picker, keep it open
    if (event && this.pickerElement.contains(event.target) && 
        !event.target.classList.contains('emoji-btn')) {
      return;
    }
    
    // Hide picker
    this.pickerElement.style.display = 'none';
    document.removeEventListener('click', this.hidePicker);
    this.currentMessageId = null;
  }
  
  /**
   * Add a reaction to a message
   * @param {string} emoji - The emoji reaction
   */
  addReaction(emoji) {
    if (!this.currentMessageId) return;
    
    // Hide picker
    this.pickerElement.style.display = 'none';
    document.removeEventListener('click', this.hidePicker);
    
    // Send to API
    apiClient.post('/message-reactions.php', {
      message_id: this.currentMessageId,
      emoji: emoji
    })
    .then(data => {
      if (data.success) {
        eventBus.publish('message:reaction:update', {
          messageId: this.currentMessageId,
          reactions: data.reactions
        });
      }
    })
    .catch(error => {
      console.error('Error sending reaction:', error);
      eventBus.publish('error', { 
        message: 'Failed to add reaction', 
        error 
      });
    });
  }
  
  /**
   * Remove a reaction from a message
   * @param {number} messageId - The message ID
   * @param {string} emoji - The emoji to remove
   */
  removeReaction(messageId, emoji) {
    apiClient.post('/message-reactions.php', {
      message_id: messageId,
      emoji: emoji,
      action: 'remove'
    })
    .then(data => {
      if (data.success) {
        eventBus.publish('message:reaction:update', {
          messageId: messageId,
          reactions: data.reactions
        });
      }
    })
    .catch(error => {
      console.error('Error removing reaction:', error);
      eventBus.publish('error', { 
        message: 'Failed to remove reaction', 
        error 
      });
    });
  }
  
  /**
   * Update message reactions in the UI
   * @param {Object} data - Data containing messageId and reactions
   */
  updateMessageReactions(data) {
    const { messageId, reactions } = data;
    
    const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
    if (!messageElement) return;
    
    let reactionsContainer = messageElement.querySelector('.message-reactions');
    
    // Create container if it doesn't exist
    if (!reactionsContainer) {
      reactionsContainer = document.createElement('div');
      reactionsContainer.className = 'message-reactions';
      
      // Find where to insert (after message-content)
      const messageContent = messageElement.querySelector('.message-content');
      if (messageContent) {
        messageContent.after(reactionsContainer);
      } else {
        return;
      }
    }
    
    // Clear existing reactions
    reactionsContainer.innerHTML = '';
    
    if (!reactions || reactions.length === 0) return;
    
    // Group by emoji
    const groupedReactions = {};
    reactions.forEach(reaction => {
      if (!groupedReactions[reaction.emoji]) {
        groupedReactions[reaction.emoji] = [];
      }
      groupedReactions[reaction.emoji].push(reaction);
    });
    
    // Add to UI
    Object.entries(groupedReactions).forEach(([emoji, users]) => {
      const reactionBtn = document.createElement('button');
      reactionBtn.className = 'reaction-badge';
      reactionBtn.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
      
      // Tooltip with usernames
      const usernames = users.map(u => u.username || 'User').join(', ');
      reactionBtn.title = usernames;
      
      // Current user ID for highlighting own reactions
      const currentUserId = parseInt(document.body.dataset.userId);
      const hasReacted = users.some(u => parseInt(u.user_id) === currentUserId);
      
      if (hasReacted) {
        reactionBtn.classList.add('user-reacted');
      }
      
      // Add click handler to toggle
      reactionBtn.addEventListener('click', () => {
        if (hasReacted) {
          this.removeReaction(messageId, emoji);
        } else {
          // For adding we'll set current message ID and call addReaction
          this.currentMessageId = messageId;
          this.addReaction(emoji);
        }
      });
      
      reactionsContainer.appendChild(reactionBtn);
    });
  }
}

export default ChatReactions;
