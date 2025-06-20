/**
 * Chat Store
 * Manages chat-specific state including messages, users, and chat rooms
 */

import { EventBus } from '../services/EventBus.js';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/helpers.js';

class ChatStore {
  constructor() {
    this.state = {
      currentChat: null,
      messages: new Map(),
      users: new Map(),
      groups: new Map(),
      drafts: new Map(),
      unreadCounts: new Map(),
      typing: new Map(),
      lastSeen: new Map(),
      searchResults: [],
      loadingStates: new Map()
    };
    
    this.eventBus = new EventBus();
    this.initialized = false;
    this.maxMessages = 1000; // Maximum messages to keep in memory per chat
    this.maxSearchResults = 50;
    
    // Debug mode
    this.debug = false;
  }

  /**
   * Initialize chat store
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing chat store');
      
      // Load cached data
      await this.loadCachedData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      
      this.eventBus.emit('chatStore:initialized');
      logger.info('Chat store initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize chat store:', error);
      throw error;
    }
  }

  /**
   * Set current chat
   * @param {Object} chat - Chat object
   */
  setCurrentChat(chat) {
    const oldChat = this.state.currentChat;
    this.state.currentChat = chat;
    
    // Mark messages as read
    if (chat) {
      this.markAsRead(chat.id);
    }
    
    this.eventBus.emit('chatStore:currentChatChanged', {
      oldChat,
      newChat: chat
    });
    
    if (this.debug) {
      logger.debug('Current chat changed:', chat);
    }
  }

  /**
   * Get current chat
   */
  getCurrentChat() {
    return this.state.currentChat;
  }

  /**
   * Add message to store
   * @param {Object} message - Message object
   */
  addMessage(message) {
    const chatId = message.chatId || message.groupId || message.conversationId;
    
    if (!chatId) {
      logger.error('Message missing chat ID:', message);
      return;
    }
    
    if (!this.state.messages.has(chatId)) {
      this.state.messages.set(chatId, []);
    }
    
    const messages = this.state.messages.get(chatId);
    
    // Check if message already exists
    const existingIndex = messages.findIndex(m => m.id === message.id);
    
    if (existingIndex !== -1) {
      // Update existing message
      messages[existingIndex] = { ...messages[existingIndex], ...message };
    } else {
      // Add new message
      messages.push(message);
      
      // Sort messages by timestamp
      messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Limit message count
      if (messages.length > this.maxMessages) {
        messages.splice(0, messages.length - this.maxMessages);
      }
      
      // Update unread count if not current chat
      if (!this.state.currentChat || this.state.currentChat.id !== chatId) {
        this.incrementUnreadCount(chatId);
      }
    }
    
    // Cache messages
    this.cacheMessages(chatId);
    
    this.eventBus.emit('chatStore:messageAdded', {
      message,
      chatId,
      isUpdate: existingIndex !== -1
    });
  }

  /**
   * Update message
   * @param {string} messageId - Message ID
   * @param {Object} updates - Updates to apply
   */
  updateMessage(messageId, updates) {
    let found = false;
    
    for (const [chatId, messages] of this.state.messages) {
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        const oldMessage = messages[messageIndex];
        messages[messageIndex] = { ...oldMessage, ...updates };
        
        // Cache updated messages
        this.cacheMessages(chatId);
        
        this.eventBus.emit('chatStore:messageUpdated', {
          messageId,
          chatId,
          oldMessage,
          newMessage: messages[messageIndex]
        });
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      logger.warn('Message not found for update:', messageId);
    }
  }

  /**
   * Delete message
   * @param {string} messageId - Message ID
   */
  deleteMessage(messageId) {
    let found = false;
    
    for (const [chatId, messages] of this.state.messages) {
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        const deletedMessage = messages.splice(messageIndex, 1)[0];
        
        // Cache updated messages
        this.cacheMessages(chatId);
        
        this.eventBus.emit('chatStore:messageDeleted', {
          messageId,
          chatId,
          deletedMessage
        });
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      logger.warn('Message not found for deletion:', messageId);
    }
  }

  /**
   * Get messages for chat
   * @param {string} chatId - Chat ID
   * @param {number} limit - Maximum number of messages
   * @param {number} offset - Offset for pagination
   */
  getMessages(chatId, limit = 50, offset = 0) {
    const messages = this.state.messages.get(chatId) || [];
    
    if (limit === -1) {
      return messages.slice(offset);
    }
    
    return messages.slice(offset, offset + limit);
  }

