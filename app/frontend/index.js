/**
 * Quick Chat Frontend - Enhanced Organized Architecture Entry Point
 * Version: 5.0.0 - Complete Frontend Reorganization (2025)
 * 
 * This is the main entry point for the fully reorganized Quick Chat frontend.
 * Implements enterprise-grade component architecture with comprehensive features.
 */

// Core application framework
import { App } from './services/App.js';
import { EventBus } from './services/EventBus.js';
import { ErrorHandler } from './services/ErrorHandler.js';

// Enhanced state management
import { appStore } from './state/appStore.js';
import { chatStore } from './state/chatStore.js';
import { userStore } from './state/userStore.js';
import { callStore } from './state/callStore.js';
import { notificationStore } from './state/notificationStore.js';
import { uiStore } from './state/uiStore.js';

// Core services
import { apiClient } from './services/apiClient.js';
import { websocketManager } from './services/websocketManager.js';
import { themeManager } from './services/themeManager.js';
import { accessibilityManager } from './services/accessibilityManager.js';
import { i18nManager } from './services/i18nManager.js';

// Enhanced services
import { networkManager } from './services/networkManager.js';
import { WebRTCManager } from './services/WebRTCManager.js';
import { E2EEncryptionService } from './services/E2EEncryptionService.js';
import { GroupVideoCallManager } from './services/GroupVideoCallManager.js';
import { CallRecordingManager } from './services/CallRecordingManager.js';

// Main Components
import { ChatWindow } from './components/ChatWindow.js';
import { Dashboard } from './components/Dashboard.js';
import { Profile } from './components/Profile.js';
import { AdminPanel } from './components/AdminPanel.js';
import { MessageList } from './components/MessageList.js';
import { MessageInput } from './components/MessageInput.js';
import { Sidebar } from './components/Sidebar.js';

// Enhanced UI Components
import { LoadingIndicator } from './components/ui/LoadingIndicator.js';
import { NotificationManager } from './components/ui/NotificationManager.js';
import { Modal } from './components/ui/Modal.js';
import { ProgressIndicator } from './components/ui/ProgressIndicator.js';
import { Toast, toastManager } from './components/ui/Toast.js';

// Advanced components
import { GroupTaskManager } from './components/GroupTaskManager.js';
import { GroupEventScheduler } from './components/GroupEventScheduler.js';

// Utils and configuration
import { getCurrentPage, getUrlParam } from './utils/helpers.js';
import { logger } from './utils/logger.js';
import { configManager } from './utils/configManager.js';
import { performanceMonitor } from './utils/performanceMonitor.js';
import * as constants from './utils/constants.js';

// Global runtime information - Enhanced
window.quickChatFrontend = {
  version: '5.0.0',
  architecture: 'enterprise-organized-modular',
  buildDate: new Date().toISOString(),
  initialized: false,
  initializing: false,
  currentPage: null,
  loadedComponents: new Set(),
  services: new Map(),
  stores: new Map(),
  config: null,
  performance: {
    initStart: performance.now(),
    initEnd: null,
    loadTime: null
  },
  features: {
    e2eEncryption: true,
    groupVideoCall: true,
    callRecording: true,
    taskManagement: true,
    eventScheduling: true,
    networkOptimization: true,
    performanceMonitoring: true,
    accessibilityFull: true,
    internationalization: true
  }
};

/**
 * Enhanced Main Application Class - Enterprise Architecture
 */
class QuickChatApp {
  constructor() {
    this.initialized = false;
    this.initializing = false;
    this.services = new Map();
    this.stores = new Map();
    this.components = new Map();
    this.eventBus = new EventBus();
    this.errorHandler = new ErrorHandler();
    this.startTime = performance.now();
    
    // Bind methods
    this.handleError = this.handleError.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    
    // Update global reference
    window.quickChatFrontend.app = this;
  }

