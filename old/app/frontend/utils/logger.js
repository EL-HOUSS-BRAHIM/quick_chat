/**
 * Logger Utility
 * Provides structured logging with different levels and formatting
 */

class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.currentLevel = this.levels.INFO;
    this.enabledFeatures = {
      colors: true,
      timestamp: true,
      stackTrace: false,
      storage: false
    };
    
    this.logHistory = [];
    this.maxHistorySize = 1000;
    
    // Initialize based on environment
    this.initializeLogger();
  }

  /**
   * Initialize logger configuration
   */
  initializeLogger() {
    // Set debug level in development
    if (window.quickChatConfig?.debug || window.location.hostname === 'localhost') {
      this.currentLevel = this.levels.DEBUG;
      this.enabledFeatures.stackTrace = true;
    }
    
    // Disable colors in production
    if (window.quickChatConfig?.environment === 'production') {
      this.enabledFeatures.colors = false;
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  /**
   * Core logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  log(level, message, ...args) {
    // Check if level is enabled
    if (this.levels[level] < this.currentLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, args);
    
    // Add to history
    this.addToHistory(logEntry);
    
    // Output to console
    this.outputToConsole(logEntry);
    
    // Store if enabled
    if (this.enabledFeatures.storage) {
      this.storeLog(logEntry);
    }
  }

  /**
   * Create log entry object
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Array} args - Additional arguments
   */
  createLogEntry(level, message, args) {
    const entry = {
      timestamp: Date.now(),
      level,
      message,
      args,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100) // Truncate for storage
    };

    // Add stack trace for errors
    if (level === 'ERROR' && this.enabledFeatures.stackTrace) {
      entry.stack = new Error().stack;
    }

    return entry;
  }

  /**
   * Add log entry to history
   * @param {Object} entry - Log entry
   */
  addToHistory(entry) {
    this.logHistory.push(entry);
    
    // Limit history size
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  /**
   * Output log entry to console
   * @param {Object} entry - Log entry
   */
  outputToConsole(entry) {
    const { level, message, args, timestamp } = entry;
    
    // Format timestamp
    const timeStr = this.enabledFeatures.timestamp 
      ? this.formatTimestamp(timestamp) 
      : '';
    
    // Format message
    const fullMessage = timeStr ? `[${timeStr}] ${message}` : message;
    
    // Get console method and color
    const { method, color } = this.getConsoleConfig(level);
    
    // Output with color if enabled
    if (this.enabledFeatures.colors && color) {
      console[method](`%c${fullMessage}`, `color: ${color}`, ...args);
    } else {
      console[method](fullMessage, ...args);
    }
  }

  /**
   * Get console configuration for log level
   * @param {string} level - Log level
   */
  getConsoleConfig(level) {
    const configs = {
      DEBUG: { method: 'debug', color: '#6b7280' },
      INFO: { method: 'info', color: '#3b82f6' },
      WARN: { method: 'warn', color: '#f59e0b' },
      ERROR: { method: 'error', color: '#ef4444' }
    };
    
    return configs[level] || configs.INFO;
  }

  /**
   * Format timestamp
   * @param {number} timestamp - Timestamp
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString().substr(11, 12); // HH:mm:ss.sss
  }

  /**
   * Store log entry
   * @param {Object} entry - Log entry
   */
  storeLog(entry) {
    try {
      const logs = JSON.parse(localStorage.getItem('quickchat:logs') || '[]');
      logs.push(entry);
      
      // Limit stored logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('quickchat:logs', JSON.stringify(logs));
    } catch (error) {
      // Fail silently for storage issues
      console.warn('Failed to store log:', error);
    }
  }

  /**
   * Create namespace logger
   * @param {string} namespace - Namespace prefix
   */
  namespace(namespace) {
    return {
      debug: (message, ...args) => this.debug(`[${namespace}] ${message}`, ...args),
      info: (message, ...args) => this.info(`[${namespace}] ${message}`, ...args),
      warn: (message, ...args) => this.warn(`[${namespace}] ${message}`, ...args),
      error: (message, ...args) => this.error(`[${namespace}] ${message}`, ...args)
    };
  }

  /**
   * Set log level
   * @param {string} level - Log level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
    }
  }

  /**
   * Enable or disable feature
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable feature
   */
  setFeature(feature, enabled) {
    if (this.enabledFeatures.hasOwnProperty(feature)) {
      this.enabledFeatures[feature] = enabled;
    }
  }

  /**
   * Get log history
   * @param {number} limit - Maximum number of logs to return
   */
  getHistory(limit = 50) {
    return this.logHistory.slice(-limit);
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
  }

  /**
   * Get stored logs
   */
  getStoredLogs() {
    try {
      return JSON.parse(localStorage.getItem('quickchat:logs') || '[]');
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  clearStoredLogs() {
    try {
      localStorage.removeItem('quickchat:logs');
    } catch (error) {
      console.warn('Failed to clear stored logs:', error);
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    const logs = {
      history: this.logHistory,
      stored: this.getStoredLogs(),
      config: {
        level: Object.keys(this.levels).find(key => this.levels[key] === this.currentLevel),
        features: this.enabledFeatures
      },
      exported: Date.now()
    };
    
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Download logs as file
   */
  downloadLogs() {
    const logsJson = this.exportLogs();
    const blob = new Blob([logsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickchat-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Performance logging
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to measure
   */
  async performance(operation, fn) {
    const start = performance.now();
    
    try {
      const result = await fn();
      const end = performance.now();
      const duration = end - start;
      
      this.debug(`Performance: ${operation} took ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      
      this.error(`Performance: ${operation} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Group logging
   * @param {string} groupName - Group name
   * @param {Function} fn - Function to execute in group
   */
  group(groupName, fn) {
    console.group(groupName);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }

  /**
   * Table logging
   * @param {Array|Object} data - Data to display as table
   * @param {Array} columns - Columns to display
   */
  table(data, columns) {
    if (console.table) {
      console.table(data, columns);
    } else {
      this.info('Table data:', data);
    }
  }
}

// Create singleton instance
export const logger = new Logger();
