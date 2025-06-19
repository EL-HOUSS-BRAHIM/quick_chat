/**
 * Enhanced Quick Chat Application - DEPRECATED
 * Version: 2025-06-19 - Added performance monitoring
 * Features: Real-time messaging, offline support, file uploads, notifications, dark mode
 * 
 * NOTICE: This file is maintained for backward compatibility.
 * New code should use the modular architecture in /assets/js/core/app.js
 */
import appCompatibilityLayer from './app-compatibility.js';

// Re-export the compatibility layer
export default appCompatibilityLayer;

// For backward compatibility, keep the original class definition
class QuickChatApp {
    /**
     * Initialize the QuickChat application
     */
    constructor() {
        console.log('QuickChatApp v2025-06-19 initializing...');
        
        // Performance monitor is automatically initialized on import
        this.performanceMonitor = performanceMonitor;
        
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
    async checkForNewMessages() {
        try {
            // Don't check if not authenticated or if offline
            if (!this.user || !this.state.isOnline) {
                return false;
            }
            
            // Prepare request parameters
            const url = new URL('/api/messages.php', window.location.origin);
            url.searchParams.set('action', 'get_new');
            
            // Add last message ID if we have one
            if (this.state.lastMessageId) {
                url.searchParams.set('after_id', this.state.lastMessageId);
            }
            
            // Add target user for direct messages
            if (this.state.targetUser) {
                url.searchParams.set('target_user_id', this.state.targetUser.id);
            }
            
            // Add limit to prevent too many messages at once
            url.searchParams.set('limit', '20');
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Cache-Control': 'no-cache'
                },
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Session expired
                    this.logout();
                    return false;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data && result.data.length > 0) {
                const newMessages = result.data;
                let hasNewMessages = false;
                
                // Add new messages to state
                newMessages.forEach(message => {
                    // Check if message is not already in our array
                    const exists = this.state.messages.find(msg => msg.id === message.id);
                    if (!exists) {
                        // Mark messages from other users
                        message.is_own = message.user_id === this.user.id;
                        
                        this.state.messages.push(message);
                        hasNewMessages = true;
                        
                        // Update last message ID
                        if (message.id > this.state.lastMessageId) {
                            this.state.lastMessageId = message.id;
                        }
                        
                        // Show notification for messages from other users
                        if (!message.is_own && !this.state.isVisible) {
                            this.showNotification(message);
                        }
                        
                        // Play sound for new messages
                        if (!message.is_own && this.state.soundEnabled) {
                            this.playNotificationSound();
                        }
                    }
                });
                
                if (hasNewMessages) {
                    // Sort messages by timestamp
                    this.state.messages.sort((a, b) => 
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    
                    // Re-render messages
                    this.renderMessages();
                    
                    // Auto-scroll to bottom if user was already at bottom
                    if (this.isScrollAtBottom()) {
                        this.scrollToBottom();
                    }
                    
                    // Update unread count if window is not visible
                    if (!this.state.isVisible) {
                        this.state.unreadMessages += newMessages.filter(msg => !msg.is_own).length;
                        this.updateUnreadCount();
                    }
                    
                    // Save to storage
                    this.saveMessagesToStorage();
                    
                    // Broadcast to other tabs
                    this.broadcastToOtherTabs('new_messages', newMessages);
                    
                    // Trigger custom event
                    const event = new CustomEvent('newMessages', {
                        detail: { messages: newMessages, count: newMessages.length }
                    });
                    document.dispatchEvent(event);
                }
                
                return hasNewMessages;
            }
            
            return false;
            
        } catch (error) {
            console.error('Failed to check for new messages:', error);
            
            // Don't show error to user unless it's a critical error
            if (error.message.includes('401')) {
                this.showError('Session expired. Please log in again.');
                this.logout();
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                // Network error - will retry on next poll
                console.warn('Network error checking for messages, will retry...');
            }
            
            return false;
        }
    }
    
    isScrollAtBottom() {
        const messagesList = document.getElementById('messagesList') || 
                           document.getElementById('messagesContainer') || 
                           document.querySelector('.messages-list');
        
        if (!messagesList) return true;
        
        const threshold = 100; // pixels from bottom
        return (messagesList.scrollTop + messagesList.clientHeight) >= 
               (messagesList.scrollHeight - threshold);
    }
    
