/**
 * Notification Manager
 * 
 * Manages in-app notifications and desktop notifications.
 * Provides a unified interface for displaying various types of notifications.
 */

class NotificationManager {
  constructor() {
    this.config = {
      position: 'top-right', // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
      duration: 5000, // Default duration in ms
      maxNotifications: 3, // Maximum number of notifications displayed at once
      enableDesktopNotifications: true,
      requireInteraction: false, // Whether desktop notifications should remain until user interaction
      container: null // Custom container element
    };
    
    this.permissions = {
      desktop: false
    };
    
    this.activeNotifications = [];
    this.queue = [];
    
    // Counter for generating unique IDs
    this.counter = 0;
    
    // Container for notifications
    this.container = null;
  }
  
  /**
   * Initialize the notification manager
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    this.config = { ...this.config, ...config };
    
    // Create container if it doesn't exist
    this._createContainer();
    
    // Check desktop notification permissions
    if (this.config.enableDesktopNotifications) {
      this._checkDesktopPermissions();
    }
    
    return this;
  }
  
  /**
   * Show a success notification
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   * @returns {string} - Notification ID
   */
  success(message, options = {}) {
    return this._showNotification({
      type: 'success',
      message,
      icon: 'check-circle',
      ...options
    });
  }
  
  /**
   * Show an info notification
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   * @returns {string} - Notification ID
   */
  info(message, options = {}) {
    return this._showNotification({
      type: 'info',
      message,
      icon: 'info-circle',
      ...options
    });
  }
  
  /**
   * Show a warning notification
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   * @returns {string} - Notification ID
   */
  warning(message, options = {}) {
    return this._showNotification({
      type: 'warning',
      message,
      icon: 'exclamation-triangle',
      ...options
    });
  }
  
  /**
   * Show an error notification
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   * @returns {string} - Notification ID
   */
  error(message, options = {}) {
    return this._showNotification({
      type: 'error',
      message,
      icon: 'exclamation-circle',
      ...options
    });
  }
  
  /**
   * Close a notification by ID
   * @param {string} id - Notification ID
   */
  close(id) {
    const index = this.activeNotifications.findIndex(n => n.id === id);
    
    if (index !== -1) {
      const notification = this.activeNotifications[index];
      this._removeNotification(notification);
    }
  }
  
  /**
   * Close all active notifications
   */
  closeAll() {
    [...this.activeNotifications].forEach(notification => {
      this._removeNotification(notification);
    });
  }
  
  /**
   * Request desktop notification permissions
   * @returns {Promise<boolean>} - Whether permission was granted
   */
  async requestDesktopPermissions() {
    if (!('Notification' in window)) {
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      this.permissions.desktop = permission === 'granted';
      return this.permissions.desktop;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return false;
    }
  }
  
  /**
   * Show a desktop notification
   * @param {string} title - Notification title
   * @param {Object} options - Notification options
   * @returns {Notification|null} - Notification object or null if not supported/permitted
   */
  showDesktopNotification(title, options = {}) {
    if (!this.permissions.desktop || !('Notification' in window)) {
      return null;
    }
    
    const notificationOptions = {
      body: options.message || '',
      icon: options.icon || '/assets/images/icon-192.png',
      badge: options.badge || '/assets/images/icon-192.png',
      tag: options.tag || 'quick-chat',
      requireInteraction: options.requireInteraction !== undefined ? 
        options.requireInteraction : this.config.requireInteraction,
      data: options.data || {}
    };
    
    const notification = new Notification(title, notificationOptions);
    
    // Add event handlers
    if (options.onClick) {
      notification.onclick = options.onClick;
    }
    
    if (options.onClose) {
      notification.onclose = options.onClose;
    }
    
    return notification;
  }
  
