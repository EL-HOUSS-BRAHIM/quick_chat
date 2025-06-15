/**
 * Enhanced Quick Chat Application
 * Version: 2025-06-15 - Complete refactor with improved architecture
 * Features: Real-time messaging, offline support, file uploads, notifications, dark mode
 */
class QuickChatApp {
    /**
     * Initialize the QuickChat application
     */
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
            apiEndpoint: '/api',
            notificationTimeout: 5000,
            messageBacklog: 50, // Number of messages to keep in memory
            offlineMessageQueue: [], // Queue for messages sent while offline
            ...window.ChatConfig
        };
        
        // Application state
        this.state = {
            user: null,
            messages: [],
            isOnline: navigator.onLine,
            isVisible: !document.hidden,
            isLoggingIn: false,
            lastMessageId: null,
            reconnectAttempts: 0,
            soundEnabled: this.getStoredPreference('soundEnabled', true),
            theme: this.getStoredPreference('theme', 'light'),
            typingUsers: new Set(),
            replyingTo: null,
            lastActivityTime: Date.now(),
            pendingUploads: new Map() // Track file uploads in progress
        };
        
        // Timers and intervals
        this.timers = {
            pollInterval: null,
            typingTimeout: null,
            reconnectTimeout: null,
            visibilityTimeout: null,
            inactivityTimeout: null,
            statusCheckInterval: null
        };
        
        // Event handlers (bound to maintain context)
        this.boundHandlers = {
            visibilityChange: this.handleVisibilityChange.bind(this),
            onlineStatusChange: this.handleOnlineStatusChange.bind(this),
            beforeUnload: this.handleBeforeUnload.bind(this),
            messageInput: this.handleMessageInput.bind(this),
            keyboardShortcuts: this.handleKeyboardShortcuts.bind(this),
            activityTracking: this.handleUserActivity.bind(this),
            storageChange: this.handleStorageChange.bind(this)
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
            
            // Setup cross-tab communication
            this.setupBroadcastChannel();
            
            // Track user activity
            this.setupActivityTracking();
            
            // Make app instance globally available for chat.js
            window.quickChatApp = this;
            
            console.log('QuickChat application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showToast('Failed to initialize application', 'error');
        }
    }

    /**
     * Check user authentication status and setup UI accordingly
     */
    async checkAuthenticationStatus() {
        try {
            // Test API connection first
            try {
                const response = await fetch('api/auth-simple.php?action=ping', { 
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (!response.ok) {
                    throw new Error(`API test failed with status: ${response.status}`);
                }
            } catch (testError) {
                console.error('API connection test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                return false;
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck.authenticated) {
                // User is authenticated
                console.log('User is authenticated:', sessionCheck.user);
                this.user = sessionCheck.user;
                this.updateCSRFToken(sessionCheck.csrf_token);
                
                // Load messages from storage
                this.loadMessagesFromStorage();
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
                // Show welcome message or load messages
                if (!this.messages || this.messages.length === 0) {
                    this.showWelcomeMessage();
                } else {
                    this.renderMessages();
                }
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                return true;
            } else {
                // User is not authenticated, show login form
                console.log('User is not authenticated');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                return false;
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            this.showError('Authentication check failed');
            return false;
        }
    }
    
    /**
     * Apply theme to the application
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        
        // Save theme preference
        this.state.theme = theme;
        localStorage.setItem('theme', theme);
        
        console.log(`Applied theme: ${theme}`);
    }
    
    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.applyTheme(newTheme);
    }
    
    /**
     * Get stored user preference
     * @param {string} key - Preference key
     * @param {*} defaultValue - Default value if preference is not found
     * @returns {*} The stored preference or default value
     */
    getStoredPreference(key, defaultValue) {
        try {
            const value = localStorage.getItem(`${this.config.storagePrefix}${key}`);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error(`Error getting stored preference ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Save user preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     */
    saveStoredPreference(key, value) {
        try {
            localStorage.setItem(`${this.config.storagePrefix}${key}`, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving stored preference ${key}:`, error);
        }
    }
    
    /**
     * Handle file paste (images, etc.)
     * @param {Event} e - Paste event
     */
    handlePaste(e) {
        // Check if we have items in the clipboard
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        const items = e.clipboardData.items;
        let hasImage = false;
        
        for (let i = 0; i < items.length; i++) {
            // Check if item is an image
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                
                // Get the image as a file
                const file = items[i].getAsFile();
                
                if (file) {
                    e.preventDefault(); // Prevent default paste behavior
                    
                    // Upload the image
                    this.uploadFile(file);
                    break;
                }
            }
        }
        
        // If not an image, let default paste behavior happen
        if (!hasImage) {
            setTimeout(() => this.updateCharacterCount(), 10);
        }
    }
    
    /**
     * Handle visibility change (tab focus/blur)
     */
    handleVisibilityChange() {
        const isVisible = !document.hidden;
        this.state.isVisible = isVisible;
        
        if (isVisible) {
            // User is back - resume updates
            this.startPeriodicUpdates();
            
            // Check for new messages immediately
            this.checkForNewMessages();
            
            console.log('Tab is visible - resuming updates');
        } else {
            // User is away - reduce update frequency or pause
            this.stopPeriodicUpdates();
            
            console.log('Tab is hidden - pausing updates');
        }
    }
    
    /**
     * Handle online/offline status change
     */
    handleOnlineStatusChange() {
        const isOnline = navigator.onLine;
        
        // Only process if status actually changed
        if (this.state.isOnline === isOnline) return;
        
        this.state.isOnline = isOnline;
        
        // Update UI to show online/offline status
        const statusElement = document.getElementById('userStatus');
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (isOnline) {
            // Reconnected - resume updates and sync messages
            this.startPeriodicUpdates();
            this.checkForNewMessages();
            this.showSuccess('Connection restored');
            
            // Reset reconnect attempts
            this.state.reconnectAttempts = 0;
        } else {
            // Offline - stop updates
            this.stopPeriodicUpdates();
            this.showError('Connection lost - working offline');
        }
        
        console.log('Online status changed:', isOnline);
    }
    
    /**
     * Handle application before unload
     * @param {Event} e - BeforeUnload event
     */
    handleBeforeUnload(e) {
        // Save current state
        this.saveMessagesToStorage();
        
        // Modern browsers ignore custom messages here
        e.preventDefault();
        e.returnValue = '';
    }
    
    /**
     * Initialize Service Worker for offline support
     */
    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type) {
                        switch (event.data.type) {
                            case 'new-message':
                                // Handle new message from service worker
                                this.checkForNewMessages();
                                break;
                            case 'sync-complete':
                                // Handle sync complete
                                this.showSuccess('Messages synced successfully');
                                break;
                        }
                    }
                });
                
                return registration;
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
                return null;
            }
        }
        return null;
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

    /**
     * Initialize the application asynchronously - better implementation that
     * combines both init and initializeApp methods
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initializeApp() {
        try {
            console.log('QuickChat application initializing...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize theme
            this.applyTheme(this.state.theme);
            
            // Clean up old storage data
            this.cleanupOldStorageData();
            
            // Initialize service worker early but don't block on it
            const serviceWorkerPromise = this.initializeServiceWorker();
            
            // Test API connection first
            try {
                const testResponse = await fetch('api/auth-simple.php?action=test', {
                    cache: 'no-cache',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!testResponse.ok) {
                    throw new Error(`API test failed with status: ${testResponse.status}`);
                }
                
                const testText = await testResponse.text();
                console.log('API test response:', testText);
            } catch (testError) {
                console.error('API test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                
                // If we're offline, still try to show cached data
                if (!navigator.onLine) {
                    this.loadMessagesFromStorage();
                    this.showChatInterface();
                    return false;
                }
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck?.authenticated) {
                this.user = sessionCheck.user;
                console.log('User authenticated:', this.user.username);
                
                // Update CSRF token
                if (sessionCheck.csrf_token) {
                    this.updateCSRFToken(sessionCheck.csrf_token);
                }
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
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
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                // Wait for service worker to complete in the background
                await serviceWorkerPromise;
                
                console.log('QuickChat application initialized successfully');
                return true;
            } else {
                console.log('User not authenticated, showing login interface');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                console.log('Login interface displayed');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
            return false;
        }
    }
    
    /**
     * Bind authentication-related events
     */
    bindAuthEvents() {
        console.log('Binding authentication events...');
        
        // Authentication forms
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
        
        // Password strength checker
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', (e) => this.checkPasswordStrength(e.target));
        });
        
        console.log('Authentication events bound successfully');
    }
    
    /**
     * Bind chat-related events
     */
    bindChatEvents() {
        console.log('Binding chat events...');
        
        // Chat event elements
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        
        // Message input events
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        
        // Button click events
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
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.confirmLogout());
        
        console.log('Chat events bound successfully');
    }
    
    /**
     * Start periodic message updates
     */
    startPeriodicUpdates() {
        console.log('Starting periodic updates...');
        
        // Clear any existing interval first
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
        }
        
        // Set up new interval
        this.timers.pollInterval = setInterval(async () => {
            try {
                await this.checkForNewMessages();
            } catch (error) {
                console.error('Error checking for new messages:', error);
            }
        }, this.config.pollInterval || 5000);
    }
    
    /**
     * Stop periodic message updates
     */
    stopPeriodicUpdates() {
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
            this.timers.pollInterval = null;
        }
    }
    
    /**
     * Initialize the application
     * Main entry point that starts the app initialization process
     */
    async init() {
        // This is now just a wrapper for the more comprehensive initializeApp method
        return await this.initializeApp();
    }

    /**
     * Check user authentication status and setup UI accordingly
     */
    async checkAuthenticationStatus() {
        try {
            // Test API connection first
            try {
                const response = await fetch('api/auth-simple.php?action=ping', { 
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (!response.ok) {
                    throw new Error(`API test failed with status: ${response.status}`);
                }
            } catch (testError) {
                console.error('API connection test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                return false;
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck.authenticated) {
                // User is authenticated
                console.log('User is authenticated:', sessionCheck.user);
                this.user = sessionCheck.user;
                this.updateCSRFToken(sessionCheck.csrf_token);
                
                // Load messages from storage
                this.loadMessagesFromStorage();
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
                // Show welcome message or load messages
                if (!this.messages || this.messages.length === 0) {
                    this.showWelcomeMessage();
                } else {
                    this.renderMessages();
                }
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                return true;
            } else {
                // User is not authenticated, show login form
                console.log('User is not authenticated');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                return false;
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            this.showError('Authentication check failed');
            return false;
        }
    }
    
    /**
     * Set up user activity tracking
     */
    setupActivityTracking() {
        // Track user activity to detect inactivity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            document.addEventListener(event, this.boundHandlers.activityTracking);
        });
        
        // Set up inactivity check
        this.checkUserActivity();
    }
    
    /**
     * Handle user activity
     */
    handleUserActivity() {
        this.state.lastActivityTime = Date.now();
        
        // If user was inactive, clear status
        if (this.state.isInactive) {
            this.state.isInactive = false;
            // Update status if needed
            if (this.state.user) {
                this.updateUserStatus('online');
            }
        }
        
        // Reset inactivity timeout
        clearTimeout(this.timers.inactivityTimeout);
        this.timers.inactivityTimeout = setTimeout(() => {
            this.handleUserInactivity();
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    /**
     * Handle user inactivity
     */
    handleUserInactivity() {
        this.state.isInactive = true;
        
        // Update status if user is logged in
        if (this.state.user) {
            this.updateUserStatus('away');
        }
        
        console.log('User inactive for 5 minutes');
    }
    
    /**
     * Check user activity status periodically
     */
    checkUserActivity() {
        // Clear any existing interval
        clearInterval(this.timers.statusCheckInterval);
        
        // Set up new interval
        this.timers.statusCheckInterval = setInterval(() => {
            const inactiveTime = Date.now() - this.state.lastActivityTime;
            
            // If inactive for more than 5 minutes and not already marked inactive
            if (inactiveTime > 5 * 60 * 1000 && !this.state.isInactive) {
                this.handleUserInactivity();
            }
        }, 60 * 1000); // Check every minute
    }
    
    /**
     * Update user status
     * @param {string} status - User status (online, away, busy)
     */
    async updateUserStatus(status) {
        if (!this.state.user || !this.state.isOnline) return;
        
        try {
            const response = await fetch(`${this.config.apiEndpoint}/user/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update status');
            }
            
            this.state.user.status = status;
            
            // Update UI if needed
            const statusElement = document.getElementById('userStatus');
            if (statusElement) {
                statusElement.className = `status-indicator status-${status}`;
                statusElement.setAttribute('title', `Status: ${status}`);
            }
        } catch (error) {
            console.error('Failed to update user status:', error);
        }
    }
    
    /**
     * Set up broadcast channel for cross-tab communication
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('quick_chat_channel');
            
            // Listen for messages from other tabs
            this.broadcastChannel.onmessage = (event) => {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            };
            
            console.log('Broadcast channel set up for cross-tab communication');
        } else {
            // Fallback to localStorage if BroadcastChannel not supported
            window.addEventListener('storage', this.boundHandlers.storageChange);
            console.log('Using localStorage for cross-tab communication (fallback)');
        }
    }
    
    /**
     * Handle storage change events (for cross-tab communication fallback)
     * @param {StorageEvent} e - Storage event
     */
    handleStorageChange(e) {
        if (e.key === 'quick_chat_cross_tab_message') {
            try {
                const { type, data, timestamp } = JSON.parse(e.newValue);
                
                // Ignore old messages
                if (Date.now() - timestamp > 1000) return;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            } catch (error) {
                console.error('Error processing cross-tab message:', error);
            }
        }
    }
    
    /**
     * Handle logout initiated from another tab
     */
    handleLogoutFromOtherTab() {
        // Only process if currently logged in
        if (this.state.user) {
            this.state.user = null;
            this.showLoginInterface();
            this.showToast('You have been logged out in another tab', 'info');
        }
    }
    
    /**
     * Broadcast a message to other tabs
     * @param {string} type - Message type
     * @param {Object} data - Message data
     */
    broadcastToOtherTabs(type, data) {
        const message = { type, data, timestamp: Date.now() };
        
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        } else {
            // Fallback to localStorage
            localStorage.setItem('quick_chat_cross_tab_message', JSON.stringify(message));
        }
    }
    
    /**
     * Initialize the application
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initializeApp() {
        try {
            console.log('QuickChat application initializing...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize theme
            this.applyTheme(this.state.theme);
            
            // Clean up old storage data
            this.cleanupOldStorageData();
            
            // Initialize service worker early but don't block on it
            const serviceWorkerPromise = this.initializeServiceWorker();
            
            // Test API connection first
            try {
                const testResponse = await fetch('api/auth-simple.php?action=test', {
                    cache: 'no-cache',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!testResponse.ok) {
                    throw new Error(`API test failed with status: ${testResponse.status}`);
                }
                
                const testText = await testResponse.text();
                console.log('API test response:', testText);
            } catch (testError) {
                console.error('API test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                
                // If we're offline, still try to show cached data
                if (!navigator.onLine) {
                    this.loadMessagesFromStorage();
                    this.showChatInterface();
                    return false;
                }
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck?.authenticated) {
                this.user = sessionCheck.user;
                console.log('User authenticated:', this.user.username);
                
                // Update CSRF token
                if (sessionCheck.csrf_token) {
                    this.updateCSRFToken(sessionCheck.csrf_token);
                }
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
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
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                // Wait for service worker to complete in the background
                await serviceWorkerPromise;
                
                console.log('QuickChat application initialized successfully');
                return true;
            } else {
                console.log('User not authenticated, showing login interface');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                console.log('Login interface displayed');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
            return false;
        }
    }
    
    /**
     * Bind authentication-related events
     */
    bindAuthEvents() {
        console.log('Binding authentication events...');
        
        // Authentication forms
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
        
        // Password strength checker
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', (e) => this.checkPasswordStrength(e.target));
        });
        
        console.log('Authentication events bound successfully');
    }
    
    /**
     * Bind chat-related events
     */
    bindChatEvents() {
        console.log('Binding chat events...');
        
        // Chat event elements
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        
        // Message input events
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        
        // Button click events
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
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.confirmLogout());
        
        console.log('Chat events bound successfully');
    }
    
    /**
     * Start periodic message updates
     */
    startPeriodicUpdates() {
        console.log('Starting periodic updates...');
        
        // Clear any existing interval first
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
        }
        
        // Set up new interval
        this.timers.pollInterval = setInterval(async () => {
            try {
                await this.checkForNewMessages();
            } catch (error) {
                console.error('Error checking for new messages:', error);
            }
        }, this.config.pollInterval || 5000);
    }
    
    /**
     * Stop periodic message updates
     */
    stopPeriodicUpdates() {
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
            this.timers.pollInterval = null;
        }
    }
    
    /**
     * Initialize the application
     * Main entry point that starts the app initialization process
     */
    async init() {
        // This is now just a wrapper for the more comprehensive initializeApp method
        return await this.initializeApp();
    }

    /**
     * Check user authentication status and setup UI accordingly
     */
    async checkAuthenticationStatus() {
        try {
            // Test API connection first
            try {
                const response = await fetch('api/auth-simple.php?action=ping', { 
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (!response.ok) {
                    throw new Error(`API test failed with status: ${response.status}`);
                }
            } catch (testError) {
                console.error('API connection test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                return false;
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck.authenticated) {
                // User is authenticated
                console.log('User is authenticated:', sessionCheck.user);
                this.user = sessionCheck.user;
                this.updateCSRFToken(sessionCheck.csrf_token);
                
                // Load messages from storage
                this.loadMessagesFromStorage();
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
                // Show welcome message or load messages
                if (!this.messages || this.messages.length === 0) {
                    this.showWelcomeMessage();
                } else {
                    this.renderMessages();
                }
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                return true;
            } else {
                // User is not authenticated, show login form
                console.log('User is not authenticated');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                return false;
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            this.showError('Authentication check failed');
            return false;
        }
    }
    
    /**
     * Apply theme to the application
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    applyTheme(theme) {
        const html = document.documentElement;
        
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
        
        // Save theme preference
        this.state.theme = theme;
        localStorage.setItem('theme', theme);
        
        console.log(`Applied theme: ${theme}`);
    }
    
    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        this.applyTheme(newTheme);
    }
    
    /**
     * Get stored user preference
     * @param {string} key - Preference key
     * @param {*} defaultValue - Default value if preference is not found
     * @returns {*} The stored preference or default value
     */
    getStoredPreference(key, defaultValue) {
        try {
            const value = localStorage.getItem(`${this.config.storagePrefix}${key}`);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error(`Error getting stored preference ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Save user preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     */
    saveStoredPreference(key, value) {
        try {
            localStorage.setItem(`${this.config.storagePrefix}${key}`, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving stored preference ${key}:`, error);
        }
    }
    
    /**
     * Handle file paste (images, etc.)
     * @param {Event} e - Paste event
     */
    handlePaste(e) {
        // Check if we have items in the clipboard
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        const items = e.clipboardData.items;
        let hasImage = false;
        
        for (let i = 0; i < items.length; i++) {
            // Check if item is an image
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                
                // Get the image as a file
                const file = items[i].getAsFile();
                
                if (file) {
                    e.preventDefault(); // Prevent default paste behavior
                    
                    // Upload the image
                    this.uploadFile(file);
                    break;
                }
            }
        }
        
        // If not an image, let default paste behavior happen
        if (!hasImage) {
            setTimeout(() => this.updateCharacterCount(), 10);
        }
    }
    
    /**
     * Handle visibility change (tab focus/blur)
     */
    handleVisibilityChange() {
        const isVisible = !document.hidden;
        this.state.isVisible = isVisible;
        
        if (isVisible) {
            // User is back - resume updates
            this.startPeriodicUpdates();
            
            // Check for new messages immediately
            this.checkForNewMessages();
            
            console.log('Tab is visible - resuming updates');
        } else {
            // User is away - reduce update frequency or pause
            this.stopPeriodicUpdates();
            
            console.log('Tab is hidden - pausing updates');
        }
    }
    
    /**
     * Handle online/offline status change
     */
    handleOnlineStatusChange() {
        const isOnline = navigator.onLine;
        
        // Only process if status actually changed
        if (this.state.isOnline === isOnline) return;
        
        this.state.isOnline = isOnline;
        
        // Update UI to show online/offline status
        const statusElement = document.getElementById('userStatus');
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (isOnline) {
            // Reconnected - resume updates and sync messages
            this.startPeriodicUpdates();
            this.checkForNewMessages();
            this.showSuccess('Connection restored');
            
            // Reset reconnect attempts
            this.state.reconnectAttempts = 0;
        } else {
            // Offline - stop updates
            this.stopPeriodicUpdates();
            this.showError('Connection lost - working offline');
        }
        
        console.log('Online status changed:', isOnline);
    }
    
    /**
     * Handle application before unload
     * @param {Event} e - BeforeUnload event
     */
    handleBeforeUnload(e) {
        // Save current state
        this.saveMessagesToStorage();
        
        // Modern browsers ignore custom messages here
        e.preventDefault();
        e.returnValue = '';
    }
    
    /**
     * Initialize Service Worker for offline support
     */
    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type) {
                        switch (event.data.type) {
                            case 'new-message':
                                // Handle new message from service worker
                                this.checkForNewMessages();
                                break;
                            case 'sync-complete':
                                // Handle sync complete
                                this.showSuccess('Messages synced successfully');
                                break;
                        }
                    }
                });
                
                return registration;
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
                return null;
            }
        }
        return null;
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
    
    /**
     * Set up user activity tracking
     */
    setupActivityTracking() {
        // Track user activity to detect inactivity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            document.addEventListener(event, this.boundHandlers.activityTracking);
        });
        
        // Set up inactivity check
        this.checkUserActivity();
    }
    
    /**
     * Handle user activity
     */
    handleUserActivity() {
        this.state.lastActivityTime = Date.now();
        
        // If user was inactive, clear status
        if (this.state.isInactive) {
            this.state.isInactive = false;
            // Update status if needed
            if (this.state.user) {
                this.updateUserStatus('online');
            }
        }
        
        // Reset inactivity timeout
        clearTimeout(this.timers.inactivityTimeout);
        this.timers.inactivityTimeout = setTimeout(() => {
            this.handleUserInactivity();
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    /**
     * Handle user inactivity
     */
    handleUserInactivity() {
        this.state.isInactive = true;
        
        // Update status if user is logged in
        if (this.state.user) {
            this.updateUserStatus('away');
        }
        
        console.log('User inactive for 5 minutes');
    }
    
    /**
     * Check user activity status periodically
     */
    checkUserActivity() {
        // Clear any existing interval
        clearInterval(this.timers.statusCheckInterval);
        
        // Set up new interval
        this.timers.statusCheckInterval = setInterval(() => {
            const inactiveTime = Date.now() - this.state.lastActivityTime;
            
            // If inactive for more than 5 minutes and not already marked inactive
            if (inactiveTime > 5 * 60 * 1000 && !this.state.isInactive) {
                this.handleUserInactivity();
            }
        }, 60 * 1000); // Check every minute
    }
    
    /**
     * Update user status
     * @param {string} status - User status (online, away, busy)
     */
    async updateUserStatus(status) {
        if (!this.state.user || !this.state.isOnline) return;
        
        try {
            const response = await fetch(`${this.config.apiEndpoint}/user/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update status');
            }
            
            this.state.user.status = status;
            
            // Update UI if needed
            const statusElement = document.getElementById('userStatus');
            if (statusElement) {
                statusElement.className = `status-indicator status-${status}`;
                statusElement.setAttribute('title', `Status: ${status}`);
            }
        } catch (error) {
            console.error('Failed to update user status:', error);
        }
    }
    
    /**
     * Set up broadcast channel for cross-tab communication
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('quick_chat_channel');
            
            // Listen for messages from other tabs
            this.broadcastChannel.onmessage = (event) => {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            };
            
            console.log('Broadcast channel set up for cross-tab communication');
        } else {
            // Fallback to localStorage if BroadcastChannel not supported
            window.addEventListener('storage', this.boundHandlers.storageChange);
            console.log('Using localStorage for cross-tab communication (fallback)');
        }
    }
    
    /**
     * Handle storage change events (for cross-tab communication fallback)
     * @param {StorageEvent} e - Storage event
     */
    handleStorageChange(e) {
        if (e.key === 'quick_chat_cross_tab_message') {
            try {
                const { type, data, timestamp } = JSON.parse(e.newValue);
                
                // Ignore old messages
                if (Date.now() - timestamp > 1000) return;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            } catch (error) {
                console.error('Error processing cross-tab message:', error);
            }
        }
    }
    
    /**
     * Handle logout initiated from another tab
     */
    handleLogoutFromOtherTab() {
        // Only process if currently logged in
        if (this.state.user) {
            this.state.user = null;
            this.showLoginInterface();
            this.showToast('You have been logged out in another tab', 'info');
        }
    }
    
    /**
     * Broadcast a message to other tabs
     * @param {string} type - Message type
     * @param {Object} data - Message data
     */
    broadcastToOtherTabs(type, data) {
        const message = { type, data, timestamp: Date.now() };
        
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        } else {
            // Fallback to localStorage
            localStorage.setItem('quick_chat_cross_tab_message', JSON.stringify(message));
        }
    }
    
    /**
     * Get stored user preference
     * @param {string} key - Preference key
     * @param {*} defaultValue - Default value if preference is not found
     * @returns {*} The stored preference or default value
     */
    getStoredPreference(key, defaultValue) {
        try {
            const value = localStorage.getItem(`${this.config.storagePrefix}${key}`);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error(`Error getting stored preference ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Save user preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     */
    saveStoredPreference(key, value) {
        try {
            localStorage.setItem(`${this.config.storagePrefix}${key}`, JSON.stringify(value));
        } catch (error) {
            console.error(`Error saving stored preference ${key}:`, error);
        }
    }
    
    /**
     * Handle file paste (images, etc.)
     * @param {Event} e - Paste event
     */
    handlePaste(e) {
        // Check if we have items in the clipboard
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        const items = e.clipboardData.items;
        let hasImage = false;
        
        for (let i = 0; i < items.length; i++) {
            // Check if item is an image
            if (items[i].type.indexOf('image') !== -1) {
                hasImage = true;
                
                // Get the image as a file
                const file = items[i].getAsFile();
                
                if (file) {
                    e.preventDefault(); // Prevent default paste behavior
                    
                    // Upload the image
                    this.uploadFile(file);
                    break;
                }
            }
        }
        
        // If not an image, let default paste behavior happen
        if (!hasImage) {
            setTimeout(() => this.updateCharacterCount(), 10);
        }
    }
    
    /**
     * Handle visibility change (tab focus/blur)
     */
    handleVisibilityChange() {
        const isVisible = !document.hidden;
        this.state.isVisible = isVisible;
        
        if (isVisible) {
            // User is back - resume updates
            this.startPeriodicUpdates();
            
            // Check for new messages immediately
            this.checkForNewMessages();
            
            console.log('Tab is visible - resuming updates');
        } else {
            // User is away - reduce update frequency or pause
            this.stopPeriodicUpdates();
            
            console.log('Tab is hidden - pausing updates');
        }
    }
    
    /**
     * Handle online/offline status change
     */
    handleOnlineStatusChange() {
        const isOnline = navigator.onLine;
        
        // Only process if status actually changed
        if (this.state.isOnline === isOnline) return;
        
        this.state.isOnline = isOnline;
        
        // Update UI to show online/offline status
        const statusElement = document.getElementById('userStatus');
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Online' : 'Offline';
            statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (isOnline) {
            // Reconnected - resume updates and sync messages
            this.startPeriodicUpdates();
            this.checkForNewMessages();
            this.showSuccess('Connection restored');
            
            // Reset reconnect attempts
            this.state.reconnectAttempts = 0;
        } else {
            // Offline - stop updates
            this.stopPeriodicUpdates();
            this.showError('Connection lost - working offline');
        }
        
        console.log('Online status changed:', isOnline);
    }
    
    /**
     * Handle application before unload
     * @param {Event} e - BeforeUnload event
     */
    handleBeforeUnload(e) {
        // Save current state
        this.saveMessagesToStorage();
        
        // Modern browsers ignore custom messages here
        e.preventDefault();
        e.returnValue = '';
    }
    
    /**
     * Initialize Service Worker for offline support
     */
    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
                
                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type) {
                        switch (event.data.type) {
                            case 'new-message':
                                // Handle new message from service worker
                                this.checkForNewMessages();
                                break;
                            case 'sync-complete':
                                // Handle sync complete
                                this.showSuccess('Messages synced successfully');
                                break;
                        }
                    }
                });
                
                return registration;
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
                return null;
            }
        }
        return null;
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
    
    /**
     * Initialize the application asynchronously - better implementation that
     * combines both init and initializeApp methods
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initializeApp() {
        try {
            console.log('QuickChat application initializing...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize theme
            this.applyTheme(this.state.theme);
            
            // Clean up old storage data
            this.cleanupOldStorageData();
            
            // Initialize service worker early but don't block on it
            const serviceWorkerPromise = this.initializeServiceWorker();
            
            // Test API connection first
            try {
                const testResponse = await fetch('api/auth-simple.php?action=test', {
                    cache: 'no-cache',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!testResponse.ok) {
                    throw new Error(`API test failed with status: ${testResponse.status}`);
                }
                
                const testText = await testResponse.text();
                console.log('API test response:', testText);
            } catch (testError) {
                console.error('API test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                
                // If we're offline, still try to show cached data
                if (!navigator.onLine) {
                    this.loadMessagesFromStorage();
                    this.showChatInterface();
                    return false;
                }
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck?.authenticated) {
                this.user = sessionCheck.user;
                console.log('User authenticated:', this.user.username);
                
                // Update CSRF token
                if (sessionCheck.csrf_token) {
                    this.updateCSRFToken(sessionCheck.csrf_token);
                }
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
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
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                // Wait for service worker to complete in the background
                await serviceWorkerPromise;
                
                console.log('QuickChat application initialized successfully');
                return true;
            } else {
                console.log('User not authenticated, showing login interface');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                console.log('Login interface displayed');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
            return false;
        }
    }
    
    /**
     * Bind authentication-related events
     */
    bindAuthEvents() {
        console.log('Binding authentication events...');
        
        // Authentication forms
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
        
        // Password strength checker
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', (e) => this.checkPasswordStrength(e.target));
        });
        
        console.log('Authentication events bound successfully');
    }
    
    /**
     * Bind chat-related events
     */
    bindChatEvents() {
        console.log('Binding chat events...');
        
        // Chat event elements
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        
        // Message input events
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        
        // Button click events
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
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.confirmLogout());
        
        console.log('Chat events bound successfully');
    }
    
    /**
     * Start periodic message updates
     */
    startPeriodicUpdates() {
        console.log('Starting periodic updates...');
        
        // Clear any existing interval first
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
        }
        
        // Set up new interval
        this.timers.pollInterval = setInterval(async () => {
            try {
                await this.checkForNewMessages();
            } catch (error) {
                console.error('Error checking for new messages:', error);
            }
        }, this.config.pollInterval || 5000);
    }
    
    /**
     * Stop periodic message updates
     */
    stopPeriodicUpdates() {
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
            this.timers.pollInterval = null;
        }
    }
    
    /**
     * Initialize the application
     * Main entry point that starts the app initialization process
     */
    async init() {
        // This is now just a wrapper for the more comprehensive initializeApp method
        return await this.initializeApp();
    }

    /**
     * Check user authentication status and setup UI accordingly
     */
    async checkAuthenticationStatus() {
        try {
            // Test API connection first
            try {
                const response = await fetch('api/auth-simple.php?action=ping', { 
                    method: 'GET',
                    cache: 'no-cache'
                });
                if (!response.ok) {
                    throw new Error(`API test failed with status: ${response.status}`);
                }
            } catch (testError) {
                console.error('API connection test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                return false;
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck.authenticated) {
                // User is authenticated
                console.log('User is authenticated:', sessionCheck.user);
                this.user = sessionCheck.user;
                this.updateCSRFToken(sessionCheck.csrf_token);
                
                // Load messages from storage
                this.loadMessagesFromStorage();
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
                // Show welcome message or load messages
                if (!this.messages || this.messages.length === 0) {
                    this.showWelcomeMessage();
                } else {
                    this.renderMessages();
                }
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                return true;
            } else {
                // User is not authenticated, show login form
                console.log('User is not authenticated');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                return false;
            }
        } catch (error) {
            console.error('Failed to check authentication status:', error);
            this.showError('Authentication check failed');
            return false;
        }
    }
    
    /**
     * Set up user activity tracking
     */
    setupActivityTracking() {
        // Track user activity to detect inactivity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        activityEvents.forEach(event => {
            document.addEventListener(event, this.boundHandlers.activityTracking);
        });
        
        // Set up inactivity check
        this.checkUserActivity();
    }
    
    /**
     * Handle user activity
     */
    handleUserActivity() {
        this.state.lastActivityTime = Date.now();
        
        // If user was inactive, clear status
        if (this.state.isInactive) {
            this.state.isInactive = false;
            // Update status if needed
            if (this.state.user) {
                this.updateUserStatus('online');
            }
        }
        
        // Reset inactivity timeout
        clearTimeout(this.timers.inactivityTimeout);
        this.timers.inactivityTimeout = setTimeout(() => {
            this.handleUserInactivity();
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    /**
     * Handle user inactivity
     */
    handleUserInactivity() {
        this.state.isInactive = true;
        
        // Update status if user is logged in
        if (this.state.user) {
            this.updateUserStatus('away');
        }
        
        console.log('User inactive for 5 minutes');
    }
    
    /**
     * Check user activity status periodically
     */
    checkUserActivity() {
        // Clear any existing interval
        clearInterval(this.timers.statusCheckInterval);
        
        // Set up new interval
        this.timers.statusCheckInterval = setInterval(() => {
            const inactiveTime = Date.now() - this.state.lastActivityTime;
            
            // If inactive for more than 5 minutes and not already marked inactive
            if (inactiveTime > 5 * 60 * 1000 && !this.state.isInactive) {
                this.handleUserInactivity();
            }
        }, 60 * 1000); // Check every minute
    }
    
    /**
     * Update user status
     * @param {string} status - User status (online, away, busy)
     */
    async updateUserStatus(status) {
        if (!this.state.user || !this.state.isOnline) return;
        
        try {
            const response = await fetch(`${this.config.apiEndpoint}/user/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ status })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update status');
            }
            
            this.state.user.status = status;
            
            // Update UI if needed
            const statusElement = document.getElementById('userStatus');
            if (statusElement) {
                statusElement.className = `status-indicator status-${status}`;
                statusElement.setAttribute('title', `Status: ${status}`);
            }
        } catch (error) {
            console.error('Failed to update user status:', error);
        }
    }
    
    /**
     * Set up broadcast channel for cross-tab communication
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('quick_chat_channel');
            
            // Listen for messages from other tabs
            this.broadcastChannel.onmessage = (event) => {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            };
            
            console.log('Broadcast channel set up for cross-tab communication');
        } else {
            // Fallback to localStorage if BroadcastChannel not supported
            window.addEventListener('storage', this.boundHandlers.storageChange);
            console.log('Using localStorage for cross-tab communication (fallback)');
        }
    }
    
    /**
     * Handle storage change events (for cross-tab communication fallback)
     * @param {StorageEvent} e - Storage event
     */
    handleStorageChange(e) {
        if (e.key === 'quick_chat_cross_tab_message') {
            try {
                const { type, data, timestamp } = JSON.parse(e.newValue);
                
                // Ignore old messages
                if (Date.now() - timestamp > 1000) return;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        // Add message to state if not already present
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        // Log out this tab too
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        // Sync theme
                        this.applyTheme(data.theme, false);
                        break;
                }
            } catch (error) {
                console.error('Error processing cross-tab message:', error);
            }
        }
    }
    
    /**
     * Handle logout initiated from another tab
     */
    handleLogoutFromOtherTab() {
        // Only process if currently logged in
        if (this.state.user) {
            this.state.user = null;
            this.showLoginInterface();
            this.showToast('You have been logged out in another tab', 'info');
        }
    }
    
    /**
     * Broadcast a message to other tabs
     * @param {string} type - Message type
     * @param {Object} data - Message data
     */
    broadcastToOtherTabs(type, data) {
        const message = { type, data, timestamp: Date.now() };
        
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage(message);
        } else {
            // Fallback to localStorage
            localStorage.setItem('quick_chat_cross_tab_message', JSON.stringify(message));
        }
    }
    
    /**
     * Initialize the application
     * @returns {Promise<boolean>} Success status of initialization
     */
    async initializeApp() {
        try {
            console.log('QuickChat application initializing...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Initialize theme
            this.applyTheme(this.state.theme);
            
            // Clean up old storage data
            this.cleanupOldStorageData();
            
            // Initialize service worker early but don't block on it
            const serviceWorkerPromise = this.initializeServiceWorker();
            
            // Test API connection first
            try {
                const testResponse = await fetch('api/auth-simple.php?action=test', {
                    cache: 'no-cache',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!testResponse.ok) {
                    throw new Error(`API test failed with status: ${testResponse.status}`);
                }
                
                const testText = await testResponse.text();
                console.log('API test response:', testText);
            } catch (testError) {
                console.error('API test failed:', testError);
                this.showError('Cannot connect to server. Please check your connection.');
                
                // If we're offline, still try to show cached data
                if (!navigator.onLine) {
                    this.loadMessagesFromStorage();
                    this.showChatInterface();
                    return false;
                }
            }
            
            // Check if user is already logged in
            const sessionCheck = await this.checkSession();
            
            if (sessionCheck?.authenticated) {
                this.user = sessionCheck.user;
                console.log('User authenticated:', this.user.username);
                
                // Update CSRF token
                if (sessionCheck.csrf_token) {
                    this.updateCSRFToken(sessionCheck.csrf_token);
                }
                
                // Show chat interface
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
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
                
                // Start checking for new messages
                this.startPeriodicUpdates();
                
                // Wait for service worker to complete in the background
                await serviceWorkerPromise;
                
                console.log('QuickChat application initialized successfully');
                return true;
            } else {
                console.log('User not authenticated, showing login interface');
                this.showLoginInterface();
                
                // Bind authentication events
                this.bindAuthEvents();
                
                console.log('Login interface displayed');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
            return false;
        }
    }
    
    /**
     * Bind authentication-related events
     */
    bindAuthEvents() {
        console.log('Binding authentication events...');
        
        // Authentication forms
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
        
        // Password strength checker
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', (e) => this.checkPasswordStrength(e.target));
        });
        
        console.log('Authentication events bound successfully');
    }
    
    /**
     * Bind chat-related events
     */
    bindChatEvents() {
        console.log('Binding chat events...');
        
        // Chat event elements
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileInput = document.getElementById('fileInput');
        const fileBtn = document.getElementById('fileBtn');
        const clearChatBtn = document.getElementById('clearChatBtn');
        const themeToggle = document.getElementById('themeToggle');
        
        // Message input events
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => this.handleMessageInput(e));
            messageInput.addEventListener('input', () => this.handleTyping());
            messageInput.addEventListener('paste', (e) => this.handlePaste(e));
        }
        
        // Button click events
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
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.confirmLogout());
        
        console.log('Chat events bound successfully');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM ready, initializing QuickChat...');
    
    try {
        const app = new QuickChatApp();
        await app.init();
        console.log('QuickChat application started successfully');
    } catch (error) {
        console.error('Failed to start QuickChat application:', error);
    }
});
