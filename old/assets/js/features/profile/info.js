/**
 * Profile Info Module
 * 
 * This module handles user profile information:
 * - Display name
 * - Bio/about
 * - Contact information
 * - User stats
 */

// Profile info functionality
export const profileInfo = {
  /**
   * Initialize profile info functionality
   */
  init() {
    console.log('Initializing profile info module');
    
    // Find profile info elements
    this.profileForm = document.querySelector('.profile-info-form');
    this.displayNameField = document.querySelector('#display-name');
    this.bioField = document.querySelector('#user-bio');
    this.emailField = document.querySelector('#user-email');
    
    if (this.profileForm) {
      this._setupEventListeners();
      this._loadUserInfo();
    }
    
    return true;
  },
  
  /**
   * Set up event listeners for profile info functionality
   * @private
   */
  _setupEventListeners() {
    // Listen for profile form submission
    if (this.profileForm) {
      this.profileForm.addEventListener('submit', this._handleInfoSubmit.bind(this));
    }
    
    // Listen for edit mode changes
    document.addEventListener('profile:edit:start', this._handleEditModeStart.bind(this));
    document.addEventListener('profile:cancel', this._handleEditModeCancel.bind(this));
    
    // Add character counter for bio field
    if (this.bioField) {
      this.bioField.addEventListener('input', this._updateCharacterCount.bind(this));
    }
  },
  
  /**
   * Load user info from API
   * @private
   */
  async _loadUserInfo() {
    try {
      // In a real implementation, we would fetch from an API
      // For now, simulate API request
      const response = await fetch('/api/users.php?action=get_current_user_info');
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      const userData = await response.json();
      this._populateUserInfo(userData);
    } catch (error) {
      console.error('Failed to load user info', error);
      // Try to get from localStorage as fallback
      this._loadFromLocalStorage();
    }
  },
  
  /**
   * Load user info from localStorage (fallback)
   * @private
   */
  _loadFromLocalStorage() {
    try {
      const savedInfo = localStorage.getItem('quickchat_user_info');
      if (savedInfo) {
        const userInfo = JSON.parse(savedInfo);
        this._populateUserInfo(userInfo);
      }
    } catch (error) {
      console.error('Failed to load user info from localStorage', error);
    }
  },
  
  /**
   * Populate user info form with data
   * @private
   * @param {Object} userData - User data object
   */
  _populateUserInfo(userData) {
    if (this.displayNameField && userData.displayName) {
      this.displayNameField.value = userData.displayName;
    }
    
    if (this.bioField && userData.bio) {
      this.bioField.value = userData.bio;
      this._updateCharacterCount();
    }
    
    if (this.emailField && userData.email) {
      this.emailField.value = userData.email;
    }
    
    // Update user stats if available
    if (userData.stats) {
      this._updateUserStats(userData.stats);
    }
  },
  
  /**
   * Update user stats display
   * @private
   * @param {Object} stats - User stats object
   */
  _updateUserStats(stats) {
    const statsContainer = document.querySelector('.profile-stats');
    if (!statsContainer) return;
    
    const statElements = {
      messages: statsContainer.querySelector('.stat-messages .stat-value'),
      chats: statsContainer.querySelector('.stat-chats .stat-value'),
      joined: statsContainer.querySelector('.stat-joined .stat-value')
    };
    
    if (statElements.messages && stats.totalMessages !== undefined) {
      statElements.messages.textContent = stats.totalMessages.toLocaleString();
    }
    
    if (statElements.chats && stats.activeChats !== undefined) {
      statElements.chats.textContent = stats.activeChats.toLocaleString();
    }
    
    if (statElements.joined && stats.joinDate) {
      // Format join date (e.g., "Jan 15, 2023")
      const joinDate = new Date(stats.joinDate);
      statElements.joined.textContent = joinDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  },
  
  /**
   * Update character count for bio field
   * @private
   */
  _updateCharacterCount() {
    if (!this.bioField) return;
    
    const maxLength = parseInt(this.bioField.getAttribute('maxlength') || '160', 10);
    const currentLength = this.bioField.value.length;
    const counterElement = document.querySelector('.bio-character-count');
    
    if (counterElement) {
      counterElement.textContent = `${currentLength}/${maxLength}`;
      
      // Add warning class if approaching limit
      if (currentLength > maxLength * 0.8) {
        counterElement.classList.add('warning');
      } else {
        counterElement.classList.remove('warning');
      }
    }
  },
  
  /**
   * Handle profile info form submission
   * @private
   * @param {Event} event - Form submission event
   */
  async _handleInfoSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(this.profileForm);
    const userInfo = {
      displayName: formData.get('display-name'),
      bio: formData.get('bio'),
      email: formData.get('email')
    };
    
    // Show saving indicator
    this.profileForm.classList.add('saving');
    const submitBtn = this.profileForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }
    
    try {
      // In a real implementation, we would send to an API
      // For now, simulate API request
      const response = await fetch('/api/users.php?action=update_profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userInfo)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      // Save to localStorage as backup
      localStorage.setItem('quickchat_user_info', JSON.stringify(userInfo));
      
      // Show success message
      this._showSuccessMessage('Profile updated successfully!');
      
      // Dispatch event to notify other components
      const event = new CustomEvent('profile:info:save', { 
        detail: { userInfo }
      });
      document.dispatchEvent(event);
      
      // Also dispatch the more general profile:save event
      document.dispatchEvent(new CustomEvent('profile:save', { 
        detail: { userInfo }
      }));
    } catch (error) {
      console.error('Failed to save profile info', error);
      this._showErrorMessage('Failed to update profile. Please try again.');
    } finally {
      // Remove saving indicator
      this.profileForm.classList.remove('saving');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
  },
  
  /**
   * Handle edit mode start
   * @private
   */
  _handleEditModeStart() {
    // Enable form fields
    if (this.profileForm) {
      const fields = this.profileForm.querySelectorAll('input, textarea');
      fields.forEach(field => {
        field.removeAttribute('readonly');
      });
      
      // Show the form controls
      const formControls = this.profileForm.querySelector('.form-controls');
      if (formControls) {
        formControls.classList.remove('hidden');
      }
    }
  },
  
  /**
   * Handle edit mode cancel
   * @private
   */
  _handleEditModeCancel() {
    // Reset form and disable fields
    if (this.profileForm) {
      this.profileForm.reset();
      
      // Re-load the user info
      this._loadUserInfo();
      
      // Disable form fields
      const fields = this.profileForm.querySelectorAll('input, textarea');
      fields.forEach(field => {
        field.setAttribute('readonly', 'readonly');
      });
      
      // Hide the form controls
      const formControls = this.profileForm.querySelector('.form-controls');
      if (formControls) {
        formControls.classList.add('hidden');
      }
    }
  },
  
  /**
   * Show success message
   * @private
   * @param {string} message - Success message
   */
  _showSuccessMessage(message) {
    const messageElement = document.querySelector('.profile-message');
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
    const messageElement = document.querySelector('.profile-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.add('error');
      messageElement.classList.remove('success');
      messageElement.classList.remove('hidden');
    }
  }
};

export default profileInfo;
