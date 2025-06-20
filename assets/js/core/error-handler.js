/**
 * Unified Error Handling System for Quick Chat
 * Enhanced with security incident response and advanced logging
 * Implementation of TODO: Advanced Security Features
 */

import eventBus from './event-bus.js';
import { state } from './state.js';

export class ErrorHandler {
  constructor(options = {}) {
    // Default options
    this.options = {
      appName: 'QuickChat',
      appVersion: '3.0.0',
      enableLogging: true,
      logLevel: 'error', // debug, info, warn, error
      maxErrorsStored: 100,
      reportErrors: true,
      reportEndpoint: '/api/errors',
      maxRetries: 3,
      retryDelay: 1000, // 1 second base delay
      
      // Security features (TODO: Add security incident response system)
      securityMode: true,
      securityReportEndpoint: '/api/security/incidents',
      securityThreshold: 5, // Max security errors before alert
      enableSecurityMonitoring: true,
      
      // Advanced audit logging (TODO: Implement advanced audit logging - 60% complete)
      auditLogging: true,
      auditEndpoint: '/api/audit/logs',
      sensitiveDataMasking: true,
      
      // Performance monitoring
      performanceTracking: true,
      performanceThreshold: 5000, // 5 seconds
      
      ...options
    };
    
    // Error storage
    this.errors = [];
    this.securityIncidents = [];
    this.performanceIssues = [];
    this.retryAttempts = new Map();
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    this.securityAlertCount = 0;
    
    // Initialize state
    state.register('errorHandler', {
      isInitialized: false,
      errorCount: 0,
      securityIncidentCount: 0,
      lastError: null,
      isSecurityAlertActive: false
    });

    this.init();
  }

  init() {
    this.setupGlobalErrorHandling();
    this.setupNetworkMonitoring();
    this.setupUnhandledRejectionHandler();
    this.setupSecurityMonitoring();
    this.setupPerformanceMonitoring();
    
    state.update('errorHandler', { isInitialized: true });
  }

