/**
 * Notification Store - Organized Architecture
 * 
 * Manages application notifications including:
 * - In-app notifications
 * - Browser notifications
 * - Push notifications
 * - Notification preferences
 */

import { EventBus } from '../services/EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class NotificationStore {
  constructor() {
    this.eventBus = new EventBus();
    this.notifications = new Map();
    this.preferences = {
      enabled: true,
      sound: true,
      desktop: true,
      push: true,
      messageNotifications: true,
      callNotifications: true,
      groupNotifications: true,
      systemNotifications: true
    };
    this.permission = 'default';
    this.nextId = 1;
  }

  /**
   * Initialize notification store
   */
  async init() {
    try {
      // Load user preferences
      await this.loadPreferences();
      
      // Request notification permission
      await this.requestPermission();
      
      // Setup service worker for push notifications
      await this.setupServiceWorker();
      
      logger.info('Notification Store initialized');
      
    } catch (error) {
      logger.error('Failed to initialize Notification Store:', error);
    }
  }

  /**
   * Load notification preferences
   */
  async loadPreferences() {
    try {
      const saved = localStorage.getItem('quickchat_notification_preferences');
      if (saved) {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      }
    } catch (error) {
      logger.error('Failed to load notification preferences:', error);
    }
  }

  /**
   * Save notification preferences
   */
  savePreferences() {
    try {
      localStorage.setItem('quickchat_notification_preferences', JSON.stringify(this.preferences));
      this.eventBus.emit('notification:preferences:updated', this.preferences);
    } catch (error) {
      logger.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
      logger.info('Notification permission:', this.permission);
    }
  }

  /**
   * Setup service worker for push notifications
   */
  async setupServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        logger.info('Service Worker registered for notifications');
        
        // Setup push subscription if enabled
        if (this.preferences.push && this.permission === 'granted') {
          await this.setupPushSubscription(registration);
        }
      } catch (error) {
        logger.error('Failed to register Service Worker:', error);
      }
    }
  }

  /**
   * Setup push subscription
   */
  async setupPushSubscription(registration) {
    try {
      const vapidPublicKey = configManager.get('push.vapidPublicKey');
      if (!vapidPublicKey) {
        logger.warn('VAPID public key not configured');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      logger.info('Push subscription created');
      
    } catch (error) {
      logger.error('Failed to setup push subscription:', error);
    }
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Send subscription to server
   */
  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch('/api/v1/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      logger.error('Failed to send subscription to server:', error);
    }
  }

  /**
   * Add a notification
   */
  addNotification(notification) {
    const id = this.nextId++;
    const fullNotification = {
      id,
      timestamp: Date.now(),
      read: false,
      persistent: false,
      timeout: 5000,
      actions: [],
      ...notification
    };

    // Store notification
    this.notifications.set(id, fullNotification);

    // Show notification based on preferences
    this.showNotification(fullNotification);

    // Auto-remove if not persistent
    if (!fullNotification.persistent && fullNotification.timeout > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, fullNotification.timeout);
    }

    // Emit event
    this.eventBus.emit('notification:added', fullNotification);

    return id;
  }

  /**
   * Show notification to user
   */
  showNotification(notification) {
    // Check if notifications are enabled
    if (!this.preferences.enabled) {
      return;
    }

    // Check type-specific preferences
    if (!this.isNotificationTypeEnabled(notification.type)) {
      return;
    }

    // Show desktop notification
    if (this.preferences.desktop && this.permission === 'granted') {
      this.showDesktopNotification(notification);
    }

    // Play sound
    if (this.preferences.sound) {
      this.playNotificationSound(notification.type);
    }

    // Emit UI event for in-app notification
    this.eventBus.emit('notification:show', notification);
  }

  /**
   * Check if notification type is enabled
   */
  isNotificationTypeEnabled(type) {
    switch (type) {
      case 'message':
        return this.preferences.messageNotifications;
      case 'call':
        return this.preferences.callNotifications;
      case 'group':
        return this.preferences.groupNotifications;
      case 'system':
        return this.preferences.systemNotifications;
      default:
        return true;
    }
  }

  /**
   * Show desktop notification
   */
  showDesktopNotification(notification) {
    try {
      const options = {
        body: notification.body,
        icon: '/assets/images/icon-192x192.png',
        badge: '/assets/images/badge-72x72.png',
        tag: notification.type,
        data: notification.data,
        requireInteraction: notification.persistent,
        actions: notification.actions.map(action => ({
          action,
          title: this.getActionTitle(action),
          icon: this.getActionIcon(action)
        }))
      };

      const desktopNotification = new Notification(notification.title, options);

      // Handle notification click
      desktopNotification.onclick = () => {
        this.handleNotificationClick(notification);
        desktopNotification.close();
      };

      // Handle notification close
      desktopNotification.onclose = () => {
        this.markAsRead(notification.id);
      };

    } catch (error) {
      logger.error('Failed to show desktop notification:', error);
    }
  }

  /**
   * Play notification sound
   */
  playNotificationSound(type) {
    try {
      const audio = new Audio();
      
      switch (type) {
        case 'message':
          audio.src = '/assets/sounds/message.mp3';
          break;
        case 'call':
          audio.src = '/assets/sounds/call.mp3';
          break;
        default:
          audio.src = '/assets/sounds/notification.mp3';
      }

      audio.volume = 0.5;
      audio.play().catch(error => {
        logger.warn('Failed to play notification sound:', error);
      });
    } catch (error) {
      logger.error('Error playing notification sound:', error);
    }
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(notification) {
    // Mark as read
    this.markAsRead(notification.id);

    // Handle based on type
    switch (notification.type) {
      case 'message':
        if (notification.data?.chatId) {
          this.eventBus.emit('navigation:navigate', {
            route: '/chat',
            params: { chatId: notification.data.chatId }
          });
        }
        break;
      case 'call':
        if (notification.data?.callId) {
          this.eventBus.emit('call:show', { callId: notification.data.callId });
        }
        break;
      default:
        // Custom handler
        if (notification.onClick) {
          notification.onClick(notification);
        }
    }

    // Emit click event
    this.eventBus.emit('notification:clicked', notification);
  }

  /**
   * Get action title
   */
  getActionTitle(action) {
    const titles = {
      accept: 'Accept',
      reject: 'Reject',
      reply: 'Reply',
      view: 'View',
      dismiss: 'Dismiss'
    };
    return titles[action] || action;
  }

  /**
   * Get action icon
   */
  getActionIcon(action) {
    const icons = {
      accept: '/assets/images/icons/accept.png',
      reject: '/assets/images/icons/reject.png',
      reply: '/assets/images/icons/reply.png',
      view: '/assets/images/icons/view.png',
      dismiss: '/assets/images/icons/dismiss.png'
    };
    return icons[action];
  }

  /**
   * Remove notification
   */
  removeNotification(id) {
    if (this.notifications.has(id)) {
      const notification = this.notifications.get(id);
      this.notifications.delete(id);
      this.eventBus.emit('notification:removed', notification);
    }
  }

  /**
   * Mark notification as read
   */
  markAsRead(id) {
    const notification = this.notifications.get(id);
    if (notification && !notification.read) {
      notification.read = true;
      this.eventBus.emit('notification:read', notification);
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (!notification.read) {
        notification.read = true;
        count++;
      }
    }
    
    if (count > 0) {
      this.eventBus.emit('notification:all_read', { count });
    }
  }

  /**
   * Remove notifications by type
   */
  removeNotificationsByType(type) {
    const toRemove = [];
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.type === type) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => this.removeNotification(id));
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications.clear();
    this.eventBus.emit('notification:cleared');
  }

  /**
   * Get all notifications
   */
  getNotifications() {
    return Array.from(this.notifications.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get unread notifications
   */
  getUnreadNotifications() {
    return this.getNotifications().filter(n => !n.read);
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.getUnreadNotifications().length;
  }

  /**
   * Update preferences
   */
  updatePreferences(updates) {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Get preferences
   */
  getPreferences() {
    return { ...this.preferences };
  }

  /**
   * Load user notifications from server
   */
  async loadUserNotifications(userId) {
    try {
      const response = await fetch(`/api/v1/notifications/user/${userId}`);
      if (response.ok) {
        const notifications = await response.json();
        
        // Add server notifications
        notifications.forEach(notification => {
          this.notifications.set(notification.id, {
            ...notification,
            fromServer: true
          });
        });
        
        this.eventBus.emit('notification:loaded', notifications);
      }
    } catch (error) {
      logger.error('Failed to load user notifications:', error);
    }
  }

  /**
   * Get store state
   */
  getState() {
    return {
      notifications: this.getNotifications(),
      unreadCount: this.getUnreadCount(),
      preferences: this.getPreferences(),
      permission: this.permission
    };
  }

  /**
   * Clear store
   */
  async clear() {
    this.clearAll();
  }

  /**
   * Destroy store
   */
  async destroy() {
    this.clearAll();
    this.eventBus.removeAllListeners();
  }
}

// Create and export singleton instance
export const notificationStore = new NotificationStore();

// Export class for testing
export { NotificationStore };
