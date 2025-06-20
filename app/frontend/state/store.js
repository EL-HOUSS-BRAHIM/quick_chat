/**
 * Main Application Store
 * Centralized state management for the application
 */

import { EventBus } from '../services/EventBus.js';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/helpers.js';

class Store {
  constructor() {
    this.state = {};
    this.eventBus = new EventBus();
    this.initialized = false;
    this.persistentKeys = new Set();
    this.subscribers = new Map();
    this.middleware = [];
    
    // Debug mode
    this.debug = false;
  }

  /**
   * Initialize the store
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing main store');
      
      // Load persistent state from storage
      await this.loadPersistentState();
      
      // Set default state
      this.setState({
        app: {
          initialized: false,
          loading: false,
          error: null,
          config: null
        },
        user: {
          id: null,
          username: null,
          isAuthenticated: false,
          preferences: {}
        },
        ui: {
          theme: 'auto',
          sidebarOpen: true,
          notifications: [],
          modals: []
        },
        connection: {
          online: navigator.onLine,
          websocket: 'disconnected',
          lastActivity: Date.now()
        }
      }, false); // Don't trigger persistence on init
      
      // Set persistent keys
      this.setPersistentKeys([
        'user.preferences',
        'ui.theme',
        'ui.sidebarOpen'
      ]);
      
      // Set up connection monitoring
      this.setupConnectionMonitoring();
      
      this.initialized = true;
      
      this.eventBus.emit('store:initialized');
      logger.info('Main store initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize main store:', error);
      throw error;
    }
  }

  /**
   * Get state value
   * @param {string} path - State path (e.g., 'user.id' or 'ui.theme')
   */
  getState(path) {
    if (!path) {
      return { ...this.state };
    }
    
    const keys = path.split('.');
    let value = this.state;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set state value
   * @param {string|Object} pathOrState - State path or state object
   * @param {*} value - Value to set (if path is string)
   * @param {boolean} persist - Whether to persist changes
   */
  setState(pathOrState, value, persist = true) {
    let changes = {};
    
    if (typeof pathOrState === 'string') {
      // Setting specific path
      const path = pathOrState;
      const keys = path.split('.');
      const lastKey = keys.pop();
      
      let target = this.state;
      for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }
      
      const oldValue = target[lastKey];
      target[lastKey] = value;
      changes[path] = { oldValue, newValue: value };
      
    } else {
      // Setting multiple values
      changes = this.mergeState(pathOrState);
    }
    
    // Apply middleware
    for (const middleware of this.middleware) {
      try {
        middleware(changes, this.state);
      } catch (error) {
        logger.error('Store middleware error:', error);
      }
    }
    
    // Notify subscribers
    this.notifySubscribers(changes);
    
    // Persist if needed
    if (persist) {
      this.persistState();
    }
    
    // Emit global state change event
    this.eventBus.emit('store:change', {
      changes,
      state: this.getState()
    });
    
    if (this.debug) {
      logger.debug('Store state changed:', changes);
    }
  }

  /**
   * Merge state object
   * @param {Object} newState - New state to merge
   */
  mergeState(newState) {
    const changes = {};
    
    const merge = (target, source, path = '') => {
      for (const key in source) {
        const currentPath = path ? `${path}.${key}` : key;
        const oldValue = target[key];
        
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          merge(target[key], source[key], currentPath);
        } else {
          target[key] = source[key];
          changes[currentPath] = { oldValue, newValue: source[key] };
        }
      }
    };
    