    showNotification(message) {
        if (!this.state.notificationsEnabled || Notification.permission !== 'granted') {
            return;
        }
        
        try {
            const title = message.display_name || message.username || 'New Message';
            let body = message.content;
            
            // Truncate long messages
            if (body.length > 100) {
                body = body.substring(0, 97) + '...';
            }
            
            // Handle different message types
            if (message.message_type !== 'text') {
                switch (message.message_type) {
                    case 'image':
                        body = '📷 Sent an image';
                        break;
                    case 'video':
                        body = '🎥 Sent a video';
                        break;
                    case 'audio':
                        body = '🎵 Sent an audio file';
                        break;
                    case 'document':
                        body = '📄 Sent a document';
                        break;
                    default:
                        body = '📎 Sent a file';
                }
            }
            
            const notification = new Notification(title, {
                body: body,
                icon: message.avatar || '/assets/images/default-avatar.png',
                badge: '/assets/images/icon-192.png',
                tag: `message-${message.id}`,
                requireInteraction: false,
                silent: false
            });
            
            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);
            
            // Click to focus window
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }
    
    playNotificationSound() {
        try {
            // Use Web Audio API for better browser support
            if (window.AudioContext || window.webkitAudioContext) {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Create a simple notification sound (short beep)
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            } else {
                // Fallback to HTML5 Audio (if sound file exists)
                const audio = new Audio('/assets/sounds/notification.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {
                    // Ignore play errors (user interaction required, etc.)
                });
            }
        } catch (error) {
            console.error('Failed to play notification sound:', error);
        }
    }
    
    updateUnreadCount() {
        // Update title
        if (this.state.unreadMessages > 0) {
            document.title = `(${this.state.unreadMessages}) Quick Chat`;
        } else {
            document.title = 'Quick Chat';
        }
        
        // Update badge/indicator if it exists
        const unreadBadge = document.querySelector('.unread-badge') || 
                           document.getElementById('unreadCount');
        
        if (unreadBadge) {
            if (this.state.unreadMessages > 0) {
                unreadBadge.textContent = this.state.unreadMessages > 99 ? '99+' : this.state.unreadMessages;
                unreadBadge.style.display = 'inline';
            } else {
                unreadBadge.style.display = 'none';
            }
        }
        
        // Update favicon if available
        this.updateFavicon();
    }
    
    updateFavicon() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            
            // Draw base icon (simple circle)
            ctx.fillStyle = '#667eea';
            ctx.beginPath();
            ctx.arc(16, 16, 14, 0, 2 * Math.PI);
            ctx.fill();
            
            // Add unread count if there are unread messages
            if (this.state.unreadMessages > 0) {
                ctx.fillStyle = '#ff4444';
                ctx.beginPath();
                ctx.arc(24, 8, 8, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const text = this.state.unreadMessages > 9 ? '9+' : this.state.unreadMessages.toString();
                ctx.fillText(text, 24, 8);
            }
            
            // Update favicon
            const link = document.querySelector('link[rel="icon"]') || 
                        document.createElement('link');
            link.rel = 'icon';
            link.href = canvas.toDataURL();
            
            if (!document.querySelector('link[rel="icon"]')) {
                document.head.appendChild(link);
            }
        } catch (error) {
            console.error('Failed to update favicon:', error);
        }
    }

    async sendMessage(content) {
        // Track message send performance
        const endTracking = this.performanceMonitor.trackInteraction('message', 'send');
        
        try {
            // Get message content from input if not provided
            if (!content) {
                const messageInput = document.getElementById('messageInput') || 
                                   document.querySelector('input[type="text"]') ||
                                   document.querySelector('textarea');
                
                if (!messageInput) {
                    throw new Error('Message input not found');
                }
                
                content = messageInput.value.trim();
                
                if (!content) {
                    this.showError('Message cannot be empty');
                    endTracking(false, { error: 'empty_message' });
                    return false;
                }
            }
            
            // Validate message length
            if (content.length > this.config.maxMessageLength) {
                this.showError(`Message too long. Maximum ${this.config.maxMessageLength} characters.`);
                endTracking(false, { error: 'message_too_long', length: content.length });
                return false;
            }
            
            // Check if user is authenticated
            if (!this.user) {
                this.showError('You must be logged in to send messages');
                endTracking(false, { error: 'not_authenticated' });
                return false;
            }
            
            // Create temporary message for immediate UI feedback
            const tempMessage = {
                id: 'temp_' + Date.now(),
                content: content,
                user_id: this.user.id,
                username: this.user.username,
                display_name: this.user.display_name || this.user.username,
                avatar: this.user.avatar,
                created_at: new Date().toISOString(),
                is_own: true,
                pending: true
            };
            
            // Add to messages array for immediate display
            this.state.messages.push(tempMessage);
            this.renderMessages();
            this.scrollToBottom();
            
            // Clear input
            const messageInput = document.getElementById('messageInput') || 
                               document.querySelector('input[type="text"]') ||
                               document.querySelector('textarea');
            if (messageInput) {
                messageInput.value = '';
                messageInput.focus();
            }
            
            // Prepare form data
            const formData = new FormData();
            formData.append('action', 'send');
            formData.append('message', content);
            formData.append('csrf_token', this.csrfToken);
            
            // Add reply context if replying
            if (this.state.replyingTo) {
                formData.append('reply_to_id', this.state.replyingTo.id);
                this.clearReply();
            }
            
            // Send to API
            const response = await fetch('/api/messages.php', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Remove temporary message and add real message
                this.state.messages = this.state.messages.filter(msg => msg.id !== tempMessage.id);
                
                if (result.data) {
                    this.state.messages.push({
                        ...result.data,
                        is_own: true
                    });
                    
                    // Update last message ID
                    this.state.lastMessageId = result.data.id;
                    
                    // Save to storage
                    this.saveMessagesToStorage();
                }
                
                this.renderMessages();
                this.scrollToBottom();
                
                // Update character counter if it exists
                const charCounter = document.querySelector('.char-counter');
                if (charCounter) {
                    charCounter.textContent = '0';
                }
                
                // Broadcast to other tabs
                this.broadcastToOtherTabs('message_sent', result.data);
                
                // Track successful message send
                endTracking(true, { 
                    messageId: result.data.id,
                    messageLength: content.length,
                    hasReply: this.state.replyingTo !== null
                });
                
                return true;
            } else {
                throw new Error(result.message || 'Failed to send message');
            }
            
        } catch (error) {
            console.error('Failed to send message:', error);
            
            // Remove temporary message on error
            this.state.messages = this.state.messages.filter(msg => !msg.pending);
            this.renderMessages();
            
            // Show error
            if (error.message.includes('401') || error.message.includes('authentication')) {
                this.showError('Session expired. Please log in again.');
                this.logout();
                endTracking(false, { error: 'authentication_error' });
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                this.showError('Network error. Message will be sent when connection is restored.');
                // Queue message for retry when online
                this.queueOfflineMessage(content);
                endTracking(false, { error: 'network_error', queued: true });
            } else {
                this.showError(error.message || 'Failed to send message');
                endTracking(false, { error: error.message || 'unknown_error' });
            }
            
            return false;
        }
    }

    async loadMessagesFromStorage() {
        // Implementation would load cached messages
        console.log('Loading messages from storage...');
        return false;
    }

    renderMessages() {
        try {
            // Find message containers
            const messagesList = document.getElementById('messagesList') || 
                                document.getElementById('messagesContainer') || 
                                document.querySelector('.messages-list') ||
                                document.querySelector('.chat-messages');
            
            if (!messagesList) {
                console.warn('Message container not found');
                return;
            }
            
            // Clear existing messages
            messagesList.innerHTML = '';
            
            if (!this.state.messages || this.state.messages.length === 0) {
                this.showWelcomeMessage();
                return;
            }
            
            // Group messages by date
            const messagesByDate = this.groupMessagesByDate(this.state.messages);
            
            // Render messages
            Object.keys(messagesByDate).forEach(date => {
                // Add date separator
                if (Object.keys(messagesByDate).length > 1) {
                    const dateSeparator = this.createDateSeparator(date);
                    messagesList.appendChild(dateSeparator);
                }
                
                const messagesOnDate = messagesByDate[date];
                
                // Group consecutive messages from same user
                const messageGroups = this.groupConsecutiveMessages(messagesOnDate);
                
                messageGroups.forEach(group => {
                    const messageGroup = this.createMessageGroup(group);
                    messagesList.appendChild(messageGroup);
                });
            });
            
            // Update unread count
            this.updateUnreadCount();
            
            // Trigger custom event
            const event = new CustomEvent('messagesRendered', {
                detail: { messageCount: this.state.messages.length }
            });
            document.dispatchEvent(event);
            
        } catch (error) {
            console.error('Failed to render messages:', error);
            this.showError('Failed to display messages');
        }
    }
    
    groupMessagesByDate(messages) {
        const grouped = {};
        
        messages.forEach(message => {
            const date = new Date(message.created_at).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(message);
        });
        
        return grouped;
    }
    
    groupConsecutiveMessages(messages) {
        const groups = [];
        let currentGroup = [];
        let lastUserId = null;
        let lastTime = null;
        
        messages.forEach(message => {
            const messageTime = new Date(message.created_at).getTime();
            const timeDiff = lastTime ? messageTime - lastTime : 0;
            const sameUser = message.user_id === lastUserId;
            const withinTimeLimit = timeDiff < 300000; // 5 minutes
            
            if (sameUser && withinTimeLimit && currentGroup.length > 0) {
                currentGroup.push(message);
            } else {
                if (currentGroup.length > 0) {
                    groups.push([...currentGroup]);
                }
                currentGroup = [message];
            }
            
            lastUserId = message.user_id;
            lastTime = messageTime;
        });
        
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        
        return groups;
    }
    
    createDateSeparator(date) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        
        const dateText = document.createElement('span');
        dateText.className = 'date-text';
        
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (date === today) {
            dateText.textContent = 'Today';
        } else if (date === yesterday) {
            dateText.textContent = 'Yesterday';
        } else {
            dateText.textContent = new Date(date).toLocaleDateString();
        }
        
        separator.appendChild(dateText);
        return separator;
    }
    
    createMessageGroup(messages) {
        const group = document.createElement('div');
        const firstMessage = messages[0];
        const isOwn = firstMessage.user_id === this.user?.id;
        
        group.className = `message-group ${isOwn ? 'own' : 'other'}`;
        
        // Add avatar for other users
        if (!isOwn) {
            const avatar = this.createAvatar(firstMessage);
            group.appendChild(avatar);
        }
        
        // Message content container
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Add user info for other users or group chats
        if (!isOwn) {
            const userInfo = document.createElement('div');
            userInfo.className = 'message-user';
            userInfo.textContent = firstMessage.display_name || firstMessage.username;
            content.appendChild(userInfo);
        }
        
        // Add messages
        messages.forEach(message => {
            const messageEl = this.createMessageElement(message, isOwn);
            content.appendChild(messageEl);
        });
        
        group.appendChild(content);
        return group;
    }
    
    createMessageElement(message, isOwn) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isOwn ? 'own' : 'other'}`;
        messageEl.setAttribute('data-message-id', message.id);
        
        if (message.pending) {
            messageEl.classList.add('pending');
        }
        
        // Message text
        const text = document.createElement('div');
        text.className = 'message-text';
        text.innerHTML = this.formatMessageText(message.content);
        messageEl.appendChild(text);
        
        // Message meta (time, status)
        const meta = document.createElement('div');
        meta.className = 'message-meta';
        
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.created_at);
        meta.appendChild(time);
        
        // Status indicators for own messages
        if (isOwn) {
            const status = document.createElement('span');
            status.className = 'message-status';
            
            if (message.pending) {
                status.innerHTML = '<i class="icon-clock"></i>';
                status.title = 'Sending...';
            } else {
                status.innerHTML = '<i class="icon-check"></i>';
                status.title = 'Sent';
            }
            
            meta.appendChild(status);
        }
        
        messageEl.appendChild(meta);
        
        // Add context menu
        messageEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageContextMenu(e, message);
        });
        
        return messageEl;
    }
    
    createAvatar(message) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (message.avatar) {
            const img = document.createElement('img');
            img.src = message.avatar;
            img.alt = message.display_name || message.username;
            img.onerror = () => {
                img.style.display = 'none';
                avatar.textContent = (message.display_name || message.username).charAt(0).toUpperCase();
            };
            avatar.appendChild(img);
        } else {
            avatar.textContent = (message.display_name || message.username).charAt(0).toUpperCase();
        }
        
        return avatar;
    }
    
    formatMessageText(text) {
        // Basic formatting (enhance as needed)
        return text
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        try {
            // Don't start if already running
            if (this.timers.pollInterval) {
                console.log('Polling already active');
                return;
            }
            
            // Don't start if not authenticated
            if (!this.user) {
                console.log('Cannot start polling: not authenticated');
                return;
            }
            
            console.log('Starting periodic message updates...');
            
            // Initial check
            this.checkForNewMessages();
            
            // Set up regular polling
            this.timers.pollInterval = setInterval(async () => {
                try {
                    // Only check if online and window is visible or has been visible recently
                    if (this.state.isOnline && (this.state.isVisible || 
                        Date.now() - this.state.lastActivityTime < 300000)) { // 5 minutes
                        
                        await this.checkForNewMessages();
                        
                        // Also check for typing indicators
                        await this.checkTypingStatus();
                        
                        // Update user status
                        await this.updateUserActivity();
                    }
                } catch (error) {
                    console.error('Error during periodic update:', error);
                    
                    // If we get authentication errors repeatedly, stop polling
                    if (error.message.includes('401')) {
                        this.stopPeriodicUpdates();
                        this.logout();
                    }
                }
            }, this.config.pollInterval);
            
            // Also start a slower interval for user status updates
            this.timers.statusCheckInterval = setInterval(async () => {
                if (this.state.isOnline && this.user) {
                    try {
                        await this.updateOnlineStatus();
                    } catch (error) {
                        console.error('Error updating online status:', error);
                    }
                }
            }, 30000); // Every 30 seconds
            
            console.log(`Polling started with ${this.config.pollInterval}ms interval`);
            
        } catch (error) {
            console.error('Failed to start periodic updates:', error);
        }
    }
    
    stopPeriodicUpdates() {
        console.log('Stopping periodic updates...');
        
        // Clear all timers
        if (this.timers.pollInterval) {
            clearInterval(this.timers.pollInterval);
            this.timers.pollInterval = null;
        }
        
        if (this.timers.statusCheckInterval) {
            clearInterval(this.timers.statusCheckInterval);
            this.timers.statusCheckInterval = null;
        }
        
        if (this.timers.typingTimeout) {
            clearTimeout(this.timers.typingTimeout);
            this.timers.typingTimeout = null;
        }
        
        if (this.timers.reconnectTimeout) {
            clearTimeout(this.timers.reconnectTimeout);
            this.timers.reconnectTimeout = null;
        }
        
        if (this.timers.inactivityTimeout) {
            clearTimeout(this.timers.inactivityTimeout);
            this.timers.inactivityTimeout = null;
        }
        
        console.log('All periodic updates stopped');
    }
    
    async checkTypingStatus() {
        try {
            if (!this.state.targetUser) {
                return;
            }
            
            const url = new URL('/api/messages.php', window.location.origin);
            url.searchParams.set('action', 'get_typing');
            url.searchParams.set('target_user_id', this.state.targetUser.id);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.updateTypingIndicator(result.data || []);
                }
            }
        } catch (error) {
            console.error('Failed to check typing status:', error);
        }
    }
    
    updateTypingIndicator(typingUsers) {
        const typingIndicator = document.getElementById('typingIndicator') || 
                              document.querySelector('.typing-indicator');
        
        if (!typingIndicator) return;
        
        const currentTypingUsers = typingUsers.filter(user => user.id !== this.user.id);
        
        if (currentTypingUsers.length === 0) {
            typingIndicator.style.display = 'none';
            return;
        }
        
        let text = '';
        if (currentTypingUsers.length === 1) {
            text = `${currentTypingUsers[0].display_name || currentTypingUsers[0].username} is typing...`;
        } else if (currentTypingUsers.length === 2) {
            text = `${currentTypingUsers[0].display_name || currentTypingUsers[0].username} and ${currentTypingUsers[1].display_name || currentTypingUsers[1].username} are typing...`;
        } else {
            text = `${currentTypingUsers.length} people are typing...`;
        }
        
        typingIndicator.textContent = text;
        typingIndicator.style.display = 'block';
        
        // Auto-hide after 10 seconds (in case we miss the stop signal)
        setTimeout(() => {
            if (typingIndicator.textContent === text) {
                typingIndicator.style.display = 'none';
            }
        }, 10000);
    }
    
    async updateUserActivity() {
        try {
            // Update last activity time
            this.state.lastActivityTime = Date.now();
            
            // Send activity ping to server occasionally
            const now = Date.now();
            if (!this.lastActivityPing || now - this.lastActivityPing > 60000) { // Every minute
                await this.sendActivityPing();
                this.lastActivityPing = now;
            }
        } catch (error) {
            console.error('Failed to update user activity:', error);
        }
    }
    
    async sendActivityPing() {
        try {
            const response = await fetch('/api/users.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: new URLSearchParams({
                    action: 'ping',
                    csrf_token: this.csrfToken
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.csrf_token) {
                    this.updateCSRFToken(result.csrf_token);
                }
            }
        } catch (error) {
            console.error('Failed to send activity ping:', error);
        }
    }
    
    async updateOnlineStatus() {
        try {
            const status = this.state.isVisible ? 'online' : 'away';
            
            const response = await fetch('/api/users.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: new URLSearchParams({
                    action: 'update_status',
                    status: status,
                    csrf_token: this.csrfToken
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.csrf_token) {
                    this.updateCSRFToken(result.csrf_token);
                }
            }
        } catch (error) {
            console.error('Failed to update online status:', error);
        }
    }

    handleMessageInput(event) {
        // Implementation would handle message input events
        console.log('Message input event:', event.type);
    }

    handleTyping() {
        // Implementation would handle typing indicators
        console.log('User is typing...');
    }

    async handleFileUpload(event) {
        try {
            const files = event.target?.files || event.dataTransfer?.files;
            
            if (!files || files.length === 0) {
                this.showError('No files selected');
                return false;
            }
            
            // Check authentication
            if (!this.user) {
                this.showError('You must be logged in to upload files');
                return false;
            }
            
            // Process each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                await this.uploadSingleFile(file);
            }
            
            // Clear file input
            if (event.target && event.target.tagName === 'INPUT') {
                event.target.value = '';
            }
            
            return true;
            
        } catch (error) {
            console.error('File upload handler error:', error);
            this.showError('Failed to process file upload');
            return false;
        }
    }
    
    async uploadSingleFile(file) {
        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                this.showError(validation.error);
                return false;
            }
            
            // Create upload progress indicator
            const uploadId = 'upload_' + Date.now() + '_' + Math.random();
            this.createUploadProgress(uploadId, file.name);
            
            // Add to pending uploads
            this.state.pendingUploads.set(uploadId, {
                file: file,
                name: file.name,
                size: file.size,
                progress: 0,
                status: 'uploading'
            });
            
            // Prepare form data
            const formData = new FormData();
            formData.append('file', file);
            formData.append('csrf_token', this.csrfToken);
            formData.append('type', 'auto'); // Let server determine type
            
            // Add optional message
            const messageInput = document.getElementById('messageInput');
            if (messageInput && messageInput.value.trim()) {
                formData.append('message', messageInput.value.trim());
                messageInput.value = '';
            }
            
            // Add target user if in direct chat
            if (this.state.targetUser) {
                formData.append('target_user_id', this.state.targetUser.id);
            }
            
            // Upload with progress tracking
            const response = await this.uploadWithProgress(formData, uploadId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Update upload status
                this.updateUploadProgress(uploadId, 100, 'complete');
                
                // Add message to chat
                if (result.data) {
                    this.state.messages.push({
                        ...result.data,
                        is_own: true
                    });
                    
                    this.renderMessages();
                    this.scrollToBottom();
                    
                    // Save to storage
                    this.saveMessagesToStorage();
                    
                    // Broadcast to other tabs
                    this.broadcastToOtherTabs('file_uploaded', result.data);
                }
                
                // Remove upload progress after delay
                setTimeout(() => {
                    this.removeUploadProgress(uploadId);
                    this.state.pendingUploads.delete(uploadId);
                }, 2000);
                
                this.showToast(`File "${file.name}" uploaded successfully`, 'success');
                return true;
                
            } else {
                throw new Error(result.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('File upload error:', error);
            
            // Update upload status to error
            this.updateUploadProgress(uploadId, 0, 'error');
            
            // Show error message
            let errorMessage = 'Failed to upload file';
            if (error.message.includes('413')) {
                errorMessage = 'File is too large';
            } else if (error.message.includes('415')) {
                errorMessage = 'File type not supported';
            } else if (error.message.includes('401')) {
                errorMessage = 'Session expired. Please log in again.';
                this.logout();
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showError(`Upload failed: ${errorMessage}`);
            
            // Remove upload progress after delay
            setTimeout(() => {
                this.removeUploadProgress(uploadId);
                this.state.pendingUploads.delete(uploadId);
            }, 5000);
            
            return false;
        }
    }
    
    validateFile(file) {
        const result = { valid: false, error: '' };
        
        // Check file size (10MB limit)
        if (file.size > this.config.maxFileSize) {
            result.error = `File too large. Maximum size is ${this.config.maxFileSize / 1024 / 1024}MB`;
            return result;
        }
        
        if (file.size <= 0) {
            result.error = 'File is empty';
            return result;
        }
        
        // Check file type
        const allowedTypes = [
            // Images
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            // Videos
            'video/mp4', 'video/webm', 'video/quicktime',
            // Audio
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
            // Documents
            'application/pdf', 'text/plain',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedTypes.includes(file.type)) {
            result.error = `File type "${file.type}" is not supported`;
            return result;
        }
        
        result.valid = true;
        return result;
    }
    
    async uploadWithProgress(formData, uploadId) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    this.updateUploadProgress(uploadId, percentComplete, 'uploading');
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve({
                        ok: true,
                        status: xhr.status,
                        json: () => Promise.resolve(JSON.parse(xhr.responseText))
                    });
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                }
            });
            
            xhr.addEventListener('error', () => {
                reject(new Error('Network error during upload'));
            });
            
            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timeout'));
            });
            
            xhr.open('POST', '/api/upload.php');
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.timeout = 60000; // 60 second timeout
            xhr.send(formData);
        });
    }
    
    createUploadProgress(uploadId, fileName) {
        const container = document.getElementById('uploadProgressContainer') || 
                         document.querySelector('.upload-progress-container') ||
                         this.createUploadProgressContainer();
        
        const progressEl = document.createElement('div');
        progressEl.className = 'upload-progress-item';
        progressEl.setAttribute('data-upload-id', uploadId);
        
        progressEl.innerHTML = `
            <div class="upload-info">
                <span class="upload-filename">${this.escapeHtml(fileName)}</span>
                <span class="upload-status">Preparing...</span>
            </div>
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <button class="upload-cancel-btn" title="Cancel Upload">
                <i class="icon-times"></i>
            </button>
        `;
        
        // Add cancel functionality
        const cancelBtn = progressEl.querySelector('.upload-cancel-btn');
        cancelBtn.addEventListener('click', () => {
            this.cancelUpload(uploadId);
        });
        
        container.appendChild(progressEl);
    }
    
    createUploadProgressContainer() {
        const container = document.createElement('div');
        container.id = 'uploadProgressContainer';
        container.className = 'upload-progress-container';
        
        // Insert before message input
        const messageForm = document.getElementById('messageForm') || 
                           document.querySelector('.message-form');
        
        if (messageForm) {
            messageForm.parentNode.insertBefore(container, messageForm);
        } else {
            document.body.appendChild(container);
        }
        
        return container;
    }
    
    updateUploadProgress(uploadId, progress, status) {
        const progressEl = document.querySelector(`[data-upload-id="${uploadId}"]`);
        if (!progressEl) return;
        
        const progressFill = progressEl.querySelector('.upload-progress-fill');
        const statusEl = progressEl.querySelector('.upload-status');
        
        if (progressFill) {
            progressFill.style.width = `${Math.round(progress)}%`;
        }
        
        if (statusEl) {
            switch (status) {
                case 'uploading':
                    statusEl.textContent = `Uploading... ${Math.round(progress)}%`;
                    break;
                case 'complete':
                    statusEl.textContent = 'Upload complete';
                    progressEl.classList.add('complete');
                    break;
                case 'error':
                    statusEl.textContent = 'Upload failed';
                    progressEl.classList.add('error');
                    break;
            }
        }
        
        // Update pending uploads state
        const upload = this.state.pendingUploads.get(uploadId);
        if (upload) {
            upload.progress = progress;
            upload.status = status;
        }
    }
    
    removeUploadProgress(uploadId) {
        const progressEl = document.querySelector(`[data-upload-id="${uploadId}"]`);
        if (progressEl) {
            progressEl.remove();
        }
        
        // Remove container if empty
        const container = document.getElementById('uploadProgressContainer');
        if (container && container.children.length === 0) {
            container.remove();
        }
    }
    
    cancelUpload(uploadId) {
        // Cancel the upload (if still in progress)
        const upload = this.state.pendingUploads.get(uploadId);
        if (upload && upload.status === 'uploading') {
            // In a full implementation, you'd abort the XMLHttpRequest
            upload.status = 'cancelled';
        }
        
        this.removeUploadProgress(uploadId);
        this.state.pendingUploads.delete(uploadId);
        
        this.showToast('Upload cancelled', 'info');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
