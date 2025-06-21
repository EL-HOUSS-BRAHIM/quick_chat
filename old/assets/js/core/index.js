/**
 * Core Module Index
 * Centralized exports for all core modules
 */

// Core application modules
export { default as app } from './app.js';
export { default as eventBus } from './event-bus.js';
export { state } from './state.js';
export { default as errorHandler } from './error-handler.js';
export { default as logger } from './logger.js';
export { default as security } from './security.js';
export { default as utils } from './utils.js';

// Browser and compatibility
export { default as browserCompatibility } from './browser-compatibility.js';

// PWA and service worker
export { default as pwaManager } from './pwa-manager.js';

// WebSocket management
export { default as WebSocketManager } from './websocket-manager.js';

// Performance monitoring
export { default as performanceMonitor } from './performance-monitor.js';

// Additional core utilities
export { default as stateManager } from './state-manager.js';
export { default as accessibilityManager } from './accessibility-manager.js';
export { default as mobileExperienceManager } from './mobile-experience-manager.js';

// Re-export commonly used functionality
export const { 
  getState, 
  setState, 
  subscribe: subscribeToState,
  unsubscribe: unsubscribeFromState 
} = state;

export const { 
  on: addEventListener, 
  off: removeEventListener, 
  emit: emitEvent 
} = eventBus;

// Core initialization function
export async function initializeCore() {
  try {
    // Initialize in correct order
    await app.init();
    await errorHandler.init();
    await security.init();
    
    console.log('Core modules initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize core modules:', error);
    return false;
  }
}
