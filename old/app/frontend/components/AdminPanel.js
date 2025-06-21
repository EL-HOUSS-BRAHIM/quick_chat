/**
 * AdminPanel Component
 * 
 * Provides administrative interface for managing users, groups, and system settings
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import Modal from './ui/Modal.js';
import LoadingIndicator from './ui/LoadingIndicator.js';

export class AdminPanel {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      ...options
    };

    this.eventBus = new EventBus();
    this.modal = new Modal();
    this.loadingIndicator = new LoadingIndicator();
    this.element = null;
    this.currentTab = 'users';
    this.data = {
      users: [],
      groups: [],
      logs: [],
      stats: {}
    };
  }

  /**
   * Initialize the admin panel
   */
  async init() {
    try {
      await this.modal.init();
      this.createElement();
      this.setupEventListeners();
      await this.loadInitialData();
      this.render();
      
      logger.debug('Admin panel initialized');
    } catch (error) {
      logger.error('Failed to initialize admin panel:', error);
      this.showError('Failed to load admin panel');
    }
  }

  /**
   * Create the main element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'admin-panel';
    this.container.appendChild(this.element);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus.on('admin:refresh', () => {
      this.loadInitialData();
    });

    this.eventBus.on('user:banned', () => {
      this.loadUsers();
    });

    this.eventBus.on('group:deleted', () => {
      this.loadGroups();
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.showLoading();
      
      await Promise.all([
        this.loadUsers(),
        this.loadGroups(),
        this.loadStats(),
        this.loadLogs()
      ]);
      
      this.hideLoading();
      this.render();
    } catch (error) {
      logger.error('Failed to load admin data:', error);
      this.hideLoading();
      this.showError('Failed to load admin data');
    }
  }

  /**
   * Load users
   */
  async loadUsers() {
    try {
      const response = await apiClient.get('/api/admin/users');
      this.data.users = response.data;
    } catch (error) {
      logger.error('Failed to load users:', error);
      throw error;
    }
  }

  /**
   * Load groups
   */
  async loadGroups() {
    try {
      const response = await apiClient.get('/api/admin/groups');
      this.data.groups = response.data;
    } catch (error) {
      logger.error('Failed to load groups:', error);
      throw error;
    }
  }

  /**
   * Load system stats
   */
  async loadStats() {
    try {
      const response = await apiClient.get('/api/admin/stats');
      this.data.stats = response.data;
    } catch (error) {
      logger.error('Failed to load stats:', error);
      throw error;
    }
  }

  /**
   * Load system logs
   */
  async loadLogs() {
    try {
      const response = await apiClient.get('/api/admin/logs');
      this.data.logs = response.data;
    } catch (error) {
      logger.error('Failed to load logs:', error);
      throw error;
    }
  }

  /**
   * Render the admin panel
   */
  render() {
    this.element.innerHTML = `
      <div class="admin-container">
        <div class="admin-header">
          <h1>Administration Panel</h1>
          <div class="admin-actions">
            <button class="btn btn-primary refresh-btn">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>
        
        ${this.renderTabs()}
        
        <div class="admin-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Render tabs
   */
  renderTabs() {
    const tabs = [
      { id: 'users', label: 'Users', icon: 'fas fa-users' },
      { id: 'groups', label: 'Groups', icon: 'fas fa-comments' },
      { id: 'stats', label: 'Statistics', icon: 'fas fa-chart-bar' },
      { id: 'logs', label: 'Logs', icon: 'fas fa-file-alt' },
      { id: 'settings', label: 'Settings', icon: 'fas fa-cog' }
    ];

    return `
      <div class="admin-tabs">
        ${tabs.map(tab => `
          <button class="tab-btn ${this.currentTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            <i class="${tab.icon}"></i>
            ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render tab content based on current tab
   */
  renderTabContent() {
    switch (this.currentTab) {
      case 'users':
        return this.renderUsersTab();
      case 'groups':
        return this.renderGroupsTab();
      case 'stats':
        return this.renderStatsTab();
      case 'logs':
        return this.renderLogsTab();
      case 'settings':
        return this.renderSettingsTab();
      default:
        return '<div>Select a tab</div>';
    }
  }

  /**
   * Render users tab
   */
  renderUsersTab() {
    return `
      <div class="tab-content users-tab">
        <div class="tab-header">
          <h2>User Management</h2>
          <div class="tab-actions">
            <input type="search" placeholder="Search users..." class="search-input" id="user-search">
            <button class="btn btn-success add-user-btn">
              <i class="fas fa-plus"></i> Add User
            </button>
          </div>
        </div>
        
        <div class="users-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.data.users.map(user => this.renderUserRow(user)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Render user row
   */
  renderUserRow(user) {
    return `
      <tr data-user-id="${user.id}">
        <td>
          <img src="${user.avatar || '/assets/images/default-avatar.png'}" 
               alt="Avatar" class="user-avatar-small">
        </td>
        <td>
          <div class="user-info">
            <strong>${helpers.escapeHtml(user.display_name || user.username)}</strong>
            <small>@${helpers.escapeHtml(user.username)}</small>
          </div>
        </td>
        <td>${helpers.escapeHtml(user.email || 'N/A')}</td>
        <td>
          <span class="status-badge ${user.is_banned ? 'banned' : (user.is_online ? 'online' : 'offline')}">
            ${user.is_banned ? 'Banned' : (user.is_online ? 'Online' : 'Offline')}
          </span>
        </td>
        <td>${helpers.formatDate(user.created_at)}</td>
        <td>${user.last_seen ? helpers.timeAgo(user.last_seen) : 'Never'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary view-user-btn" data-user-id="${user.id}">
              <i class="fas fa-eye"></i>
            </button>
            ${user.is_banned ? 
              `<button class="btn btn-sm btn-success unban-user-btn" data-user-id="${user.id}">
                <i class="fas fa-unlock"></i>
              </button>` :
              `<button class="btn btn-sm btn-warning ban-user-btn" data-user-id="${user.id}">
                <i class="fas fa-ban"></i>
              </button>`
            }
            <button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${user.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render groups tab
   */
  renderGroupsTab() {
    return `
      <div class="tab-content groups-tab">
        <div class="tab-header">
          <h2>Group Management</h2>
          <div class="tab-actions">
            <input type="search" placeholder="Search groups..." class="search-input" id="group-search">
          </div>
        </div>
        
        <div class="groups-grid">
          ${this.data.groups.map(group => this.renderGroupCard(group)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render group card
   */
  renderGroupCard(group) {
    return `
      <div class="group-card" data-group-id="${group.id}">
        <div class="group-header">
          <img src="${group.avatar || '/assets/images/default-group.png'}" 
               alt="Group Avatar" class="group-avatar">
          <div class="group-info">
            <h3>${helpers.escapeHtml(group.name)}</h3>
            <p>${helpers.escapeHtml(group.description || 'No description')}</p>
          </div>
        </div>
        
        <div class="group-stats">
          <div class="stat">
            <strong>${group.member_count || 0}</strong>
            <span>Members</span>
          </div>
          <div class="stat">
            <strong>${group.message_count || 0}</strong>
            <span>Messages</span>
          </div>
        </div>
        
        <div class="group-meta">
          <small>Created ${helpers.timeAgo(group.created_at)}</small>
          <small>By ${helpers.escapeHtml(group.creator_name)}</small>
        </div>
        
        <div class="group-actions">
          <button class="btn btn-sm btn-secondary view-group-btn" data-group-id="${group.id}">
            <i class="fas fa-eye"></i> View
          </button>
          <button class="btn btn-sm btn-danger delete-group-btn" data-group-id="${group.id}">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render stats tab
   */
  renderStatsTab() {
    const stats = this.data.stats;
    
    return `
      <div class="tab-content stats-tab">
        <div class="tab-header">
          <h2>System Statistics</h2>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-users"></i>
            </div>
            <div class="stat-info">
              <h3>${stats.total_users || 0}</h3>
              <p>Total Users</p>
              <small>${stats.active_users || 0} active today</small>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-comments"></i>
            </div>
            <div class="stat-info">
              <h3>${stats.total_groups || 0}</h3>
              <p>Total Groups</p>
              <small>${stats.active_groups || 0} active today</small>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-envelope"></i>
            </div>
            <div class="stat-info">
              <h3>${stats.total_messages || 0}</h3>
              <p>Total Messages</p>
              <small>${stats.messages_today || 0} sent today</small>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">
              <i class="fas fa-file"></i>
            </div>
            <div class="stat-info">
              <h3>${stats.total_files || 0}</h3>
              <p>Files Uploaded</p>
              <small>${helpers.formatBytes(stats.storage_used || 0)} used</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render logs tab
   */
  renderLogsTab() {
    return `
      <div class="tab-content logs-tab">
        <div class="tab-header">
          <h2>System Logs</h2>
          <div class="tab-actions">
            <select id="log-level-filter">
              <option value="">All Levels</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
        
        <div class="logs-container">
          <table class="admin-table logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Level</th>
                <th>Message</th>
                <th>User</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              ${this.data.logs.map(log => this.renderLogRow(log)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * Render log row
   */
  renderLogRow(log) {
    return `
      <tr class="log-row log-${log.level}">
        <td>${helpers.formatDateTime(log.timestamp)}</td>
        <td>
          <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
        </td>
        <td>${helpers.escapeHtml(log.message)}</td>
        <td>${log.user ? helpers.escapeHtml(log.user) : 'System'}</td>
        <td>${log.ip || 'N/A'}</td>
      </tr>
    `;
  }

  /**
   * Render settings tab
   */
  renderSettingsTab() {
    return `
      <div class="tab-content settings-tab">
        <div class="tab-header">
          <h2>System Settings</h2>
        </div>
        
        <div class="settings-sections">
          <div class="setting-section">
            <h3>General Settings</h3>
            <div class="setting-group">
              <div class="setting-item">
                <label>Site Name</label>
                <input type="text" value="QuickChat" class="setting-input">
              </div>
              <div class="setting-item">
                <label>Max File Size (MB)</label>
                <input type="number" value="10" class="setting-input">
              </div>
              <div class="setting-item">
                <label>Max Group Members</label>
                <input type="number" value="100" class="setting-input">
              </div>
            </div>
          </div>
          
          <div class="setting-section">
            <h3>Security Settings</h3>
            <div class="setting-group">
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" checked>
                  <span class="checkmark"></span>
                  Require Email Verification
                </label>
              </div>
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox">
                  <span class="checkmark"></span>
                  Enable Rate Limiting
                </label>
              </div>
              <div class="setting-item">
                <label class="checkbox-label">
                  <input type="checkbox" checked>
                  <span class="checkmark"></span>
                  Log User Actions
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-actions">
          <button class="btn btn-primary save-settings-btn">Save Settings</button>
          <button class="btn btn-secondary reset-settings-btn">Reset to Defaults</button>
        </div>
      </div>
    `;
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Tab switching
    this.element.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Refresh button
    const refreshBtn = this.element.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadInitialData();
      });
    }

    // User actions
    this.bindUserActions();
    
    // Group actions
    this.bindGroupActions();
    
    // Search functionality
    this.bindSearchActions();
  }

  /**
   * Bind user action handlers
   */
  bindUserActions() {
    // Ban user
    this.element.querySelectorAll('.ban-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.banUser(userId);
      });
    });

    // Unban user
    this.element.querySelectorAll('.unban-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.unbanUser(userId);
      });
    });

    // Delete user
    this.element.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.deleteUser(userId);
      });
    });

    // View user
    this.element.querySelectorAll('.view-user-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.viewUser(userId);
      });
    });
  }

  /**
   * Bind group action handlers
   */
  bindGroupActions() {
    // Delete group
    this.element.querySelectorAll('.delete-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupId = e.target.dataset.groupId;
        this.deleteGroup(groupId);
      });
    });

    // View group
    this.element.querySelectorAll('.view-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupId = e.target.dataset.groupId;
        this.viewGroup(groupId);
      });
    });
  }

  /**
   * Bind search actions
   */
  bindSearchActions() {
    const userSearch = this.element.querySelector('#user-search');
    if (userSearch) {
      userSearch.addEventListener('input', (e) => {
        this.filterUsers(e.target.value);
      });
    }

    const groupSearch = this.element.querySelector('#group-search');
    if (groupSearch) {
      groupSearch.addEventListener('input', (e) => {
        this.filterGroups(e.target.value);
      });
    }
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    this.currentTab = tabName;
    this.render();
  }

  /**
   * Ban user
   */
  async banUser(userId) {
    const confirmed = await this.modal.confirm(
      'Are you sure you want to ban this user?',
      'Ban User'
    );

    if (confirmed) {
      try {
        await apiClient.post(`/api/admin/users/${userId}/ban`);
        this.showSuccess('User banned successfully');
        this.loadUsers();
      } catch (error) {
        logger.error('Failed to ban user:', error);
        this.showError('Failed to ban user');
      }
    }
  }

  /**
   * Unban user
   */
  async unbanUser(userId) {
    try {
      await apiClient.post(`/api/admin/users/${userId}/unban`);
      this.showSuccess('User unbanned successfully');
      this.loadUsers();
    } catch (error) {
      logger.error('Failed to unban user:', error);
      this.showError('Failed to unban user');
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    const confirmed = await this.modal.confirm(
      'Are you sure you want to delete this user? This action cannot be undone.',
      'Delete User'
    );

    if (confirmed) {
      try {
        await apiClient.delete(`/api/admin/users/${userId}`);
        this.showSuccess('User deleted successfully');
        this.loadUsers();
      } catch (error) {
        logger.error('Failed to delete user:', error);
        this.showError('Failed to delete user');
      }
    }
  }

  /**
   * View user details
   */
  viewUser(userId) {
    const user = this.data.users.find(u => u.id == userId);
    if (user) {
      const content = `
        <div class="user-details">
          <img src="${user.avatar || '/assets/images/default-avatar.png'}" alt="Avatar" class="user-avatar">
          <h3>${helpers.escapeHtml(user.display_name || user.username)}</h3>
          <p><strong>Username:</strong> @${helpers.escapeHtml(user.username)}</p>
          <p><strong>Email:</strong> ${helpers.escapeHtml(user.email || 'N/A')}</p>
          <p><strong>Joined:</strong> ${helpers.formatDate(user.created_at)}</p>
          <p><strong>Last Seen:</strong> ${user.last_seen ? helpers.timeAgo(user.last_seen) : 'Never'}</p>
          <p><strong>Status:</strong> ${user.is_banned ? 'Banned' : (user.is_online ? 'Online' : 'Offline')}</p>
        </div>
      `;

      this.modal.show(content, {
        title: 'User Details',
        buttons: [
          {
            text: 'Close',
            class: 'btn-secondary',
            action: 'close',
            handler: () => this.modal.hide()
          }
        ]
      });
    }
  }

  /**
   * Delete group
   */
  async deleteGroup(groupId) {
    const confirmed = await this.modal.confirm(
      'Are you sure you want to delete this group? This action cannot be undone.',
      'Delete Group'
    );

    if (confirmed) {
      try {
        await apiClient.delete(`/api/admin/groups/${groupId}`);
        this.showSuccess('Group deleted successfully');
        this.loadGroups();
      } catch (error) {
        logger.error('Failed to delete group:', error);
        this.showError('Failed to delete group');
      }
    }
  }

  /**
   * View group details
   */
  viewGroup(groupId) {
    const group = this.data.groups.find(g => g.id == groupId);
    if (group) {
      // Implementation for viewing group details
      logger.info('View group:', groupId);
    }
  }

  /**
   * Filter users by search term
   */
  filterUsers(searchTerm) {
    const rows = this.element.querySelectorAll('.users-table-container tr');
    rows.forEach((row, index) => {
      if (index === 0) return; // Skip header
      
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
  }

  /**
   * Filter groups by search term
   */
  filterGroups(searchTerm) {
    const cards = this.element.querySelectorAll('.group-card');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.loadingIndicator.show(this.element);
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.loadingIndicator.hide();
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.eventBus.emit('notification:show', {
      type: 'success',
      message
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    this.eventBus.emit('notification:show', {
      type: 'error',
      message
    });
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.modal.destroy();
  }
}

export default AdminPanel;