  /**
   * Initialize the application with comprehensive setup
   */
  async init() {
    if (this.initializing || this.initialized) {
      logger.warn('Application already initialized or initializing');
      return;
    }

    this.initializing = true;
    window.quickChatFrontend.initializing = true;

    try {
      logger.info('🚀 Initializing Quick Chat Frontend v5.0.0...');
      
      // Phase 1: Core Configuration and Error Handling
      await this.initializeCore();
      
      // Phase 2: Enhanced Services
      await this.initializeServices();
      
      // Phase 3: State Management
      await this.initializeStores();
      
      // Phase 4: UI Components and Page Setup
      await this.initializeUI();
      
      // Phase 5: Event Handlers and Finalizing
      await this.finalizeInitialization();
      
      // Mark as initialized
      this.initialized = true;
      this.initializing = false;
      window.quickChatFrontend.initialized = true;
      window.quickChatFrontend.initializing = false;
      window.quickChatFrontend.performance.initEnd = performance.now();
      window.quickChatFrontend.performance.loadTime = 
        window.quickChatFrontend.performance.initEnd - window.quickChatFrontend.performance.initStart;

      logger.info(`✅ Quick Chat Frontend initialized successfully in ${window.quickChatFrontend.performance.loadTime.toFixed(2)}ms`);
      
      // Emit initialized event
      this.eventBus.emit('app:initialized', {
        version: window.quickChatFrontend.version,
        loadTime: window.quickChatFrontend.performance.loadTime,
        features: window.quickChatFrontend.features
      });

    } catch (error) {
      this.initializing = false;
      window.quickChatFrontend.initializing = false;
      logger.error('❌ Failed to initialize Quick Chat Frontend:', error);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Phase 1: Initialize core configuration and error handling
   */
  async initializeCore() {
    logger.info('📋 Phase 1: Initializing core configuration...');
    
    // Setup global error handling
    this.setupGlobalErrorHandling();
    
    // Initialize configuration manager
    await configManager.init();
    this.services.set('config', configManager);
    window.quickChatFrontend.config = configManager.getAll();
    
    // Initialize performance monitoring
    await performanceMonitor.init();
    this.services.set('performance', performanceMonitor);
    
    // Initialize error handler
    await this.errorHandler.init();
    this.services.set('errorHandler', this.errorHandler);
    
    logger.info('✅ Core configuration initialized');
  }

  /**
   * Phase 2: Initialize enhanced services
   */
  async initializeServices() {
    logger.info('🔧 Phase 2: Initializing enhanced services...');
    
    // Core services
    await apiClient.init();
    this.services.set('api', apiClient);
    
    await websocketManager.init();
    this.services.set('websocket', websocketManager);
    
    await networkManager.init();
    this.services.set('network', networkManager);
    
    // UI services
    await themeManager.init();
    this.services.set('theme', themeManager);
    
    await accessibilityManager.init();
    this.services.set('accessibility', accessibilityManager);
    
    await i18nManager.init();
    this.services.set('i18n', i18nManager);
    
    // Advanced services (conditional initialization based on feature flags)
    if (configManager.isFeatureEnabled('E2E_ENCRYPTION')) {
      const e2eService = new E2EEncryptionService();
      await e2eService.init();
      this.services.set('e2e', e2eService);
    }
    
    if (configManager.isFeatureEnabled('GROUP_VIDEO_CALLS')) {
      const webrtcManager = new WebRTCManager();
      await webrtcManager.init();
      this.services.set('webrtc', webrtcManager);
      
      const groupVideoManager = new GroupVideoCallManager();
      await groupVideoManager.init();
      this.services.set('groupVideo', groupVideoManager);
    }
    
    if (configManager.isFeatureEnabled('CALL_RECORDING')) {
      const callRecordingManager = new CallRecordingManager();
      await callRecordingManager.init();
      this.services.set('callRecording', callRecordingManager);
    }
    
    // Update global services reference
    window.quickChatFrontend.services = this.services;
    
    logger.info('✅ Enhanced services initialized');
  }

  /**
   * Phase 3: Initialize state management
   */
  async initializeStores() {
    logger.info('🗃️ Phase 3: Initializing state management...');
    
    // Initialize application store (coordinates other stores)
    await appStore.init();
    this.stores.set('app', appStore);
    
    // Individual stores are initialized by appStore
    this.stores.set('chat', chatStore);
    this.stores.set('user', userStore);
    this.stores.set('call', callStore);
    this.stores.set('notification', notificationStore);
    this.stores.set('ui', uiStore);
    
    // Update global stores reference
    window.quickChatFrontend.stores = this.stores;
    
    logger.info('✅ State management initialized');
  }

  /**
   * Phase 4: Initialize UI components and page setup
   */
  async initializeUI() {
    logger.info('🎨 Phase 4: Initializing UI and page setup...');
    
    // Initialize toast manager
    window.quickChatFrontend.toast = toastManager;
    
    // Get current page and initialize appropriate components
    const currentPage = getCurrentPage();
    window.quickChatFrontend.currentPage = currentPage;
    
    // Initialize page-specific components
    await this.initializePageComponents(currentPage);
    
    logger.info('✅ UI and page components initialized');
  }

  /**
   * Phase 5: Finalize initialization
   */
  async finalizeInitialization() {
    logger.info('🔗 Phase 5: Finalizing initialization...');
    
    // Setup global event listeners
    this.setupEventListeners();
    
    // Setup cross-service communication
    this.setupServiceCommunication();
    
    // Start background tasks
    this.startBackgroundTasks();
    
    // Show ready notification (if user is authenticated)
    if (userStore.isAuthenticated()) {
      toastManager.success('Quick Chat is ready!', {
        timeout: 3000,
        showIcon: true
      });
    }
    
    logger.info('✅ Application finalization complete');
  }
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

  /**
   * Initialize page-specific components based on current page
   */
  async initializePageComponents(page) {
    const startMark = performanceMonitor.startComponentMeasure(`page-${page}`);
    
    try {
      switch (page) {
        case 'chat':
        case 'private-chat':
        case 'group-chat':
          await this.initializeChatPage();
          break;
        case 'dashboard':
          await this.initializeDashboardPage();
          break;
        case 'profile':
          await this.initializeProfilePage();
          break;
        case 'admin':
          await this.initializeAdminPage();
          break;
        default:
          logger.info(`No specific initialization for page: ${page}`);
      }
      
      window.quickChatFrontend.loadedComponents.add(`page-${page}`);
      
    } catch (error) {
      logger.error(`Failed to initialize page components for ${page}:`, error);
      throw error;
    } finally {
      performanceMonitor.endComponentMeasure(`page-${page}`, startMark);
    }
  }

  /**
   * Initialize chat page components
   */
  async initializeChatPage() {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) {
      logger.warn('Chat container not found on chat page');
      return;
    }

    // Get chat parameters
    const chatId = getUrlParam('id');
    const chatType = getUrlParam('type') || 'private';
    const currentUserId = userStore.getCurrentUserId();

    if (!currentUserId) {
      logger.error('User not authenticated for chat page');
      return;
    }

    // Initialize chat window
    const chatWindow = new ChatWindow({
      container: chatContainer,
      chatType,
      targetUserId: chatType === 'private' ? chatId : null,
      groupId: chatType === 'group' ? chatId : null,
      currentUserId
    });

    await chatWindow.init();
    this.components.set('chatWindow', chatWindow);
    
    logger.info('Chat page components initialized');
  }

  /**
   * Initialize dashboard page components
   */
  async initializeDashboardPage() {
    const dashboardContainer = document.getElementById('dashboard-container');
    if (!dashboardContainer) {
      logger.warn('Dashboard container not found');
      return;
    }

    const dashboard = new Dashboard({
      container: dashboardContainer,
      currentUserId: userStore.getCurrentUserId()
    });

    await dashboard.init();
    this.components.set('dashboard', dashboard);
    
    logger.info('Dashboard components initialized');
  }

  /**
   * Initialize profile page components
   */
  async initializeProfilePage() {
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) {
      logger.warn('Profile container not found');
      return;
    }

    const profile = new Profile({
      container: profileContainer,
      userId: getUrlParam('id') || userStore.getCurrentUserId()
    });

    await profile.init();
    this.components.set('profile', profile);
    
    logger.info('Profile components initialized');
  }

