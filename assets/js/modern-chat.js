/**
 * Modern Chat Application
 */
class ModernChatApp {
    constructor(options = {}) {
        this.currentUserId = options.currentUserId;
        this.targetUserId = options.targetUserId;
        this.apiBase = options.apiBase || 'api/';
        
        // State
        this.messages = [];
        this.onlineUsers = [];
        this.conversations = [];
        this.currentConversation = null;
        this.isTyping = false;
        this.typingTimeout = null;
        this.lastMessageTime = 0;
        
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
        } catch (error) {
            console.error('Failed to initialize chat app:', error);
            this.showError('Failed to initialize chat application');
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
            const response = await fetch(`${this.apiBase}messages.php?action=conversations`);
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
            const response = await fetch(`${this.apiBase}users.php?action=online`);
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
                
            const response = await fetch(url);
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
    
    async sendMessage(content, type = 'text') {
        if (!content.trim()) {
            this.showError('Message cannot be empty');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('action', 'send');
            formData.append('content', content.trim());
            formData.append('type', type);
            
            if (this.currentConversation) {
                formData.append('target_user_id', this.currentConversation);
            }
            
            const response = await fetch(`${this.apiBase}messages.php`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear input
                this.elements.messageInput.value = '';
                this.updateSendButton();
                
                // Add message to UI immediately (optimistic update)
                const message = {
                    id: 'temp_' + Date.now(),
                    content: content,
                    type: type,
                    user_id: this.currentUserId,
                    created_at: new Date().toISOString(),
                    is_own: true
                };
                
                this.messages.push(message);
                this.renderMessages();
                this.scrollToBottom();
                
                // Stop typing indicator
                this.stopTyping();
                
            } else {
                throw new Error(data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Failed to send message');
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
        
        return `
            <div class="message ${isOwn ? 'own' : ''}" data-message-id="${message.id}">
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
                        ${isOwn ? `<div class="message-time" style="font-size: 10px; opacity: 0.7; margin-top: 4px;">${timeString}</div>` : ''}
                    </div>
                </div>
                ${isOwn ? `<img src="${message.avatar || 'assets/images/default-avatar.svg'}" alt="You" class="message-avatar">` : ''}
            </div>
        `;
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
            const response = await fetch(`${this.apiBase}users.php?action=search&q=${encodeURIComponent(query)}`);
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
                
            const response = await fetch(url);
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
}

// Global functions for onclick handlers
function toggleEmojiPicker() {
    if (window.chatApp) {
        window.chatApp.toggleEmojiPicker();
    }
}

function showAttachMenu() {
    if (window.chatApp) {
        window.chatApp.showAttachMenu();
    }
}

function showNewChatModal() {
    if (window.chatApp) {
        window.chatApp.showNewChatModal();
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
