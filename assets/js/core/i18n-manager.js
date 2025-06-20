/**
 * Internationalization Manager
 * Handles multi-language support and localization
 * Progress: 55% complete (framework setup)
 */

class InternationalizationManager {
  constructor() {
    this.currentLanguage = 'en';
    this.defaultLanguage = 'en';
    this.translations = new Map();
    this.dateFormatters = new Map();
    this.numberFormatters = new Map();
    this.rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    this.initialized = false;
    this.fallbackChain = ['en'];
    
    // Detect user's preferred language
    this.detectLanguage();
  }

  /**
   * Initialize the internationalization system
   */
  async init() {
    if (this.initialized) return;
    
    console.log('Initializing Internationalization Manager');
    
    try {
      // Load default translations
      await this.loadTranslations(this.defaultLanguage);
      
      // Load user's preferred language if different
      if (this.currentLanguage !== this.defaultLanguage) {
        await this.loadTranslations(this.currentLanguage);
      }
      
      // Setup formatters
      this.setupFormatters();
      
      // Apply initial translations
      this.applyTranslations();
      
      // Setup language direction (RTL/LTR)
      this.setupLanguageDirection();
      
      // Setup mutation observer for dynamic content
      this.setupMutationObserver();
      
      this.initialized = true;
      
      // Dispatch initialization event
      document.dispatchEvent(new CustomEvent('quickchat:i18n:initialized', {
        detail: { language: this.currentLanguage }
      }));
      
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // Fall back to default language
      this.currentLanguage = this.defaultLanguage;
    }
  }

