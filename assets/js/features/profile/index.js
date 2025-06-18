/**
 * Profile Module
 * Handles user profile management functionality
 */

import app from '../../core/app.js';
import eventBus from '../../core/event-bus.js';
import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { state } from '../../core/state.js';
import utils from '../../core/utils.js';

class ProfileModule {
  constructor(options = {}) {
    // Configuration
    this.config = {
      userId: null,
      container: document.getElementById('profile-container') || document.body,
      avatarUploadEndpoint: '/api/avatar.php',
      ...options
    };
    
    // State
    this.state = {
      isLoading: false,
      isSaving: false,
      isEditing: false,
      userData: null,
      userStats: null,
      formData: {
        displayName: '',
        email: '',
        bio: '',
        status: '',
        profileVisibility: 'public',
        notificationSettings: {
          email: true,
          push: true,
          messagePreview: true
        }
      },
      uploadProgress: 0,
      errors: {}
    };
    
    // Initialize profile module
    this.init();
  }
  
  /**
   * Initialize the profile module
   */
  async init() {
    try {
      this.config.userId = this.config.userId || app.getCurrentUserId();
      this.registerEventListeners();
      await this.loadUserData();
      this.render();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize profile module');
    }
  }
  
  /**
   * Register event listeners
   */
  registerEventListeners() {
    eventBus.on('user:updated', this.handleUserUpdate.bind(this));
    eventBus.on('avatar:updated', this.handleAvatarUpdate.bind(this));
    
    // DOM event listeners
    const container = this.config.container;
    container.addEventListener('click', this.handleContainerClick.bind(this));
  }
  
  /**
   * Load user data from API
   */
  async loadUserData() {
    try {
      this.state.isLoading = true;
      this.updateUI();
      
      // Fetch user data in parallel
      const [userResponse, statsResponse] = await Promise.all([
        apiClient.get(`/api/users.php?id=${this.config.userId}`),
        apiClient.get(`/api/users/stats?userId=${this.config.userId}`)
      ]);
      
      // Update state with fetched data
      this.state.userData = userResponse.data;
      this.state.userStats = statsResponse.data;
      
      // Populate form data
      this.state.formData = {
        displayName: this.state.userData.displayName || '',
        email: this.state.userData.email || '',
        bio: this.state.userData.bio || '',
        status: this.state.userData.status || '',
        profileVisibility: this.state.userData.profileVisibility || 'public',
        notificationSettings: this.state.userData.notificationSettings || {
          email: true,
          push: true,
          messagePreview: true
        }
      };
      
      // Store in state management
      state.set('profile.userData', this.state.userData);
      
      this.state.isLoading = false;
      this.updateUI();
      
      // Emit events
      eventBus.emit('profile:loaded', { 
        userData: this.state.userData
      });
      
    } catch (error) {
      this.state.isLoading = false;
      this.updateUI();
      errorHandler.handleError(error, 'Failed to load user data');
    }
  }
  
  /**
   * Save user data to API
   */
  async saveUserData() {
    try {
      this.state.isSaving = true;
      this.updateUI();
      
      // Validate form data
      const validationResult = this.validateForm();
      if (!validationResult.isValid) {
        this.state.errors = validationResult.errors;
        this.state.isSaving = false;
        this.updateUI();
        return;
      }
      
      // Prepare data for API
      const userData = {
        id: this.config.userId,
        displayName: this.state.formData.displayName,
        email: this.state.formData.email,
        bio: this.state.formData.bio,
        status: this.state.formData.status,
        profileVisibility: this.state.formData.profileVisibility,
        notificationSettings: this.state.formData.notificationSettings
      };
      
      // Send to API
      const response = await apiClient.post('/api/users.php', userData);
      
      // Update state with response
      this.state.userData = response.data;
      this.state.isSaving = false;
      this.state.isEditing = false;
      this.state.errors = {};
      
      // Update state management
      state.set('profile.userData', this.state.userData);
      
      // Emit events
      eventBus.emit('user:updated', { 
        userData: this.state.userData
      });
      
      this.updateUI();
      
      // Show success message
      this.showMessage('Profile updated successfully!', 'success');
      
    } catch (error) {
      this.state.isSaving = false;
      this.updateUI();
      errorHandler.handleError(error, 'Failed to save user data');
      this.showMessage('Failed to update profile. Please try again.', 'error');
    }
  }
  
