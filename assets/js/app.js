// Enhanced Quick Chat Application
class QuickChatApp {
    constructor() {
        this.config = window.ChatConfig;
        this.user = null;
        this.messages = [];
        this.isOnline = navigator.onLine;
        this.lastMessageId = null;
        this.typingTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initializeApp();
    }
    
    async initializeApp() {
        try {
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
        this.initializeServiceWorker();
        this.setupNotifications();
            
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
        window.addEventListener('beforeunload', () => this.cleanup());
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
            
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.user = result.user;
                this.showSuccess(result.message);
                
                setTimeout(() => {
                    if (result.redirect) {
                        window.location.href = result.redirect;
                    } else {
                        this.showChatInterface();
                        this.loadMessages();
                        this.startPeriodicUpdates();
                    }
                }, 1000);
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        } finally {
            this.setButtonLoading(submitBtn, false);
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
        const content = messageInput.value.trim();
        
        if (!content) return;
        
        const formData = new FormData();
        formData.append('action', 'send');
        formData.append('content', content);
        formData.append('message_type', 'text');
        formData.append('csrf_token', this.getCSRFToken());
        
        try {
            messageInput.disabled = true;
            
            const response = await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                messageInput.value = '';
                this.updateCharacterCount();
                this.addMessageToUI(result.data);
                this.scrollToBottom();
                this.playNotificationSound();
            } else {
                this.showError(result.error);
            }
            
        } catch (error) {
            console.error('Send message error:', error);
            this.showError('Failed to send message');
        } finally {
            messageInput.disabled = false;
            messageInput.focus();
        }
    }
    
