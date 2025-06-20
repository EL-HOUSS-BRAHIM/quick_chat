/**
 * Profile Component
 * 
 * Handles user profile display and editing functionality
 */

import { EventBus } from '../services/EventBus.js';
import { apiClient } from '../services/apiClient.js';
import { logger } from '../utils/logger.js';
import { helpers } from '../utils/helpers.js';
import Modal from './ui/Modal.js';
import LoadingIndicator from './ui/LoadingIndicator.js';

export class Profile {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      editable: true,
      showAvatar: true,
      showStats: true,
      ...options
    };

    this.eventBus = new EventBus();
    this.modal = new Modal();
    this.loadingIndicator = new LoadingIndicator();
    this.user = null;
    this.isEditing = false;
    this.element = null;
  }

  /**
   * Initialize the profile component
   */
  async init() {
    try {
      await this.modal.init();
      this.createElement();
      this.setupEventListeners();
      await this.loadUserProfile();
      this.render();
      
      logger.debug('Profile component initialized');
    } catch (error) {
      logger.error('Failed to initialize profile component:', error);
      this.showError('Failed to load profile');
    }
  }

  /**
   * Create the main element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'profile-component';
    this.container.appendChild(this.element);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for user updates
    this.eventBus.on('user:updated', (user) => {
      this.user = { ...this.user, ...user };
      this.render();
    });

    // Listen for avatar updates
    this.eventBus.on('avatar:updated', (avatarUrl) => {
      this.user.avatar = avatarUrl;
      this.render();
    });
  }

  /**
   * Load user profile data
   */
  async loadUserProfile(userId = null) {
    try {
      this.showLoading();
      
      const response = userId 
        ? await apiClient.get(`/api/users/${userId}`)
        : await apiClient.get('/api/users/me');
      
      this.user = response.data;
      this.hideLoading();
    } catch (error) {
      logger.error('Failed to load user profile:', error);
      this.hideLoading();
      throw error;
    }
  }

  /**
   * Render the profile component
   */
  render() {
    if (!this.user) return;

    this.element.innerHTML = `
      <div class="profile-container">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div class="profile-content">
          ${this.renderBasicInfo()}
          ${this.options.showStats ? this.renderStats() : ''}
          ${this.renderSettings()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Render profile header
   */
  renderHeader() {
    return `
      <div class="profile-header">
        ${this.options.showAvatar ? this.renderAvatar() : ''}
        <div class="profile-info">
          <h2 class="profile-name">${helpers.escapeHtml(this.user.display_name || this.user.username)}</h2>
          <p class="profile-username">@${helpers.escapeHtml(this.user.username)}</p>
          <p class="profile-status ${this.user.is_online ? 'online' : 'offline'}">
            <i class="fas fa-circle"></i>
            ${this.user.is_online ? 'Online' : `Last seen ${helpers.timeAgo(this.user.last_seen)}`}
          </p>
          ${this.options.editable ? '<button class="btn btn-primary edit-profile-btn">Edit Profile</button>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render avatar section
   */
  renderAvatar() {
    return `
      <div class="profile-avatar-section">
        <div class="avatar-container">
          <img src="${this.user.avatar || '/assets/images/default-avatar.png'}" 
               alt="Profile Avatar" 
               class="profile-avatar">
          ${this.options.editable ? '<button class="avatar-edit-btn"><i class="fas fa-camera"></i></button>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render tabs
   */
  renderTabs() {
    return `
      <div class="profile-tabs">
        <button class="tab-btn active" data-tab="info">Profile Info</button>
        ${this.options.showStats ? '<button class="tab-btn" data-tab="stats">Statistics</button>' : ''}
        ${this.options.editable ? '<button class="tab-btn" data-tab="settings">Settings</button>' : ''}
      </div>
    `;
  }

  /**
   * Render basic info
   */
  renderBasicInfo() {
    return `
      <div class="tab-content active" data-tab="info">
        <div class="info-section">
          <h3>Basic Information</h3>
          <div class="info-grid">
            <div class="info-item">
              <label>Display Name</label>
              <span>${helpers.escapeHtml(this.user.display_name || 'Not set')}</span>
            </div>
            <div class="info-item">
              <label>Username</label>
              <span>@${helpers.escapeHtml(this.user.username)}</span>
            </div>
            <div class="info-item">
              <label>Email</label>
              <span>${helpers.escapeHtml(this.user.email || 'Not set')}</span>
            </div>
            <div class="info-item">
              <label>Bio</label>
              <span>${helpers.escapeHtml(this.user.bio || 'No bio set')}</span>
            </div>
            <div class="info-item">
              <label>Joined</label>
              <span>${helpers.formatDate(this.user.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render statistics
   */
  renderStats() {
    const stats = this.user.stats || {};
    
    return `
      <div class="tab-content" data-tab="stats">
        <div class="stats-section">
          <h3>Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${stats.messages_sent || 0}</div>
              <div class="stat-label">Messages Sent</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.groups_joined || 0}</div>
              <div class="stat-label">Groups Joined</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${stats.files_shared || 0}</div>
              <div class="stat-label">Files Shared</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">${helpers.timeAgo(this.user.created_at)}</div>
              <div class="stat-label">Member Since</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render settings
   */
  renderSettings() {
    if (!this.options.editable) return '';

    const settings = this.user.settings || {};

    return `
      <div class="tab-content" data-tab="settings">
        <div class="settings-section">
          <h3>Privacy & Notifications</h3>
          <div class="settings-group">
            <div class="setting-item">
              <label class="setting-label">
                <input type="checkbox" ${settings.notifications_enabled ? 'checked' : ''} data-setting="notifications_enabled">
                <span class="checkmark"></span>
                Enable Notifications
              </label>
            </div>
            <div class="setting-item">
              <label class="setting-label">
                <input type="checkbox" ${settings.sound_enabled ? 'checked' : ''} data-setting="sound_enabled">
                <span class="checkmark"></span>
                Sound Notifications
              </label>
            </div>
            <div class="setting-item">
              <label class="setting-label">
                <input type="checkbox" ${settings.online_status_visible ? 'checked' : ''} data-setting="online_status_visible">
                <span class="checkmark"></span>
                Show Online Status
              </label>
            </div>
            <div class="setting-item">
              <label class="setting-label">
                <input type="checkbox" ${settings.read_receipts_enabled ? 'checked' : ''} data-setting="read_receipts_enabled">
                <span class="checkmark"></span>
                Send Read Receipts
              </label>
            </div>
          </div>
          
          <h3>Appearance</h3>
          <div class="settings-group">
            <div class="setting-item">
              <label>Theme</label>
              <select data-setting="theme">
                <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
              </select>
            </div>
            <div class="setting-item">
              <label>Font Size</label>
              <select data-setting="font_size">
                <option value="small" ${settings.font_size === 'small' ? 'selected' : ''}>Small</option>
                <option value="medium" ${settings.font_size === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="large" ${settings.font_size === 'large' ? 'selected' : ''}>Large</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Tab switching
    this.element.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Edit profile button
    const editBtn = this.element.querySelector('.edit-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.showEditModal();
      });
    }

    // Avatar edit button
    const avatarEditBtn = this.element.querySelector('.avatar-edit-btn');
    if (avatarEditBtn) {
      avatarEditBtn.addEventListener('click', () => {
        this.showAvatarUpload();
      });
    }

    // Settings changes
    this.element.querySelectorAll('[data-setting]').forEach(input => {
      input.addEventListener('change', (e) => {
        this.updateSetting(e.target.dataset.setting, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
      });
    });
  }

  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tab buttons
    this.element.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.element.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    this.element.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    this.element.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
  }

  /**
   * Show edit profile modal
   */
  showEditModal() {
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label for="edit-display-name">Display Name</label>
        <input type="text" id="edit-display-name" value="${this.user.display_name || ''}" maxlength="50">
      </div>
      <div class="form-group">
        <label for="edit-bio">Bio</label>
        <textarea id="edit-bio" maxlength="200" rows="3">${this.user.bio || ''}</textarea>
      </div>
      <div class="form-group">
        <label for="edit-email">Email</label>
        <input type="email" id="edit-email" value="${this.user.email || ''}">
      </div>
    `;

    this.modal.show(form, {
      title: 'Edit Profile',
      buttons: [
        {
          text: 'Cancel',
          class: 'btn-secondary',
          action: 'cancel',
          handler: () => this.modal.hide()
        },
        {
          text: 'Save',
          class: 'btn-primary',
          action: 'save',
          handler: () => this.saveProfile(form)
        }
      ]
    });
  }

  /**
   * Save profile changes
   */
  async saveProfile(form) {
    try {
      const formData = new FormData(form);
      const updates = {
        display_name: form.querySelector('#edit-display-name').value,
        bio: form.querySelector('#edit-bio').value,
        email: form.querySelector('#edit-email').value
      };

      this.showLoading();
      const response = await apiClient.put('/api/users/me', updates);
      
      this.user = { ...this.user, ...response.data };
      this.modal.hide();
      this.render();
      this.hideLoading();

      this.eventBus.emit('user:updated', this.user);
      this.showSuccess('Profile updated successfully');
    } catch (error) {
      logger.error('Failed to update profile:', error);
      this.hideLoading();
      this.showError('Failed to update profile');
    }
  }

  /**
   * Show avatar upload
   */
  showAvatarUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.uploadAvatar(e.target.files[0]);
      }
    });
    input.click();
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file) {
    try {
      this.showLoading();
      
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await apiClient.post('/api/users/avatar', formData);
      
      this.user.avatar = response.data.avatar_url;
      this.render();
      this.hideLoading();

      this.eventBus.emit('avatar:updated', this.user.avatar);
      this.showSuccess('Avatar updated successfully');
    } catch (error) {
      logger.error('Failed to upload avatar:', error);
      this.hideLoading();
      this.showError('Failed to upload avatar');
    }
  }

  /**
   * Update user setting
   */
  async updateSetting(setting, value) {
    try {
      const updates = { settings: { ...this.user.settings, [setting]: value } };
      
      await apiClient.put('/api/users/settings', updates);
      
      this.user.settings = { ...this.user.settings, [setting]: value };
      this.eventBus.emit('user:settings:updated', { setting, value });
    } catch (error) {
      logger.error('Failed to update setting:', error);
      this.showError('Failed to update setting');
    }
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.loadingIndicator.show(this.element);
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.loadingIndicator.hide();
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.eventBus.emit('notification:show', {
      type: 'success',
      message
    });
  }

  /**
   * Show error message
   */
  showError(message) {
    this.eventBus.emit('notification:show', {
      type: 'error',
      message
    });
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.modal.destroy();
  }
}

export default Profile;
