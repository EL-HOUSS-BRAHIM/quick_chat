/**
 * Theme Manager Module
 * 
 * Handles theme switching (dark/light) and accessibility settings
 */

class ThemeManager {
  constructor(options = {}) {
    this.options = {
      defaultTheme: 'light',
      storageKey: 'quick_chat_theme',
      ...options
    };
    
    this.currentTheme = null;
    this.themeChangeCallbacks = [];
    
    // DOM elements
    this.themeToggleBtn = null;
    this.themeStylesheet = null;
  }
  
  /**
   * Initialize the theme manager
   */
  async init() {
    this.findElements();
    this.createMissingElements();
    this.loadSavedTheme();
    this.setupEventListeners();
    
    // Announce to screen readers that theme preferences are available
    if (window.accessibilityManager) {
      window.accessibilityManager.announcePolite('Theme preferences are available in the settings menu');
    }
    
    return this;
  }
  
  /**
   * Find required DOM elements
   */
  findElements() {
    this.themeToggleBtn = document.getElementById('theme-toggle');
    this.themeStylesheet = document.getElementById('theme-stylesheet');
  }
  
  /**
   * Create any missing UI elements
   */
  createMissingElements() {
    // Create theme toggle button if it doesn't exist
    if (!this.themeToggleBtn) {
      this.themeToggleBtn = document.createElement('button');
      this.themeToggleBtn.id = 'theme-toggle';
      this.themeToggleBtn.className = 'theme-toggle-btn';
      this.themeToggleBtn.setAttribute('aria-label', 'Toggle dark/light theme');
      this.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
      
      // Add to the header or nav area
      const navElement = document.querySelector('header nav, .navbar, .header-controls');
      if (navElement) {
        navElement.appendChild(this.themeToggleBtn);
      } else {
        // Fallback to body if no suitable parent found
        document.body.appendChild(this.themeToggleBtn);
      }
    }
    
    // Create theme stylesheet link if it doesn't exist
    if (!this.themeStylesheet) {
      this.themeStylesheet = document.createElement('link');
      this.themeStylesheet.id = 'theme-stylesheet';
      this.themeStylesheet.rel = 'stylesheet';
      document.head.appendChild(this.themeStylesheet);
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }
    
    // Listen for system preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        // Only change if the user hasn't explicitly set a preference
        if (!localStorage.getItem(this.options.storageKey)) {
          this.setTheme(newTheme);
        }
      });
    }
  }
  
  /**
   * Load saved theme preference or use system preference
   */
  loadSavedTheme() {
    // Check for saved preference
    const savedTheme = localStorage.getItem(this.options.storageKey);
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.setTheme('dark');
      } else {
        this.setTheme(this.options.defaultTheme);
      }
    }
  }
  
  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }
  
  /**
   * Set the current theme
   * @param {string} theme - Theme to set ('light' or 'dark')
   */
  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') {
      console.warn(`Invalid theme: ${theme}. Using default: ${this.options.defaultTheme}`);
      theme = this.options.defaultTheme;
    }
    
    this.currentTheme = theme;
    
    // Update stylesheet
    this.themeStylesheet.href = `/assets/css/themes/${theme}.css`;
    
    // Update toggle button icon
    if (this.themeToggleBtn) {
      if (theme === 'dark') {
        this.themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        this.themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
      } else {
        this.themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        this.themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
      }
    }
    
    // Update data attribute on body for CSS selectors
    document.body.setAttribute('data-theme', theme);
    
    // Save preference to local storage
    localStorage.setItem(this.options.storageKey, theme);
    
    // Run callbacks
    this.themeChangeCallbacks.forEach(callback => callback(theme));
    
    // Announce theme change to screen readers
    if (window.accessibilityManager) {
      window.accessibilityManager.announcePolite(`Theme changed to ${theme} mode`);
    }
    
    return theme;
  }
  
  /**
   * Register a callback to be called when the theme changes
   * @param {function} callback - Function to call with the new theme
   */
  onThemeChange(callback) {
    if (typeof callback === 'function') {
      this.themeChangeCallbacks.push(callback);
    }
  }
  
  /**
   * Get the current theme
   * @returns {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    return this.currentTheme;
  }
}

// Create and export singleton instance
const themeManager = new ThemeManager();

export default themeManager;

// For backwards compatibility with legacy code
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}
