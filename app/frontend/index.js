/**
 * Quick Chat Frontend - Modern ES6 Module Entry Point
 * Version: 4.0.0 - Organized Architecture (2025)
 * 
 * This is the main entry point for the reorganized Quick Chat frontend.
 * It implements a component-based architecture with proper separation of concerns.
 */

// Core application framework
import { App } from './services/App.js';
import { EventBus } from './services/EventBus.js';
import { ErrorHandler } from './services/ErrorHandler.js';

// State management
import { store } from './state/store.js';
import { chatStore } from './state/chatStore.js';
import { userStore } from './state/userStore.js';

// Services
import { apiClient } from './services/apiClient.js';
import { websocketManager } from './services/websocketManager.js';
import { themeManager } from './services/themeManager.js';
import { accessibilityManager } from './services/accessibilityManager.js';
import { i18nManager } from './services/i18nManager.js';

// Main Components
import { ChatWindow } from './components/ChatWindow.js';
import { Dashboard } from './components/Dashboard.js';
import { Profile } from './components/Profile.js';
import { AdminPanel } from './components/AdminPanel.js';

// UI Components
import { LoadingIndicator } from './components/ui/LoadingIndicator.js';
import { NotificationManager } from './components/ui/NotificationManager.js';
import { Modal } from './components/ui/Modal.js';

// Utils
import { getCurrentPage, getUrlParam } from './utils/helpers.js';
import { logger } from './utils/logger.js';

// Global runtime information
window.quickChatFrontend = {
  version: '4.0.0',
  architecture: 'organized-modular',
  initialized: false,
  currentPage: null,
  loadedComponents: [],
  services: {},
  config: null
};

/**
 * Main Application Class
 */
