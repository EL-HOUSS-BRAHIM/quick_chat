/**
 * Main Entry Point for Quick Chat Application
 * 
 * This file is the entry point for the modular JavaScript architecture.
 * It imports and initializes all necessary modules for the chat application.
 */

// Import core modules
import app from './core/app.js';
import state from './core/state.js';
import eventBus from './core/event-bus.js';
import errorHandler from './core/error-handler.js';
import themeManager from './core/theme-manager.js';
import browserCompatibility from './core/browser-compatibility.js';

// Import UI components
import AccessibilityManager from './ui/accessibility.js';
import UploadProgressManager from './ui/upload-progress.js';

// Import API client
import apiClient from './api/api-client.js';

// Import feature modules
import chatModule from './features/chat/index.js';
import dashboardModule from './features/dashboard/index.js';
import profileModule from './features/profile/index.js';
import webrtcModule from './features/webrtc/index.js';
import adminModule from './features/admin/index.js';

// Import compatibility layer
import { initChatCompatibility } from './core/chat-compatibility.js';

/**
 * Initialize the application
 */
async function initApplication() {
  console.log('Initializing Quick Chat application');
  
  // Initialize core modules
  app.init();
  errorHandler.init();
  themeManager.init();
  
  // Determine which page we're on
  const currentPage = getCurrentPage();
  
  // Initialize modules based on current page
  switch (currentPage) {
    case 'chat':
      await initChatPage();
      break;
    case 'dashboard':
      await initDashboardPage();
      break;
    case 'profile':
      await initProfilePage();
      break;
    case 'admin':
      await initAdminPage();
      break;
    default:
      // Default initialization
      app.init();
  }
  
  // Initialize compatibility layer for backward compatibility
  initChatCompatibility();
  
  console.log('Application initialization complete');
}

/**
 * Initialize Chat Page
 */
async function initChatPage() {
  try {
    // Get chat configuration
    const config = {
      currentUserId: window.quickChatConfig?.userId,
      targetUserId: getUrlParam('user'),
      groupId: getUrlParam('group'),
      chatType: getUrlParam('group') ? 'group' : 'private'
    };
    
    // Initialize chat module
    await chatModule.init(config);
    
    // Initialize WebRTC if enabled
    if (window.quickChatConfig?.features?.voiceCall || 
        window.quickChatConfig?.features?.videoCall) {
      await webrtcModule.init({
        userId: window.quickChatConfig?.userId,
        username: window.quickChatConfig?.username
      });
    }
    
    console.log('Chat page initialized');
  } catch (error) {
    console.error('Failed to initialize chat page:', error);
    errorHandler.handleError(error);
  }
}

/**
 * Initialize Dashboard Page
 */
async function initDashboardPage() {
  try {
    await dashboardModule.init();
    console.log('Dashboard page initialized');
  } catch (error) {
    console.error('Failed to initialize dashboard page:', error);
    errorHandler.handleError(error);
  }
}

/**
 * Initialize Profile Page
 */
async function initProfilePage() {
  try {
    await profileModule.init({
      userId: window.quickChatConfig?.userId
    });
    console.log('Profile page initialized');
  } catch (error) {
    console.error('Failed to initialize profile page:', error);
    errorHandler.handleError(error);
  }
}

/**
 * Initialize Admin Page
 */
async function initAdminPage() {
  try {
    await adminModule.init();
    console.log('Admin page initialized');
  } catch (error) {
    console.error('Failed to initialize admin page:', error);
    errorHandler.handleError(error);
  }
}

/**
 * Get current page name from URL
 * @returns {string} Current page name
 */
function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1);
  
  if (filename.includes('chat')) {
    return 'chat';
  } else if (filename.includes('dashboard')) {
    return 'dashboard';
  } else if (filename.includes('profile')) {
    return 'profile';
  } else if (filename.includes('admin')) {
    return 'admin';
  }
  
  return 'other';
}

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApplication);
} else {
  // DOM already loaded
  initApplication();
}

// Export for potential direct imports
export default {
  init: initApplication
};
