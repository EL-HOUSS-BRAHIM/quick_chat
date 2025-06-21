/**
 * Error Handler Service
 * Centralized error handling and logging for the application
 */

import { logger } from '../utils/logger.js';
import { EventBus } from './EventBus.js';

export class ErrorHandler {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    this.errorQueue = [];
    this.maxErrorQueue = 100;
    this.reportingEnabled = true;
    this.debugMode = false;
  }

  /**
   * Initialize error handler
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      // Set up global error handlers
      this.setupGlobalHandlers();
      
      // Set up unhandled promise rejection handler
      this.setupPromiseRejectionHandler();
      
      // Set up console error interception
      this.setupConsoleErrorInterception();
      
      this.initialized = true;
      logger.info('Error handler initialized');
      
    } catch (error) {
      logger.error('Failed to initialize error handler:', error);
      throw error;
    }
  }

  /**
   * Set up global error handlers
   */
  setupGlobalHandlers() {
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });
  }

  /**
   * Set up unhandled promise rejection handler
   */
  setupPromiseRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        stack: event.reason?.stack,
        promise: event.promise
      });
    });
  }

  /**
   * Set up console error interception
   */
  setupConsoleErrorInterception() {
    const originalError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalError.apply(console, args);
      
      // Handle as error if not already handled
      if (args.length > 0 && typeof args[0] === 'string') {
        this.handleError({
          type: 'console',
          message: args[0],
          details: args.slice(1)
        });
      }
    };
  }

  /**
   * Handle error
   * @param {Object|Error} error - Error object or error details
   * @param {Object} context - Additional context
   */
  handleError(error, context = {}) {
    try {
      const errorData = this.normalizeError(error);
      const enrichedError = this.enrichError(errorData, context);
      
      // Add to error queue
      this.addToErrorQueue(enrichedError);
      
      // Log error
      this.logError(enrichedError);
      
      // Emit error event
      this.eventBus.emit('error:occurred', enrichedError);
      
      // Report error if enabled
      if (this.reportingEnabled) {
        this.reportError(enrichedError);
      }
      
      // Show user notification for critical errors
      if (enrichedError.severity === 'critical') {
        this.showUserNotification(enrichedError);
      }
      
    } catch (handlingError) {
      // Fallback error handling
      console.error('Error in error handler:', handlingError);
      console.error('Original error:', error);
    }
  }

  /**
   * Normalize error object
   * @param {Object|Error} error - Error to normalize
   */
  normalizeError(error) {
    if (error instanceof Error) {
      return {
        type: 'error',
        message: error.message,
        name: error.name,
        stack: error.stack,
        error: error
      };
    }
    
    if (typeof error === 'object' && error !== null) {
      return {
        type: 'object',
        ...error
      };
    }
    
    return {
      type: 'unknown',
      message: String(error),
      error: error
    };
  }

  /**
   * Enrich error with additional context
   * @param {Object} errorData - Error data
   * @param {Object} context - Additional context
   */
  enrichError(errorData, context) {
    const enriched = {
      ...errorData,
      ...context,
      timestamp: Date.now(),
      id: this.generateErrorId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: window.quickChatConfig?.userId || null,
      sessionId: this.getSessionId(),
      severity: this.determineSeverity(errorData),
      category: this.categorizeError(errorData),
      handled: true
    };

    // Add performance information
    if (performance && performance.now) {
      enriched.performanceTime = performance.now();
    }

    // Add memory information if available
    if (performance && performance.memory) {
      enriched.memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }

    return enriched;
  }

  /**
   * Add error to queue
   * @param {Object} error - Error object
   */
  addToErrorQueue(error) {
    this.errorQueue.push(error);
    
    // Limit queue size
    if (this.errorQueue.length > this.maxErrorQueue) {
      this.errorQueue.shift();
    }
  }

  /**
   * Log error
   * @param {Object} error - Error object
   */
  logError(error) {
    const logLevel = this.getLogLevel(error.severity);
    
    logger[logLevel](`[${error.category}] ${error.message}`, {
      id: error.id,
      type: error.type,
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString(),
      stack: error.stack,
      context: error.context
    });
  }

  /**
   * Report error to external service
   * @param {Object} error - Error object
   */
  async reportError(error) {
    try {
      // Only report in production or when explicitly enabled
      if (this.debugMode || window.quickChatConfig?.debug) {
        return;
      }

      // Prepare error data for reporting
      const reportData = {
        id: error.id,
        message: error.message,
        type: error.type,
        severity: error.severity,
        category: error.category,
        timestamp: error.timestamp,
        url: error.url,
        userAgent: error.userAgent,
        userId: error.userId,
        sessionId: error.sessionId,
        stack: error.stack,
        context: error.context
      };

      // Send to error reporting service
      // This could be Sentry, LogRocket, or custom endpoint
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });

    } catch (reportingError) {
      logger.error('Failed to report error:', reportingError);
    }
  }

  /**
   * Show user notification for critical errors
   * @param {Object} error - Error object
   */
  showUserNotification(error) {
    // Emit event for UI components to handle
    this.eventBus.emit('error:user-notification', {
      message: this.getUserFriendlyMessage(error),
      severity: error.severity,
      actions: this.getErrorActions(error)
    });
  }

  /**
   * Get user-friendly error message
   * @param {Object} error - Error object
   */
  getUserFriendlyMessage(error) {
    const friendlyMessages = {
      network: 'Connection problem. Please check your internet connection.',
      api: 'Server error. Please try again later.',
      validation: 'Invalid input. Please check your data.',
      permission: 'Permission denied. Please contact support.',
      storage: 'Storage error. Please free up space or try again.',
      default: 'Something went wrong. Please try again or contact support.'
    };

    return friendlyMessages[error.category] || friendlyMessages.default;
  }

  /**
   * Get error actions
   * @param {Object} error - Error object
   */
  getErrorActions(error) {
    const actions = [];

    if (error.category === 'network') {
      actions.push({ label: 'Retry', action: 'retry' });
    }

    if (error.severity === 'critical') {
      actions.push({ label: 'Reload Page', action: 'reload' });
    }

    actions.push({ label: 'Report Issue', action: 'report' });

    return actions;
  }

  /**
   * Determine error severity
   * @param {Object} error - Error object
   */
  determineSeverity(error) {
    if (error.type === 'javascript' && error.message?.includes('Script error')) {
      return 'low';
    }

    if (error.type === 'network' || error.message?.includes('fetch')) {
      return 'medium';
    }

    if (error.type === 'promise' || error.message?.includes('Uncaught')) {
      return 'high';
    }

    if (error.message?.includes('critical') || error.message?.includes('fatal')) {
      return 'critical';
    }

    return 'medium';
  }

  /**
   * Categorize error
   * @param {Object} error - Error object
   */
  categorizeError(error) {
    if (error.type === 'network' || error.message?.includes('fetch') || error.message?.includes('XMLHttpRequest')) {
      return 'network';
    }

    if (error.message?.includes('API') || error.message?.includes('server')) {
      return 'api';
    }

    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return 'validation';
    }

    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      return 'permission';
    }

    if (error.message?.includes('storage') || error.message?.includes('quota')) {
      return 'storage';
    }

    return 'general';
  }

  /**
   * Get log level for severity
   * @param {string} severity - Error severity
   */
  getLogLevel(severity) {
    const levels = {
      low: 'debug',
      medium: 'warn',
      high: 'error',
      critical: 'error'
    };

    return levels[severity] || 'error';
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('quickchat:session-id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('quickchat:session-id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      byType: {},
      bySeverity: {},
      byCategory: {},
      recent: this.errorQueue.slice(-10)
    };

    this.errorQueue.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear error queue
   */
  clearErrorQueue() {
    const count = this.errorQueue.length;
    this.errorQueue = [];
    return count;
  }

  /**
   * Set reporting enabled
   * @param {boolean} enabled - Enable reporting
   */
  setReportingEnabled(enabled) {
    this.reportingEnabled = enabled;
  }

  /**
   * Set debug mode
   * @param {boolean} debug - Debug mode
   */
  setDebugMode(debug) {
    this.debugMode = debug;
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();
