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
    this.typingThrottleTime = 1000; // Only send typing status every 1 second
    this.unreadMessages = new Map(); // userId/groupId -> count
    this.presenceStatus = new Map(); // userId -> status
    this.typing = false;
    this.lastTypingEvent = 0;
    this.currentChatId = null;
    this.currentChatType = null;
    
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
    eventBus.subscribe('private:chat:open', this.setCurrentChat.bind(this));
    eventBus.subscribe('group:chat:open', this.setCurrentChat.bind(this));
    
    // Initialize presence updates
    this.initializePresence();
    
    // Create typing indicator element
    this.createTypingIndicator();
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
    const { userId, typing, chatId, chatType } = data;
    
    if (!userId || !chatId) {
      return;
    }
    
    // Clear any existing timeout for this user
    if (this.typingTimeouts.has(userId)) {
      clearTimeout(this.typingTimeouts.get(userId));
    }
    
    // Update typing users map
    if (typing) {
      this.typingUsers.set(userId, {
        chatId,
        chatType,
        timestamp: Date.now()
      });
      
      // Set timeout to clear typing status
      const timeout = setTimeout(() => {
        this.typingUsers.delete(userId);
        this.typingTimeouts.delete(userId);
        this.updateTypingIndicator();
      }, this.typingTimeout + 1000); // Add buffer to server timeout
      
      this.typingTimeouts.set(userId, timeout);
    } else {
      this.typingUsers.delete(userId);
      this.typingTimeouts.delete(userId);
    }
    
    // Update the UI
    this.updateTypingIndicator();
  }
  
  /**
   * Set current chat
   * @param {Object} data - Chat data
   */
  setCurrentChat(data) {
    if (data.type === 'private') {
      this.currentChatId = data.userId;
      this.currentChatType = 'private';
    } else if (data.type === 'group') {
      this.currentChatId = data.groupId;
      this.currentChatType = 'group';
    }
    
    // Clear unread count for this chat
    this.clearUnreadCount(this.currentChatId);
    
    // Update typing indicator
    this.updateTypingIndicator();
  }
  
  /**
   * Create typing indicator element
   */
  createTypingIndicator() {
    // Check if it already exists
    let typingIndicator = document.getElementById('typing-indicator');
    
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.id = 'typing-indicator';
      typingIndicator.className = 'typing-indicator';
      typingIndicator.setAttribute('aria-live', 'polite');
      typingIndicator.style.display = 'none';
      
      // Add to the chat container
      const chatContainer = document.querySelector('.chat-messages, .message-container');
      if (chatContainer) {
        chatContainer.appendChild(typingIndicator);
      } else {
        // Fallback if chat container is not found yet
        document.addEventListener('DOMContentLoaded', () => {
          const container = document.querySelector('.chat-messages, .message-container');
          if (container) {
            container.appendChild(typingIndicator);
          }
        });
      }
    }
    
    return typingIndicator;
  }
  
  /**
   * Handle local user typing
   * @param {Object} data - Input event data
   */
  handleLocalTyping(data) {
    const now = Date.now();
    
    // Don't send typing status too often
    if (now - this.lastTypingEvent < this.typingThrottleTime) {
      return;
    }
    
    // Set typing flag and send status
    this.typing = true;
    this.lastTypingEvent = now;
    
    this.sendTypingStatus({
      typing: true,
      chatId: this.currentChatId,
      chatType: this.currentChatType
    });
    
    // Clear typing status after timeout
    setTimeout(() => {
      if (now === this.lastTypingEvent) {
        this.typing = false;
        this.sendTypingStatus({
          typing: false,
          chatId: this.currentChatId,
          chatType: this.currentChatType
        });
      }
    }, this.typingTimeout);
  }
  
  /**
   * Send typing status to other users
   * @param {Object} data - Typing data
   */
  sendTypingStatus(data) {
    if (!data.chatId || !data.chatType) {
      return;
    }
    
    websocketManager.send('typing', {
      typing: data.typing,
      chatId: data.chatId,
      chatType: data.chatType
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
