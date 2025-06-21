/**
 * Toast Component - Organized Architecture
 * 
 * Modern toast notification system with:
 * - Multiple types (success, error, warning, info)
 * - Auto-dismiss with configurable timeout
 * - Manual dismiss
 * - Action buttons
 * - Queue management
 * - Accessibility support
 */

import { EventBus } from '../../services/EventBus.js';
import { logger } from '../../utils/logger.js';

export class Toast {
  constructor(config = {}) {
    this.config = {
      type: config.type || 'info', // 'success', 'error', 'warning', 'info'
      title: config.title || '',
      message: config.message || '',
      timeout: config.timeout !== undefined ? config.timeout : 5000,
      persistent: config.persistent || false,
      actions: config.actions || [],
      showClose: config.showClose !== false,
      showIcon: config.showIcon !== false,
      position: config.position || 'top-right',
      className: config.className || '',
      onClick: config.onClick || null,
      onClose: config.onClose || null,
      ...config
    };

    this.eventBus = new EventBus();
    this.element = null;
    this.timeoutId = null;
    this.id = this.generateId();
    this.isVisible = false;
  }

  /**
   * Generate unique ID for toast
   */
  generateId() {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create and render the toast
   */
  render() {
    this.element = document.createElement('div');
    this.element.className = this.getToastClasses();
    this.element.setAttribute('role', 'alert');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('data-toast-id', this.id);

    // Create toast content
    this.createContent();

    // Setup event listeners
    this.setupEventListeners();

    return this.element;
  }

  /**
   * Get toast CSS classes
   */
  getToastClasses() {
    const classes = [
      'toast',
      `toast--${this.config.type}`,
      `toast--${this.config.position}`
    ];

    if (this.config.className) {
      classes.push(this.config.className);
    }

    return classes.join(' ');
  }

  /**
   * Create toast content
   */
  createContent() {
    // Icon
    if (this.config.showIcon) {
      const icon = this.createIcon();
      this.element.appendChild(icon);
    }

    // Content container
    const content = document.createElement('div');
    content.classList.add('toast__content');

    // Title
    if (this.config.title) {
      const title = document.createElement('div');
      title.classList.add('toast__title');
      title.textContent = this.config.title;
      content.appendChild(title);
    }

    // Message
    if (this.config.message) {
      const message = document.createElement('div');
      message.classList.add('toast__message');
      message.textContent = this.config.message;
      content.appendChild(message);
    }

    // Actions
    if (this.config.actions.length > 0) {
      const actions = this.createActions();
      content.appendChild(actions);
    }

    this.element.appendChild(content);

    // Close button
    if (this.config.showClose) {
      const closeButton = this.createCloseButton();
      this.element.appendChild(closeButton);
    }
  }

  /**
   * Create toast icon
   */
  createIcon() {
    const icon = document.createElement('div');
    icon.classList.add('toast__icon');

    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '20');
    iconSvg.setAttribute('height', '20');
    iconSvg.setAttribute('viewBox', '0 0 20 20');
    iconSvg.setAttribute('fill', 'currentColor');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    switch (this.config.type) {
      case 'success':
        path.setAttribute('d', 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z');
        break;
      case 'error':
        path.setAttribute('d', 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z');
        break;
      case 'warning':
        path.setAttribute('d', 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z');
        break;
      case 'info':
      default:
        path.setAttribute('d', 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z');
        break;
    }

    iconSvg.appendChild(path);
    icon.appendChild(iconSvg);

    return icon;
  }

  /**
   * Create action buttons
   */
  createActions() {
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('toast__actions');

    this.config.actions.forEach(action => {
      const button = document.createElement('button');
      button.classList.add('toast__action');
      button.textContent = action.label;
      button.setAttribute('type', 'button');

      if (action.primary) {
        button.classList.add('toast__action--primary');
      }

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (action.handler) {
          action.handler(this);
        }
        if (action.dismiss !== false) {
          this.dismiss();
        }
      });

      actionsContainer.appendChild(button);
    });

    return actionsContainer;
  }

  /**
   * Create close button
   */
  createCloseButton() {
    const closeButton = document.createElement('button');
    closeButton.classList.add('toast__close');
    closeButton.setAttribute('type', 'button');
    closeButton.setAttribute('aria-label', 'Close notification');

    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('width', '16');
    closeSvg.setAttribute('height', '16');
    closeSvg.setAttribute('viewBox', '0 0 16 16');
    closeSvg.setAttribute('fill', 'currentColor');

    const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('d', 'M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z');

    closeSvg.appendChild(closePath);
    closeButton.appendChild(closeSvg);

    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });

    return closeButton;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Toast click handler
    if (this.config.onClick) {
      this.element.addEventListener('click', (e) => {
        this.config.onClick(this, e);
      });
    }

    // Mouse enter/leave for auto-dismiss pause
    this.element.addEventListener('mouseenter', () => {
      this.pauseTimeout();
    });

    this.element.addEventListener('mouseleave', () => {
      this.resumeTimeout();
    });

    // Focus events for accessibility
    this.element.addEventListener('focus', () => {
      this.pauseTimeout();
    });

    this.element.addEventListener('blur', () => {
      this.resumeTimeout();
    });

    // Keyboard handling
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.dismiss();
      }
    });
  }

  /**
   * Show the toast
   */
  show() {
    if (!this.element) {
      this.render();
    }

    // Add to DOM if not already present
    if (!this.element.parentNode) {
      ToastManager.getInstance().addToDOM(this);
    }

    // Trigger show animation
    requestAnimationFrame(() => {
      this.element.classList.add('toast--visible');
      this.isVisible = true;
    });

    // Start auto-dismiss timer
    if (!this.config.persistent && this.config.timeout > 0) {
      this.startTimeout();
    }

    // Emit shown event
    this.eventBus.emit('toast:shown', this);

    return this;
  }

  /**
   * Dismiss the toast
   */
  dismiss() {
    if (!this.isVisible) return;

    this.clearTimeout();
    this.element.classList.remove('toast--visible');
    this.element.classList.add('toast--dismissing');
    this.isVisible = false;

    // Remove from DOM after animation
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      
      // Call onClose callback
      if (this.config.onClose) {
        this.config.onClose(this);
      }

      // Emit dismissed event
      this.eventBus.emit('toast:dismissed', this);

      // Notify manager
      ToastManager.getInstance().remove(this);
    }, 300);

    return this;
  }

  /**
   * Start auto-dismiss timeout
   */
  startTimeout() {
    if (this.config.timeout > 0) {
      this.timeoutId = setTimeout(() => {
        this.dismiss();
      }, this.config.timeout);
    }
  }

  /**
   * Clear auto-dismiss timeout
   */
  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Pause auto-dismiss timeout
   */
  pauseTimeout() {
    this.clearTimeout();
  }

  /**
   * Resume auto-dismiss timeout
   */
  resumeTimeout() {
    if (!this.config.persistent && this.config.timeout > 0 && this.isVisible) {
      this.startTimeout();
    }
  }

  /**
   * Update toast content
   */
  update(updates) {
    Object.assign(this.config, updates);
    
    if (this.element) {
      // Re-render content
      this.element.innerHTML = '';
      this.createContent();
      this.setupEventListeners();
    }

    return this;
  }

  /**
   * Get toast ID
   */
  getId() {
    return this.id;
  }

  /**
   * Check if toast is visible
   */
  getIsVisible() {
    return this.isVisible;
  }

  /**
   * Subscribe to toast events
   */
  on(event, callback) {
    this.eventBus.on(event, callback);
    return this;
  }

  /**
   * Unsubscribe from toast events
   */
  off(event, callback) {
    this.eventBus.off(event, callback);
    return this;
  }

  /**
   * Destroy the toast
   */
  destroy() {
    this.clearTimeout();
    
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    this.eventBus.removeAllListeners();
    this.element = null;
  }
}

