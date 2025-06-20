/**
 * Sidebar Component - Organized Architecture
 * 
 * Displays chat information, member lists, and additional features
 * Shows different content based on chat type (private vs group)
 * Migrated from assets/js/features/chat/group-info.js
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { userStore } from '../state/userStore.js';
import { chatStore } from '../state/chatStore.js';
import { logger } from '../utils/logger.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';

export class Sidebar {
  constructor(config = {}) {
    this.config = {
      container: config.container,
      chatType: config.chatType,
      chatId: config.chatId,
      currentUserId: config.currentUserId,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.chatInfo = null;
    this.members = [];
    this.initialized = false;
  }

  /**
   * Initialize the sidebar
   */
  async init() {
    try {
      logger.info('Initializing Sidebar');

      this.container = this.config.container;
      this.setupDOM();
      this.setupEventListeners();
      
      // Load initial data
      await this.loadData();
      
      this.initialized = true;
      this.eventBus.emit('sidebar:initialized');

    } catch (error) {
      logger.error('Failed to initialize Sidebar:', error);
      throw error;
    }
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    this.container.innerHTML = `
      <div class="chat-sidebar">
        <div class="sidebar-header">
          <h3>${this.config.chatType === 'group' ? 'Group Info' : 'User Info'}</h3>
          <button class="sidebar-close" id="sidebar-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="sidebar-content">
          <div class="chat-info-section" id="chat-info">
            <!-- Chat information will be loaded here -->
          </div>
          
          ${this.config.chatType === 'group' ? `
          <div class="members-section">
            <h4>Members <span class="member-count" id="member-count">0</span></h4>
            <div class="members-list" id="members-list">
              <!-- Members will be loaded here -->
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    // Get DOM element references
    this.chatInfoSection = this.container.querySelector('#chat-info');
    this.membersSection = this.container.querySelector('#members-list');
    this.memberCount = this.container.querySelector('#member-count');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    const closeBtn = this.container.querySelector('#sidebar-close');
    closeBtn?.addEventListener('click', () => {
      this.eventBus.emit('sidebar:close');
    });
  }

  /**
   * Load initial data
   */
  async loadData() {
    try {
      // Load chat information
      await this.loadChatInfo();

      // Load members if group chat
      if (this.config.chatType === 'group') {
        await this.loadMembers();
      }

    } catch (error) {
      logger.error('Failed to load sidebar data:', error);
    }
  }

  /**
   * Load chat information
   */
  async loadChatInfo() {
    try {
      let chatInfo;

      if (this.config.chatType === 'group') {
        chatInfo = await apiClient.getGroup(this.config.chatId);
      } else {
        chatInfo = await apiClient.getUser(this.config.chatId);
      }

      this.chatInfo = chatInfo;
      this.renderChatInfo(chatInfo);

    } catch (error) {
      logger.error('Failed to load chat info:', error);
    }
  }

  /**
   * Load group members
   */
  async loadMembers() {
    if (this.config.chatType !== 'group') {
      return;
    }

    try {
      const response = await apiClient.get(`/groups/${this.config.chatId}/members`);
      this.members = response.members || [];
      this.renderMembers();

    } catch (error) {
      logger.error('Failed to load members:', error);
    }
  }

  /**
   * Render chat information
   */
  renderChatInfo(info) {
    if (!this.chatInfoSection) return;

    if (this.config.chatType === 'group') {
      this.chatInfoSection.innerHTML = `
        <div class="group-info">
          <div class="group-avatar">
            <img src="${escapeHtml(info.avatar_url || '/assets/images/default-group.png')}" 
                 alt="${escapeHtml(info.name)}">
          </div>
          
          <div class="group-details">
            <h3 class="group-name">${escapeHtml(info.name)}</h3>
            <p class="group-description">${escapeHtml(info.description || 'No description')}</p>
          </div>
        </div>
      `;
    } else {
      this.chatInfoSection.innerHTML = `
        <div class="user-info">
          <div class="user-avatar">
            <img src="${escapeHtml(info.avatar_url || '/assets/images/default-avatar.png')}" 
                 alt="${escapeHtml(info.display_name || info.username)}">
            <div class="status-indicator ${info.is_online ? 'online' : 'offline'}"></div>
          </div>
          
          <div class="user-details">
            <h3 class="user-name">${escapeHtml(info.display_name || info.username)}</h3>
            <p class="user-status">${info.is_online ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      `;
    }
  }

  /**
   * Render group members
   */
  renderMembers() {
    if (!this.membersSection || this.config.chatType !== 'group') {
      return;
    }

    // Update member count
    if (this.memberCount) {
      this.memberCount.textContent = this.members.length;
    }

    // Render members list
    const membersHTML = this.members.map(member => `
      <div class="member-item" data-user-id="${member.id}">
        <div class="member-avatar">
          <img src="${escapeHtml(member.avatar_url || '/assets/images/default-avatar.png')}" 
               alt="${escapeHtml(member.display_name || member.username)}">
          <div class="status-indicator ${member.is_online ? 'online' : 'offline'}"></div>
        </div>
        
        <div class="member-info">
          <div class="member-name">${escapeHtml(member.display_name || member.username)}</div>
          <div class="member-role">${escapeHtml(member.role || 'Member')}</div>
        </div>
      </div>
    `).join('');

    this.membersSection.innerHTML = membersHTML;
  }

  /**
   * Show sidebar
   */
  show() {
    this.container.style.display = 'block';
    this.container.classList.add('visible');
  }

  /**
   * Hide sidebar
   */
  hide() {
    this.container.style.display = 'none';
    this.container.classList.remove('visible');
  }

  /**
   * Toggle sidebar visibility
   */
  toggle() {
    if (this.container.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Cleanup when component is destroyed
   */
  destroy() {
    this.eventBus.emit('sidebar:destroyed');
  }
}

export default Sidebar;
