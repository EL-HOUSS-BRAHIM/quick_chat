/**
 * API Client Service
 * 
 * Provides a unified interface for making API calls to the server.
 * Handles authentication, request formatting, and response parsing.
 */

class ApiClient {
  constructor() {
    this.baseUrl = '/api/v1';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
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
   * Upload files to the server
   * @param {string} endpoint - API endpoint
   * @param {FormData} formData - Form data with files
   * @param {Function} progressCallback - Callback for upload progress
   * @returns {Promise<any>} - Response data
   */
  async uploadFiles(endpoint, formData, progressCallback = null) {
    const url = this.baseUrl + endpoint;
    
    // Remove content-type header so browser can set it with boundary
    const headers = { ...this.defaultHeaders };
    delete headers['Content-Type'];
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', url, true);
      
      // Set headers
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      // Handle progress
      if (progressCallback) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressCallback(percentComplete, e);
          }
        };
      }
      
      // Handle completion
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid JSON response from server'));
          }
        } else {
          reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`));
        }
      };
      
      // Handle errors
      xhr.onerror = () => reject(new Error('Network error during upload'));
      
      // Send the form data
      xhr.send(formData);
    });
  }

  /**
   * Handle API response
   * @private
   * @param {Response} response - Fetch API response
   * @returns {Promise<any>} - Parsed response data
   */
  async _handleResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (response.ok) {
        return data;
      }
      
      // Handle error responses with JSON body
      throw new Error(data.message || `API error: ${response.status}`);
    }
    
    // Handle non-JSON responses
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  }
}

// Create a singleton instance
const apiClient = new ApiClient();

export default apiClient;
