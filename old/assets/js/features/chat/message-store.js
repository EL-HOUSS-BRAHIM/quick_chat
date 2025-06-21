/**
 * Message Store
 * Manages chat message data
 */

class MessageStore {
  constructor() {
    this.messages = new Map();
    this.messageIds = [];
  }

  /**
   * Add a message to the store
   * @param {Object} message - Message to add
   */
  addMessage(message) {
    this.messages.set(message.id.toString(), message);
    this.messageIds.push(message.id.toString());
  }

  /**
   * Add multiple messages to the store
   * @param {Array} messages - Messages to add
   */
  addMessages(messages) {
    messages.forEach(message => {
      this.addMessage(message);
    });
  }

  /**
   * Get a message by ID
   * @param {string|number} id - Message ID
   * @returns {Object|null} Message object
   */
  getMessage(id) {
    return this.messages.get(id.toString()) || null;
  }

  /**
   * Get all messages
   * @returns {Array} Array of messages
   */
  getAllMessages() {
    return this.messageIds.map(id => this.messages.get(id)).filter(Boolean);
  }

  /**
   * Update a message
   * @param {string|number} id - Message ID
   * @param {Object} updates - Update properties
   * @returns {Object|null} Updated message
   */
  updateMessage(id, updates) {
    const message = this.getMessage(id);
    if (!message) return null;
    
    const updatedMessage = { ...message, ...updates };
    this.messages.set(id.toString(), updatedMessage);
    
    return updatedMessage;
  }

  /**
   * Remove a message
   * @param {string|number} id - Message ID
   * @returns {boolean} Success
   */
  removeMessage(id) {
    const strId = id.toString();
    const success = this.messages.delete(strId);
    
    if (success) {
      this.messageIds = this.messageIds.filter(msgId => msgId !== strId);
    }
    
    return success;
  }

  /**
   * Replace a message (useful for replacing temp IDs with real IDs)
   * @param {string|number} oldId - Old message ID
   * @param {Object} newMessage - New message object
   * @returns {boolean} Success
   */
  replaceMessage(oldId, newMessage) {
    const strOldId = oldId.toString();
    const strNewId = newMessage.id.toString();
    
    // Remove old message
    const success = this.messages.delete(strOldId);
    
    if (success) {
      // Add new message
      this.messages.set(strNewId, newMessage);
      
      // Update IDs array
      const index = this.messageIds.indexOf(strOldId);
      if (index !== -1) {
        this.messageIds[index] = strNewId;
      } else {
        this.messageIds.push(strNewId);
      }
    }
    
    return success;
  }

  /**
   * Clear all messages
   */
  clear() {
    this.messages.clear();
    this.messageIds = [];
  }

  /**
   * Get number of messages
   * @returns {number} Count
   */
  count() {
    return this.messages.size;
  }

  /**
   * Get the newest message
   * @returns {Object|null} Newest message
   */
  getNewestMessage() {
    if (this.messageIds.length === 0) return null;
    return this.messages.get(this.messageIds[this.messageIds.length - 1]);
  }

  /**
   * Get the oldest message
   * @returns {Object|null} Oldest message
   */
  getOldestMessage() {
    if (this.messageIds.length === 0) return null;
    return this.messages.get(this.messageIds[0]);
  }

  /**
   * Search messages for content
   * @param {string} query - Search query
   * @returns {Array} Matching messages
   */
  searchMessages(query) {
    if (!query) return [];
    
    const lowerQuery = query.toLowerCase();
    
    return this.getAllMessages().filter(message => {
      // Only search text messages
      if (message.type !== 'text') return false;
      
      return message.content.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Get messages in a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Messages in range
   */
  getMessagesByDateRange(startDate, endDate) {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    
    return this.getAllMessages().filter(message => {
      const messageDate = new Date(message.created_at);
      return messageDate >= start && messageDate <= end;
    });
  }
}

export default MessageStore;
