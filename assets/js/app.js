// Enhanced Quick Chat Application
// Version: Updated 2025-06-14 - Fixed initializeServiceWorker issue
class QuickChatApp {
    constructor() {
        console.log('QuickChatApp constructor called - Version 2025-06-14');
        console.log('Available methods:', Object.getOwnPropertyNames(QuickChatApp.prototype));
        this.config = window.ChatConfig || {};
        this.user = null;
        this.isLoggingIn = false; // Flag to prevent cleanup during login
        this.messages = [];
        this.isOnline = navigator.onLine;
        this.lastMessageId = null;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isVisible = true;
        this.soundEnabled = true;
        this.pollInterval = null; // For periodic message updates
        
        // Initialize CSRF token from meta tag
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        console.log('Initial CSRF token:', this.csrfToken ? 'present' : 'missing');
    }

    async init() {
        console.log('QuickChatApp init called');
        try {
            await this.initializeApp();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }
    
    initializeServiceWorker() {
        console.log('initializeServiceWorker method called');
        // Service worker registration - stub for now
        if ('serviceWorker' in navigator) {
            // Can register SW here if sw.js exists
            console.log('Service Worker support detected');
        }
    }

    setupNotifications() {
        console.log('setupNotifications method called');
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        console.log('Notifications setup complete');
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
                this.showChatInterface();
                await this.loadMessages();
                this.startPeriodicUpdates();
            } else {
                this.showLoginInterface();
            }
            
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
            // First, try to load messages from localStorage
            const hasStoredMessages = this.loadMessagesFromStorage();
            
            if (hasStoredMessages) {
                console.log('Found cached messages, rendering...');
                this.renderMessages();
                this.scrollToBottom();
            }
            
            // Then load fresh messages from API
            console.log('Loading messages from API...');
            const response = await fetch(`api/messages.php?action=list&limit=50`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Messages response:', result);
            
            if (result.success) {
                this.messages = result.data || [];
                console.log('Loaded', this.messages.length, 'messages from API');
                
                // Save fresh messages to localStorage
                this.saveMessagesToStorage();
                
                this.renderMessages();
                this.scrollToBottom();
                
                if (this.messages.length > 0) {
                    this.lastMessageId = this.messages[this.messages.length - 1].id;
                }
            } else {
                console.warn('Load messages failed:', result.error);
                // If API failed but we have cached messages, use those
                if (!hasStoredMessages) {
                    this.showWelcomeMessage();
                }
            }
            
        } catch (error) {
            console.error('Load messages error:', error);
            console.log('API failed, using cached messages if available');
            
            // If API failed but we have cached messages, use those
            const hasStoredMessages = this.loadMessagesFromStorage();
            if (hasStoredMessages) {
                this.renderMessages();
                this.scrollToBottom();
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
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
    
    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }
    
    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
    
    updateCharacterCount() {
        const messageInput = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
        
        if (messageInput && charCount) {
            const length = messageInput.value.length;
            charCount.textContent = length;
            
            // Update color based on limit
            if (length > 1800) {
                charCount.style.color = '#dc3545'; // Red
            } else if (length > 1500) {
                charCount.style.color = '#ffc107'; // Yellow
            } else {
                charCount.style.color = ''; // Default
            }
        }
    }

    // Initialize the app when DOM is loaded
    async checkSession() {
        try {
            console.log('Checking session...');
            const response = await fetch('api/auth-simple.php?action=check_session', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            console.log('Response status:', response.status);
            console.log('Response headers:', Array.from(response.headers.entries()));
            
            // Log the raw response for debugging
            const responseText = await response.text();
            console.log('Raw response from check_session:', responseText);
            console.log('Response length:', responseText.length);
            
            // Check if response is empty or not JSON
            if (!responseText || responseText.trim() === '') {
                console.error('Empty response from server');
                return { authenticated: false, error: 'Empty server response' };
            }
            
            // Try to parse as JSON
            try {
                const parsed = JSON.parse(responseText);
                console.log('Parsed response:', parsed);
                return parsed;
            } catch (jsonError) {
                console.error('Failed to parse JSON response:', jsonError);
                console.error('Response text:', responseText);
                console.error('First 500 chars:', responseText.substring(0, 500));
                return { authenticated: false, error: 'Invalid server response' };
            }
        } catch (error) {
            console.error('Session check failed:', error);
            return { authenticated: false };
        }
    }
    
    showLoginInterface() {
        document.getElementById('loginScreen')?.classList.add('active');
        document.getElementById('chatScreen')?.classList.remove('active');
    }
    
    showChatInterface() {
        const loginScreen = document.getElementById('loginScreen');
        let chatScreen = document.getElementById('chatScreen');
        
        // If chat screen doesn't exist, create it dynamically
        if (!chatScreen) {
            console.log('Creating chat interface dynamically...');
            chatScreen = this.createChatInterface();
            document.body.appendChild(chatScreen);
        }
        
        // Hide login screen and show chat screen
        if (loginScreen) {
            loginScreen.classList.remove('active');
            loginScreen.style.display = 'none';
        }
        
        chatScreen.classList.add('active');
        chatScreen.style.display = 'block';
        
        // Update user info
        const userElement = document.getElementById('currentUser');
        if (userElement && this.user) {
            userElement.textContent = this.user.display_name || this.user.username;
        }
        
        console.log('Chat interface is now visible');
    }
    
    showWelcomeMessage() {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Quick Chat!</h3>
                    <p>Start a conversation by typing a message below.</p>
                    <div class="online-users">
                        <h4>Online Users</h4>
                        <div id="onlineUsersList">
                            <div class="user-item">
                                <span class="user-avatar"><i class="fas fa-user"></i></span>
                                <span class="user-name">${this.user ? this.user.display_name || this.user.username : 'You'}</span>
                                <span class="user-status online">Online</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    createChatInterface() {
        const chatScreen = document.createElement('div');
        chatScreen.id = 'chatScreen';
        chatScreen.className = 'screen';
        
        chatScreen.innerHTML = `
            <div class="chat-container">
                <!-- Chat Header -->
                <div class="chat-header">
                    <div class="user-info">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <h3 id="currentUser">${this.user ? (this.user.display_name || this.user.username) : 'User'}</h3>
                            <span class="status online" id="userStatus">Online</span>
                        </div>
                    </div>
                    
                    <div class="chat-actions">
                        <button id="themeToggle" class="action-btn" title="Toggle Theme">
                            <i class="fas fa-moon"></i>
                        </button>
                        <button id="settingsBtn" class="action-btn" title="Settings">
                            <i class="fas fa-cog"></i>
                        </button>
                        <button id="clearChatBtn" class="action-btn" title="Clear Chat">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button id="logoutBtn" class="action-btn" title="Logout" onclick="confirmLogout()">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Messages Container -->
                <div class="messages-container" id="messagesContainer">
                    <!-- Messages will be loaded here -->
                </div>

                <!-- Message Input -->
                <div class="message-input-container">
                    <div class="message-input-wrapper">
                        <button id="emojiBtn" class="input-btn" title="Emoji">
                            <i class="fas fa-smile"></i>
                        </button>
                        
                        <div class="message-input-area">
                            <textarea id="messageInput" placeholder="Type a message..." rows="1" maxlength="2000"></textarea>
                            <div class="char-count">
                                <span id="charCount">0</span>/2000
                            </div>
                        </div>
                        
                        <input type="file" id="fileInput" accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx" multiple style="display: none;">
                        <button id="fileBtn" class="input-btn" title="Attach File">
                            <i class="fas fa-paperclip"></i>
                        </button>
                        
                        <button id="audioBtn" class="input-btn" title="Voice Message">
                            <i class="fas fa-microphone"></i>
                        </button>
                        
                        <button id="sendBtn" class="send-btn" title="Send Message">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                    
                    <div class="file-upload-progress" id="fileUploadProgress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <span class="progress-text" id="progressText"></span>
                    </div>
                </div>
            </div>
            
            <!-- Toast Container -->
            <div id="toastContainer" class="toast-container"></div>
        `;
        
        return chatScreen;
    }

    bindChatEvents() {
        console.log('Binding chat events...');
        
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
        
        console.log('Chat events bound successfully');
    }

    handleMessageInput(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleTyping() {
        this.updateCharacterCount();
        // Could add typing indicators here later
    }

    handlePaste(e) {
        // Could add paste handling for images here later
        setTimeout(() => this.updateCharacterCount(), 10);
    }

    clearChat() {
        if (confirm('Are you sure you want to clear all messages? This cannot be undone.')) {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.innerHTML = '';
                this.messages = [];
                this.lastMessageId = null;
                
                // Clear from localStorage
                this.clearMessagesFromStorage();
                
                // Show welcome message
                this.showWelcomeMessage();
                
                console.log('Chat cleared from UI and localStorage');
                this.showSuccess('Chat history cleared');
            }
        }
    }

    toggleTheme() {
        const html = document.documentElement;
        if (html.getAttribute('data-theme') === 'dark') {
            html.removeAttribute('data-theme');
            localStorage.setItem('chat_theme', 'light');
        } else {
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('chat_theme', 'dark');
        }
    }

    startPeriodicUpdates() {
        console.log('Starting periodic updates...');
        
        // Poll for new messages every 5 seconds
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        this.pollInterval = setInterval(async () => {
            if (this.user && this.isVisible) {
                try {
                    await this.checkForNewMessages();
                } catch (error) {
                    console.error('Error checking for new messages:', error);
                }
            }
        }, this.config.pollInterval || 5000);
    }
    
    stopPeriodicUpdates() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
    
    async checkForNewMessages() {
        try {
            const response = await fetch(`api/messages.php?action=list&limit=50&after_id=${this.lastMessageId || 0}`);
            const result = await response.json();
            
            if (result.success && result.data && result.data.length > 0) {
                result.data.forEach(message => {
                    // Check if message is not already in our array
                    if (!this.messages.find(m => m.id === message.id)) {
                        this.messages.push(message);
                        this.addMessageToUI(message, true);
                        this.lastMessageId = Math.max(this.lastMessageId || 0, message.id);
                    }
                });
                
                // Save updated messages to localStorage
                this.saveMessagesToStorage();
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Error checking for new messages:', error);
        }
    }
    
    // Save messages to localStorage for persistence
    saveMessagesToStorage() {
        try {
            const messagesData = {
                messages: this.messages,
                lastMessageId: this.lastMessageId,
                timestamp: Date.now()
            };
            localStorage.setItem('quick_chat_messages', JSON.stringify(messagesData));
        } catch (error) {
            console.error('Error saving messages to localStorage:', error);
        }
    }
    
    // Load messages from localStorage
    loadMessagesFromStorage() {
        try {
            const stored = localStorage.getItem('quick_chat_messages');
            if (stored) {
                const messagesData = JSON.parse(stored);
                this.messages = messagesData.messages || [];
                this.lastMessageId = messagesData.lastMessageId || null;
                console.log('Loaded', this.messages.length, 'messages from localStorage');
                return true;
            }
        } catch (error) {
            console.error('Error loading messages from localStorage:', error);
        }
        return false;
    }
    
    // Clear messages from localStorage
    clearMessagesFromStorage() {
        try {
            localStorage.removeItem('quick_chat_messages');
        } catch (error) {
            console.error('Error clearing messages from localStorage:', error);
        }
    }
    
    handleVisibilityChange() {
        this.isVisible = !document.hidden;
        console.log('Visibility changed:', this.isVisible ? 'visible' : 'hidden');
        
        if (this.isVisible && this.user) {
            // Resume checking for new messages when page becomes visible
            console.log('Page visible, resuming updates...');
            this.checkForNewMessages();
        }
    }
    
    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        console.log('Online status changed:', isOnline ? 'online' : 'offline');
        
        const statusElement = document.getElementById('userStatus');
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (isOnline && this.user) {
            // Reconnect and check for new messages when coming back online
            this.checkForNewMessages();
        }
    }
    
    cleanup() {
        console.log('Cleaning up QuickChatApp...');
        this.stopPeriodicUpdates();
        
        // Clear user session
        this.user = null;
        
        // Don't clear messages from localStorage here, as user might want to keep them
        // Only clear on explicit "Clear Chat" action
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new QuickChatApp();
    await window.app.init();
});

// Password toggle
function togglePassword(id) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

// Show/hide register/login/reset forms
function showRegister() {
    document.getElementById('registerContainer').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('resetContainer').style.display = 'none';
}
function showLogin() {
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('resetContainer').style.display = 'none';
}
function showReset() {
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('resetContainer').style.display = 'block';
}
function showTerms() {
    window.utils.showToast('Terms of Service: Example terms here.', 'info', 5000);
}

// Confirm logout
function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '?action=logout';
    }
}

// Settings modal
function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}
function saveSettings() {
    window.utils.showToast('Settings saved!', 'success');
    closeSettings();
}
function changePassword() {
    window.utils.showToast('Change password feature coming soon.', 'info');
}
function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
        window.utils.showToast('Account deletion feature coming soon.', 'warning');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Register/login/reset links
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const backToLoginLink = document.getElementById('backToLogin');
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
