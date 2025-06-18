/**
 * Core Application Module
 * Main entry point for the application
 */

import errorHandler from './error-handler.js';
import themeManager from './theme-manager.js';
import eventBus from './event-bus.js';
import appState from './state.js';
import utils from './utils.js';
import apiClient from '../api/api-client.js';

class App {
  constructor() {
    // Application modules
    this.modules = new Map();
    
    // Initialization status
    this.initialized = false;
    
    // Make core modules available globally
    this.core = {
      errorHandler,
      themeManager,
      eventBus,
      state: appState,
      utils,
      api: apiClient
    };
  }

  /**
   * Initialize the application
   * @param {Object} config - Application configuration
   * @returns {Promise<void>}
   */
  async init(config = {}) {
    if (this.initialized) {
      console.warn('App already initialized');
      return;
    }
    
    try {
      console.log('Initializing Quick Chat application...');
      
      // Store configuration in state
      appState.setState({ config });
      
      // Register application events
      this.registerEvents();
      
      // Load user data if authenticated
      await this.loadUserData();
      
      // Register service worker
      this.registerServiceWorker();
      
      // Mark as initialized
      this.initialized = true;
      
      // Emit initialization event
      eventBus.emit('app:initialized');
      
      console.log('Application initialized successfully');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      errorHandler.handleError(error);
    }
  }

  /**
   * Register application-wide events
   */
  registerEvents() {
    // Document visibility change
    document.addEventListener('visibilitychange', () => {
      eventBus.emit('visibility:change', { 
        isVisible: document.visibilityState === 'visible' 
      });
      
      // Update online status when tab becomes visible
      if (document.visibilityState === 'visible') {
        appState.setState({ isOnline: navigator.onLine });
      }
    });
    
    // Before unload
    window.addEventListener('beforeunload', () => {
      eventBus.emit('app:beforeunload');
    });
  }

  /**
   * Load user data from API or local storage
   * @returns {Promise<void>}
   */
  async loadUserData() {
    try {
      // Check if auth token exists
      const token = utils.storage.get('auth_token');
      
      if (!token) {
        appState.setState({ 
          isAuthenticated: false,
          user: null
        });
        return;
      }
      
      // Try to load user from API
      const response = await apiClient.get('/users/me');
      
      if (response && response.user) {
        appState.setState({
          isAuthenticated: true,
          user: response.user
        });
        
        // Emit user loaded event
        eventBus.emit('user:loaded', response.user);
      } else {
        // Clear invalid token
        utils.storage.remove('auth_token');
        appState.setState({ 
          isAuthenticated: false,
          user: null
        });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      appState.setState({ 
        isAuthenticated: false,
        user: null
      });
    }
  }

  /**
   * Register service worker for PWA support
   */
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
            
            // Emit service worker registered event
            eventBus.emit('serviceworker:registered', registration);
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }

  /**
   * Register a module with the application
   * @param {string} name - Module name
   * @param {Object} module - Module instance
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`Module '${name}' already registered. Overwriting.`);
    }
    
    this.modules.set(name, module);
    
    // Initialize if has init method
    if (typeof module.init === 'function') {
      try {
        module.init();
      } catch (error) {
        console.error(`Error initializing module '${name}':`, error);
      }
    }
    
    // Emit module registered event
    eventBus.emit('module:registered', { name, module });
  }

  /**
   * Get a registered module
   * @param {string} name - Module name
   * @returns {Object|null} Module instance
   */
  getModule(name) {
    return this.modules.get(name) || null;
  }
}

// Create singleton instance
const app = new App();

// Make core modules available globally (for backward compatibility)
window.app = app;
window.utils = utils;
window.eventBus = eventBus;

export default app;
