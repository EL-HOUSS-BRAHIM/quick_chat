/**
 * UI Store - User Interface State Management
 * 
 * Manages global UI state including themes, modals, notifications,
 * loading states, and general UI preferences.
 */

import { EventBus } from '../services/EventBus.js';

class UIStore {
  constructor() {
    this.eventBus = new EventBus();
    this.state = {
      // Theme and appearance
      theme: 'auto', // 'light', 'dark', 'auto'
      actualTheme: 'light', // resolved theme after auto-detection
      isHighContrast: false,
      fontSize: 'medium', // 'small', 'medium', 'large', 'extra-large'
      
      // Layout and navigation
      sidebarOpen: true,
      sidebarWidth: 300,
      mainPanelWidth: null,
      rightPanelOpen: false,
      rightPanelWidth: 350,
      
      // Modal and dialog state
      activeModals: new Map(),
      modalStack: [],
      
      // Loading states
      globalLoading: false,
      loadingStates: new Map(),
      
      // Notifications and alerts
      notifications: new Map(),
      notificationQueue: [],
      maxNotifications: 5,
      
      // UI preferences
      showAvatars: true,
      showTimestamps: true,
      compactMode: false,
      animationsEnabled: true,
      soundEnabled: true,
      
      // Accessibility
      screenReaderEnabled: false,
      keyboardNavigationMode: false,
      focusRingVisible: false,
      reducedMotion: false,
      
      // Chat UI specific
      messageInputHeight: 60,
      emojiPickerOpen: false,
      fileUploadPanelOpen: false,
      searchPanelOpen: false,
      
      // Mobile and responsive
      isMobile: false,
      isTablet: false,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      
      // Performance
      virtualScrollEnabled: true,
      maxVisibleMessages: 50,
      imagePreloadEnabled: true,
      
      // Debug and development
      debugMode: false,
      showPerformanceMetrics: false,
      
      // Error states
      hasError: false,
      errorMessage: null,
      errorDetails: null
    };
    
    this.listeners = new Set();
    this.initializeEventListeners();
    this.detectInitialState();
  }
  
  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Theme and system preference changes
    this.eventBus.on('theme:change', this.handleThemeChange.bind(this));
    this.eventBus.on('system:theme-changed', this.handleSystemThemeChange.bind(this));
    
    // Window and viewport changes
    window.addEventListener('resize', this.handleWindowResize.bind(this));
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    
    // Accessibility events
    this.eventBus.on('accessibility:enabled', this.handleAccessibilityEnabled.bind(this));
    this.eventBus.on('accessibility:disabled', this.handleAccessibilityDisabled.bind(this));
    
    // Modal events
    this.eventBus.on('modal:open', this.handleModalOpen.bind(this));
    this.eventBus.on('modal:close', this.handleModalClose.bind(this));
    
    // Notification events
    this.eventBus.on('notification:add', this.handleNotificationAdd.bind(this));
    this.eventBus.on('notification:remove', this.handleNotificationRemove.bind(this));
    
    // Loading events
    this.eventBus.on('loading:start', this.handleLoadingStart.bind(this));
    this.eventBus.on('loading:stop', this.handleLoadingStop.bind(this));
    
    // Error events
    this.eventBus.on('error:occurred', this.handleErrorOccurred.bind(this));
    this.eventBus.on('error:cleared', this.handleErrorCleared.bind(this));
    
