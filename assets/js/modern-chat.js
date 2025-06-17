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
    
    async loadConversation(userId = null) {
        try {
            this.hideWelcomeScreen();
            this.currentConversation = userId;
            
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
        
        // Add to UI immediately for better UX
        const tempId = 'temp_' + Date.now();
        this.addMessageToUI({
            id: tempId,
            sender_id: this.currentUserId,
            content: content.trim(),
            type: type,
            created_at: new Date().toISOString(),
            is_read: true,
            sender: { 
                username: 'You',
                display_name: 'You'
            },
            temp: true
        });
        
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
    
    async loadGroupMembers(groupId) {
        const response = await fetch(`${this.apiBase}groups.php?action=members&group_id=${groupId}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        return data.members;
    }
    
    async addUserToGroup(groupId, userId, isAdmin = false) {
        // First, log the CSRF token to console for debugging
        const csrfToken = this.getCSRFToken();
        console.log('CSRF Token:', csrfToken);
        
        // Log the current session state
        console.log('Current session status:', document.cookie ? 'Cookies present' : 'No cookies');
        
        const formData = new FormData();
        formData.append('action', 'add_member');
        formData.append('group_id', groupId);
        formData.append('user_id', userId);
        formData.append('is_admin', isAdmin ? '1' : '0');
        formData.append('csrf_token', csrfToken);
        
        // Log form data for debugging
        console.log('Form data for group member addition:');
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + pair[1]);
        }
        
        const response = await fetch(`${this.apiBase}groups.php`, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
            headers: {
                'X-CSRF-Token': csrfToken // Add token as a header as well
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    }
    
    async removeUserFromGroup(groupId, userId) {
        const data = new URLSearchParams();
        data.append('action', 'remove_member');
        data.append('group_id', groupId);
        data.append('user_id', userId);
        data.append('csrf_token', this.getCSRFToken());
        
        const response = await fetch(`${this.apiBase}groups.php`, {
            method: 'DELETE',
            body: data,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    }
    
    async banUserFromGroup(groupId, userId, reason = '') {
        const formData = new FormData();
        formData.append('action', 'ban_member');
        formData.append('group_id', groupId);
        formData.append('user_id', userId);
        formData.append('reason', reason);
        formData.append('csrf_token', this.getCSRFToken());
        
        const response = await fetch(`${this.apiBase}groups.php`, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    }
    
    async updateGroupSettings(groupId, settings) {
        const data = new URLSearchParams();
        data.append('group_id', groupId);
        
        if (settings.name) data.append('name', settings.name);
        if (settings.description) data.append('description', settings.description);
        if (settings.isPublic !== undefined) data.append('is_public', settings.isPublic ? '1' : '0');
        data.append('csrf_token', this.getCSRFToken());
        
        const response = await fetch(`${this.apiBase}groups.php`, {
            method: 'PUT',
            body: data,
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    }
    
    openGroupChat(groupId) {
        this.currentGroupId = groupId;
        this.currentConversation = null; // Clear the direct conversation
        
        // Find the group in our conversations
        const group = this.conversations.find(c => c.is_group && c.group_id === groupId);
        
        if (group) {
            this.openChatUI(group);
            this.loadGroupMembers(groupId).then(members => {
                this.updateGroupMembersList(members);
            });
        }
    }
    
    updateGroupMembersList(members) {
        // Check if we have the participants sidebar element
        if (!document.getElementById('participantsList')) {
            // Create it if it doesn't exist
            const sidebarElement = document.createElement('div');
            sidebarElement.id = 'participantsContainer';
            sidebarElement.className = 'participants-sidebar';
            sidebarElement.innerHTML = `
                <div class="sidebar-header">
                    <h3>Group Members</h3>
                    <button id="addMemberBtn" class="action-btn"><i class="fas fa-user-plus"></i></button>
                </div>
                <div id="participantCount" class="participant-count"></div>
                <div id="participantsList" class="participants-list"></div>
            `;
            
            document.querySelector('.chat-container').appendChild(sidebarElement);
            
            // Add event listener for the add member button
            document.getElementById('addMemberBtn').addEventListener('click', () => this.showAddMemberModal());
        }
        
        // Update members list
        const participantsList = document.getElementById('participantsList');
        
        if (participantsList) {
            const isAdmin = members.some(m => m.user_id === this.currentUserId && m.is_admin);
            
            participantsList.innerHTML = members.map(member => `
                <div class="participant-item" data-user-id="${member.id}">
                    <div class="participant-avatar">
                        <img src="${member.avatar || 'assets/images/default-avatar.svg'}" alt="${member.display_name}">
                        <span class="status-indicator ${member.status}"></span>
                    </div>
                    <div class="participant-info">
                        <div class="participant-name">${this.escapeHtml(member.display_name || member.username)}</div>
                        ${member.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
                    </div>
                    ${isAdmin && member.id !== this.currentUserId ? `
                        <div class="participant-actions">
                            <button class="action-btn" onclick="chatApp.showMemberActionsMenu(${member.id})">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
            
            // Update the participant count
            this.updateParticipantCount(members.length);
        }
    }
    
    updateParticipantCount(count) {
        const participantElement = document.getElementById('participantCount');
        if (participantElement) {
            participantElement.textContent = `${count} member${count !== 1 ? 's' : ''}`;
        }
    }
    
    showAddMemberModal() {
        // Create modal for adding members
        const modalElement = document.createElement('div');
        modalElement.id = 'addMemberModal';
        modalElement.className = 'modal';
        modalElement.onclick = (e) => {
            if (e.target === modalElement) {
                document.body.removeChild(modalElement);
            }
        };
        
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add Member to Group</h3>
                    <button class="close-btn" onclick="document.body.removeChild(document.getElementById('addMemberModal'))">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="userSearchInput" placeholder="Search users...">
                    </div>
                    <div id="userSearchResults" class="search-results"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalElement);
        
        // Add event listener to search input
        const searchInput = document.getElementById('userSearchInput');
        searchInput.addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });
    }
    
    async searchUsers(query) {
        if (!query.trim()) {
            document.getElementById('userSearchResults').innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}users.php?search=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            const resultsElement = document.getElementById('userSearchResults');
            
            if (data.users && data.users.length > 0) {
                resultsElement.innerHTML = data.users.map(user => `
                    <div class="search-result-item" data-user-id="${user.id}">
                        <div class="user-avatar">
                            <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${user.display_name || user.username}">
                        </div>
                        <div class="user-info">
                            <div class="user-name">${this.escapeHtml(user.display_name || user.username)}</div>
                            <div class="user-username">@${this.escapeHtml(user.username)}</div>
                        </div>
                        <button class="primary-btn add-user-btn" onclick="chatApp.addMemberToGroup(${user.id})">
                            Add
                        </button>
                    </div>
                `).join('');
            } else {
                resultsElement.innerHTML = '<div class="empty-state">No users found</div>';
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }
    
    async addMemberToGroup(userId) {
        try {
            await this.addUserToGroup(this.currentGroupId, userId);
            
            // Reload the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
            
            // Close the modal
            const modal = document.getElementById('addMemberModal');
            if (modal) {
                document.body.removeChild(modal);
            }
            
            this.showNotification('Member added successfully');
        } catch (error) {
            console.error('Error adding member:', error);
            this.showError(error.message);
        }
    }
    
    showMemberActionsMenu(userId) {
        // Close any existing menus
        this.closeAllDropdowns();
        
        // Create the dropdown menu
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu member-actions-menu';
        dropdown.innerHTML = `
            <ul>
                <li onclick="chatApp.makeAdmin(${userId})">Make Admin</li>
                <li onclick="chatApp.removeFromGroup(${userId})">Remove from Group</li>
                <li class="danger" onclick="chatApp.banFromGroup(${userId})">Ban from Group</li>
            </ul>
        `;
        
        // Position and show the dropdown
        const button = event.target.closest('.action-btn');
        const rect = button.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        
        document.body.appendChild(dropdown);
        
        // Close when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeDropdown(e) {
                if (!dropdown.contains(e.target) && e.target !== button) {
                    if (document.body.contains(dropdown)) {
                        document.body.removeChild(dropdown);
                    }
                    document.removeEventListener('click', closeDropdown);
                }
            });
        }, 0);
    }
    
    async makeAdmin(userId) {
        try {
            await this.addUserToGroup(this.currentGroupId, userId, true);
            
            // Reload the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
            
            this.closeAllDropdowns();
            this.showNotification('User is now an admin');
        } catch (error) {
            console.error('Error making user an admin:', error);
            this.showError(error.message);
        }
    }
    
    async removeFromGroup(userId) {
        try {
            await this.removeUserFromGroup(this.currentGroupId, userId);
            
            // Reload the members list
            const members = await this.loadGroupMembers(this.currentGroupId);
            this.updateGroupMembersList(members);
            
            this.closeAllDropdowns();
            this.showNotification('User removed from group');
        } catch (error) {
            console.error('Error removing user from group:', error);
            this.showError(error.message);
        }
    }
    
    async banFromGroup(userId) {
        // Show confirmation dialog
        if (confirm('Are you sure you want to ban this user from the group? They will not be able to rejoin.')) {
            try {
                await this.banUserFromGroup(this.currentGroupId, userId);
                
                // Reload the members list
                const members = await this.loadGroupMembers(this.currentGroupId);
                this.updateGroupMembersList(members);
                
                this.closeAllDropdowns();
                this.showNotification('User banned from group');
            } catch (error) {
                console.error('Error banning user from group:', error);
                this.showError(error.message);
            }
        }
    }
    
    showNewGroupModal() {
        // Create modal for creating a new group
        const modalElement = document.createElement('div');
        modalElement.id = 'newGroupModal';
        modalElement.className = 'modal';
        modalElement.onclick = (e) => {
            if (e.target === modalElement) {
                document.body.removeChild(modalElement);
            }
        };
        
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Create New Group</h3>
                    <button class="close-btn" onclick="document.body.removeChild(document.getElementById('newGroupModal'))">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="newGroupForm">
                        <div class="form-group">
                            <label for="groupName">Group Name</label>
                            <input type="text" id="groupName" required>
                        </div>
                        <div class="form-group">
                            <label for="groupDescription">Description</label>
                            <textarea id="groupDescription" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="groupIsPublic"> 
                                Make this group public
                            </label>
                        </div>
                        <div class="form-group">
                            <label for="groupAvatar">Group Avatar (Optional)</label>
                            <input type="file" id="groupAvatar" accept="image/*">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onclick="document.body.removeChild(document.getElementById('newGroupModal'))">
                                Cancel
                            </button>
                            <button type="submit" class="primary-btn">
                                Create Group
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalElement);
        
        // Add event listener to form
        document.getElementById('newGroupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('groupName').value;
            const description = document.getElementById('groupDescription').value;
            const isPublic = document.getElementById('groupIsPublic').checked;
            const avatarInput = document.getElementById('groupAvatar');
            
            if (avatarInput.files.length > 0) {
                this.newGroupAvatar = avatarInput.files[0];
            }
            
            this.createNewGroupChat(name, description, isPublic)
                .then(() => {
                    document.body.removeChild(document.getElementById('newGroupModal'));
                    this.showNotification('Group created successfully');
                })
                .catch(error => {
                    console.error('Error creating group:', error);
                    this.showError(error.message);
                });
        });
    }
    
    showGroupSettings() {
        // Find the current group
        const group = this.conversations.find(c => c.is_group && c.group_id === this.currentGroupId);
        
        if (!group) {
            return;
        }
        
        // Create modal for group settings
        const modalElement = document.createElement('div');
        modalElement.id = 'groupSettingsModal';
        modalElement.className = 'modal';
        modalElement.onclick = (e) => {
            if (e.target === modalElement) {
                document.body.removeChild(modalElement);
            }
        };
        
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Group Settings</h3>
                    <button class="close-btn" onclick="document.body.removeChild(document.getElementById('groupSettingsModal'))">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="groupSettingsForm">
                        <div class="form-group">
                            <label for="editGroupName">Group Name</label>
                            <input type="text" id="editGroupName" value="${this.escapeHtml(group.name)}" required>
                        </div>
                        <div class="form-group">
                            <label for="editGroupDescription">Description</label>
                            <textarea id="editGroupDescription" rows="3">${this.escapeHtml(group.description || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="editGroupIsPublic" ${group.is_public ? 'checked' : ''}> 
                                Make this group public
                            </label>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="secondary-btn" onclick="document.body.removeChild(document.getElementById('groupSettingsModal'))">
                                Cancel
                            </button>
                            <button type="submit" class="primary-btn">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modalElement);
        
        // Add event listener to form
        document.getElementById('groupSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('editGroupName').value;
            const description = document.getElementById('editGroupDescription').value;
            const isPublic = document.getElementById('editGroupIsPublic').checked;
            
            this.updateGroupSettings(this.currentGroupId, {
                name,
                description,
                isPublic
            })
                .then(() => {
                    document.body.removeChild(document.getElementById('groupSettingsModal'));
                    this.showNotification('Group settings updated successfully');
                    
                    // Reload conversations to refresh the group info
                    this.loadConversations();
                })
                .catch(error => {
                    console.error('Error updating group settings:', error);
                    this.showError(error.message);
                });
        });
    }
    
    // Update existing methods to support group chats
    updateChatHeader(conversation) {
        if (!this.elements.chatHeader) return;
        
        const isGroup = conversation.is_group;
        const avatar = conversation.avatar || 'assets/images/default-avatar.svg';
        const name = this.escapeHtml(conversation.name);
        const status = conversation.status || 'offline';
        
        // Add group settings button for group chats
        const groupSettingsBtn = isGroup ? `
            <button class="action-btn" onclick="chatApp.showGroupSettings()" title="Group Settings">
                <i class="fas fa-cog"></i>
            </button>
        ` : '';
        
        this.elements.chatHeader.innerHTML = `
            <div class="chat-avatar">
                ${isGroup ? 
                    '<div class="group-avatar"><i class="fas fa-users"></i></div>' :
                    `<img src="${avatar}" alt="${name}">`
                }
            </div>
            <div class="chat-user-info">
                <div class="chat-user-name">${name}</div>
                <div class="chat-user-status">
                    ${isGroup ? 
                        '<span class="group-type">' + (conversation.is_public ? 'Public Group' : 'Private Group') + '</span>' :
                        `<span class="status-indicator ${status}"></span>
                         <span class="status-text">${status === 'online' ? 'Online' : 'Offline'}</span>`
                    }
                </div>
            </div>
            <div class="chat-actions">
                ${groupSettingsBtn}
                <button class="action-btn" onclick="toggleChatInfo()" title="Info">
                    <i class="fas fa-info-circle"></i>
                </button>
                <button class="action-btn" onclick="toggleSearchMessages()" title="Search">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        `;
    }
    
    // Add message reaction methods
    async addReactionToMessage(messageId, emoji, groupId = null) {
        try {
            const formData = new FormData();
            formData.append('message_id', messageId);
            formData.append('emoji', emoji);
            formData.append('csrf_token', this.getCSRFToken());
            
            if (groupId) {
                formData.append('group_id', groupId);
            }
            
            const response = await fetch(`${this.apiBase}message-reactions.php`, {
                method: 'POST',
                body: formData,
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            // Update UI
            this.updateMessageReactions(messageId, data.reactions);
            
            return data;
        } catch (error) {
            console.error('Error adding reaction:', error);
            this.showError(error.message);
        }
    }
    
    async getMessageReactions(messageId) {
        try {
            const response = await fetch(`${this.apiBase}message-reactions.php?message_id=${messageId}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            return data.reactions;
        } catch (error) {
            console.error('Error getting reactions:', error);
            return [];
        }
    }
    
    updateMessageReactions(messageId, reactions) {
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        // Find or create reactions container
        let reactionsContainer = messageElement.querySelector('.message-reactions');
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            const messageBubble = messageElement.querySelector('.message-bubble');
            if (messageBubble) {
                messageBubble.appendChild(reactionsContainer);
            }
        }
        
        // Clear existing reactions
        reactionsContainer.innerHTML = '';
        
        // Add reactions
        if (reactions && reactions.length > 0) {
            reactions.forEach(reaction => {
                const reactionElement = document.createElement('span');
                reactionElement.className = 'reaction';
                reactionElement.dataset.emoji = reaction.emoji;
                
                // Check if current user has reacted with this emoji
                const hasReacted = reaction.user_ids.includes(parseInt(this.currentUserId));
                if (hasReacted) {
                    reactionElement.classList.add('user-reacted');
                }
                
                reactionElement.innerHTML = `${reaction.emoji} <span class="count">${reaction.count}</span>`;
                
                // Add click handler for toggling reaction
                reactionElement.addEventListener('click', () => {
                    this.addReactionToMessage(messageId, reaction.emoji, this.currentGroupId);
                });
                
                reactionsContainer.appendChild(reactionElement);
            });
        }
    }
    
    showReactionPicker(messageId) {
        // Create reaction picker
        const pickerElement = document.createElement('div');
        pickerElement.className = 'reaction-picker';
        pickerElement.innerHTML = `
            <div class="common-emojis">
                <span data-emoji="👍">👍</span>
                <span data-emoji="❤️">❤️</span>
                <span data-emoji="😂">😂</span>
                <span data-emoji="😮">😮</span>
                <span data-emoji="😢">😢</span>
                <span data-emoji="👏">👏</span>
                <span data-emoji="🎉">🎉</span>
                <span data-emoji="🔥">🔥</span>
            </div>
        `;
        
        // Position the picker
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            const rect = messageElement.getBoundingClientRect();
            pickerElement.style.top = `${rect.top - 40}px`;
            pickerElement.style.left = `${rect.left + 20}px`;
            
            document.body.appendChild(pickerElement);
            
            // Add click handlers for emojis
            pickerElement.querySelectorAll('.common-emojis span').forEach(emojiElement => {
                emojiElement.addEventListener('click', () => {
                    this.addReactionToMessage(messageId, emojiElement.dataset.emoji, this.currentGroupId);
                    document.body.removeChild(pickerElement);
                });
            });
            
            // Close when clicking outside
            setTimeout(() => {
                document.addEventListener('click', function closeReactionPicker(e) {
                    if (!pickerElement.contains(e.target)) {
                        if (document.body.contains(pickerElement)) {
                            document.body.removeChild(pickerElement);
                        }
                        document.removeEventListener('click', closeReactionPicker);
                    }
                });
            }, 0);
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
