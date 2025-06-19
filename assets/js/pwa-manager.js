/**
 * Progressive Web App (PWA) Manager - DEPRECATED
 * Handles service worker registration, offline functionality, and app installation
 * Enhanced with improved push notification system - Updated 2025-06-19
 * 
 * This file is maintained for backward compatibility
 * Please use the new module at ./utils/pwa-manager.js
 */

import pwaManager from './utils/pwa-manager.js';

// Re-export for backward compatibility
export default pwaManager;

// Make available globally
window.PWAManager = pwaManager.constructor;
window.pwaManager = pwaManager;
        this.notificationShowCount = 0;
        this.lastNotificationTime = 0;
        this.maxNotificationsPerMinute = 10;
        this.notificationGroups = new Map();
        this.tokenRefreshTimeout = null;
        this.pushRetryQueue = [];
        this.performanceMonitor = performanceMonitor;
        
        this.init();
    }

    async init() {
        this.setupServiceWorker();
        this.setupInstallPrompt();
        this.setupOfflineHandling();
        this.setupNetworkStatusMonitoring();
        this.setupBackgroundSync();
        
        // Initialize the enhanced notification service
        this.initializeNotificationService();
    }
    
    async initializeNotificationService() {
        // Dynamically import the notification service
        try {
            const NotificationService = (await import('./core/notification-service.js')).default;
            this.notificationService = new NotificationService(this);
            console.log('Enhanced notification service initialized');
        } catch (error) {
            console.error('Failed to initialize notification service:', error);
            // Fall back to basic notification setup
            this.setupNotifications();
        }
    }

    async setupServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return;
        }

        try {
            // Use workbox-window for better service worker management
            this.workbox = new Workbox('/sw.js', { scope: '/' });
            
            // Listen for new updates
            this.workbox.addEventListener('waiting', (event) => {
                console.log('A new service worker has installed, but it cannot activate until all tabs running the current version have been closed.');
                this.showUpdateAvailable();
            });
            
            // Listen for service worker controlling the page
            this.workbox.addEventListener('controlling', (event) => {
                console.log('A new service worker has taken control of the page.');
                window.location.reload();
            });
            
            // Listen for service worker activation
            this.workbox.addEventListener('activated', (event) => {
                console.log('Service worker activated successfully');
                
                // If there were offline resources to cache, claim clients and cache them
                if (event.isUpdate) {
                    console.log('Service worker updated');
                } else {
                    this.cacheEssentialResources();
                }
            });
            
            // Listen for service worker installation errors
            this.workbox.addEventListener('redundant', (event) => {
                console.error('Service worker installation failed');
            });
            
            // Register the service worker
            const registration = await this.workbox.register();
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });

            console.log('Service Worker registered successfully');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    handleServiceWorkerMessage(message) {
        switch (message.type) {
            case 'CACHE_UPDATED':
                console.log('Cache updated:', message.payload);
                break;
            case 'BACKGROUND_SYNC':
                this.handleBackgroundSync(message.payload);
                break;
            case 'PUSH_NOTIFICATION':
                this.handlePushNotification(message.payload);
                break;
        }
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.showInstallOption();
        });

        // Listen for app installation
        window.addEventListener('appinstalled', () => {
            this.installPrompt = null;
            this.hideInstallOption();
            this.showToast('App installed successfully!', 'success');
        });
    }

    showInstallOption() {
        let installBanner = document.getElementById('installBanner');
        
        if (!installBanner) {
            installBanner = document.createElement('div');
            installBanner.id = 'installBanner';
            installBanner.className = 'install-banner';
            installBanner.innerHTML = `
                <div class="install-banner-content">
                    <div class="install-banner-text">
                        <h3>Install Quick Chat</h3>
                        <p>Get the full app experience with offline access</p>
                    </div>
                    <div class="install-banner-actions">
                        <button type="button" class="btn btn-primary install-app-btn">Install</button>
                        <button type="button" class="btn btn-secondary dismiss-install-btn">Dismiss</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(installBanner);
        }

        // Show banner
        installBanner.style.display = 'block';

        // Setup event listeners
        installBanner.querySelector('.install-app-btn').addEventListener('click', () => {
            this.installApp();
        });

        installBanner.querySelector('.dismiss-install-btn').addEventListener('click', () => {
            this.hideInstallOption();
        });
    }

    hideInstallOption() {
        const installBanner = document.getElementById('installBanner');
        if (installBanner) {
            installBanner.style.display = 'none';
        }
    }

    async installApp() {
        if (!this.installPrompt) return;

        try {
            const result = await this.installPrompt.prompt();
            console.log('Install prompt result:', result);
            
            if (result.outcome === 'accepted') {
                this.hideInstallOption();
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
        }
    }

    setupOfflineHandling() {
        // Cache critical resources
        this.cacheEssentialResources();

        // Setup offline page
        this.setupOfflinePage();
    }

    async cacheEssentialResources() {
        if (!('caches' in window)) return;

        try {
            const cache = await caches.open(this.cacheVersion);
            
            const essentialResources = [
                '/',
                '/assets/css/styles.css',
                '/assets/js/app.js',
                '/assets/js/chat.js',
                '/offline.html',
                '/manifest.json'
            ];

            await cache.addAll(essentialResources);
            console.log('Essential resources cached');
        } catch (error) {
            console.error('Failed to cache essential resources:', error);
        }
    }

    setupOfflinePage() {
        // Create offline page if it doesn't exist
        if (!document.getElementById('offlinePage')) {
            const offlinePage = document.createElement('div');
            offlinePage.id = 'offlinePage';
            offlinePage.className = 'offline-page hidden';
            offlinePage.innerHTML = `
                <div class="offline-content">
                    <div class="offline-icon">📡</div>
                    <h2>You're Offline</h2>
                    <p>Check your internet connection and try again.</p>
                    <p>Your messages will be sent when you're back online.</p>
                    <button type="button" class="btn btn-primary retry-connection-btn">Retry Connection</button>
                </div>
            `;
            
            document.body.appendChild(offlinePage);

            // Setup retry button
            offlinePage.querySelector('.retry-connection-btn').addEventListener('click', () => {
                this.checkConnection();
            });
        }
    }

    setupNetworkStatusMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // Periodic connection check
        setInterval(() => {
            this.checkConnection();
        }, 30000); // Check every 30 seconds
    }

    handleOnline() {
        console.log('Connection restored');
        this.hideOfflinePage();
        this.showToast('Connection restored', 'success');
        this.processOfflineQueue();
        this.syncOfflineData();
    }

    handleOffline() {
        console.log('Connection lost');
        this.showOfflinePage();
        this.showToast('You are now offline', 'warning');
    }

    showOfflinePage() {
        const offlinePage = document.getElementById('offlinePage');
        if (offlinePage) {
            offlinePage.classList.remove('hidden');
        }
    }

    hideOfflinePage() {
        const offlinePage = document.getElementById('offlinePage');
        if (offlinePage) {
            offlinePage.classList.add('hidden');
        }
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/ping.php', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                if (!this.isOnline) {
                    this.isOnline = true;
                    this.handleOnline();
                }
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            if (this.isOnline) {
                this.isOnline = false;
                this.handleOffline();
            }
        }
    }

    setupBackgroundSync() {
        if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
            console.warn('Background Sync not supported');
            return;
        }

        // Register background sync for message sending
        navigator.serviceWorker.ready.then((registration) => {
            return registration.sync.register('send-messages');
        }).catch((error) => {
            console.error('Background sync registration failed:', error);
        });
    }

    handleBackgroundSync(data) {
        console.log('Background sync triggered:', data);
        
        switch (data.tag) {
            case 'send-messages':
                this.processOfflineQueue();
                break;
            case 'upload-files':
                this.processOfflineUploads();
                break;
        }
    }

    // Push notification handling
    async setupNotifications() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('Notifications not supported in this browser');
            return;
        }
        
        // Get current permission state
        this.notificationPermission = Notification.permission;
        
        // Set up notification click and close event listeners
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'NOTIFICATION_CLICK') {
                    this.handleNotificationClick(event.data);
                } else if (event.data.type === 'NOTIFICATION_CLOSE') {
                    this.handleNotificationClose(event.data);
                }
            });
        }
        
        // Try to subscribe to push notifications if permission is granted
        if (this.notificationPermission === 'granted') {
            this.setupPushNotifications();
        }
    }

    async setupPushNotifications() {
        if (!('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Make sure we have permission
            if (this.notificationPermission !== 'granted') {
                const permission = await Notification.requestPermission();
                this.notificationPermission = permission;
                
                if (permission !== 'granted') {
                    console.log('Push notification permission denied');
                    return false;
                }
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Get existing subscription
            let subscription = await registration.pushManager.getSubscription();
            
            // If no subscription exists, create one
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.getVapidKey())
                });
            }
            
            // Store subscription
            this.pushSubscription = subscription;

            // Send subscription to server
            await this.sendSubscriptionToServer(subscription);
            
            // Set up token refresh (every week)
            this.setupTokenRefresh();
            
            // Process any queued notifications
            this.processNotificationQueue();
            
            console.log('Push notifications enabled');
            return true;
        } catch (error) {
            console.error('Failed to setup push notifications:', error);
            
            // Queue for retry
            this.pushRetryQueue.push({
                type: 'setup',
                timestamp: Date.now()
            });
            
            // Try again later
            setTimeout(() => {
                if (this.pushRetryQueue.length > 0) {
                    this.retryPushSetup();
                }
            }, 60000); // Try again in 1 minute
            
            return false;
        }
    }
    
    /**
     * Retry push notification setup
     */
    async retryPushSetup() {
        // Don't retry if too many attempts
        if (this.pushRetryQueue.length > 5) {
            console.warn('Too many push notification setup retries, giving up');
            this.pushRetryQueue = [];
            return;
        }
        
        console.log('Retrying push notification setup');
        
        try {
            const success = await this.setupPushNotifications();
            if (success) {
                this.pushRetryQueue = [];
            }
        } catch (error) {
            console.error('Retry push setup failed:', error);
        }
    }

    /**
     * Setup periodic token refresh
     */
    setupTokenRefresh() {
        // Clear any existing refresh timeout
        if (this.tokenRefreshTimeout) {
            clearTimeout(this.tokenRefreshTimeout);
        }
        
        // Refresh subscription token weekly to prevent expiration
        this.tokenRefreshTimeout = setTimeout(async () => {
            try {
                await this.refreshPushSubscription();
            } catch (error) {
                console.error('Failed to refresh push subscription:', error);
            } finally {
                // Set up next refresh regardless of success/failure
                this.setupTokenRefresh();
            }
        }, 7 * 24 * 60 * 60 * 1000); // 7 days
    }
    
    /**
     * Refresh push subscription
     */
    async refreshPushSubscription() {
        console.log('Refreshing push subscription');
        
        try {
            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Get existing subscription
            const oldSubscription = await registration.pushManager.getSubscription();
            
            // Unsubscribe from old subscription
            if (oldSubscription) {
                await oldSubscription.unsubscribe();
            }
            
            // Create new subscription
            const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.getVapidKey())
            });
            
            // Store new subscription
            this.pushSubscription = newSubscription;
            
            // Send new subscription to server
            await this.sendSubscriptionToServer(newSubscription);
            
            console.log('Push subscription refreshed');
            return true;
        } catch (error) {
            console.error('Failed to refresh push subscription:', error);
            
            // Queue for retry
            this.pushRetryQueue.push({
                type: 'refresh',
                timestamp: Date.now()
            });
            
            return false;
        }
    }

    getVapidKey() {
        // This should be your VAPID public key
        return 'BPJrSNmOoSRKh6NI0_YsHQMFwu9M6Iw2LF1FmcWIGXWWGcqNJEg9wqdvH5tLGNtAkuUfMfJADFJYH4xCAEQA92Y';
    }
    
    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
            
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        
        return outputArray;
    }

    async sendSubscriptionToServer(subscription) {
        try {
            // Convert subscription to JSON
            const subscriptionJson = subscription.toJSON();
            
            // Send to server
            const response = await fetch('/api/push-subscription.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    subscription: subscriptionJson,
                    user_agent: navigator.userAgent,
                    device_type: this.getDeviceType(),
                    timestamp: Date.now()
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            console.log('Push subscription sent to server');
            return true;
        } catch (error) {
            console.error('Failed to send subscription to server:', error);
            return false;
        }
    }
    
    /**
     * Get device type for analytics
     */
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/Android/i.test(ua)) return 'android';
        if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
        if (/Windows/.test(ua)) return 'windows';
        if (/Mac OS X/.test(ua)) return 'mac';
        if (/Linux/.test(ua)) return 'linux';
        return 'other';
    }

    getCSRFToken() {
        const tokenElement = document.querySelector('meta[name="csrf-token"]');
        return tokenElement ? tokenElement.getAttribute('content') : '';
    }
    
    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('Notifications not supported');
            return false;
        }
        
        // If already granted, nothing to do
        if (this.notificationPermission === 'granted') {
            return true;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;
            
            if (permission === 'granted') {
                // Setup push now that we have permission
                this.setupPushNotifications();
                return true;
            } else {
                console.log('Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    handlePushNotification(payload) {
        console.log('Push notification received:', payload);
        
        // Don't show notification if we're already in the app and it's in focus
        if (!document.hidden && payload.suppressIfVisible) {
            console.log('Suppressing notification because app is visible');
            return;
        }
        
        // Check rate limiting
        if (!this.checkNotificationRateLimit()) {
            console.log('Notification rate limited');
            this.queueNotification(payload);
            return;
        }
        
        // Group notifications if needed
        if (payload.groupKey && this.shouldGroupNotification(payload)) {
            this.addToNotificationGroup(payload);
            return;
        }
        
        // Show notification
        this.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || '/assets/images/icon-192.png',
            badge: payload.badge || '/assets/images/notification-badge.png',
            tag: payload.tag || 'default',
            data: payload.data || {},
            actions: payload.actions || [],
            image: payload.image || null,
            vibrate: payload.vibrate || [100, 50, 100],
            renotify: payload.renotify || false,
            requireInteraction: payload.requireInteraction || false,
            silent: payload.silent || false
        });
    }
    
    /**
     * Check if we should rate limit notifications
     */
    checkNotificationRateLimit() {
        const now = Date.now();
        
        // If we've shown too many notifications in the last minute, rate limit
        if ((now - this.lastNotificationTime) < 60000) {
            if (this.notificationShowCount >= this.maxNotificationsPerMinute) {
                return false;
            }
        } else {
            // Reset counter if it's been more than a minute
            this.notificationShowCount = 0;
        }
        
        this.notificationShowCount++;
        this.lastNotificationTime = now;
        
        return true;
    }
    
    /**
     * Queue a notification for later display
     */
    queueNotification(payload) {
        this.notificationQueue.push({
            payload,
            timestamp: Date.now()
        });
        
        // Process queue later
        setTimeout(() => {
            this.processNotificationQueue();
        }, 60000); // Try again in 1 minute
    }
    
    /**
     * Process queued notifications
     */
    processNotificationQueue() {
        if (this.notificationQueue.length === 0) return;
        
        // Get oldest notifications first, up to our rate limit
        const now = Date.now();
        const availableSlots = this.maxNotificationsPerMinute - this.notificationShowCount;
        
        if (availableSlots <= 0) {
            // Try again later
            setTimeout(() => {
                this.processNotificationQueue();
            }, 30000); // Try again in 30 seconds
            return;
        }
        
        // Sort by timestamp (oldest first)
        this.notificationQueue.sort((a, b) => a.timestamp - b.timestamp);
        
        // Process up to available slots
        const toProcess = this.notificationQueue.slice(0, availableSlots);
        this.notificationQueue = this.notificationQueue.slice(availableSlots);
        
        // Show notifications
        toProcess.forEach(item => {
            if (now - item.timestamp > 3600000) {
                // Skip notifications older than 1 hour
                return;
            }
            
            this.handlePushNotification(item.payload);
        });
    }
    
    /**
     * Check if notification should be grouped
     */
    shouldGroupNotification(payload) {
        if (!payload.groupKey) return false;
        
        const group = this.notificationGroups.get(payload.groupKey);
        return group && group.count > 0;
    }
    
    /**
     * Add notification to a group
     */
    addToNotificationGroup(payload) {
        const groupKey = payload.groupKey;
        
        // Get or create group
        let group = this.notificationGroups.get(groupKey);
        if (!group) {
            group = {
                count: 0,
                title: payload.groupTitle || 'New Notifications',
                messages: [],
                lastUpdate: Date.now()
            };
            this.notificationGroups.set(groupKey, group);
        }
        
        // Add to group
        group.count++;
        group.messages.push(payload.body);
        group.lastUpdate = Date.now();
        
        // Keep only the last 5 messages
        if (group.messages.length > 5) {
            group.messages = group.messages.slice(-5);
        }
        
        // Show group notification
        let body;
        if (group.count <= 3) {
            body = group.messages.join('\n');
        } else {
            body = `${group.messages.slice(-3).join('\n')}\n\n+${group.count - 3} more...`;
        }
        
        this.showNotification(group.title, {
            body: body,
            icon: payload.icon || '/assets/images/icon-192.png',
            tag: `group-${groupKey}`,
            renotify: true,
            data: {
                type: 'group',
                groupKey: groupKey,
                count: group.count,
                ...payload.data
            }
        });
    }

    showNotification(title, options = {}) {
        // Use enhanced notification service if available
        if (this.notificationService) {
            // Adapt parameters to the format expected by the notification service
            return this.notificationService.showNotification({
                title: title,
                ...options,
                type: options.data?.type || 'message'
            });
        }

        // Performance tracking
        const endTracking = this.performanceMonitor.trackInteraction('notification', 'show', 
            options.data?.type || 'basic');
        
        if ('Notification' in window && this.notificationPermission === 'granted') {
            // Get service worker registration
            navigator.serviceWorker.ready.then(registration => {
                // Register click handler if data contains clickAction
                if (options.data && options.data.clickAction) {
                    this.registerNotificationClickHandler(options.tag, options.data.clickAction);
                }
                
                // Show notification
                registration.showNotification(title, options)
                    .then(() => {
                        endTracking(true, { type: options.data?.type || 'basic' });
                    })
                    .catch(error => {
                        console.error('Error showing notification:', error);
                        endTracking(false, { error: error.message });
                    });
            });
        } else if (this.notificationPermission === 'default') {
            // Ask for permission
            this.requestNotificationPermission().then(granted => {
                if (granted) {
                    this.showNotification(title, options);
                } else {
                    endTracking(false, { error: 'permission_denied' });
                }
            });
        } else {
            endTracking(false, { error: 'not_supported_or_denied' });
        }
    }
    
    /**
     * Register a handler for notification clicks
     */
    registerNotificationClickHandler(tag, action) {
        this.notificationClickHandlers.set(tag, action);
    }
    
    /**
     * Register a handler for notification close events
     */
    registerNotificationCloseHandler(tag, handler) {
        this.notificationCloseHandlers.set(tag, handler);
    }
    
    /**
     * Handle notification click event
     */
    handleNotificationClick(data) {
        const { tag, url, actionId } = data;
        
        // Focus window
        if (window.focus) {
            window.focus();
        }
        
        // Handle group notifications
        if (data.type === 'group') {
            this.handleGroupNotificationClick(data);
            return;
        }
        
        // Check for specific click handler
        const handler = this.notificationClickHandlers.get(tag);
        if (handler) {
            try {
                if (typeof handler === 'function') {
                    handler(data);
                } else if (typeof handler === 'string') {
                    window.location.href = handler;
                }
            } catch (error) {
                console.error('Error in notification click handler:', error);
            }
            
            // Remove one-time handlers
            if (data.oneTimeHandler) {
                this.notificationClickHandlers.delete(tag);
            }
            
            return;
        }
        
        // Default behavior - navigate to URL if provided
        if (url) {
            window.location.href = url;
        }
    }
    
    /**
     * Handle group notification click
     */
    handleGroupNotificationClick(data) {
        const { groupKey } = data;
        
        // Navigate to group view
        if (data.url) {
            window.location.href = data.url;
        } else {
            // Default behavior - open appropriate view based on group key
            switch (groupKey) {
                case 'messages':
                    window.location.href = '/dashboard.php?view=messages';
                    break;
                case 'notifications':
                    window.location.href = '/dashboard.php?view=notifications';
                    break;
                default:
                    window.location.href = '/dashboard.php';
            }
        }
        
        // Clear group
        if (this.notificationGroups.has(groupKey)) {
            this.notificationGroups.delete(groupKey);
        }
    }
    
    /**
     * Handle notification close event
     */
    handleNotificationClose(data) {
        const { tag } = data;
        
        // Check for specific close handler
        const handler = this.notificationCloseHandlers.get(tag);
        if (handler && typeof handler === 'function') {
            try {
                handler(data);
            } catch (error) {
                console.error('Error in notification close handler:', error);
            }
            
            // Remove one-time handlers
            if (data.oneTimeHandler) {
                this.notificationCloseHandlers.delete(tag);
            }
        }
    }

    showUpdateAvailable() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-banner-content">
                <span>A new version is available!</span>
                <button type="button" class="btn btn-primary update-app-btn">Update Now</button>
                <button type="button" class="btn btn-secondary dismiss-update-btn">Later</button>
            </div>
        `;
        
        document.body.appendChild(updateBanner);

        updateBanner.querySelector('.update-app-btn').addEventListener('click', () => {
            this.updateApp();
        });

        updateBanner.querySelector('.dismiss-update-btn').addEventListener('click', () => {
            updateBanner.remove();
        });
    }

    async updateApp() {
        try {
            if (this.workbox) {
                // Send message to service worker to skip waiting
                this.workbox.messageSkipWaiting();
            } else {
                const registration = await navigator.serviceWorker.ready;
                await registration.update();
                
                // Force reload to use new version
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to update app:', error);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Public API
    isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    getAppInfo() {
        return {
            isInstalled: this.isAppInstalled(),
            isOnline: this.isOnline,
            serviceWorkerSupported: 'serviceWorker' in navigator,
            pushNotificationsSupported: 'PushManager' in window,
            offlineQueueLength: this.offlineQueue.length
        };
    }
}

// Initialize PWA manager
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Export for external use
window.PWAManager = PWAManager;
