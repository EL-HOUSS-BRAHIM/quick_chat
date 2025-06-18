/**
 * Dashboard Module
 * Central file for dashboard functionality
 */

import app from '../../core/app.js';
import eventBus from '../../core/event-bus.js';
import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { state } from '../../core/state.js';
import utils from '../../core/utils.js';

class DashboardModule {
  constructor(options = {}) {
    // Configuration
    this.config = {
      userId: null,
      container: document.getElementById('dashboard-container') || document.body,
      refreshInterval: options.refreshInterval || 60000, // 1 minute refresh by default
      ...options
    };
    
    // State
    this.state = {
      isLoading: false,
      stats: {
        messagesCount: 0,
        activeChats: 0,
        unreadMessages: 0,
        lastActive: null
      },
      currentView: 'overview',
      recentChats: [],
      notifications: []
    };
    
    // Initialize dashboard
    this.init();
  }
  
  /**
   * Initialize the dashboard
   */
  async init() {
    try {
      this.config.userId = app.getCurrentUserId();
      this.registerEventListeners();
      await this.loadDashboardData();
      this.setupRefreshInterval();
      this.render();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize dashboard');
    }
  }
  
  /**
   * Register event listeners
   */
  registerEventListeners() {
    eventBus.on('user:statusChanged', this.handleUserStatusChange.bind(this));
    eventBus.on('message:new', this.handleNewMessage.bind(this));
    eventBus.on('notification:new', this.handleNewNotification.bind(this));
    
    // DOM event listeners
    const container = this.config.container;
    container.addEventListener('click', this.handleContainerClick.bind(this));
  }
  
  /**
   * Load dashboard data from API
   */
  async loadDashboardData() {
    try {
      this.state.isLoading = true;
      this.updateUI();
      
      // Fetch dashboard data in parallel
      const [statsResponse, recentChatsResponse, notificationsResponse] = await Promise.all([
        apiClient.get('/api/users/stats?userId=' + this.config.userId),
        apiClient.get('/api/messages/recent?userId=' + this.config.userId),
        apiClient.get('/api/users/notifications?userId=' + this.config.userId)
      ]);
      
      // Update state with fetched data
      this.state.stats = statsResponse.data;
      this.state.recentChats = recentChatsResponse.data;
      this.state.notifications = notificationsResponse.data;
      
      // Store in state management
      state.set('dashboard.stats', this.state.stats);
      state.set('dashboard.recentChats', this.state.recentChats);
      
      this.state.isLoading = false;
      this.updateUI();
      
      // Emit events
      eventBus.emit('dashboard:loaded', { 
        stats: this.state.stats,
        recentChats: this.state.recentChats
      });
      
    } catch (error) {
      this.state.isLoading = false;
      this.updateUI();
      errorHandler.handleError(error, 'Failed to load dashboard data');
    }
  }
  
