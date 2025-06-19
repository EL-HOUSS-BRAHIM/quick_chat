/**
 * Progressive Web App (PWA) Manager - DEPRECATED
 * Handles service worker registration, offline functionality, and app installation
 * Enhanced with improved push notification system - Updated 2025-06-19
 * 
 * This file is maintained for backward compatibility
 * Please use the new module at ./core/pwa-manager.js
 */

import pwaManager from './core/pwa-manager.js';

// Re-export for backward compatibility
export default pwaManager;

// Make available globally
window.PWAManager = pwaManager.constructor;
window.pwaManager = pwaManager;
