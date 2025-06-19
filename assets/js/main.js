/**
 * Main Entry Point for Quick Chat Application
 * 
 * This file is the entry point for the modular JavaScript architecture.
 * It imports and initializes all necessary modules for the chat application.
 * Version: 3.0.0 (matches module-loader.js version requirement)
 */

// Expose runtime information for compatibility checks
window.quickChatRuntime = {
  moduleType: 'esmodule',
  version: '3.0.0',
  initialized: false,
  features: {},
  loadedModules: [],
  loadTimes: {}
};

// Core module imports
import app from './core/app.js';
import state from './core/state.js';
import eventBus from './core/event-bus.js';
import errorHandler from './core/error-handler.js';
import themeManager from './core/theme-manager.js';
import browserCompatibility from './core/browser-compatibility.js';
import security from './core/security.js';
import pwaManager from './core/pwa-manager.js';
import logger from './core/logger.js';

// UI component imports
import AccessibilityManager from './ui/accessibility.js';
import UploadProgressManager from './ui/upload-progress.js';
import NotificationManager from './ui/notification-manager.js';

// Service imports
import apiClient from './services/api-client.js';
import storageService from './services/storage-service.js';
import analyticsService from './services/analytics-service.js';

// Import compatibility layer
import { initChatCompatibility } from './core/chat-compatibility.js';

// Determine current page type for dynamic imports
const currentPage = document.body.dataset.pageType || '';

/**
 * Initialize the application
 */
async function initApplication() {
  console.log('Initializing Quick Chat application');
  
  try {
    // Check for compatibility issues
    browserCompatibility.checkRequirements();
    
    // Initialize core modules
    app.init();
    errorHandler.init();
    themeManager.init();
    
    // Initialize PWA features if supported
    if ('serviceWorker' in navigator) {
      pwaManager.init();
    }
    
    // Determine which page we're on
    const currentPage = getCurrentPage();
    window.quickChatRuntime.pageType = currentPage;
    
    // Track module loading in runtime
    window.quickChatRuntime.loadedModules.push('core');
    
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
  } catch (error) {
    console.error('Failed to initialize application:', error);
    errorHandler.handleError(error);
  }
}

/**
 * Initialize Chat Page
 */
