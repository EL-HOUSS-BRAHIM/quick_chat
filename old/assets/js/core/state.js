/**
 * State Management System
 * Centralized application state with subscription capability
 * Enhanced with more efficient state update patterns
 */

import eventBus from './event-bus.js';
import StateManager from './state-manager.js';

// Create initial state
const initialState = {
  // Global application state
  isInitialized: false,
  isOnline: navigator.onLine,
  isLoading: false,
  isMobile: window.innerWidth < 768,
  theme: 'light',
  currentUserId: null,
  currentUsername: null,
  notifications: [],
  errors: [],
  currentRoute: null,
  
  // Features flags
  features: {
    encryption: false,
    videoCall: false,
    fileSharing: true,
    groupChat: true,
    reactions: true
  },
  
  // UI state
  ui: {
    sidebarOpen: window.innerWidth >= 768,
    modalOpen: false,
    activeTab: 'chats',
    expandedSections: {
      settings: false,
      notifications: false
    }
  },
  
  // User preferences
  preferences: {
    notifications: true,
    sounds: true,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fontSize: 'medium',
    messageAlignment: 'left',
    compactMode: false,
    autoPlayMedia: true
  }
};

// Create state manager instance
const stateManager = new StateManager(initialState);

// Set up derived/computed properties
stateManager.computed('isDarkMode', 
  (darkMode, autoDetect) => autoDetect && window.matchMedia('(prefers-color-scheme: dark)').matches || darkMode, 
  ['preferences.darkMode', 'preferences.autoDetectTheme']
);

stateManager.computed('unreadNotificationCount', 
  (notifications) => notifications.filter(n => !n.read).length,
  ['notifications']
);

// Set up persistence for preferences
stateManager.persist(['preferences'], {
  prefix: 'quick_chat_'
});

// Listen for online/offline events to update state
window.addEventListener('online', () => {
  stateManager.setState('isOnline', true);
  eventBus.emit('app:online');
});

window.addEventListener('offline', () => {
  stateManager.setState('isOnline', false);
  eventBus.emit('app:offline');
});

// Listen for window resize events to update mobile state
window.addEventListener('resize', () => {
  const isMobile = window.innerWidth < 768;
  if (isMobile !== stateManager.getState('isMobile')) {
    stateManager.setState('isMobile', isMobile);
    eventBus.emit('app:resize', { isMobile });
  }
});

// Legacy interface for backward compatibility
const state = {
  /**
   * Get current state or a specific property
   * @param {string} [property] - Optional property name
   * @returns {*} State value
   */
  getState(property = null) {
    return stateManager.getState(property);
  },

  /**
   * Update state
   * @param {Object|String} updateOrProperty - State updates object or property name
   * @param {*} [value] - Value if first parameter is a property name
   */
  setState(updateOrProperty, value) {
    if (typeof updateOrProperty === 'string') {
      stateManager.setState(updateOrProperty, value);
    } else {
      stateManager.setState(updateOrProperty);
    }
    
    // For backward compatibility, also emit events
    eventBus.emit('state:changed', stateManager.getState());
  },

  /**
   * Subscribe to state changes
   * @param {string|Function} propertyOrCallback - Property to watch or callback for all changes
   * @param {Function} [callback] - Callback if first parameter is a property
   * @returns {Function} Unsubscribe function
   */
  subscribe(propertyOrCallback, callback) {
    if (typeof propertyOrCallback === 'function') {
      return stateManager.subscribe(propertyOrCallback);
    } else {
      return stateManager.subscribe(propertyOrCallback, callback);
    }
  },
  
  /**
   * Batch multiple state updates
   * @param {Function} updateFn - Function containing multiple updates
   */
  batch(updateFn) {
    stateManager.batch(updateFn);
  }
};

export { state, stateManager };
