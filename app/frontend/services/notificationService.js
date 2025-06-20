/**
 * Notification Service - Enhanced Notification Management
 * Handles all notification types including push notifications, in-app notifications,
 * and browser notifications with comprehensive queueing and delivery tracking
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class NotificationService {
  constructor() {
    this.eventBus = new EventBus();
    this.queue = [];
    this.activeNotifications = new Map();
    this.subscriptions = new Map();
    this.permission = 'default';
    this.settings = {
      enabled: true,
      sound: true,
      desktop: true,
      mobile: true,
      vibration: true,
      grouping: true,
      maxNotifications: 5,
      displayDuration: 5000
    };

    this.init();
  }

  /**
   * Initialize notification service
   */
  async init() {
    try {
      logger.info('Initializing Notification Service...');

      // Check for notification permission
      if ('Notification' in window) {
        this.permission = Notification.permission;
        if (this.permission === 'default') {
          await this.requestPermission();
        }
      }

      // Setup service worker for push notifications
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        await this.setupPushNotifications();
      }

      // Load user preferences
      await this.loadSettings();

      // Setup event listeners
      this.setupEventListeners();

      logger.info('Notification Service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Notification Service:', error);
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        this.permission = permission;
        
        this.eventBus.emit('notification:permission-changed', { permission });
        
        return permission === 'granted';
      }
      return false;
    } catch (error) {
      logger.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Setup push notification service worker
   */
  async setupPushNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if push subscription exists
      const subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription if none exists
        const vapidPublicKey = configManager.get('push.vapidPublicKey');
        if (vapidPublicKey) {
          await this.createPushSubscription(registration, vapidPublicKey);
        }
      }

    } catch (error) {
      logger.error('Failed to setup push notifications:', error);
    }
  }

  /**
   * Create push notification subscription
   */
  async createPushSubscription(registration, vapidPublicKey) {
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      logger.info('Push subscription created successfully');

    } catch (error) {
      logger.error('Failed to create push subscription:', error);
    }
  }

  /**
   * Send subscription details to server
   */
  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

    } catch (error) {
      logger.error('Failed to send subscription to server:', error);
    }
  }

  /**
   * Show notification
   */
  async show(options = {}) {
    try {
      const notification = {
        id: options.id || this.generateId(),
        title: options.title || 'Quick Chat',
        body: options.body || '',
        icon: options.icon || '/assets/images/icons/notification-icon.png',
        badge: options.badge || '/assets/images/icons/badge-icon.png',
        tag: options.tag || '',
        data: options.data || {},
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        timestamp: Date.now(),
        type: options.type || 'info'
      };

      // Check if notifications are enabled
      if (!this.settings.enabled) {
        return null;
      }

      // Check permission
      if (this.permission !== 'granted') {
        logger.warn('Cannot show notification: permission not granted');
        return null;
      }

      // Show desktop notification
      if (this.settings.desktop && 'Notification' in window) {
        const browserNotification = new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          badge: notification.badge,
          tag: notification.tag,
          data: notification.data,
          requireInteraction: notification.requireInteraction,
          silent: notification.silent
        });

        // Setup notification event handlers
        this.setupNotificationHandlers(browserNotification, notification);

        // Store active notification
        this.activeNotifications.set(notification.id, {
          notification,
          browserNotification
        });

        // Auto-close notification after timeout
        if (!notification.requireInteraction) {
          setTimeout(() => {
            this.close(notification.id);
          }, this.settings.displayDuration);
        }
      }

      // Emit notification event
      this.eventBus.emit('notification:shown', notification);

      // Play sound if enabled
      if (this.settings.sound && !notification.silent) {
        await this.playNotificationSound(notification.type);
      }

      // Vibrate if enabled and supported
      if (this.settings.vibration && 'vibrate' in navigator) {
        navigator.vibrate(this.getVibrationPattern(notification.type));
      }

      return notification;

    } catch (error) {
      logger.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Setup notification event handlers
   */
  setupNotificationHandlers(browserNotification, notification) {
    browserNotification.onclick = (event) => {
      event.preventDefault();
      this.eventBus.emit('notification:clicked', notification);
      browserNotification.close();
    };

    browserNotification.onclose = () => {
      this.eventBus.emit('notification:closed', notification);
      this.activeNotifications.delete(notification.id);
    };

    browserNotification.onerror = (error) => {
      logger.error('Notification error:', error);
      this.eventBus.emit('notification:error', { notification, error });
    };
  }

  /**
   * Close notification
   */
  close(id) {
    const activeNotification = this.activeNotifications.get(id);
    if (activeNotification) {
      activeNotification.browserNotification.close();
      this.activeNotifications.delete(id);
    }
  }

  /**
   * Close all notifications
   */
  closeAll() {
    for (const [id] of this.activeNotifications) {
      this.close(id);
    }
  }

  /**
   * Show message notification
   */
  async showMessage(message, sender) {
    return await this.show({
      title: `New message from ${sender.name}`,
      body: this.truncateMessage(message.content),
      icon: sender.avatar || '/assets/images/icons/user-icon.png',
      tag: `message-${message.id}`,
      data: {
        type: 'message',
        messageId: message.id,
        senderId: sender.id,
        chatId: message.chatId
      },
      type: 'message'
    });
  }

  /**
   * Show call notification
   */
  async showCall(caller, type = 'video') {
    return await this.show({
      title: `Incoming ${type} call`,
      body: `${caller.name} is calling you`,
      icon: caller.avatar || '/assets/images/icons/call-icon.png',
      tag: `call-${caller.id}`,
      data: {
        type: 'call',
        callerId: caller.id,
        callType: type
      },
      requireInteraction: true,
      type: 'call'
    });
  }

  /**
   * Show system notification
   */
  async showSystem(title, body, type = 'info') {
    return await this.show({
      title,
      body,
      icon: '/assets/images/icons/system-icon.png',
      tag: `system-${Date.now()}`,
      data: { type: 'system' },
      type
    });
  }

  /**
   * Play notification sound
   */
  async playNotificationSound(type = 'default') {
    try {
      if (!this.settings.sound) return;

      const soundMap = {
        message: '/assets/sounds/message.mp3',
        call: '/assets/sounds/call.mp3',
        system: '/assets/sounds/system.mp3',
        default: '/assets/sounds/notification.mp3'
      };

      const soundUrl = soundMap[type] || soundMap.default;
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      await audio.play();

    } catch (error) {
      // Ignore audio play errors (might be blocked by browser)
      logger.debug('Could not play notification sound:', error);
    }
  }

  /**
   * Get vibration pattern for notification type
   */
  getVibrationPattern(type) {
    const patterns = {
      message: [100, 50, 100],
      call: [200, 100, 200, 100, 200],
      system: [50],
      default: [100]
    };

    return patterns[type] || patterns.default;
  }

  /**
   * Load user notification settings
   */
  async loadSettings() {
    try {
      const savedSettings = localStorage.getItem('quick-chat-notification-settings');
      if (savedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      logger.error('Failed to load notification settings:', error);
    }
  }

  /**
   * Save notification settings
   */
  async saveSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      localStorage.setItem('quick-chat-notification-settings', JSON.stringify(this.settings));
      
      this.eventBus.emit('notification:settings-updated', this.settings);
      
    } catch (error) {
      logger.error('Failed to save notification settings:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page is hidden, enable notifications
        this.settings.enabled = true;
      } else {
        // Page is visible, optionally disable notifications
        if (configManager.get('notifications.disableWhenVisible', false)) {
          this.settings.enabled = false;
        }
      }
    });

    // Listen for focus changes
    window.addEventListener('focus', () => {
      if (configManager.get('notifications.clearOnFocus', true)) {
        this.closeAll();
      }
    });
  }

  /**
   * Utility methods
   */
  generateId() {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  truncateMessage(content, maxLength = 100) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

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

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return 'Notification' in window;
  }

  /**
   * Check if push notifications are supported
   */
  isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Get notification permission status
   */
  getPermission() {
    return this.permission;
  }

  /**
   * Get active notifications count
   */
  getActiveCount() {
    return this.activeNotifications.size;
  }
}

// Create and export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
