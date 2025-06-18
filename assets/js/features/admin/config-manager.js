/**
 * Config Manager Module
 * Handles admin configuration settings
 */

import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { eventBus } from '../../core/event-bus.js';
import * as utils from '../../core/utils.js';

class ConfigManager {
  constructor() {
    this.settings = {
      fileUpload: {
        maxSizeBytes: 50 * 1024 * 1024, // 50MB default
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
        maxFiles: 10
      },
      messages: {
        retentionDays: 365,
        maxLength: 5000,
        enableReactions: true,
        enableEditing: true
      },
      users: {
        allowRegistration: true,
        requireEmailVerification: false,
        maxUsernameLength: 50,
        minPasswordLength: 8
      },
      notifications: {
        enableEmailNotifications: true,
        smtpHost: '',
        smtpPort: 587,
        smtpUsername: '',
        smtpPassword: ''
      }
    };
  }

  /**
   * Initialize config manager
   */
  async init() {
    try {
      // Find elements
      this.elements = {
        settingsForm: document.getElementById('settingsForm'),
        fileTypesContainer: document.getElementById('allowedFileTypes'),
        newFileTypeInput: document.getElementById('newFileType'),
        addFileTypeBtn: document.querySelector('.add-file-type-btn'),
        saveSettingsBtn: document.querySelector('.save-config-btn'),
        resetSettingsBtn: document.querySelector('.reset-config-btn')
      };

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize config manager');
    }
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Save settings button
    if (this.elements.saveSettingsBtn) {
      this.elements.saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this));
    }

    // Reset to defaults button
    if (this.elements.resetSettingsBtn) {
      this.elements.resetSettingsBtn.addEventListener('click', this.resetToDefaults.bind(this));
    }

    // Add file type button
    if (this.elements.addFileTypeBtn) {
      this.elements.addFileTypeBtn.addEventListener('click', this.addFileType.bind(this));
    }

    // Delegate for removing file types
    document.addEventListener('click', (e) => {
      if (e.target.matches('.remove-file-type-btn') || e.target.closest('.remove-file-type-btn')) {
        const btn = e.target.matches('.remove-file-type-btn') ? e.target : e.target.closest('.remove-file-type-btn');
        const type = btn.getAttribute('data-type');
        this.removeFileType(type);
      }
    });

    // Listen for tab changed events
    eventBus.subscribe('admin:tabChanged', ({ tab }) => {
      if (tab === 'settings') {
        this.loadSettings();
      }
    });
  }

  /**
   * Load settings from API
   */
  async loadSettings() {
    try {
      const response = await apiClient.get('/api/admin.php', {
        action: 'get_config'
      });

      if (response.success) {
        this.settings = { ...this.settings, ...response.data.settings };
        this.updateUI();
      } else {
        throw new Error(response.error || 'Failed to load settings');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to load settings');
    }
  }

  /**
   * Update UI with current settings
   */
  updateUI() {
    // File upload settings
    const maxSizeInput = document.getElementById('maxFileSize');
    if (maxSizeInput) {
      maxSizeInput.value = Math.round(this.settings.fileUpload.maxSizeBytes / (1024 * 1024));
    }

    const maxFilesInput = document.getElementById('maxFiles');
    if (maxFilesInput) {
      maxFilesInput.value = this.settings.fileUpload.maxFiles;
    }

    // Message settings
    const retentionInput = document.getElementById('messageRetention');
    if (retentionInput) {
      retentionInput.value = this.settings.messages.retentionDays;
    }

    const maxLengthInput = document.getElementById('maxMessageLength');
    if (maxLengthInput) {
      maxLengthInput.value = this.settings.messages.maxLength;
    }

    const enableReactionsCheck = document.getElementById('enableReactions');
    if (enableReactionsCheck) {
      enableReactionsCheck.checked = this.settings.messages.enableReactions;
    }

    const enableEditingCheck = document.getElementById('enableEditing');
    if (enableEditingCheck) {
      enableEditingCheck.checked = this.settings.messages.enableEditing;
    }

    // User settings
    const allowRegCheckbox = document.getElementById('allowRegistration');
    if (allowRegCheckbox) {
      allowRegCheckbox.checked = this.settings.users.allowRegistration;
    }

    const requireEmailCheckbox = document.getElementById('requireEmailVerification');
    if (requireEmailCheckbox) {
      requireEmailCheckbox.checked = this.settings.users.requireEmailVerification;
    }

    const maxUsernameLength = document.getElementById('maxUsernameLength');
    if (maxUsernameLength) {
      maxUsernameLength.value = this.settings.users.maxUsernameLength;
    }

    const minPasswordLength = document.getElementById('minPasswordLength');
    if (minPasswordLength) {
      minPasswordLength.value = this.settings.users.minPasswordLength;
    }

    // Notification settings
    const enableEmailNotifications = document.getElementById('enableEmailNotifications');
    if (enableEmailNotifications) {
      enableEmailNotifications.checked = this.settings.notifications.enableEmailNotifications;
    }

    const smtpHost = document.getElementById('smtpHost');
    if (smtpHost) {
      smtpHost.value = this.settings.notifications.smtpHost;
    }

    const smtpPort = document.getElementById('smtpPort');
    if (smtpPort) {
      smtpPort.value = this.settings.notifications.smtpPort;
    }

    const smtpUsername = document.getElementById('smtpUsername');
    if (smtpUsername) {
      smtpUsername.value = this.settings.notifications.smtpUsername;
    }

    // Update file types list
    this.updateFileTypesList();
  }

  /**
   * Update file types list display
   */
  updateFileTypesList() {
    if (!this.elements.fileTypesContainer) return;

    this.elements.fileTypesContainer.innerHTML = '';
    this.settings.fileUpload.allowedTypes.forEach(type => {
      const item = document.createElement('div');
      item.className = 'file-type-item';
      item.innerHTML = `
        <span>${utils.escapeHtml(type)}</span>
        <button type="button" class="remove-file-type-btn" data-type="${utils.escapeHtml(type)}">
          Remove
        </button>
      `;
      this.elements.fileTypesContainer.appendChild(item);
    });
  }

  /**
   * Add a new file type
   */
  addFileType() {
    if (!this.elements.newFileTypeInput || !this.elements.newFileTypeInput.value.trim()) return;

    const newType = this.elements.newFileTypeInput.value.trim();
    if (!this.settings.fileUpload.allowedTypes.includes(newType)) {
      this.settings.fileUpload.allowedTypes.push(newType);
      this.updateFileTypesList();
      this.elements.newFileTypeInput.value = '';
    }
  }

  /**
   * Remove a file type
   */
  removeFileType(type) {
    this.settings.fileUpload.allowedTypes = this.settings.fileUpload.allowedTypes.filter(t => t !== type);
    this.updateFileTypesList();
  }

  /**
   * Collect values from form inputs
   */
  collectFormValues() {
    // File upload settings
    const maxSizeInput = document.getElementById('maxFileSize');
    if (maxSizeInput) {
      this.settings.fileUpload.maxSizeBytes = parseInt(maxSizeInput.value) * 1024 * 1024;
    }

    const maxFilesInput = document.getElementById('maxFiles');
    if (maxFilesInput) {
      this.settings.fileUpload.maxFiles = parseInt(maxFilesInput.value);
    }

    // Message settings
    const retentionInput = document.getElementById('messageRetention');
    if (retentionInput) {
      this.settings.messages.retentionDays = parseInt(retentionInput.value);
    }

    const maxLengthInput = document.getElementById('maxMessageLength');
    if (maxLengthInput) {
      this.settings.messages.maxLength = parseInt(maxLengthInput.value);
    }

    const enableReactionsCheck = document.getElementById('enableReactions');
    if (enableReactionsCheck) {
      this.settings.messages.enableReactions = enableReactionsCheck.checked;
    }

    const enableEditingCheck = document.getElementById('enableEditing');
    if (enableEditingCheck) {
      this.settings.messages.enableEditing = enableEditingCheck.checked;
    }

    // User settings
    const allowRegCheckbox = document.getElementById('allowRegistration');
    if (allowRegCheckbox) {
      this.settings.users.allowRegistration = allowRegCheckbox.checked;
    }

    const requireEmailCheckbox = document.getElementById('requireEmailVerification');
    if (requireEmailCheckbox) {
      this.settings.users.requireEmailVerification = requireEmailCheckbox.checked;
    }

    const maxUsernameLength = document.getElementById('maxUsernameLength');
    if (maxUsernameLength) {
      this.settings.users.maxUsernameLength = parseInt(maxUsernameLength.value);
    }

    const minPasswordLength = document.getElementById('minPasswordLength');
    if (minPasswordLength) {
      this.settings.users.minPasswordLength = parseInt(minPasswordLength.value);
    }

    // Notification settings
    const enableEmailNotifications = document.getElementById('enableEmailNotifications');
    if (enableEmailNotifications) {
      this.settings.notifications.enableEmailNotifications = enableEmailNotifications.checked;
    }

    const smtpHost = document.getElementById('smtpHost');
    if (smtpHost) {
      this.settings.notifications.smtpHost = smtpHost.value;
    }

    const smtpPort = document.getElementById('smtpPort');
    if (smtpPort) {
      this.settings.notifications.smtpPort = parseInt(smtpPort.value);
    }

    const smtpUsername = document.getElementById('smtpUsername');
    if (smtpUsername) {
      this.settings.notifications.smtpUsername = smtpUsername.value;
    }

    const smtpPassword = document.getElementById('smtpPassword');
    if (smtpPassword && smtpPassword.value) {
      this.settings.notifications.smtpPassword = smtpPassword.value;
    }
  }

  /**
   * Save settings to API
   */
  async saveSettings() {
    try {
      // Collect current form values
      this.collectFormValues();

      const response = await apiClient.post('/api/admin.php', this.settings, { action: 'save_config' });

      if (response.success) {
        utils.showToast('Settings saved successfully', 'success');
        
        // Notify other modules
        eventBus.publish('admin:settingsUpdated', { settings: this.settings });
      } else {
        throw new Error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      errorHandler.handleError(error, 'Failed to save settings');
    }
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      this.settings = {
        fileUpload: {
          maxSizeBytes: 50 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
          maxFiles: 10
        },
        messages: {
          retentionDays: 365,
          maxLength: 5000,
          enableReactions: true,
          enableEditing: true
        },
        users: {
          allowRegistration: true,
          requireEmailVerification: false,
          maxUsernameLength: 50,
          minPasswordLength: 8
        },
        notifications: {
          enableEmailNotifications: true,
          smtpHost: '',
          smtpPort: 587,
          smtpUsername: '',
          smtpPassword: ''
        }
      };
      this.updateUI();
    }
  }
}

export default ConfigManager;
