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
            
            // Add pagination support
            const limit = 50;
            const offset = this.state.messages.length;
            url.searchParams.set('limit', limit);
            url.searchParams.set('offset', offset);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const newMessages = result.data || [];
                
                // If this is initial load, replace messages
                if (offset === 0) {
                    this.state.messages = newMessages;
                } else {
                    // If loading more, prepend messages
                    this.state.messages = [...newMessages, ...this.state.messages];
                }
                
                this.renderMessages();
                
                // Auto-scroll to bottom on initial load
                if (offset === 0) {
                    this.scrollToBottom();
                }
                
                // Update last message time for polling
                if (newMessages.length > 0) {
                    this.state.lastMessageTime = new Date(newMessages[newMessages.length - 1].created_at).getTime();
                }
                
                return newMessages;
            } else {
                throw new Error(result.error || 'Failed to load messages');
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showError('Failed to load messages');
            throw error;
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
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=get_conversations`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.state.conversations = result.data || [];
                
                // Sort conversations by last message time
                this.state.conversations.sort((a, b) => {
                    const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                    const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                    return timeB - timeA; // Most recent first
                });
                
                this.renderConversations();
                
                // Load first conversation if none is selected
                if (!this.state.targetUser && this.state.conversations.length > 0) {
                    this.selectConversation(this.state.conversations[0]);
                }
                
            } else {
                // If API doesn't support conversations yet, create mock data from online users
                await this.createMockConversations();
            }
            
        } catch (error) {
            console.error('Failed to load conversations:', error);
            
            // Fallback to creating conversations from online users
            await this.createMockConversations();
        }
    }
    
    async createMockConversations() {
        try {
            // Load online users first
            await this.loadOnlineUsers();
            
            // Convert online users to conversations
            this.state.conversations = this.state.onlineUsers.map(user => ({
                id: `user_${user.id}`,
                type: 'direct',
                name: user.display_name || user.username,
                avatar: user.avatar,
                participants: [user],
                last_message: null,
                last_message_time: null,
                unread_count: 0,
                is_online: user.is_online,
                user_id: user.id
            }));
            
            this.renderConversations();
            
        } catch (error) {
            console.error('Failed to create mock conversations:', error);
        }
    }
    
    renderConversations() {
        if (!this.ui.conversationList) {
            console.warn('Conversation list container not found');
            return;
        }
        
        this.ui.conversationList.innerHTML = '';
        
        if (!this.state.conversations || this.state.conversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">No conversations yet</div>
                <div class="empty-state-subtext">Start a new conversation to get chatting!</div>
            `;
            this.ui.conversationList.appendChild(emptyState);
            return;
        }
        
        this.state.conversations.forEach(conversation => {
            const conversationEl = this.createConversationElement(conversation);
            this.ui.conversationList.appendChild(conversationEl);
        });
    }
    
    createConversationElement(conversation) {
        const el = document.createElement('div');
        el.className = `conversation-item ${conversation.unread_count > 0 ? 'unread' : ''}`;
        el.setAttribute('data-conversation-id', conversation.id);
        
        // Check if this is the active conversation
        if (this.state.targetUser && 
            ((conversation.type === 'direct' && conversation.user_id === this.state.targetUser.id) ||
             (conversation.type === 'group' && conversation.id === this.state.currentConversation?.id))) {
            el.classList.add('active');
        }
        
        const avatar = this.createConversationAvatar(conversation);
        const content = document.createElement('div');
        content.className = 'conversation-content';
        
        // Conversation name
        const name = document.createElement('div');
        name.className = 'conversation-name';
        name.textContent = conversation.name;
        content.appendChild(name);
        
        // Last message
        const lastMessage = document.createElement('div');
        lastMessage.className = 'conversation-last-message';
        
        if (conversation.last_message) {
            let messageText = conversation.last_message.content;
            
            // Handle different message types
            if (conversation.last_message.message_type !== 'text') {
                switch (conversation.last_message.message_type) {
                    case 'image':
                        messageText = '📷 Image';
                        break;
                    case 'video':
                        messageText = '🎥 Video';
                        break;
                    case 'audio':
                        messageText = '🎵 Audio';
                        break;
                    case 'document':
                        messageText = '📄 Document';
                        break;
                    default:
                        messageText = '📎 File';
                }
            }
            
            // Truncate long messages
            if (messageText.length > 50) {
                messageText = messageText.substring(0, 47) + '...';
            }
            
            lastMessage.textContent = messageText;
        } else {
            lastMessage.textContent = 'No messages yet';
            lastMessage.classList.add('no-messages');
        }
        
        content.appendChild(lastMessage);
        
        // Meta info (time, unread count)
        const meta = document.createElement('div');
        meta.className = 'conversation-meta';
        
        // Time
        if (conversation.last_message_time) {
            const time = document.createElement('div');
            time.className = 'conversation-time';
            time.textContent = this.formatConversationTime(conversation.last_message_time);
            meta.appendChild(time);
        }
        
        // Unread count
        if (conversation.unread_count > 0) {
            const unreadBadge = document.createElement('div');
            unreadBadge.className = 'unread-badge';
            unreadBadge.textContent = conversation.unread_count > 99 ? '99+' : conversation.unread_count;
            meta.appendChild(unreadBadge);
        }
        
        // Online indicator for direct conversations
        if (conversation.type === 'direct' && conversation.is_online) {
            const onlineIndicator = document.createElement('div');
            onlineIndicator.className = 'online-indicator';
            meta.appendChild(onlineIndicator);
        }
        
        // Assemble the conversation item
        el.appendChild(avatar);
        el.appendChild(content);
        el.appendChild(meta);
        
        // Add click handler
        el.addEventListener('click', () => {
            this.selectConversation(conversation);
        });
        
        // Add context menu
        el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showConversationContextMenu(e, conversation);
        });
        
        return el;
    }
    
    createConversationAvatar(conversation) {
        const avatar = document.createElement('div');
        avatar.className = 'conversation-avatar';
        
        if (conversation.type === 'group') {
            // Group avatar
            avatar.classList.add('group-avatar');
            avatar.innerHTML = '👥';
        } else {
            // User avatar
            if (conversation.avatar) {
                const img = document.createElement('img');
                img.src = conversation.avatar;
                img.alt = conversation.name;
                img.onerror = () => {
                    img.style.display = 'none';
                    avatar.textContent = conversation.name.charAt(0).toUpperCase();
                };
                avatar.appendChild(img);
            } else {
                avatar.textContent = conversation.name.charAt(0).toUpperCase();
            }
        }
        
        return avatar;
    }
    
    formatConversationTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Today - show time
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            // Yesterday
            return 'Yesterday';
        } else if (diffDays < 7) {
            // This week - show day
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            // Older - show date
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }
    
    selectConversation(conversation) {
        try {
            // Remove active class from all conversations
            const allConversations = this.ui.conversationList.querySelectorAll('.conversation-item');
            allConversations.forEach(el => el.classList.remove('active'));
            
            // Add active class to selected conversation
            const selectedEl = this.ui.conversationList.querySelector(`[data-conversation-id="${conversation.id}"]`);
            if (selectedEl) {
                selectedEl.classList.add('active');
            }
            
            // Update state
            this.state.currentConversation = conversation;
            
            if (conversation.type === 'direct') {
                // Set target user for direct conversations
                this.state.targetUser = {
                    id: conversation.user_id,
                    username: conversation.participants[0]?.username || conversation.name,
                    display_name: conversation.name,
                    avatar: conversation.avatar
                };
            } else {
                // Handle group conversations
                this.state.targetUser = null;
            }
            
            // Clear unread count for this conversation
            conversation.unread_count = 0;
            
            // Update conversation display
            this.renderConversations();
            
            // Load messages for this conversation
            this.state.messages = [];
            this.loadMessages();
            
            // Show chat interface
            this.showChatInterface();
            
            // Update page title
            document.title = `${conversation.name} - Quick Chat`;
            
            // Trigger custom event
            const event = new CustomEvent('conversationSelected', {
                detail: { conversation }
            });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('Failed to select conversation:', error);
        }
    }
    
    showChatInterface() {
        // Hide welcome screen if it exists
        if (this.ui.welcomeScreen) {
            this.ui.welcomeScreen.style.display = 'none';
        }
        
        // Show chat container
        if (this.ui.chatContainer) {
            this.ui.chatContainer.style.display = 'flex';
        }
        
        // Focus message input
        if (this.ui.messageInput) {
            this.ui.messageInput.focus();
        }
    }
    
    showConversationContextMenu(event, conversation) {
        // Implementation for conversation context menu
        // For now, just log the action
        console.log('Show context menu for conversation:', conversation.name);
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
    
    /**
     * Search users functionality
     */
    async searchUsers(query) {
        if (!query || query.trim().length < 2) {
            return [];
        }
        
        try {
            const url = new URL(`${this.config.apiEndpoints.users}`, window.location.origin);
            url.searchParams.set('action', 'search');
            url.searchParams.set('query', query.trim());
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                return result.users || [];
            } else {
                throw new Error(result.error || 'Search failed');
            }
        } catch (error) {
            console.error('Failed to search users:', error);
            this.showError('Failed to search users');
            return [];
        }
    }
    
    /**
     * Setup emoji picker functionality
     */
    setupEmojiPicker() {
        const emojiPickerContainer = this.ui.emojiPickerContainer;
        if (!emojiPickerContainer) return;
        
        // Create emoji picker structure
        const emojiCategories = {
            'smileys': {
                name: 'Smileys & Emotion',
                icon: '😀',
                emojis: [
                    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
                    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
                    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
                    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣'
                ]
            },
            'people': {
                name: 'People & Body',
                icon: '👋',
                emojis: [
                    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
                    '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
                    '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'
                ]
            },
            'nature': {
                name: 'Animals & Nature',
                icon: '🐶',
                emojis: [
                    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
                    '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦆'
                ]
            },
            'food': {
                name: 'Food & Drink',
                icon: '🍎',
                emojis: [
                    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒',
                    '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬'
                ]
            },
            'activities': {
                name: 'Activities',
                icon: '⚽',
                emojis: [
                    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
                    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳'
                ]
            },
            'objects': {
                name: 'Objects',
                icon: '💎',
                emojis: [
                    '💎', '🔔', '🔕', '🎵', '🎶', '💰', '💴', '💵', '💶', '💷',
                    '💸', '💳', '🧾', '💹', '📧', '📨', '📩', '📤', '📥', '📦'
                ]
            }
        };
        
        // Create emoji picker HTML
        let emojiPickerHTML = '<div class="emoji-picker-header">';
        
        // Add category tabs
        emojiPickerHTML += '<div class="emoji-categories">';
        for (const [categoryKey, category] of Object.entries(emojiCategories)) {
            emojiPickerHTML += `
                <button class="emoji-category-btn ${categoryKey === 'smileys' ? 'active' : ''}" 
                        data-category="${categoryKey}" title="${category.name}">
                    ${category.icon}
                </button>
            `;
        }
        emojiPickerHTML += '</div>';
        emojiPickerHTML += '</div>';
        
        // Add emoji grid container
        emojiPickerHTML += '<div class="emoji-grid-container">';
        for (const [categoryKey, category] of Object.entries(emojiCategories)) {
            emojiPickerHTML += `
                <div class="emoji-category-grid ${categoryKey === 'smileys' ? 'active' : ''}" 
                     data-category="${categoryKey}">
            `;
            
            category.emojis.forEach(emoji => {
                emojiPickerHTML += `
                    <button class="emoji-btn" data-emoji="${emoji}" title="${emoji}">
                        ${emoji}
                    </button>
                `;
            });
            
            emojiPickerHTML += '</div>';
        }
        emojiPickerHTML += '</div>';
        
        emojiPickerContainer.innerHTML = emojiPickerHTML;
        
        // Add event listeners
        this.setupEmojiPickerEvents();
    }
    
    /**
     * Setup emoji picker event handlers
     */
    setupEmojiPickerEvents() {
        const emojiPickerContainer = this.ui.emojiPickerContainer;
        if (!emojiPickerContainer) return;
        
        // Category tab switching
        emojiPickerContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-category-btn')) {
                const category = e.target.dataset.category;
                
                // Update active category button
                emojiPickerContainer.querySelectorAll('.emoji-category-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.category === category);
                });
                
                // Update active category grid
                emojiPickerContainer.querySelectorAll('.emoji-category-grid').forEach(grid => {
                    grid.classList.toggle('active', grid.dataset.category === category);
                });
            }
            
            // Emoji selection
            if (e.target.classList.contains('emoji-btn')) {
                const emoji = e.target.dataset.emoji;
                this.insertEmoji(emoji);
            }
        });
    }
    
    /**
     * Insert emoji into message input
     */
    insertEmoji(emoji) {
        const messageInput = this.ui.messageInput;
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart || messageInput.value.length;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        
        messageInput.value = textBefore + emoji + textAfter;
        
        // Set cursor position after emoji
        const newCursorPos = cursorPos + emoji.length;
        messageInput.setSelectionRange(newCursorPos, newCursorPos);
        messageInput.focus();
        
        // Update character counter and auto-resize
        this.updateCharCounter();
        this.autoResizeTextarea();
        
        // Hide emoji picker
        this.hideEmojiPicker();
    }
    
    /**
     * Start polling for new messages and updates
     */
    startPolling() {
        // Don't start polling if already active
        if (this.timers.messagePolling || this.timers.userPolling) {
            return;
        }
        
        // Poll for new messages every 3 seconds
        this.timers.messagePolling = setInterval(async () => {
            try {
                if (this.state.targetUser) {
                    await this.pollForNewMessages();
                }
            } catch (error) {
                console.error('Message polling error:', error);
            }
        }, 3000);
        
        // Poll for online users every 30 seconds
        this.timers.userPolling = setInterval(async () => {
            try {
                await this.loadOnlineUsers();
            } catch (error) {
                console.error('User polling error:', error);
            }
        }, 30000);
        
        // Poll for typing indicators every 2 seconds
        this.timers.typingPolling = setInterval(async () => {
            try {
                await this.pollTypingIndicators();
            } catch (error) {
                console.error('Typing polling error:', error);
            }
        }, 2000);
        
        console.log('Polling started');
    }
    
    /**
     * Stop all polling
     */
    stopPolling() {
        if (this.timers.messagePolling) {
            clearInterval(this.timers.messagePolling);
            this.timers.messagePolling = null;
        }
        
        if (this.timers.userPolling) {
            clearInterval(this.timers.userPolling);
            this.timers.userPolling = null;
        }
        
        if (this.timers.typingPolling) {
            clearInterval(this.timers.typingPolling);
            this.timers.typingPolling = null;
        }
        
        console.log('Polling stopped');
    }
    
    /**
     * Poll for new messages
     */
    async pollForNewMessages() {
        if (!this.state.targetUser) return;
        
        const lastMessageId = this.state.messages.length > 0 
            ? Math.max(...this.state.messages.map(m => m.id))
            : 0;
        
        try {
            const url = new URL(`${this.config.apiEndpoints.messages}`, window.location.origin);
            url.searchParams.set('action', 'get_new');
            url.searchParams.set('target_user_id', this.state.targetUser.id);
            url.searchParams.set('after_id', lastMessageId.toString());
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                    // Add new messages
                    this.state.messages.push(...result.data);
                    this.renderMessages();
                    this.scrollToBottom();
                    
                    // Show notification for new messages from others
                    result.data.forEach(message => {
                        if (message.user_id !== this.state.currentUser.id) {
                            this.showNewMessageNotification(message);
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Failed to poll for new messages:', error);
        }
    }
    
    /**
     * Poll for typing indicators
     */
    async pollTypingIndicators() {
        if (!this.state.targetUser) return;
        
        try {
            const url = new URL(`${this.config.apiEndpoints.messages}`, window.location.origin);
            url.searchParams.set('action', 'get_typing');
            url.searchParams.set('target_user_id', this.state.targetUser.id);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.updateTypingIndicator(result.is_typing || false);
                }
            }
        } catch (error) {
            console.error('Failed to poll typing indicators:', error);
        }
    }
    
    /**
     * Update typing indicator display
     */
    updateTypingIndicator(isTyping) {
        const typingIndicator = this.ui.typingIndicator;
        if (!typingIndicator) return;
        
        if (isTyping) {
            typingIndicator.style.display = 'block';
            typingIndicator.textContent = `${this.state.targetUser.display_name || this.state.targetUser.username} is typing...`;
        } else {
            typingIndicator.style.display = 'none';
        }
    }
    
    /**
     * Show notification for new message
     */
    showNewMessageNotification(message) {
        if (!this.config.notifications || document.hidden === false) {
            return; // Don't show notification if page is visible
        }
        
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(`${message.display_name || message.username}`, {
                body: message.content.substring(0, 100),
                icon: message.avatar || 'assets/images/default-avatar.png',
                tag: 'new-message'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
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
