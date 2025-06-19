/**
 * Profile Settings Module
 * 
 * This module handles user profile settings including:
 * - Notification preferences
 * - Theme settings
 * - Language preferences
 * - Accessibility options
 */

// Profile settings functionality
export const profileSettings = {
  /**
   * Initialize settings functionality
   */
  init() {
    console.log('Initializing profile settings');
    
    // Find settings form
    this.settingsForm = document.querySelector('.profile-settings-form');
    
    if (this.settingsForm) {
      this._setupEventListeners();
      this._loadUserSettings();
    }
    
    return true;
  },
  
  /**
   * Set up event listeners for settings functionality
   * @private
   */
  _setupEventListeners() {
    // Listen for settings form submission
    if (this.settingsForm) {
      this.settingsForm.addEventListener('submit', this._handleSettingsSubmit.bind(this));
    }
    
    // Listen for theme toggle changes
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('change', this._handleThemeChange.bind(this));
    }
    
    // Listen for notification preference changes
    const notifToggle = document.querySelector('.notification-toggle');
    if (notifToggle) {
      notifToggle.addEventListener('change', this._handleNotificationChange.bind(this));
    }
  },
  
  /**
   * Load user settings from API or localStorage
   * @private
   */
  _loadUserSettings() {
    // In a real implementation, we would fetch from an API
    // For now, load from localStorage if available
    try {
      const savedSettings = localStorage.getItem('quickchat_user_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        this._populateSettingsForm(settings);
      }
    } catch (error) {
      console.error('Failed to load user settings', error);
    }
  },
  
  /**
   * Populate settings form with user's saved settings
   * @private
   * @param {Object} settings - User settings object
   */
  _populateSettingsForm(settings) {
    // Populate theme setting
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle && settings.darkMode) {
      themeToggle.checked = settings.darkMode;
    }
    
    // Populate notification settings
    const notifToggle = document.querySelector('.notification-toggle');
    if (notifToggle && settings.notifications !== undefined) {
      notifToggle.checked = settings.notifications;
    }
    
    // Populate language selection
    const langSelect = document.querySelector('.language-select');
    if (langSelect && settings.language) {
      langSelect.value = settings.language;
    }
  },
  
  /**
   * Handle settings form submission
   * @private
   * @param {Event} event - Form submission event
   */
  _handleSettingsSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(this.settingsForm);
    const settings = {
      darkMode: formData.get('darkMode') === 'on',
      notifications: formData.get('notifications') === 'on',
      language: formData.get('language')
    };
    
    // Save settings
    this._saveUserSettings(settings);
  },
  
  /**
   * Handle theme change
   * @private
   * @param {Event} event - Change event
   */
  _handleThemeChange(event) {
    const isDarkMode = event.target.checked;
    
    // Update the UI theme immediately
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // Save this specific setting
    this._saveSpecificSetting('darkMode', isDarkMode);
  },
  
  /**
   * Handle notification preference change
   * @private
   * @param {Event} event - Change event
   */
  _handleNotificationChange(event) {
    const enableNotifications = event.target.checked;
    
    // Request notification permission if enabled
    if (enableNotifications && 'Notification' in window) {
      Notification.requestPermission();
    }
    
    // Save this specific setting
    this._saveSpecificSetting('notifications', enableNotifications);
  },
  
  /**
   * Save a specific setting
   * @private
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   */
  _saveSpecificSetting(key, value) {
    try {
      // Get existing settings
      let settings = {};
      const savedSettings = localStorage.getItem('quickchat_user_settings');
      if (savedSettings) {
        settings = JSON.parse(savedSettings);
      }
      
      // Update the specific setting
      settings[key] = value;
      
      // Save back to localStorage
      localStorage.setItem('quickchat_user_settings', JSON.stringify(settings));
      
      // Dispatch event to notify other components
      const event = new CustomEvent('profile:settings:change', { 
        detail: { key, value, settings }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error(`Failed to save setting ${key}`, error);
    }
  },
  
  /**
   * Save all user settings
   * @private
   * @param {Object} settings - User settings object
   */
  _saveUserSettings(settings) {
    try {
      // Save to localStorage for now
      localStorage.setItem('quickchat_user_settings', JSON.stringify(settings));
      
      // In a real implementation, we would also send to an API
      
      // Show success message
      this._showSuccessMessage('Settings saved successfully!');
      
      // Dispatch event to notify other components
      const event = new CustomEvent('profile:settings:save', { 
        detail: { settings }
      });
      document.dispatchEvent(event);
    } catch (error) {
      console.error('Failed to save user settings', error);
      this._showErrorMessage('Failed to save settings. Please try again.');
    }
  },
  
  /**
   * Show success message
   * @private
   * @param {string} message - Success message
   */
  _showSuccessMessage(message) {
    const messageElement = document.querySelector('.settings-message');
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
    const messageElement = document.querySelector('.settings-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.classList.add('error');
      messageElement.classList.remove('success');
      messageElement.classList.remove('hidden');
    }
  }
};

export default profileSettings;