class QuickChatApp {
  constructor() {
    this.initialized = false;
    this.services = {};
    this.components = {};
    this.currentPage = null;
    
    // Initialize event bus
    this.eventBus = new EventBus();
    window.quickChatFrontend.eventBus = this.eventBus;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      logger.info('Initializing Quick Chat Frontend (Organized Architecture)');
      
      // Show loading indicator
      this.showLoadingIndicator();
      
      // Initialize core services
      await this.initCoreServices();
      
      // Determine current page
      this.currentPage = getCurrentPage();
      window.quickChatFrontend.currentPage = this.currentPage;
      
      // Initialize page-specific components
      await this.initPageComponents();
      
      // Initialize global UI components
      await this.initGlobalComponents();
      
      // Hide loading indicator
      this.hideLoadingIndicator();
      
      // Mark as initialized
      this.initialized = true;
      window.quickChatFrontend.initialized = true;
      
      // Emit initialization complete event
      this.eventBus.emit('app:initialized', {
        page: this.currentPage,
        timestamp: Date.now()
      });
      
      logger.info('Quick Chat Frontend initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Quick Chat Frontend:', error);
      this.handleInitializationError(error);
    }
  }

  /**
   * Initialize core services
   */
  async initCoreServices() {
    logger.info('Initializing core services...');
    
    try {
      // Initialize error handler first
      this.services.errorHandler = new ErrorHandler();
      await this.services.errorHandler.init();
      
      // Initialize stores
      await store.init();
      await chatStore.init();
      await userStore.init();
      
      // Initialize API client
      await apiClient.init();
      this.services.apiClient = apiClient;
      
      // Initialize WebSocket manager
      await websocketManager.init();
      this.services.websocketManager = websocketManager;
      
      // Initialize theme manager
      await themeManager.init();
      this.services.themeManager = themeManager;
      
      // Initialize accessibility manager
      await accessibilityManager.init();
      this.services.accessibilityManager = accessibilityManager;
      
      // Initialize internationalization
      await i18nManager.init();
      this.services.i18nManager = i18nManager;
      
      // Store services globally
      window.quickChatFrontend.services = this.services;
      
      logger.info('Core services initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize core services:', error);
      throw error;
    }
  }

  /**
   * Initialize page-specific components
   */
  async initPageComponents() {
    logger.info(`Initializing components for page: ${this.currentPage}`);
    
    try {
      switch (this.currentPage) {
        case 'chat':
        case 'private-chat':
        case 'group-chat':
          await this.initChatPage();
          break;
          
        case 'dashboard':
          await this.initDashboardPage();
          break;
          
        case 'profile':
          await this.initProfilePage();
          break;
          
        case 'admin':
          await this.initAdminPage();
          break;
          
        default:
          await this.initDefaultPage();
          break;
      }
      
    } catch (error) {
      logger.error(`Failed to initialize ${this.currentPage} page:`, error);
      throw error;
    }
  }

  /**
   * Initialize chat page
   */
  async initChatPage() {
    const config = {
      currentUserId: window.quickChatConfig?.userId,
      targetUserId: getUrlParam('user'),
      groupId: getUrlParam('group'),
      chatType: getUrlParam('group') ? 'group' : 'private'
    };
    
    this.components.chatWindow = new ChatWindow(config);
    await this.components.chatWindow.init();
    
    // Initialize WebRTC if enabled
    if (window.quickChatConfig?.features?.voiceCall || 
        window.quickChatConfig?.features?.videoCall) {
      const { WebRTCManager } = await import('./services/WebRTCManager.js');
      this.services.webrtc = new WebRTCManager();
      await this.services.webrtc.init(config);
    }
    
    window.quickChatFrontend.loadedComponents.push('ChatWindow', 'WebRTC');
  }

  /**
   * Initialize dashboard page
   */
  async initDashboardPage() {
    this.components.dashboard = new Dashboard();
    await this.components.dashboard.init();
    
    window.quickChatFrontend.loadedComponents.push('Dashboard');
  }

  /**
   * Initialize profile page
   */
  async initProfilePage() {
    this.components.profile = new Profile();
    await this.components.profile.init();
    
    window.quickChatFrontend.loadedComponents.push('Profile');
  }

  /**
   * Initialize admin page
   */
  async initAdminPage() {
    this.components.adminPanel = new AdminPanel();
    await this.components.adminPanel.init();
    
    window.quickChatFrontend.loadedComponents.push('AdminPanel');
  }

  /**
   * Initialize default page
   */
  async initDefaultPage() {
    logger.info('Initializing default page components');
    // Basic initialization for other pages
  }

  /**
   * Initialize global UI components
   */
  async initGlobalComponents() {
    // Initialize notification manager
    this.components.notificationManager = new NotificationManager();
    await this.components.notificationManager.init();
    
    // Initialize modal system
    this.components.modal = new Modal();
    await this.components.modal.init();
    
    window.quickChatFrontend.loadedComponents.push('NotificationManager', 'Modal');
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    const indicator = document.getElementById('page-loading-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    const indicator = document.getElementById('page-loading-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  /**
   * Handle initialization errors
   */
  handleInitializationError(error) {
    // Hide loading indicator
    this.hideLoadingIndicator();
    
    // Show error message to user
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div class="error-message">
          <h3>Failed to Initialize Application</h3>
          <p>There was an error loading Quick Chat. Please refresh the page or contact support.</p>
          <details>
            <summary>Technical Details</summary>
            <pre>${error.message}</pre>
          </details>
        </div>
      `;
      errorContainer.style.display = 'block';
    }
    
    // Emit error event
    this.eventBus.emit('app:error', { error });
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new QuickChatApp();
  window.quickChatFrontend.app = app;
  
  try {
    await app.init();
    
    // Dispatch ready event for backward compatibility
    document.dispatchEvent(new CustomEvent('quickchat:frontend:ready', {
      detail: {
        architecture: 'organized-modular',
        version: '4.0.0',
        page: app.currentPage,
        services: Object.keys(app.services),
        components: Object.keys(app.components)
      }
    }));
    
  } catch (error) {
    console.error('Critical error during application initialization:', error);
  }
});

// Export for direct imports if needed
export { QuickChatApp };
export default QuickChatApp;
