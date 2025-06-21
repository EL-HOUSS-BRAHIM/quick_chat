/**
 * Application Store - Central State Management
 * 
 * Main application store that coordinates all other stores
 * Provides centralized state management and cross-store communication
 */

import { EventBus } from '../services/EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';
import { chatStore } from './chatStore.js';
import { userStore } from './userStore.js';
import { callStore } from './callStore.js';
import { notificationStore } from './notificationStore.js';
import { uiStore } from './uiStore.js';

class ApplicationStore {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    
    // Store registry
    this.stores = new Map([
      ['chat', chatStore],
      ['user', userStore],
      ['call', callStore],
      ['notification', notificationStore],
      ['ui', uiStore]
    ]);

    // Application-level state
    this.state = {
      isInitialized: false,
      isOnline: navigator.onLine,
      currentRoute: null,
      connectionStatus: 'disconnected',
      lastActivity: Date.now(),
      maintenanceMode: false,
      debugMode: false
    };

    // Subscribe to store events
    this.setupStoreSubscriptions();
    
    // Setup global event listeners
    this.setupGlobalEventListeners();
  }

  /**
   * Initialize the application store
   */
  async init() {
    try {
      logger.info('Initializing Application Store...');

      // Initialize configuration manager first
      await configManager.init();

      // Set debug mode
      this.state.debugMode = configManager.get('debug.enabled', false);

      // Initialize all stores
      const initPromises = Array.from(this.stores.values()).map(store => {
        if (typeof store.init === 'function') {
          return store.init();
        }
        return Promise.resolve();
      });

      await Promise.all(initPromises);

      // Update initialization state
      this.state.isInitialized = true;
      this.initialized = true;

      // Emit initialized event
      this.eventBus.emit('app:initialized', { timestamp: Date.now() });

      logger.info('Application Store initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Application Store:', error);
      throw error;
    }
  }

  /**
   * Setup store subscriptions for cross-store communication
   */
  setupStoreSubscriptions() {
    // User store events
    userStore.eventBus.on('user:authenticated', (user) => {
      this.handleUserAuthenticated(user);
    });

    userStore.eventBus.on('user:logout', () => {
      this.handleUserLogout();
    });

    // Chat store events
    chatStore.eventBus.on('message:received', (message) => {
      notificationStore.addNotification({
        type: 'message',
        title: `New message from ${message.senderName}`,
        body: message.content,
        data: { messageId: message.id, chatId: message.chatId }
      });
    });

    // Call store events
    callStore.eventBus.on('call:incoming', (call) => {
      notificationStore.addNotification({
        type: 'call',
        title: `Incoming ${call.type} call`,
        body: `${call.callerName} is calling you`,
        data: { callId: call.id },
        actions: ['accept', 'reject']
      });
    });

    // UI store events
    uiStore.eventBus.on('theme:changed', (theme) => {
      this.eventBus.emit('app:theme:changed', theme);
    });

    uiStore.eventBus.on('locale:changed', (locale) => {
      this.eventBus.emit('app:locale:changed', locale);
    });
  }

  /**
   * Setup global event listeners
   */
  setupGlobalEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      this.updateConnectionStatus('online');
    });

    window.addEventListener('offline', () => {
      this.updateConnectionStatus('offline');
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // User activity tracking
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, { passive: true });
    });

    // Route changes (for SPAs)
    window.addEventListener('popstate', () => {
      this.updateCurrentRoute();
    });

    // Error handling
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason);
    });
  }

  /**
   * Handle user authentication
   */
  async handleUserAuthenticated(user) {
    try {
      // Initialize user-specific stores
      await chatStore.loadUserChats(user.id);
      await notificationStore.loadUserNotifications(user.id);
      
      // Update connection status
      this.updateConnectionStatus('connected');
      
      // Emit event
      this.eventBus.emit('app:user:authenticated', user);
      
    } catch (error) {
      logger.error('Error handling user authentication:', error);
    }
  }

  /**
   * Handle user logout
   */
  async handleUserLogout() {
    try {
      // Clear all stores
      await Promise.all([
        chatStore.clear(),
        callStore.clear(),
        notificationStore.clear()
      ]);
      
      // Update connection status
      this.updateConnectionStatus('disconnected');
      
      // Emit event
      this.eventBus.emit('app:user:logout');
      
    } catch (error) {
      logger.error('Error handling user logout:', error);
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    const previousStatus = this.state.connectionStatus;
    this.state.connectionStatus = status;
    this.state.isOnline = status === 'online' || status === 'connected';
    
    if (previousStatus !== status) {
      this.eventBus.emit('app:connection:changed', {
        status,
        previousStatus,
        timestamp: Date.now()
      });
      
      // Notify all stores about connection change
      this.stores.forEach(store => {
        if (typeof store.handleConnectionChange === 'function') {
          store.handleConnectionChange(status);
        }
      });
    }
  }

  /**
   * Handle page visibility change
   */
  handleVisibilityChange() {
    const isVisible = !document.hidden;
    
    this.eventBus.emit('app:visibility:changed', {
      isVisible,
      timestamp: Date.now()
    });

    // Notify stores about visibility change
    this.stores.forEach(store => {
      if (typeof store.handleVisibilityChange === 'function') {
        store.handleVisibilityChange(isVisible);
      }
    });
  }

  /**
   * Update last activity timestamp
   */
  updateLastActivity() {
    this.state.lastActivity = Date.now();
    this.eventBus.emit('app:activity', { timestamp: this.state.lastActivity });
  }

  /**
   * Update current route
   */
  updateCurrentRoute() {
    const route = window.location.pathname;
    const previousRoute = this.state.currentRoute;
    this.state.currentRoute = route;
    
    if (previousRoute !== route) {
      this.eventBus.emit('app:route:changed', {
        route,
        previousRoute,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle global errors
   */
  handleGlobalError(error) {
    logger.error('Global error caught:', error);
    
    // Add error notification
    notificationStore.addNotification({
      type: 'error',
      title: 'Application Error',
      body: 'An unexpected error occurred',
      timeout: 5000
    });
    
    // Emit error event
    this.eventBus.emit('app:error', {
      error,
      timestamp: Date.now()
    });
  }

  /**
   * Get store by name
   */
  getStore(name) {
    return this.stores.get(name);
  }

  /**
   * Get application state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get combined state from all stores
   */
  getAllStates() {
    const states = {
      app: this.getState()
    };
    
    this.stores.forEach((store, name) => {
      if (typeof store.getState === 'function') {
        states[name] = store.getState();
      }
    });
    
    return states;
  }

  /**
   * Subscribe to store events
   */
  subscribe(event, callback) {
    this.eventBus.on(event, callback);
  }

  /**
   * Unsubscribe from store events
   */
  unsubscribe(event, callback) {
    this.eventBus.off(event, callback);
  }

  /**
   * Emit application event
   */
  emit(event, data) {
    this.eventBus.emit(event, data);
  }

  /**
   * Enable maintenance mode
   */
  enableMaintenanceMode(reason = 'System maintenance') {
    this.state.maintenanceMode = true;
    
    notificationStore.addNotification({
      type: 'warning',
      title: 'Maintenance Mode',
      body: reason,
      persistent: true
    });
    
    this.eventBus.emit('app:maintenance:enabled', { reason });
  }

  /**
   * Disable maintenance mode
   */
  disableMaintenanceMode() {
    this.state.maintenanceMode = false;
    
    notificationStore.removeNotificationsByType('warning');
    
    this.eventBus.emit('app:maintenance:disabled');
  }

  /**
   * Check if application is ready
   */
  isReady() {
    return this.initialized && this.state.isInitialized;
  }

  /**
   * Destroy application store
   */
  async destroy() {
    try {
      // Destroy all stores
      const destroyPromises = Array.from(this.stores.values()).map(store => {
        if (typeof store.destroy === 'function') {
          return store.destroy();
        }
        return Promise.resolve();
      });

      await Promise.all(destroyPromises);

      // Clear event bus
      this.eventBus.removeAllListeners();
      
      // Reset state
      this.state = {
        isInitialized: false,
        isOnline: false,
        currentRoute: null,
        connectionStatus: 'disconnected',
        lastActivity: 0,
        maintenanceMode: false,
        debugMode: false
      };
      
      this.initialized = false;
      
      logger.info('Application Store destroyed');
      
    } catch (error) {
      logger.error('Error destroying Application Store:', error);
    }
  }
}

// Create and export singleton instance
export const appStore = new ApplicationStore();

// Export class for testing
export { ApplicationStore };
