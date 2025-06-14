/**
 * Enhanced Quick Chat Application
 * Version: 2025-06-15 - Complete refactor with improved architecture
 * Features: Real-time messaging, offline support, file uploads, notifications
 */
class QuickChatApp {
    constructor() {
        console.log('QuickChatApp v2025-06-15 initializing...');
        
        // Configuration
        this.config = {
            pollInterval: 3000,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxMessageLength: 2000,
            maxReconnectAttempts: 5,
            storagePrefix: 'quick_chat_',
            apiRetryDelay: 1000,
            ...window.ChatConfig
        };
        
        // Application state
        this.state = {
            user: null,
            messages: new Map(),
            isOnline: navigator.onLine,
            isVisible: !document.hidden,
            isLoggingIn: false,
            lastMessageId: null,
            reconnectAttempts: 0,
            soundEnabled: this.getStoredPreference('soundEnabled', true),
            theme: this.getStoredPreference('theme', 'light')
        };
        
        // Timers and intervals
        this.timers = {
            pollInterval: null,
            typingTimeout: null,
            reconnectTimeout: null
        };
        
        // Event handlers (bound to maintain context)
        this.boundHandlers = {
            visibilityChange: this.handleVisibilityChange.bind(this),
            onlineStatusChange: this.handleOnlineStatusChange.bind(this),
            beforeUnload: this.handleBeforeUnload.bind(this),
            messageInput: this.handleMessageInput.bind(this),
            keyboardShortcuts: this.handleKeyboardShortcuts.bind(this)
        };
        
        // CSRF token management
        this.csrfToken = this.getCSRFToken();
        
        // Initialize notifications permission
        this.initializeNotifications();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing QuickChat application...');
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize theme
            this.applyTheme(this.state.theme);
            
            // Clean up old storage data
            this.cleanupOldStorageData();
            
            // Initialize service worker
            await this.initializeServiceWorker();
            
            // Check authentication status
            await this.checkAuthenticationStatus();
            
            console.log('QuickChat application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Initialize Service Worker for offline support
     */
    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Initialize notifications
     */
    initializeNotifications() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log('Notification permission:', permission);
            });
        }
    }

    async initializeApp() {
        try {
            console.log('initializeApp started');
            
            // Test API connection first
            try {
                const testResponse = await fetch('api/auth-simple.php?action=test');
                const testText = await testResponse.text();
                console.log('API test response:', testText);
            } catch (testError) {
                console.error('API test failed:', testError);
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck.authenticated) {
                this.user = sessionCheck.user;
                console.log('User authenticated:', this.user.username);
                
                this.showChatInterface();
                
                // Now that user is set, load their cached messages first
                console.log('Loading cached messages for user...');
                const hasCachedMessages = this.loadMessagesFromStorage();
                if (hasCachedMessages && this.messages.length > 0) {
                    console.log(`Rendering ${this.messages.length} cached messages...`);
                    this.renderMessages();
                    this.scrollToBottom();
                }
                
                // Then load fresh messages from API (this will merge with cached)
                await this.loadMessages();
                
                // Ensure the method exists before calling it
                console.log('Checking startPeriodicUpdates method...');
                console.log('Method exists:', typeof this.startPeriodicUpdates === 'function');
                console.log('Method bound:', this.startPeriodicUpdates.name);
                
                if (typeof this.startPeriodicUpdates === 'function') {
                    console.log('Starting periodic updates...');
                    this.startPeriodicUpdates();
                } else {
                    console.error('startPeriodicUpdates method not found or not a function');
                    // Try to find the method manually
                    if (QuickChatApp.prototype.startPeriodicUpdates) {
                        console.log('Found method on prototype, calling manually...');
                        QuickChatApp.prototype.startPeriodicUpdates.call(this);
                    }
                }
            } else {
                console.log('User not authenticated, showing login interface');
                this.showLoginInterface();
            }
            
            this.bindEvents();
            
            this.bindEvents();
            
            // Initialize Service Worker inline (but don't let it interfere with login)
            console.log('Initializing Service Worker...');
            if ('serviceWorker' in navigator) {
                console.log('Service Worker support detected');
                try {
                    // Register service worker but don't wait for it
                    navigator.serviceWorker.register('sw.js').then(registration => {
                        console.log('Service Worker registered successfully:', registration);
                    }).catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
                } catch (error) {
                    console.log('Service Worker initialization error:', error);
                }
            }
            
            // Setup Notifications inline
            console.log('Setting up Notifications...');
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            console.log('Notifications setup complete');
            
            console.log('initializeApp completed successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }
    
    bindEvents() {
        // Authentication events
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const resetForm = document.getElementById('resetForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handlePasswordReset(e));
        }
        
        // Navigation events
        document.getElementById('showRegister')?.addEventListener('click', (e) => this.showRegisterForm(e));
        document.getElementById('showLogin')?.addEventListener('click', (e) => this.showLoginForm(e));
        document.getElementById('forgotPassword')?.addEventListener('click', (e) => this.showResetForm(e));
        document.getElementById('backToLogin')?.addEventListener('click', (e) => this.showLoginForm(e));
        
        // Chat events
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }
        
        if (fileBtn) {
            fileBtn.addEventListener('click', () => fileInput?.click());
        }
        
        if (clearChatBtn) {
            clearChatBtn.addEventListener('click', () => this.clearChat());
        }
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // UI events
        document.getElementById('attachBtn')?.addEventListener('click', () => fileInput?.click());
        document.getElementById('emojiBtn')?.addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('clearChatBtn')?.addEventListener('click', () => this.clearChat());

        // Theme: set initial theme from localStorage
        const html = document.documentElement;
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        
        // Window events
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
        
        // Only cleanup on actual site exit, not page refresh or internal navigation
        window.addEventListener('pagehide', (e) => {
            // Only send logout if the page is being discarded permanently
            if (!e.persisted && this.user) {
                this.cleanup();
            }
        });
        
        window.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Password strength checker
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            if (input.name === 'password' || input.name === 'regPassword') {
                input.addEventListener('input', (e) => this.checkPasswordStrength(e.target));
            }
        });
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        try {
            this.setButtonLoading(submitBtn, true);
            this.isLoggingIn = true; // Set flag to prevent cleanup
            
            console.log('=== LOGIN DEBUG START ===');
            console.log('Sending login request...');
            
            const response = await fetch('api/auth-simple.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin' // Ensure cookies are sent
            });
            
            console.log('Login response status:', response.status);
            console.log('Login response headers:', Array.from(response.headers.entries()));
            
            const responseText = await response.text();
            console.log('Raw login response:', responseText);
            console.log('Response length:', responseText.length);
            
            // Check if response is empty
            if (!responseText || responseText.trim() === '') {
                console.error('Empty response from login API');
                this.showError('Server returned empty response. Please check server logs.');
                return;
            }
            
            let result;
            try {
                result = JSON.parse(responseText);
                console.log('Parsed login response:', result);
            } catch (jsonError) {
                console.error('Failed to parse login JSON response:', jsonError);
                console.error('First 500 chars of response:', responseText.substring(0, 500));
                this.showError('Invalid server response. Please check server logs.');
                return;
            }
            
            if (result.success) {
                this.user = result.user;
                console.log('User set to:', this.user);
                
                // Update CSRF token if provided in response
                if (result.csrf_token) {
                    console.log('Updating CSRF token from login response');
                    this.updateCSRFToken(result.csrf_token);
                }
                
                this.showSuccess(result.message);
                
                console.log('About to show chat interface...');
                // Don't use setTimeout for critical login flow
                // Immediately switch to chat interface instead of redirect
                this.showChatInterface();
                
                // Rebind events for the new chat interface
                this.bindChatEvents();
                
                console.log('Loading messages...');
                try {
                    await this.loadMessages();
                } catch (loadError) {
                    console.error('Failed to load messages after login:', loadError);
                    // Show welcome message instead of failing completely
                    this.showWelcomeMessage();
                }
                
                console.log('Starting periodic updates...');
                this.startPeriodicUpdates();
                
                console.log('=== LOGIN DEBUG END - SUCCESS ===');
                
            } else {
                console.log('Login failed:', result.error);
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        } finally {
            this.setButtonLoading(submitBtn, false);
            this.isLoggingIn = false; // Clear flag
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Client-side validation
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        
        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }
        
        if (!this.isPasswordStrong(password)) {
            this.showError('Password does not meet security requirements');
            return;
        }
        
        try {
            this.setButtonLoading(submitBtn, true);
            
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess(result.message);
                setTimeout(() => this.showLoginForm(), 2000);
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Registration failed. Please try again.');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }
    
    async handlePasswordReset(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        try {
            this.setButtonLoading(submitBtn, true);
            
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess(result.message);
                setTimeout(() => this.showLoginForm(), 2000);
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Password reset failed. Please try again.');
        } finally {
            this.setButtonLoading(submitBtn, false);
        }
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;
        
        const content = messageInput.value.trim();
        if (!content) return;
        
        console.log('Sending message:', content);
        
        try {
            // Create FormData for API request
            const formData = new FormData();
            formData.append('action', 'send');
            formData.append('content', content);
            formData.append('csrf_token', this.getCSRFToken());
            
            // Send to API
            const response = await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Add message to local array and UI
                const message = result.data;
                this.messages.push(message);
                this.addMessageToUI(message);
                this.lastMessageId = message.id;
                
                // Save to localStorage
                this.saveMessagesToStorage();
                
                messageInput.value = '';
                this.updateCharacterCount();
                this.scrollToBottom();
                
                console.log('Message sent successfully');
            } else {
                console.error('API error:', result.error);
                
                // Fallback: add message locally even if API fails
                const message = {
                    id: Date.now(),
                    user_id: this.user.id,
                    username: this.user.username,
                    content: content,
                    created_at: new Date().toISOString(),
                    message_type: 'text',
                    is_local: true // Mark as local-only message
                };
                
                this.messages.push(message);
                this.addMessageToUI(message);
                this.saveMessagesToStorage();
                
                messageInput.value = '';
                this.updateCharacterCount();
                this.scrollToBottom();
                
                this.showError('Message sent locally (server unavailable)');
            }
            
        } catch (error) {
            console.error('Send message error:', error);
            
            // Fallback: add message locally
            const message = {
                id: Date.now(),
                user_id: this.user.id,
                username: this.user.username,
                content: content,
                created_at: new Date().toISOString(),
                message_type: 'text',
                is_local: true
            };
            
            this.messages.push(message);
            this.addMessageToUI(message);
            this.saveMessagesToStorage();
            
            messageInput.value = '';
            this.updateCharacterCount();
            this.scrollToBottom();
            
            this.showError('Message sent locally (offline mode)');
        }
    }
    
    async loadMessages() {
        try {
            console.log('Loading messages...');
            
            // Check if we already have messages loaded from cache
            const hadCachedMessages = this.messages.length > 0;
            const cachedMessageIds = hadCachedMessages ? new Set(this.messages.map(msg => msg.id)) : new Set();
            
            // If we don't have cached messages, try to load from localStorage for current user
            if (!hadCachedMessages) {
                const hasStoredMessages = this.loadMessagesFromStorage();
                
                if (hasStoredMessages && this.messages.length > 0) {
                    console.log('Found stored messages, rendering...');
                    this.renderMessages();
                    this.scrollToBottom();
                    
                    // Update lastMessageId from stored messages
                    if (this.messages.length > 0) {
                        this.lastMessageId = this.messages[this.messages.length - 1].id;
                    }
                }
            }
            
            // Then try to load fresh messages from API
            console.log('Loading fresh messages from API...');
            const response = await fetch(`api/messages.php?action=list&limit=50`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Messages API response:', result);
            
            if (result.success) {
                const freshMessages = result.data || [];
                console.log(`Loaded ${freshMessages.length} messages from API`);
                
                // Merge with existing messages (avoid duplicates)
                if (this.messages.length > 0) {
                    const existingIds = new Set(this.messages.map(msg => msg.id));
                    const newMessages = freshMessages.filter(msg => !existingIds.has(msg.id));
                    
                    if (newMessages.length > 0) {
                        // Add new messages and sort by timestamp/id
                        this.messages = [...this.messages, ...newMessages];
                        this.messages.sort((a, b) => {
                            // Sort by id if available, otherwise by created_at
                            if (a.id && b.id) return a.id - b.id;
                            return new Date(a.created_at) - new Date(b.created_at);
                        });
                        console.log(`Added ${newMessages.length} new messages`);
                    }
                } else {
                    this.messages = freshMessages;
                }
                
                // Save updated messages to localStorage
                this.saveMessagesToStorage();
                
                // Re-render if we got new messages or had no stored messages
                if (!hadCachedMessages || freshMessages.some(msg => !cachedMessageIds.has(msg.id))) {
                    this.renderMessages();
                    this.scrollToBottom();
                }
                
                if (this.messages.length > 0) {
                    this.lastMessageId = Math.max(...this.messages.map(msg => msg.id || 0));
                }
            } else {
                console.warn('Load messages failed:', result.error);
                // If API failed but we have cached messages, use those
                if (this.messages.length === 0) {
                    this.showWelcomeMessage();
                }
            }
            
        } catch (error) {
            console.error('Load messages error:', error);
            
            // If we have cached messages, show them even if API failed
            if (this.messages.length > 0) {
                console.log('Using cached messages due to API error');
                if (!hadCachedMessages) {
                    this.renderMessages();
                    this.scrollToBottom();
                }
            } else {
                this.showWelcomeMessage();
            }
        }
    }
    
    async handleFileUpload(e) {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;
        
        for (const file of files) {
            await this.uploadFile(file);
        }
        
        // Clear input
        e.target.value = '';
    }
    
    async uploadFile(file) {
        // Validate file
        if (file.size > this.config.maxFileSize) {
            this.showError('File size exceeds maximum allowed size');
            return;
        }
        
        const formData = new FormData();
        formData.append('action', 'upload_file');
        formData.append('file', file);
        formData.append('csrf_token', this.getCSRFToken());
        
        try {
            this.showFileUploadProgress(file.name, 0);
            
            const response = await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.addMessageToUI(result.data);
                this.scrollToBottom();
                this.showSuccess('File uploaded successfully');
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Failed to upload file');
        } finally {
            this.hideFileUploadProgress();
        }
    }
    
    renderMessages() {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        // Clear existing messages
        container.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }
        
        this.messages.forEach(message => {
            this.addMessageToUI(message, false);
        });
    }
    
    addMessageToUI(message, animate = true) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        // Remove welcome message if it exists
        const welcomeMsg = container.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        
        const messageElement = this.createMessageElement(message);
        
        if (animate) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
        }
        
        container.appendChild(messageElement);
        
        if (animate) {
            requestAnimationFrame(() => {
                messageElement.style.transition = 'all 0.3s ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            });
        }
    }
    
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.user_id == this.user.id ? 'sent' : 'received'}`;
        messageDiv.dataset.messageId = message.id;
        
        const time = new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let content = '';
        
        switch (message.message_type) {
            case 'text':
                content = `
                    <div class="message-avatar">
                        ${message.avatar ? `<img src="${message.avatar}" alt="Avatar">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(message.display_name || message.username)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-text">${this.formatMessageText(message.content)}</div>
                        ${message.edited_at ? '<span class="message-edited">(edited)</span>' : ''}
                        ${this.createReactionsHTML(message.reactions)}
                    </div>
                `;
                break;
                
            case 'image':
                content = `
                    <div class="message-avatar">
                        ${message.avatar ? `<img src="${message.avatar}" alt="Avatar">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(message.display_name || message.username)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-image">
                            <img src="${message.file_url}" alt="${this.escapeHtml(message.content)}" onclick="this.showImageModal('${message.file_url}')">
                        </div>
                        ${this.createReactionsHTML(message.reactions)}
                    </div>
                `;
                break;
                
            case 'audio':
                content = `
                    <div class="message-avatar">
                        ${message.avatar ? `<img src="${message.avatar}" alt="Avatar">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(message.display_name || message.username)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-audio">
                            <audio controls>
                                <source src="${message.file_url}" type="${message.file_type}">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                        ${this.createReactionsHTML(message.reactions)}
                    </div>
                `;
                break;
                
            default:
                content = `
                    <div class="message-avatar">
                        ${message.avatar ? `<img src="${message.avatar}" alt="Avatar">` : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-author">${this.escapeHtml(message.display_name || message.username)}</span>
                            <span class="message-time">${time}</span>
                        </div>
                        <div class="message-file">
                            <i class="fas fa-file"></i>
                            <a href="${message.file_url}" download="${this.escapeHtml(message.content)}">
                                ${this.escapeHtml(message.content)}
                            </a>
                        </div>
                        ${this.createReactionsHTML(message.reactions)}
                    </div>
                `;
        }
        
        messageDiv.innerHTML = content;
        
        // Add context menu for message actions
        messageDiv.addEventListener('contextmenu', (e) => this.showMessageContextMenu(e, message));
        
        return messageDiv;
    }
    
    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatMessageText(text) {
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Convert line breaks
        text = text.replace(/\n/g, '<br>');
        
        // Convert emojis (basic implementation)
        text = this.convertEmojis(text);
        
        return text;
    }
    
    convertEmojis(text) {
        // Basic emoji conversion - in production, use a proper emoji library
        const emojiMap = {
            ':)': '😊',
            ':(': '😢',
            ':D': '😃',
            ':P': '😛',
            ':|': '😐',
            '<3': '❤️'
        };
        
        Object.keys(emojiMap).forEach(emoticon => {
            text = text.replace(new RegExp(this.escapeRegex(emoticon), 'g'), emojiMap[emoticon]);
        });
        
        return text;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    createReactionsHTML(reactions) {
        if (!reactions || reactions.length === 0) return '';
        
        let html = '<div class="message-reactions">';
        reactions.forEach(reaction => {
            html += `<span class="reaction" onclick="app.toggleReaction(${message.id}, '${reaction.reaction}')">
                ${reaction.reaction} ${reaction.count}
            </span>`;
        });
        html += '</div>';
        
        return html;
    }
    
    getCSRFToken() {
        // Try to get from meta tag first
        const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (metaToken) {
            console.log('Using CSRF token from meta tag');
            return metaToken;
        }
        
        // If not found in meta tag, try to get from stored token
        console.log('Using stored CSRF token');
        return this.csrfToken || '';
    }

    updateCSRFToken(newToken) {
        if (newToken) {
            console.log('Updating CSRF token');
            this.csrfToken = newToken;
            // Update meta tag as well
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            if (metaTag) {
                metaTag.setAttribute('content', newToken);
            }
        }
    }

    async refreshCSRFToken() {
        try {
            console.log('Attempting to refresh CSRF token...');
            const response = await fetch('api/auth.php?action=get_csrf_token');
            const result = await response.json();
            if (result.success && result.csrf_token) {
                console.log('CSRF token refreshed successfully');
                this.updateCSRFToken(result.csrf_token);
                return result.csrf_token;
            }
        } catch (error) {
            console.error('Failed to refresh CSRF token:', error);
        }
        return null;
    }
    
    showError(message) {
        this.showToast(message, 'error');
    }
    
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        } catch (error) { `toast toast-${type}`;
            console.error('Failed to refresh CSRF token:', error);
        }   <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        return null;this.escapeHtml(message)}</span>
    }       <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
    showError(message) {
        this.showToast(message, 'error');
    }   
        container.appendChild(toast);
    showSuccess(message) {
        this.showToast(message, 'success');
    }   setTimeout(() => {
            if (toast.parentElement) {
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>erHTML;
            <button class="toast-close" onclick="this.parentElement.remove()">...';
                <i class="fas fa-times"></i>
            </button>sabled = false;
        `;  button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {document.getElementById('messagesContainer');
            if (toast.parentElement) {
                toast.remove(); = container.scrollHeight;
            }
        }, 5000);
    }
    updateCharacterCount() {
    setButtonLoading(button, loading) {etElementById('messageInput');
        if (loading) {t = document.getElementById('charCount');
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {Count.textContent = length;
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }   if (length > 1800) {
    }           charCount.style.color = '#dc3545'; // Red
            } else if (length > 1500) {
    scrollToBottom() {unt.style.color = '#ffc107'; // Yellow
        const container = document.getElementById('messagesContainer');
        if (container) {t.style.color = ''; // Default
            container.scrollTop = container.scrollHeight;
        }
    }
    
    updateCharacterCount() {en DOM is loaded
        const messageInput = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
            console.log('Checking session...');
        if (messageInput && charCount) {('api/auth-simple.php?action=check_session', {
            const length = messageInput.value.length;
            charCount.textContent = length;
                headers: {
            // Update color based on limitache'
            if (length > 1800) {
                charCount.style.color = '#dc3545'; // Red
            } else if (length > 1500) {
                charCount.style.color = '#ffc107'; // Yellow;
            } else {log('Response headers:', Array.from(response.headers.entries()));
                charCount.style.color = ''; // Default
            }/ Log the raw response for debugging
        }   const responseText = await response.text();
    }       console.log('Raw response from check_session:', responseText);
            console.log('Response length:', responseText.length);
    // Initialize the app when DOM is loaded
    async checkSession() {sponse is empty or not JSON
        try {f (!responseText || responseText.trim() === '') {
            console.log('Checking session...');rom server');
            const response = await fetch('api/auth-simple.php?action=check_session', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {e as JSON
                    'Cache-Control': 'no-cache'
                }onst parsed = JSON.parse(responseText);
            }); console.log('Parsed response:', parsed);
                return parsed;
            console.log('Response status:', response.status);
            console.log('Response headers:', Array.from(response.headers.entries()));
                console.error('Response text:', responseText);
            // Log the raw response for debugging responseText.substring(0, 500));
            const responseText = await response.text();Invalid server response' };
            console.log('Raw response from check_session:', responseText);
            console.log('Response length:', responseText.length);
            console.error('Session check failed:', error);
            // Check if response is empty or not JSON
            if (!responseText || responseText.trim() === '') {
                console.error('Empty response from server');
                return { authenticated: false, error: 'Empty server response' };
            }Interface() {
            ment.getElementById('loginScreen')?.classList.add('active');
            // Try to parse as JSONatScreen')?.classList.remove('active');
            try {
                const parsed = JSON.parse(responseText);
                console.log('Parsed response:', parsed);
                return parsed;cument.getElementById('loginScreen');
            } catch (jsonError) {.getElementById('chatScreen');
                console.error('Failed to parse JSON response:', jsonError);
                console.error('Response text:', responseText);
                console.error('First 500 chars:', responseText.substring(0, 500));
                return { authenticated: false, error: 'Invalid server response' };
            }hatScreen = this.createChatInterface();
        } catch (error) {.appendChild(chatScreen);
            console.error('Session check failed:', error);
            return { authenticated: false };
        }/ Hide login screen and show chat screen
    }   if (loginScreen) {
            loginScreen.classList.remove('active');
    showLoginInterface() {yle.display = 'none';
        document.getElementById('loginScreen')?.classList.add('active');
        document.getElementById('chatScreen')?.classList.remove('active');
    }   chatScreen.classList.add('active');
        chatScreen.style.display = 'block';
    showChatInterface() {
        const loginScreen = document.getElementById('loginScreen');
        let chatScreen = document.getElementById('chatScreen');r');
        if (userElement && this.user) {
        // If chat screen doesn't exist, create it dynamically| this.user.username;
        if (!chatScreen) {
            console.log('Creating chat interface dynamically...');
            chatScreen = this.createChatInterface();;
            document.body.appendChild(chatScreen);
        }
        WelcomeMessage() {
        // Hide login screen and show chat screen no messages at all
        if (loginScreen) {&& this.messages.length > 0) {
            loginScreen.classList.remove('active'); messages exist');
            loginScreen.style.display = 'none';
        }
        
        chatScreen.classList.add('active');ntById('messagesContainer');
        chatScreen.style.display = 'block';
            container.innerHTML = `
        // Update user info"welcome-message">
        const userElement = document.getElementById('currentUser');
        if (userElement && this.user) {k Chat!</h3>
            userElement.textContent = this.user.display_name || this.user.username;
        }           <div class="online-users">
                        <h4>Online Users</h4>
        console.log('Chat interface is now visible');
    }                       <div class="user-item">
                                <span class="user-avatar"><i class="fas fa-user"></i></span>
    showWelcomeMessage() {      <span class="user-name">${this.user ? this.user.display_name || this.user.username : 'You'}</span>
        // Only show welcome message if there are no messages at alline</span>
        if (this.messages && this.messages.length > 0) {
            console.log('Skipping welcome message - messages exist');
            return; </div>
        }       </div>
            `;
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Quick Chat!</h3>div');
                    <p>Start a conversation by typing a message below.</p>
                    <div class="online-users">
                        <h4>Online Users</h4>
                        <div id="onlineUsersList">
                            <div class="user-item">
                                <span class="user-avatar"><i class="fas fa-user"></i></span>
                                <span class="user-name">${this.user ? this.user.display_name || this.user.username : 'You'}</span>
                                <span class="user-status online">Online</span>
                            </div>="user-avatar">
                        </div> class="fas fa-user"></i>
                    </div>div>
                </div>  <div class="user-details">
            `;              <h3 id="currentUser">${this.user ? (this.user.display_name || this.user.username) : 'User'}</h3>
            console.log('Welcome message displayed');e" id="userStatus">Online</span>
        }               </div>
    }               </div>
                    
    createChatInterface() {ass="chat-actions">
        const chatScreen = document.createElement('div');ction-btn" title="Toggle Theme">
        chatScreen.id = 'chatScreen';"fas fa-moon"></i>
        chatScreen.className = 'screen';
                        <button id="settingsBtn" class="action-btn" title="Settings">
        chatScreen.innerHTML = `lass="fas fa-cog"></i>
            <div class="chat-container">
                <!-- Chat Header -->clearChatBtn" class="action-btn" title="Clear Chat">
                <div class="chat-header"> fa-trash"></i>
                    <div class="user-info">
                        <div class="user-avatar">ass="action-btn" title="Logout" onclick="confirmLogout()">
                            <i class="fas fa-user"></i>lt"></i>
                        </div>on>
                        <div class="user-details">
                            <h3 id="currentUser">${this.user ? (this.user.display_name || this.user.username) : 'User'}</h3>
                            <span class="status online" id="userStatus">Online</span>
                        </div>Container -->
                    </div>="messages-container" id="messagesContainer">
                    <!-- Messages will be loaded here -->
                    <div class="chat-actions">
                        <button id="themeToggle" class="action-btn" title="Toggle Theme">
                            <i class="fas fa-moon"></i>
                        </button>ge-input-container">
                        <button id="settingsBtn" class="action-btn" title="Settings">
                            <i class="fas fa-cog"></i>nput-btn" title="Emoji">
                        </button>ass="fas fa-smile"></i>
                        <button id="clearChatBtn" class="action-btn" title="Clear Chat">
                            <i class="fas fa-trash"></i>
                        </button>s="message-input-area">
                        <button id="logoutBtn" class="action-btn" title="Logout" onclick="confirmLogout()">"2000"></textarea>
                            <i class="fas fa-sign-out-alt"></i>
                        </button>span id="charCount">0</span>/2000
                    </div>  </div>
                </div>  </div>
                        
                <!-- Messages Container -->id="fileInput" accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx" multiple style="display: none;">
                <div class="messages-container" id="messagesContainer">ttach File">
                    <!-- Messages will be loaded here -->/i>
                </div>  </button>
                        
                <!-- Message Input -->dioBtn" class="input-btn" title="Voice Message">
                <div class="message-input-container">ne"></i>
                    <div class="message-input-wrapper">
                        <button id="emojiBtn" class="input-btn" title="Emoji">
                            <i class="fas fa-smile"></i>-btn" title="Send Message">
                        </button>ass="fas fa-paper-plane"></i>
                        </button>
                        <div class="message-input-area">
                            <textarea id="messageInput" placeholder="Type a message..." rows="1" maxlength="2000"></textarea>
                            <div class="char-count">" id="fileUploadProgress" style="display: none;">
                                <span id="charCount">0</span>/2000
                            </div>lass="progress-fill" id="progressFill"></div>
                        </div>
                        <span class="progress-text" id="progressText"></span>
                        <input type="file" id="fileInput" accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx" multiple style="display: none;">
                        <button id="fileBtn" class="input-btn" title="Attach File">
                            <i class="fas fa-paperclip"></i>
                        </button>
                        ontainer -->
                        <button id="audioBtn" class="input-btn" title="Voice Message">
                            <i class="fas fa-microphone"></i>
                        </button>
                        n;
                        <button id="sendBtn" class="send-btn" title="Send Message">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>ng chat events...');
                    
                    <div class="file-upload-progress" id="fileUploadProgress" style="display: none;">
                        <div class="progress-bar">Id('messageInput');
                            <div class="progress-fill" id="progressFill"></div>
                        </div>ment.getElementById('fileInput');
                        <span class="progress-text" id="progressText"></span>
                    </div> = document.getElementById('clearChatBtn');
                </div>gle = document.getElementById('themeToggle');
            </div>
            messageInput) {
            <!-- Toast Container -->tener('keydown', (e) => this.handleMessageInput(e));
            <div id="toastContainer" class="toast-container"></div>eTyping());
        `;  messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        return chatScreen;
    }   if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
    bindChatEvents() {
        console.log('Binding chat events...');
        if (fileInput) {
        // Chat eventsaddEventListener('change', (e) => this.handleFileUpload(e));
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');ut?.click());
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        if (clearChatBtn) {
        if (messageInput) {dEventListener('click', () => this.clearChat());
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }   themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }
        
        if (fileInput) {) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }   e.preventDefault();
            this.sendMessage();
        if (fileBtn) {
            fileBtn.addEventListener('click', () => fileInput?.click());
        }
        leTyping() {
        if (clearChatBtn) {rCount();
            clearChatBtn.addEventListener('click', () => this.clearChat());
        }
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }etTimeout(() => this.updateCharacterCount(), 10);
        
        console.log('Chat events bound successfully');
    }learChat() {
        if (confirm('Are you sure you want to clear all messages?\n\nThis will permanently delete your chat history and cannot be undone.\n\nNote: Messages are normally saved even after closing/refreshing the page until you clear them.')) {
    handleMessageInput(e) { = document.getElementById('messagesContainer');
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();HTML = '';
            this.sendMessage(); [];
        }       this.lastMessageId = null;
    }           
                // Clear from localStorage for current user
    handleTyping() {.clearMessagesFromStorage();
        this.updateCharacterCount();
        // Could add typing indicators here later
    }           this.showWelcomeMessage();
                
    handlePaste(e) {ole.log(`Chat cleared from UI and localStorage for user ${this.user?.username || 'unknown'}`);
        // Could add paste handling for images here laterrmanently');
        setTimeout(() => this.updateCharacterCount(), 10);
    }   }
    }
    clearChat() {
        if (confirm('Are you sure you want to clear all messages?\n\nThis will permanently delete your chat history and cannot be undone.\n\nNote: Messages are normally saved even after closing/refreshing the page until you clear them.')) {
            const container = document.getElementById('messagesContainer');
            if (container) {e('data-theme') === 'dark') {
                container.innerHTML = '';eme');
                this.messages = [];hat_theme', 'light');
                this.lastMessageId = null;
                .setAttribute('data-theme', 'dark');
                // Clear from localStorage for current user
                this.clearMessagesFromStorage();
                
                // Show welcome message
                this.showWelcomeMessage();
                log('Starting periodic updates...');
                console.log(`Chat cleared from UI and localStorage for user ${this.user?.username || 'unknown'}`);
                this.showSuccess('Chat history cleared permanently');
            }his.pollInterval) {
        }   clearInterval(this.pollInterval);
    }   }
        
    toggleTheme() {terval = setInterval(async () => {
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'dark') {
            html.removeAttribute('data-theme');ges();
            localStorage.setItem('chat_theme', 'light');
        } else {    console.error('Error checking for new messages:', error);
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('chat_theme', 'dark');
        }, this.config.pollInterval || 5000);
    }
    
    handleVisibilityChange() {
        this.isVisible = !document.hidden;
            clearInterval(this.pollInterval);
        if (this.isVisible) { = null;
            // User is back - resume updates
            this.startPeriodicUpdates();
        } else {
            // User is away - reduce update frequency or pause
            this.stopPeriodicUpdates();
        }   const response = await fetch(`api/messages.php?action=list&limit=50&after_id=${this.lastMessageId || 0}`);
            const result = await response.json();
        console.log('Visibility changed:', this.isVisible ? 'visible' : 'hidden');
    }       if (result.success && result.data && result.data.length > 0) {
                result.data.forEach(message => {
    handleOnlineStatus(isOnline) {ssage is not already in our array
        this.isOnline = isOnline;sages.find(m => m.id === message.id)) {
                        this.messages.push(message);
        // Update UI to show online/offline statuse, true);
        const statusElement = document.getElementById('userStatus');geId || 0, message.id);
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
        }       // Save updated messages to localStorage
                this.saveMessagesToStorage();
        if (isOnline) {rollToBottom();
            // Reconnected - resume updates and sync messages
            this.startPeriodicUpdates();
            this.checkForNewMessages();ng for new messages:', error);
            this.showSuccess('Connection restored');
        } else {
            // Offline - stop updates
            this.stopPeriodicUpdates();r persistence (per user)
            this.showError('Connection lost - working offline');
        }ry {
            if (!this.user) return;
        console.log('Online status changed:', isOnline);
    }       const messagesData = {
                messages: this.messages,
    async logout() {MessageId: this.lastMessageId,
        try {   timestamp: Date.now(),
            console.log('Logging out...');
                username: this.user.username
            // Stop all background processes
            this.stopPeriodicUpdates();hat_messages_${this.user.id}`;
            localStorage.setItem(storageKey, JSON.stringify(messagesData));
            // Send logout request to serverocalStorage for user ${this.user.username}`);
            const formData = new FormData();
            formData.append('action', 'logout'); to localStorage:', error);
            formData.append('csrf_token', this.getCSRFToken());
            
            const response = await fetch('api/auth-simple.php', {
                method: 'POST',Storage (per user or general)
                body: formData,rId = null) {
                credentials: 'same-origin'
            });Use provided userId or current user id
            const userIdToUse = userId || (this.user ? this.user.id : null);
            const result = await response.json();
            if (!userIdToUse) {
            if (result.success) {available, try to find any recent chat data
                console.log('Server logout successful');ng for recent chat data...');
            } else {t allKeys = Object.keys(localStorage);
                console.warn('Server logout failed:', result.error);h('quick_chat_messages_'));
            }   
                if (chatKeys.length > 0) {
        } catch (error) {nd the most recent chat data
            console.error('Logout request failed:', error);
        } finally { let mostRecentKey = null;
            // Always clean up locally regardless of server response
            this.cleanup();
                    chatKeys.forEach(key => {
            // Redirect to login page
            if (window.location.pathname !== '/index.php') {rage.getItem(key));
                window.location.href = '/index.php';ta.timestamp > mostRecentTime) {
            } else {            mostRecentTime = data.timestamp;
                window.location.reload();tData = data;
            }                   mostRecentKey = key;
        }                   }
    }                   } catch (e) {
                            console.error(`Error parsing stored data for key ${key}:`, e);
    // Save messages to localStorage for persistence (per user)
    saveMessagesToStorage() {
        try {       
            if (!this.user) return;ata) {
                        this.messages = mostRecentData.messages || [];
            const messagesData = {essageId = mostRecentData.lastMessageId || null;
                messages: this.messages,ded ${this.messages.length} messages from most recent localStorage (${mostRecentKey})`);
                lastMessageId: this.lastMessageId,
                timestamp: Date.now(),
                userId: this.user.id,
                username: this.user.username
            };
            const storageKey = `quick_chat_messages_${this.user.id}`;
            localStorage.setItem(storageKey, JSON.stringify(messagesData));
            console.log(`Messages saved to localStorage for user ${this.user.username}`);
        } catch (error) {
            console.error('Error saving messages to localStorage:', error);
        }       // Verify data belongs to the specified user (if we have user context)
    }           if (!this.user || messagesData.userId === userIdToUse) {
                    this.messages = messagesData.messages || [];
    // Load messages from localStorage (per user or general)ssageId || null;
    loadMessagesFromStorage(userId = null) {is.messages.length} messages from localStorage for user ${messagesData.username || userIdToUse}`);
        try {       return true;
            // Use provided userId or current user id
            const userIdToUse = userId || (this.user ? this.user.id : null);
            tch (error) {
            if (!userIdToUse) {r loading messages from localStorage:', error);
                // If no user ID available, try to find any recent chat data
                console.log('No user ID available, looking for recent chat data...');
                const allKeys = Object.keys(localStorage);
                const chatKeys = allKeys.filter(key => key.startsWith('quick_chat_messages_'));
                sages from localStorage (per user)
                if (chatKeys.length > 0) {
                    // Find the most recent chat data
                    let mostRecentData = null;
                    let mostRecentKey = null;
                    let mostRecentTime = 0;messages_${this.user.id}`;
                    rage.removeItem(storageKey);
                    chatKeys.forEach(key => {m localStorage for user ${this.user.username}`);
                        try {
                            const data = JSON.parse(localStorage.getItem(key));
                            if (data.timestamp && data.timestamp > mostRecentTime) {
                                mostRecentTime = data.timestamp;
                                mostRecentData = data;
                                mostRecentKey = key;versions or other users
                            }
                        } catch (e) {
                            console.error(`Error parsing stored data for key ${key}:`, e);
                        }age.getItem('quick_chat_messages')) {
                    });.log('Removing old single-user storage data');
                    lStorage.removeItem('quick_chat_messages');
                    if (mostRecentData) {
                        this.messages = mostRecentData.messages || [];
                        this.lastMessageId = mostRecentData.lastMessageId || null;agement
                        console.log(`Loaded ${this.messages.length} messages from most recent localStorage (${mostRecentKey})`);
                        return true;.filter(key => key.startsWith('quick_chat_messages_'));
                    }
                }eys.forEach(key => {
                return false;
            }       const data = JSON.parse(localStorage.getItem(key));
                    if (data.timestamp && Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
            const storageKey = `quick_chat_messages_${userIdToUse}`;);
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const messagesData = JSON.parse(stored);
                // Verify data belongs to the specified user (if we have user context)
                if (!this.user || messagesData.userId === userIdToUse) {
                    this.messages = messagesData.messages || [];
                    this.lastMessageId = messagesData.lastMessageId || null;
                    console.log(`Loaded ${this.messages.length} messages from localStorage for user ${messagesData.username || userIdToUse}`);
                    return true;
                }le.error('Error cleaning up old storage data:', error);
            }
        } catch (error) {
            console.error('Error loading messages from localStorage:', error);
        }up() {
        return false;anup logic if needed
    }   console.log('Cleaning up resources...');
        
    // Clear messages from localStorage (per user)
    clearMessagesFromStorage() {();
        try {
            if (!this.user) return;data
            .messages = [];
            const storageKey = `quick_chat_messages_${this.user.id}`;
            localStorage.removeItem(storageKey);
            console.log(`Messages cleared from localStorage for user ${this.user.username}`);
        } catch (error) {rage data
            console.error('Error clearing messages from localStorage:', error);
        }
    }   console.log('Cleanup completed');
    }
    // Clean up old localStorage data from previous versions or other users
    cleanupOldStorageData() {
        try { app when DOM is loaded
            // Remove old single-user storage key if it exists
            if (localStorage.getItem('quick_chat_messages')) {
                console.log('Removing old single-user storage data');
                localStorage.removeItem('quick_chat_messages');
            }
            toggle
            // Optional: Clean up very old data (older than 30 days) for space management
            const allKeys = Object.keys(localStorage);
            const chatKeys = allKeys.filter(key => key.startsWith('quick_chat_messages_'));
            t.type === 'password') {
            chatKeys.forEach(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.timestamp && Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
                        console.log(`Removing old chat data: ${key}`);
                        localStorage.removeItem(key);
                    }/login/reset forms
                } catch (e) {
                    // If we can't parse the data, it's probably corrupted, remove it
                    console.log(`Removing corrupted chat data: ${key}`);
                    localStorage.removeItem(key);le.display = 'none';
                }
            });gin() {
        } catch (error) {Id('registerContainer').style.display = 'none';
            console.error('Error cleaning up old storage data:', error);
        }ent.getElementById('resetContainer').style.display = 'none';
    }
function showReset() {
    cleanup() {tElementById('registerContainer').style.display = 'none';
        // Custom cleanup logic if neededstyle.display = 'none';
        console.log('Cleaning up resources...');yle.display = 'block';
        
        // Stop periodic updates
        this.stopPeriodicUpdates();f Service: Example terms here.', 'info', 5000);
        
        // Clear messages and user data
        this.messages = [];
        this.lastMessageId = null;
        this.user = null;sure you want to logout?')) {
        // Call the app's logout method if available
        // Clear localStorage dataindow.app.logout === 'function') {
        this.clearMessagesFromStorage();
        } else {
        console.log('Cleanup completed');
    }       window.location.href = '?action=logout';
}       }
    }
// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new QuickChatApp();
    await window.app.init();
}); document.getElementById('settingsModal').style.display = 'none';
}
// Password togglengs() {
function togglePassword(id) {ettings saved!', 'success');
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';Change password feature coming soon.', 'info');
    } else {
        input.type = 'password';
    }f (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
}       window.utils.showToast('Account deletion feature coming soon.', 'warning');
    }
// Show/hide register/login/reset forms
function showRegister() {
    document.getElementById('registerContainer').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('resetContainer').style.display = 'none';
}   const showLoginLink = document.getElementById('showLogin');
function showLogin() {rdLink = document.getElementById('forgotPassword');
    document.getElementById('registerContainer').style.display = 'none';
    if (showRegisterLink) showRegisterLink.onclick = showRegister;
    if (showLoginLink) showLoginLink.onclick = showLogin;
    if (forgotPasswordLink) forgotPasswordLink.onclick = showReset;
    if (backToLoginLink) backToLoginLink.onclick = showLogin;
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.onclick = function() {
        document.getElementById('settingsModal').style.display = 'flex';
    };
});
