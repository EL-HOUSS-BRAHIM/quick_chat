/**
 * Theme Management System
 * Handles theme switching and persistence
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'light';
    this.themeChangeListeners = [];
    this.supportedThemes = ['light', 'dark', 'high-contrast'];
    this.init();
  }

  init() {
    // Load saved theme from localStorage
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.applyTheme(this.currentTheme);
    
    // Set up event listeners
    this.setupListeners();
  }

  setupListeners() {
    // Listen for theme toggle clicks
    document.addEventListener('DOMContentLoaded', () => {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.checked = this.currentTheme === 'dark';
        themeToggle.addEventListener('change', () => {
          this.toggleTheme();
        });
      }
      
      // Listen for theme selection from dropdown if it exists
      const themeSelector = document.getElementById('themeSelector');
      if (themeSelector) {
        themeSelector.value = this.currentTheme;
        themeSelector.addEventListener('change', (e) => {
          this.setTheme(e.target.value);
        });
      }
    });
    
    // Match system preference if user hasn't explicitly chosen
    if (!localStorage.getItem('theme')) {
      this.matchSystemPreference();
    }
  }

  /**
   * Match theme to system dark mode preference
   */
  matchSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setTheme('dark');
    }
    
    // Listen for changes to system preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    
    // Show toast notification
    try {
      const utils = require('./utils');
      utils.showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`);
    } catch (e) {
      if (window.utils && typeof window.utils.showToast === 'function') {
        window.utils.showToast(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} theme activated`);
      }
    }
  }

  /**
   * Set theme by name
   */
  setTheme(themeName) {
    if (!this.supportedThemes.includes(themeName)) {
      console.warn(`Theme '${themeName}' is not supported. Using default.`);
      themeName = 'light';
    }
    
    this.currentTheme = themeName;
    localStorage.setItem('theme', themeName);
    this.applyTheme(themeName);
    
    // Notify listeners
    this.notifyThemeChanged(themeName);
  }

  /**
   * Apply the selected theme to the document
   */
  applyTheme(themeName) {
    // Remove all theme classes
    document.body.classList.remove(...this.supportedThemes.map(theme => `${theme}-theme`));
    
    // Add the new theme class
    document.body.classList.add(`${themeName}-theme`);
    
    // Update UI controls
    this.updateThemeControls(themeName);
  }

  /**
   * Update UI controls to match current theme
   */
  updateThemeControls(themeName) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.checked = themeName === 'dark';
    }
    
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
      themeSelector.value = themeName;
    }
  }

  /**
   * Add a listener for theme changes
   */
  onThemeChange(callback) {
    if (typeof callback === 'function') {
      this.themeChangeListeners.push(callback);
    }
    return this;
  }

  /**
   * Notify all listeners about theme change
   */
  notifyThemeChanged(themeName) {
    this.themeChangeListeners.forEach(callback => {
      try {
        callback(themeName);
      } catch (error) {
        console.error('Error in theme change listener:', error);
      }
    });
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.currentTheme;
  }
}

// Create singleton instance
const themeManager = new ThemeManager();

export default themeManager;