  /**
   * Detect user's preferred language
   */
  detectLanguage() {
    // Check localStorage first
    const savedLanguage = localStorage.getItem('quickchat_language');
    if (savedLanguage) {
      this.currentLanguage = savedLanguage;
      return;
    }
    
    // Check browser language
    const browserLang = navigator.language || navigator.languages[0];
    if (browserLang) {
      // Extract language code (e.g., 'en-US' -> 'en')
      this.currentLanguage = browserLang.split('-')[0];
    }
    
    // Check HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang && !savedLanguage) {
      this.currentLanguage = htmlLang.split('-')[0];
    }
  }

  /**
   * Load translations for a specific language
   */
  async loadTranslations(language) {
    try {
      // Try to load from API first
      let translations;
      try {
        const response = await fetch(`/api/translations/${language}`);
        if (response.ok) {
          translations = await response.json();
        }
      } catch (apiError) {
        console.warn(`Could not load translations from API for ${language}:`, apiError);
      }
      
      // Fallback to static files
      if (!translations) {
        const response = await fetch(`/assets/i18n/${language}.json`);
        if (response.ok) {
          translations = await response.json();
        } else {
          throw new Error(`Could not load translations for ${language}`);
        }
      }
      
      this.translations.set(language, translations);
      console.log(`Loaded translations for ${language}`);
      
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);
      
      // If it's not the default language, we can continue without it
      if (language !== this.defaultLanguage) {
        throw error;
      }
    }
  }

  /**
   * Get translated string
   */
  t(key, params = {}, language = null) {
    const lang = language || this.currentLanguage;
    const translations = this.translations.get(lang);
    
    let translation = this.getNestedTranslation(translations, key);
    
    // Fallback to default language
    if (!translation && lang !== this.defaultLanguage) {
      const defaultTranslations = this.translations.get(this.defaultLanguage);
      translation = this.getNestedTranslation(defaultTranslations, key);
    }
    
    // Final fallback to the key itself
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      translation = key;
    }
    
    // Replace parameters in translation
    return this.replaceParams(translation, params);
  }

  /**
   * Get nested translation value
   */
  getNestedTranslation(translations, key) {
    if (!translations) return null;
    
    const keys = key.split('.');
    let current = translations;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }

  /**
   * Replace parameters in translation string
   */
  replaceParams(translation, params) {
    let result = translation;
    
    // Replace named parameters like {{name}}
    Object.keys(params).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, params[key]);
    });
    
    // Replace positional parameters like {0}, {1}
    if (Array.isArray(params)) {
      params.forEach((value, index) => {
        const regex = new RegExp(`{${index}}`, 'g');
        result = result.replace(regex, value);
      });
    }
    
    return result;
  }

  /**
   * Setup number and date formatters
   */
  setupFormatters() {
    // Setup date formatters
    this.dateFormatters.set('short', new Intl.DateTimeFormat(this.currentLanguage, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }));
    
    this.dateFormatters.set('long', new Intl.DateTimeFormat(this.currentLanguage, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }));
    
    this.dateFormatters.set('time', new Intl.DateTimeFormat(this.currentLanguage, {
      hour: '2-digit',
      minute: '2-digit'
    }));
    
    this.dateFormatters.set('datetime', new Intl.DateTimeFormat(this.currentLanguage, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }));
    
    // Setup number formatters
    this.numberFormatters.set('decimal', new Intl.NumberFormat(this.currentLanguage));
    this.numberFormatters.set('currency', new Intl.NumberFormat(this.currentLanguage, {
      style: 'currency',
      currency: 'USD' // This should be configurable
    }));
    this.numberFormatters.set('percent', new Intl.NumberFormat(this.currentLanguage, {
      style: 'percent'
    }));
  }

  /**
   * Format date according to current locale
   */
  formatDate(date, format = 'short') {
    const formatter = this.dateFormatters.get(format);
    if (formatter) {
      return formatter.format(date);
    }
    return date.toLocaleDateString(this.currentLanguage);
  }

  /**
   * Format number according to current locale
   */
  formatNumber(number, format = 'decimal') {
    const formatter = this.numberFormatters.get(format);
    if (formatter) {
      return formatter.format(number);
    }
    return number.toLocaleString(this.currentLanguage);
  }

  /**
   * Setup language direction (RTL/LTR)
   */
  setupLanguageDirection() {
    const isRTL = this.rtlLanguages.includes(this.currentLanguage);
    
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = this.currentLanguage;
    
    // Add CSS class for RTL styling
    document.body.classList.toggle('rtl', isRTL);
    document.body.classList.toggle('ltr', !isRTL);
  }

  /**
   * Apply translations to existing DOM elements
   */
  applyTranslations() {
    // Find elements with data-i18n attribute
    const translatableElements = document.querySelectorAll('[data-i18n]');
    
    translatableElements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const params = this.getElementTranslationParams(element);
      
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = this.t(key, params);
      } else {
        element.textContent = this.t(key, params);
      }
    });
    
    // Translate title attributes
    const titledElements = document.querySelectorAll('[data-i18n-title]');
    titledElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const params = this.getElementTranslationParams(element);
      element.title = this.t(key, params);
    });
    
    // Translate aria-label attributes
    const ariaElements = document.querySelectorAll('[data-i18n-aria]');
    ariaElements.forEach(element => {
      const key = element.getAttribute('data-i18n-aria');
      const params = this.getElementTranslationParams(element);
      element.setAttribute('aria-label', this.t(key, params));
    });
  }

  /**
   * Get translation parameters from element data attributes
   */
  getElementTranslationParams(element) {
    const params = {};
    
    // Get all data-i18n-param-* attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('data-i18n-param-')) {
        const paramName = attr.name.replace('data-i18n-param-', '');
        params[paramName] = attr.value;
      }
    });
    
    return params;
  }

  /**
   * Setup mutation observer to translate new content
   */
  setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.translateNewElement(node);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.mutationObserver = observer;
  }

  /**
   * Translate a newly added element
   */
  translateNewElement(element) {
    // Translate the element itself if it has data-i18n
    if (element.hasAttribute('data-i18n')) {
      const key = element.getAttribute('data-i18n');
      const params = this.getElementTranslationParams(element);
      element.textContent = this.t(key, params);
    }
    
    // Translate child elements
    const translatableChildren = element.querySelectorAll('[data-i18n]');
    translatableChildren.forEach(child => {
      const key = child.getAttribute('data-i18n');
      const params = this.getElementTranslationParams(child);
      child.textContent = this.t(key, params);
    });
  }

  /**
   * Change the current language
   */
  async changeLanguage(language) {
    if (language === this.currentLanguage) return;
    
    try {
      // Load translations for new language if not already loaded
      if (!this.translations.has(language)) {
        await this.loadTranslations(language);
      }
      
      this.currentLanguage = language;
      
      // Save to localStorage
      localStorage.setItem('quickchat_language', language);
      
      // Update formatters
      this.setupFormatters();
      
      // Update language direction
      this.setupLanguageDirection();
      
      // Re-apply translations
      this.applyTranslations();
      
      // Dispatch language change event
      document.dispatchEvent(new CustomEvent('quickchat:i18n:languageChanged', {
        detail: { language: language }
      }));
      
      console.log(`Language changed to: ${language}`);
      
    } catch (error) {
      console.error(`Failed to change language to ${language}:`, error);
      throw error;
    }
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages() {
    try {
      const response = await fetch('/api/translations/available');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // Fallback to hardcoded list
      return [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'it', name: 'Italian', nativeName: 'Italiano' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'zh', name: 'Chinese', nativeName: '中文' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'he', name: 'Hebrew', nativeName: 'עברית' }
      ];
    }
  }

  /**
   * Check if current language is RTL
   */
  isRTL() {
    return this.rtlLanguages.includes(this.currentLanguage);
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Pluralization helper
   */
  plural(key, count, params = {}) {
    const pluralKey = count === 1 ? `${key}.singular` : `${key}.plural`;
    return this.t(pluralKey, { ...params, count });
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    
    this.translations.clear();
    this.dateFormatters.clear();
    this.numberFormatters.clear();
    this.initialized = false;
  }
}

// Create default translation files directory structure
const createDefaultTranslations = () => {
  const defaultTranslations = {
    en: {
      common: {
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
        search: 'Search',
        clear: 'Clear'
      },
      chat: {
        title: 'Quick Chat',
        messageInput: 'Type your message...',
        send: 'Send',
        newMessage: 'New message from {{author}}',
        userJoined: '{{username}} joined the chat',
        userLeft: '{{username}} left the chat',
        typing: 'is typing...',
        online: 'Online',
        offline: 'Offline',
        messages: {
          singular: '{{count}} message',
          plural: '{{count}} messages'
        }
      },
      navigation: {
        dashboard: 'Dashboard',
        profile: 'Profile',
        settings: 'Settings',
        logout: 'Logout',
        admin: 'Administration'
      },
      accessibility: {
        skipToContent: 'Skip to main content',
        mainNavigation: 'Main navigation',
        chatMessages: 'Chat messages',
        messageInput: 'Message input field',
        sendMessage: 'Send message',
        userOnline: 'User is online',
        userOffline: 'User is offline'
      }
    }
  };
  
  return defaultTranslations;
};

export default new InternationalizationManager();
export { createDefaultTranslations };