    merge(this.state, newState);
    return changes;
  }

  /**
   * Subscribe to state changes
   * @param {string|Function} pathOrCallback - State path to watch or callback for all changes
   * @param {Function} callback - Callback function (if path is provided)
   */
  subscribe(pathOrCallback, callback) {
    let subscriberPath, subscriberCallback;
    
    if (typeof pathOrCallback === 'function') {
      subscriberPath = '*';
      subscriberCallback = pathOrCallback;
    } else {
      subscriberPath = pathOrCallback;
      subscriberCallback = callback;
    }
    
    if (!this.subscribers.has(subscriberPath)) {
      this.subscribers.set(subscriberPath, new Set());
    }
    
    this.subscribers.get(subscriberPath).add(subscriberCallback);
    
    // Return unsubscribe function
    return () => {
      const pathSubscribers = this.subscribers.get(subscriberPath);
      if (pathSubscribers) {
        pathSubscribers.delete(subscriberCallback);
        if (pathSubscribers.size === 0) {
          this.subscribers.delete(subscriberPath);
        }
      }
    };
  }

  /**
   * Notify subscribers of changes
   * @param {Object} changes - Changes object
   */
  notifySubscribers(changes) {
    // Notify specific path subscribers
    for (const [path, subscribers] of this.subscribers) {
      if (path === '*') {
        // Global subscribers
        for (const callback of subscribers) {
          try {
            callback(changes, this.getState());
          } catch (error) {
            logger.error('Store subscriber error:', error);
          }
        }
      } else {
        // Path-specific subscribers
        if (changes[path] || Object.keys(changes).some(changePath => changePath.startsWith(path))) {
          for (const callback of subscribers) {
            try {
              callback(this.getState(path), changes[path]);
            } catch (error) {
              logger.error('Store subscriber error:', error);
            }
          }
        }
      }
    }
  }

  /**
   * Add middleware
   * @param {Function} middleware - Middleware function
   */
  addMiddleware(middleware) {
    if (typeof middleware === 'function') {
      this.middleware.push(middleware);
    }
  }

  /**
   * Set persistent keys
   * @param {Array} keys - Array of state paths to persist
   */
  setPersistentKeys(keys) {
    this.persistentKeys = new Set(keys);
  }

  /**
   * Add persistent key
   * @param {string} key - State path to persist
   */
  addPersistentKey(key) {
    this.persistentKeys.add(key);
  }

  /**
   * Remove persistent key
   * @param {string} key - State path to stop persisting
   */
  removePersistentKey(key) {
    this.persistentKeys.delete(key);
  }

  /**
   * Load persistent state from storage
   */
  async loadPersistentState() {
    try {
      const persistentState = storage.get('quickchat:store');
      if (persistentState) {
        this.state = { ...this.state, ...persistentState };
      }
    } catch (error) {
      logger.warn('Failed to load persistent state:', error);
    }
  }

  /**
   * Persist state to storage
   */
  persistState() {
    try {
      const persistentState = {};
      
      for (const key of this.persistentKeys) {
        const value = this.getState(key);
        if (value !== undefined) {
          const keys = key.split('.');
          let target = persistentState;
          
          for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) {
              target[keys[i]] = {};
            }
            target = target[keys[i]];
          }
          
          target[keys[keys.length - 1]] = value;
        }
      }
      
      storage.set('quickchat:store', persistentState);
    } catch (error) {
      logger.warn('Failed to persist state:', error);
    }
  }

  /**
   * Set up connection monitoring
   */
  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      this.setState('connection.online', true);
    });
    
    window.addEventListener('offline', () => {
      this.setState('connection.online', false);
    });
    
    // Update last activity on user interaction
    const updateActivity = () => {
      this.setState('connection.lastActivity', Date.now());
    };
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  }

  /**
   * Reset store to initial state
   */
  reset() {
    this.state = {};
    this.subscribers.clear();
    this.persistentKeys.clear();
    storage.remove('quickchat:store');
    
    this.eventBus.emit('store:reset');
    logger.info('Store reset to initial state');
  }

  /**
   * Enable debug mode
   * @param {boolean} enabled - Debug enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Get store debug information
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      stateKeys: Object.keys(this.state),
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      persistentKeys: Array.from(this.persistentKeys),
      middlewareCount: this.middleware.length
    };
  }
}

// Create singleton instance
export const store = new Store();
