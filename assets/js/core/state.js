/**
 * State Management System
 * Centralized application state with subscription capability
 */

import eventBus from './event-bus.js';

class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.previousState = { ...initialState };
    this.subscribers = [];
    this.computedProperties = {};
  }

  /**
   * Get current state or a specific property
   * @param {string} [property] - Optional property name
   * @returns {*} State value
   */
  getState(property = null) {
    if (property === null) {
      return { ...this.state };
    }
    
    if (property in this.computedProperties) {
      return this.computedProperties[property].getter(this.state);
    }
    
    return property in this.state ? this.state[property] : undefined;
  }

  /**
   * Update state
   * @param {Object|Function} update - State updates or updater function
   */
  setState(update) {
    this.previousState = { ...this.state };
    
    if (typeof update === 'function') {
      // Function updater that receives current state
      this.state = { ...this.state, ...update(this.state) };
    } else {
      // Object updater
      this.state = { ...this.state, ...update };
    }
    
    // Emit changes
    this.notifySubscribers();
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Called when state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify subscribers about state changes
   */
  notifySubscribers() {
    const state = this.getState();
    const previousState = this.previousState;
    
    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(state, previousState);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
    
    // Emit on event bus
    eventBus.emit('state:changed', { 
      state,
      previousState
    });
  }

  /**
   * Reset state to initial value
   * @param {Object} [initialState] - New initial state
   */
  resetState(initialState = {}) {
    this.previousState = { ...this.state };
    this.state = { ...initialState };
    this.notifySubscribers();
  }

  /**
   * Define a computed property
   * @param {string} name - Property name
   * @param {Function} getter - Function to compute value from state
   */
  defineComputed(name, getter) {
    if (typeof getter !== 'function') {
      throw new Error('Computed property getter must be a function');
    }
    
    this.computedProperties[name] = { getter };
  }

  /**
   * Get changes between current and previous state
   * @returns {Object} Changed properties
   */
  getChanges() {
    const changes = {};
    
    // Find changed properties
    Object.keys(this.state).forEach(key => {
      if (this.state[key] !== this.previousState[key]) {
        changes[key] = {
          previous: this.previousState[key],
          current: this.state[key]
        };
      }
    });
    
    // Find removed properties
    Object.keys(this.previousState).forEach(key => {
      if (!(key in this.state)) {
        changes[key] = {
          previous: this.previousState[key],
          current: undefined
        };
      }
    });
    
    return changes;
  }
}

// Create application state
const appState = new StateManager({
  user: null,
  isAuthenticated: false,
  messages: [],
  conversations: [],
  currentConversation: null,
  onlineUsers: [],
  notifications: [],
  settings: {
    theme: 'light',
    notifications: true,
    sounds: true
  },
  ui: {
    sidebarOpen: true,
    activeTab: 'chats',
    isMobile: window.innerWidth < 768
  },
  isOnline: navigator.onLine
});

// Add computed properties
appState.defineComputed('unreadMessageCount', (state) => {
  return state.notifications.filter(n => n.type === 'message' && !n.read).length;
});

// Set up online/offline monitoring
window.addEventListener('online', () => {
  appState.setState({ isOnline: true });
});

window.addEventListener('offline', () => {
  appState.setState({ isOnline: false });
});

// Update mobile state on resize
window.addEventListener('resize', () => {
  appState.setState({
    ui: {
      ...appState.getState('ui'),
      isMobile: window.innerWidth < 768
    }
  });
});

export default appState;
