/**
 * Enhanced notification service for QuickChat
 * Provides intelligent notification grouping, priority handling, and user preference support
 */
class NotificationService {
    constructor(pwaManager) {
        this.pwaManager = pwaManager;
        this.notificationPermission = null;
        this.config = {
            maxNotificationsPerMinute: 10,
            defaultIcon: '/assets/images/icon-192.png',
            defaultBadge: '/assets/images/default-avatar.svg',
            notificationTTL: 86400, // 24 hours in seconds
            groupingEnabled: true,
            groupingThreshold: 3, // Number of notifications before grouping
            priorityLevels: {
                'message': 1,
                'mention': 2,
                'call': 3,
                'system': 0
            },
            vibrationPatterns: {
                'message': [200, 100, 200],
                'mention': [300, 100, 300, 100, 300],
                'call': [500, 100, 500, 100, 500, 100, 500],
                'system': [200]
            },
            actionButtons: {
                'message': [
                    { action: 'reply', title: 'Reply', icon: '/assets/images/reply-icon.png' },
                    { action: 'mark-read', title: 'Mark Read', icon: '/assets/images/read-icon.png' }
                ],
                'mention': [
                    { action: 'view', title: 'View', icon: '/assets/images/view-icon.png' },
                    { action: 'reply', title: 'Reply', icon: '/assets/images/reply-icon.png' }
                ],
                'call': [
                    { action: 'answer', title: 'Answer', icon: '/assets/images/answer-icon.png' },
                    { action: 'decline', title: 'Decline', icon: '/assets/images/decline-icon.png' }
                ],
                'system': [
                    { action: 'view', title: 'View', icon: '/assets/images/view-icon.png' }
                ]
            }
        };
        
        // Store active notifications for grouping
        this.activeNotifications = {
            message: new Map(),
            mention: new Map(),
            call: new Map(),
            system: new Map()
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('Notifications not supported in this browser');
            return;
        }
        
        // Get current permission state
        this.notificationPermission = Notification.permission;
        
        // Load user preferences
        this.loadUserPreferences();
        
        // Set up notification handlers
        this.setupNotificationHandlers();
    }
    
    /**
     * Load user notification preferences from storage
     */
    loadUserPreferences() {
        try {
            const preferences = JSON.parse(localStorage.getItem('notification_preferences') || '{}');
            
            // Apply user preferences with defaults
            this.userPreferences = {
                enabled: true,
                sound: true,
                vibration: true,
                grouping: true,
                messageNotifications: true,
                mentionNotifications: true,
                callNotifications: true,
                systemNotifications: true,
                quietHoursEnabled: false,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00',
                ...preferences
            };
        } catch (error) {
            console.error('Error loading notification preferences:', error);
            // Set defaults
            this.userPreferences = {
                enabled: true,
                sound: true,
                vibration: true,
                grouping: true,
                messageNotifications: true,
                mentionNotifications: true,
                callNotifications: true,
                systemNotifications: true,
                quietHoursEnabled: false,
                quietHoursStart: '22:00',
                quietHoursEnd: '08:00'
            };
        }
    }
    
    /**
     * Save user notification preferences to storage
     */
    saveUserPreferences() {
        try {
            localStorage.setItem('notification_preferences', JSON.stringify(this.userPreferences));
        } catch (error) {
            console.error('Error saving notification preferences:', error);
        }
    }
    
