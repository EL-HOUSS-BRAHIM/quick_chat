/**
 * API Client Service - Organized Architecture
 * 
 * Provides a unified interface for making API calls to the server.
 * Handles authentication, request formatting, and response parsing.
 * Migrated from assets/js/services/api-client.js
 */

import { logger } from '../utils/logger.js';
import { EventBus } from './EventBus.js';

class ApiClient {
  constructor() {
    this.baseUrl = '/api/v1';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    this.eventBus = new EventBus();
    this.initialized = false;
  }

  /**
   * Initialize the API client
   */
  async init() {
    try {
      // Set up CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]');
      if (csrfToken) {
        this.defaultHeaders['X-CSRF-Token'] = csrfToken.getAttribute('content');
      }

      // Check if user is authenticated and set token
      const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (authToken) {
        this.setAuthToken(authToken);
      }

      this.initialized = true;
      logger.info('API Client initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize API Client:', error);
      throw error;
    }
  }

  /**
   * Add authorization header to requests
   * @param {string} token - JWT or session token
   */
  setAuthToken(token) {
    if (token) {
      this.defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders['Authorization'];
    }
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<any>} - Response data
   */
  async get(endpoint, params = {}) {
    const url = new URL(this.baseUrl + endpoint, window.location.origin);
    
    // Add query parameters
    Object.keys(params).forEach(key => 
      url.searchParams.append(key, params[key])
    );
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.defaultHeaders,
      credentials: 'same-origin'
    });
    
    return this._handleResponse(response);
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} - Response data
   */
  async post(endpoint, data = {}) {
    const url = this.baseUrl + endpoint;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.defaultHeaders,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    
    return this._handleResponse(response);
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} - Response data
   */
  async put(endpoint, data = {}) {
    const url = this.baseUrl + endpoint;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.defaultHeaders,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    
    return this._handleResponse(response);
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @returns {Promise<any>} - Response data
   */
  async delete(endpoint, data = {}) {
    const url = this.baseUrl + endpoint;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.defaultHeaders,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    
    return this._handleResponse(response);
  }

  /**
   * Upload file with progress tracking
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - File data
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<any>} - Response data
   */
  async upload(endpoint, formData, onProgress = null) {
    const url = this.baseUrl + endpoint;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });
      
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });
      
      // Prepare headers (excluding Content-Type for multipart)
      const headers = { ...this.defaultHeaders };
      delete headers['Content-Type'];
      
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.open('POST', url);
      xhr.withCredentials = true;
      xhr.send(formData);
    });
  }

  /**
   * Handle API response
   * @param {Response} response - Fetch response
   * @returns {Promise<any>} - Parsed response data
   * @private
   */
  async _handleResponse(response) {
    try {
      // Handle different content types
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      if (!response.ok) {
        // Handle API errors
        const error = new Error(data.message || `API Error: ${response.status}`);
        error.status = response.status;
        error.data = data;
        
        this.eventBus.emit('api:error', { error, endpoint: response.url });
        throw error;
      }
      
      this.eventBus.emit('api:success', { data, endpoint: response.url });
      return data;
      
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  // Chat-specific API methods
  
  /**
   * Get messages for a chat
   */
  async getMessages(chatType, chatId, params = {}) {
    const endpoint = chatType === 'group' 
      ? `/groups/${chatId}/messages`
      : `/chats/${chatId}/messages`;
    return this.get(endpoint, params);
  }

  /**
   * Send a message
   */
  async sendMessage(chatType, chatId, messageData) {
    const endpoint = chatType === 'group'
      ? `/groups/${chatId}/messages`
      : `/chats/${chatId}/messages`;
    return this.post(endpoint, messageData);
  }

  /**
   * Get user info
   */
  async getUser(userId) {
    return this.get(`/users/${userId}`);
  }

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    return this.get('/users/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    return this.put('/users/me', profileData);
  }

  /**
   * Get groups for current user
   */
  async getGroups() {
    return this.get('/groups');
  }

  /**
   * Create a new group
   */
  async createGroup(groupData) {
    return this.post('/groups', groupData);
  }

  /**
   * Get group information
   */
  async getGroup(groupId) {
    return this.get(`/groups/${groupId}`);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();
export default apiClient;