  /**
   * Initialize admin page components
   */
  async initializeAdminPage() {
    const adminContainer = document.getElementById('admin-container');
    if (!adminContainer) {
      logger.warn('Admin container not found');
      return;
    }

    // Check admin permissions
    if (!userStore.hasRole('admin')) {
      toastManager.error('Access denied: Admin privileges required');
      window.location.href = '/dashboard.php';
      return;
    }

    const adminPanel = new AdminPanel({
      container: adminContainer
    });

    await adminPanel.init();
    this.components.set('adminPanel', adminPanel);
    
    logger.info('Admin components initialized');
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    // Uncaught errors
    window.addEventListener('error', this.handleError);
    
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason);
      event.preventDefault();
    });

    // Before unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // Visibility change
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Network status changes
    networkManager.on('network:quality:changed', (data) => {
      this.handleNetworkQualityChange(data);
    });

    // Store events
    appStore.subscribe('app:user:authenticated', (user) => {
      logger.info('User authenticated:', user.username);
      toastManager.success(`Welcome back, ${user.displayName}!`);
    });

    appStore.subscribe('app:user:logout', () => {
      logger.info('User logged out');
      this.handleUserLogout();
    });

    // Theme changes
    themeManager.on('theme:changed', (theme) => {
      logger.info('Theme changed to:', theme);
    });

    // Notification events
    notificationStore.eventBus.on('notification:show', (notification) => {
      // Show in-app toast for notifications
      if (notification.type === 'message') {
        toastManager.info(notification.body, {
          title: notification.title,
          timeout: 4000,
          onClick: () => {
            notificationStore.handleNotificationClick(notification);
          }
        });
      }
    });
  }

  /**
   * Setup cross-service communication
   */
  setupServiceCommunication() {
    // WebSocket to notification bridge
    websocketManager.on('message:received', (message) => {
      notificationStore.addNotification({
        type: 'message',
        title: `New message from ${message.senderName}`,
        body: message.content,
        data: { messageId: message.id, chatId: message.chatId }
      });
    });

    // Network quality to service optimization
    networkManager.on('network:quality:changed', (data) => {
      const recommendations = networkManager.getRecommendedSettings();
      
      // Apply recommendations to services
      if (this.services.has('webrtc')) {
        this.services.get('webrtc').updateQualitySettings(recommendations);
      }
    });

    // Error handler to notification bridge
    this.errorHandler.on('error:critical', (error) => {
      toastManager.error('A critical error occurred. Please refresh the page.', {
        persistent: true,
        actions: [{
          label: 'Refresh',
          handler: () => window.location.reload(),
          primary: true
        }]
      });
    });
  }

  /**
   * Start background tasks
   */
  startBackgroundTasks() {
    // Periodic health checks
    setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    // Cleanup tasks
    setInterval(() => {
      this.performCleanup();
    }, 300000); // Every 5 minutes
  }

  /**
   * Handle network quality changes
   */
  handleNetworkQualityChange(data) {
    const { quality, previousQuality } = data;
    
    if (quality === 'poor' && previousQuality !== 'poor') {
      toastManager.warning('Poor network connection detected. Some features may be limited.', {
        timeout: 5000
      });
    } else if (quality === 'good' && previousQuality === 'poor') {
      toastManager.success('Network connection improved!', {
        timeout: 3000
      });
    }
  }

  /**
   * Handle user logout
   */
  handleUserLogout() {
    // Clear sensitive data
    this.stores.forEach(store => {
      if (typeof store.clear === 'function') {
        store.clear();
      }
    });

    // Redirect to login
    setTimeout(() => {
      window.location.href = '/auth.php';
    }, 1000);
  }

  /**
   * Handle global errors
   */
  handleError(error) {
    logger.error('Global error:', error);
    
    // Report to error handler
    if (this.errorHandler) {
      this.errorHandler.handleError(error);
    }
  }

  /**
   * Handle before unload event
   */
  handleBeforeUnload(event) {
    // Clean up active connections
    if (this.services.has('websocket')) {
      this.services.get('websocket').disconnect();
    }
    
    if (this.services.has('webrtc')) {
      this.services.get('webrtc').cleanup();
    }
  }

  /**
   * Handle visibility change event
   */
  handleVisibilityChange() {
    const isVisible = !document.hidden;
    
    if (isVisible) {
      // Resume real-time features
      if (this.services.has('websocket')) {
        this.services.get('websocket').resume();
      }
    } else {
      // Pause non-essential background tasks
      if (this.services.has('websocket')) {
        this.services.get('websocket').pause();
      }
    }
  }

  /**
   * Perform periodic health check
   */
  performHealthCheck() {
    const health = {
      timestamp: Date.now(),
      services: {},
      stores: {},
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize
      } : null
    };

    // Check service health
    this.services.forEach((service, name) => {
      health.services[name] = {
        initialized: service.initialized || true,
        status: typeof service.getStatus === 'function' ? service.getStatus() : 'ok'
      };
    });

    // Check store health
    this.stores.forEach((store, name) => {
      health.stores[name] = {
        initialized: store.initialized || true,
        status: 'ok'
      };
    });

    // Log health status
    logger.debug('Health check:', health);

    // Emit health event
    this.eventBus.emit('app:health:check', health);
  }

  /**
   * Perform cleanup tasks
   */
  performCleanup() {
    // Clear old performance metrics
    if (performanceMonitor) {
      const metricsCount = Object.keys(performanceMonitor.getMetrics()).length;
      if (metricsCount > 1000) {
        performanceMonitor.clearMetrics();
        logger.info('Performance metrics cleared');
      }
    }

    // Clean up old error logs
    if (this.errorHandler) {
      this.errorHandler.cleanup();
    }
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      version: window.quickChatFrontend.version,
      initialized: this.initialized,
      loadTime: window.quickChatFrontend.performance.loadTime,
      currentPage: window.quickChatFrontend.currentPage,
      services: Array.from(this.services.keys()),
      stores: Array.from(this.stores.keys()),
      components: Array.from(this.components.keys()),
      loadedComponents: Array.from(window.quickChatFrontend.loadedComponents),
      features: window.quickChatFrontend.features
    };
  }

  /**
   * Get service by name
   */
  getService(name) {
    return this.services.get(name);
  }

  /**
   * Get store by name
   */
  getStore(name) {
    return this.stores.get(name);
  }

  /**
   * Get component by name
   */
  getComponent(name) {
    return this.components.get(name);
  }

  /**
   * Destroy application
   */
  async destroy() {
    logger.info('Destroying Quick Chat Application...');

    // Destroy components
    for (const [name, component] of this.components.entries()) {
      try {
        if (typeof component.destroy === 'function') {
          await component.destroy();
        }
      } catch (error) {
        logger.error(`Failed to destroy component ${name}:`, error);
      }
    }

    // Destroy stores
    for (const [name, store] of this.stores.entries()) {
      try {
        if (typeof store.destroy === 'function') {
          await store.destroy();
        }
      } catch (error) {
        logger.error(`Failed to destroy store ${name}:`, error);
      }
    }

    // Destroy services
    for (const [name, service] of this.services.entries()) {
      try {
        if (typeof service.destroy === 'function') {
          await service.destroy();
        }
      } catch (error) {
        logger.error(`Failed to destroy service ${name}:`, error);
      }
    }

    // Clear collections
    this.components.clear();
    this.stores.clear();
    this.services.clear();
    
    // Remove event listeners
    this.eventBus.removeAllListeners();
    
    // Reset state
    this.initialized = false;
    window.quickChatFrontend.initialized = false;
    
    logger.info('Quick Chat Application destroyed');
  }
}

