/**
 * Modern Chat Application
 */
class ModernChatApp {
    constructor(options = {}) {
        this.currentUserId = options.currentUserId;
        this.targetUserId = options.targetUserId;
        this.apiBase = options.apiBase || 'api/';
        this.csrfToken = options.csrfToken || '';
        
        // State
        this.messages = [];
        this.onlineUsers = [];
        this.conversations = [];
        this.currentConversation = null;
        this.currentGroupId = null; // Add tracking for group conversations
        this.lastMessageId = 0;
        this.isTyping = false;
        this.typingTimeout = null;
        this.lastMessageTime = 0;
        this.loadingHistory = false;
        this.noMoreHistory = false;
        this.messageLimit = 20;
        
        // Settings
        this.settings = {
            notifications: true,
            sound: true,
            theme: 'light'
        };
        
        // Elements
        this.elements = {};
        
        // Initialize emoji picker
        this.emojiPicker = null;
        
        // Message polling
        this.messagePollingInterval = null;
        this.userPollingInterval = null;
        
        this.bindElements();
        this.loadSettings();
    }
    
    bindElements() {
        this.elements = {
            // Sidebar
            searchInput: document.getElementById('searchInput'),
            onlineUsers: document.getElementById('onlineUsers'),
            chatList: document.getElementById('chatList'),
            navBtns: document.querySelectorAll('.nav-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Chat
            chatContainer: document.getElementById('chatContainer'),
            messagesContainer: document.getElementById('messagesContainer'),
            messagesList: document.getElementById('messagesList'),
            messageForm: document.getElementById('messageForm'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            typingIndicator: document.getElementById('typingIndicator'),
            
            // UI
            welcomeScreen: document.getElementById('welcomeScreen'),
            emojiPicker: document.getElementById('emojiPicker'),
            attachMenu: document.getElementById('attachMenu'),
            
            // Modals
            newChatModal: document.getElementById('newChatModal'),
            userSearchInput: document.getElementById('userSearchInput'),
            userSearchResults: document.getElementById('userSearchResults'),
            newGroupModal: document.getElementById('newGroupModal'),
            groupName: document.getElementById('groupName'),
            groupDescription: document.getElementById('groupDescription'),
            groupVisibility: document.getElementById('groupVisibility'),
            groupAvatarInput: document.getElementById('groupAvatarInput'),
            groupAvatarPreview: document.getElementById('groupAvatarPreview'),
            memberSearch: document.getElementById('memberSearch'),
            memberSearchResults: document.getElementById('memberSearchResults'),
            selectedMembers: document.getElementById('selectedMembers'),
            
            // Settings
            notificationsEnabled: document.getElementById('notificationsEnabled'),
            soundEnabled: document.getElementById('soundEnabled'),
            themeSelect: document.getElementById('themeSelect')
        };
    }
    
    async init() {
        try {
            console.log('Initializing Modern Chat App...');
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize emoji picker
            this.initEmojiPicker();
            
            // Load initial data
            await this.loadInitialData();
            
            // Start polling
            this.startPolling();
            
            // Apply theme
            this.applyTheme();
            
            console.log('Modern Chat App initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize chat app:', error);
            this.showError('Failed to initialize chat application');
            throw error;
        }
    }
    
    setupEventListeners() {
        // Navigation
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Search
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.debounce(() => this.searchConversations(e.target.value), 300);
            });
        }
        
        // Message form
        if (this.elements.messageForm) {
            this.elements.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        }
        
