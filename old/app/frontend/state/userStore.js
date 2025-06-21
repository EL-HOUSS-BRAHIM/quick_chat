/**
 * User Store
 * Manages user-specific state including authentication, profile, and preferences
 */

import { EventBus } from '../services/EventBus.js';
import { logger } from '../utils/logger.js';
import { storage } from '../utils/helpers.js';

class UserStore {
  constructor() {
    this.state = {
      currentUser: null,
      isAuthenticated: false,
      profile: null,
      preferences: {
        theme: 'auto',
        language: 'en',
        notifications: {
          desktop: true,
          sound: true,
          email: false
        },
        privacy: {
          showOnlineStatus: true,
          allowDirectMessages: true,
          showLastSeen: true
        },
        accessibility: {
          reducedMotion: false,
          highContrast: false,
          fontSize: 'medium',
          screenReader: false
        }
      },
      sessions: [],
      contacts: new Map(),
      blockedUsers: new Set(),
      settings: {}
    };
    
    this.eventBus = new EventBus();
    this.initialized = false;
    
    // Debug mode
    this.debug = false;
  }

  /**
   * Initialize user store
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing user store');
      
      // Load user data from storage
      await this.loadUserData();
      
      // Check authentication status
      await this.checkAuthStatus();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      
      this.eventBus.emit('userStore:initialized');
      logger.info('User store initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize user store:', error);
      throw error;
    }
  }

  /**
   * Set current user
   * @param {Object} user - User object
   */
  setCurrentUser(user) {
    const oldUser = this.state.currentUser;
    this.state.currentUser = user;
    this.state.isAuthenticated = !!user;
    
    if (user) {
      // Update profile if provided
      if (user.profile) {
        this.state.profile = { ...this.state.profile, ...user.profile };
      }
      
      // Save user data
      this.saveUserData();
    }
    
    this.eventBus.emit('userStore:currentUserChanged', {
      oldUser,
      newUser: user,
      isAuthenticated: this.state.isAuthenticated
    });
    
    if (this.debug) {
      logger.debug('Current user changed:', user ? user.username : 'logged out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.state.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.state.isAuthenticated;
  }

  /**
   * Update user profile
   * @param {Object} profileUpdates - Profile updates
   */
  updateProfile(profileUpdates) {
    const oldProfile = { ...this.state.profile };
    this.state.profile = { ...this.state.profile, ...profileUpdates };
    
    // Save to storage
    this.saveUserData();
    
    this.eventBus.emit('userStore:profileUpdated', {
      oldProfile,
      newProfile: this.state.profile,
      updates: profileUpdates
    });
  }

  /**
   * Get user profile
   */
  getProfile() {
    return this.state.profile;
  }

  /**
   * Update user preferences
   * @param {Object} preferenceUpdates - Preference updates
   */
  updatePreferences(preferenceUpdates) {
    const oldPreferences = { ...this.state.preferences };
    
    // Deep merge preferences
    this.state.preferences = this.deepMerge(this.state.preferences, preferenceUpdates);
    
    // Save to storage
    this.saveUserData();
    
    this.eventBus.emit('userStore:preferencesUpdated', {
      oldPreferences,
      newPreferences: this.state.preferences,
      updates: preferenceUpdates
    });
    
    // Emit specific preference change events
    this.emitPreferenceEvents(preferenceUpdates);
  }

  /**
   * Get user preferences
   */
  getPreferences() {
    return this.state.preferences;
  }

  /**
   * Get specific preference
   * @param {string} path - Preference path (e.g., 'theme' or 'notifications.sound')
   */
  getPreference(path) {
    const keys = path.split('.');
    let value = this.state.preferences;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set specific preference
   * @param {string} path - Preference path
   * @param {*} value - Preference value
   */
  setPreference(path, value) {
    const keys = path.split('.');
    const updates = {};
    let current = updates;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    
    this.updatePreferences(updates);
  }

  /**
   * Add contact
   * @param {Object} contact - Contact object
   */
  addContact(contact) {
    this.state.contacts.set(contact.id, contact);
    
    this.eventBus.emit('userStore:contactAdded', {
      contact
    });
    
    // Save contacts
    this.saveContacts();
  }

  /**
   * Update contact
   * @param {string} contactId - Contact ID
   * @param {Object} updates - Contact updates
   */
  updateContact(contactId, updates) {
    const existingContact = this.state.contacts.get(contactId);
    if (existingContact) {
      const updatedContact = { ...existingContact, ...updates };
      this.state.contacts.set(contactId, updatedContact);
      
      this.eventBus.emit('userStore:contactUpdated', {
        contactId,
        oldContact: existingContact,
        newContact: updatedContact
      });
      
      // Save contacts
      this.saveContacts();
    }
  }

  /**
   * Remove contact
   * @param {string} contactId - Contact ID
   */
  removeContact(contactId) {
    const contact = this.state.contacts.get(contactId);
    if (contact) {
      this.state.contacts.delete(contactId);
      
      this.eventBus.emit('userStore:contactRemoved', {
        contactId,
        contact
      });
      
      // Save contacts
      this.saveContacts();
    }
  }

  /**
   * Get contact by ID
   * @param {string} contactId - Contact ID
   */
  getContact(contactId) {
    return this.state.contacts.get(contactId);
  }

  /**
   * Get all contacts
   */
  getContacts() {
    return Array.from(this.state.contacts.values());
  }

  /**
   * Block user
   * @param {string} userId - User ID to block
   */
  blockUser(userId) {
    this.state.blockedUsers.add(userId);
    
    this.eventBus.emit('userStore:userBlocked', {
      userId
    });
    
    // Save blocked users
    this.saveBlockedUsers();
  }

  /**
   * Unblock user
   * @param {string} userId - User ID to unblock
   */
  unblockUser(userId) {
    const wasBlocked = this.state.blockedUsers.has(userId);
    this.state.blockedUsers.delete(userId);
    
    if (wasBlocked) {
      this.eventBus.emit('userStore:userUnblocked', {
        userId
      });
      
      // Save blocked users
      this.saveBlockedUsers();
    }
  }

  /**
   * Check if user is blocked
   * @param {string} userId - User ID
   */
  isUserBlocked(userId) {
    return this.state.blockedUsers.has(userId);
  }

  /**
   * Get blocked users
   */
  getBlockedUsers() {
    return Array.from(this.state.blockedUsers);
  }

  /**
   * Set settings
   * @param {Object} settings - Settings object
   */
  setSettings(settings) {
    const oldSettings = { ...this.state.settings };
    this.state.settings = { ...this.state.settings, ...settings };
    
    // Save to storage
    this.saveUserData();
    
    this.eventBus.emit('userStore:settingsUpdated', {
      oldSettings,
      newSettings: this.state.settings,
      updates: settings
    });
  }

  /**
   * Get settings
   */
  getSettings() {
    return this.state.settings;
  }

  /**
   * Add session
   * @param {Object} session - Session object
   */
  addSession(session) {
    this.state.sessions.push(session);
    
    this.eventBus.emit('userStore:sessionAdded', {
      session
    });
  }

  /**
   * Remove session
   * @param {string} sessionId - Session ID
   */
  removeSession(sessionId) {
    const sessionIndex = this.state.sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex !== -1) {
      const session = this.state.sessions.splice(sessionIndex, 1)[0];
      
      this.eventBus.emit('userStore:sessionRemoved', {
        sessionId,
        session
      });
    }
  }

  /**
   * Get sessions
   */
  getSessions() {
    return this.state.sessions;
  }

  /**
   * Load user data from storage
   */
  async loadUserData() {
    try {
      // Load current user
      const currentUser = storage.get('quickchat:user');
      if (currentUser) {
        this.state.currentUser = currentUser;
        this.state.isAuthenticated = true;
      }
      
      // Load profile
      const profile = storage.get('quickchat:profile');
      if (profile) {
        this.state.profile = profile;
      }
      
      // Load preferences
      const preferences = storage.get('quickchat:preferences');
      if (preferences) {
        this.state.preferences = { ...this.state.preferences, ...preferences };
      }
      
      // Load contacts
      const contacts = storage.get('quickchat:contacts');
      if (contacts) {
        this.state.contacts = new Map(Object.entries(contacts));
      }
      
      // Load blocked users
      const blockedUsers = storage.get('quickchat:blocked-users');
      if (blockedUsers && Array.isArray(blockedUsers)) {
        this.state.blockedUsers = new Set(blockedUsers);
      }
      
      // Load settings
      const settings = storage.get('quickchat:settings');
      if (settings) {
        this.state.settings = settings;
      }
      
    } catch (error) {
      logger.warn('Failed to load user data from storage:', error);
    }
  }

  /**
   * Save user data to storage
   */
  saveUserData() {
    try {
      if (this.state.currentUser) {
        storage.set('quickchat:user', this.state.currentUser);
      }
      
      if (this.state.profile) {
        storage.set('quickchat:profile', this.state.profile);
      }
      
      storage.set('quickchat:preferences', this.state.preferences);
      storage.set('quickchat:settings', this.state.settings);
      
    } catch (error) {
      logger.warn('Failed to save user data to storage:', error);
    }
  }

  /**
   * Save contacts to storage
   */
  saveContacts() {
    try {
      const contacts = Object.fromEntries(this.state.contacts);
      storage.set('quickchat:contacts', contacts);
    } catch (error) {
      logger.warn('Failed to save contacts to storage:', error);
    }
  }

  /**
   * Save blocked users to storage
   */
  saveBlockedUsers() {
    try {
      const blockedUsers = Array.from(this.state.blockedUsers);
      storage.set('quickchat:blocked-users', blockedUsers);
    } catch (error) {
      logger.warn('Failed to save blocked users to storage:', error);
    }
  }

  /**
   * Check authentication status
   */
  async checkAuthStatus() {
    try {
      const token = storage.get('quickchat:auth-token');
      if (token && this.state.currentUser) {
        // Token exists and user data is loaded
        this.state.isAuthenticated = true;
      } else {
        // No token or user data
        this.state.isAuthenticated = false;
        this.state.currentUser = null;
      }
    } catch (error) {
      logger.warn('Failed to check auth status:', error);
      this.state.isAuthenticated = false;
    }
  }

  /**
   * Logout user
   */
  logout() {
    // Clear user data
    this.state.currentUser = null;
    this.state.isAuthenticated = false;
    this.state.profile = null;
    this.state.sessions = [];
    
    // Clear storage
    storage.remove('quickchat:user');
    storage.remove('quickchat:profile');
    storage.remove('quickchat:auth-token');
    
    this.eventBus.emit('userStore:logout');
    
    logger.info('User logged out');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Handle theme preference changes
    this.eventBus.on('userStore:preferencesUpdated', (event) => {
      if (event.data.updates.theme) {
        this.applyTheme(event.data.updates.theme);
      }
    });
  }

  /**
   * Emit specific preference change events
   * @param {Object} updates - Preference updates
   */
  emitPreferenceEvents(updates) {
    if (updates.theme) {
      this.eventBus.emit('userStore:themeChanged', {
        theme: updates.theme
      });
    }
    
    if (updates.language) {
      this.eventBus.emit('userStore:languageChanged', {
        language: updates.language
      });
    }
    
    if (updates.notifications) {
      this.eventBus.emit('userStore:notificationPreferencesChanged', {
        notifications: updates.notifications
      });
    }
  }

  /**
   * Apply theme
   * @param {string} theme - Theme name
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Handle auto theme
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Clear all user data
   */
  clear() {
    this.state = {
      currentUser: null,
      isAuthenticated: false,
      profile: null,
      preferences: {
        theme: 'auto',
        language: 'en',
        notifications: {
          desktop: true,
          sound: true,
          email: false
        },
        privacy: {
          showOnlineStatus: true,
          allowDirectMessages: true,
          showLastSeen: true
        },
        accessibility: {
          reducedMotion: false,
          highContrast: false,
          fontSize: 'medium',
          screenReader: false
        }
      },
      sessions: [],
      contacts: new Map(),
      blockedUsers: new Set(),
      settings: {}
    };
    
    // Clear storage
    storage.remove('quickchat:user');
    storage.remove('quickchat:profile');
    storage.remove('quickchat:preferences');
    storage.remove('quickchat:contacts');
    storage.remove('quickchat:blocked-users');
    storage.remove('quickchat:settings');
    
    this.eventBus.emit('userStore:cleared');
    logger.info('User store cleared');
  }

  /**
   * Enable debug mode
   * @param {boolean} enabled - Debug enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      initialized: this.initialized,
      isAuthenticated: this.state.isAuthenticated,
      currentUser: this.state.currentUser ? {
        id: this.state.currentUser.id,
        username: this.state.currentUser.username
      } : null,
      contactCount: this.state.contacts.size,
      blockedUserCount: this.state.blockedUsers.size,
      sessionCount: this.state.sessions.length,
      preferences: this.state.preferences,
      settings: Object.keys(this.state.settings)
    };
  }
}

// Create singleton instance
export const userStore = new UserStore();
