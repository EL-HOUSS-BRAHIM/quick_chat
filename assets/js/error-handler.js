/**
 * Error handling module for Quick Chat
 * Version: 1.0.0
 * 
 * This module provides centralized error handling functionality:
 * - Error tracking and reporting
 * - Graceful fallbacks
 * - Offline error queueing
 * - Localized error messages
 */

class ErrorHandler {
    constructor(options = {}) {
        // Default options
        this.options = {
            appName: 'QuickChat',
            appVersion: '1.0.0',
            enableLogging: true,
            logLevel: 'error', // debug, info, warn, error
            maxErrorsStored: 50,
            reportErrors: false,
            reportEndpoint: '/api/errors',
            ...options
        };
        
        // Error storage
        this.errors = [];
        
        // Offline error queue
        this.offlineErrors = [];
        
        // Error translations
        this.errorMessages = {
            'network_error': 'Connection error. Please check your internet connection.',
            'server_error': 'Server error. Please try again later.',
            'auth_error': 'Authentication error. Please try logging in again.',
            'validation_error': 'Please check your input and try again.',
            'permission_error': 'You don\'t have permission to perform this action.',
            'not_found': 'The requested resource was not found.',
            'rate_limit': 'Too many requests. Please try again later.',
            'upload_error': 'Failed to upload file. Please try again.',
            'unknown_error': 'An unknown error occurred. Please try again.'
        };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize error handler
     */
    init() {
        // Set up global error handler
        window.addEventListener('error', this.handleGlobalError.bind(this));
        
        // Set up promise rejection handler
        window.addEventListener('unhandledrejection', this.handleRejection.bind(this));
        
        // Set up online/offline handling
        window.addEventListener('online', this.handleOnline.bind(this));
        
        // Load stored errors
        this.loadStoredErrors();
        
        console.log('Error handler initialized');
    }
    
    /**
     * Handle global error event
     * @param {ErrorEvent} event - Error event
     */
    handleGlobalError(event) {
        const error = {
            type: 'runtime',
            message: event.message,
            stack: event.error ? event.error.stack : null,
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        this.trackError(error);
        
        // Don't prevent default handling
        return false;
    }
    
    /**
     * Handle unhandled promise rejection
     * @param {PromiseRejectionEvent} event - Rejection event
     */
    handleRejection(event) {
        let message = 'Promise rejection';
        let stack = null;
        
        if (typeof event.reason === 'string') {
            message = event.reason;
        } else if (event.reason instanceof Error) {
            message = event.reason.message;
            stack = event.reason.stack;
        } else if (event.reason) {
            message = String(event.reason);
        }
        
        const error = {
            type: 'promise_rejection',
            message: message,
            stack: stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        this.trackError(error);
    }
    
    /**
     * Handle coming back online
     */
    handleOnline() {
        // Try to send queued errors
        if (this.offlineErrors.length > 0 && this.options.reportErrors) {
            console.log(`Attempting to send ${this.offlineErrors.length} queued errors`);
            
            const errorsToSend = [...this.offlineErrors];
            this.offlineErrors = [];
            
            this.reportErrors(errorsToSend).catch(() => {
                // If failed, put back in queue
                this.offlineErrors.push(...errorsToSend);
            });
        }
    }
    
    /**
     * Track an error
     * @param {Object} error - Error object
     * @param {boolean} display - Whether to display error to user
     * @param {string} context - Additional context
     */
    trackError(error, display = false, context = '') {
        // Add context if provided
        if (context) {
            error.context = context;
        }
        
        // Add to error list
        this.errors.push(error);
        
        // Trim error list if needed
        if (this.errors.length > this.options.maxErrorsStored) {
            this.errors = this.errors.slice(-this.options.maxErrorsStored);
        }
        
        // Log error
        if (this.options.enableLogging) {
            console.error('Error tracked:', error);
        }
        
        // Store errors for later analysis
        this.storeErrors();
        
        // Report error if enabled
        if (this.options.reportErrors) {
            this.reportError(error);
        }
        
        // Display error to user if needed
        if (display) {
            this.displayError(error);
        }
        
        return error;
    }
    
    /**
     * Log an error without tracking
     * @param {string} message - Error message
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {*} data - Additional data
     */
    log(message, level = 'info', data = null) {
        if (!this.options.enableLogging) return;
        
        // Skip if log level is not sufficient
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        if (levels[level] < levels[this.options.logLevel]) return;
        
        const logData = {
            message,
            level,
            timestamp: new Date().toISOString()
        };
        
        if (data) {
            logData.data = data;
        }
        
        // Log to console with appropriate method
        switch (level) {
            case 'debug':
                console.debug(message, data || '');
                break;
            case 'info':
                console.info(message, data || '');
                break;
            case 'warn':
                console.warn(message, data || '');
                break;
            case 'error':
                console.error(message, data || '');
                break;
        }
    }
    
    /**
     * Report error to server
     * @param {Object} error - Error object
     */
    async reportError(error) {
        // Don't report if disabled
        if (!this.options.reportErrors) return;
        
        // Add app info
        const errorToReport = {
            ...error,
            appName: this.options.appName,
            appVersion: this.options.appVersion
        };
        
        // Check if online
        if (!navigator.onLine) {
            this.offlineErrors.push(errorToReport);
            return;
        }
        
        try {
            const response = await fetch(this.options.reportEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(errorToReport)
            });
            
            if (!response.ok) {
                throw new Error(`Error reporting failed: ${response.status}`);
            }
        } catch (err) {
            console.error('Failed to report error:', err);
            // Queue for later if reporting fails
            this.offlineErrors.push(errorToReport);
        }
    }
    
    /**
     * Report multiple errors at once
     * @param {Array} errors - Array of error objects
     */
    async reportErrors(errors) {
        // Don't report if disabled
        if (!this.options.reportErrors || !errors.length) return;
        
        // Add app info to all errors
        const errorsToReport = errors.map(error => ({
            ...error,
            appName: this.options.appName,
            appVersion: this.options.appVersion
        }));
        
        try {
            const response = await fetch(this.options.reportEndpoint + '/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ errors: errorsToReport })
            });
            
            if (!response.ok) {
                throw new Error(`Batch error reporting failed: ${response.status}`);
            }
        } catch (err) {
            console.error('Failed to report errors in batch:', err);
            throw err;
        }
    }
    
    /**
     * Display error to user
     * @param {Object} error - Error object
     */
    displayError(error) {
        let message = error.message || 'An unknown error occurred';
        const errorType = error.code || 'unknown_error';
        
        // Get localized message if available
        if (this.errorMessages[errorType]) {
            message = this.errorMessages[errorType];
        }
        
        // Display using toast if available
        if (window.utils && typeof window.utils.showToast === 'function') {
            window.utils.showToast(message, 'error');
        } else if (window.quickChatApp && typeof window.quickChatApp.showError === 'function') {
            window.quickChatApp.showError(message);
        } else {
            alert(message);
        }
    }
    
    /**
     * Store errors in localStorage
     */
    storeErrors() {
        try {
            localStorage.setItem('quickchat_errors', JSON.stringify(this.errors));
            
            if (this.offlineErrors.length > 0) {
                localStorage.setItem('quickchat_offline_errors', JSON.stringify(this.offlineErrors));
            }
        } catch (err) {
            console.error('Failed to store errors:', err);
        }
    }
    
    /**
     * Load stored errors from localStorage
     */
    loadStoredErrors() {
        try {
            const storedErrors = localStorage.getItem('quickchat_errors');
            if (storedErrors) {
                this.errors = JSON.parse(storedErrors);
            }
            
            const offlineErrors = localStorage.getItem('quickchat_offline_errors');
            if (offlineErrors) {
                this.offlineErrors = JSON.parse(offlineErrors);
            }
        } catch (err) {
            console.error('Failed to load stored errors:', err);
        }
    }
    
    /**
     * Clear all stored errors
     */
    clearErrors() {
        this.errors = [];
        this.offlineErrors = [];
        
        try {
            localStorage.removeItem('quickchat_errors');
            localStorage.removeItem('quickchat_offline_errors');
        } catch (err) {
            console.error('Failed to clear stored errors:', err);
        }
    }
    
    /**
     * Get all tracked errors
     * @returns {Array} Array of tracked errors
     */
    getErrors() {
        return [...this.errors];
    }
    
    /**
     * Get localized error message
     * @param {string} code - Error code
     * @returns {string} Localized error message
     */
    getErrorMessage(code) {
        return this.errorMessages[code] || this.errorMessages.unknown_error;
    }
    
    /**
     * Create error from response
     * @param {Response} response - Fetch response object
     * @returns {Promise<Object>} Error object
     */
    async createErrorFromResponse(response) {
        let errorData = {
            type: 'api_error',
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            timestamp: new Date().toISOString()
        };
        
        // Try to parse response body
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                errorData.message = data.message || data.error || `HTTP Error ${response.status}`;
                errorData.code = data.code || 'server_error';
                errorData.details = data.details || null;
            } else {
                const text = await response.text();
                errorData.message = text || `HTTP Error ${response.status}`;
                
                // Set appropriate error code based on status
                if (response.status === 401 || response.status === 403) {
                    errorData.code = 'auth_error';
                } else if (response.status === 404) {
                    errorData.code = 'not_found';
                } else if (response.status === 429) {
                    errorData.code = 'rate_limit';
                } else {
                    errorData.code = 'server_error';
                }
            }
        } catch (err) {
            errorData.message = `HTTP Error ${response.status}`;
            errorData.parseError = err.message;
        }
        
