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
        
        // For backward compatibility, add messages property
        this.messages = this.state.messages;
        
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

    /**
     * Confirm logout and handle the logout process
     */
    async confirmLogout() {
        if (!confirm('Are you sure you want to logout?')) {
            return;
        }

        try {
            console.log('Logging out user...');
            
            // Call logout API
            const response = await fetch('api/auth-simple.php?action=logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            const result = await response.json();
            
            if (result.success) {
                // Clear user state
                this.state.user = null;
                this.user = null;
                
                // Clear stored messages
                this.state.messages = [];
                this.messages = [];
                
                // Stop periodic updates
                this.stopPeriodicUpdates();
                
                // Broadcast logout to other tabs
                this.broadcastToOtherTabs('USER_LOGGED_OUT', {});
                
                // Show login interface
                this.showLoginInterface();
                
                this.showToast('Successfully logged out', 'success');
                console.log('User logged out successfully');
            } else {
                throw new Error(result.message || 'Logout failed');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.showError('Failed to logout: ' + error.message);
        }
    }

    /**
     * Show the login interface
     */
    showLoginInterface() {
        console.log('Showing login interface...');
        
        const loginScreen = document.getElementById('loginScreen');
        const chatScreen = document.getElementById('chatScreen');
        
        if (loginScreen && chatScreen) {
            loginScreen.style.display = 'flex';
            loginScreen.classList.add('active');
            chatScreen.style.display = 'none';
            chatScreen.classList.remove('active');
        }
        
        // Clear any existing messages
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Reset document title
        document.title = 'Quick Chat - Login';
        
        console.log('Login interface displayed');
    }

    /**
     * Show the chat interface
     */
    showChatInterface() {
        console.log('Showing chat interface...');
        
        const loginScreen = document.getElementById('loginScreen');
        const chatScreen = document.getElementById('chatScreen');
        
        if (loginScreen && chatScreen) {
            loginScreen.style.display = 'none';
            loginScreen.classList.remove('active');
            chatScreen.style.display = 'flex';
            chatScreen.classList.add('active');
        }
        
        // Update document title
        document.title = 'Quick Chat';
        
        // Update user info in header if available
        if (this.user) {
            const currentUserElement = document.getElementById('currentUser');
            if (currentUserElement) {
                currentUserElement.textContent = this.user.username || this.user.display_name;
            }
        }
        
        console.log('Chat interface displayed');
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        event.preventDefault();
        
        if (this.state.isLoggingIn) {
            console.log('Login already in progress, ignoring');
            return;
        }
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Set login state
        this.state.isLoggingIn = true;
        
        // Get form elements
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.innerHTML;
        
        try {
            console.log('Attempting login...');
            
            // Update button state
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
            }
            
            // Send login request
            const response = await fetch('api/auth-simple.php?action=login', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const result = await response.json();
            console.log('Login response:', result);
            
            if (result.success) {
                // Store user data
                this.user = result.user;
                this.state.user = result.user;
                
                // Update CSRF token if provided
                if (result.csrf_token) {
                    this.updateCSRFToken(result.csrf_token);
                }
                
                console.log('Login successful, user:', this.user);
                
                // Show chat interface immediately
                this.showChatInterface();
                
                // Bind chat events
                this.bindChatEvents();
                
                // Load messages
                await this.loadMessages();
                
                // Start periodic updates
                this.startPeriodicUpdates();
                
                this.showToast('Welcome back, ' + this.user.username + '!', 'success');
                
                // Clear form
                form.reset();
                
            } else {
                throw new Error(result.error || result.message || 'Login failed');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed: ' + error.message);
            
        } finally {
            // Reset login state and button
            this.state.isLoggingIn = false;
            
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText || '<i class="fas fa-sign-in-alt"></i> Sign In';
            }
        }
    }

    /**
     * Handle register form submission
     */
    async handleRegister(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        // Get form elements
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton?.innerHTML;
        
        try {
            console.log('Attempting registration...');
            
            // Update button state
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            }
            
            // Send registration request
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const result = await response.json();
            console.log('Registration response:', result);
            
            if (result.success) {
                this.showToast('Registration successful! Please check your email to verify your account.', 'success');
                
                // Show login form
                this.showLoginForm();
                
                // Clear form
                form.reset();
                
            } else {
                throw new Error(result.message || 'Registration failed');
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('Registration failed: ' + error.message);
            
        } finally {
            // Reset button
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText || '<i class="fas fa-user-plus"></i> Create Account';
            }
        }
    }

    /**
     * Handle password reset form submission
     */
    async handlePasswordReset(event) {
        event.preventDefault();
        
        const form = event.target;
        const formData = new FormData(form);
        
        try {
            const response = await fetch('api/auth.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('If an account with this email exists, a password reset link has been sent.', 'info');
                this.showLoginForm();
            } else {
                throw new Error(result.message || 'Password reset failed');
            }
            
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Password reset failed: ' + error.message);
        }
    }

    /**
     * Show login form
     */
    showLoginForm(event) {
        if (event) {
            event.preventDefault();
        }
        
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        const resetContainer = document.getElementById('resetContainer');
        
        if (loginContainer) loginContainer.style.display = 'block';
        if (registerContainer) registerContainer.style.display = 'none';
        if (resetContainer) resetContainer.style.display = 'none';
    }

    /**
     * Show register form
     */
    showRegisterForm(event) {
        if (event) {
            event.preventDefault();
        }
        
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        const resetContainer = document.getElementById('resetContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (registerContainer) registerContainer.style.display = 'block';
        if (resetContainer) resetContainer.style.display = 'none';
    }

    /**
     * Show reset password form
     */
    showResetForm(event) {
        if (event) {
            event.preventDefault();
        }
        
        const loginContainer = document.getElementById('loginContainer');
        const registerContainer = document.getElementById('registerContainer');
        const resetContainer = document.getElementById('resetContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (registerContainer) registerContainer.style.display = 'none';
        if (resetContainer) resetContainer.style.display = 'block';
    }

    /**
     * Check session status with the server
     */
    async checkSession() {
        try {
            const response = await fetch('api/auth-simple.php?action=check_session', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`Session check failed with status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Session check result:', result);
            
            return {
                authenticated: result.authenticated || false,
                user: result.user || null,
                csrf_token: result.csrf_token || null
            };
            
        } catch (error) {
            console.error('Session check error:', error);
            return {
                authenticated: false,
                user: null,
                csrf_token: null
            };
        }
    }

    /**
     * Show error message to user
     */
    showError(message, duration = 5000) {
        console.error('Error:', message);
        this.showToast(message, 'error', duration);
    }

    /**
     * Show toast message
     */
    showToast(message, type = 'info', duration = 5000) {
        // Don't use chat handler to avoid circular calls
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Try to create a simple toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }

    /**
     * Update CSRF token
     */
    updateCSRFToken(token) {
        this.csrfToken = token;
        
        // Update meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) {
            metaTag.content = token;
        }
        
        // Update hidden form inputs
        const hiddenInputs = document.querySelectorAll('input[name="csrf_token"]');
        hiddenInputs.forEach(input => {
            input.value = token;
        });
    }

    /**
     * Get CSRF token
     */
    getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.content : '';
    }

    /**
     * Check password strength
     */
    checkPasswordStrength(input) {
        // Simple password strength checking
        const password = input.value;
        const strengthIndicator = input.parentElement.querySelector('.password-strength');
        
        if (!strengthIndicator) return;
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['#f44336', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'];
        
        strengthIndicator.textContent = levels[strength] || '';
        strengthIndicator.style.color = colors[strength] || '#999';
    }

    /**
     * Additional placeholder methods that might be called
     */
    async loadMessages() {
        // Implementation would load messages from API
        console.log('Loading messages...');
    }

    async sendMessage(content) {
        // Implementation would send message via API
        console.log('Sending message:', content);
    }

    async loadMessagesFromStorage() {
        // Implementation would load cached messages
        console.log('Loading messages from storage...');
        return false;
    }

    renderMessages() {
        // Implementation would render messages in UI
        console.log('Rendering messages...');
    }

    scrollToBottom() {
        // Use chat handler if available
        if (window.chatHandler && typeof window.chatHandler.scrollToBottom === 'function') {
            window.chatHandler.scrollToBottom();
        }
    }

    showWelcomeMessage() {
        // Implementation would show welcome message
        console.log('Showing welcome message...');
    }

    startPeriodicUpdates() {
        // Implementation would start polling for new messages
        console.log('Starting periodic updates...');
    }

    stopPeriodicUpdates() {
        // Implementation would stop polling
        console.log('Stopping periodic updates...');
    }

    handleMessageInput(event) {
        // Implementation would handle message input events
        console.log('Message input event:', event.type);
    }

    handleTyping() {
        // Implementation would handle typing indicators
        console.log('User is typing...');
    }

    handleFileUpload(event) {
        // Implementation would handle file uploads
        console.log('File upload:', event.target.files);
    }

    clearChat() {
        // Implementation would clear chat messages
        console.log('Clearing chat...');
    }

    toggleEmojiPicker() {
        // Implementation would toggle emoji picker
        console.log('Toggling emoji picker...');
    }

    toggleRecording() {
        // Implementation would toggle voice recording
        console.log('Toggling recording...');
    }

    showSettings() {
        // Implementation would show settings modal
        console.log('Showing settings...');
    }

    /**
     * Handle user activity tracking
     */
    handleUserActivity(event) {
        this.state.lastActivityTime = Date.now();
        console.log('User activity tracked:', event.type);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Implementation for keyboard shortcuts
        console.log('Keyboard shortcut:', event.key);
    }

    /**
     * Handle storage change events
     */
    handleStorageChange(event) {
        // Implementation for storage changes
        console.log('Storage changed:', event.key);
    }

    /**
     * Setup event listeners for the application
     */
    setupEventListeners() {
        // Document visibility change
        document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);
        
        // Online/offline status
        window.addEventListener('online', this.boundHandlers.onlineStatusChange);
        window.addEventListener('offline', this.boundHandlers.onlineStatusChange);
        
        // Before unload
        window.addEventListener('beforeunload', this.boundHandlers.beforeUnload);
        
        // Storage changes
        window.addEventListener('storage', this.boundHandlers.storageChange);
        
        // User activity tracking
        document.addEventListener('click', this.boundHandlers.activityTracking);
        document.addEventListener('keydown', this.boundHandlers.activityTracking);
        document.addEventListener('mousemove', this.boundHandlers.activityTracking);
        
        console.log('Event listeners setup complete');
    }

    /**
     * Clean up old storage data
     */
    cleanupOldStorageData() {
        try {
            // Remove old data older than 30 days
            const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
            
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.timestamp && data.timestamp < cutoffTime) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // Remove corrupted data
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old storage data:', error);
        }
    }

    /**
     * Setup broadcast channel for cross-tab communication
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('quick_chat_channel');
            
            this.broadcastChannel.onmessage = (event) => {
                const { type, data } = event.data;
                
                switch (type) {
                    case 'NEW_MESSAGE':
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        this.applyTheme(data.theme);
                        break;
                }
            };
        }
    }

    /**
     * Setup activity tracking
     */
    setupActivityTracking() {
        // Setup activity monitoring
        this.state.lastActivityTime = Date.now();
        
        // Check user activity periodically
        setInterval(() => {
            const inactiveTime = Date.now() - this.state.lastActivityTime;
            if (inactiveTime > 300000) { // 5 minutes
                console.log('User inactive for 5 minutes');
            }
        }, 60000); // Check every minute
    }

    /**
     * Clean up old storage data
     */
    cleanupOldStorageData() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.config.storagePrefix)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data.timestamp && Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        keysToRemove.push(key);
                    }
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`Cleaned up ${keysToRemove.length} old storage entries`);
        } catch (error) {
            console.error('Error cleaning up storage:', error);
        }
    }

    /**
     * Initialize service worker for offline support
     */
    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                return registration;
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
                return null;
            }
        } else {
            console.warn('Service Workers not supported');
            return null;
        }
    }

    /**
     * Set up broadcast channel for cross-tab communication
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('quick_chat_channel');
            this.broadcastChannel.onmessage = (event) => {
                const { type, data } = event.data;
                switch (type) {
                    case 'NEW_MESSAGE':
                        if (!this.state.messages.some(m => m.id === data.id)) {
                            this.state.messages.push(data);
                            this.renderMessages();
                        }
                        break;
                    case 'USER_LOGGED_OUT':
                        this.handleLogoutFromOtherTab();
                        break;
                    case 'THEME_CHANGED':
                        this.applyTheme(data.theme);
                        break;
                }
            };
            console.log('Broadcast channel initialized');
        } else {
            window.addEventListener('storage', this.boundHandlers.storageChange);
        }
    }

    /**
     * Setup event listeners for the application
     */
    setupEventListeners() {
        console.log('Setting up global event listeners...');
        
        // Set up activity tracking
        this.setupActivityTracking();
        
        console.log('Global event listeners set up successfully');
    }

    /**
     * Clean up old storage data
     */
    cleanupOldStorageData() {
        try {
            const prefix = this.config.storagePrefix;
            const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
            
            // Clean up old message cache
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix + 'messages_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.timestamp && data.timestamp < cutoffTime) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        // Remove corrupted data
                        localStorage.removeItem(key);
                    }
                }
            }
            
            console.log('Storage cleanup completed');
        } catch (error) {
            console.error('Storage cleanup error:', error);
        }
    }

    /**
     * Handle storage change events (for cross-tab communication fallback)
     */
    handleStorageChange(e) {
        if (e.key === 'quick_chat_cross_tab_message') {
            try {
                const message = JSON.parse(e.newValue);
                // Process cross-tab message
                if (message.type === 'USER_LOGGED_OUT') {
                    this.handleLogoutFromOtherTab();
                }
            } catch (error) {
                console.error('Failed to process cross-tab message:', error);
            }
        }
    }

    /**
     * Handle user activity for auto-away status
     */
    handleUserActivity() {
        this.state.lastActivityTime = Date.now();
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const messageInput = document.getElementById('messageInput');
            if (messageInput && document.activeElement === messageInput) {
                e.preventDefault();
                this.sendMessage();
            }
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            // Close emoji picker
            if (window.chatHandler && typeof window.chatHandler.hideEmojiPicker === 'function') {
                window.chatHandler.hideEmojiPicker();
            }
        }
    }

    /**
     * Set up user activity tracking
     */
    setupActivityTracking() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, this.boundHandlers.activityTracking, true);
        });
        document.addEventListener('visibilitychange', this.boundHandlers.visibilityChange);
        window.addEventListener('online', this.boundHandlers.onlineStatusChange);
        window.addEventListener('offline', this.boundHandlers.onlineStatusChange);
        window.addEventListener('beforeunload', this.boundHandlers.beforeUnload);
        document.addEventListener('keydown', this.boundHandlers.keyboardShortcuts);
        console.log('Activity tracking initialized');
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM ready, initializing QuickChat...');
    
    try {
        const app = new QuickChatApp();
        
        // Expose app to global scope for integration
        window.quickChatApp = app;
        
        await app.init();
        console.log('QuickChat application started successfully');
    } catch (error) {
        console.error('Failed to start QuickChat application:', error);
    }
});
