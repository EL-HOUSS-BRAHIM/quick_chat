/**
 * Core Application Service
 * Manages the overall application lifecycle and core functionality
 */

import { logger } from '../utils/logger.js';
import { EventBus } from './EventBus.js';

export class App {
  constructor() {
    this.initialized = false;
    this.config = null;
    this.eventBus = new EventBus();
    this.services = new Map();
    this.startTime = Date.now();
  }

  /**
   * Initialize the application
   * @param {Object} config - Application configuration
   */
  async init(config = {}) {
    if (this.initialized) {
      logger.warn('App service already initialized');
      return;
    }

    try {
      logger.info('Initializing App service');
      
      this.config = { ...this.getDefaultConfig(), ...config };
      
      // Set up global error handling
      this.setupGlobalErrorHandling();
      
      // Set up visibility change handler
      this.setupVisibilityHandler();
      
      // Set up online/offline handlers
      this.setupConnectionHandlers();
      
      // Load user preferences
      await this.loadUserPreferences();
      
      this.initialized = true;
      
      this.eventBus.emit('app:service:initialized', {
        config: this.config,
        initTime: Date.now() - this.startTime
      });
      
      logger.info('App service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize App service:', error);
      throw error;
    }
  }

  /**
   * Get default configuration
   */
  getDefaultConfig() {
    return {
      debug: false,
      theme: 'auto',
      language: 'en',
      features: {
        accessibility: true,
        i18n: true,
        mobileOptimization: true,
        webrtc: true,
        fileUpload: true,
        voiceMessages: true,
        encryption: false
      },
      performance: {
        virtualScrolling: true,
        lazyLoading: true,
        imageOptimization: true
      }
    };
  }

  /**
   * Set up global error handling
   */
  setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      this.eventBus.emit('app:error', {
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.eventBus.emit('app:error', {
        type: 'promise',
        reason: event.reason,
        promise: event.promise
      });
    });
  }

  /**
   * Set up visibility change handler
   */
  setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      const isVisible = document.visibilityState === 'visible';
      
      this.eventBus.emit('app:visibility:change', {
        isVisible,
        timestamp: Date.now()
      });
      
      // Update connection status when page becomes visible
      if (isVisible) {
        this.eventBus.emit('app:connection:check');
      }
    });
  }

  /**
   * Set up online/offline handlers
   */
  setupConnectionHandlers() {
    window.addEventListener('online', () => {
      this.eventBus.emit('app:connection:online', {
        timestamp: Date.now()
      });
    });

    window.addEventListener('offline', () => {
      this.eventBus.emit('app:connection:offline', {
        timestamp: Date.now()
      });
    });
  }

  /**
   * Load user preferences from storage
   */
  async loadUserPreferences() {
    try {
      const preferences = localStorage.getItem('quickchat:preferences');
      if (preferences) {
        const parsed = JSON.parse(preferences);
        this.config = { ...this.config, ...parsed };
      }
    } catch (error) {
      logger.warn('Failed to load user preferences:', error);
    }
  }

  /**
   * Save user preferences to storage
   */
  async saveUserPreferences(preferences) {
    try {
      const updated = { ...this.config, ...preferences };
      localStorage.setItem('quickchat:preferences', JSON.stringify(updated));
      this.config = updated;
      
      this.eventBus.emit('app:preferences:updated', {
        preferences: updated
      });
      
    } catch (error) {
      logger.error('Failed to save user preferences:', error);
      throw error;
    }
  }

  /**
   * Register a service
   */
  registerService(name, service) {
    this.services.set(name, service);
    logger.debug(`Service registered: ${name}`);
  }

  /**
   * Get a registered service
   */
  getService(name) {
    return this.services.get(name);
  }

  /**
   * Get application configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update application configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.eventBus.emit('app:config:updated', {
      config: this.config,
      updates
    });
  }

  /**
   * Get application runtime information
   */
  getRuntimeInfo() {
    return {
      initialized: this.initialized,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      config: this.getConfig(),
      services: Array.from(this.services.keys()),
      isOnline: navigator.onLine,
      isVisible: document.visibilityState === 'visible'
    };
  }

  /**
   * Shutdown the application
   */
  async shutdown() {
    logger.info('Shutting down application...');
    
    this.eventBus.emit('app:shutdown:start');
    
    // Shutdown all registered services
    for (const [name, service] of this.services) {
      if (service.shutdown && typeof service.shutdown === 'function') {
        try {
          await service.shutdown();
          logger.debug(`Service shutdown: ${name}`);
        } catch (error) {
          logger.error(`Failed to shutdown service ${name}:`, error);
        }
      }
    }
    
    this.eventBus.emit('app:shutdown:complete');
    
    this.initialized = false;
    logger.info('Application shutdown complete');
  }
}

// Create singleton instance
export const app = new App();
