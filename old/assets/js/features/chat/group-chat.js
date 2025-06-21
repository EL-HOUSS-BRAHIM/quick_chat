/**
 * Group Chat Module
 * Handles group chat functionality
 */

import ChatModule from './index.js';
import ThreadManager from './thread-manager.js';
import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class GroupChat extends ChatModule {
  constructor() {
    super();
    
    // Group-specific properties
    this.groupId = null;
    this.groupInfo = {};
    this.groupMembers = [];
    this.userRoles = {};
    this.threadManager = null;
    
    // Bind methods
    this.loadGroupInfo = this.loadGroupInfo.bind(this);
    this.loadGroupMembers = this.loadGroupMembers.bind(this);
    this.initThreadSupport = this.initThreadSupport.bind(this);
    this.handleThreadButtonClick = this.handleThreadButtonClick.bind(this);
    
    // Call init() from parent class
  }
  
  /**
   * Initialize group chat module
   * @param {Object} options - Group chat options
   */
  async init(options = {}) {
    // Call parent init method
    await super.init(options);
    
    // Set group ID
    this.groupId = options.groupId || this.getGroupIdFromUrl();
    
    if (this.groupId) {
      // Load group info
      await this.loadGroupInfo();
      
      // Load group members
      await this.loadGroupMembers();
      
      // Initialize thread support
      this.initThreadSupport();
      
      // Publish group chat loaded event
      eventBus.publish('group:loaded', {
        groupId: this.groupId,
        groupInfo: this.groupInfo
      });
    } else {
      console.error('No group ID provided');
      eventBus.publish('error', {
        message: 'No group ID provided'
      });
    }
  }
  
  /**
   * Load chat with a specific group
   * @param {Object} data Group chat data
   */
  async loadChat(data) {
    this.groupId = data.groupId || this.groupId;
    
    // Call parent loadChat method
    await super.loadChat({
      ...data,
      chatType: 'group'
    });
    
    // Load group info
    await this.loadGroupInfo();
    
    // Load group members
    await this.loadGroupMembers();
  }
  
  /**
   * Load group information
   */
  async loadGroupInfo() {
    try {
      const response = await apiClient.get(`/api/v1/groups/${this.groupId}`);
      
      if (response && response.success) {
        this.groupInfo = response.group;
        
        // Update UI with group info
        this.updateGroupInfoUI();
      } else {
        throw new Error(response.error || 'Failed to load group info');
      }
    } catch (error) {
      console.error('Failed to load group info:', error);
      eventBus.publish('error', {
        message: 'Failed to load group info',
        error
      });
    }
  }
  
  /**
   * Load group members
   */
  async loadGroupMembers() {
    try {
      const response = await apiClient.get(`/api/v1/groups/${this.groupId}/members`);
      
      if (response && response.success) {
        this.groupMembers = response.members;
        this.userRoles = response.roles || {};
        
        // Update UI with group members
        this.updateGroupMembersUI();
      } else {
        throw new Error(response.error || 'Failed to load group members');
      }
    } catch (error) {
      console.error('Failed to load group members:', error);
      eventBus.publish('error', {
        message: 'Failed to load group members',
        error
      });
    }
  }
  
  /**
   * Update group info in the UI
   */
  updateGroupInfoUI() {
    // Update chat header
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader && this.groupInfo) {
      chatHeader.innerHTML = `
        <div class="chat-header-avatar">
          <img src="${this.groupInfo.avatar || '/assets/images/group-avatar.png'}" alt="${this.groupInfo.name}">
        </div>
        <div class="chat-header-info">
          <h3>${this.groupInfo.name}</h3>
          <p>${this.groupMembers.length} members</p>
        </div>
        <div class="chat-header-actions">
          <button class="group-info-btn" id="groupInfoBtn">
            <i class="fas fa-info-circle"></i>
          </button>
        </div>
      `;
      
      // Add event listener to group info button
      const groupInfoBtn = document.getElementById('groupInfoBtn');
      if (groupInfoBtn) {
        groupInfoBtn.addEventListener('click', () => {
          eventBus.publish('group:info:show', {
            groupId: this.groupId,
            groupInfo: this.groupInfo
          });
        });
      }
    }
  }
  
  /**
   * Update group members in the UI
   */
  updateGroupMembersUI() {
    // Implementation depends on the UI design
  }
  
  /**
   * Get group ID from URL
   * @returns {string|null} Group ID from URL or null
   */
  getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('group');
  }
  
  /**
   * Initialize thread support for group chat
   */
  initThreadSupport() {
    // Create thread manager if it doesn't exist
    if (!this.threadManager) {
      this.threadManager = new ThreadManager();
    }
    
    // Add thread button to message actions
    document.addEventListener('message:rendered', (event) => {
      const messageElement = event.detail.element;
      
      if (messageElement) {
        const messageActions = messageElement.querySelector('.message-actions');
        
        if (messageActions && !messageActions.querySelector('.thread-btn')) {
          const threadBtn = document.createElement('button');
          threadBtn.className = 'message-action thread-btn';
          threadBtn.innerHTML = '<i class="fas fa-comments"></i>';
          threadBtn.title = 'Reply in Thread';
          threadBtn.dataset.messageId = messageElement.dataset.id;
          
          threadBtn.addEventListener('click', this.handleThreadButtonClick);
          
          messageActions.appendChild(threadBtn);
        }
      }
    });
  }
  
  /**
   * Handle thread button click
   * @param {Event} event - Click event
   */
  handleThreadButtonClick(event) {
    const messageId = event.currentTarget.dataset.messageId;
    const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
    
    if (messageId && messageElement) {
      eventBus.publish('thread:open', {
        messageId,
        element: messageElement
      });
    }
  }
  
  /**
   * Override sendMessage to include group ID
   * @param {string} content - Message content
   * @param {Object} options - Additional options
   */
  async sendMessage(content, options = {}) {
    // Add group ID to options
    const groupOptions = {
      ...options,
      groupId: this.groupId,
      chatType: 'group'
    };
    
    // Call parent sendMessage method
    await super.sendMessage(content, groupOptions);
  }
}

export default GroupChat;
