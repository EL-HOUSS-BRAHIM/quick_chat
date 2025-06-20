/**
 * Notification Manager Component
 * 
 * Handles displaying notifications and alerts to users
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class NotificationManager {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      position: config.position || 'top-right',
      autoHide: config.autoHide !== false,
      autoHideDelay: config.autoHideDelay || 5000,
      maxNotifications: config.maxNotifications || 5,
      ...config
    };

    this.eventBus = new EventBus();
    this.container = null;
    this.notifications = [];
    this.nextId = 1;
  }

  /**
   * Initialize the notification manager
   */
  async init() {
    try {
      this.createContainer();
      this.setupEventListeners();
      logger.debug('Notification manager initialized');
    } catch (error) {
      logger.error('Failed to initialize notification manager:', error);
    }
  }

  /**
   * Create the notifications container
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.className = `notifications-container position-${this.config.position}`;
    this.config.container.appendChild(this.container);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for global notification events
    this.eventBus.on('notification:show', (data) => {
      this.show(data.message, data.type, data.options);
    });

    this.eventBus.on('notification:clear', () => {
      this.clearAll();
    });
  }

  /**
   * Show a notification
   */
  show(message, type = 'info', options = {}) {
    const notification = {
      id: this.nextId++,
      message,
      type,
      timestamp: Date.now(),
      ...options
    };

    // Remove oldest if at max limit
    if (this.notifications.length >= this.config.maxNotifications) {
      this.remove(this.notifications[0].id);
    }

    this.notifications.push(notification);
    this.render(notification);

    // Auto-hide if enabled
    if (this.config.autoHide && !options.persistent) {
      setTimeout(() => {
        this.remove(notification.id);
      }, this.config.autoHideDelay);
    }

    return notification.id;
  }

  /**
   * Show success notification
   */
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  /**
   * Show error notification
   */
  error(message, options = {}) {
    return this.show(message, 'error', { persistent: true, ...options });
  }

  /**
   * Show warning notification
   */
  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  /**
   * Show info notification
   */
  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  /**
   * Render a notification
   */
  render(notification) {
    const element = document.createElement('div');
    element.className = `notification notification-${notification.type}`;
    element.dataset.notificationId = notification.id;
    
    element.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">
          ${this.getIcon(notification.type)}
        </div>
        <div class="notification-message">${notification.message}</div>
        <button class="notification-close" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="notification-progress"></div>
    `;

    // Add close handler
    const closeBtn = element.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.remove(notification.id);
    });

    // Add to container
    this.container.appendChild(element);

    // Animate in
    setTimeout(() => {
      element.classList.add('show');
    }, 10);

    // Start progress bar if auto-hide is enabled
    if (this.config.autoHide && !notification.persistent) {
      this.startProgressBar(element);
    }
  }

  /**
   * Get icon for notification type
   */
  getIcon(type) {
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      error: '<i class="fas fa-exclamation-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info: '<i class="fas fa-info-circle"></i>'
    };
    return icons[type] || icons.info;
  }

  /**
   * Start progress bar animation
   */
  startProgressBar(element) {
    const progressBar = element.querySelector('.notification-progress');
    if (progressBar) {
      progressBar.style.animation = `progress ${this.config.autoHideDelay}ms linear`;
    }
  }

  /**
   * Remove a notification
   */
  remove(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return;

    const element = this.container.querySelector(`[data-notification-id="${id}"]`);
    if (element) {
      element.classList.add('hide');
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 300);
    }

    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications.forEach(notification => {
      this.remove(notification.id);
    });
  }

  /**
   * Destroy the notification manager
   */
  destroy() {
    this.clearAll();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

export default NotificationManager;