        // Message input
        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('input', (e) => this.handleInputChange(e));
            this.elements.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }
        
        // Settings
        if (this.elements.notificationsEnabled) {
            this.elements.notificationsEnabled.addEventListener('change', (e) => {
                this.settings.notifications = e.target.checked;
                this.saveSettings();
            });
        }
        
        if (this.elements.soundEnabled) {
            this.elements.soundEnabled.addEventListener('change', (e) => {
                this.settings.sound = e.target.checked;
                this.saveSettings();
            });
        }
        
        if (this.elements.themeSelect) {
            this.elements.themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }
        
        // Modal events
        if (this.elements.userSearchInput) {
            this.elements.userSearchInput.addEventListener('input', (e) => {
                this.debounce(() => this.searchUsers(e.target.value), 300);
            });
        }
        
        // Window events
        window.addEventListener('focus', () => this.onWindowFocus());
        window.addEventListener('blur', () => this.onWindowBlur());
        window.addEventListener('beforeunload', () => this.cleanup());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
    }
    
    async loadInitialData() {
        try {
            // Load conversations and online users in parallel
            const [conversationsResponse, usersResponse] = await Promise.all([
                this.loadConversations(),
                this.loadOnlineUsers()
            ]);
            
            // If we have a target user, load that conversation
            if (this.targetUserId) {
                await this.loadConversation(this.targetUserId);
            } else {
                this.showWelcomeScreen();
            }
            
            // Load groups
            await this.loadGroups();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load chat data');
        }
    }
    
    async loadConversations() {
        try {
            const response = await fetch(`${this.apiBase}messages.php?action=conversations`, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.success) {
                this.conversations = data.conversations || [];
                this.renderConversations();
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    }
    
    async loadOnlineUsers() {
        try {
            const response = await fetch(`${this.apiBase}users.php?action=online`, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.success) {
                this.onlineUsers = data.users || [];
                this.renderOnlineUsers();
                this.updateParticipantCount();
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }
    
    async loadGroups() {
        try {
            const response = await fetch(`${this.apiBase}groups.php?action=list`);
            const data = await response.json();
            
            if (data.groups) {
                // Update the groups list in the sidebar
                this.renderGroupsList(data.groups);
                
                // Also add groups to conversations for consistent handling
                data.groups.forEach(group => {
                    // Find existing group in conversations or add it
                    const existingIndex = this.conversations.findIndex(c => 
                        c.is_group && c.group_id === group.id);
                        
                    if (existingIndex >= 0) {
                        // Update existing entry
                        this.conversations[existingIndex] = {
                            ...this.conversations[existingIndex],
                            ...group,
                            is_group: true,
                            group_id: group.id
                        };
                    } else {
                        // Add new group to conversations
                        this.conversations.push({
                            ...group,
                            is_group: true,
                            group_id: group.id,
                            display_name: group.name,
                            avatar: group.avatar || 'assets/images/default-group.svg'
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error loading groups:', error);
            this.showNotification('Failed to load groups', 'error');
        }
    }
    
    renderGroupsList(groups) {
        const groupsContainer = document.getElementById('groupList');
        
        if (!groupsContainer) {
            console.error('Group list container not found');
            return;
        }
        
        // Clear existing groups
        groupsContainer.innerHTML = '';
        
        if (groups.length === 0) {
            groupsContainer.innerHTML = '<div class="no-groups">No groups yet</div>';
            return;
        }
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'chat-item group-chat-item';
            groupElement.setAttribute('data-group-id', group.id);
            groupElement.innerHTML = `
                <div class="chat-avatar group-avatar">
                    <img src="${group.avatar || 'assets/images/default-group.svg'}" alt="${group.name}">
                </div>
                <div class="chat-info">
                    <div class="chat-name">${group.name}</div>
                    <div class="chat-preview">${group.member_count || 0} members</div>
                </div>
            `;
            
            groupElement.addEventListener('click', () => {
                this.openGroupChat(group.id);
            });
            
            groupsContainer.appendChild(groupElement);
        });
    }
    
    async loadConversation(userId = null) {
        try {
            this.hideWelcomeScreen();
            this.currentConversation = userId;
            this.currentGroupId = null; // Clear any group chat
            
            // Update UI to show user info
            if (userId) {
                const user = this.onlineUsers.find(u => u.id == userId);
                
                // Update header
                const header = document.querySelector('.chat-header');
                if (header && user) {
                    header.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-avatar">
                                <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${this.escapeHtml(user.display_name || user.username)}">
                                <div class="status-indicator ${user.is_online ? 'online' : 'offline'}"></div>
                            </div>
                            <div class="chat-details">
                                <h3>${this.escapeHtml(user.display_name || user.username)}</h3>
                                <div class="chat-status">${user.is_online ? 'Online' : 'Offline'}</div>
                            </div>
                        </div>
                        <div class="chat-actions">
                            <button class="action-btn" onclick="window.showChatInfo()">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            <button class="action-btn" onclick="window.startCall('audio')">
                                <i class="fas fa-phone"></i>
                            </button>
                            <button class="action-btn" onclick="window.startCall('video')">
                                <i class="fas fa-video"></i>
                            </button>
                        </div>
                    `;
                }
            }
            
            const url = userId 
                ? `${this.apiBase}messages.php?action=get&target_user_id=${userId}`
                : `${this.apiBase}messages.php?action=get`;
                
            const response = await fetch(url, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.success) {
                this.messages = data.messages || [];
                this.renderMessages();
                this.scrollToBottom();
                this.updateLastMessageTime();
            } else {
                throw new Error(data.message || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
            this.showError('Failed to load messages');
        }
    }
    
    async sendMessage(content, type = 'text', replyToId = null, file = null) {
        if (!content.trim() && !file) return;
        
        try {
            // Add to UI immediately for better UX
            const tempId = 'temp_' + Date.now();
            const tempMessage = {
                id: tempId,
                user_id: this.currentUserId,
                content: content.trim(),
                type: type,
                created_at: new Date().toISOString(),
                is_read: true,
                username: 'You',
                display_name: 'You',
                avatar: document.querySelector('.profile-avatar img')?.src || 'assets/images/default-avatar.svg',
                temp: true
            };

            // Add the message to our internal array and render it
            this.messages.push(tempMessage);
            if (this.elements.messagesList) {
                const messageHTML = this.renderMessage(tempMessage);
                this.elements.messagesList.insertAdjacentHTML('beforeend', messageHTML);
                this.scrollToBottom();
            }
            
            // Clear input
            this.elements.messageInput.value = '';
            this.elements.messageInput.style.height = 'auto';
            this.updateSendButton();
        
        // Prepare form data
        const formData = new FormData();
        formData.append('action', 'send');
        formData.append('content', content.trim());
        formData.append('type', type);
        
        if (replyToId) {
            formData.append('reply_to', replyToId);
        }
        
        if (file) {
            formData.append('file', file);
        }
        
        formData.append('csrf_token', this.getCSRFToken());
        
        // Set the appropriate ID based on whether this is a group or direct message
        if (this.currentGroupId) {
            formData.append('group_id', this.currentGroupId);
        } else if (this.currentConversation) {
            formData.append('target_user_id', this.currentConversation);
        }
        
        // Debug logging
        console.log('Sending message with data:', {
            action: 'send',
            content: content.trim(),
            type: type,
            csrf_token: this.csrfToken ? 'present' : 'missing',
            target_user_id: this.currentConversation,
            group_id: this.currentGroupId
        });
        
        const response = await fetch(`${this.apiBase}messages.php`, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        // Debug response
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // Replace the temporary message with the real one
        this.replaceTemporaryMessage(tempId, data.data);
        
        return data;
    }
    
    addMessageToUI(message) {
        // Add the message to our internal array
        this.messages.push(message);
        
        // Render this single message in the UI
        if (this.elements.messagesList) {
            const messageHTML = this.renderMessage(message);
            this.elements.messagesList.insertAdjacentHTML('beforeend', messageHTML);
            
            // Scroll to the new message
            this.scrollToBottom();
        }
    }
    
    replaceTemporaryMessage(tempId, message) {
        // Find the temporary message in our array and replace it
        const index = this.messages.findIndex(m => m.id === tempId);
        if (index !== -1) {
            this.messages[index] = message;
        }
        
        // Update the message in the UI
        if (this.elements.messagesList) {
            const tempElement = this.elements.messagesList.querySelector(`[data-message-id="${tempId}"]`);
            if (tempElement) {
                const messageHTML = this.renderMessage(message);
                tempElement.outerHTML = messageHTML;
            }
        }
    }
    
    renderMessages() {
        if (!this.elements.messagesList) return;
        
        const messagesHTML = this.messages.map(message => this.renderMessage(message)).join('');
        this.elements.messagesList.innerHTML = messagesHTML;
    }
    
    renderMessage(message) {
        const isOwn = message.user_id == this.currentUserId;
        const messageTime = new Date(message.created_at);
        const timeString = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isGroupMessage = message.group_id || this.currentGroupId;
        
        // Data attributes for read receipts
        let dataAttributes = `data-message-id="${message.id}"`;
        
        if (isGroupMessage) {
            dataAttributes += ` data-group-id="${message.group_id || this.currentGroupId}"`;
        } else {
            dataAttributes += ` data-sender-id="${message.user_id}"`;
        }
        
        return `
            <div class="message ${isOwn ? 'own' : ''}" ${dataAttributes}>
                ${!isOwn ? `<img src="${message.avatar || 'assets/images/default-avatar.svg'}" alt="${message.username}" class="message-avatar">` : ''}
                <div class="message-content">
                    ${!isOwn ? `
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(message.display_name || message.username)}</span>
                            <span class="message-time">${timeString}</span>
                        </div>
                    ` : ''}
                    <div class="message-bubble">
                        ${this.renderMessageContent(message)}
                        ${message.reactions && message.reactions.length > 0 ? this.renderMessageReactions(message.reactions) : ''}
                        <div class="message-footer">
                            ${isOwn ? `<div class="message-time" style="font-size: 10px; opacity: 0.7;">${timeString}</div>` : ''}
                            ${isOwn ? `<span class="read-status"></span>` : ''}
                        </div>
                    </div>
                    <div class="message-actions">
                        <button class="action-btn reaction-btn" onclick="chatApp.showReactionPicker(${message.id})">
                            <i class="far fa-smile"></i>
                        </button>
                        <button class="action-btn reply-btn" onclick="chatApp.replyToMessage(${message.id})">
                            <i class="fas fa-reply"></i>
                        </button>
                    </div>
                </div>
                ${isOwn ? `<img src="${message.avatar || 'assets/images/default-avatar.svg'}" alt="You" class="message-avatar">` : ''}
            </div>
        `;
    }
    
    renderMessageReactions(reactions) {
        return `<div class="message-reactions">
            ${reactions.map(reaction => `
                <span class="reaction ${reaction.user_ids.includes(parseInt(this.currentUserId)) ? 'user-reacted' : ''}" 
                      data-emoji="${reaction.emoji}" 
                      onclick="chatApp.addReactionToMessage(${reaction.message_id}, '${reaction.emoji}', ${this.currentGroupId || 'null'})">
                    ${reaction.emoji} <span class="count">${reaction.count}</span>
                </span>
            `).join('')}
        </div>`;
    }
    
    renderMessageContent(message) {
        switch (message.type) {
            case 'image':
                return `<img src="${message.file_path}" alt="Image" style="max-width: 200px; border-radius: 8px;">`;
            case 'video':
                return `<video controls style="max-width: 200px; border-radius: 8px;"><source src="${message.file_path}"></video>`;
            case 'audio':
                return `<audio controls><source src="${message.file_path}"></audio>`;
            case 'file':
                return `<a href="${message.file_path}" download class="file-link"><i class="fas fa-file"></i> ${message.file_name}</a>`;
            default:
                return this.escapeHtml(message.content).replace(/\n/g, '<br>');
        }
    }
    
    renderOnlineUsers() {
        if (!this.elements.onlineUsers) return;
        
        const usersHTML = this.onlineUsers.map(user => `
            <div class="user-item" onclick="chatApp.startDirectMessage(${user.id})">
                <div class="user-avatar">
                    <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${user.display_name || user.username}">
                    <div class="status-indicator online"></div>
                </div>
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.display_name || user.username)}</div>
                    <div class="user-status">Online</div>
                </div>
            </div>
        `).join('');
        
        this.elements.onlineUsers.innerHTML = usersHTML || '<div class="empty-state">No users online</div>';
    }
    
    renderConversations() {
        if (!this.elements.chatList) return;
        
        const conversationsHTML = this.conversations.map(conversation => {
            const lastMessage = conversation.last_message;
            const timeString = lastMessage ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            
            return `
                <div class="chat-item ${conversation.target_user_id == this.currentConversation ? 'active' : ''}" 
                     onclick="chatApp.loadConversation(${conversation.target_user_id || 'null'})">
                    <div class="chat-avatar">
                        ${conversation.is_group ? 
                            '<div class="group-avatar"><i class="fas fa-users"></i></div>' :
                            `<img src="${conversation.avatar || 'assets/images/default-avatar.svg'}" alt="${conversation.name}">`
                        }
                    </div>
                    <div class="chat-info">
                        <div class="chat-name">${this.escapeHtml(conversation.name)}</div>
                        <div class="chat-preview">${lastMessage ? this.escapeHtml(lastMessage.content.substring(0, 50)) : 'No messages yet'}</div>
                    </div>
                    <div class="chat-meta">
                        ${timeString ? `<div class="chat-time">${timeString}</div>` : ''}
                        ${conversation.unread_count > 0 ? `<div class="unread-badge">${conversation.unread_count}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        this.elements.chatList.innerHTML = conversationsHTML || '<div class="empty-state">No conversations yet</div>';
    }
    
    updateParticipantCount() {
        const participantElement = document.getElementById('participantCount');
        if (participantElement) {
            const count = this.onlineUsers.length;
            participantElement.textContent = `${count} participant${count !== 1 ? 's' : ''} online`;
        }
    }
    
    // Event Handlers
    handleSendMessage(e) {
        e.preventDefault();
        const content = this.elements.messageInput.value.trim();
        if (content) {
            this.sendMessage(content);
        }
    }
    
    handleInputChange(e) {
        this.updateSendButton();
        this.handleTyping();
        this.autoResize(e.target);
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendMessage(e);
        }
    }
    
    handleGlobalKeyDown(e) {
        // Escape key to close modals/menus
        if (e.key === 'Escape') {
            this.closeAllDropdowns();
            this.closeModal();
        }
    }
    
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.sendTypingIndicator(true);
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }
    
    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            this.sendTypingIndicator(false);
        }
        clearTimeout(this.typingTimeout);
    }
    
    async sendTypingIndicator(isTyping) {
        try {
            const formData = new FormData();
            formData.append('action', 'typing');
            formData.append('typing', isTyping ? '1' : '0');
            
            if (this.currentConversation) {
                formData.append('target_user_id', this.currentConversation);
            }
            
            await fetch(`${this.apiBase}messages.php`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Failed to send typing indicator:', error);
        }
    }
    
    // UI Methods
    updateSendButton() {
        const hasContent = this.elements.messageInput.value.trim().length > 0;
        this.elements.sendBtn.disabled = !hasContent;
    }
    
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    scrollToBottom() {
        if (this.elements.messagesContainer) {
            const scrollElement = this.elements.messagesContainer.querySelector('.messages-list');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }
    
    showWelcomeScreen() {
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'flex';
        }
        if (this.elements.chatContainer) {
            this.elements.chatContainer.style.display = 'none';
        }
    }
    
    hideWelcomeScreen() {
        if (this.elements.welcomeScreen) {
            this.elements.welcomeScreen.style.display = 'none';
        }
        if (this.elements.chatContainer) {
            this.elements.chatContainer.style.display = 'flex';
        }
    }
    
    showError(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
    
    showSuccess(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast toast-success';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // Emoji Picker
    initEmojiPicker() {
        if (typeof EmojiPicker !== 'undefined' && this.elements.emojiPicker) {
            this.emojiPicker = new EmojiPicker({
                container: this.elements.emojiPicker,
                onEmojiSelect: (emoji) => {
                    this.insertEmoji(emoji);
                    this.hideEmojiPicker();
                }
            });
        }
    }
    
    toggleEmojiPicker() {
        if (this.elements.emojiPicker) {
            const isVisible = this.elements.emojiPicker.style.display !== 'none';
            if (isVisible) {
                this.hideEmojiPicker();
            } else {
                this.showEmojiPicker();
            }
        }
    }
    
    showEmojiPicker() {
        this.closeAllDropdowns();
        if (this.elements.emojiPicker) {
            this.elements.emojiPicker.style.display = 'block';
            if (this.emojiPicker && this.emojiPicker.render) {
                this.emojiPicker.render();
            }
        }
    }
    
    hideEmojiPicker() {
        if (this.elements.emojiPicker) {
            this.elements.emojiPicker.style.display = 'none';
        }
    }
    
    insertEmoji(emoji) {
        const input = this.elements.messageInput;
        const startPos = input.selectionStart;
        const endPos = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, startPos) + emoji + text.substring(endPos);
        input.focus();
        input.setSelectionRange(startPos + emoji.length, startPos + emoji.length);
        
        this.updateSendButton();
    }
    
    // Attachment Menu
    showAttachMenu() {
        this.closeAllDropdowns();
        if (this.elements.attachMenu) {
            this.elements.attachMenu.style.display = 'block';
        }
    }
    
    hideAttachMenu() {
        if (this.elements.attachMenu) {
            this.elements.attachMenu.style.display = 'none';
        }
    }
    
    closeAllDropdowns() {
        this.hideEmojiPicker();
        this.hideAttachMenu();
    }
    
    // Tab Management
    switchTab(tabName) {
        // Update nav buttons
        this.elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab contents
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Tab');
        });
    }
    
    // Modal Management
    showNewChatModal() {
        const modal = this.elements.newChatModal;
        if (modal) {
            modal.classList.add('show');
            this.elements.userSearchInput.focus();
        }
    }
    
    closeNewChatModal() {
        const modal = this.elements.newChatModal;
        if (modal) {
            modal.classList.remove('show');
            this.elements.userSearchInput.value = '';
            this.elements.userSearchResults.innerHTML = '';
        }
    }
    
    closeModal() {
        this.closeNewChatModal();
    }
    
    // Call functionality
    startCall(type) {
        console.log(`Starting ${type} call...`);
        // Placeholder for call functionality
        this.showError(`${type.charAt(0).toUpperCase() + type.slice(1)} calling is not yet implemented`);
    }
    
    // Search
    searchConversations(query) {
        // Implementation for searching conversations
        console.log('Searching conversations:', query);
    }
    
    async searchUsers(query) {
        if (!query.trim()) {
            this.elements.userSearchResults.innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}users.php?action=search&q=${encodeURIComponent(query)}`, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.success) {
                this.renderUserSearchResults(data.users || []);
            }
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }
    
    renderUserSearchResults(users) {
        const resultsHTML = users.map(user => `
            <div class="user-item" onclick="chatApp.startDirectMessageFromSearch(${user.id})">
                <div class="user-avatar">
                    <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${user.display_name || user.username}">
                    <div class="status-indicator ${user.is_online ? 'online' : 'offline'}"></div>
                </div>
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.display_name || user.username)}</div>
                    <div class="user-status">${user.is_online ? 'Online' : 'Offline'}</div>
                </div>
            </div>
        `).join('');
        
        this.elements.userSearchResults.innerHTML = resultsHTML || '<div class="empty-state">No users found</div>';
    }
    
    // Chat Actions
    startDirectMessage(userId) {
        this.loadConversation(userId);
    }
    
    startDirectMessageFromSearch(userId) {
        this.closeNewChatModal();
        this.loadConversation(userId);
    }
    
    // Settings
    loadSettings() {
        const saved = localStorage.getItem('chatSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
        
        // Apply settings to UI
        if (this.elements.notificationsEnabled) {
            this.elements.notificationsEnabled.checked = this.settings.notifications;
        }
        if (this.elements.soundEnabled) {
            this.elements.soundEnabled.checked = this.settings.sound;
        }
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = this.settings.theme;
        }
    }
    
    saveSettings() {
        localStorage.setItem('chatSettings', JSON.stringify(this.settings));
    }
    
    applyTheme() {
        if (this.settings.theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', this.settings.theme);
        }
    }
    
    // Polling
    startPolling() {
        // Poll for new messages every 2 seconds
        this.messagePollingInterval = setInterval(() => {
            if (this.currentConversation !== null) {
                this.pollMessages();
            }
        }, 2000);
        
        // Poll for online users every 30 seconds
        this.userPollingInterval = setInterval(() => {
            this.loadOnlineUsers();
        }, 30000);
    }
    
    async pollMessages() {
        try {
            const url = this.currentConversation 
                ? `${this.apiBase}messages.php?action=get&target_user_id=${this.currentConversation}&since=${this.lastMessageTime}`
                : `${this.apiBase}messages.php?action=get&since=${this.lastMessageTime}`;
                
            const response = await fetch(url, {
                credentials: 'same-origin'
            });
            const data = await response.json();
            
            if (data.success && data.messages && data.messages.length > 0) {
                // Add new messages
                this.messages.push(...data.messages);
                this.renderMessages();
                this.scrollToBottom();
                this.updateLastMessageTime();
                
                // Show notification for new messages
                if (document.hidden && this.settings.notifications) {
                    this.showNotification(data.messages[data.messages.length - 1]);
                }
            }
        } catch (error) {
            console.error('Failed to poll messages:', error);
        }
    }
    
    updateLastMessageTime() {
        if (this.messages.length > 0) {
            const lastMessage = this.messages[this.messages.length - 1];
            this.lastMessageTime = new Date(lastMessage.created_at).getTime();
        }
    }
    
    // Notifications
    showNotification(message) {
        if (!this.settings.notifications || !('Notification' in window)) {
            return;
        }
        
        if (Notification.permission === 'granted') {
            new Notification(`${message.display_name || message.username}`, {
                body: message.content,
                icon: message.avatar || 'assets/images/default-avatar.svg'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showNotification(message);
                }
            });
        }
    }
    
    // Window Events
    onWindowFocus() {
        // Resume polling
        if (!this.messagePollingInterval) {
            this.startPolling();
        }
    }
    
    onWindowBlur() {
        // Continue polling but maybe less frequently
    }
    
    // Utility Methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getCSRFToken() {
        return this.csrfToken;
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(func, wait);
    }
    
    cleanup() {
        // Stop polling
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
        }
        if (this.userPollingInterval) {
            clearInterval(this.userPollingInterval);
        }
        
        // Stop typing
        this.stopTyping();
    }
    
    // Add group chat methods
    async createNewGroupChat(name, description, isPublic) {
        const formData = new FormData();
        formData.append('action', 'create');
        formData.append('name', name);
        formData.append('description', description);
        formData.append('is_public', isPublic ? '1' : '0');
        formData.append('csrf_token', this.getCSRFToken());
        
        // Handle avatar if provided
        if (this.newGroupAvatar) {
            formData.append('avatar', this.newGroupAvatar);
        }
        
        const response = await fetch(`${this.apiBase}groups.php`, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // Add the new group to the conversations list
        await this.loadConversations();
        
        // Open the new group conversation
        this.openGroupChat(data.group.id);
        
        return data;
    }
    
    async createNewGroup() {
        try {
            // Get form values
            const name = document.getElementById('groupName').value.trim();
            const description = document.getElementById('groupDescription').value.trim();
            const isPublic = document.getElementById('groupVisibility').value === '1';
            
            if (!name) {
                this.showNotification('Group name is required', 'error');
                return;
            }
            
            // Get the selected member IDs
            const selectedMembersContainer = document.getElementById('selectedMembers');
            const memberElements = selectedMembersContainer ? selectedMembersContainer.querySelectorAll('.selected-member') : [];
            const memberIds = Array.from(memberElements).map(el => el.dataset.userId);
            
            console.log('Creating group with data:', {
                name, 
                description, 
                isPublic, 
                memberIds
            });
            
            // Create the group
            const formData = new FormData();
            formData.append('action', 'create');
            formData.append('name', name);
            formData.append('description', description);
            formData.append('is_public', isPublic ? '1' : '0');
            formData.append('csrf_token', this.getCSRFToken());
            
            // Add group avatar if selected
            const avatarInput = document.getElementById('groupAvatarInput');
            if (avatarInput && avatarInput.files && avatarInput.files[0]) {
                formData.append('avatar', avatarInput.files[0]);
            }
            
            const response = await fetch(`${this.apiBase}groups.php`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to create group');
            }
            
            // Add selected members to the group
            const groupId = data.group.id;
            
            // Add members to the group if any were selected
            if (memberIds.length > 0) {
                await Promise.all(memberIds.map(userId => 
                    this.addUserToGroup(groupId, userId)
                ));
            }
            
            this.showNotification('Group created successfully!', 'success');
            
            // Close the modal
            this.closeNewGroupModal();
            
            // Refresh groups list and open the new group
            await this.loadGroups();
            this.openGroupChat(groupId);
            
        } catch (error) {
            console.error('Error creating group:', error);
            this.showNotification('Failed to create group: ' + error.message, 'error');
        }
    }
    
    async loadGroupMembers(groupId) {
        try {
            const response = await fetch(`${this.apiBase}groups.php?action=members&group_id=${groupId}`);
            const data = await response.json();
            
            return data.members || [];
        } catch (error) {
            console.error('Error loading group members:', error);
            this.showNotification('Failed to load group members', 'error');
            return [];
        }
    }
    
    updateGroupMembersList(members) {
        const membersContainer = document.getElementById('groupInfoMembers');
        
        if (!membersContainer) return;
        
        // Clear existing members
        membersContainer.innerHTML = '';
        
        if (members.length === 0) {
            membersContainer.innerHTML = '<div class="no-members">No members</div>';
            return;
        }
        
        members.forEach(member => {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-item';
            
            const isAdmin = member.role === 'admin';
            const isCurrentUser = member.user_id === this.currentUserId;
            
            memberElement.innerHTML = `
                <div class="member-avatar">
                    <img src="${member.avatar || 'assets/images/default-avatar.svg'}" 
                         alt="${member.display_name || member.username}">
                    <div class="status-indicator ${member.is_online ? 'online' : 'offline'}"></div>
                </div>
                <div class="member-info">
                    <span class="member-name">
                        ${member.display_name || member.username}
                        ${isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
                        ${isCurrentUser ? '<span class="you-badge">You</span>' : ''}
                    </span>
                    <span class="member-status">${member.is_online ? 'Online' : 'Last seen ' + this.formatLastSeen(member.last_seen)}</span>
                </div>
                ${this.renderMemberActions(member, isAdmin, isCurrentUser)}
            `;
            
            membersContainer.appendChild(memberElement);
        });
    }
    
    renderMemberActions(member, isAdmin, isCurrentUser) {
        // Only show actions if current user is an admin of the group
        if (!this.isCurrentUserGroupAdmin()) {
            return '';
        }
        
        // Don't show remove/admin actions for the current user
        if (isCurrentUser) {
            return '';
        }
        
        return `
            <div class="member-actions">
                ${isAdmin ? 
                    `<button class="action-btn" title="Remove admin privileges" onclick="chatApp.removeAdminRole(${member.user_id})">
                        <i class="fas fa-user-minus"></i>
                    </button>` : 
                    `<button class="action-btn" title="Make admin" onclick="chatApp.makeAdmin(${member.user_id})">
                        <i class="fas fa-user-shield"></i>
                    </button>`
                }
                <button class="action-btn remove-btn" title="Remove from group" onclick="chatApp.removeMember(${member.user_id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }
    
    isCurrentUserGroupAdmin() {
        // Check if the current user is an admin in the current group
        if (!this.currentGroupId) return false;
        
        const group = this.conversations.find(c => 
            c.is_group && c.group_id === this.currentGroupId);
            
        return group && (group.created_by === this.currentUserId || group.role === 'admin');
    }
    
    async makeAdmin(userId) {
        try {
            if (!this.currentGroupId) return;
            
            await this.addUserToGroup(this.currentGroupId, userId, true);
            this.showNotification('User is now an admin', 'success');
            
            // Refresh the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
        } catch (error) {
            console.error('Error making user admin:', error);
            this.showNotification('Failed to make user admin: ' + error.message, 'error');
        }
    }
    
    async removeAdminRole(userId) {
        try {
            if (!this.currentGroupId) return;
            
            const formData = new FormData();
            formData.append('action', 'update_member');
            formData.append('group_id', this.currentGroupId);
            formData.append('user_id', userId);
            formData.append('role', 'member');
            formData.append('csrf_token', this.getCSRFToken());
            
            const response = await fetch(`${this.apiBase}groups.php`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to update member');
            }
            
            this.showNotification('Admin privileges removed', 'success');
            
            // Refresh the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
        } catch (error) {
            console.error('Error removing admin role:', error);
            this.showNotification('Failed to remove admin role: ' + error.message, 'error');
        }
    }
    
    async removeMember(userId) {
        try {
            if (!confirm('Are you sure you want to remove this member from the group?')) {
                return;
            }
            
            if (!this.currentGroupId) return;
            
            const formData = new FormData();
            formData.append('action', 'remove_member');
            formData.append('group_id', this.currentGroupId);
            formData.append('user_id', userId);
            formData.append('csrf_token', this.getCSRFToken());
            
            const response = await fetch(`${this.apiBase}groups.php`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to remove member');
            }
            
            this.showNotification('Member removed from group', 'success');
            
            // Refresh the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
        } catch (error) {
            console.error('Error removing member:', error);
            this.showNotification('Failed to remove member: ' + error.message, 'error');
        }
    }
    
    showNewGroupModal() {
        const modal = document.getElementById('newGroupModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            
            // Clear previous values
            const groupNameInput = document.getElementById('groupName');
            const groupDescInput = document.getElementById('groupDescription');
            const groupVisibilityInput = document.getElementById('groupVisibility');
            const groupAvatarInput = document.getElementById('groupAvatarInput');
            const groupAvatarPreview = document.getElementById('groupAvatarPreview');
            
            if (groupNameInput) groupNameInput.value = '';
            if (groupDescInput) groupDescInput.value = '';
            if (groupVisibilityInput) groupVisibilityInput.value = '0';
            if (groupAvatarInput) groupAvatarInput.value = '';
            if (groupAvatarPreview) groupAvatarPreview.innerHTML = '<i class="fas fa-users"></i>';
            
            // Load contacts for member selection
            this.loadContactsForGroupCreation();
        } else {
            console.error('New group modal element not found');
        }
    }
    
    closeNewGroupModal() {
        const modal = document.getElementById('newGroupModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        } else {
            console.error('New group modal element not found');
        }
    }
    
    async loadContactsForGroupCreation() {
        try {
            const searchInput = document.getElementById('memberSearch');
            const resultsContainer = document.getElementById('memberSearchResults');
            
            // Clear previous results
            resultsContainer.innerHTML = '';
            
            // Set up search input
            if (!searchInput._listenerAdded) {
                searchInput.addEventListener('input', this.debounce(() => {
                    this.searchContactsForGroup(searchInput.value);
                }, 300));
                searchInput._listenerAdded = true;
            }
            
            // Load initial contacts
            const response = await fetch(`${this.apiBase}users.php?action=contacts`);
            const data = await response.json();
            
            if (data.contacts && data.contacts.length > 0) {
                this.renderContactsForGroupCreation(data.contacts);
            } else {
                resultsContainer.innerHTML = '<div class="no-results">No contacts found</div>';
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }
    
    renderContactsForGroupCreation(contacts) {
        const resultsContainer = document.getElementById('memberSearchResults');
        resultsContainer.innerHTML = '';
        
        contacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'member-item';
            contactElement.innerHTML = `
                <div class="member-avatar">
                    <img src="${contact.avatar || 'assets/images/default-avatar.svg'}" alt="${contact.display_name || contact.username}">
                </div>
                <div class="member-info">
                    <span class="member-name">${contact.display_name || contact.username}</span>
                    <span class="member-status">${contact.is_online ? 'Online' : 'Offline'}</span>
                </div>
                <button class="add-member-btn" onclick="chatApp.selectGroupMember(${contact.id}, '${contact.display_name || contact.username}', '${contact.avatar || 'assets/images/default-avatar.svg'}')">
                    <i class="fas fa-plus"></i>
                </button>
            `;
            resultsContainer.appendChild(contactElement);
        });
    }
    
    async searchContactsForGroup(query) {
        try {
            if (!query.trim()) {
                this.loadContactsForGroupCreation();
                return;
            }
            
            const response = await fetch(`${this.apiBase}users.php?action=search&query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.users && data.users.length > 0) {
                this.renderContactsForGroupCreation(data.users);
            } else {
                const resultsContainer = document.getElementById('memberSearchResults');
                resultsContainer.innerHTML = '<div class="no-results">No matching users found</div>';
            }
        } catch (error) {
            console.error('Error searching contacts:', error);
        }
    }
    
    selectGroupMember(userId, name, avatar) {
        const selectedContainer = document.getElementById('selectedMembers');
        
        // Check if already selected
        if (selectedContainer.querySelector(`[data-user-id="${userId}"]`)) {
            return;
        }
        
        const memberElement = document.createElement('div');
        memberElement.className = 'selected-member';
        memberElement.setAttribute('data-user-id', userId);
        memberElement.innerHTML = `
            <img src="${avatar}" alt="${name}">
            <span>${name}</span>
            <button onclick="chatApp.removeGroupMember(${userId})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        selectedContainer.appendChild(memberElement);
    }
    
    removeGroupMember(userId) {
        const selectedContainer = document.getElementById('selectedMembers');
        const memberElement = selectedContainer.querySelector(`[data-user-id="${userId}"]`);
        
        if (memberElement) {
            memberElement.remove();
        }
    }
    
    async createNewGroup() {
        try {
            // Get form values
            const name = document.getElementById('groupName').value.trim();
            const description = document.getElementById('groupDescription').value.trim();
            const isPublic = document.getElementById('groupVisibility').value === '1';
            
            if (!name) {
                this.showNotification('Group name is required', 'error');
                return;
            }
            
            // Get the selected member IDs
            const selectedMembersContainer = document.getElementById('selectedMembers');
            const memberElements = selectedMembersContainer ? selectedMembersContainer.querySelectorAll('.selected-member') : [];
            const memberIds = Array.from(memberElements).map(el => el.dataset.userId);
            
            console.log('Creating group with data:', {
                name, 
                description, 
                isPublic, 
                memberIds
            });
            
            // Create the group
            const formData = new FormData();
            formData.append('action', 'create');
            formData.append('name', name);
            formData.append('description', description);
            formData.append('is_public', isPublic ? '1' : '0');
            formData.append('csrf_token', this.getCSRFToken());
            
            // Add group avatar if selected
            const avatarInput = document.getElementById('groupAvatarInput');
            if (avatarInput && avatarInput.files && avatarInput.files[0]) {
                formData.append('avatar', avatarInput.files[0]);
            }
            
            const response = await fetch(`${this.apiBase}groups.php`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to create group');
            }
            
            // Add selected members to the group
            const groupId = data.group.id;
            
            // Add members to the group if any were selected
            if (memberIds.length > 0) {
                await Promise.all(memberIds.map(userId => 
                    this.addUserToGroup(groupId, userId)
                ));
            }
            
            this.showNotification('Group created successfully!', 'success');
            
            // Close the modal
            this.closeNewGroupModal();
            
            // Refresh groups list and open the new group
            await this.loadGroups();
            this.openGroupChat(groupId);
            
        } catch (error) {
            console.error('Error creating group:', error);
            this.showNotification('Failed to create group: ' + error.message, 'error');
        }
    }
    
    async openGroupChat(groupId) {
        try {
            this.hideWelcomeScreen();
            this.currentGroupId = groupId;
            this.currentConversation = null;  // Clear any direct conversation
            
            // Update UI to show group info
            const group = this.conversations.find(c => c.is_group && c.group_id === groupId);
            
            if (!group) {
                // Try to fetch group details
                const response = await fetch(`${this.apiBase}groups.php?action=details&group_id=${groupId}`, {
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (!data.success || !data.group) {
                    throw new Error('Group not found');
                }
                
                // Update conversations with the new group
                const groupInfo = data.group;
                this.conversations.push({
                    is_group: true,
                    group_id: groupInfo.id,
                    name: groupInfo.name,
                    avatar: groupInfo.avatar || 'assets/images/default-group.svg',
                    last_message: null,
                    unread_count: 0,
                    created_at: groupInfo.created_at,
                    created_by: groupInfo.created_by,
                    member_count: groupInfo.member_count || 0
                });
            }
            
            // Update header
            const header = document.querySelector('.chat-header');
            if (header) {
                const groupInfo = group || this.conversations.find(c => c.is_group && c.group_id === groupId);
                
                if (groupInfo) {
                    header.innerHTML = `
                        <div class="chat-info">
                            <div class="chat-avatar">
                                <img src="${groupInfo.avatar || 'assets/images/default-group.svg'}" alt="${this.escapeHtml(groupInfo.name)}">
                            </div>
                            <div class="chat-details">
                                <h3>${this.escapeHtml(groupInfo.name)}</h3>
                                <div class="chat-status">${groupInfo.member_count || 0} members</div>
                            </div>
                        </div>
                        <div class="chat-actions">
                            <button class="action-btn" onclick="chatApp.toggleGroupInfo()">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            <button class="action-btn" onclick="chatApp.startCall('audio')">
                                <i class="fas fa-phone"></i>
                            </button>
                            <button class="action-btn" onclick="chatApp.startCall('video')">
                                <i class="fas fa-video"></i>
                            </button>
                        </div>
                    `;
                }
            }
            
            // Load group messages
            const url = `${this.apiBase}messages.php?action=get&group_id=${groupId}`;
            const response = await fetch(url, {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.messages = data.messages || [];
                this.renderMessages();
                this.scrollToBottom();
                this.updateLastMessageTime();
                
                // Load group members for the info panel
                this.loadGroupMembers(groupId);
            } else {
                throw new Error(data.message || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Failed to open group chat:', error);
            this.showNotification('Failed to open group chat: ' + error.message, 'error');
        }
    }
}

// Global functions for onclick handlers
function toggleEmojiPicker() {
    if (window.chatApp && typeof window.chatApp.toggleEmojiPicker === 'function') {
        window.chatApp.toggleEmojiPicker();
    } else {
        console.error('toggleEmojiPicker function not available on chatApp');
    }
}

function showAttachMenu() {
    if (window.chatApp && typeof window.chatApp.showAttachMenu === 'function') {
        window.chatApp.showAttachMenu();
    } else {
        console.error('showAttachMenu function not available on chatApp');
    }
}

function showNewChatModal() {
    console.log('showNewChatModal called, checking chatApp...', window.chatApp);
    if (window.chatApp && typeof window.chatApp.showNewChatModal === 'function') {
        window.chatApp.showNewChatModal();
    } else {
        console.error('showNewChatModal function not available on chatApp. Available methods:', 
            window.chatApp ? Object.getOwnPropertyNames(Object.getPrototypeOf(window.chatApp)) : 'chatApp not available');
        
        // Fallback: try again after a short delay
        setTimeout(() => {
            if (window.chatApp && typeof window.chatApp.showNewChatModal === 'function') {
                window.chatApp.showNewChatModal();
            } else {
                alert('Chat app is not ready yet. Please try again.');
            }
        }, 500);
    }
}

function closeNewChatModal() {
    if (window.chatApp) {
        window.chatApp.closeNewChatModal();
    }
}

function closeModal(event) {
    if (event.target.classList.contains('modal')) {
        if (window.chatApp) {
            window.chatApp.closeModal();
        }
    }
}

function showSettings() {
    if (window.chatApp) {
        window.chatApp.switchTab('settings');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'auth.php?action=logout';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // The chat app will be initialized from the main script tag in the HTML
});