  /**
   * Internal method to show a notification
   * @private
   * @param {Object} options - Notification options
   * @returns {string} - Notification ID
   */
  _showNotification(options) {
    const id = `notification-${++this.counter}`;
    
    const notification = {
      id,
      type: options.type || 'info',
      message: options.message || '',
      icon: options.icon,
      duration: options.duration !== undefined ? options.duration : this.config.duration,
      onClick: options.onClick,
      onClose: options.onClose,
      autoClose: options.autoClose !== undefined ? options.autoClose : true,
      element: null,
      timer: null
    };
    
    // Show desktop notification if enabled
    if (this.config.enableDesktopNotifications && 
        options.desktop !== false && 
        this.permissions.desktop) {
      this.showDesktopNotification(options.title || 'Quick Chat', {
        message: options.message,
        icon: options.desktopIcon,
        requireInteraction: options.requireInteraction,
        onClick: options.onDesktopClick || options.onClick,
        onClose: options.onDesktopClose
      });
    }
    
    // Add to queue or display immediately
    if (this.activeNotifications.length >= this.config.maxNotifications) {
      this.queue.push(notification);
    } else {
      this._displayNotification(notification);
    }
    
    return id;
  }
  
  /**
   * Display a notification in the UI
   * @private
   * @param {Object} notification - Notification object
   */
  _displayNotification(notification) {
    // Create notification element
    const element = document.createElement('div');
    element.className = `notification notification-${notification.type}`;
    element.setAttribute('role', 'alert');
    element.id = notification.id;
    
    // Add to active notifications
    notification.element = element;
    this.activeNotifications.push(notification);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'notification-close';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close notification');
    closeButton.addEventListener('click', () => this.close(notification.id));
    
    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    // Add icon if provided
    if (notification.icon) {
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'notification-icon';
      iconWrapper.innerHTML = `<i class="fas fa-${notification.icon}"></i>`;
      element.appendChild(iconWrapper);
    }
    
    // Add message
    content.textContent = notification.message;
    
    // Assemble notification
    element.appendChild(content);
    element.appendChild(closeButton);
    
    // Add to container
    this.container.appendChild(element);
    
    // Add click handler
    if (notification.onClick) {
      element.addEventListener('click', (e) => {
        // Don't trigger if clicking the close button
        if (e.target !== closeButton && !closeButton.contains(e.target)) {
          notification.onClick(notification);
        }
      });
    }
    
    // Force a reflow to enable animations
    element.offsetHeight;
    
    // Show the notification
    element.classList.add('show');
    
    // Set timer for auto-close
    if (notification.autoClose && notification.duration > 0) {
      notification.timer = setTimeout(() => {
        this.close(notification.id);
      }, notification.duration);
    }
  }
  
  /**
   * Remove a notification
   * @private
   * @param {Object} notification - Notification object
   */
  _removeNotification(notification) {
    // Clear auto-close timer
    if (notification.timer) {
      clearTimeout(notification.timer);
    }
    
    // Remove from active notifications
    const index = this.activeNotifications.indexOf(notification);
    if (index !== -1) {
      this.activeNotifications.splice(index, 1);
    }
    
    // Trigger onClose callback
    if (notification.onClose) {
      notification.onClose(notification);
    }
    
    // Animate out
    notification.element.classList.remove('show');
    notification.element.classList.add('hide');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      
      // Display next notification from queue
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        this._displayNotification(next);
      }
    }, 300); // Match the CSS animation duration
  }
  
  /**
   * Create the notification container
   * @private
   */
  _createContainer() {
    // Use provided container or create new one
    if (this.config.container) {
      this.container = typeof this.config.container === 'string' ?
        document.querySelector(this.config.container) :
        this.config.container;
    } else {
      this.container = document.getElementById('notification-container');
      
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = `notification-container ${this.config.position}`;
        document.body.appendChild(this.container);
      }
    }
  }
  
  /**
   * Check desktop notification permissions
   * @private
   */
  _checkDesktopPermissions() {
    if (!('Notification' in window)) {
      this.permissions.desktop = false;
      return;
    }
    
    if (Notification.permission === 'granted') {
      this.permissions.desktop = true;
    }
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

export default notificationManager;
