// utils.js - Enhanced utility functions for Quick Chat
// Version: 2.0.0

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @param {boolean} immediate - Whether to invoke on the leading edge instead of trailing
 * @returns {Function} Debounced function
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    return function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between allowed function calls
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type (info, success, warning, error)
 * @param {number} duration - Duration in milliseconds
 * @param {boolean} dismissible - Whether toast can be manually dismissed
 * @returns {HTMLElement} The toast element
 */
function showToast(message, type = 'info', duration = 3000, dismissible = true) {
    // Create container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    
    // Add content
    toast.innerHTML = `
        <div class="toast-content">${message}</div>
        ${dismissible ? '<button class="toast-close" aria-label="Close notification">&times;</button>' : ''}
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Set up dismiss functionality
    if (dismissible) {
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.add('toast-hide');
                toast.addEventListener('transitionend', () => toast.remove());
            });
        }
    }
    
    // Auto dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-hide');
                toast.addEventListener('transitionend', () => toast.remove());
            }
        }, duration);
    }
    
    return toast;
}

/**
 * Format date for display
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Format string (short, medium, long, full, time, relative)
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'medium') {
    if (!date) return '';
    
    // Convert to Date object if not already
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    // Get current date for comparison
    const now = new Date();
    const isToday = dateObj.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === dateObj.toDateString();
    const diffTime = Math.abs(now - dateObj);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Format based on specified format
    switch (format) {
        case 'time':
            return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        case 'short':
            return dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
        case 'medium':
            return dateObj.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
        case 'long':
            return dateObj.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
        case 'full':
            return dateObj.toLocaleDateString([], { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
        case 'relative':
            if (isToday) return `Today at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            if (isYesterday) return `Yesterday at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            if (diffDays < 7) return `${diffDays} days ago`;
            return dateObj.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
        default:
            return dateObj.toLocaleString();
    }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Decimal places to show
 * @returns {string} Formatted file size string
 */
function formatFileSize(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
function generateUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // Use modern Clipboard API if available
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    } catch (err) {
        console.error('Failed to copy text:', err);
        return false;
    }
}

/**
 * Get URL parameters as an object
 * @param {string} url - URL to parse (defaults to current URL)
 * @returns {Object} URL parameters as key-value pairs
 */
function getUrlParams(url = window.location.href) {
    try {
        const params = {};
        const urlObj = new URL(url);
        const searchParams = new URLSearchParams(urlObj.search);
        
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        
        return params;
    } catch (err) {
        console.error('Failed to parse URL parameters:', err);
        return {};
    }
}

// Export for use in other scripts
window.utils = { 
    debounce, 
    throttle, 
    showToast,
    formatDate,
    formatFileSize,
    generateUniqueId,
    copyToClipboard,
    getUrlParams
};
