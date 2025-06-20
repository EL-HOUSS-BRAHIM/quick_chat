/**
 * Theme Manager Service
 * 
 * Manages application themes and appearance settings
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class ThemeManager {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    this.currentTheme = 'light';
    this.availableThemes = {
      light: {
        name: 'Light',
        colors: {
          primary: '#007bff',
          secondary: '#6c757d',
          success: '#28a745',
          warning: '#ffc107',
          danger: '#dc3545',
          info: '#17a2b8',
          background: '#ffffff',
          backgroundSecondary: '#f8f9fa',
          text: '#333333',
          textMuted: '#6c757d',
          border: '#dee2e6'
        }
      },
      dark: {
        name: 'Dark',
        colors: {
          primary: '#0d6efd',
          secondary: '#6c757d',
          success: '#198754',
          warning: '#ffc107',
          danger: '#dc3545',
          info: '#0dcaf0',
          background: '#1a1a1a',
          backgroundSecondary: '#2d2d2d',
          text: '#ffffff',
          textMuted: '#adb5bd',
          border: '#495057'
        }
      },
      auto: {
        name: 'Auto (System)',
        followsSystem: true
      }
    };
    this.prefersDarkScheme = false;
  }

  /**
   * Initialize theme manager
   */
  init() {
    if (this.initialized) return;

    try {
      // Detect system theme preference
      this.detectSystemTheme();
      
      // Load saved theme preference
      this.loadThemePreference();
      
      // Apply initial theme
      this.applyTheme(this.currentTheme);
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      logger.debug('Theme manager initialized with theme:', this.currentTheme);
    } catch (error) {
      logger.error('Failed to initialize theme manager:', error);
    }
  }

  /**
   * Detect system theme preference
   */
  detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.prefersDarkScheme = true;
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        this.prefersDarkScheme = e.matches;
        
        // If current theme is auto, update the appearance
        if (this.currentTheme === 'auto') {
          this.applyAutoTheme();
        }
        
        this.eventBus.emit('theme:systemChanged', {
          prefersDark: this.prefersDarkScheme
        });
      });
    }
  }

  /**
   * Load theme preference from storage
   */
  loadThemePreference() {
    const savedTheme = localStorage.getItem('quickchat_theme');
    if (savedTheme && this.availableThemes[savedTheme]) {
      this.currentTheme = savedTheme;
    } else {
      // Default to auto theme
      this.currentTheme = 'auto';
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus.on('theme:change', (theme) => {
      this.setTheme(theme);
    });

    this.eventBus.on('theme:toggle', () => {
      this.toggleTheme();
    });
  }

  /**
   * Set theme
   */
  setTheme(themeName) {
    if (!this.availableThemes[themeName]) {
      logger.warn('Unknown theme:', themeName);
      return;
    }

    const previousTheme = this.currentTheme;
    this.currentTheme = themeName;
    
    // Save preference
    localStorage.setItem('quickchat_theme', themeName);
    
    // Apply theme
    this.applyTheme(themeName);
    
    // Emit change event
    this.eventBus.emit('theme:changed', {
      from: previousTheme,
      to: themeName
    });
    
    logger.debug('Theme changed to:', themeName);
  }

  /**
   * Apply theme to document
   */
  applyTheme(themeName) {
    // Remove existing theme classes
    document.body.classList.remove('light-theme', 'dark-theme');
    
    if (themeName === 'auto') {
      this.applyAutoTheme();
    } else {
      this.applySpecificTheme(themeName);
    }
  }

  /**
   * Apply auto theme based on system preference
   */
  applyAutoTheme() {
    const effectiveTheme = this.prefersDarkScheme ? 'dark' : 'light';
    this.applySpecificTheme(effectiveTheme);
  }

  /**
   * Apply specific theme
   */
  applySpecificTheme(themeName) {
    const theme = this.availableThemes[themeName];
    if (!theme || !theme.colors) return;

    // Add theme class to body
    document.body.classList.add(`${themeName}-theme`);
    
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-color`;
      root.style.setProperty(cssVar, value);
    });
    
    // Update meta theme-color for mobile browsers
    this.updateMetaThemeColor(theme.colors.primary);
  }

  /**
   * Update meta theme-color tag
   */
  updateMetaThemeColor(color) {
    let metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'theme-color';
      document.head.appendChild(metaTag);
    }
    metaTag.content = color;
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    if (this.currentTheme === 'light') {
      this.setTheme('dark');
    } else if (this.currentTheme === 'dark') {
      this.setTheme('light');
    } else {
      // If auto, toggle to opposite of current system preference
      this.setTheme(this.prefersDarkScheme ? 'light' : 'dark');
    }
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }

  /**
   * Get effective theme (resolves auto)
   */
  getEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      return this.prefersDarkScheme ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return Object.keys(this.availableThemes).map(key => ({
      key,
      name: this.availableThemes[key].name,
      followsSystem: this.availableThemes[key].followsSystem || false
    }));
  }

  /**
   * Get theme colors
   */
  getThemeColors(themeName = null) {
    const theme = themeName || this.getEffectiveTheme();
    return this.availableThemes[theme]?.colors || {};
  }

  /**
   * Add custom theme
   */
  addCustomTheme(name, themeConfig) {
    this.availableThemes[name] = {
      name: themeConfig.displayName || name,
      colors: themeConfig.colors,
      custom: true
    };
    
    this.eventBus.emit('theme:customAdded', { name, config: themeConfig });
  }

  /**
   * Remove custom theme
   */
  removeCustomTheme(name) {
    if (this.availableThemes[name]?.custom) {
      delete this.availableThemes[name];
      
      // If current theme was removed, fallback to light
      if (this.currentTheme === name) {
        this.setTheme('light');
      }
      
      this.eventBus.emit('theme:customRemoved', { name });
    }
  }

  /**
   * Export current theme configuration
   */
  exportTheme() {
    const theme = this.availableThemes[this.getEffectiveTheme()];
    return {
      name: this.currentTheme,
      colors: theme.colors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import theme configuration
   */
  importTheme(themeConfig) {
    if (!themeConfig.colors) {
      throw new Error('Invalid theme configuration');
    }
    
    const themeName = themeConfig.name || 'imported';
    this.addCustomTheme(themeName, {
      displayName: themeConfig.displayName || themeName,
      colors: themeConfig.colors
    });
    
    return themeName;
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode() {
    return this.getEffectiveTheme() === 'dark';
  }

  /**
   * Get contrast ratio between two colors
   */
  getContrastRatio(color1, color2) {
    // Simple contrast calculation (would need color parsing for full implementation)
    return 1; // Placeholder
  }

  /**
   * Generate accessible color variants
   */
  generateColorVariants(baseColor) {
    // Generate lighter/darker variants for accessibility
    // This is a simplified implementation
    return {
      light: baseColor,
      dark: baseColor,
      contrast: '#ffffff'
    };
  }

  /**
   * Destroy theme manager
   */
  destroy() {
    // Reset to default theme
    document.body.classList.remove('light-theme', 'dark-theme');
    
    // Clear custom properties
    const root = document.documentElement;
    root.style.removeProperty('--primary-color');
    // ... remove other properties
    
    this.initialized = false;
  }
}

// Create singleton instance
export const themeManager = new ThemeManager();
export default themeManager;