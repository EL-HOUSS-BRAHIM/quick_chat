/**
 * Group Info Module
 * Handles group chat information sidebar
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';

class GroupInfo {
  constructor() {
    this.currentGroupId = null;
    this.groupInfoSidebar = null;
    this.isLoading = false;
    
    // Bind methods
    this.toggleGroupInfo = this.toggleGroupInfo.bind(this);
    this.loadGroupMembers = this.loadGroupMembers.bind(this);
    this.setCurrentGroup = this.setCurrentGroup.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize group info module
   */
  init() {
    // Find group info sidebar
    this.groupInfoSidebar = document.getElementById('groupInfoSidebar');
    
    // Add event listeners
    const toggleBtn = document.getElementById('groupInfoToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', this.toggleGroupInfo);
    }
    
    // Subscribe to events
    eventBus.subscribe('group:info:toggle', this.toggleGroupInfo);
    eventBus.subscribe('group:selected', this.setCurrentGroup);
    eventBus.subscribe('group:members:load', this.loadGroupMembers);
  }
  
  /**
   * Toggle group info sidebar visibility
   */
  toggleGroupInfo() {
    if (!this.groupInfoSidebar) return;
    
    const isVisible = this.groupInfoSidebar.classList.contains('visible');
    
    if (isVisible) {
      this.groupInfoSidebar.classList.remove('visible');
    } else {
      this.groupInfoSidebar.classList.add('visible');
      
      // Load members if we have a group selected and they're not loaded yet
      if (this.currentGroupId) {
        this.loadGroupMembers(this.currentGroupId);
      }
    }
  }
  
  /**
   * Set current group ID
   * @param {Object} data - Data containing groupId
   */
  setCurrentGroup(data) {
    const { groupId } = data;
    this.currentGroupId = groupId;
    
    // If sidebar is visible, load members
    if (this.groupInfoSidebar && 
        this.groupInfoSidebar.classList.contains('visible') && 
        this.currentGroupId) {
      this.loadGroupMembers(this.currentGroupId);
    }
  }
  
  /**
   * Load group members from API
   * @param {number|Object} groupIdOrData - Group ID or data object containing groupId
   */
  loadGroupMembers(groupIdOrData) {
    // Allow both direct groupId or data object with groupId property
    const groupId = typeof groupIdOrData === 'object' ? 
      groupIdOrData.groupId : groupIdOrData;
    
    if (!groupId || this.isLoading) return;
    
    this.isLoading = true;
    
    // Show loading state
    if (this.groupInfoSidebar) {
      const membersContainer = this.groupInfoSidebar.querySelector('.group-members');
      if (membersContainer) {
        membersContainer.innerHTML = '<div class="loading">Loading members...</div>';
      }
    }
    
    // Fetch group members
    apiClient.get(`/groups.php?action=members&group_id=${groupId}`)
      .then(data => {
        if (data.success) {
          this.renderGroupMembers(data.members);
          
          // Also update group info if available
          if (data.group) {
            this.renderGroupInfo(data.group);
          }
        } else {
          throw new Error(data.error || 'Failed to load group members');
        }
      })
      .catch(error => {
        console.error('Error loading group members:', error);
        
        // Show error in UI
        if (this.groupInfoSidebar) {
          const membersContainer = this.groupInfoSidebar.querySelector('.group-members');
          if (membersContainer) {
            membersContainer.innerHTML = '<div class="error">Failed to load members</div>';
          }
        }
        
        // Publish error event
        eventBus.publish('error', {
          message: 'Failed to load group members',
          error
        });
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
  
  /**
   * Render group members in the sidebar
   * @param {Array} members - List of group members
   */
  renderGroupMembers(members) {
    if (!this.groupInfoSidebar) return;
    
    const membersContainer = this.groupInfoSidebar.querySelector('.group-members');
    if (!membersContainer) return;
    
    // Clear container
    membersContainer.innerHTML = '';
    
    if (!members || members.length === 0) {
      membersContainer.innerHTML = '<div class="empty">No members found</div>';
      return;
    }
    
    // Create member list
    const membersList = document.createElement('ul');
    membersList.className = 'members-list';
    
    // Add each member
    members.forEach(member => {
      const memberItem = document.createElement('li');
      memberItem.className = 'member-item';
      
      // Add admin badge if needed
      const adminBadge = member.is_admin ? 
        '<span class="admin-badge">Admin</span>' : '';
      
      // Add online status indicator
      const onlineStatus = member.online ? 
        '<span class="status-indicator online"></span>' : 
        '<span class="status-indicator offline"></span>';
      
      memberItem.innerHTML = `
        <div class="member-avatar">
          <img src="${member.avatar || 'assets/images/default-avatar.svg'}" alt="${member.username}">
          ${onlineStatus}
        </div>
        <div class="member-info">
          <div class="member-name">${member.username} ${adminBadge}</div>
          <div class="member-status">${member.online ? 'Online' : 'Offline'}</div>
        </div>
        <div class="member-actions">
          <button class="action-btn message-btn" data-user-id="${member.user_id}">
            <i class="fas fa-comment"></i>
          </button>
        </div>
      `;
      
      // Add click handler for messaging
      const messageBtn = memberItem.querySelector('.message-btn');
      if (messageBtn) {
        messageBtn.addEventListener('click', () => {
          eventBus.publish('chat:private:open', { userId: member.user_id });
        });
      }
      
      membersList.appendChild(memberItem);
    });
    
    membersContainer.appendChild(membersList);
  }
  
  /**
   * Render group info in the sidebar
   * @param {Object} group - Group data
   */
  renderGroupInfo(group) {
    if (!this.groupInfoSidebar) return;
    
    const groupHeader = this.groupInfoSidebar.querySelector('.group-info-header');
    if (!groupHeader) return;
    
    // Update group name and image
    groupHeader.innerHTML = `
      <div class="group-avatar">
        <img src="${group.avatar || 'assets/images/default-group.svg'}" alt="${group.name}">
      </div>
      <div class="group-details">
        <h2 class="group-name">${group.name}</h2>
        <p class="group-description">${group.description || 'No description'}</p>
        <div class="group-meta">
          <span>${group.member_count || 0} members</span>
          <span>Created ${new Date(group.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }
}

export default GroupInfo;
