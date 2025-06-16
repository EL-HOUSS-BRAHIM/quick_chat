/**
 * Modern Chat Application
 * Enhanced with better error handling, state management, and UX
 */

class ModernChatApp {
    constructor() {
        this.config = window.chatConfig || {};
        this.state = {
            currentUser: this.config.currentUser,
            targetUser: this.config.targetUser,
            messages: [],
            onlineUsers: [],
            conversations: [],
            isTyping: false,
            emojiPicker: null,
            connectionStatus: 'connecting'
        };
        
        this.ui = {
            messagesContainer: document.getElementById('messagesContainer'),
            messagesList: document.getElementById('messagesList'),
            messagesLoading: document.getElementById('messagesLoading'),
            messageForm: document.getElementById('messageForm'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            charCounter: document.querySelector('.char-counter'),
            typingIndicator: document.getElementById('typingIndicator'),
            emojiPickerContainer: document.getElementById('emojiPickerContainer'),
            onlineUsers: document.getElementById('onlineUsers'),
            conversationList: document.getElementById('conversationList'),
            fileInput: document.getElementById('fileInput')
        };
        
        this.timers = {
            typing: null,
            messagePolling: null,
            userPolling: null
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupEmojiPicker();
        this.loadInitialData();
        this.startPolling();
        this.updateConnectionStatus('connected');
    }
    
    bindEvents() {
        // Message form
        this.ui.messageForm?.addEventListener('submit', (e) => this.handleMessageSubmit(e));
        
        // Message input
        this.ui.messageInput?.addEventListener('input', () => this.handleMessageInput());
        this.ui.messageInput?.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // File input
        this.ui.fileInput?.addEventListener('change', (e) => this.handleFileSelection(e));
        
        // Sidebar search
        const sidebarSearch = document.getElementById('sidebarSearch');
        sidebarSearch?.addEventListener('input', (e) => this.handleSidebarSearch(e.target.value));
        
        // New chat search
        const newChatSearch = document.getElementById('newChatSearch');
        newChatSearch?.addEventListener('input', (e) => this.handleNewChatSearch(e.target.value));
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Visibility change for read status
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
    
    async loadInitialData() {
        try {
            this.showLoadingState(true);
            
            await Promise.all([
                this.loadMessages(),
                this.loadOnlineUsers(),
                this.loadConversations()
            ]);
            
            this.showLoadingState(false);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load chat data. Please refresh the page.');
            this.showLoadingState(false);
        }
    }
    
    showLoadingState(show) {
        if (this.ui.messagesLoading) {
            this.ui.messagesLoading.style.display = show ? 'flex' : 'none';
        }
        if (this.ui.messagesList) {
            this.ui.messagesList.style.display = show ? 'none' : 'block';
        }
    }
    
    async loadMessages() {
        try {
            const url = new URL(this.config.apiEndpoints.messages, window.location.origin);
            url.searchParams.set('action', 'get');
            
            if (this.state.targetUser) {
                url.searchParams.set('target_user_id', this.state.targetUser.id);
            }
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.state.messages = result.data || [];
                this.renderMessages();
                this.scrollToBottom();
            } else {
                throw new Error(result.error || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showError('Failed to load messages');
        }
    }
    
    async loadOnlineUsers() {
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=get_online`);
            const result = await response.json();
            
            if (result.success) {
                this.state.onlineUsers = result.users || [];
                this.renderOnlineUsers();
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }
    
    async loadConversations() {
        // Mock conversations for now - would be loaded from API
        this.state.conversations = [];
        this.renderConversations();
    }
    
    renderMessages() {
        if (!this.ui.messagesList) return;
        
        if (this.state.messages.length === 0) {
            this.ui.messagesList.innerHTML = this.createEmptyState('No messages yet', 'Start the conversation!');
            return;
        }
        
        this.ui.messagesList.innerHTML = this.state.messages
            .map(message => this.createMessageElement(message))
            .join('');
    }
    
    createMessageElement(message) {
        const isOwn = message.user_id == this.state.currentUser.id;
        const messageTime = this.formatTime(message.created_at);
        const avatar = message.avatar || 'assets/images/default-avatar.png';
        const displayName = message.display_name || message.username || 'Unknown User';
        
        return `
            <div class="message ${isOwn ? 'own' : ''}" data-message-id="${message.id}">
                <img src="${this.escapeHtml(avatar)}" 
                     alt="${this.escapeHtml(displayName)}" 
                     class="message-avatar">
                <div class="message-content">
                    ${!isOwn ? `
                    <div class="message-header">
                        <span class="message-author">${this.escapeHtml(displayName)}</span>
                        <span class="message-time">${messageTime}</span>
                    </div>
                    ` : `
                    <div class="message-header">
                        <span class="message-time">${messageTime}</span>
                    </div>
                    `}
                    <div class="message-text">${this.formatMessageContent(message.content)}</div>
                </div>
            </div>
        `;
    }
    
    createEmptyState(title, subtitle) {
        return `
            <div class="empty-state">
                <i class="fas fa-comments"></i>
                <p><strong>${title}</strong></p>
                <p>${subtitle}</p>
            </div>
        `;
    }
    
    renderOnlineUsers() {
        if (!this.ui.onlineUsers) return;
        
        const currentUserId = this.state.currentUser.id;
        const onlineUsers = this.state.onlineUsers.filter(user => user.id !== currentUserId);
        
        if (onlineUsers.length === 0) {
            this.ui.onlineUsers.innerHTML = this.createEmptyState('No users online', 'Check back later');
            return;
        }
        
        this.ui.onlineUsers.innerHTML = onlineUsers
            .map(user => this.createUserElement(user))
            .join('');
    }
    
    createUserElement(user) {
        const avatar = user.avatar || 'assets/images/default-avatar.png';
        const displayName = user.display_name || user.username;
        const isOnline = user.is_online;
        
        return `
            <div class="user-item" onclick="startDirectMessage(${user.id})" data-user-id="${user.id}">
                <img src="${this.escapeHtml(avatar)}" 
                     alt="${this.escapeHtml(displayName)}" 
                     class="user-avatar">
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(displayName)}</div>
                    <div class="user-status-text">
                        <span class="user-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderConversations() {
        if (!this.ui.conversationList) return;
        
        if (this.state.conversations.length === 0) {
            this.ui.conversationList.innerHTML = this.createEmptyState('No conversations', 'Start chatting to see your conversations here');
            return;
        }
        
        // Implementation would go here for conversation list
        this.ui.conversationList.innerHTML = '';
    }
    
    async handleMessageSubmit(e) {
        e.preventDefault();
        
        const message = this.ui.messageInput.value.trim();
        if (!message) return;
        
        try {
            this.setButtonLoading(this.ui.sendBtn, true);
            this.ui.messageInput.disabled = true;
            
            const formData = new FormData();
            formData.append('action', 'send');
            formData.append('message', message);
            formData.append('csrf_token', this.config.csrfToken);
            
            if (this.state.targetUser) {
                formData.append('target_user_id', this.state.targetUser.id);
            }
            
            const response = await fetch(this.config.apiEndpoints.messages, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.ui.messageInput.value = '';
                this.updateCharCounter();
                this.autoResizeTextarea();
                await this.loadMessages(); // Reload to show the new message
                this.showSuccess('Message sent!');
            } else {
                throw new Error(result.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError(error.message || 'Failed to send message');
        } finally {
            this.setButtonLoading(this.ui.sendBtn, false);
            this.ui.messageInput.disabled = false;
            this.ui.messageInput.focus();
        }
    }
    
    handleMessageInput() {
        this.updateCharCounter();
        this.autoResizeTextarea();
        this.handleTypingIndicator();
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleMessageSubmit(e);
        }
    }
    
    updateCharCounter() {
        if (!this.ui.messageInput || !this.ui.charCounter) return;
        
        const length = this.ui.messageInput.value.length;
        const maxLength = 2000;
        
        this.ui.charCounter.textContent = `${length}/${maxLength}`;
        
        // Update counter color based on length
        this.ui.charCounter.className = 'char-counter';
        if (length > maxLength * 0.9) {
            this.ui.charCounter.classList.add('danger');
        } else if (length > maxLength * 0.75) {
            this.ui.charCounter.classList.add('warning');
        }
    }
    
    autoResizeTextarea() {
        if (!this.ui.messageInput) return;
        
        this.ui.messageInput.style.height = 'auto';
        this.ui.messageInput.style.height = Math.min(this.ui.messageInput.scrollHeight, 120) + 'px';
    }
    
    handleTypingIndicator() {
        if (!this.state.isTyping) {
            this.state.isTyping = true;
            this.sendTypingStatus(true);
        }
        
        clearTimeout(this.timers.typing);
        this.timers.typing = setTimeout(() => {
            this.state.isTyping = false;
            this.sendTypingStatus(false);
        }, 1000);
    }
    
    async sendTypingStatus(isTyping) {
        try {
            const formData = new FormData();
            formData.append('action', 'typing');
            formData.append('is_typing', isTyping ? '1' : '0');
            formData.append('csrf_token', this.config.csrfToken);
            
            if (this.state.targetUser) {
                formData.append('target_user_id', this.state.targetUser.id);
            }
            
            await fetch(this.config.apiEndpoints.messages, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Failed to send typing status:', error);
        }
    }
    
    async handleFileSelection(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        try {
            for (const file of files) {
                await this.uploadFile(file);
            }
            this.showSuccess('Files uploaded successfully!');
            await this.loadMessages();
        } catch (error) {
            console.error('Failed to upload files:', error);
            this.showError('Failed to upload files');
        } finally {
            e.target.value = ''; // Reset file input
        }
    }
    
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('action', 'upload_file');
        formData.append('file', file);
        formData.append('csrf_token', this.config.csrfToken);
        
        if (this.state.targetUser) {
            formData.append('target_user_id', this.state.targetUser.id);
        }
        
        const response = await fetch(this.config.apiEndpoints.messages, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to upload file');
        }
        
        return result.data;
    }
    
    handleSidebarSearch(query) {
        if (!query.trim()) {
            this.loadOnlineUsers();
            return;
        }
        
        this.searchUsers(query);
    }
    
    handleNewChatSearch(query) {
        if (!query.trim()) {
            document.getElementById('newChatUsers').innerHTML = '';
            return;
        }
        
        this.searchUsersForNewChat(query);
    }
    
    async searchUsers(query) {
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=search&query=${encodeURIComponent(query)}`);
            const result = await response.json();
            
            if (result.success) {
                this.state.onlineUsers = result.users || [];
                this.renderOnlineUsers();
            }
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }
    
    async searchUsersForNewChat(query) {
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=search&query=${encodeURIComponent(query)}`);
            const result = await response.json();
            
            if (result.success) {
                const users = result.users.filter(user => user.id !== this.state.currentUser.id);
                const container = document.getElementById('newChatUsers');
                
                if (container) {
                    container.innerHTML = users.map(user => this.createUserElement(user)).join('');
                }
            }
        } catch (error) {
            console.error('Failed to search users for new chat:', error);
        }
    }
    
    setupEmojiPicker() {
        if (typeof EmojiPicker !== 'undefined' && this.ui.emojiPickerContainer) {
            this.state.emojiPicker = new EmojiPicker({
                container: this.ui.emojiPickerContainer,
                onEmojiSelect: (emoji) => {
                    this.insertEmoji(emoji);
                    this.hideEmojiPicker();
                }
            });
        }
    }
    
    insertEmoji(emoji) {
        if (!this.ui.messageInput) return;
        
        const start = this.ui.messageInput.selectionStart;
        const end = this.ui.messageInput.selectionEnd;
        const text = this.ui.messageInput.value;
        
        this.ui.messageInput.value = text.slice(0, start) + emoji + text.slice(end);
        this.ui.messageInput.selectionStart = this.ui.messageInput.selectionEnd = start + emoji.length;
        this.ui.messageInput.focus();
        
        this.updateCharCounter();
        this.autoResizeTextarea();
    }
    
    showEmojiPicker() {
        if (this.ui.emojiPickerContainer) {
            this.ui.emojiPickerContainer.style.display = 'block';
            if (this.state.emojiPicker) {
                this.state.emojiPicker.render();
            }
        }
    }
    
    hideEmojiPicker() {
        if (this.ui.emojiPickerContainer) {
            this.ui.emojiPickerContainer.style.display = 'none';
        }
    }
    
    startPolling() {
        // Poll for new messages every 3 seconds
        this.timers.messagePolling = setInterval(() => {
            this.loadMessages();
        }, 3000);
        
        // Poll for online users every 30 seconds
        this.timers.userPolling = setInterval(() => {
            this.loadOnlineUsers();
        }, 30000);
    }
    
    scrollToBottom(smooth = true) {
        if (!this.ui.messagesContainer) return;
        
        const scrollOptions = {
            top: this.ui.messagesContainer.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        };
        
        this.ui.messagesContainer.scrollTo(scrollOptions);
    }
    
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatMessageContent(content) {
        // Escape HTML
        content = this.escapeHtml(content);
        
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // Convert line breaks
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setButtonLoading(button, loading) {
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        if (type === 'success') {
            toast.style.background = '#06d6a0';
        } else if (type === 'error') {
            toast.style.background = '#ef476f';
        } else {
            toast.style.background = '#667eea';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
    
    updateConnectionStatus(status) {
        this.state.connectionStatus = status;
        // Could show connection status in UI if needed
    }
    
    handleOnline() {
        this.updateConnectionStatus('connected');
        this.loadMessages();
        this.loadOnlineUsers();
    }
    
    handleOffline() {
        this.updateConnectionStatus('disconnected');
        this.showError('Connection lost. Some features may not work.');
    }
    
    handleVisibilityChange() {
        if (!document.hidden) {
            // User came back to the tab, refresh data
            this.loadMessages();
            this.loadOnlineUsers();
        }
    }
    
    cleanup() {
        // Clear all timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        
        // Clean up emoji picker
        if (this.state.emojiPicker && typeof this.state.emojiPicker.destroy === 'function') {
            this.state.emojiPicker.destroy();
        }
    }
}

// Global functions for backward compatibility and modal handling
window.chatApp = null;

function toggleMobileSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
}

function showAttachmentOptions() {
    const modal = document.getElementById('attachmentModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeAttachmentModal() {
    const modal = document.getElementById('attachmentModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectFiles(accept = '') {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.accept = accept;
        fileInput.click();
    }
}

function showNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.style.display = 'flex';
        const searchInput = document.getElementById('newChatSearch');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }
}

function closeNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('newChatUsers').innerHTML = '';
        document.getElementById('newChatSearch').value = '';
    }
}

function toggleEmojiPicker() {
    if (window.chatApp && window.chatApp.ui.emojiPickerContainer) {
        const container = window.chatApp.ui.emojiPickerContainer;
        if (container.style.display === 'none') {
            window.chatApp.showEmojiPicker();
        } else {
            window.chatApp.hideEmojiPicker();
        }
    }
}

function startDirectMessage(userId) {
    window.location.href = `chat-modern.php?user=${userId}`;
}

function toggleNotifications() {
    const icon = document.getElementById('notificationIcon');
    if (icon) {
        icon.classList.toggle('fa-bell');
        icon.classList.toggle('fa-bell-slash');
    }
}

function showChatSettings() {
    console.log('Show chat settings');
    // Implementation would go here
}

function showChatInfo() {
    console.log('Show chat info');
    // Implementation would go here
}

function toggleCall(type) {
    console.log(`Toggle ${type} call`);
    // Implementation would go here
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize chat app
    window.chatApp = new ModernChatApp();
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (window.chatApp) {
        window.chatApp.cleanup();
    }
});
