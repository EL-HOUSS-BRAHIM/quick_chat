/**
 * Application Configuration Manager - Organized Architecture
 * 
 * Centralized configuration management for the entire application
 * Handles environment-specific settings and feature flags
 */

import { FEATURE_FLAGS, API_CONFIG, WEBSOCKET_CONFIG, WEBRTC_CONFIG } from './constants.js';
import { logger } from './logger.js';

class ConfigManager {
  constructor() {
    this.config = new Map();
    this.initialized = false;
    this.environment = this.detectEnvironment();
  }

  /**
   * Initialize configuration manager
   */
  async init() {
    try {
      // Load base configuration
      await this.loadBaseConfig();
      
      // Load environment-specific configuration
      await this.loadEnvironmentConfig();
      
      // Load feature flags
      await this.loadFeatureFlags();
      
      // Load user preferences
      await this.loadUserPreferences();
      
      this.initialized = true;
      logger.info('Configuration Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Configuration Manager:', error);
      throw error;
    }
  }

  /**
   * Detect current environment
   */
  detectEnvironment() {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      } else if (hostname.includes('staging') || hostname.includes('test')) {
        return 'staging';
      } else {
        return 'production';
      }
    }
    
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Load base configuration
   */
  async loadBaseConfig() {
    // API Configuration
    this.set('api.baseUrl', API_CONFIG.BASE_URL);
    this.set('api.timeout', API_CONFIG.TIMEOUT);
    this.set('api.retryAttempts', API_CONFIG.RETRY_ATTEMPTS);
    this.set('api.retryDelay', API_CONFIG.RETRY_DELAY);

    // WebSocket Configuration
    this.set('websocket.url', WEBSOCKET_CONFIG.URL);
    this.set('websocket.reconnectAttempts', WEBSOCKET_CONFIG.RECONNECT_ATTEMPTS);
    this.set('websocket.reconnectDelay', WEBSOCKET_CONFIG.RECONNECT_DELAY);
    this.set('websocket.heartbeatInterval', WEBSOCKET_CONFIG.HEARTBEAT_INTERVAL);

    // WebRTC Configuration
    this.set('webrtc.iceServers', WEBRTC_CONFIG.ICE_SERVERS);
    this.set('webrtc.mediaConstraints', WEBRTC_CONFIG.MEDIA_CONSTRAINTS);
  }

  /**
   * Load environment-specific configuration
   */
  async loadEnvironmentConfig() {
    switch (this.environment) {
      case 'development':
        this.set('debug.enabled', true);
        this.set('debug.level', 'debug');
        this.set('api.baseUrl', '/api/v1');
        this.set('websocket.url', 'ws://localhost:8080/ws');
        break;
        
      case 'staging':
        this.set('debug.enabled', true);
        this.set('debug.level', 'info');
        this.set('analytics.enabled', false);
        break;
        
      case 'production':
        this.set('debug.enabled', false);
        this.set('debug.level', 'error');
        this.set('analytics.enabled', true);
        this.set('performance.monitoring', true);
        break;
    }
  }

  /**
   * Load feature flags
   */
  async loadFeatureFlags() {
    // Try to load from server first, fallback to defaults
    try {
      const response = await fetch('/api/v1/config/features');
      if (response.ok) {
        const serverFlags = await response.json();
        Object.entries(serverFlags).forEach(([key, value]) => {
          this.set(`features.${key}`, value);
        });
      } else {
        // Use default feature flags
        Object.entries(FEATURE_FLAGS).forEach(([key, value]) => {
          this.set(`features.${key}`, value);
        });
      }
    } catch (error) {
      // Use default feature flags
      Object.entries(FEATURE_FLAGS).forEach(([key, value]) => {
        this.set(`features.${key}`, value);
      });
      logger.warn('Failed to load server feature flags, using defaults:', error);
    }
  }

  /**
   * Load user preferences
   */
  async loadUserPreferences() {
    try {
      // Load from localStorage
      const savedPrefs = localStorage.getItem('quickchat_preferences');
      if (savedPrefs) {
        const preferences = JSON.parse(savedPrefs);
        Object.entries(preferences).forEach(([key, value]) => {
          this.set(`user.${key}`, value);
        });
      }
    } catch (error) {
      logger.warn('Failed to load user preferences:', error);
    }
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    if (!this.initialized) {
      logger.warn('Configuration Manager not initialized, using default value for:', key);
      return defaultValue;
    }
    
    return this.config.get(key) ?? defaultValue;
  }

  /**
   * Set configuration value
   */
  set(key, value) {
    this.config.set(key, value);
    
    // Save user preferences
    if (key.startsWith('user.')) {
      this.saveUserPreference(key.replace('user.', ''), value);
    }
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  /**
   * Get all configuration as object
   */
  getAll() {
    const config = {};
    for (const [key, value] of this.config.entries()) {
      this.setNestedProperty(config, key, value);
    }
    return config;
  }

  /**
   * Save user preference to localStorage
   */
  saveUserPreference(key, value) {
    try {
      const savedPrefs = localStorage.getItem('quickchat_preferences');
      const preferences = savedPrefs ? JSON.parse(savedPrefs) : {};
      preferences[key] = value;
      localStorage.setItem('quickchat_preferences', JSON.stringify(preferences));
    } catch (error) {
      logger.error('Failed to save user preference:', error);
    }
  }

  /**
   * Set nested property in object
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Update configuration at runtime
   */
  async updateConfig(updates) {
    try {
      Object.entries(updates).forEach(([key, value]) => {
        this.set(key, value);
      });
      
      logger.info('Configuration updated:', updates);
      
    } catch (error) {
      logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset() {
    this.config.clear();
    localStorage.removeItem('quickchat_preferences');
    await this.init();
  }

  /**
   * Get environment
   */
  getEnvironment() {
    return this.environment;
  }

  /**
   * Check if in development mode
   */
  isDevelopment() {
    return this.environment === 'development';
  }

  /**
   * Check if in production mode
   */
  isProduction() {
    return this.environment === 'production';
  }
}

// Create and export singleton instance
export const configManager = new ConfigManager();

// Export class for testing
export { ConfigManager };
