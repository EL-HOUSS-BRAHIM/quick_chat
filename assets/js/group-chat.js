/**
 * Group Chat Components
 * Handles group creation, member management, and group settings
 */

class GroupChatManager {
    constructor() {
        this.currentGroup = null;
        this.groupMembers = new Map();
        this.groupSettings = null;
        
        this.init();
    }

    init() {
        this.createGroupComponents();
        this.bindEvents();
    }

    createGroupComponents() {
        // Create group creation modal
        const groupCreateModal = document.createElement('div');
        groupCreateModal.id = 'group-create-modal';
        groupCreateModal.className = 'modal group-modal';
        groupCreateModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Group</h3>
                    <button class="close-btn" onclick="groupChatManager.hideGroupCreateModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="group-create-form" onsubmit="groupChatManager.createGroup(event)">
                        <div class="form-group">
                            <label for="group-name">Group Name *</label>
                            <input type="text" id="group-name" name="groupName" required 
                                   placeholder="Enter group name" maxlength="50">
                            <div class="character-count">
                                <span id="group-name-count">0</span>/50
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-description">Description</label>
                            <textarea id="group-description" name="groupDescription" 
                                      placeholder="Enter group description (optional)" 
                                      maxlength="200" rows="3"></textarea>
                            <div class="character-count">
                                <span id="group-desc-count">0</span>/200
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="group-privacy">Privacy Settings</label>
                            <select id="group-privacy" name="groupPrivacy">
                                <option value="public">Public - Anyone can join</option>
                                <option value="private">Private - Invite only</option>
                                <option value="secret">Secret - Hidden from searches</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Group Avatar</label>
                            <div class="avatar-upload">
                                <div class="avatar-preview" id="group-avatar-preview">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="avatar-upload-controls">
                                    <input type="file" id="group-avatar-input" accept="image/*" 
                                           onchange="groupChatManager.handleAvatarUpload(event)">
                                    <button type="button" class="btn btn-outline" 
                                            onclick="document.getElementById('group-avatar-input').click()">
                                        Upload Photo
                                    </button>
                                    <button type="button" class="btn btn-outline" 
                                            onclick="groupChatManager.generateAvatar()">
                                        Generate Avatar
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Add Members</label>
                            <div class="member-search">
                                <input type="text" id="member-search-input" 
                                       placeholder="Search users to add..." 
                                       oninput="groupChatManager.searchUsers(this.value)">
                                <div class="search-results" id="member-search-results"></div>
                            </div>
                            <div class="selected-members" id="selected-members"></div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" 
                                    onclick="groupChatManager.hideGroupCreateModal()">
                                Cancel
                            </button>
                            <button type="submit" class="btn btn-primary">
                                Create Group
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Create group settings modal
        const groupSettingsModal = document.createElement('div');
        groupSettingsModal.id = 'group-settings-modal';
        groupSettingsModal.className = 'modal group-modal';
        groupSettingsModal.innerHTML = `
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>Group Settings</h3>
                    <button class="close-btn" onclick="groupChatManager.hideGroupSettingsModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="settings-tabs">
                        <button class="tab-btn active" onclick="groupChatManager.showSettingsTab('general')">
                            General
                        </button>
                        <button class="tab-btn" onclick="groupChatManager.showSettingsTab('members')">
                            Members
                        </button>
                        <button class="tab-btn" onclick="groupChatManager.showSettingsTab('permissions')">
                            Permissions
                        </button>
                        <button class="tab-btn" onclick="groupChatManager.showSettingsTab('privacy')">
                            Privacy
                        </button>
                    </div>
                    
                    <div class="settings-content">
                        <!-- General Settings Tab -->
                        <div id="general-settings" class="settings-tab active">
                            <div class="group-info-section">
                                <div class="group-avatar-section">
                                    <div class="group-avatar-large" id="settings-group-avatar">
                                        <i class="fas fa-users"></i>
                                    </div>
                                    <div class="avatar-actions">
                                        <button class="btn btn-outline" onclick="groupChatManager.changeGroupAvatar()">
                                            Change Photo
                                        </button>
                                        <button class="btn btn-outline" onclick="groupChatManager.removeGroupAvatar()">
                                            Remove Photo
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="group-details-section">
                                    <div class="form-group">
                                        <label for="settings-group-name">Group Name</label>
                                        <input type="text" id="settings-group-name" maxlength="50">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="settings-group-description">Description</label>
                                        <textarea id="settings-group-description" maxlength="200" rows="3"></textarea>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Group Statistics</label>
                                        <div class="group-stats">
                                            <div class="stat-item">
                                                <span class="stat-value" id="group-member-count">0</span>
                                                <span class="stat-label">Members</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-value" id="group-message-count">0</span>
                                                <span class="stat-label">Messages</span>
                                            </div>
                                            <div class="stat-item">
                                                <span class="stat-value" id="group-created-date">-</span>
                                                <span class="stat-label">Created</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Members Tab -->
                        <div id="members-settings" class="settings-tab">
                            <div class="members-header">
                                <div class="members-search">
                                    <input type="text" placeholder="Search members..." 
                                           oninput="groupChatManager.filterMembers(this.value)">
                                </div>
                                <button class="btn btn-primary" onclick="groupChatManager.showInviteModal()">
                                    <i class="fas fa-plus"></i> Add Members
                                </button>
                            </div>
                            
                            <div class="members-list" id="group-members-list">
                                <!-- Members will be loaded here -->
                            </div>
                        </div>
                        
                        <!-- Permissions Tab -->
                        <div id="permissions-settings" class="settings-tab">
                            <div class="permissions-section">
                                <h4>Group Permissions</h4>
                                
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <h5>Send Messages</h5>
                                        <p>Who can send messages in this group</p>
                                    </div>
                                    <select id="send-messages-permission">
                                        <option value="all">All Members</option>
                                        <option value="admins">Admins Only</option>
                                        <option value="owner">Owner Only</option>
                                    </select>
                                </div>
                                
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <h5>Share Files</h5>
                                        <p>Who can share files and media</p>
                                    </div>
                                    <select id="share-files-permission">
                                        <option value="all">All Members</option>
                                        <option value="admins">Admins Only</option>
                                        <option value="owner">Owner Only</option>
                                    </select>
                                </div>
                                
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <h5>Add Members</h5>
                                        <p>Who can invite new members</p>
                                    </div>
                                    <select id="add-members-permission">
                                        <option value="all">All Members</option>
                                        <option value="admins">Admins Only</option>
                                        <option value="owner">Owner Only</option>
                                    </select>
                                </div>
                                
                                <div class="permission-item">
                                    <div class="permission-info">
                                        <h5>Edit Group Info</h5>
                                        <p>Who can edit group name and description</p>
                                    </div>
                                    <select id="edit-group-permission">
                                        <option value="admins">Admins Only</option>
                                        <option value="owner">Owner Only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Privacy Tab -->
                        <div id="privacy-settings" class="settings-tab">
                            <div class="privacy-section">
                                <h4>Privacy Settings</h4>
                                
                                <div class="form-group">
                                    <label for="group-privacy-level">Group Privacy</label>
                                    <select id="group-privacy-level">
                                        <option value="public">Public - Anyone can find and join</option>
                                        <option value="private">Private - Invite only, but visible in search</option>
                                        <option value="secret">Secret - Hidden from search, invite only</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label>Join Approval</label>
                                    <div class="checkbox-group">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="require-approval">
                                            <span class="checkmark"></span>
                                            Require admin approval for new members
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Message History</label>
                                    <div class="checkbox-group">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="show-history">
                                            <span class="checkmark"></span>
                                            Show message history to new members
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>Read Receipts</label>
                                    <div class="checkbox-group">
                                        <label class="checkbox-label">
                                            <input type="checkbox" id="read-receipts">
                                            <span class="checkmark"></span>
                                            Enable read receipts for messages
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="danger-zone">
                                    <h4>Danger Zone</h4>
                                    <div class="danger-actions">
                                        <button class="btn btn-danger" onclick="groupChatManager.archiveGroup()">
                                            Archive Group
                                        </button>
                                        <button class="btn btn-danger" onclick="groupChatManager.deleteGroup()">
                                            Delete Group
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="groupChatManager.hideGroupSettingsModal()">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="groupChatManager.saveGroupSettings()">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Create member management modal
        const memberManagementModal = document.createElement('div');
        memberManagementModal.id = 'member-management-modal';
        memberManagementModal.className = 'modal member-modal';
        memberManagementModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Manage Member</h3>
                    <button class="close-btn" onclick="groupChatManager.hideMemberManagementModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="member-profile">
                        <div class="member-avatar" id="manage-member-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="member-info">
                            <h4 id="manage-member-name">Member Name</h4>
                            <p id="manage-member-role">Member</p>
                            <p id="manage-member-joined">Joined: -</p>
                        </div>
                    </div>
                    
                    <div class="member-actions">
                        <div class="action-group">
                            <h5>Role Management</h5>
                            <div class="role-buttons">
                                <button class="btn btn-outline" onclick="groupChatManager.promoteToAdmin()">
                                    <i class="fas fa-crown"></i> Make Admin
                                </button>
                                <button class="btn btn-outline" onclick="groupChatManager.demoteFromAdmin()">
                                    <i class="fas fa-user-minus"></i> Remove Admin
                                </button>
                            </div>
                        </div>
                        
                        <div class="action-group">
                            <h5>Member Actions</h5>
                            <div class="action-buttons">
                                <button class="btn btn-outline" onclick="groupChatManager.muteMember()">
                                    <i class="fas fa-volume-mute"></i> Mute Member
                                </button>
                                <button class="btn btn-outline" onclick="groupChatManager.viewMemberProfile()">
                                    <i class="fas fa-eye"></i> View Profile
                                </button>
                                <button class="btn btn-danger" onclick="groupChatManager.removeMember()">
                                    <i class="fas fa-user-times"></i> Remove from Group
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(groupCreateModal);
        document.body.appendChild(groupSettingsModal);
        document.body.appendChild(memberManagementModal);

        // Store references
        this.groupCreateModal = groupCreateModal;
        this.groupSettingsModal = groupSettingsModal;
        this.memberManagementModal = memberManagementModal;
    }

    bindEvents() {
        // Character count updates
        document.getElementById('group-name').addEventListener('input', (e) => {
            document.getElementById('group-name-count').textContent = e.target.value.length;
        });
        
        document.getElementById('group-description').addEventListener('input', (e) => {
            document.getElementById('group-desc-count').textContent = e.target.value.length;
        });

        // Close modals on outside click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    // Modal visibility methods
    showGroupCreateModal() {
        this.groupCreateModal.style.display = 'flex';
        this.groupCreateModal.classList.add('show');
        document.getElementById('group-name').focus();
    }

    hideGroupCreateModal() {
        this.groupCreateModal.classList.remove('show');
        setTimeout(() => {
            this.groupCreateModal.style.display = 'none';
            this.resetGroupCreateForm();
        }, 300);
    }

    showGroupSettingsModal(groupId) {
        this.loadGroupSettings(groupId);
        this.groupSettingsModal.style.display = 'flex';
        this.groupSettingsModal.classList.add('show');
    }

    hideGroupSettingsModal() {
        this.groupSettingsModal.classList.remove('show');
        setTimeout(() => {
            this.groupSettingsModal.style.display = 'none';
        }, 300);
    }

    showMemberManagementModal(memberId) {
        this.loadMemberInfo(memberId);
        this.memberManagementModal.style.display = 'flex';
        this.memberManagementModal.classList.add('show');
    }

    hideMemberManagementModal() {
        this.memberManagementModal.classList.remove('show');
        setTimeout(() => {
            this.memberManagementModal.style.display = 'none';
        }, 300);
    }

    hideAllModals() {
        this.hideGroupCreateModal();
        this.hideGroupSettingsModal();
        this.hideMemberManagementModal();
    }

    // Group creation methods
    async createGroup(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const groupData = {
            name: formData.get('groupName'),
            description: formData.get('groupDescription'),
            privacy: formData.get('groupPrivacy'),
            avatar: this.selectedAvatar,
            members: Array.from(this.selectedMembers.keys())
        };

        try {
            const response = await fetch('api/groups.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create',
                    ...groupData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideGroupCreateModal();
                this.showNotification('Group created successfully!', 'success');
                
                // Trigger group created event
                document.dispatchEvent(new CustomEvent('groupCreated', {
                    detail: { groupId: result.groupId, groupData: groupData }
                }));
            } else {
                this.showNotification(result.error || 'Failed to create group', 'error');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            this.showNotification('Failed to create group', 'error');
        }
    }

    async searchUsers(query) {
        if (!query || query.length < 2) {
            document.getElementById('member-search-results').innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`api/users.php?action=search&q=${encodeURIComponent(query)}`);
            const users = await response.json();
            
            this.displaySearchResults(users.data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    displaySearchResults(users) {
        const resultsContainer = document.getElementById('member-search-results');
        
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }

        resultsContainer.innerHTML = users.map(user => `
            <div class="search-result" onclick="groupChatManager.selectMember(${user.id}, '${user.name}', '${user.avatar}')">
                <div class="user-avatar">
                    <img src="${user.avatar || 'assets/images/default-avatar.png'}" alt="${user.name}">
                </div>
                <div class="user-info">
                    <div class="user-name">${user.name}</div>
                    <div class="user-status">${user.isOnline ? 'Online' : 'Offline'}</div>
                </div>
                <div class="select-indicator">
                    <i class="fas fa-plus"></i>
                </div>
            </div>
        `).join('');
    }

    selectMember(userId, userName, userAvatar) {
        if (this.selectedMembers.has(userId)) {
            return; // Already selected
        }

        this.selectedMembers.set(userId, { name: userName, avatar: userAvatar });
        this.updateSelectedMembersDisplay();
        
        // Clear search
        document.getElementById('member-search-input').value = '';
        document.getElementById('member-search-results').innerHTML = '';
    }

    removeMember(userId) {
        this.selectedMembers.delete(userId);
        this.updateSelectedMembersDisplay();
    }

    updateSelectedMembersDisplay() {
        const container = document.getElementById('selected-members');
        
        if (this.selectedMembers.size === 0) {
            container.innerHTML = '<div class="no-members">No members selected</div>';
            return;
        }

        container.innerHTML = Array.from(this.selectedMembers.entries()).map(([userId, member]) => `
            <div class="selected-member">
                <div class="member-avatar">
                    <img src="${member.avatar || 'assets/images/default-avatar.png'}" alt="${member.name}">
                </div>
                <div class="member-name">${member.name}</div>
                <button class="remove-member" onclick="groupChatManager.removeMember(${userId})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    // Avatar handling
    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select a valid image file', 'error');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Image file size must be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('group-avatar-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Group Avatar">`;
            this.selectedAvatar = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    generateAvatar() {
        const groupName = document.getElementById('group-name').value || 'Group';
        const avatarUrl = `api/avatar.php?type=group&name=${encodeURIComponent(groupName)}`;
        
        const preview = document.getElementById('group-avatar-preview');
        preview.innerHTML = `<img src="${avatarUrl}" alt="Generated Avatar">`;
        this.selectedAvatar = avatarUrl;
    }

    // Settings management
    showSettingsTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}-settings`).classList.add('active');
        
        // Add active class to clicked tab button
        event.target.classList.add('active');
    }

    async loadGroupSettings(groupId) {
        try {
            const response = await fetch(`api/groups.php?action=get&id=${groupId}`);
            const result = await response.json();
            
            if (result.success) {
                const group = result.data;
                this.currentGroup = group;
                
                // Populate general settings
                document.getElementById('settings-group-name').value = group.name;
                document.getElementById('settings-group-description').value = group.description || '';
                
                // Update avatar
                const avatarElement = document.getElementById('settings-group-avatar');
                if (group.avatar) {
                    avatarElement.innerHTML = `<img src="${group.avatar}" alt="Group Avatar">`;
                } else {
                    avatarElement.innerHTML = '<i class="fas fa-users"></i>';
                }
                
                // Update stats
                document.getElementById('group-member-count').textContent = group.memberCount || 0;
                document.getElementById('group-message-count').textContent = group.messageCount || 0;
                document.getElementById('group-created-date').textContent = 
                    new Date(group.createdAt).toLocaleDateString();
                
                // Load members
                await this.loadGroupMembers(groupId);
                
                // Populate permissions
                this.populatePermissionsSettings(group.permissions || {});
                
                // Populate privacy settings
                this.populatePrivacySettings(group.privacy || {});
            }
        } catch (error) {
            console.error('Error loading group settings:', error);
            this.showNotification('Failed to load group settings', 'error');
        }
    }

    async loadGroupMembers(groupId) {
        try {
            const response = await fetch(`api/groups.php?action=members&id=${groupId}`);
            const result = await response.json();
            
            if (result.success) {
                this.displayGroupMembers(result.data || []);
            }
        } catch (error) {
            console.error('Error loading group members:', error);
        }
    }

    displayGroupMembers(members) {
        const container = document.getElementById('group-members-list');
        
        if (members.length === 0) {
            container.innerHTML = '<div class="no-members">No members found</div>';
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="member-item" data-member-id="${member.id}">
                <div class="member-avatar">
                    <img src="${member.avatar || 'assets/images/default-avatar.png'}" alt="${member.name}">
                    <div class="member-status ${member.isOnline ? 'online' : 'offline'}"></div>
                </div>
                <div class="member-info">
                    <div class="member-name">${member.name}</div>
                    <div class="member-role">${member.role}</div>
                    <div class="member-joined">Joined ${new Date(member.joinedAt).toLocaleDateString()}</div>
                </div>
                <div class="member-actions">
                    <button class="btn btn-sm btn-outline" 
                            onclick="groupChatManager.showMemberManagementModal(${member.id})">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    populatePermissionsSettings(permissions) {
        document.getElementById('send-messages-permission').value = permissions.sendMessages || 'all';
        document.getElementById('share-files-permission').value = permissions.shareFiles || 'all';
        document.getElementById('add-members-permission').value = permissions.addMembers || 'admins';
        document.getElementById('edit-group-permission').value = permissions.editGroup || 'admins';
    }

    populatePrivacySettings(privacy) {
        document.getElementById('group-privacy-level').value = privacy.level || 'private';
        document.getElementById('require-approval').checked = privacy.requireApproval || false;
        document.getElementById('show-history').checked = privacy.showHistory !== false;
        document.getElementById('read-receipts').checked = privacy.readReceipts !== false;
    }

    async saveGroupSettings() {
        try {
            const settingsData = {
                id: this.currentGroup.id,
                name: document.getElementById('settings-group-name').value,
                description: document.getElementById('settings-group-description').value,
                permissions: {
                    sendMessages: document.getElementById('send-messages-permission').value,
                    shareFiles: document.getElementById('share-files-permission').value,
                    addMembers: document.getElementById('add-members-permission').value,
                    editGroup: document.getElementById('edit-group-permission').value
                },
                privacy: {
                    level: document.getElementById('group-privacy-level').value,
                    requireApproval: document.getElementById('require-approval').checked,
                    showHistory: document.getElementById('show-history').checked,
                    readReceipts: document.getElementById('read-receipts').checked
                }
            };

            const response = await fetch('api/groups.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'update',
                    ...settingsData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideGroupSettingsModal();
                this.showNotification('Group settings saved successfully!', 'success');
                
                // Trigger group updated event
                document.dispatchEvent(new CustomEvent('groupUpdated', {
                    detail: { groupId: this.currentGroup.id, settings: settingsData }
                }));
            } else {
                this.showNotification(result.error || 'Failed to save settings', 'error');
            }
        } catch (error) {
            console.error('Error saving group settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }

    // Utility methods
    resetGroupCreateForm() {
        document.getElementById('group-create-form').reset();
        document.getElementById('group-name-count').textContent = '0';
        document.getElementById('group-desc-count').textContent = '0';
        document.getElementById('group-avatar-preview').innerHTML = '<i class="fas fa-users"></i>';
        document.getElementById('selected-members').innerHTML = '<div class="no-members">No members selected</div>';
        document.getElementById('member-search-results').innerHTML = '';
        
        this.selectedMembers = new Map();
        this.selectedAvatar = null;
    }

    showNotification(message, type = 'info') {
        // Create or update notification
        let notification = document.getElementById('group-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'group-notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.className = `notification ${type} show`;
        notification.textContent = message;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Initialize selected members map
    selectedMembers = new Map();
    selectedAvatar = null;
}

// Initialize group chat manager
window.groupChatManager = new GroupChatManager();