    // Media query listeners for system preferences
    this.setupMediaQueryListeners();
  }
  
  /**
   * Setup media query listeners for system preferences
   */
  setupMediaQueryListeners() {
    // Dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addListener(this.handleSystemThemeChange.bind(this));
    
    // Reduced motion preference
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addListener(this.handleReducedMotionChange.bind(this));
    
    // High contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    highContrastQuery.addListener(this.handleHighContrastChange.bind(this));
  }
  
  /**
   * Detect initial state from system and storage
   */
  detectInitialState() {
    // Detect device type
    this.detectDeviceType();
    
    // Detect system theme preference
    this.detectSystemTheme();
    
    // Detect accessibility preferences
    this.detectAccessibilityPreferences();
    
    // Load saved preferences
    this.loadSavedPreferences();
  }
  
  /**
   * Detect device type
   */
  detectDeviceType() {
    const width = window.innerWidth;
    const userAgent = navigator.userAgent.toLowerCase();
    
    const isMobile = width <= 768 || /android|iphone|ipad|ipod|blackberry|iemobile/i.test(userAgent);
    const isTablet = width > 768 && width <= 1024 && /tablet|ipad/i.test(userAgent);
    
    this.setState({
      isMobile,
      isTablet,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    });
  }
  
  /**
   * Detect system theme preference
   */
  detectSystemTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const actualTheme = this.state.theme === 'auto' 
      ? (prefersDark ? 'dark' : 'light')
      : this.state.theme;
    
    this.setState({ actualTheme });
  }
  
  /**
   * Detect accessibility preferences
   */
  detectAccessibilityPreferences() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    this.setState({
      reducedMotion,
      isHighContrast: highContrast,
      animationsEnabled: !reducedMotion
    });
  }
  
  /**
   * Load saved preferences from storage
   */
  loadSavedPreferences() {
    try {
      const saved = localStorage.getItem('quickchat_ui_preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.setState(preferences);
      }
    } catch (error) {
      console.warn('Failed to load UI preferences:', error);
    }
  }
  
  /**
   * Save preferences to storage
   */
  savePreferences() {
    try {
      const preferences = {
        theme: this.state.theme,
        fontSize: this.state.fontSize,
        sidebarOpen: this.state.sidebarOpen,
        sidebarWidth: this.state.sidebarWidth,
        rightPanelWidth: this.state.rightPanelWidth,
        showAvatars: this.state.showAvatars,
        showTimestamps: this.state.showTimestamps,
        compactMode: this.state.compactMode,
        animationsEnabled: this.state.animationsEnabled,
        soundEnabled: this.state.soundEnabled,
        virtualScrollEnabled: this.state.virtualScrollEnabled,
        maxVisibleMessages: this.state.maxVisibleMessages
      };
      
      localStorage.setItem('quickchat_ui_preferences', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save UI preferences:', error);
    }
  }
  
  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Update state
   */
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners of state change
    this.notifyListeners(oldState, this.state);
    
    // Emit specific events for important state changes
    if (oldState.theme !== this.state.theme || oldState.actualTheme !== this.state.actualTheme) {
      this.eventBus.emit('theme:changed', { 
        theme: this.state.theme,
        actualTheme: this.state.actualTheme
      });
      document.documentElement.setAttribute('data-theme', this.state.actualTheme);
    }
    
    if (oldState.sidebarOpen !== this.state.sidebarOpen) {
      this.eventBus.emit('layout:sidebar-toggled', { open: this.state.sidebarOpen });
    }
    
    if (oldState.isMobile !== this.state.isMobile) {
      this.eventBus.emit('device:type-changed', { 
        isMobile: this.state.isMobile,
        isTablet: this.state.isTablet 
      });
    }
    
    // Auto-save preferences for certain changes
    const preferencesToSave = ['theme', 'fontSize', 'sidebarOpen', 'compactMode', 'animationsEnabled', 'soundEnabled'];
    if (preferencesToSave.some(key => oldState[key] !== this.state[key])) {
      this.savePreferences();
    }
  }
  
  /**
   * Set theme
   */
  setTheme(theme) {
    const actualTheme = theme === 'auto' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    this.setState({ theme, actualTheme });
  }
  
  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    this.setState({ sidebarOpen: !this.state.sidebarOpen });
  }
  
  /**
   * Set sidebar width
   */
  setSidebarWidth(width) {
    this.setState({ sidebarWidth: Math.max(200, Math.min(500, width)) });
  }
  
  /**
   * Open modal
   */
  openModal(id, config = {}) {
    const modals = new Map(this.state.activeModals);
    const stack = [...this.state.modalStack];
    
    modals.set(id, {
      id,
      component: config.component,
      props: config.props || {},
      closable: config.closable !== false,
      backdrop: config.backdrop !== false,
      zIndex: 1000 + modals.size,
      timestamp: Date.now()
    });
    
    stack.push(id);
    
    this.setState({ 
      activeModals: modals, 
      modalStack: stack 
    });
    
    // Prevent body scroll when modal is open
    if (stack.length === 1) {
      document.body.style.overflow = 'hidden';
    }
  }
  
  /**
   * Close modal
   */
  closeModal(id) {
    const modals = new Map(this.state.activeModals);
    const stack = this.state.modalStack.filter(modalId => modalId !== id);
    
    modals.delete(id);
    
    this.setState({ 
      activeModals: modals, 
      modalStack: stack 
    });
    
    // Restore body scroll when no modals are open
    if (stack.length === 0) {
      document.body.style.overflow = '';
    }
  }
  
  /**
   * Close topmost modal
   */
  closeTopModal() {
    const stack = [...this.state.modalStack];
    if (stack.length > 0) {
      const topModalId = stack.pop();
      this.closeModal(topModalId);
    }
  }
  
  /**
   * Add notification
   */
  addNotification(notification) {
    const notifications = new Map(this.state.notifications);
    const id = notification.id || `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    notifications.set(id, {
      id,
      type: notification.type || 'info', // 'info', 'success', 'warning', 'error'
      title: notification.title,
      message: notification.message,
      duration: notification.duration || 5000,
      persistent: notification.persistent || false,
      timestamp: Date.now(),
      actions: notification.actions || []
    });
    
    this.setState({ notifications });
    
    // Auto-remove non-persistent notifications
    if (!notification.persistent && notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, notification.duration);
    }
    
    // Limit total notifications
    if (notifications.size > this.state.maxNotifications) {
      const oldest = [...notifications.values()]
        .filter(n => !n.persistent)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      
      if (oldest) {
        this.removeNotification(oldest.id);
      }
    }
    
    return id;
  }
  
  /**
   * Remove notification
   */
  removeNotification(id) {
    const notifications = new Map(this.state.notifications);
    notifications.delete(id);
    this.setState({ notifications });
  }
  
  /**
   * Set loading state
   */
  setLoading(key, isLoading) {
    const loadingStates = new Map(this.state.loadingStates);
    
    if (isLoading) {
      loadingStates.set(key, true);
    } else {
      loadingStates.delete(key);
    }
    
    const globalLoading = loadingStates.size > 0;
    
    this.setState({ loadingStates, globalLoading });
  }
  
  /**
   * Set error state
   */
  setError(error) {
    this.setState({
      hasError: !!error,
      errorMessage: error?.message || null,
      errorDetails: error?.details || null
    });
  }
  
  /**
   * Clear error state
   */
  clearError() {
    this.setState({
      hasError: false,
      errorMessage: null,
      errorDetails: null
    });
  }
  
  /**
   * Event handlers
   */
  handleThemeChange(data) {
    this.setTheme(data.theme);
  }
  
  handleSystemThemeChange() {
    if (this.state.theme === 'auto') {
      this.detectSystemTheme();
    }
  }
  
  handleWindowResize() {
    this.detectDeviceType();
  }
  
  handleOrientationChange() {
    // Delay to get accurate dimensions after orientation change
    setTimeout(() => {
      this.detectDeviceType();
    }, 100);
  }
  
  handleReducedMotionChange() {
    this.detectAccessibilityPreferences();
  }
  
  handleHighContrastChange() {
    this.detectAccessibilityPreferences();
  }
  
  handleAccessibilityEnabled() {
    this.setState({ screenReaderEnabled: true });
  }
  
  handleAccessibilityDisabled() {
    this.setState({ screenReaderEnabled: false });
  }
  
  handleModalOpen(data) {
    this.openModal(data.id, data.config);
  }
  
  handleModalClose(data) {
    this.closeModal(data.id);
  }
  
  handleNotificationAdd(notification) {
    this.addNotification(notification);
  }
  
  handleNotificationRemove(data) {
    this.removeNotification(data.id);
  }
  
  handleLoadingStart(data) {
    this.setLoading(data.key, true);
  }
  
  handleLoadingStop(data) {
    this.setLoading(data.key, false);
  }
  
  handleErrorOccurred(error) {
    this.setError(error);
  }
  
  handleErrorCleared() {
    this.clearError();
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of state change
   */
  notifyListeners(oldState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState);
      } catch (error) {
        console.error('Error in UI store listener:', error);
      }
    });
  }
  
  /**
   * Clear all state
   */
  clear() {
    // Close all modals
    this.state.modalStack.forEach(id => this.closeModal(id));
    
    // Clear all notifications
    this.setState({
      activeModals: new Map(),
      modalStack: [],
      notifications: new Map(),
      loadingStates: new Map(),
      globalLoading: false,
      hasError: false,
      errorMessage: null,
      errorDetails: null
    });
    
    // Restore body scroll
    document.body.style.overflow = '';
  }
  
  /**
   * Get UI metrics for analytics
   */
  getMetrics() {
    return {
      theme: this.state.actualTheme,
      deviceType: this.state.isMobile ? 'mobile' : this.state.isTablet ? 'tablet' : 'desktop',
      screenSize: `${this.state.screenWidth}x${this.state.screenHeight}`,
      compactMode: this.state.compactMode,
      virtualScrollEnabled: this.state.virtualScrollEnabled,
      accessibilityEnabled: this.state.screenReaderEnabled,
      reducedMotion: this.state.reducedMotion
    };
  }
}

// Create singleton instance
export const uiStore = new UIStore();

// Export the class for testing
export { UIStore };
