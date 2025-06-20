/**
 * Dashboard Component - Organized Architecture
 * 
 * Main dashboard interface showing recent chats, user status, and quick actions
 * Provides navigation to different chat features
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { userStore } from '../state/userStore.js';
import { chatStore } from '../state/chatStore.js';
import { logger } from '../utils/logger.js';
import { formatTime, escapeHtml } from '../utils/helpers.js';

export class Dashboard {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.getElementById('dashboard-container'),
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.recentChats = [];
    this.initialized = false;
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    try {
      logger.info('Initializing Dashboard');

      this.container = this.config.container;
      
      if (!this.container) {
        throw new Error('Dashboard container not found');
      }

      this.setupDOM();
      this.setupEventListeners();
      
      // Load initial data
      await this.loadData();
      
      this.initialized = true;
      this.eventBus.emit('dashboard:initialized');

    } catch (error) {
      logger.error('Failed to initialize Dashboard:', error);
      throw error;
    }
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    this.container.innerHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <h1>Quick Chat Dashboard</h1>
          <div class="user-status">
            <span class="status-indicator online"></span>
            <span class="status-text">Online</span>
          </div>
        </div>
        
        <div class="dashboard-content">
          <div class="quick-actions">
            <h2>Quick Actions</h2>
            <div class="action-cards">
              <div class="action-card" id="start-chat">
                <i class="fas fa-comment"></i>
                <h3>Start Chat</h3>
                <p>Begin a new conversation</p>
              </div>
              
              <div class="action-card" id="create-group">
                <i class="fas fa-users"></i>
                <h3>Create Group</h3>
                <p>Start a group conversation</p>
              </div>
              
              <div class="action-card" id="join-group">
                <i class="fas fa-user-plus"></i>
                <h3>Join Group</h3>
                <p>Join an existing group</p>
              </div>
            </div>
          </div>
          
          <div class="recent-chats">
            <h2>Recent Chats</h2>
            <div class="chats-list" id="recent-chats-list">
              <!-- Recent chats will be loaded here -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Get DOM element references
    this.recentChatsList = this.container.querySelector('#recent-chats-list');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Quick action cards
    const startChatCard = this.container.querySelector('#start-chat');
    const createGroupCard = this.container.querySelector('#create-group');
    const joinGroupCard = this.container.querySelector('#join-group');

    startChatCard?.addEventListener('click', () => {
      this.handleStartChat();
    });

    createGroupCard?.addEventListener('click', () => {
      this.handleCreateGroup();
    });

    joinGroupCard?.addEventListener('click', () => {
      this.handleJoinGroup();
    });

    // Listen for chat updates
    chatStore.on('chats:updated', () => {
      this.loadRecentChats();
    });
  }

  /**
   * Load dashboard data
   */
  async loadData() {
    try {
      // Load recent chats
      await this.loadRecentChats();
      
      // Load user profile
      await this.loadUserProfile();

    } catch (error) {
      logger.error('Failed to load dashboard data:', error);
    }
  }

  /**
   * Load recent chats
   */
  async loadRecentChats() {
    try {
      const response = await apiClient.get('/chats/recent', { limit: 10 });
      this.recentChats = response.chats || [];
      this.renderRecentChats();

    } catch (error) {
      logger.error('Failed to load recent chats:', error);
      this.renderEmptyState();
    }
  }

  /**
   * Load user profile
   */
  async loadUserProfile() {
    try {
      const profile = await apiClient.getCurrentUser();
      userStore.setCurrentUser(profile);

    } catch (error) {
      logger.error('Failed to load user profile:', error);
    }
  }

  /**
   * Render recent chats
   */
  renderRecentChats() {
    if (!this.recentChatsList) return;

    if (this.recentChats.length === 0) {
      this.renderEmptyState();
      return;
    }

    const chatsHTML = this.recentChats.map(chat => `
      <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type}">
        <div class="chat-avatar">
          <img src="${escapeHtml(chat.avatar_url || '/assets/images/default-avatar.png')}" 
               alt="${escapeHtml(chat.name)}">
          ${chat.unread_count > 0 ? `<div class="unread-badge">${chat.unread_count}</div>` : ''}
        </div>
        
        <div class="chat-info">
          <div class="chat-name">${escapeHtml(chat.name)}</div>
          <div class="chat-last-message">${escapeHtml(chat.last_message || 'No messages yet')}</div>
        </div>
        
        <div class="chat-meta">
          <div class="chat-time">${formatTime(chat.last_activity)}</div>
          ${chat.type === 'group' ? '<i class="fas fa-users chat-type-icon"></i>' : ''}
        </div>
      </div>
    `).join('');

    this.recentChatsList.innerHTML = chatsHTML;

    // Add click handlers
    this.recentChatsList.addEventListener('click', (event) => {
      const chatItem = event.target.closest('.chat-item');
      if (chatItem) {
        const chatId = chatItem.dataset.chatId;
        const chatType = chatItem.dataset.chatType;
        this.openChat(chatId, chatType);
      }
    });
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    if (!this.recentChatsList) return;

    this.recentChatsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comment-slash"></i>
        <h3>No recent chats</h3>
        <p>Start a conversation to see your chats here</p>
      </div>
    `;
  }

  /**
   * Handle start chat action
   */
  handleStartChat() {
    // This could open a user search modal or redirect to a page
    logger.info('Start chat clicked');
    this.eventBus.emit('dashboard:start_chat');
    
    // For now, redirect to a search page or show modal
    // Implementation depends on the specific UI design
    window.location.href = '/private-chat.php';
  }

  /**
   * Handle create group action
   */
  handleCreateGroup() {
    logger.info('Create group clicked');
    this.eventBus.emit('dashboard:create_group');
    
    // Redirect to group creation page
    window.location.href = '/group-chat.php?action=create';
  }

  /**
   * Handle join group action
   */
  handleJoinGroup() {
    logger.info('Join group clicked');
    this.eventBus.emit('dashboard:join_group');
    
    // Show group join interface
    window.location.href = '/join-group.php';
  }

  /**
   * Open a specific chat
   */
  openChat(chatId, chatType) {
    logger.info(`Opening ${chatType} chat:`, chatId);
    
    if (chatType === 'group') {
      window.location.href = `/group-chat.php?group=${chatId}`;
    } else {
      window.location.href = `/private-chat.php?user=${chatId}`;
    }
  }

  /**
   * Update recent chats (called from external updates)
   */
  updateRecentChats(chats) {
    this.recentChats = chats;
    this.renderRecentChats();
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    this.eventBus.emit('dashboard:destroyed');
  }
}

export default Dashboard;
