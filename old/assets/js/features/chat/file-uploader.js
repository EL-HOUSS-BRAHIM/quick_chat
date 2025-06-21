/**
 * File Uploader
 * Handles file uploads with progress tracking
 */

import apiClient from '../../api/api-client.js';
import eventBus from '../../core/event-bus.js';
import utils from '../../core/utils.js';

class FileUploader {
  constructor() {
    // Track ongoing uploads
    this.uploads = new Map();
    
    // Configuration
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'application/pdf',
        'application/zip',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ]
    };
  }

  /**
   * Upload a file
   * @param {FormData} formData - Form data with file
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(formData) {
    // Generate unique ID for this upload
    const uploadId = utils.generateUUID();
    
    // Get the file from form data
    const file = formData.get('file');
    
    // Validate file
    this.validateFile(file);
    
    // Create upload tracker
    const upload = {
      id: uploadId,
      file,
      progress: 0,
      status: 'pending',
      abortController: new AbortController()
    };
    
    // Add to uploads map
    this.uploads.set(uploadId, upload);
    
    // Emit upload started event
    eventBus.emit('upload:started', {
      id: uploadId,
      filename: file.name,
      filesize: file.size,
      filetype: file.type
    });
    
    try {
      // Create custom fetch with progress tracking
      const response = await this.fetchWithProgress(
        '/api/upload',
        {
          method: 'POST',
          body: formData,
          signal: upload.abortController.signal
        },
        (progress) => this.updateProgress(uploadId, progress)
      );
      
      // Parse response
      const result = await response.json();
      
      // Update upload status
      upload.status = 'completed';
      
      // Emit upload completed event
      eventBus.emit('upload:completed', {
        id: uploadId,
        filename: file.name,
        url: result.url
      });
      
      // Remove from uploads map after a delay
      setTimeout(() => {
        this.uploads.delete(uploadId);
      }, 5000);
      
      return result;
    } catch (error) {
      // Check if aborted
      if (error.name === 'AbortError') {
        upload.status = 'cancelled';
        
        // Emit upload cancelled event
        eventBus.emit('upload:cancelled', { id: uploadId });
      } else {
        upload.status = 'error';
        upload.error = error.message;
        
        // Emit upload error event
        eventBus.emit('upload:error', { 
          id: uploadId,
          error: error.message
        });
      }
      
      // Remove from uploads map after a delay
      setTimeout(() => {
        this.uploads.delete(uploadId);
      }, 5000);
      
      throw error;
    }
  }

  /**
   * Upload multiple files
   * @param {FileList|Array} files - Files to upload
   * @returns {Promise<Array>} Upload results
   */
  async uploadFiles(files) {
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      
      try {
        const result = await this.uploadFile(formData);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Validate a file before upload
   * @param {File} file - File to validate
   * @throws {Error} If validation fails
   */
  validateFile(file) {
    // Check if file exists
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed (${utils.formatFileSize(this.config.maxFileSize)})`);
    }
    
    // Check file type
    if (this.config.allowedTypes.length > 0 && !this.config.allowedTypes.includes(file.type)) {
      throw new Error(`File type not allowed: ${file.type}`);
    }
  }

  /**
   * Fetch with progress tracking
   * @param {string} url - Fetch URL
   * @param {Object} options - Fetch options
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Response>} Fetch response
   */
  fetchWithProgress(url, options, progressCallback) {
    return new Promise((resolve, reject) => {
      // Create XML HTTP Request
      const xhr = new XMLHttpRequest();
      
      // Configure request
      xhr.open(options.method || 'GET', url);
      
      // Set headers
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }
      
      // Handle load
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Create a mock response object
          const response = {
            ok: true,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers(),
            text: () => Promise.resolve(xhr.responseText),
            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
            blob: () => Promise.resolve(new Blob([xhr.response]))
          };
          
          resolve(response);
        } else {
          reject(new Error(`HTTP Error: ${xhr.status}`));
        }
      };
      
      // Handle error
      xhr.onerror = () => {
        reject(new Error('Network error'));
      };
      
      // Handle abort
      xhr.onabort = () => {
        reject(new Error('Upload aborted'));
      };
      
      // Handle progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          progressCallback(progress);
        }
      };
      
      // Handle timeout
      xhr.ontimeout = () => {
        reject(new Error('Upload timed out'));
      };
      
      // Set abort controller
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
        });
      }
      
      // Send request
      xhr.send(options.body);
    });
  }

  /**
   * Update upload progress
   * @param {string} uploadId - Upload ID
   * @param {number} progress - Progress percentage
   */
  updateProgress(uploadId, progress) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;
    
    upload.progress = progress;
    
    // Emit progress event
    eventBus.emit('upload:progress', {
      id: uploadId,
      progress
    });
  }

  /**
   * Cancel an upload
   * @param {string} uploadId - Upload ID
   * @returns {boolean} Success
   */
  cancelUpload(uploadId) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return false;
    
    // Abort the fetch request
    upload.abortController.abort();
    
    return true;
  }

  /**
   * Get all active uploads
   * @returns {Array} Active uploads
   */
  getActiveUploads() {
    return Array.from(this.uploads.values())
      .filter(upload => ['pending', 'uploading'].includes(upload.status));
  }

  /**
   * Get upload by ID
   * @param {string} uploadId - Upload ID
   * @returns {Object|null} Upload
   */
  getUpload(uploadId) {
    return this.uploads.get(uploadId) || null;
  }
}

export default FileUploader;