  /**
   * Get message by ID
   * @param {string} messageId - Message ID
   */
  getMessage(messageId) {
    for (const messages of this.state.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        return message;
      }
    }
    return null;
  }

  /**
   * Add or update user
   * @param {Object} user - User object
   */
  addUser(user) {
    const existingUser = this.state.users.get(user.id);
    this.state.users.set(user.id, { ...existingUser, ...user });
    
    this.eventBus.emit('chatStore:userUpdated', {
      userId: user.id,
      user: this.state.users.get(user.id)
    });
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   */
  getUser(userId) {
    return this.state.users.get(userId);
  }

  /**
   * Add or update group
   * @param {Object} group - Group object
   */
  addGroup(group) {
    const existingGroup = this.state.groups.get(group.id);
    this.state.groups.set(group.id, { ...existingGroup, ...group });
    
    this.eventBus.emit('chatStore:groupUpdated', {
      groupId: group.id,
      group: this.state.groups.get(group.id)
    });
  }

  /**
   * Get group by ID
   * @param {string} groupId - Group ID
   */
  getGroup(groupId) {
    return this.state.groups.get(groupId);
  }

  /**
   * Set typing status
   * @param {string} chatId - Chat ID
   * @param {string} userId - User ID
   * @param {boolean} isTyping - Typing status
   */
  setTyping(chatId, userId, isTyping) {
    if (!this.state.typing.has(chatId)) {
      this.state.typing.set(chatId, new Map());
    }
    
    const chatTyping = this.state.typing.get(chatId);
    
    if (isTyping) {
      chatTyping.set(userId, Date.now());
    } else {
      chatTyping.delete(userId);
    }
    
    this.eventBus.emit('chatStore:typingChanged', {
      chatId,
      userId,
      isTyping,
      typingUsers: Array.from(chatTyping.keys())
    });
  }

  /**
   * Get typing users for chat
   * @param {string} chatId - Chat ID
   */
  getTypingUsers(chatId) {
    const chatTyping = this.state.typing.get(chatId);
    if (!chatTyping) {
      return [];
    }
    
    // Clean up old typing indicators (older than 30 seconds)
    const now = Date.now();
    const cutoff = 30000; // 30 seconds
    
    for (const [userId, timestamp] of chatTyping) {
      if (now - timestamp > cutoff) {
        chatTyping.delete(userId);
      }
    }
    
    return Array.from(chatTyping.keys());
  }

  /**
   * Set draft message
   * @param {string} chatId - Chat ID
   * @param {string} draft - Draft message
   */
  setDraft(chatId, draft) {
    if (draft && draft.trim()) {
      this.state.drafts.set(chatId, draft);
    } else {
      this.state.drafts.delete(chatId);
    }
    
    // Cache drafts
    this.cacheDrafts();
    
    this.eventBus.emit('chatStore:draftChanged', {
      chatId,
      draft
    });
  }

  /**
   * Get draft message
   * @param {string} chatId - Chat ID
   */
  getDraft(chatId) {
    return this.state.drafts.get(chatId) || '';
  }

  /**
   * Mark chat as read
   * @param {string} chatId - Chat ID
   */
  markAsRead(chatId) {
    const oldCount = this.state.unreadCounts.get(chatId) || 0;
    this.state.unreadCounts.set(chatId, 0);
    
    if (oldCount > 0) {
      this.eventBus.emit('chatStore:unreadCountChanged', {
        chatId,
        oldCount,
        newCount: 0
      });
    }
  }

  /**
   * Increment unread count
   * @param {string} chatId - Chat ID
   */
  incrementUnreadCount(chatId) {
    const oldCount = this.state.unreadCounts.get(chatId) || 0;
    const newCount = oldCount + 1;
    this.state.unreadCounts.set(chatId, newCount);
    
    this.eventBus.emit('chatStore:unreadCountChanged', {
      chatId,
      oldCount,
      newCount
    });
  }

  /**
   * Get unread count
   * @param {string} chatId - Chat ID
   */
  getUnreadCount(chatId) {
    return this.state.unreadCounts.get(chatId) || 0;
  }

  /**
   * Get total unread count
   */
  getTotalUnreadCount() {
    let total = 0;
    for (const count of this.state.unreadCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Set search results
   * @param {Array} results - Search results
   */
  setSearchResults(results) {
    this.state.searchResults = results.slice(0, this.maxSearchResults);
    
    this.eventBus.emit('chatStore:searchResultsChanged', {
      results: this.state.searchResults
    });
  }

  /**
   * Get search results
   */
  getSearchResults() {
    return this.state.searchResults;
  }

  /**
   * Clear search results
   */
  clearSearchResults() {
    this.state.searchResults = [];
    
    this.eventBus.emit('chatStore:searchResultsChanged', {
      results: []
    });
  }

  /**
   * Set loading state
   * @param {string} key - Loading key
   * @param {boolean} loading - Loading state
   */
  setLoading(key, loading) {
    this.state.loadingStates.set(key, loading);
    
    this.eventBus.emit('chatStore:loadingChanged', {
      key,
      loading
    });
  }

  /**
   * Get loading state
   * @param {string} key - Loading key
   */
  isLoading(key) {
    return this.state.loadingStates.get(key) || false;
  }

  /**
   * Load cached data
   */
  async loadCachedData() {
    try {
      // Load drafts
      const drafts = storage.get('quickchat:drafts');
      if (drafts) {
        this.state.drafts = new Map(Object.entries(drafts));
      }
      
      // Load recent messages (limited cache)
      const recentMessages = storage.get('quickchat:recent-messages');
      if (recentMessages) {
        for (const [chatId, messages] of Object.entries(recentMessages)) {
          this.state.messages.set(chatId, messages);
        }
      }
      
    } catch (error) {
      logger.warn('Failed to load cached chat data:', error);
    }
  }

  /**
   * Cache messages for a chat
   * @param {string} chatId - Chat ID
   */
  cacheMessages(chatId) {
    try {
      const messages = this.state.messages.get(chatId) || [];
      const recentMessages = messages.slice(-50); // Keep only last 50 messages in cache
      
      let cached = storage.get('quickchat:recent-messages') || {};
      cached[chatId] = recentMessages;
      
      storage.set('quickchat:recent-messages', cached);
    } catch (error) {
      logger.warn('Failed to cache messages:', error);
    }
  }

  /**
   * Cache drafts
   */
  cacheDrafts() {
    try {
      const drafts = Object.fromEntries(this.state.drafts);
      storage.set('quickchat:drafts', drafts);
    } catch (error) {
      logger.warn('Failed to cache drafts:', error);
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Clean up old typing indicators periodically
    setInterval(() => {
      const now = Date.now();
      const cutoff = 30000; // 30 seconds
      
      for (const [chatId, chatTyping] of this.state.typing) {
        for (const [userId, timestamp] of chatTyping) {
          if (now - timestamp > cutoff) {
            chatTyping.delete(userId);
            
            this.eventBus.emit('chatStore:typingChanged', {
              chatId,
              userId,
              isTyping: false,
              typingUsers: Array.from(chatTyping.keys())
            });
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Clear all data
   */
  clear() {
    this.state = {
      currentChat: null,
      messages: new Map(),
      users: new Map(),
      groups: new Map(),
      drafts: new Map(),
      unreadCounts: new Map(),
      typing: new Map(),
      lastSeen: new Map(),
      searchResults: [],
      loadingStates: new Map()
    };
    
    // Clear cached data
    storage.remove('quickchat:drafts');
    storage.remove('quickchat:recent-messages');
    
    this.eventBus.emit('chatStore:cleared');
    logger.info('Chat store cleared');
  }

  /**
   * Enable debug mode
   * @param {boolean} enabled - Debug enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      currentChat: this.state.currentChat?.id || null,
      messageChats: Array.from(this.state.messages.keys()),
      totalMessages: Array.from(this.state.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
      userCount: this.state.users.size,
      groupCount: this.state.groups.size,
      draftCount: this.state.drafts.size,
      totalUnreadCount: this.getTotalUnreadCount(),
      searchResultCount: this.state.searchResults.length,
      loadingStates: Object.fromEntries(this.state.loadingStates)
    };
  }
}

// Create singleton instance
export const chatStore = new ChatStore();