  /**
   * Setup automatic refresh interval
   */
  setupRefreshInterval() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Set up new interval
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, this.config.refreshInterval);
  }
  
  /**
   * Render the dashboard UI
   */
  render() {
    const container = this.config.container;
    
    // Show loading state if needed
    if (this.state.isLoading) {
      container.innerHTML = '<div class="loading-spinner">Loading dashboard...</div>';
      return;
    }
    
    // Render dashboard content
    container.innerHTML = `
      <div class="dashboard-header">
        <h1>Welcome to your Dashboard</h1>
        <div class="dashboard-controls">
          <button id="refresh-dashboard" class="btn">Refresh</button>
          <select id="dashboard-view-selector">
            <option value="overview" ${this.state.currentView === 'overview' ? 'selected' : ''}>Overview</option>
            <option value="messages" ${this.state.currentView === 'messages' ? 'selected' : ''}>Messages</option>
            <option value="activity" ${this.state.currentView === 'activity' ? 'selected' : ''}>Activity</option>
          </select>
        </div>
      </div>
      
      <div class="dashboard-stats">
        <div class="stat-card">
          <h3>Messages</h3>
          <div class="stat-value">${this.state.stats.messagesCount}</div>
        </div>
        <div class="stat-card">
          <h3>Active Chats</h3>
          <div class="stat-value">${this.state.stats.activeChats}</div>
        </div>
        <div class="stat-card">
          <h3>Unread</h3>
          <div class="stat-value">${this.state.stats.unreadMessages}</div>
        </div>
        <div class="stat-card">
          <h3>Last Active</h3>
          <div class="stat-value">${this.formatLastActive(this.state.stats.lastActive)}</div>
        </div>
      </div>
      
      <div class="dashboard-content">
        ${this.renderCurrentView()}
      </div>
    `;
    
    // Setup event listeners after rendering
    this.setupUIEventListeners();
  }
  
  /**
   * Render the current selected view
   */
  renderCurrentView() {
    switch (this.state.currentView) {
      case 'messages':
        return this.renderMessagesView();
      case 'activity':
        return this.renderActivityView();
      case 'overview':
      default:
        return this.renderOverviewView();
    }
  }
  
  /**
   * Render the overview dashboard view
   */
  renderOverviewView() {
    return `
      <div class="dashboard-overview">
        <div class="recent-chats">
          <h2>Recent Conversations</h2>
          <div class="chat-list">
            ${this.renderRecentChats()}
          </div>
        </div>
        
        <div class="notifications-panel">
          <h2>Notifications</h2>
          <div class="notification-list">
            ${this.renderNotifications()}
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Render recent chats list
   */
  renderRecentChats() {
    if (this.state.recentChats.length === 0) {
      return '<div class="empty-state">No recent conversations</div>';
    }
    
    return this.state.recentChats.map(chat => `
      <div class="chat-item" data-chat-id="${chat.id}" data-chat-type="${chat.type}">
        <div class="chat-avatar">
          <img src="${chat.avatar || '/assets/images/default-avatar.svg'}" alt="${chat.name}">
          ${chat.isOnline ? '<span class="status-indicator online"></span>' : ''}
        </div>
        <div class="chat-details">
          <div class="chat-name">${chat.name}</div>
          <div class="chat-last-message">${chat.lastMessage || 'No messages yet'}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${this.formatTime(chat.lastMessageTime)}</div>
          ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  /**
   * Render notifications list
   */
  renderNotifications() {
    if (this.state.notifications.length === 0) {
      return '<div class="empty-state">No notifications</div>';
    }
    
    return this.state.notifications.map(notification => `
      <div class="notification-item ${notification.read ? '' : 'unread'}" data-notification-id="${notification.id}">
        <div class="notification-icon">
          <i class="${this.getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${this.formatTime(notification.time)}</div>
        </div>
        ${!notification.read ? '<button class="mark-read-btn">Mark Read</button>' : ''}
      </div>
    `).join('');
  }
  
  /**
   * Render messages view
   */
  renderMessagesView() {
    return `
      <div class="messages-view">
        <h2>Your Messages</h2>
        <div class="message-filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="unread">Unread</button>
          <button class="filter-btn" data-filter="groups">Groups</button>
          <button class="filter-btn" data-filter="direct">Direct</button>
        </div>
        
        <div class="messages-list">
          ${this.renderAllMessages()}
        </div>
      </div>
    `;
  }
  
  /**
   * Render activity view
   */
  renderActivityView() {
    return `
      <div class="activity-view">
        <h2>Recent Activity</h2>
        <div class="activity-timeline">
          ${this.renderActivityTimeline()}
        </div>
      </div>
    `;
  }
  
  /**
   * Render all messages for messages view
   */
  renderAllMessages() {
    // Implementation similar to renderRecentChats but with more detailed information
    return this.renderRecentChats(); // Simplified for now
  }
  
  /**
   * Render activity timeline
   */
  renderActivityTimeline() {
    // Placeholder for activity timeline
    return '<div class="empty-state">Activity timeline will be displayed here</div>';
  }
  
  /**
   * Setup UI event listeners after rendering
   */
  setupUIEventListeners() {
    const container = this.config.container;
    
    // Refresh button
    const refreshBtn = container.querySelector('#refresh-dashboard');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadDashboardData());
    }
    
    // View selector
    const viewSelector = container.querySelector('#dashboard-view-selector');
    if (viewSelector) {
      viewSelector.addEventListener('change', (e) => {
        this.state.currentView = e.target.value;
        this.updateUI();
      });
    }
    
    // Chat item click
    const chatItems = container.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const chatId = e.currentTarget.dataset.chatId;
        const chatType = e.currentTarget.dataset.chatType;
        this.openChat(chatId, chatType);
      });
    });
    
    // Notification mark read
    const markReadBtns = container.querySelectorAll('.mark-read-btn');
    markReadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const notificationId = e.target.closest('.notification-item').dataset.notificationId;
        this.markNotificationAsRead(notificationId);
      });
    });
  }
  
  /**
   * Update UI based on current state
   */
  updateUI() {
    this.render();
  }
  
  /**
   * Handle container click events
   */
  handleContainerClick(e) {
    // General click handler for delegation
  }
  
  /**
   * Handle user status change
   */
  handleUserStatusChange(data) {
    // Update UI if needed based on user status changes
    const userId = data.userId;
    const status = data.status;
    
    // Update recent chats if the user is in the list
    this.state.recentChats = this.state.recentChats.map(chat => {
      if (chat.type === 'direct' && chat.userId === userId) {
        return { ...chat, isOnline: status === 'online' };
      }
      return chat;
    });
    
    this.updateUI();
  }
  
  /**
   * Handle new message event
   */
  handleNewMessage(data) {
    // Update unread counts and recent messages
    const { chatId, chatType, message } = data;
    
    // Update stats
    this.state.stats.messagesCount++;
    this.state.stats.unreadMessages++;
    
    // Update recent chats
    let chatUpdated = false;
    this.state.recentChats = this.state.recentChats.map(chat => {
      if (chat.id === chatId) {
        chatUpdated = true;
        return {
          ...chat,
          lastMessage: message.text,
          lastMessageTime: message.time,
          unreadCount: chat.unreadCount + 1
        };
      }
      return chat;
    });
    
    // If chat not in list, fetch it and add to the top
    if (!chatUpdated) {
      this.fetchChatInfo(chatId, chatType).then(chatInfo => {
        if (chatInfo) {
          this.state.recentChats.unshift(chatInfo);
          this.updateUI();
        }
      });
    } else {
      this.updateUI();
    }
  }
  
  /**
   * Handle new notification
   */
  handleNewNotification(data) {
    // Add to notifications list
    this.state.notifications.unshift(data);
    this.updateUI();
  }
  
  /**
   * Fetch chat information
   */
  async fetchChatInfo(chatId, chatType) {
    try {
      const endpoint = chatType === 'group' ? 
        `/api/groups/${chatId}` : 
        `/api/users/${chatId}`;
        
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to fetch chat information');
      return null;
    }
  }
  
  /**
   * Open a chat conversation
   */
  openChat(chatId, chatType) {
    // Navigate to the appropriate chat page
    let url = chatType === 'group' ? 
      `/group-chat.php?id=${chatId}` : 
      `/private-chat.php?id=${chatId}`;
      
    window.location.href = url;
  }
  
  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId) {
    try {
      await apiClient.post('/api/users/notifications/read', {
        notificationId,
        userId: this.config.userId
      });
      
      // Update local state
      this.state.notifications = this.state.notifications.map(notification => {
        if (notification.id === notificationId) {
          return { ...notification, read: true };
        }
        return notification;
      });
      
      this.updateUI();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to mark notification as read');
    }
  }
  
  /**
   * Format last active time
   */
  formatLastActive(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
  
  /**
   * Format time for display
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isYesterday) {
      return 'Yesterday';
    }
    
    return date.toLocaleDateString();
  }
  
  /**
   * Get notification icon based on type
   */
  getNotificationIcon(type) {
    const icons = {
      message: 'icon-message',
      friend: 'icon-user',
      group: 'icon-users',
      system: 'icon-info',
      alert: 'icon-alert'
    };
    
    return icons[type] || 'icon-bell';
  }
  
  /**
   * Cleanup resources when module is destroyed
   */
  destroy() {
    // Clear interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Remove event listeners
    eventBus.off('user:statusChanged', this.handleUserStatusChange);
    eventBus.off('message:new', this.handleNewMessage);
    eventBus.off('notification:new', this.handleNewNotification);
    
    // Clean up DOM listeners
    const container = this.config.container;
    if (container) {
      container.removeEventListener('click', this.handleContainerClick);
    }
  }
}

// Export singleton instance
export default DashboardModule;

// For backwards compatibility with legacy code
if (typeof window !== 'undefined') {
  window.DashboardModule = DashboardModule;
}
