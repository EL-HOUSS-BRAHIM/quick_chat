/**
 * Frontend Configuration Module
 * Centralized configuration management for the Quick Chat frontend
 */

class FrontendConfig {
  constructor() {
    this.config = {
      // API Configuration
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      },

      // WebSocket Configuration
      websocket: {
        url: this.getWebSocketUrl(),
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
      },

      // WebRTC Configuration
      webrtc: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        turnServers: [], // Will be populated from API
        constraints: {
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            frameRate: { min: 15, ideal: 30, max: 60 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }
      },

      // UI Configuration
      ui: {
        theme: 'light', // 'light', 'dark', 'high-contrast', 'auto'
        animations: true,
        reducedMotion: false,
        fontSize: 'medium', // 'small', 'medium', 'large'
        density: 'comfortable', // 'compact', 'comfortable', 'spacious'
        sidebar: {
          defaultWidth: 300,
          minWidth: 250,
          maxWidth: 500
        }
      },

      // Accessibility Configuration
      accessibility: {
        screenReader: false,
        highContrast: false,
        keyboardNavigation: true,
        textToSpeech: false,
        speechToText: false,
        magnification: 1.0,
        announcements: true
      },

      // Performance Configuration
      performance: {
        virtualScrolling: true,
        lazyLoading: true,
        imageOptimization: true,
        caching: true,
        preloadMessages: 50,
        messageBuffer: 100
      },

      // Security Configuration
      security: {
        csrfProtection: true,
        xssProtection: true,
        contentSecurityPolicy: true,
        encryptLocalStorage: true
      },

      // Internationalization Configuration
      i18n: {
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
        rtlLanguages: ['ar', 'he', 'fa'],
        autoDetect: true,
        fallbackLanguage: 'en'
      },

      // File Upload Configuration
      fileUpload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'video/mp4', 'video/webm', 'video/ogg',
          'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
          'application/pdf', 'text/plain',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        chunkSize: 1024 * 1024, // 1MB chunks
        parallelUploads: 3,
        compression: {
          images: true,
          quality: 0.8,
          maxWidth: 1920,
          maxHeight: 1080
        }
      },

      // Mobile Configuration
      mobile: {
        swipeGestures: true,
        pullToRefresh: true,
        hapticFeedback: true,
        adaptiveUI: true,
        offlineMode: true
      },

      // Development Configuration
      development: {
        debug: false,
        logging: 'warn', // 'debug', 'info', 'warn', 'error'
        performance: false,
        analytics: true
      }
    };

    // Load saved preferences
    this.loadPreferences();
  }

  /**
   * Get API base URL based on environment
   */
  getApiBaseUrl() {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      return `${protocol}//${host}/api`;
    }
    return '/api';
  }

  /**
   * Get WebSocket URL based on environment
   */
  getWebSocketUrl() {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    return 'ws://localhost:8080/ws';
  }

  /**
   * Get configuration value
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let value = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  /**
   * Set configuration value
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    
    for (const key of keys) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    target[lastKey] = value;
    this.savePreferences();
  }

  /**
   * Update multiple configuration values
   */
  update(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }

  /**
   * Load preferences from localStorage
   */
  loadPreferences() {
    try {
      const saved = localStorage.getItem('quickchat_config');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.mergeConfig(this.config, preferences);
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
  }

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    try {
      // Only save user-configurable preferences
      const preferences = {
        ui: this.config.ui,
        accessibility: this.config.accessibility,
        performance: this.config.performance,
        i18n: { defaultLanguage: this.config.i18n.defaultLanguage },
        mobile: this.config.mobile,
        development: this.config.development
      };
      localStorage.setItem('quickchat_config', JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save preferences:', error);
    }
  }

  /**
   * Merge configuration objects
   */
  mergeConfig(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    localStorage.removeItem('quickchat_config');
    location.reload();
  }

  /**
   * Get configuration for specific feature
   */
  getFeatureConfig(feature) {
    return this.get(feature, {});
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature) {
    return this.get(feature, false);
  }

  /**
   * Enable/disable feature
   */
  setFeatureEnabled(feature, enabled) {
    this.set(feature, enabled);
  }
}

// Create singleton instance
const frontendConfig = new FrontendConfig();

export default frontendConfig;
