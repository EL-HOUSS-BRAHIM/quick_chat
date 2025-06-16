/**
 * Enhanced Error Handler
 * Provides comprehensive error handling with retry mechanisms and user feedback
 */
class EnhancedErrorHandler {
    constructor() {
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second base delay
        this.offlineQueue = [];
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        this.setupGlobalErrorHandling();
        this.setupNetworkMonitoring();
        this.setupUnhandledRejectionHandler();
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
                error: event.error,
                stack: event.error?.stack
            });
        });

        // Catch resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource',
                    message: `Failed to load ${event.target.tagName}: ${event.target.src || event.target.href}`,
                    element: event.target
                });
            }
        }, true);
    }

    setupUnhandledRejectionHandler() {
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: 'Unhandled Promise Rejection',
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNetworkStatus('Connection restored', 'success');
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNetworkStatus('Connection lost. You are now offline.', 'warning');
        });
    }

    async handleError(errorInfo) {
        console.error('Error caught by Enhanced Error Handler:', errorInfo);

        // Log error for debugging
        this.logError(errorInfo);

        // Handle based on error type
        switch (errorInfo.type) {
            case 'network':
                return this.handleNetworkError(errorInfo);
            case 'webrtc':
                return this.handleWebRTCError(errorInfo);
            case 'api':
                return this.handleAPIError(errorInfo);
            case 'validation':
                return this.handleValidationError(errorInfo);
            default:
                return this.handleGenericError(errorInfo);
        }
    }

    async handleNetworkError(errorInfo) {
        if (!this.isOnline) {
            // Queue for retry when online
            this.offlineQueue.push(errorInfo.retryFunction);
            this.showError('No internet connection. Request will be retried when connection is restored.');
            return;
        }

        const retryKey = errorInfo.url || errorInfo.endpoint || 'network';
        const attempts = this.retryAttempts.get(retryKey) || 0;

        if (attempts < this.maxRetries && errorInfo.retryFunction) {
            this.retryAttempts.set(retryKey, attempts + 1);
            
            const delay = this.retryDelay * Math.pow(2, attempts); // Exponential backoff
            this.showError(`Connection failed. Retrying in ${delay/1000} seconds... (${attempts + 1}/${this.maxRetries})`);
            
            setTimeout(async () => {
                try {
                    await errorInfo.retryFunction();
                    this.retryAttempts.delete(retryKey);
                    this.showSuccess('Connection restored');
                } catch (retryError) {
                    this.handleError({
                        ...errorInfo,
                        type: 'network',
                        attempt: attempts + 1
                    });
                }
            }, delay);
        } else {
            this.retryAttempts.delete(retryKey);
            this.showError('Connection failed after multiple attempts. Please check your internet connection and try again.');
        }
    }

    handleWebRTCError(errorInfo) {
        let userMessage = 'Call connection failed';
        let suggestedAction = 'Please try again';

        switch (errorInfo.code) {
            case 'NotAllowedError':
                userMessage = 'Camera/microphone access denied';
                suggestedAction = 'Please allow camera and microphone access in your browser settings';
                break;
            case 'NotFoundError':
                userMessage = 'No camera or microphone found';
                suggestedAction = 'Please connect a camera or microphone and try again';
                break;
            case 'OverConstrainedError':
                userMessage = 'Camera/microphone constraints not supported';
                suggestedAction = 'Try adjusting video quality settings';
                break;
            case 'ice-connection-failed':
                userMessage = 'Network connection failed';
                suggestedAction = 'Check your firewall settings or try again';
                break;
        }

        this.showError(`${userMessage}. ${suggestedAction}`);

        // Offer graceful degradation for WebRTC
        if (errorInfo.fallbackFunction) {
            setTimeout(() => {
                if (confirm('Would you like to continue with audio only?')) {
                    errorInfo.fallbackFunction();
                }
            }, 2000);
        }
    }

    handleAPIError(errorInfo) {
        let userMessage;
        let shouldRetry = false;

        switch (errorInfo.status) {
            case 401:
                userMessage = 'Your session has expired. Please log in again.';
                setTimeout(() => {
                    if (window.app && window.app.logout) {
                        window.app.logout();
                    } else {
                        window.location.href = '/login.php';
                    }
                }, 2000);
                break;
            case 403:
                userMessage = 'You don\'t have permission to perform this action.';
                break;
            case 404:
                userMessage = 'The requested resource was not found.';
                break;
            case 429:
                userMessage = 'Too many requests. Please wait a moment and try again.';
                shouldRetry = true;
                break;
            case 500:
                userMessage = 'Server error. Please try again later.';
                shouldRetry = true;
                break;
            case 502:
            case 503:
            case 504:
                userMessage = 'Service temporarily unavailable. Please try again.';
                shouldRetry = true;
                break;
            default:
                userMessage = errorInfo.message || 'An unexpected error occurred.';
                shouldRetry = errorInfo.status >= 500;
        }

        this.showError(userMessage);

        if (shouldRetry && errorInfo.retryFunction) {
            this.handleNetworkError(errorInfo);
        }
    }

    handleValidationError(errorInfo) {
        const errors = errorInfo.errors || [errorInfo.message];
        
        // Show field-specific errors
        errors.forEach(error => {
            if (error.field) {
                this.showFieldError(error.field, error.message);
            } else {
                this.showError(error.message || error);
            }
        });
    }

    handleGenericError(errorInfo) {
        let userMessage = 'An unexpected error occurred';
        
        if (errorInfo.message) {
            // Try to make technical errors more user-friendly
            if (errorInfo.message.includes('Network Error')) {
                userMessage = 'Connection problem. Please check your internet connection.';
            } else if (errorInfo.message.includes('Syntax Error')) {
                userMessage = 'Application error. Please refresh the page.';
            } else if (errorInfo.message.includes('Permission denied')) {
                userMessage = 'Permission denied. Please check your browser settings.';
            } else {
                userMessage = this.sanitizeErrorMessage(errorInfo.message);
            }
        }

        this.showError(userMessage);

        // Log technical details for debugging
        if (errorInfo.stack) {
            console.error('Stack trace:', errorInfo.stack);
        }
    }

    sanitizeErrorMessage(message) {
        // Remove technical jargon and make user-friendly
        return message
            .replace(/^Error: /, '')
            .replace(/at \S+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    showFieldError(fieldName, message) {
        const field = document.querySelector(`[name="${fieldName}"], [id="${fieldName}"]`);
        if (field) {
            // Remove existing error
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }

            // Add error message
            const errorEl = document.createElement('div');
            errorEl.className = 'field-error';
            errorEl.textContent = message;
            field.parentNode.appendChild(errorEl);

            // Add error styling to field
            field.classList.add('error');

            // Remove error when user starts typing
            const removeError = () => {
                field.classList.remove('error');
                errorEl.remove();
                field.removeEventListener('input', removeError);
                field.removeEventListener('focus', removeError);
            };

            field.addEventListener('input', removeError);
            field.addEventListener('focus', removeError);
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNetworkStatus(message, type) {
        this.showNotification(message, type, 5000);
    }

    showNotification(message, type = 'info', duration = 4000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button type="button" class="notification-close">&times;</button>
            </div>
        `;

        // Add to container
        let container = document.querySelector('.notification-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        container.appendChild(notification);

        // Auto-remove after duration
        const timer = setTimeout(() => {
            this.removeNotification(notification);
        }, duration);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            clearTimeout(timer);
            this.removeNotification(notification);
        });

        // Show animation
        setTimeout(() => notification.classList.add('show'), 10);
    }

    removeNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        this.showSuccess('Processing queued requests...');

        const queue = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const retryFunction of queue) {
            try {
                await retryFunction();
            } catch (error) {
                console.error('Failed to process queued request:', error);
            }
        }
    }

    logError(errorInfo) {
        // Send to server for logging (optional)
        if (navigator.sendBeacon) {
            const logData = JSON.stringify({
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...errorInfo
            });

            navigator.sendBeacon('/api/logs.php', logData);
        }
    }

    // Utility method for wrapping async functions with error handling
    wrapAsync(asyncFunction, options = {}) {
        return async (...args) => {
            try {
                return await asyncFunction(...args);
            } catch (error) {
                await this.handleError({
                    type: options.type || 'api',
                    message: error.message,
                    error: error,
                    retryFunction: options.retry ? () => asyncFunction(...args) : null,
                    fallbackFunction: options.fallback,
                    ...options
                });
                
                if (options.rethrow) {
                    throw error;
                }
            }
        };
    }

    // Utility method for wrapping fetch requests
    wrapFetch(url, options = {}) {
        const retryFunction = () => fetch(url, options);
        
        return this.wrapAsync(async () => {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        }, {
            type: 'network',
            url: url,
            status: null,
            retry: true,
            retryFunction: retryFunction
        })();
    }
}

// Initialize global error handler
window.errorHandler = new EnhancedErrorHandler();

// Export for manual use
window.EnhancedErrorHandler = EnhancedErrorHandler;