    /**
     * Set up notification handlers
     */
    setupNotificationHandlers() {
        // Set up service worker message handler
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'NOTIFICATION_CLICK') {
                    this.handleNotificationClick(event.data);
                } else if (event.data.type === 'NOTIFICATION_CLOSE') {
                    this.handleNotificationClose(event.data);
                } else if (event.data.type === 'NOTIFICATION_ACTION') {
                    this.handleNotificationAction(event.data);
                }
            });
        }
    }
    
    /**
     * Show a notification
     * @param {Object} options - Notification options
     * @param {string} options.title - Notification title
     * @param {string} options.body - Notification body
     * @param {string} options.icon - Notification icon URL
     * @param {string} options.badge - Notification badge URL
     * @param {string} options.tag - Notification tag for grouping/replacing
     * @param {string} options.type - Notification type (message, mention, call, system)
     * @param {Object} options.data - Additional data to include
     * @returns {Promise<boolean>} - Whether notification was shown
     */
    async showNotification(options) {
        // Start tracking the notification performance
        const endTracking = this.pwaManager.performanceMonitor.trackInteraction('notification', 'show', options.type);
        
        try {
            // Check permission
            if (this.notificationPermission !== 'granted') {
                endTracking(false, { error: 'permission_denied' });
                return false;
            }
            
            // Check if notifications are enabled in user preferences
            if (!this.userPreferences.enabled) {
                endTracking(false, { error: 'disabled_by_user' });
                return false;
            }
            
            // Check notification type preference
            const typePreference = `${options.type}Notifications`;
            if (this.userPreferences[typePreference] === false) {
                endTracking(false, { error: `${options.type}_notifications_disabled` });
                return false;
            }
            
            // Check quiet hours
            if (this.userPreferences.quietHoursEnabled && this.isInQuietHours()) {
                // Only show high priority notifications during quiet hours
                if (this.config.priorityLevels[options.type] < 2) {
                    endTracking(false, { error: 'quiet_hours', type: options.type });
                    return false;
                }
            }
            
            // Check rate limiting
            if (!this.checkRateLimit()) {
                // Queue notification for later
                this.pwaManager.notificationQueue.push(options);
                endTracking(false, { error: 'rate_limited', queued: true });
                return false;
            }
            
            // Prepare notification options
            const notificationOptions = this.prepareNotificationOptions(options);
            
            // Check if we should group this notification
            if (this.shouldGroupNotification(options)) {
                const grouped = await this.handleGroupedNotification(options);
                endTracking(true, { grouped: true, type: options.type });
                return grouped;
            }
            
            // Show notification
            if (navigator.serviceWorker.controller) {
                // Prefer showing via service worker
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(options.title, notificationOptions);
            } else {
                // Fall back to regular notification
                new Notification(options.title, notificationOptions);
            }
            
            // Track the notification
            this.trackNotification(options);
            
            // Increment show count for rate limiting
            this.pwaManager.notificationShowCount++;
            this.pwaManager.lastNotificationTime = Date.now();
            
            endTracking(true, { type: options.type });
            return true;
        } catch (error) {
            console.error('Error showing notification:', error);
            endTracking(false, { error: error.message });
            return false;
        }
    }
    
    /**
     * Prepare notification options
     * @param {Object} options - Base notification options
     * @returns {Object} - Prepared notification options
     */
    prepareNotificationOptions(options) {
        const type = options.type || 'message';
        
        // Prepare actions if supported
        const actions = this.config.actionButtons[type] || [];
        
        return {
            body: options.body || '',
            icon: options.icon || this.config.defaultIcon,
            badge: options.badge || this.config.defaultBadge,
            tag: options.tag || `${type}_${Date.now()}`,
            data: {
                ...options.data,
                timestamp: Date.now(),
                type: type,
                url: options.url || window.location.href
            },
            requireInteraction: this.config.priorityLevels[type] > 1,
            silent: !this.userPreferences.sound,
            vibrate: this.userPreferences.vibration ? this.config.vibrationPatterns[type] : undefined,
            actions: actions,
            timestamp: Date.now(),
            renotify: true
        };
    }
    
    /**
     * Track a notification for grouping
     * @param {Object} options - Notification options
     */
    trackNotification(options) {
        const type = options.type || 'message';
        const tag = options.tag || `${type}_${Date.now()}`;
        
        // Add to active notifications
        if (!this.activeNotifications[type]) {
            this.activeNotifications[type] = new Map();
        }
        
        this.activeNotifications[type].set(tag, {
            title: options.title,
            body: options.body,
            timestamp: Date.now(),
            data: options.data
        });
    }
    
    /**
     * Check if we should group a notification
     * @param {Object} options - Notification options
     * @returns {boolean} - Whether to group the notification
     */
    shouldGroupNotification(options) {
        // Don't group if grouping is disabled
        if (!this.config.groupingEnabled || !this.userPreferences.grouping) {
            return false;
        }
        
        const type = options.type || 'message';
        
        // Don't group high priority notifications
        if (this.config.priorityLevels[type] > 1) {
            return false;
        }
        
        // Group if we have many notifications of this type
        if (this.activeNotifications[type] && 
            this.activeNotifications[type].size >= this.config.groupingThreshold) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Handle grouped notifications
     * @param {Object} options - Notification options
     * @returns {Promise<boolean>} - Whether notification was shown
     */
    async handleGroupedNotification(options) {
        try {
            const type = options.type || 'message';
            const groupTag = `${type}_group`;
            
            // Track this notification
            this.trackNotification(options);
            
            // Get count of notifications in this group
            const count = this.activeNotifications[type].size;
            
            // Create group notification
            let groupTitle;
            let groupBody;
            
            switch (type) {
                case 'message':
                    groupTitle = `${count} New Messages`;
                    groupBody = 'You have multiple new messages';
                    break;
                case 'mention':
                    groupTitle = `${count} New Mentions`;
                    groupBody = 'You were mentioned multiple times';
                    break;
                default:
                    groupTitle = `${count} New Notifications`;
                    groupBody = 'You have multiple new notifications';
            }
            
            // Show group notification
            const groupOptions = {
                body: groupBody,
                icon: this.config.defaultIcon,
                badge: this.config.defaultBadge,
                tag: groupTag,
                data: {
                    type: `${type}_group`,
                    count: count,
                    timestamp: Date.now(),
                    groupedNotifications: Array.from(this.activeNotifications[type].values()),
                    url: window.location.href
                },
                requireInteraction: true,
                renotify: true
            };
            
            if (navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(groupTitle, groupOptions);
            } else {
                new Notification(groupTitle, groupOptions);
            }
            
            // Update grouping info
            this.pwaManager.notificationGroups.set(type, {
                tag: groupTag,
                count: count,
                lastUpdated: Date.now()
            });
            
            // Increment show count for rate limiting
            this.pwaManager.notificationShowCount++;
            this.pwaManager.lastNotificationTime = Date.now();
            
            return true;
        } catch (error) {
            console.error('Error handling grouped notification:', error);
            return false;
        }
    }
    
    /**
     * Check if we're within notification rate limits
     * @returns {boolean} - Whether we can show another notification
     */
    checkRateLimit() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Reset count if last notification was more than a minute ago
        if (this.pwaManager.lastNotificationTime < oneMinuteAgo) {
            this.pwaManager.notificationShowCount = 0;
        }
        
        return this.pwaManager.notificationShowCount < this.pwaManager.maxNotificationsPerMinute;
    }
    
    /**
     * Check if current time is within quiet hours
     * @returns {boolean} - Whether current time is within quiet hours
     */
    isInQuietHours() {
        if (!this.userPreferences.quietHoursEnabled) {
            return false;
        }
        
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const start = this.userPreferences.quietHoursStart;
        const end = this.userPreferences.quietHoursEnd;
        
        // Handle cases where quiet hours span midnight
        if (start > end) {
            return currentTime >= start || currentTime < end;
        } else {
            return currentTime >= start && currentTime < end;
        }
    }
    
    /**
     * Handle notification click
     * @param {Object} data - Notification data
     */
    handleNotificationClick(data) {
        try {
            const endTracking = this.pwaManager.performanceMonitor.trackInteraction('notification', 'click', data.type);
            
            // Handle clicks based on notification type
            const notificationType = data.type || 'unknown';
            
            // Get notification handler for this type
            const handler = this.pwaManager.notificationClickHandlers.get(notificationType);
            
            if (handler) {
                handler(data);
                endTracking(true, { type: notificationType });
            } else {
                // Default handling: Focus window and navigate to URL if provided
                if (data.url) {
                    window.focus();
                    window.location.href = data.url;
                    endTracking(true, { type: notificationType, defaultAction: true });
                } else {
                    endTracking(false, { type: notificationType, error: 'no_handler_or_url' });
                }
            }
            
            // Clear notification from active list
            if (data.tag && notificationType) {
                this.removeActiveNotification(notificationType, data.tag);
            }
        } catch (error) {
            console.error('Error handling notification click:', error);
        }
    }
    
    /**
     * Handle notification close
     * @param {Object} data - Notification data
     */
    handleNotificationClose(data) {
        try {
            const endTracking = this.pwaManager.performanceMonitor.trackInteraction('notification', 'close', data.type);
            
            // Get notification type
            const notificationType = data.type || 'unknown';
            
            // Get notification handler for this type
            const handler = this.pwaManager.notificationCloseHandlers.get(notificationType);
            
            if (handler) {
                handler(data);
                endTracking(true, { type: notificationType });
            } else {
                endTracking(true, { type: notificationType, defaultAction: true });
            }
            
            // Clear notification from active list
            if (data.tag && notificationType) {
                this.removeActiveNotification(notificationType, data.tag);
            }
        } catch (error) {
            console.error('Error handling notification close:', error);
        }
    }
    
    /**
     * Handle notification action
     * @param {Object} data - Notification data
     */
    handleNotificationAction(data) {
        try {
            const endTracking = this.pwaManager.performanceMonitor.trackInteraction('notification', 'action', data.action);
            
            // Handle notification actions
            switch (data.action) {
                case 'reply':
                    this.handleReplyAction(data);
                    break;
                case 'mark-read':
                    this.handleMarkReadAction(data);
                    break;
                case 'view':
                    this.handleViewAction(data);
                    break;
                case 'answer':
                    this.handleAnswerAction(data);
                    break;
                case 'decline':
                    this.handleDeclineAction(data);
                    break;
                default:
                    console.warn('Unknown notification action:', data.action);
                    endTracking(false, { error: 'unknown_action' });
                    return;
            }
            
            // Clear notification from active list
            if (data.tag && data.type) {
                this.removeActiveNotification(data.type, data.tag);
            }
            
            endTracking(true, { action: data.action, type: data.type });
        } catch (error) {
            console.error('Error handling notification action:', error);
        }
    }
    
    /**
     * Handle reply action
     * @param {Object} data - Notification data
     */
    handleReplyAction(data) {
        // This would be implemented based on app needs
        console.log('Reply action:', data);
        
        // Example: Open chat with reply context
        if (data.url) {
            window.focus();
            window.location.href = data.url;
            
            // Set reply context in app state
            if (window.app && data.messageId) {
                window.app.setReplyContext(data.messageId);
            }
        }
    }
    
    /**
     * Handle mark read action
     * @param {Object} data - Notification data
     */
    handleMarkReadAction(data) {
        // This would be implemented based on app needs
        console.log('Mark read action:', data);
        
        // Example: Mark message as read via API
        if (data.messageId) {
            fetch('/api/messages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    action: 'mark_read',
                    message_id: data.messageId
                })
            }).catch(error => {
                console.error('Error marking message as read:', error);
            });
        }
    }
    
    /**
     * Handle view action
     * @param {Object} data - Notification data
     */
    handleViewAction(data) {
        // This would be implemented based on app needs
        console.log('View action:', data);
        
        // Example: Navigate to notification URL
        if (data.url) {
            window.focus();
            window.location.href = data.url;
        }
    }
    
    /**
     * Handle answer action for call notifications
     * @param {Object} data - Notification data
     */
    handleAnswerAction(data) {
        // This would be implemented based on app needs
        console.log('Answer call action:', data);
        
        // Example: Navigate to call URL and auto-answer
        if (data.url) {
            window.focus();
            window.location.href = data.url;
            
            // Auto-answer call in app if it exists
            if (window.app && data.callId) {
                setTimeout(() => {
                    if (window.app.answerCall) {
                        window.app.answerCall(data.callId);
                    }
                }, 1000);
            }
        }
    }
    
    /**
     * Handle decline action for call notifications
     * @param {Object} data - Notification data
     */
    handleDeclineAction(data) {
        // This would be implemented based on app needs
        console.log('Decline call action:', data);
        
        // Example: Decline call via API
        if (data.callId) {
            fetch('/api/webrtc/call.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    action: 'decline',
                    call_id: data.callId
                })
            }).catch(error => {
                console.error('Error declining call:', error);
            });
        }
    }
    
    /**
     * Remove a notification from the active list
     * @param {string} type - Notification type
     * @param {string} tag - Notification tag
     */
    removeActiveNotification(type, tag) {
        if (this.activeNotifications[type]) {
            this.activeNotifications[type].delete(tag);
        }
    }
    
    /**
     * Register notification click handler
     * @param {string} type - Notification type to handle
     * @param {Function} handler - Handler function
     */
    registerClickHandler(type, handler) {
        this.pwaManager.notificationClickHandlers.set(type, handler);
    }
    
    /**
     * Register notification close handler
     * @param {string} type - Notification type to handle
     * @param {Function} handler - Handler function
     */
    registerCloseHandler(type, handler) {
        this.pwaManager.notificationCloseHandlers.set(type, handler);
    }
    
    /**
     * Update user notification preferences
     * @param {Object} preferences - New preferences
     */
    updatePreferences(preferences) {
        this.userPreferences = {
            ...this.userPreferences,
            ...preferences
        };
        this.saveUserPreferences();
    }
    
    /**
     * Process notification queue
     */
    processNotificationQueue() {
        // Check if we have notifications to process
        if (this.pwaManager.notificationQueue.length === 0) {
            return;
        }
        
        // Check if we can show notifications now
        if (!this.checkRateLimit()) {
            // Try again later
            setTimeout(() => this.processNotificationQueue(), 5000);
            return;
        }
        
        // Get next notification and show it
        const notification = this.pwaManager.notificationQueue.shift();
        this.showNotification(notification);
        
        // If more in queue, process next
        if (this.pwaManager.notificationQueue.length > 0) {
            setTimeout(() => this.processNotificationQueue(), 1000);
        }
    }
}

export default NotificationService;
