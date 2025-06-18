/**
 * QuickChat Application Entry Point
 * Main entry file that initializes the application
 */

import app from './core/app.js';
import ChatModule from './features/chat/index.js';
import errorHandler from './core/error-handler.js';
import utils from './core/utils.js';
import themeManager from './core/theme-manager.js';
import appState from './core/state.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Get config from the page if available
  const config = window.ChatConfig || {};
  
  // Initialize core application
  app.init(config)
    .then(() => {
      console.log('Application initialized');
      
      // Determine current page based on URL path
      const path = window.location.pathname;
      
      // Initialize page-specific modules
      if (path.includes('/chat.php') || path.includes('/private-chat.php')) {
        initializeChat('private');
      } else if (path.includes('/group-chat.php')) {
        initializeChat('group');
      } else if (path.includes('/admin.php')) {
        initializeAdmin();
      } else if (path.includes('/dashboard.php')) {
        initializeDashboard();
      } else if (path.includes('/profile.php')) {
        initializeProfile();
      }
    })
    .catch(error => {
      console.error('Failed to initialize application:', error);
      errorHandler.handleError(error);
    });
});

/**
 * Initialize chat module
 * @param {string} chatType - Type of chat ('private' or 'group')
 */
function initializeChat(chatType) {
  // Get chat configuration
  const config = {
    chatType,
    currentUserId: appState.getState('user')?.id,
    targetUserId: getQueryParam('user_id'),
    groupId: getQueryParam('group_id')
  };
  
  // Create and initialize chat module
  const chatModule = new ChatModule(config);
  
  // Register with app
  app.registerModule('chat', chatModule);
  
  // Initialize
  chatModule.init()
    .catch(error => {
      console.error('Failed to initialize chat:', error);
      errorHandler.handleError(error);
    });
}

/**
 * Initialize admin module
 */
function initializeAdmin() {
  import('./features/admin/index.js')
    .then(module => {
      const AdminModule = module.default;
      const adminModule = new AdminModule();
      
      // Register with app
      app.registerModule('admin', adminModule);
      
      // Initialize
      adminModule.init();
    })
    .catch(error => {
      console.error('Failed to load admin module:', error);
      errorHandler.handleError(error);
    });
}

/**
 * Initialize dashboard module
 */
function initializeDashboard() {
  import('./features/dashboard/index.js')
    .then(module => {
      const DashboardModule = module.default;
      const dashboardModule = new DashboardModule();
      
      // Register with app
      app.registerModule('dashboard', dashboardModule);
      
      // Initialize
      dashboardModule.init();
    })
    .catch(error => {
      console.error('Failed to load dashboard module:', error);
      errorHandler.handleError(error);
    });
}

/**
 * Initialize profile module
 */
function initializeProfile() {
  import('./features/profile/index.js')
    .then(module => {
      const ProfileModule = module.default;
      const profileModule = new ProfileModule();
      
      // Register with app
      app.registerModule('profile', profileModule);
      
      // Initialize
      profileModule.init();
    })
    .catch(error => {
      console.error('Failed to load profile module:', error);
      errorHandler.handleError(error);
    });
}

/**
 * Get query parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value
 */
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Make core utilities available globally for backward compatibility
window.QuickChat = {
  utils,
  errorHandler,
  themeManager,
  app
};