async function initChatPage() {
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Get chat configuration
    const config = {
      currentUserId: window.quickChatConfig?.userId,
      targetUserId: getUrlParam('user'),
      groupId: getUrlParam('group'),
      chatType: getUrlParam('group') ? 'group' : 'private'
    };
    
    // Track page initialization in runtime
    window.quickChatRuntime.pageConfig = config;
    
    // Import chat module dynamically
    const [
      { default: chatModule },
      { createVirtualScroll },
      { createMentions }
    ] = await Promise.all([
      import(/* webpackChunkName: "chat-core" */ './features/chat/index.js'),
      import(/* webpackChunkName: "virtual-scroll" */ './ui/virtual-scroll.js'),
      import(/* webpackChunkName: "chat-mentions" */ './features/chat/mentions.js')
    ]);
    
    // Set up virtual scrolling for messages if container exists
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      const virtualScroll = createVirtualScroll('messages-container', {
        pageSize: 30
      });
      // Store in global state for access by chat module
      state.set('virtualScroll', virtualScroll);
    }
    
    // Initialize chat module
    await chatModule.init(config);
    
    // Initialize WebRTC if enabled
    if (window.quickChatConfig?.features?.voiceCall || 
        window.quickChatConfig?.features?.videoCall) {
      const { default: webrtcModule } = await import(
        /* webpackChunkName: "webrtc" */ 
        './features/webrtc/index.js'
      );
      
      await webrtcModule.init({
        userId: window.quickChatConfig?.userId,
        username: window.quickChatConfig?.username
      });
    }
    
    // Initialize mentions functionality if needed
    if (config.chatType === 'group' && window.quickChatConfig?.features?.mentions) {
      const mentions = createMentions(chatModule);
      state.set('mentions', mentions);
    }
    
    // Initialize emoji picker if enabled
    if (window.quickChatConfig?.features?.emojiPicker) {
      const { initEmojiPicker } = await import(
        /* webpackChunkName: "emoji-picker" */ 
        './features/chat/emoji-picker.js'
      );
      initEmojiPicker();
    }
    
    // Initialize file upload if enabled
    if (window.quickChatConfig?.features?.fileUpload) {
      const { initFileUploader } = await import(
        /* webpackChunkName: "file-uploader" */ 
        './features/chat/file-uploader.js'
      );
      initFileUploader();
    }
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    console.log('Chat page initialized');
  } catch (error) {
    console.error('Failed to initialize chat page:', error);
    errorHandler.handleError(error);
    
    // Hide loading indicator on error
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/**
 * Initialize Dashboard Page
 */
async function initDashboardPage() {
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Import dashboard module dynamically
    const { default: dashboardModule } = await import(
      /* webpackChunkName: "dashboard-core" */ 
      './features/dashboard/index.js'
    );
    
    // Initialize dashboard module
    await dashboardModule.init();
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    console.log('Dashboard page initialized');
  } catch (error) {
    console.error('Failed to initialize dashboard page:', error);
    errorHandler.handleError(error);
    
    // Hide loading indicator on error
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/**
 * Initialize Profile Page
 */
async function initProfilePage() {
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Import profile modules dynamically
    const profileFeatures = await Promise.all([
      import(/* webpackChunkName: "profile-core" */ './features/profile/index.js'),
      import(/* webpackChunkName: "profile-settings" */ './features/profile/settings.js'),
      import(/* webpackChunkName: "profile-avatar" */ './features/profile/avatar.js'),
      import(/* webpackChunkName: "profile-info" */ './features/profile/info.js'),
      import(/* webpackChunkName: "profile-privacy" */ './features/profile/privacy.js')
    ]);
    
    // Initialize profile module
    const profileModule = profileFeatures[0].default;
    await profileModule.init();
    
    // Register the profile page initialization
    window.quickChatRuntime.features.profilePage = true;
    
    // Dispatch event indicating profile page is ready
    document.dispatchEvent(new CustomEvent('quickchat:profile:ready'));
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    console.log('Profile page initialized successfully');
    return true;
    
    // Initialize avatar upload if that feature is enabled
    if (window.quickChatConfig?.features?.avatarUpload) {
      const { initAvatarUpload } = await import(
        /* webpackChunkName: "avatar-upload" */ 
        './features/profile/avatar-upload.js'
      );
      initAvatarUpload();
    }
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    console.log('Profile page initialized');
  } catch (error) {
    console.error('Failed to initialize profile page:', error);
    errorHandler.handleError(error);
    
    // Hide loading indicator on error
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
  }
}

/**
 * Initialize Admin Page
 */
async function initAdminPage() {
  try {
    // Show loading indicator
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Import admin modules dynamically
    const [
      { default: adminModule },
      { default: configManager }
    ] = await Promise.all([
      import(/* webpackChunkName: "admin-core" */ './features/admin/index.js'),
      import(/* webpackChunkName: "admin-config" */ './features/admin/config-manager.js')
    ]);
    
    // Initialize admin module
    await adminModule.init();
    
    // Initialize configuration manager
    await configManager.init();
    
    // Load additional admin modules based on active section
    const activeSection = getUrlParam('section') || 'dashboard';
    
    switch (activeSection) {
      case 'users':
        const { default: userManager } = await import(
          /* webpackChunkName: "admin-users" */ 
          './features/admin/user-manager.js'
        );
        await userManager.init();
        break;
      
      case 'logs':
        const { default: logViewer } = await import(
          /* webpackChunkName: "admin-logs" */ 
          './features/admin/log-viewer.js'
        );
        await logViewer.init();
        break;
      
      case 'system':
        const { default: systemInfo } = await import(
          /* webpackChunkName: "admin-system" */ 
          './features/admin/system-info.js'
        );
        await systemInfo.init();
        break;
    }
    
    // Hide loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    
    console.log('Admin page initialized');
  } catch (error) {
    console.error('Failed to initialize admin page:', error);
    errorHandler.handleError(error);
    
    // Hide loading indicator on error
    const loadingIndicator = document.getElementById('page-loading-indicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
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
 * @param {string} name - The parameter name to get
 * @returns {string|null} The parameter value or null if not found
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Start initialization
  initApplication()
    .then(() => {
      // Mark as initialized
      window.quickChatRuntime.initialized = true;
      
      // Dispatch event for module loader to know we're fully loaded
      document.dispatchEvent(new CustomEvent('quickchat:ready', {
        detail: { 
          moduleType: 'esmodule',
          version: window.quickChatRuntime.version,
          pageType: window.quickChatRuntime.pageType,
          modules: window.quickChatRuntime.loadedModules
        }
      }));
      
      console.log('Quick Chat application fully initialized');
    })
    .catch(error => {
      console.error('Fatal error during application initialization:', error);
      errorHandler.handleError(error);
      
      // Dispatch error event that can be caught by the module-loader
      document.dispatchEvent(new CustomEvent('quickchat:error', {
        detail: { 
          error: error.message || 'Unknown error',
          moduleType: 'esmodule'
        }
      }));
    });
});

// Export for potential direct imports
export default {
  init: initApplication,
  runtime: window.quickChatRuntime
};
