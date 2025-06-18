/**
 * Utility functions for Quick Chat application
 */

/**
 * Format a date for display
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    relative: true,
    shortFormat: false,
    includeTime: true
  };
  
  const config = { ...defaultOptions, ...options };
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }
  
  // Use relative time if enabled and date is recent
  if (config.relative) {
    const now = new Date();
    const diffSeconds = Math.floor((now - dateObj) / 1000);
    
    // Just now (within last minute)
    if (diffSeconds < 60) {
      return 'Just now';
    }
    
    // Minutes (within last hour)
    if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    
    // Hours (within last day)
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    
    // Days (within last week)
    if (diffSeconds < 604800) {
      const days = Math.floor(diffSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  }
  
  // Standard date formatting for older dates
  const formatOptions = {
    month: config.shortFormat ? 'short' : 'long',
    day: 'numeric',
    year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  };
  
  // Add time if requested
  if (config.includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
    formatOptions.hour12 = true;
  }
  
  return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
}

/**
 * Debounce a function to prevent frequent calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle a function to limit execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between allowed executions
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 * @param {number} duration - Milliseconds to show toast
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // Add to container
  toastContainer.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.removeChild(toast);
    }, 300); // Match animation duration
  }, duration);
}

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get file extension from filename
 * @param {string} filename - Filename to process
 * @returns {string} File extension without dot
 */
export function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted size with unit
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
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
export function getUrlParams(url = window.location.href) {
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

/**
 * Generate a unique ID with optional prefix
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Storage wrapper for localStorage with JSON support
 */
export const storage = {
  /**
   * Get an item from storage
   * @param {string} key - Storage key
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Stored value or default
   */
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return defaultValue;
    }
  },
  
  /**
   * Set an item in storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  },
  
  /**
   * Remove an item from storage
   * @param {string} key - Storage key
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  },
  
  /**
   * Clear all storage
   */
  clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
};

// Export all utilities as default object
export default {
  formatDate,
  debounce,
  throttle,
  showToast,
  generateUUID,
  generateUniqueId,
  escapeHtml,
  getFileExtension,
  formatFileSize,
  copyToClipboard,
  getUrlParams,
  storage
};