        return this.trackError(errorData);
    }
    
    /**
     * Create network error
     * @param {Error} error - Original error
     * @param {string} url - API URL
     * @returns {Object} Error object
     */
    createNetworkError(error, url) {
        const errorData = {
            type: 'network_error',
            message: error.message,
            stack: error.stack,
            url: url,
            code: 'network_error',
            timestamp: new Date().toISOString()
        };
        
        return this.trackError(errorData);
    }
    
    /**
     * Create validation error
     * @param {Object} validationErrors - Validation errors
     * @returns {Object} Error object
     */
    createValidationError(validationErrors) {
        const errorData = {
            type: 'validation_error',
            message: 'Validation failed',
            code: 'validation_error',
            details: validationErrors,
            timestamp: new Date().toISOString()
        };
        
        return this.trackError(errorData);
    }
}

// Create global instance
window.errorHandler = new ErrorHandler({
    appName: 'QuickChat',
    appVersion: '2.0.0',
    enableLogging: true,
    logLevel: 'warn',
    reportErrors: false // Set to true in production
});

// Add fetch error handling utility
window.handleFetchError = async (response, displayError = true) => {
    if (!response.ok) {
        const error = await window.errorHandler.createErrorFromResponse(response);
        if (displayError) {
            window.errorHandler.displayError(error);
        }
        throw error;
    }
    return response;
};
