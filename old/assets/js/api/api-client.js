/**
 * API Client Module
 * Centralized API access with error handling, retries, and offline support
 */

import errorHandler from '../core/error-handler.js';

class ApiClient {
  constructor(options = {}) {
    this.options = {
      baseUrl: '/api',
      defaultHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000, // 30 seconds
      retryOnError: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
    
    // Queue for offline requests
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    
    // Set up network status monitoring
    this.setupNetworkMonitoring();
  }

  /**
   * Monitor online/offline status
   */
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Process queued API requests when connection is restored
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0 || !this.isOnline) {
      return;
    }
    
    // Process queue in order
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    
    for (const request of queue) {
      try {
        const response = await this.request(
          request.endpoint,
          request.method,
          request.data,
          request.headers
        );
        
        if (request.resolve) {
          request.resolve(response);
        }
      } catch (error) {
        if (request.reject) {
          request.reject(error);
        }
      }
    }
  }

  /**
   * Get CSRF token from the page
   */
  getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.getAttribute('content') : '';
  }

  /**
   * Make an API request
   */
  async request(endpoint, method = 'GET', data = null, customHeaders = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.options.baseUrl}${endpoint}`;
    const csrfToken = this.getCsrfToken();
    
    const headers = {
      ...this.options.defaultHeaders,
      ...customHeaders
    };
    
    // Add CSRF token if available
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    const config = {
      method,
      headers,
      credentials: 'same-origin'
    };
    
    // Add request body for non-GET requests
    if (method !== 'GET' && data !== null) {
      config.body = headers['Content-Type'] === 'application/json' ? 
        JSON.stringify(data) : 
        data;
    }
    
    // If offline, queue request for later
    if (!this.isOnline && method !== 'GET') {
      return new Promise((resolve, reject) => {
        this.offlineQueue.push({
          endpoint,
          method,
          data,
          headers: customHeaders,
          resolve,
          reject
        });
      });
    }
    
    try {
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.options.timeout);
      });
      
      // Make request with timeout
      const response = await Promise.race([
        fetch(url, config),
        timeoutPromise
      ]);
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorData = await this.parseResponseData(response);
        throw new Error(errorData.message || `HTTP Error ${response.status}`);
      }
      
      // Parse response
      return await this.parseResponseData(response);
    } catch (error) {
      // Retry if enabled and appropriate
      if (this.options.retryOnError && method === 'GET') {
        return this.retryRequest(endpoint, method, data, customHeaders);
      }
      
      // Log and rethrow
      errorHandler.handleError(error);
      throw error;
    }
  }

  /**
   * Parse response based on content type
   */
  async parseResponseData(response) {
    const contentType = response.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return await response.text();
    } else {
      return await response.blob();
    }
  }

  /**
   * Retry a failed request with backoff
   */
  async retryRequest(endpoint, method, data, headers, retryCount = 0) {
    if (retryCount >= this.options.maxRetries) {
      throw new Error(`Request failed after ${retryCount} retries`);
    }
    
    // Exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      return await this.request(endpoint, method, data, headers);
    } catch (error) {
      return this.retryRequest(endpoint, method, data, headers, retryCount + 1);
    }
  }

  /**
   * Convenience method for GET requests
   */
  get(endpoint, params = {}, headers = {}) {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${window.location.origin}${this.options.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return this.request(url.toString(), 'GET', null, headers);
  }

  /**
   * Convenience method for POST requests
   */
  post(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, 'POST', data, headers);
  }

  /**
   * Convenience method for PUT requests
   */
  put(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, 'PUT', data, headers);
  }

  /**
   * Convenience method for PATCH requests
   */
  patch(endpoint, data = {}, headers = {}) {
    return this.request(endpoint, 'PATCH', data, headers);
  }

  /**
   * Convenience method for DELETE requests
   */
  delete(endpoint, headers = {}) {
    return this.request(endpoint, 'DELETE', null, headers);
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