/**
 * Application instance and initialization
 */
let app = null;

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    if (app) {
      logger.warn('Application already exists');
      return app;
    }

    app = new QuickChatApp();
    await app.init();
    
    // Make app globally available for debugging
    if (configManager.isDevelopment()) {
      window.quickChatApp = app;
    }
    
    return app;
    
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    
    // Show critical error to user
    const errorMsg = document.createElement('div');
    errorMsg.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #f44336;
        color: white;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        z-index: 10000;
        max-width: 400px;
      ">
        <h3>Application Error</h3>
        <p>Failed to initialize Quick Chat. Please refresh the page.</p>
        <button onclick="window.location.reload()" style="
          background: white;
          color: #f44336;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        ">Refresh Page</button>
      </div>
    `;
    document.body.appendChild(errorMsg);
    
    throw error;
  }
}

/**
 * DOM Content Loaded Handler
 */
document.addEventListener('DOMContentLoaded', () => {
  logger.info('DOM Content Loaded - Starting Quick Chat Frontend...');
  
  // Initialize application
  initializeApp().catch(error => {
    logger.error('Critical application initialization failure:', error);
  });
});

/**
 * Export for module usage
 */
export { QuickChatApp, initializeApp };
export default { QuickChatApp, initializeApp, app: () => app };
