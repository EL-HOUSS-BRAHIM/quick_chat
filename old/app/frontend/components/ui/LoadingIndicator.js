/**
 * Loading Indicator Component
 * 
 * Shows loading states throughout the application
 */

import { logger } from '../../utils/logger.js';

export class LoadingIndicator {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      id: config.id || 'loading-indicator',
      message: config.message || 'Loading...',
      ...config
    };

    this.element = null;
    this.isVisible = false;
  }

  /**
   * Initialize the loading indicator
   */
  async init() {
    try {
      this.createElement();
      logger.debug('Loading indicator initialized');
    } catch (error) {
      logger.error('Failed to initialize loading indicator:', error);
    }
  }

  /**
   * Create the loading indicator element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.id = this.config.id;
    this.element.className = 'loading-indicator';
    this.element.innerHTML = `
      <div class="loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-message">${this.config.message}</div>
        </div>
      </div>
    `;
    
    // Initially hidden
    this.element.style.display = 'none';
    
    this.config.container.appendChild(this.element);
  }

  /**
   * Show the loading indicator
   */
  show(message = null) {
    if (!this.element) {
      this.createElement();
    }

    if (message) {
      this.setMessage(message);
    }

    this.element.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Hide the loading indicator
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Set loading message
   */
  setMessage(message) {
    if (this.element) {
      const messageElement = this.element.querySelector('.loading-message');
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }

  /**
   * Destroy the loading indicator
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }
}

export default LoadingIndicator;
