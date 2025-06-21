/**
 * Helper Utilities
 * Common utility functions used throughout the application
 */

/**
 * Format date for display
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Formatting options
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return dateObj.toLocaleDateString(undefined, formatOptions);
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date|string|number} date - Date to format
 */
export function getRelativeTime(date) {
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Get current page name from URL
 */
export function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.substring(path.lastIndexOf('/') + 1);
  
  if (filename.includes('chat') || filename.includes('private-chat') || filename.includes('group-chat')) {
    return filename.replace('.php', '');
  } else if (filename.includes('dashboard')) {
    return 'dashboard';
  } else if (filename.includes('profile')) {
    return 'profile';
  } else if (filename.includes('admin')) {
    return 'admin';
  }
  
  return filename.replace('.php', '') || 'index';
}

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 */
export function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Set URL parameter
 * @param {string} name - Parameter name
 * @param {string} value - Parameter value
 * @param {boolean} replaceState - Whether to replace state or push new state
 */
export function setUrlParam(name, value, replaceState = true) {
  const url = new URL(window.location);
  url.searchParams.set(name, value);
  
  if (replaceState) {
    window.history.replaceState({}, '', url);
  } else {
    window.history.pushState({}, '', url);
  }
}

/**
 * Remove URL parameter
 * @param {string} name - Parameter name
 */
export function removeUrlParam(name) {
  const url = new URL(window.location);
  url.searchParams.delete(name);
  window.history.replaceState({}, '', url);
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 */
export function debounce(func, wait) {
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
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 */
export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate unique ID
 * @param {string} prefix - ID prefix
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone object
 * @param {*} obj - Object to clone
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 */
export function isEmpty(obj) {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
}

/**
 * Merge objects deeply
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects
 */
export function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Check if value is object
 * @param {*} item - Item to check
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Sanitize string for HTML
 * @param {string} str - String to sanitize
 */
export function sanitizeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Escape regex special characters
 * @param {string} str - String to escape
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert string to slug
 * @param {string} str - String to convert
 */
export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to append
 */
export function truncate(str, length, suffix = '...') {
  if (str.length <= length) return str;
  return str.substring(0, length - suffix.length) + suffix;
}

/**
 * Format duration in milliseconds to human readable
 * @param {number} ms - Duration in milliseconds
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Check if device is mobile
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if device is touch enabled
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Get device type
 */
export function getDeviceType() {
  if (isMobile()) {
    return /iPad|Android(?=.*Tablet)|(?=.*\bTablet\b)/i.test(navigator.userAgent) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Wait for specified time
 * @param {number} ms - Milliseconds to wait
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 */
export async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
}

/**
 * Create cancelable promise
 * @param {Promise} promise - Promise to make cancelable
 */
export function makeCancelable(promise) {
  let canceled = false;
  
  const wrappedPromise = new Promise((resolve, reject) => {
    promise
      .then(value => canceled ? reject(new Error('Canceled')) : resolve(value))
      .catch(error => canceled ? reject(new Error('Canceled')) : reject(error));
  });
  
  return {
    promise: wrappedPromise,
    cancel: () => {
      canceled = true;
    }
  };
}

/**
 * Get browser information
 */
export function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = 'Unknown';
  
  if (ua.includes('Chrome')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Firefox')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browser = 'Safari';
    version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
    version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
  }
  
  return { browser, version, userAgent: ua };
}

/**
 * Local storage utilities
 */
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to get from storage:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Failed to set in storage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove from storage:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }
};

/**
 * Session storage utilities
 */
export const sessionStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to get from session storage:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Failed to set in session storage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      window.sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove from session storage:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      window.sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear session storage:', error);
      return false;
    }
  }
};

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format time for display
 * @param {Date|string|number} date - Date to format
 * @param {Object} options - Formatting options
 */
export function formatTime(date, options = {}) {
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit'
  };
  
  const formatOptions = { ...defaultOptions, ...options };
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '--:--';
  }
  
  return dateObj.toLocaleTimeString(undefined, formatOptions);
}

/**
 * Format date and time
 * @param {Date|string|number} date - Date to format
 */
export function formatDateTime(date) {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return dateObj.toLocaleString();
}

/**
 * Convert bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Time ago helper
 * @param {Date|string|number} date - Date to format
 */
export function timeAgo(date) {
  return getRelativeTime(date);
}

// Create a helpers object that includes all the functions
export const helpers = {
  formatDate,
  formatTime,
  formatDateTime,
  formatBytes,
  timeAgo,
  getRelativeTime,
  escapeHtml,
  getCurrentPage,
  getUrlParam,
  setUrlParam,
  removeUrlParam,
  generateId,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  isEmpty,
  truncate,
  slugify,
  sanitizeHtml: escapeHtml, // alias
  copyToClipboard,
  isMobile,
  isTouchDevice,
  getDeviceType,
  getBrowserInfo,
  storage,
  sessionStorage,
  sleep,
  retry,
  makeCancelable,
  escapeRegex,
  formatFileSize: formatBytes,
  formatDuration
};
