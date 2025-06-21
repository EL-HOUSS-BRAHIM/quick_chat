/**
 * Chat Settings Module
 * Handles user preferences and settings for chat
 */

import eventBus from '../../core/event-bus.js';
import { loadUserPreferences, saveUserPreferences } from '../../core/state.js';

class ChatSettings {
  constructor() {
    this.settingsModal = null;
    this.defaults = {
      soundEnabled: true,
      theme: 'light',
      notificationsEnabled: true,
      messageFontSize: 'medium',
      enterToSend: true
    };
    
    // Current settings
    this.settings = { ...this.defaults };
    
    // Bind methods
    this.showSettings = this.showSettings.bind(this);
    this.hideSettings = this.hideSettings.bind(this);
    this.saveSettings = this.saveSettings.bind(this);
    this.loadSettings = this.loadSettings.bind(this);
    this.updateSetting = this.updateSetting.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize settings module
   */
  init() {
    // Find settings modal
    this.settingsModal = document.getElementById('settingsModal');
    
    if (!this.settingsModal) {
      this.createSettingsModal();
    }
    
    // Load saved settings
    this.loadSettings();
    
    // Add event listeners
    const closeBtn = document.querySelector('#settingsModal .close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', this.hideSettings);
    }
    
    const saveBtn = document.querySelector('#settingsModal .save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', this.saveSettings);
    }
    
    // Add change listeners to settings inputs
    const settingsInputs = document.querySelectorAll('#settingsModal input, #settingsModal select');
    settingsInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const setting = e.target.id;
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        this.updateSetting(setting, value);
      });
    });
    
    // Subscribe to events
    eventBus.subscribe('settings:show', this.showSettings);
    eventBus.subscribe('settings:hide', this.hideSettings);
    eventBus.subscribe('settings:update', this.updateSetting);
  }
  
  /**
   * Create settings modal if it doesn't exist
   */
  createSettingsModal() {
    this.settingsModal = document.createElement('div');
    this.settingsModal.id = 'settingsModal';
    this.settingsModal.className = 'modal';
    
    this.settingsModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Chat Settings</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-group">
            <h3>Notifications</h3>
            <div class="setting-item">
              <label for="notificationsEnabled">Enable Notifications</label>
              <input type="checkbox" id="notificationsEnabled">
            </div>
            <div class="setting-item">
              <label for="soundEnabled">Sound Notifications</label>
              <input type="checkbox" id="soundEnabled">
            </div>
          </div>
          
          <div class="settings-group">
            <h3>Appearance</h3>
            <div class="setting-item">
              <label for="theme">Theme</label>
              <select id="theme">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System Default</option>
              </select>
            </div>
            <div class="setting-item">
              <label for="messageFontSize">Message Font Size</label>
              <select id="messageFontSize">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
          
          <div class="settings-group">
            <h3>Behavior</h3>
            <div class="setting-item">
              <label for="enterToSend">Press Enter to Send</label>
              <input type="checkbox" id="enterToSend">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="save-btn primary-btn">Save Settings</button>
        </div>
      </div>
    `;
    
    // Add to DOM
    document.body.appendChild(this.settingsModal);
  }
  
  /**
   * Show settings modal
   */
  showSettings() {
    if (!this.settingsModal) return;
    
    // Load current settings into UI
    this.populateSettingsUI();
    
    // Show modal
    this.settingsModal.style.display = 'flex';
  }
  
  /**
   * Hide settings modal
   */
  hideSettings() {
    if (!this.settingsModal) return;
    this.settingsModal.style.display = 'none';
  }
  
  /**
   * Load settings from storage
   */
  loadSettings() {
    // Load from local storage via state module
    const savedSettings = loadUserPreferences('chatSettings');
    
    if (savedSettings) {
      this.settings = { ...this.defaults, ...savedSettings };
    }
    
    // Apply settings
    this.applySettings();
  }
  
  /**
   * Populate settings UI with current values
   */
  populateSettingsUI() {
    // Update checkboxes
    const checkboxes = ['soundEnabled', 'notificationsEnabled', 'enterToSend'];
    checkboxes.forEach(setting => {
      const checkbox = document.getElementById(setting);
      if (checkbox) {
        checkbox.checked = this.settings[setting];
      }
    });
    
    // Update selects
    const selects = ['theme', 'messageFontSize'];
    selects.forEach(setting => {
      const select = document.getElementById(setting);
      if (select) {
        select.value = this.settings[setting];
      }
    });
  }
  
  /**
   * Save settings
   */
  saveSettings() {
    // Save to local storage via state module
    saveUserPreferences('chatSettings', this.settings);
    
    // Apply settings
    this.applySettings();
    
    // Hide modal
    this.hideSettings();
    
    // Notify
    eventBus.publish('notification', {
      message: 'Settings saved successfully',
      type: 'success'
    });
  }
  
  /**
   * Update a single setting
   * @param {string} setting - Setting name
   * @param {any} value - Setting value
   */
  updateSetting(setting, value) {
    // Update in memory
    this.settings[setting] = value;
    
    // Immediate apply for some settings
    if (['theme'].includes(setting)) {
      this.applySettings();
    }
  }
  
  /**
   * Apply current settings to the UI
   */
  applySettings() {
    // Apply theme
    document.body.dataset.theme = this.settings.theme;
    if (this.settings.theme === 'system') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.classList.toggle('dark-theme', prefersDark);
    } else {
      // Use explicit setting
      document.body.classList.toggle('dark-theme', this.settings.theme === 'dark');
    }
    
    // Apply font size
    document.body.dataset.fontSize = this.settings.messageFontSize;
    
    // Publish settings applied event
    eventBus.publish('settings:applied', this.settings);
  }
  
  /**
   * Get current value of a setting
   * @param {string} setting - Setting name
   * @returns {any} Setting value
   */
  getSetting(setting) {
    return this.settings[setting];
  }
}

export default ChatSettings;