  /**
   * Upload new avatar
   */
  async uploadAvatar(file) {
    try {
      if (!file) return;
      
      // Check file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        this.showMessage('Please upload a valid image file (JPEG, PNG, GIF)', 'error');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        this.showMessage('Image file size must be less than 5MB', 'error');
        return;
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('userId', this.config.userId);
      
      // Reset progress
      this.state.uploadProgress = 0;
      this.updateUI();
      
      // Upload with progress tracking
      const response = await apiClient.post(
        this.config.avatarUploadEndpoint, 
        formData, 
        {
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            this.state.uploadProgress = percentCompleted;
            this.updateUI();
          }
        }
      );
      
      // Update avatar in state
      this.state.userData.avatar = response.data.avatarUrl;
      this.state.uploadProgress = 0;
      
      // Update state management
      state.set('profile.userData.avatar', this.state.userData.avatar);
      
      // Emit events
      eventBus.emit('avatar:updated', { 
        avatarUrl: this.state.userData.avatar
      });
      
      this.updateUI();
      
      // Show success message
      this.showMessage('Avatar updated successfully!', 'success');
      
    } catch (error) {
      this.state.uploadProgress = 0;
      this.updateUI();
      errorHandler.handleError(error, 'Failed to upload avatar');
      this.showMessage('Failed to upload avatar. Please try again.', 'error');
    }
  }
  
  /**
   * Validate form data
   */
  validateForm() {
    const errors = {};
    const { displayName, email } = this.state.formData;
    
    // Display name validation
    if (!displayName || displayName.trim() === '') {
      errors.displayName = 'Display name is required';
    } else if (displayName.length < 3) {
      errors.displayName = 'Display name must be at least 3 characters';
    }
    
    // Email validation
    if (!email || email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!this.isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
  
  /**
   * Check if email is valid
   */
  isValidEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }
  
  /**
   * Show message to user
   */
  showMessage(message, type = 'info') {
    // Use app notification system if available
    if (app && typeof app.showNotification === 'function') {
      app.showNotification(message, type);
      return;
    }
    
    // Fallback to alert
    alert(message);
  }
  
  /**
   * Handle user update event
   */
  handleUserUpdate(data) {
    // Update if it's for the current user
    if (data.userData && data.userData.id === this.config.userId) {
      this.state.userData = data.userData;
      this.updateUI();
    }
  }
  
  /**
   * Handle avatar update event
   */
  handleAvatarUpdate(data) {
    if (this.state.userData) {
      this.state.userData.avatar = data.avatarUrl;
      this.updateUI();
    }
  }
  
  /**
   * Toggle edit mode
   */
  toggleEditMode() {
    this.state.isEditing = !this.state.isEditing;
    
    if (this.state.isEditing) {
      // Reset form data from user data when entering edit mode
      this.state.formData = {
        displayName: this.state.userData.displayName || '',
        email: this.state.userData.email || '',
        bio: this.state.userData.bio || '',
        status: this.state.userData.status || '',
        profileVisibility: this.state.userData.profileVisibility || 'public',
        notificationSettings: this.state.userData.notificationSettings || {
          email: true,
          push: true,
          messagePreview: true
        }
      };
      this.state.errors = {};
    }
    
    this.updateUI();
  }
  
  /**
   * Handle container click events
   */
  handleContainerClick(e) {
    const target = e.target;
    
    // Edit profile button
    if (target.matches('#edit-profile-btn')) {
      e.preventDefault();
      this.toggleEditMode();
    }
    
    // Save profile button
    else if (target.matches('#save-profile-btn')) {
      e.preventDefault();
      this.saveUserData();
    }
    
    // Cancel edit button
    else if (target.matches('#cancel-edit-btn')) {
      e.preventDefault();
      this.toggleEditMode();
    }
    
    // Avatar upload trigger
    else if (target.matches('#avatar-upload-trigger') || target.closest('#avatar-upload-trigger')) {
      e.preventDefault();
      document.getElementById('avatar-upload-input').click();
    }
  }
  
  /**
   * Handle form input changes
   */
  handleInputChange(e) {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    
    if (name.startsWith('notification-')) {
      const settingName = name.replace('notification-', '');
      this.state.formData.notificationSettings[settingName] = value;
    } else {
      this.state.formData[name] = value;
    }
    
    // Clear error for this field if it exists
    if (this.state.errors[name]) {
      delete this.state.errors[name];
    }
    
    this.updateUI();
  }
  
  /**
   * Handle file input change for avatar
   */
  handleFileInputChange(e) {
    const file = e.target.files[0];
    if (file) {
      this.uploadAvatar(file);
    }
  }
  
  /**
   * Render the profile UI
   */
  render() {
    const container = this.config.container;
    const userData = this.state.userData;
    const formData = this.state.formData;
    const errors = this.state.errors;
    
    // Show loading state if needed
    if (this.state.isLoading) {
      container.innerHTML = '<div class="loading-spinner">Loading profile...</div>';
      return;
    }
    
    // Render error if no user data
    if (!userData) {
      container.innerHTML = '<div class="error-message">Failed to load user profile. Please try refreshing the page.</div>';
      return;
    }
    
    // Render profile content
    container.innerHTML = `
      <div class="profile-container ${this.state.isEditing ? 'editing' : ''}">
        <div class="profile-header">
          <div class="avatar-container">
            <div class="avatar ${this.state.uploadProgress > 0 ? 'uploading' : ''}">
              <img src="${userData.avatar || '/assets/images/default-avatar.svg'}" alt="${userData.displayName}">
              ${this.state.uploadProgress > 0 ? 
                `<div class="upload-progress-overlay">
                  <div class="progress-bar" style="width: ${this.state.uploadProgress}%"></div>
                  <div class="progress-text">${this.state.uploadProgress}%</div>
                </div>` : ''}
            </div>
            ${this.state.isEditing ? 
              `<button id="avatar-upload-trigger" class="avatar-upload-button">
                <i class="icon-camera"></i>
                <span>Change Photo</span>
              </button>
              <input type="file" id="avatar-upload-input" style="display: none" accept="image/*">` : ''}
          </div>
          
          <div class="profile-info">
            <h1 class="display-name">${userData.displayName}</h1>
            <div class="user-status ${userData.isOnline ? 'online' : 'offline'}">
              ${userData.isOnline ? 'Online' : 'Offline'}
            </div>
            
            ${!this.state.isEditing ?
              `<div class="user-stats">
                <div class="stat">
                  <span class="stat-value">${this.state.userStats?.messagesCount || 0}</span>
                  <span class="stat-label">Messages</span>
                </div>
                <div class="stat">
                  <span class="stat-value">${this.state.userStats?.groups?.length || 0}</span>
                  <span class="stat-label">Groups</span>
                </div>
                <div class="stat">
                  <span class="stat-value">${this.state.userStats?.friends?.length || 0}</span>
                  <span class="stat-label">Friends</span>
                </div>
              </div>` : ''}
          </div>
          
          <div class="profile-actions">
            ${!this.state.isEditing ? 
              `<button id="edit-profile-btn" class="btn primary">Edit Profile</button>` : 
              `<button id="save-profile-btn" class="btn primary ${this.state.isSaving ? 'loading' : ''}">
                ${this.state.isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button id="cancel-edit-btn" class="btn secondary">Cancel</button>`}
          </div>
        </div>
        
        <div class="profile-content">
          ${this.state.isEditing ? this.renderEditForm() : this.renderProfileDetails()}
        </div>
      </div>
    `;
    
    // Setup event listeners after rendering
    this.setupUIEventListeners();
  }
  
  /**
   * Render profile details view
   */
  renderProfileDetails() {
    const userData = this.state.userData;
    
    return `
      <div class="profile-details">
        <section class="profile-section">
          <h3>About</h3>
          <p class="bio">${userData.bio || 'No bio provided'}</p>
        </section>
        
        <section class="profile-section">
          <h3>Contact Information</h3>
          <div class="info-item">
            <i class="icon-mail"></i>
            <span>${userData.email}</span>
          </div>
        </section>
        
        <section class="profile-section">
          <h3>Account Information</h3>
          <div class="info-item">
            <span class="label">Member Since:</span>
            <span>${new Date(userData.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="info-item">
            <span class="label">Last Active:</span>
            <span>${this.formatLastActive(userData.lastActive)}</span>
          </div>
          <div class="info-item">
            <span class="label">Profile Visibility:</span>
            <span>${this.formatVisibility(userData.profileVisibility)}</span>
          </div>
        </section>
      </div>
    `;
  }
  
  /**
   * Render edit form view
   */
  renderEditForm() {
    const formData = this.state.formData;
    const errors = this.state.errors;
    
    return `
      <form class="profile-edit-form">
        <section class="form-section">
          <h3>Basic Information</h3>
          
          <div class="form-group ${errors.displayName ? 'has-error' : ''}">
            <label for="displayName">Display Name</label>
            <input type="text" id="displayName" name="displayName" value="${formData.displayName}" />
            ${errors.displayName ? `<div class="error-message">${errors.displayName}</div>` : ''}
          </div>
          
          <div class="form-group ${errors.email ? 'has-error' : ''}">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" value="${formData.email}" />
            ${errors.email ? `<div class="error-message">${errors.email}</div>` : ''}
          </div>
          
          <div class="form-group">
            <label for="bio">Bio</label>
            <textarea id="bio" name="bio" rows="4">${formData.bio}</textarea>
          </div>
          
          <div class="form-group">
            <label for="status">Status</label>
            <input type="text" id="status" name="status" value="${formData.status}" placeholder="What's on your mind?" />
          </div>
        </section>
        
        <section class="form-section">
          <h3>Privacy Settings</h3>
          
          <div class="form-group">
            <label for="profileVisibility">Profile Visibility</label>
            <select id="profileVisibility" name="profileVisibility">
              <option value="public" ${formData.profileVisibility === 'public' ? 'selected' : ''}>Public - Visible to everyone</option>
              <option value="friends" ${formData.profileVisibility === 'friends' ? 'selected' : ''}>Friends Only - Visible to friends</option>
              <option value="private" ${formData.profileVisibility === 'private' ? 'selected' : ''}>Private - Visible only to you</option>
            </select>
          </div>
        </section>
        
        <section class="form-section">
          <h3>Notification Settings</h3>
          
          <div class="form-group checkbox">
            <input type="checkbox" id="notification-email" name="notification-email" 
              ${formData.notificationSettings?.email ? 'checked' : ''} />
            <label for="notification-email">Email Notifications</label>
          </div>
          
          <div class="form-group checkbox">
            <input type="checkbox" id="notification-push" name="notification-push" 
              ${formData.notificationSettings?.push ? 'checked' : ''} />
            <label for="notification-push">Push Notifications</label>
          </div>
          
          <div class="form-group checkbox">
            <input type="checkbox" id="notification-messagePreview" name="notification-messagePreview" 
              ${formData.notificationSettings?.messagePreview ? 'checked' : ''} />
            <label for="notification-messagePreview">Show Message Preview</label>
          </div>
        </section>
      </form>
    `;
  }
  
  /**
   * Setup UI event listeners after rendering
   */
  setupUIEventListeners() {
    const container = this.config.container;
    
    // Setup form input listeners if editing
    if (this.state.isEditing) {
      const inputs = container.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        input.addEventListener('change', this.handleInputChange.bind(this));
        // For text inputs, also listen for keyup to provide immediate feedback
        if (['text', 'email', 'textarea'].includes(input.type)) {
          input.addEventListener('keyup', this.handleInputChange.bind(this));
        }
      });
      
      // File input for avatar
      const fileInput = container.querySelector('#avatar-upload-input');
      if (fileInput) {
        fileInput.addEventListener('change', this.handleFileInputChange.bind(this));
      }
    }
  }
  
  /**
   * Format profile visibility for display
   */
  formatVisibility(visibility) {
    const labels = {
      'public': 'Public - Visible to everyone',
      'friends': 'Friends Only',
      'private': 'Private'
    };
    
    return labels[visibility] || 'Unknown';
  }
  
  /**
   * Format last active time
   */
  formatLastActive(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
  
  /**
   * Update UI based on current state
   */
  updateUI() {
    this.render();
  }
  
  /**
   * Cleanup resources when module is destroyed
   */
  destroy() {
    // Remove event listeners
    eventBus.off('user:updated', this.handleUserUpdate);
    eventBus.off('avatar:updated', this.handleAvatarUpdate);
    
    // Clean up DOM listeners
    const container = this.config.container;
    if (container) {
      container.removeEventListener('click', this.handleContainerClick);
    }
  }
}

// Export singleton instance
export default ProfileModule;

// For backwards compatibility with legacy code
if (typeof window !== 'undefined') {
  window.ProfileModule = ProfileModule;
}