    async loadMessages() {
        try {
            const response = await fetch(`api/messages.php?action=list&limit=50`);
            const result = await response.json();
            
            if (result.success) {
                this.messages = result.data;
                this.renderMessages();
                this.scrollToBottom();
                
                if (this.messages.length > 0) {
                    this.lastMessageId = this.messages[this.messages.length - 1].id;
                }
            }
            
        } catch (error) {
            console.error('Load messages error:', error);
            this.showError('Failed to load messages');
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
        return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
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
    
    // Initialize the app when DOM is loaded
    async checkSession() {
        try {
            const response = await fetch('api/auth.php?action=check_session');
            return await response.json();
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
        document.getElementById('loginScreen')?.classList.remove('active');
        document.getElementById('chatScreen')?.classList.add('active');
        
        // Update user info
        const userElement = document.getElementById('currentUser');
        if (userElement && this.user) {
            userElement.textContent = this.user.display_name || this.user.username;
        }
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
                        <div id="onlineUsersList"></div>
                    </div>
                </div>
            `;
        }
    }
    
    startPeriodicUpdates() {
        // Check for new messages every 5 seconds
        setInterval(async () => {
            if (this.isOnline) {
                await this.checkForNewMessages();
            }
        }, 5000);
        
        // Update user activity every 30 seconds
        setInterval(async () => {
            if (this.isOnline && this.user) {
                await this.updateActivity();
            }
        }, 30000);
    }
    
    async checkForNewMessages() {
        try {
            const lastId = this.lastMessageId || 0;
            const response = await fetch(`api/messages.php?action=list&after_id=${lastId}&limit=10`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                result.data.forEach(message => {
                    this.addMessageToUI(message);
                    this.lastMessageId = message.id;
                });
                
                this.scrollToBottom();
                this.playNotificationSound();
                this.showDesktopNotification('New message received');
            }
        } catch (error) {
            console.error('Check for new messages failed:', error);
        }
    }
    
    async updateActivity() {
        try {
            await fetch('api/auth.php?action=refresh_session', { method: 'POST' });
        } catch (error) {
            console.error('Update activity failed:', error);
        }
    }
    
    cleanup() {
        // Cleanup when page is unloaded
        if (this.user) {
            navigator.sendBeacon('api/auth.php?action=logout');
        }
    }
    
    initializeServiceWorker() {
        // Service worker registration - stub for now
        if ('serviceWorker' in navigator) {
            // Can register SW here if sw.js exists
            console.log('Service Worker support detected');
        }
    }

    setupNotifications() {
        // Request notification permission
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }

    playNotificationSound() {
        // Play notification sound
        const audio = document.getElementById('notificationSound');
        if (audio) {
            audio.play().catch(e => console.log('Could not play notification sound:', e));
        }
    }

    showDesktopNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Quick Chat', {
                body: message,
                icon: '/favicon.ico'
            });
        }
    }

    handleMessageInput(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleTyping() {
        // Handle typing indicator
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            // Stop typing indicator
        }, 1000);
    }

    handlePaste(e) {
        // Handle paste events (images, etc)
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                this.uploadFile(file);
            }
        }
    }

    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        if (picker) {
            picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleRecording() {
        // Audio recording functionality
        console.log('Recording toggle - implement audio recording');
    }

    showSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat?')) {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.innerHTML = '';
                this.showWelcomeMessage();
            }
        }
    }

    handleOnlineStatus(online) {
        this.isOnline = online;
        // Update UI based on online status
        const statusElement = document.getElementById('userStatus');
        if (statusElement) {
            statusElement.textContent = online ? 'Online' : 'Offline';
            statusElement.className = `status ${online ? 'online' : 'offline'}`;
        }
    }

    handleVisibilityChange() {
        // Handle page visibility changes
        if (document.hidden) {
            // Page is hidden
        } else {
            // Page is visible - check for new messages
            if (this.isOnline) {
                this.checkForNewMessages();
            }
        }
    }

    checkPasswordStrength(input) {
        const password = input.value;
        const strengthElement = document.getElementById('passwordStrength');
        
        if (!strengthElement) return;

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        const levels = ['', 'weak', 'medium', 'strong', 'strong'];
        const texts = ['', 'Weak', 'Medium', 'Strong', 'Very Strong'];
        
        strengthElement.className = `password-strength ${levels[strength]}`;
        strengthElement.textContent = texts[strength];
    }

    isPasswordStrong(password) {
        return password.length >= 8 && 
               /[a-z]/.test(password) && 
               /[A-Z]/.test(password) && 
               /[0-9]/.test(password) && 
               /[^A-Za-z0-9]/.test(password);
    }

    showRegisterForm(e) {
        e.preventDefault();
        document.querySelector('.login-container').style.display = 'none';
        document.querySelector('.register-container').style.display = 'block';
        document.querySelector('.reset-container').style.display = 'none';
    }

    showLoginForm(e) {
        e.preventDefault();
        document.querySelector('.login-container').style.display = 'block';
        document.querySelector('.register-container').style.display = 'none';
        document.querySelector('.reset-container').style.display = 'none';
    }

    showResetForm(e) {
        e.preventDefault();
        document.querySelector('.login-container').style.display = 'none';
        document.querySelector('.register-container').style.display = 'none';
        document.querySelector('.reset-container').style.display = 'block';
    }

    updateCharacterCount() {
        const input = document.getElementById('messageInput');
        const counter = document.getElementById('charCount');
        if (input && counter) {
            counter.textContent = input.value.length;
        }
    }

    showFileUploadProgress(filename, progress) {
        // Show file upload progress
        console.log(`Uploading ${filename}: ${progress}%`);
    }

    hideFileUploadProgress() {
        // Hide file upload progress
        console.log('Upload complete');
    }

    showMessageContextMenu(e, message) {
        e.preventDefault();
        // Show context menu for message actions
        console.log('Context menu for message:', message.id);
    }

    showImageModal(imageUrl) {
        // Show image in modal
        console.log('Show image modal:', imageUrl);
    }

    toggleReaction(messageId, reaction) {
        // Toggle reaction on message
        console.log('Toggle reaction:', messageId, reaction);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new QuickChatApp();
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
