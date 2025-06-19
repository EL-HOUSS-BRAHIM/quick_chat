/**
 * Logger Module
 * 
 * Provides centralized logging with multiple levels and output targets.
 * Supports console, remote logging, and local storage.
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    // Default configuration
    this.config = {
      level: LOG_LEVELS.INFO,
      enableConsole: true,
      enableRemote: false,
      enableStorage: false,
      remoteEndpoint: '/api/logs',
      storageName: 'app_logs',
      storageMaxSize: 100, // Maximum number of log entries to store
      includeTimestamp: true,
      batchRemoteLogging: true,
      batchSize: 10,
      batchInterval: 5000 // 5 seconds
    };
    
    // Queue for batched remote logging
    this.remoteQueue = [];
    this.batchIntervalId = null;
  }
  
  /**
   * Configure the logger
   * @param {Object} config - Configuration options
   */
  configure(config) {
    this.config = { ...this.config, ...config };
    
    // Set up batched remote logging if enabled
    if (this.config.enableRemote && this.config.batchRemoteLogging) {
      this._setupBatchedLogging();
    } else if (this.batchIntervalId) {
      clearInterval(this.batchIntervalId);
      this.batchIntervalId = null;
    }
    
    return this;
  }
  
  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   */
  debug(message, data = null) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
  }
  
  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   */
  info(message, data = null) {
    this._log(LOG_LEVELS.INFO, 'INFO', message, data);
  }
  
  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {any} data - Additional data to log
   */
  warn(message, data = null) {
    this._log(LOG_LEVELS.WARN, 'WARN', message, data);
  }
  
  /**
   * Log an error message
   * @param {string|Error} messageOrError - Error message or Error object
   * @param {any} data - Additional data to log
   */
  error(messageOrError, data = null) {
    let message, stack;
    
    if (messageOrError instanceof Error) {
      message = messageOrError.message;
      stack = messageOrError.stack;
      
      // If no additional data was provided, use the stack as data
      if (data === null) {
        data = { stack };
      } else if (typeof data === 'object') {
        data.stack = stack;
      }
    } else {
      message = messageOrError;
    }
    
    this._log(LOG_LEVELS.ERROR, 'ERROR', message, data);
  }
  
  /**
   * Get stored logs
   * @returns {Array} - Array of log entries
   */
  getStoredLogs() {
    if (!this.config.enableStorage) {
      return [];
    }
    
    try {
      const storedLogs = localStorage.getItem(this.config.storageName);
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (e) {
      console.error('Error retrieving stored logs:', e);
      return [];
    }
  }
  
  /**
   * Clear stored logs
   */
  clearStoredLogs() {
    if (this.config.enableStorage) {
      localStorage.removeItem(this.config.storageName);
    }
  }
  
  /**
   * Flush remote logging queue immediately
   */
  flushRemoteQueue() {
    if (this.remoteQueue.length > 0) {
      this._sendLogsToRemote([...this.remoteQueue]);
      this.remoteQueue = [];
    }
  }
  
  /**
   * Internal logging method
   * @private
   * @param {number} level - Log level value
   * @param {string} levelName - Log level name
   * @param {string} message - Log message
   * @param {any} data - Additional data
   */
  _log(level, levelName, message, data) {
    // Skip if log level is too low
    if (level < this.config.level) {
      return;
    }
    
    // Create log entry
    const timestamp = new Date().toISOString();
    const entry = {
      level: levelName,
      message,
      data,
      timestamp
    };
    
    // Console logging
    if (this.config.enableConsole) {
      this._logToConsole(level, entry);
    }
    
    // Remote logging
    if (this.config.enableRemote) {
      if (this.config.batchRemoteLogging) {
        this.remoteQueue.push(entry);
        
        // Send immediately if batch size reached
        if (this.remoteQueue.length >= this.config.batchSize) {
          this.flushRemoteQueue();
        }
      } else {
        this._sendLogsToRemote([entry]);
      }
    }
    
    // Storage logging
    if (this.config.enableStorage) {
      this._logToStorage(entry);
    }
  }
  
  /**
   * Log to console
   * @private
   * @param {number} level - Log level
   * @param {Object} entry - Log entry
   */
  _logToConsole(level, entry) {
    const prefix = this.config.includeTimestamp ? 
      `[${entry.timestamp}] [${entry.level}]` : 
      `[${entry.level}]`;
    
    const message = `${prefix} ${entry.message}`;
    
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(message, entry.data || '');
        break;
      case LOG_LEVELS.INFO:
        console.info(message, entry.data || '');
        break;
      case LOG_LEVELS.WARN:
        console.warn(message, entry.data || '');
        break;
      case LOG_LEVELS.ERROR:
        console.error(message, entry.data || '');
        break;
    }
  }
  
  /**
   * Log to storage
   * @private
   * @param {Object} entry - Log entry
   */
  _logToStorage(entry) {
    try {
      let logs = this.getStoredLogs();
      
      // Add new log entry
      logs.push(entry);
      
      // Limit size
      if (logs.length > this.config.storageMaxSize) {
        logs = logs.slice(-this.config.storageMaxSize);
      }
      
      // Save to storage
      localStorage.setItem(this.config.storageName, JSON.stringify(logs));
    } catch (e) {
      console.error('Error storing log:', e);
    }
  }
  
  /**
   * Send logs to remote endpoint
   * @private
   * @param {Array} entries - Log entries to send
   */
  _sendLogsToRemote(entries) {
    const data = {
      logs: entries,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    fetch(this.config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'same-origin'
    }).catch(e => {
      // Log to console but don't create an infinite loop by calling this.error()
      console.error('Error sending logs to remote:', e);
    });
  }
  
  /**
   * Set up batched logging
   * @private
   */
  _setupBatchedLogging() {
    // Clear existing interval if any
    if (this.batchIntervalId) {
      clearInterval(this.batchIntervalId);
    }
    
    // Set up new interval
    this.batchIntervalId = setInterval(() => {
      if (this.remoteQueue.length > 0) {
        this.flushRemoteQueue();
      }
    }, this.config.batchInterval);
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
