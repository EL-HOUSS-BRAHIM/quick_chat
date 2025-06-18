/**
 * Realtime Chat Module
 * Handles realtime messaging functionality through WebSockets
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import utils from '../../core/utils.js';
import websocketManager from '../../core/websocket-manager.js';

class RealtimeChat {
  constructor() {
    this.typingUsers = new Map();
    this.typingTimeout = 3000; // Clear typing indicator after 3 seconds of inactivity
    this.typingTimeouts = new Map();
    this.unreadMessages = new Map(); // userId/groupId -> count
    this.presenceStatus = new Map(); // userId -> status
    this.typing = false;
    this.lastTypingEvent = 0;
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.handleTyping = this.handleTyping.bind(this);
    this.handleReadReceipt = this.handleReadReceipt.bind(this);
    this.handlePresence = this.handlePresence.bind(this);
    this.sendTypingStatus = this.sendTypingStatus.bind(this);
    this.sendReadReceipt = this.sendReadReceipt.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize realtime chat
   */
  init() {
    // Subscribe to websocket events
    websocketManager.subscribe('message', this.handleMessage);
    websocketManager.subscribe('typing', this.handleTyping);
    websocketManager.subscribe('read', this.handleReadReceipt);
    websocketManager.subscribe('presence', this.handlePresence);
    
    // Subscribe to app events
    eventBus.subscribe('chat:message:input', this.handleLocalTyping.bind(this));
    eventBus.subscribe('chat:message:read', this.sendReadReceipt);
    
    // Initialize presence updates
    this.initializePresence();
  }
  
  /**
   * Initialize presence updates
   */
  initializePresence() {
    // Set initial online status
    this.setPresenceStatus('online');
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.setPresenceStatus('away');
      } else {
        this.setPresenceStatus('online');
      }
    });
    
    // Handle before unload
    window.addEventListener('beforeunload', () => {
      this.setPresenceStatus('offline');
    });
  }
  
  /**
   * Handle incoming message
   * @param {Object} data Message data
   */
  handleMessage(data) {
    const { message } = data;
    
    if (!message) return;
    
    // Check if private or group message
    if (message.type === 'private') {
      // Handle private message
      eventBus.publish('private:chat:message:new', { message });
      
      // Update unread count if not the active chat
      const currentChat = state.get('currentPrivateChat');
      const otherUserId = message.sender;
      
      if (!currentChat || currentChat.userId !== otherUserId) {
        this.incrementUnreadCount(otherUserId);
      } else {
        // Send read receipt if this is the active chat
        this.sendReadReceipt({
          chatId: otherUserId,
          messageId: message.id,
          type: 'private'
        });
      }
    } else if (message.type === 'group') {
      // Handle group message
      eventBus.publish('group:chat:message:new', { message });
      
      // Update unread count if not the active group
      const currentGroup = state.get('currentGroup');
      const groupId = message.groupId;
      
      if (!currentGroup || currentGroup.id !== groupId) {
        this.incrementUnreadCount(groupId, 'group');
      } else {
        // Send read receipt if this is the active group
        this.sendReadReceipt({
          chatId: groupId,
          messageId: message.id,
          type: 'group'
        });
      }
    }
    
    // Show notification if app is not focused
    if (document.hidden) {
      this.showNotification(message);
    }
  }
  
  /**
   * Handle typing indicator
   * @param {Object} data Typing data
   */
  handleTyping(data) {
    const { userId, chatId, type, isTyping } = data;
    
    // Skip own typing events
    if (userId === state.get('currentUser').id) return;
    
    // Create a unique key for this typing event
    const key = type === 'private' ? userId : `group_${chatId}`;
    
    // Clear any existing timeout
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
    }
    
    if (isTyping) {
      // Add to typing users
      this.typingUsers.set(key, {
        userId,
        chatId,
        type,
        timestamp: Date.now()
      });
      
      // Set timeout to clear typing indicator
      const timeout = setTimeout(() => {
        this.typingUsers.delete(key);
        this.typingTimeouts.delete(key);
        
        // Publish typing stopped event
        eventBus.publish('chat:typing:stopped', {
          userId,
          chatId,
          type
        });
      }, this.typingTimeout);
      
      this.typingTimeouts.set(key, timeout);
      
      // Publish typing event
      eventBus.publish('chat:typing', {
        userId,
        chatId,
        type
      });
    } else {
      // Remove from typing users
      this.typingUsers.delete(key);
      
      // Publish typing stopped event
      eventBus.publish('chat:typing:stopped', {
        userId,
        chatId,
        type
      });
    }
  }
  
  /**
   * Handle local typing
   * @param {Object} data Input data
   */
  handleLocalTyping(data) {
    const { chatId, type } = data;
    
    // Skip if no active chat
    if (!chatId) return;
    
    // Only send typing event if not already typing or if last event was more than 3 seconds ago
    const now = Date.now();
    if (!this.typing || now - this.lastTypingEvent > 3000) {
      this.typing = true;
      this.lastTypingEvent = now;
      
      // Send typing indicator
      this.sendTypingStatus(chatId, type, true);
      
      // Send stopped typing after delay
      setTimeout(() => {
        this.typing = false;
        this.sendTypingStatus(chatId, type, false);
      }, 5000); // Stop typing indicator after 5 seconds
    }
  }
  
  /**
   * Send typing status
   * @param {string} chatId ID of the chat (user ID or group ID)
   * @param {string} type Type of chat ('private' or 'group')
   * @param {boolean} isTyping Whether user is typing
   */
  sendTypingStatus(chatId, type, isTyping) {
    websocketManager.send({
      action: 'typing',
      data: {
        chatId,
        type,
        isTyping
      }
    });
  }
  
  /**
   * Handle read receipt
   * @param {Object} data Read receipt data
   */
  handleReadReceipt(data) {
    const { userId, chatId, messageId, type } = data;
    
    // Skip own read receipts
    if (userId === state.get('currentUser').id) return;
    
    // Update read status
    if (type === 'private') {
      eventBus.publish('private:chat:message:read', {
        userId,
        messageId
      });
    } else if (type === 'group') {
      eventBus.publish('group:chat:message:read', {
        userId,
        groupId: chatId,
        messageId
      });
    }
  }
  
  /**
   * Send read receipt
   * @param {Object} data Read data
   */
  sendReadReceipt(data) {
    const { chatId, messageId, type } = data;
    
    websocketManager.send({
      action: 'read',
      data: {
        chatId,
        messageId,
        type
      }
    });
    
    // Reset unread count
    this.resetUnreadCount(chatId, type);
  }
  
  /**
   * Handle presence update
   * @param {Object} data Presence data
   */
  handlePresence(data) {
    const { userId, status, lastSeen } = data;
    
    // Skip own presence updates
    if (userId === state.get('currentUser').id) return;
    
    // Update presence status
    this.presenceStatus.set(userId, { status, lastSeen });
    
    // Publish presence event
    eventBus.publish('user:presence:changed', {
      userId,
      status,
      lastSeen
    });
  }
  
  /**
   * Set presence status
   * @param {string} status Status ('online', 'away', 'offline')
   */
  setPresenceStatus(status) {
    websocketManager.send({
      action: 'presence',
      data: {
        status
      }
    });
  }
  
  /**
   * Get user presence status
   * @param {string} userId User ID
   * @returns {Object} Presence status object
   */
  getUserPresence(userId) {
    return this.presenceStatus.get(userId) || { status: 'unknown' };
  }
  
  /**
   * Increment unread count
   * @param {string} chatId ID of the chat (user ID or group ID)
   * @param {string} type Type of chat ('private' or 'group')
   */
  incrementUnreadCount(chatId, type = 'private') {
    const key = type === 'private' ? chatId : `group_${chatId}`;
    const currentCount = this.unreadMessages.get(key) || 0;
    this.unreadMessages.set(key, currentCount + 1);
    
    // Publish unread event
    eventBus.publish('chat:unread:updated', {
      chatId,
      type,
      count: currentCount + 1
    });
  }
  
  /**
   * Reset unread count
   * @param {string} chatId ID of the chat (user ID or group ID)
   * @param {string} type Type of chat ('private' or 'group')
   */
  resetUnreadCount(chatId, type = 'private') {
    const key = type === 'private' ? chatId : `group_${chatId}`;
    if (this.unreadMessages.has(key)) {
      this.unreadMessages.set(key, 0);
      
      // Publish unread event
      eventBus.publish('chat:unread:updated', {
        chatId,
        type,
        count: 0
      });
    }
  }
  
  /**
   * Get unread count
   * @param {string} chatId ID of the chat (user ID or group ID)
   * @param {string} type Type of chat ('private' or 'group')
   * @returns {number} Unread count
   */
  getUnreadCount(chatId, type = 'private') {
    const key = type === 'private' ? chatId : `group_${chatId}`;
    return this.unreadMessages.get(key) || 0;
  }
  
  /**
   * Show notification for new message
   * @param {Object} message Message object
   */
  showNotification(message) {
    // Check notification permission
    if (Notification.permission !== 'granted') return;
    
    let title, body, icon;
    
    if (message.type === 'private') {
      title = message.senderName || 'New message';
      body = message.text;
      icon = message.senderAvatar || '/assets/images/default-avatar.png';
    } else {
      title = message.groupName || 'New group message';
      body = `${message.senderName}: ${message.text}`;
      icon = message.groupAvatar || '/assets/images/default-group.svg';
    }
    
    // Create and show notification
    const notification = new Notification(title, {
      body,
      icon,
      badge: '/assets/images/icon-192.png',
      tag: message.id, // Prevent duplicate notifications
      renotify: false
    });
    
    // Handle notification click
    notification.onclick = () => {
      window.focus();
      
      if (message.type === 'private') {
        eventBus.publish('private:chat:load', {
          userId: message.sender,
          username: message.senderName
        });
      } else {
        eventBus.publish('group:chat:load', {
          groupId: message.groupId,
          groupName: message.groupName
        });
      }
      
      notification.close();
    };
  }
}

export default RealtimeChat;
