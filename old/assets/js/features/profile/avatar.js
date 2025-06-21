/**
 * Profile Avatar Module
 * 
 * This module handles user avatar uploads and management:
 * - Avatar uploads
 * - Avatar cropping
 * - Default avatars
 * - Avatar removal
 */

// Import file optimization helpers if available
let FileOptimizationHelpers;
try {
  if (typeof window !== 'undefined' && window.FileOptimizationHelpers) {
    FileOptimizationHelpers = window.FileOptimizationHelpers;
  }
} catch (e) {
  console.warn('FileOptimizationHelpers not available');
}

// Profile avatar functionality
export const profileAvatar = {
  /**
   * Initialize avatar functionality
   */
  init() {
    console.log('Initializing profile avatar module');
    
    // Find avatar elements
    this.avatarContainer = document.querySelector('.profile-avatar-container');
    this.avatarUploadInput = document.querySelector('.avatar-upload-input');
    this.avatarPreview = document.querySelector('.avatar-preview');
    this.avatarRemoveBtn = document.querySelector('.avatar-remove-button');
    
    if (this.avatarContainer) {
      this._setupEventListeners();
    }
    
    return true;
  },
  
  /**
   * Set up event listeners for avatar functionality
   * @private
   */
  _setupEventListeners() {
    // Listen for avatar upload input changes
    if (this.avatarUploadInput) {
      this.avatarUploadInput.addEventListener('change', this._handleAvatarSelect.bind(this));
    }
    
    // Listen for avatar remove button clicks
    if (this.avatarRemoveBtn) {
      this.avatarRemoveBtn.addEventListener('click', this._handleAvatarRemove.bind(this));
    }
    
    // Listen for drop events on avatar container
    if (this.avatarContainer) {
      this.avatarContainer.addEventListener('dragover', this._handleDragOver.bind(this));
      this.avatarContainer.addEventListener('drop', this._handleDrop.bind(this));
    }
  },
  
  /**
   * Handle avatar file selection
   * @private
   * @param {Event} event - Change event
   */
  _handleAvatarSelect(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this._processAvatarFile(files[0]);
    }
  },
  
  /**
   * Handle file drop on avatar container
   * @private
   * @param {Event} event - Drop event
   */
  _handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    this.avatarContainer.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      this._processAvatarFile(files[0]);
    }
  },
  
  /**
   * Handle dragover on avatar container
   * @private
   * @param {Event} event - Dragover event
   */
  _handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    this.avatarContainer.classList.add('drag-over');
  },
  
  /**
   * Process avatar file
   * @private
   * @param {File} file - Image file
   */
  async _processAvatarFile(file) {
    // Validate file
    if (!file.type.startsWith('image/')) {
      this._showErrorMessage('Please select an image file (JPEG, PNG, GIF)');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this._showErrorMessage('Avatar image must be less than 5MB');
      return;
    }
    
    try {
      // Show loading state
      this.avatarContainer.classList.add('loading');
      
      // Use FileOptimizationHelpers if available
      if (FileOptimizationHelpers) {
        const fileInput = this.avatarUploadInput;
        const result = await FileOptimizationHelpers.optimizeImageUpload(fileInput, {
          maxWidth: 512,
          maxHeight: 512,
          quality: 0.9,
          cropSquare: true
        });
        
        if (result.success) {
          // Use the optimized file
          this._displayAvatarPreview(result.results[0].optimizedUrl);
          this._uploadAvatarToServer(result.results[0].optimizedFile);
        } else {
          // Fall back to default processing
          this._processFileWithDefaultMethod(file);
        }
      } else {
        // Use default file processing
        this._processFileWithDefaultMethod(file);
      }
    } catch (error) {
      console.error('Error processing avatar file', error);
      this._showErrorMessage('Error processing image. Please try again.');
      this.avatarContainer.classList.remove('loading');
    }
  },
  
  /**
   * Process file with default method (no optimization)
   * @private
   * @param {File} file - Image file
   */
  _processFileWithDefaultMethod(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this._displayAvatarPreview(e.target.result);
      this._uploadAvatarToServer(file);
    };
    
    reader.onerror = () => {
      this._showErrorMessage('Error reading file');
      this.avatarContainer.classList.remove('loading');
    };
    
    reader.readAsDataURL(file);
  },
  
  /**
   * Display avatar preview
   * @private
   * @param {string} dataUrl - Image data URL
   */
  _displayAvatarPreview(dataUrl) {
    if (this.avatarPreview) {
      this.avatarPreview.src = dataUrl;
      this.avatarPreview.classList.add('has-avatar');
    }
  },
  
  /**
   * Upload avatar to server
   * @private
   * @param {File|Blob} fileOrBlob - File or Blob to upload
   */
  async _uploadAvatarToServer(fileOrBlob) {
    try {
      const formData = new FormData();
      formData.append('avatar', fileOrBlob);
      
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      if (csrfToken) {
        formData.append('csrf_token', csrfToken);
      }
      
      // Send to server
      const response = await fetch('/api/avatar.php', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Show success message
        this._showSuccessMessage('Avatar updated successfully!');
        
        // Update any other avatar instances on the page
        document.querySelectorAll('.user-avatar').forEach(avatar => {
          // Add timestamp to bust cache
          avatar.src = result.avatarUrl + '?t=' + new Date().getTime();
        });
        
        // Dispatch event to notify other components
        const event = new CustomEvent('profile:avatar:update', { 
          detail: { avatarUrl: result.avatarUrl }
        });
        document.dispatchEvent(event);
      } else {
        this._showErrorMessage(result.message || 'Failed to upload avatar');
      }
    } catch (error) {
      console.error('Error uploading avatar', error);
      this._showErrorMessage('Error uploading avatar. Please try again.');
    } finally {
      // Remove loading state
      this.avatarContainer.classList.remove('loading');
    }
  },
  
  /**
   * Handle avatar removal
   * @private
   * @param {Event} event - Click event
   */
  async _handleAvatarRemove(event) {
    event.preventDefault();
    
    try {
      // Show loading state
      this.avatarContainer.classList.add('loading');
      
      // Send removal request to server
      const response = await fetch('/api/avatar.php', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Reset avatar preview
        if (this.avatarPreview) {
          this.avatarPreview.src = '/assets/images/default-avatar.svg';
          this.avatarPreview.classList.remove('has-avatar');
        }
        
        // Update any other avatar instances on the page
        document.querySelectorAll('.user-avatar').forEach(avatar => {
          avatar.src = '/assets/images/default-avatar.svg';
        });
        
        // Show success message
        this._showSuccessMessage('Avatar removed successfully!');
        
        // Dispatch event to notify other components
        const event = new CustomEvent('profile:avatar:remove');
        document.dispatchEvent(event);
      } else {
        this._showErrorMessage(result.message || 'Failed to remove avatar');
      }
    } catch (error) {
      console.error('Error removing avatar', error);
      this._showErrorMessage('Error removing avatar. Please try again.');
    } finally {
      // Remove loading state
      this.avatarContainer.classList.remove('loading');
    }
  },
  
  /**
   * Show success message
   * @private
   * @param {string} message - Success message
   */
  _showSuccessMessage(message) {
    const messageElement = document.querySelector('.avatar-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.add('success');
      messageElement.classList.remove('error');
      messageElement.classList.remove('hidden');
      
      // Hide after a few seconds
      setTimeout(() => {
        messageElement.classList.add('hidden');
      }, 3000);
    }
  },
  
  /**
   * Show error message
   * @private
   * @param {string} message - Error message
   */
  _showErrorMessage(message) {
    const messageElement = document.querySelector('.avatar-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.add('error');
      messageElement.classList.remove('success');
      messageElement.classList.remove('hidden');
    }
  }
};

export default profileAvatar;
