/**
 * Profile Privacy Module
 * 
 * This module handles user profile privacy settings:
 * - Who can see profile information
 * - Who can message the user
 * - Online status visibility
 * - Read receipts settings
 */

// Profile privacy functionality
export const profilePrivacy = {
  /**
   * Initialize privacy functionality
   */
  init() {
    console.log('Initializing profile privacy module');
    
    // Find privacy form
    this.privacyForm = document.querySelector('.profile-privacy-form');
    
    if (this.privacyForm) {
      this._setupEventListeners();
      this._loadPrivacySettings();
    }
    
    return true;
  },
  
  /**
   * Set up event listeners for privacy functionality
   * @private
   */
  _setupEventListeners() {
    // Listen for privacy form submission
    if (this.privacyForm) {
      this.privacyForm.addEventListener('submit', this._handlePrivacySubmit.bind(this));
    }
    
    // Listen for online status toggle
    const onlineStatusToggle = document.querySelector('#online-status-visibility');
    if (onlineStatusToggle) {
      onlineStatusToggle.addEventListener('change', this._handleOnlineStatusChange.bind(this));
    }
    
    // Listen for read receipts toggle
    const readReceiptsToggle = document.querySelector('#read-receipts');
    if (readReceiptsToggle) {
      readReceiptsToggle.addEventListener('change', this._handleReadReceiptsChange.bind(this));
    }
  },
  
  /**
   * Load privacy settings from API
   * @private
   */
  async _loadPrivacySettings() {
    try {
      // In a real implementation, we would fetch from an API
      // For now, simulate API request
      const response = await fetch('/api/users.php?action=get_privacy_settings');
      if (!response.ok) {
        throw new Error('Failed to fetch privacy settings');
      }
      
      const privacySettings = await response.json();
      this._populatePrivacyForm(privacySettings);
    } catch (error) {
      console.error('Failed to load privacy settings', error);
      // Try to get from localStorage as fallback
      this._loadFromLocalStorage();
    }
  },
  
  /**
   * Load privacy settings from localStorage (fallback)
   * @private
   */
  _loadFromLocalStorage() {
    try {
      const savedSettings = localStorage.getItem('quickchat_privacy_settings');
      if (savedSettings) {
        const privacySettings = JSON.parse(savedSettings);
        this._populatePrivacyForm(privacySettings);
      }
    } catch (error) {
      console.error('Failed to load privacy settings from localStorage', error);
    }
  },
  
  /**
   * Populate privacy form with settings
   * @private
   * @param {Object} settings - Privacy settings object
   */
  _populatePrivacyForm(settings) {
    // Profile visibility setting
    const profileVisibility = document.querySelector('#profile-visibility');
    if (profileVisibility && settings.profileVisibility) {
      profileVisibility.value = settings.profileVisibility;
    }
    
    // Message permission setting
    const messagePermission = document.querySelector('#message-permission');
    if (messagePermission && settings.messagePermission) {
      messagePermission.value = settings.messagePermission;
    }
    
    // Online status visibility toggle
    const onlineStatusToggle = document.querySelector('#online-status-visibility');
    if (onlineStatusToggle && settings.showOnlineStatus !== undefined) {
      onlineStatusToggle.checked = settings.showOnlineStatus;
    }
    
    // Read receipts toggle
    const readReceiptsToggle = document.querySelector('#read-receipts');
    if (readReceiptsToggle && settings.sendReadReceipts !== undefined) {
      readReceiptsToggle.checked = settings.sendReadReceipts;
    }
  },
  
  /**
   * Handle privacy form submission
   * @private
   * @param {Event} event - Form submission event
   */
  async _handlePrivacySubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(this.privacyForm);
    const settings = {
      profileVisibility: formData.get('profile-visibility'),
      messagePermission: formData.get('message-permission'),
      showOnlineStatus: formData.get('online-status-visibility') === 'on',
      sendReadReceipts: formData.get('read-receipts') === 'on'
    };
    
    // Show saving indicator
    this.privacyForm.classList.add('saving');
    const submitBtn = this.privacyForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }
    
    try {
      // In a real implementation, we would send to an API
      // For now, simulate API request
      const response = await fetch('/api/users.php?action=update_privacy_settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update privacy settings');
      }
      
      // Save to localStorage as backup
      localStorage.setItem('quickchat_privacy_settings', JSON.stringify(settings));
      
      // Show success message
      this._showSuccessMessage('Privacy settings updated successfully!');
      
      // Dispatch event to notify other components
      const event = new CustomEvent('profile:privacy:save', { 
        detail: { settings }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to save privacy settings', error);
      this._showErrorMessage('Failed to update privacy settings. Please try again.');
    } finally {
      // Remove saving indicator
      this.privacyForm.classList.remove('saving');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
  },
  
  /**
   * Handle online status visibility change
   * @private
   * @param {Event} event - Change event
   */
  _handleOnlineStatusChange(event) {
    const showOnlineStatus = event.target.checked;
    
    // Update immediately in localStorage
    this._updatePrivacySetting('showOnlineStatus', showOnlineStatus);
    
    // In a real implementation, also update on the server
    
    // Dispatch event to notify other components
    const event = new CustomEvent('profile:privacy:online-status-change', { 
      detail: { showOnlineStatus }
    });
    document.dispatchEvent(event);
  },
  
  /**
   * Handle read receipts change
   * @private
   * @param {Event} event - Change event
   */
  _handleReadReceiptsChange(event) {
    const sendReadReceipts = event.target.checked;
    
    // Update immediately in localStorage
    this._updatePrivacySetting('sendReadReceipts', sendReadReceipts);
    
    // In a real implementation, also update on the server
    
    // Dispatch event to notify other components
    const event = new CustomEvent('profile:privacy:read-receipts-change', { 
      detail: { sendReadReceipts }
    });
    document.dispatchEvent(event);
  },
  
  /**
   * Update a specific privacy setting
   * @private
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  _updatePrivacySetting(key, value) {
    try {
      // Get existing settings
      let settings = {};
      const savedSettings = localStorage.getItem('quickchat_privacy_settings');
      if (savedSettings) {
        settings = JSON.parse(savedSettings);
      }
      
      // Update the specific setting
      settings[key] = value;
      
      // Save back to localStorage
      localStorage.setItem('quickchat_privacy_settings', JSON.stringify(settings));
    } catch (error) {
      console.error(`Failed to update privacy setting ${key}`, error);
    }
  },
  
  /**
   * Show success message
   * @private
   * @param {string} message - Success message
   */
  _showSuccessMessage(message) {
    const messageElement = document.querySelector('.privacy-message');
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
    const messageElement = document.querySelector('.privacy-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.add('error');
      messageElement.classList.remove('success');
      messageElement.classList.remove('hidden');
    }
  }
};

export default profilePrivacy;
