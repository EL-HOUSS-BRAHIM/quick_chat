/**
 * Analytics Service
 * 
 * Provides a unified interface for tracking events and user interactions.
 * Can be configured to use various analytics providers.
 */

class AnalyticsService {
  constructor() {
    this.initialized = false;
    this.userId = null;
    this.sessionId = this._generateSessionId();
    this.eventQueue = [];
    this.providers = [];
    this.config = {
      autoTrackPageViews: true,
      autoTrackErrors: true,
      samplingRate: 1.0, // 100% of events
      maxQueueSize: 50
    };
  }
  
  /**
   * Initialize the analytics service
   * @param {Object} config - Configuration options
   */
  init(config = {}) {
    // Merge configuration
    this.config = { ...this.config, ...config };
    
    // Set up automatic tracking
    if (this.config.autoTrackPageViews) {
      this._setupPageViewTracking();
    }
    
    if (this.config.autoTrackErrors) {
      this._setupErrorTracking();
    }
    
    this.initialized = true;
    
    // Process any queued events
    this._processQueue();
    
    return this;
  }
  
  /**
   * Set the user ID for user tracking
   * @param {string} userId - User identifier
   */
  setUserId(userId) {
    this.userId = userId;
    
    // Update user ID in all providers
    this.providers.forEach(provider => {
      if (typeof provider.setUserId === 'function') {
        provider.setUserId(userId);
      }
    });
  }
  
  /**
   * Add an analytics provider
   * @param {Object} provider - Provider implementation
   */
  addProvider(provider) {
    if (typeof provider.trackEvent !== 'function') {
      console.error('Invalid analytics provider: missing trackEvent method');
      return;
    }
    
    this.providers.push(provider);
    
    // Set user ID if already available
    if (this.userId && typeof provider.setUserId === 'function') {
      provider.setUserId(this.userId);
    }
  }
  
  /**
   * Track an event
   * @param {string} category - Event category
   * @param {string} action - Event action
   * @param {string} label - Event label
   * @param {Object} properties - Additional properties
   */
  trackEvent(category, action, label = null, properties = {}) {
    if (!this.initialized) {
      this._queueEvent('event', { category, action, label, properties });
      return;
    }
    
    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }
    
    const event = {
      category,
      action,
      label,
      properties,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId
    };
    
    this._trackWithProviders('event', event);
  }
  
  /**
   * Track a page view
   * @param {string} pageName - Name of the page
   * @param {Object} properties - Additional properties
   */
  trackPageView(pageName, properties = {}) {
    if (!this.initialized) {
      this._queueEvent('pageView', { pageName, properties });
      return;
    }
    
    const event = {
      pageName,
      url: window.location.href,
      referrer: document.referrer,
      properties,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId
    };
    
    this._trackWithProviders('pageView', event);
  }
  
  /**
   * Track an error
   * @param {Error} error - Error object
   * @param {Object} properties - Additional properties
   */
  trackError(error, properties = {}) {
    if (!this.initialized) {
      this._queueEvent('error', { 
        message: error.message, 
        stack: error.stack,
        properties 
      });
      return;
    }
    
    const event = {
      errorMessage: error.message,
      errorStack: error.stack,
      url: window.location.href,
      properties,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId
    };
    
    this._trackWithProviders('error', event);
  }
  
  /**
   * Queue an event for later processing
   * @private
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  _queueEvent(type, data) {
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      this.eventQueue.shift(); // Remove oldest event
    }
    
    this.eventQueue.push({ type, data });
  }
  
  /**
   * Process queued events
   * @private
   */
  _processQueue() {
    while (this.eventQueue.length > 0) {
      const { type, data } = this.eventQueue.shift();
      
      switch (type) {
      case 'event':
        this.trackEvent(data.category, data.action, data.label, data.properties);
        break;
      case 'pageView':
        this.trackPageView(data.pageName, data.properties);
        break;
      case 'error':
        this.trackError(new Error(data.message), data.properties);
        break;
      }
    }
  }
  
  /**
   * Track an event with all providers
   * @private
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  _trackWithProviders(type, data) {
    this.providers.forEach(provider => {
      try {
        switch (type) {
        case 'event':
          provider.trackEvent(data);
          break;
        case 'pageView':
          if (typeof provider.trackPageView === 'function') {
            provider.trackPageView(data);
          } else {
            provider.trackEvent({
              category: 'Page',
              action: 'View',
              label: data.pageName,
              ...data
            });
          }
          break;
        case 'error':
          if (typeof provider.trackError === 'function') {
            provider.trackError(data);
          } else {
            provider.trackEvent({
              category: 'Error',
              action: 'Exception',
              label: data.errorMessage,
              ...data
            });
          }
          break;
        }
      } catch (e) {
        console.error('Error in analytics provider:', e);
      }
    });
  }
  
  /**
   * Set up automatic page view tracking
   * @private
   */
  _setupPageViewTracking() {
    // Track initial page view
    const pageName = document.title || window.location.pathname;
    this.trackPageView(pageName);
    
    // Track navigation changes for SPAs
    if (typeof history.pushState === 'function') {
      const originalPushState = history.pushState;
      history.pushState = function() {
        originalPushState.apply(this, arguments);
        analyticsService._handleHistoryChange();
      };
      
      window.addEventListener('popstate', () => this._handleHistoryChange());
    }
  }
  
  /**
   * Handle history change for SPA tracking
   * @private
   */
  _handleHistoryChange() {
    const pageName = document.title || window.location.pathname;
    this.trackPageView(pageName);
  }
  
  /**
   * Set up automatic error tracking
   * @private
   */
  _setupErrorTracking() {
    window.addEventListener('error', (e) => {
      this.trackError(e.error || new Error(e.message));
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      const error = e.reason instanceof Error ? 
        e.reason : 
        new Error('Promise rejection: ' + String(e.reason));
      
      this.trackError(error, { unhandledRejection: true });
    });
  }
  
  /**
   * Generate a unique session ID
   * @private
   * @returns {string} - Session ID
   */
  _generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Create a singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;