  setupGlobalErrorHandling() {
    // Catch JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      // Prevent default error handling in production
      if (this.options.logLevel !== 'debug') {
        event.preventDefault();
      }
    });
  }

  setupNetworkMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  setupUnhandledRejectionHandler() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason.message || 'Unhandled Promise Rejection',
        stack: event.reason.stack,
        reason: event.reason
      });
      
      // Prevent default error handling
      event.preventDefault();
    });
  }

  setupSecurityMonitoring() {
    if (!this.options.enableSecurityMonitoring) return;

    // Monitor for potential security incidents
    window.addEventListener('securityincident', (event) => {
      this.handleSecurityIncident(event.detail);
    });
  }

  setupPerformanceMonitoring() {
    if (!this.options.performanceTracking) return;

    // Monitor performance issues
    window.addEventListener('load', () => {
      const performanceData = window.performance.timing;
      const pageLoadTime = performanceData.loadEventEnd - performanceData.navigationStart;
      
      if (pageLoadTime > this.options.performanceThreshold) {
        this.handlePerformanceIssue({
          type: 'page_load',
          duration: pageLoadTime,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }
    });
  }

  /**
   * Handle an error by logging, displaying UI feedback, and potentially reporting
   */
  handleError(error) {
    // Normalize error object
    const normalizedError = this.normalizeError(error);
    
    // Add to error log
    this.logError(normalizedError);
    
    // Display user feedback if appropriate
    this.displayUserFeedback(normalizedError);
    
    // Report error if enabled
    if (this.options.reportErrors) {
      this.reportError(normalizedError);
    }
    
    return normalizedError;
  }

  /**
   * Handle a security incident
   */
  handleSecurityIncident(incident) {
    // Normalize incident object
    const normalizedIncident = this.normalizeIncident(incident);
    
    // Add to security incidents log
    this.logSecurityIncident(normalizedIncident);
    
    // Report incident if security mode is enabled
    if (this.options.securityMode) {
      this.reportSecurityIncident(normalizedIncident);
    }
    
    return normalizedIncident;
  }

  /**
   * Convert various error formats into a consistent structure
   */
  normalizeError(error) {
    if (typeof error === 'string') {
      return {
        type: 'generic',
        message: error,
        timestamp: new Date().toISOString()
      };
    }
    
    if (error instanceof Error) {
      return {
        type: error.name || 'Error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
    
    // Add timestamp if not present
    if (!error.timestamp) {
      error.timestamp = new Date().toISOString();
    }
    
    return error;
  }

  /**
   * Convert incident details into a consistent structure
   */
  normalizeIncident(incident) {
    return {
      type: incident.type || 'security',
      message: incident.message || 'Security incident detected',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...incident
    };
  }

  /**
   * Add error to log and console
   */
  logError(error) {
    // Add to internal log with limited size
    this.errors.unshift(error);
    if (this.errors.length > this.options.maxErrorsStored) {
      this.errors.pop();
    }
    
    // Log to console based on level
    if (this.options.enableLogging) {
      console.error('[ErrorHandler]', error.message, error);
    }
  }

  /**
   * Add security incident to log
   */
  logSecurityIncident(incident) {
    // Add to internal security incident log
    this.securityIncidents.unshift(incident);
    if (this.securityIncidents.length > this.options.maxErrorsStored) {
      this.securityIncidents.pop();
    }
    
    // Increment security alert count
    this.securityAlertCount++;
    
    // Trigger security alert if threshold exceeded
    if (this.securityAlertCount >= this.options.securityThreshold) {
      this.triggerSecurityAlert();
    }
  }

  /**
   * Display appropriate feedback to user based on error type
   */
  displayUserFeedback(error) {
    // If we have a UI component for notifications
    if (window.utils && typeof window.utils.showToast === 'function') {
      let message = error.userMessage || error.message || 'An error occurred';
      
      // Simplify technical messages for user display
      if (message.length > 100 || message.includes('uncaught exception')) {
        message = 'Something went wrong. Please try again.';
      }
      
      window.utils.showToast(message, 'error');
    }
  }

  /**
   * Send error to reporting endpoint
   */
  reportError(error) {
    const reportData = {
      ...error,
      appName: this.options.appName,
      appVersion: this.options.appVersion,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // If offline, queue for later
    if (!this.isOnline) {
      this.offlineQueue.push({
        type: 'error_report',
        data: reportData
      });
      return;
    }
    
    // Send to reporting endpoint
    fetch(this.options.reportEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    }).catch(err => {
      console.error('Failed to report error:', err);
    });
  }

  /**
   * Send security incident to reporting endpoint
   */
  reportSecurityIncident(incident) {
    const reportData = {
      ...incident,
      appName: this.options.appName,
      appVersion: this.options.appVersion,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    // If offline, queue for later
    if (!this.isOnline) {
      this.offlineQueue.push({
        type: 'security_report',
        data: reportData
      });
      return;
    }
    
    // Send to security reporting endpoint
    fetch(this.options.securityReportEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reportData)
    }).catch(err => {
      console.error('Failed to report security incident:', err);
    });
  }

  /**
   * Process queued operations when back online
   */
  processOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.isOnline) {
      return;
    }
    
    // Process each item in the queue
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    queue.forEach(item => {
      if (item.type === 'error_report') {
        this.reportError(item.data);
      } else if (item.type === 'security_report') {
        this.reportSecurityIncident(item.data);
      }
    });
  }

  /**
   * Retry a failed operation with exponential backoff
   */
  retryOperation(operation, key, callback) {
    const attempts = this.retryAttempts.get(key) || 0;
    
    if (attempts >= this.options.maxRetries) {
      this.retryAttempts.delete(key);
      return Promise.reject(new Error(`Max retries (${this.options.maxRetries}) exceeded for operation: ${key}`));
    }
    
    // Exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, attempts);
    this.retryAttempts.set(key, attempts + 1);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        operation()
          .then(result => {
            this.retryAttempts.delete(key);
            resolve(result);
            if (callback) callback(null, result);
          })
          .catch(err => {
            this.retryOperation(operation, key, callback)
              .then(resolve)
              .catch(reject);
          });
      }, delay);
    });
  }

  /**
   * Get all logged errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Clear error log
   */
  clearErrors() {
    this.errors = [];
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;