/**
 * Toast Manager - Singleton for managing multiple toasts
 */
class ToastManager {
  constructor() {
    this.toasts = new Map();
    this.containers = new Map();
    this.maxToasts = 5;
    this.defaultPosition = 'top-right';
  }

  static getInstance() {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  /**
   * Get or create container for position
   */
  getContainer(position) {
    if (!this.containers.has(position)) {
      const container = document.createElement('div');
      container.classList.add('toast-container', `toast-container--${position}`);
      document.body.appendChild(container);
      this.containers.set(position, container);
    }
    return this.containers.get(position);
  }

  /**
   * Add toast to DOM
   */
  addToDOM(toast) {
    const container = this.getContainer(toast.config.position);
    container.appendChild(toast.element);
  }

  /**
   * Add toast to manager
   */
  add(toast) {
    // Remove oldest toast if at limit
    const positionToasts = Array.from(this.toasts.values())
      .filter(t => t.config.position === toast.config.position);
    
    if (positionToasts.length >= this.maxToasts) {
      const oldest = positionToasts[0];
      oldest.dismiss();
    }

    this.toasts.set(toast.getId(), toast);
    return toast;
  }

  /**
   * Remove toast from manager
   */
  remove(toast) {
    this.toasts.delete(toast.getId());
  }

  /**
   * Get toast by ID
   */
  get(id) {
    return this.toasts.get(id);
  }

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    for (const toast of this.toasts.values()) {
      toast.dismiss();
    }
  }

  /**
   * Dismiss toasts by type
   */
  dismissByType(type) {
    for (const toast of this.toasts.values()) {
      if (toast.config.type === type) {
        toast.dismiss();
      }
    }
  }

  /**
   * Create and show toast
   */
  show(config) {
    const toast = new Toast(config);
    this.add(toast);
    toast.show();
    return toast;
  }

  /**
   * Show success toast
   */
  success(message, options = {}) {
    return this.show({
      type: 'success',
      message,
      ...options
    });
  }

  /**
   * Show error toast
   */
  error(message, options = {}) {
    return this.show({
      type: 'error',
      message,
      persistent: true,
      ...options
    });
  }

  /**
   * Show warning toast
   */
  warning(message, options = {}) {
    return this.show({
      type: 'warning',
      message,
      ...options
    });
  }

  /**
   * Show info toast
   */
  info(message, options = {}) {
    return this.show({
      type: 'info',
      message,
      ...options
    });
  }
}

// Export toast manager instance
export const toastManager = ToastManager.getInstance();

// Export factory functions
export function showToast(config) {
  return toastManager.show(config);
}

export function showSuccess(message, options) {
  return toastManager.success(message, options);
}

export function showError(message, options) {
  return toastManager.error(message, options);
}

export function showWarning(message, options) {
  return toastManager.warning(message, options);
}

export function showInfo(message, options) {
  return toastManager.info(message, options);
}
