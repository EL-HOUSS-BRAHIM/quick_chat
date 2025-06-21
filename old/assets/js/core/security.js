/**
 * Core security module for Quick Chat
 * Provides security utilities including CSRF protection, input sanitization,
 * validation, password strength checking, and secure storage
 */

/**
 * Get CSRF token from meta tag
 * @returns {string} CSRF token or empty string if not found
 */
export function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Sanitize input with XSS protection
 * @param {*} input - Input to sanitize
 * @returns {string|Array} Sanitized input
 */
export function sanitizeInput(input) {
  if (!input) return '';
    
  // Handle various input types
  if (typeof input !== 'string') {
    if (input instanceof Array) {
      return input.map(item => sanitizeInput(item));
    }
    return String(input);
  }
    
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
export function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Check password strength on a scale of 0-5
 * @param {string} password - Password to check
 * @returns {number} Strength score from 0 (weakest) to 5 (strongest)
 */
export function checkPasswordStrength(password) {
  if (!password) return 0;
    
  let score = 0;
    
  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
    
  // Complexity checks
  if (/[A-Z]/.test(password)) score += 1; // Uppercase
  if (/[a-z]/.test(password)) score += 1; // Lowercase
  if (/[0-9]/.test(password)) score += 1; // Numbers
  if (/[^A-Za-z0-9]/.test(password)) score += 1; // Special characters
    
  // Penalize sequential or repeated patterns
  if (/(.)\1{2,}/.test(password)) score -= 1; // Same character repeated
  if (/123|234|345|456|567|678|789|987|876|765|654|543|432|321/.test(password)) score -= 1; // Sequential
    
  return Math.max(0, Math.min(5, score)); // Score between 0-5
}

/**
 * Sanitize URL to prevent JavaScript injection
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
export function sanitizeUrl(url) {
  if (!url) return '';
    
  // Ensure the URL doesn't contain JavaScript
  const sanitized = String(url).replace(/javascript:/gi, '');
    
  // Ensure protocol is http or https
  if (sanitized.startsWith('//')) {
    return 'https:' + sanitized;
  }
    
  if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
    return 'https://' + sanitized;
  }
    
  return sanitized;
}

/**
 * Secure storage wrapper for localStorage with expiration support
 */
export const secureStorage = {
  /**
     * Store an item with optional expiration
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {number|null} expireInMinutes - Minutes until expiration or null for no expiration
     * @returns {boolean} Success status
     */
  setItem(key, value, expireInMinutes = null) {
    try {
      const item = {
        value: value,
        timestamp: Date.now()
      };
            
      if (expireInMinutes) {
        item.expires = Date.now() + (expireInMinutes * 60 * 1000);
      }
            
      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (e) {
      console.error('SecureStorage error:', e);
      return false;
    }
  },
    
  /**
     * Retrieve an item, checking for expiration
     * @param {string} key - Storage key
     * @returns {*} Stored value or null if expired/not found
     */
  getItem(key) {
    try {
      const item = JSON.parse(localStorage.getItem(key));
      if (!item) return null;
            
      // Check if item is expired
      if (item.expires && Date.now() > item.expires) {
        localStorage.removeItem(key);
        return null;
      }
            
      return item.value;
    } catch (e) {
      return null;
    }
  },
    
  /**
     * Remove an item from storage
     * @param {string} key - Storage key
     */
  removeItem(key) {
    localStorage.removeItem(key);
  },
    
  /**
     * Clear all items from storage
     */
  clear() {
    localStorage.clear();
  }
};

// Default export for convenient importing
export default {
  getCsrfToken,
  sanitizeInput,
  validateEmail,
  checkPasswordStrength,
  sanitizeUrl,
  secureStorage
};
