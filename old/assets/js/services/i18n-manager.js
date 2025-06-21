/**
 * Internationalization (i18n) Manager
 * Enhanced with RTL language support and auto-translation features
 */

class I18nManager {
  constructor() {
    this.currentLanguage = 'en';
    this.fallbackLanguage = 'en';
    this.translations = new Map();
    this.rtlLanguages = new Set(['ar', 'he', 'fa', 'ur', 'yi']);
    this.loadedLanguages = new Set();
    this.translationCache = new Map();
    this.autoTranslationEnabled = false;
    this.translationService = null;
    
    // Language detection
    this.browserLanguages = this.getBrowserLanguages();
    
    // Observers
    this.observers = new Set();
    
    // Initialize
    this.init();
  }

  /**
   * Initialize i18n system
   */
  async init() {
    // Load saved language preference
    const savedLanguage = localStorage.getItem('quickchat_language');
    if (savedLanguage) {
      this.currentLanguage = savedLanguage;
    } else {
      // Auto-detect language
      this.currentLanguage = this.detectLanguage();
    }

    // Load default language
    await this.loadLanguage(this.currentLanguage);
    
    // Load fallback if different
    if (this.currentLanguage !== this.fallbackLanguage) {
      await this.loadLanguage(this.fallbackLanguage);
    }

    // Apply language to DOM
    this.applyLanguage();

    // Set up auto-translation if enabled
    await this.initializeAutoTranslation();

    console.log(`I18n initialized with language: ${this.currentLanguage}`);
  }

  /**
   * Get browser languages in order of preference
   */
  getBrowserLanguages() {
    const languages = [];
    
    if (navigator.languages) {
      languages.push(...navigator.languages);
    }
    
    if (navigator.language) {
      languages.push(navigator.language);
    }
    
    if (navigator.userLanguage) {
      languages.push(navigator.userLanguage);
    }
    
    return languages.map(lang => lang.toLowerCase().split('-')[0]);
  }

  /**
   * Detect best language based on browser preferences
   */
  detectLanguage() {
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'he'];
    
    for (const browserLang of this.browserLanguages) {
      if (supportedLanguages.includes(browserLang)) {
        return browserLang;
      }
    }
    
    return this.fallbackLanguage;
  }

  /**
   * Load language translations
   */
  async loadLanguage(language) {
    if (this.loadedLanguages.has(language)) {
      return true;
    }

    try {
      const response = await fetch(`/assets/i18n/${language}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load language: ${language}`);
      }

      const translations = await response.json();
      this.translations.set(language, translations);
      this.loadedLanguages.add(language);
      
      console.log(`Loaded translations for: ${language}`);
      return true;
    } catch (error) {
      console.warn(`Failed to load language ${language}:`, error);
      return false;
    }
  }

  /**
   * Get translation for a key
   */
  t(key, params = {}, options = {}) {
    const language = options.language || this.currentLanguage;
    let translation = this.getTranslation(key, language);
    
    // Fall back to default language if not found
    if (!translation && language !== this.fallbackLanguage) {
      translation = this.getTranslation(key, this.fallbackLanguage);
    }
    
    // Fall back to key if no translation found
    if (!translation) {
      translation = key;
      console.warn(`Missing translation for key: ${key}`);
    }
    
    // Replace parameters
    return this.replaceParams(translation, params);
  }

  /**
   * Get translation from loaded translations
   */
  getTranslation(key, language) {
    const translations = this.translations.get(language);
    if (!translations) return null;
    
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    return typeof value === 'string' ? value : null;
  }

  /**
   * Replace parameters in translation
   */
  replaceParams(translation, params) {
    return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
      return params[param] !== undefined ? params[param] : match;
    });
  }

  /**
   * Change current language
   */
  async changeLanguage(language) {
    if (language === this.currentLanguage) return;
    
    // Load language if not already loaded
    const loaded = await this.loadLanguage(language);
    if (!loaded) return false;
    
    this.currentLanguage = language;
    localStorage.setItem('quickchat_language', language);
    
    // Apply to DOM
    this.applyLanguage();
    
    // Notify observers
    this.notifyObservers('languageChanged', { language });
    
    return true;
  }

  /**
   * Apply language settings to DOM
   */
  applyLanguage() {
    // Set HTML lang attribute
    document.documentElement.lang = this.currentLanguage;
    
    // Set text direction
    const isRTL = this.isRTL(this.currentLanguage);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.classList.toggle('rtl', isRTL);
    
    // Update all translatable elements
    this.updateTranslatableElements();

    // Apply RTL/LTR direction and language-specific styles
    this.applyLanguageDirection();
  }

  /**
   * Apply RTL/LTR direction and language-specific styles
   */
  applyLanguageDirection() {
    const isRTL = this.isRTL(this.currentLanguage);
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    // Set direction attribute
    htmlElement.dir = isRTL ? 'rtl' : 'ltr';
    htmlElement.lang = this.currentLanguage;

    // Add/remove RTL class
    if (isRTL) {
      bodyElement.classList.add('rtl');
      bodyElement.classList.remove('ltr');
    } else {
      bodyElement.classList.add('ltr');
      bodyElement.classList.remove('rtl');
    }

    // Apply language-specific CSS
    bodyElement.className = bodyElement.className.replace(/\blang-\w+\b/g, '');
    bodyElement.classList.add(`lang-${this.currentLanguage}`);

    // Update CSS custom properties for RTL support
    const root = document.documentElement;
    if (isRTL) {
      root.style.setProperty('--text-align-start', 'right');
      root.style.setProperty('--text-align-end', 'left');
      root.style.setProperty('--margin-start', 'margin-right');
      root.style.setProperty('--margin-end', 'margin-left');
      root.style.setProperty('--padding-start', 'padding-right');
      root.style.setProperty('--padding-end', 'padding-left');
      root.style.setProperty('--border-start', 'border-right');
      root.style.setProperty('--border-end', 'border-left');
      root.style.setProperty('--float-start', 'right');
      root.style.setProperty('--float-end', 'left');
    } else {
      root.style.setProperty('--text-align-start', 'left');
      root.style.setProperty('--text-align-end', 'right');
      root.style.setProperty('--margin-start', 'margin-left');
      root.style.setProperty('--margin-end', 'margin-right');
      root.style.setProperty('--padding-start', 'padding-left');
      root.style.setProperty('--padding-end', 'padding-right');
      root.style.setProperty('--border-start', 'border-left');
      root.style.setProperty('--border-end', 'border-right');
      root.style.setProperty('--float-start', 'left');
      root.style.setProperty('--float-end', 'right');
    }

    // Update chat message alignment for RTL
    this.updateChatMessageAlignment(isRTL);

    // Emit direction change event
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('language-direction-changed', { 
        language: this.currentLanguage, 
        isRTL 
      });
    }
  }

  /**
   * Update chat message alignment for RTL languages
   */
  updateChatMessageAlignment(isRTL) {
    const messageElements = document.querySelectorAll('.message');
    const inputElements = document.querySelectorAll('input[type="text"], textarea');
    
    messageElements.forEach(element => {
      if (isRTL) {
        element.style.textAlign = 'right';
        element.style.direction = 'rtl';
      } else {
        element.style.textAlign = 'left';
        element.style.direction = 'ltr';
      }
    });

    inputElements.forEach(element => {
      if (isRTL) {
        element.style.textAlign = 'right';
        element.style.direction = 'rtl';
      } else {
        element.style.textAlign = 'left';
        element.style.direction = 'ltr';
      }
    });
  }

  /**
   * Get if current language is right-to-left
   */
  isRTL(language = this.currentLanguage) {
    return this.rtlLanguages.has(language);
  }

  /**
   * Update all elements with translation keys
   */
  updateTranslatableElements() {
    const elements = document.querySelectorAll('[data-i18n]');
    
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const params = this.getElementParams(element);
      
      if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email' || element.type === 'password')) {
        element.placeholder = this.t(key, params);
      } else {
        element.textContent = this.t(key, params);
      }
    });

    // Update elements with translation attributes
    const attrElements = document.querySelectorAll('[data-i18n-attr]');
    attrElements.forEach(element => {
      const attrData = element.getAttribute('data-i18n-attr');
      try {
        const attrs = JSON.parse(attrData);
        for (const [attr, key] of Object.entries(attrs)) {
          const params = this.getElementParams(element);
          element.setAttribute(attr, this.t(key, params));
        }
      } catch (error) {
        console.warn('Invalid i18n attribute data:', attrData);
      }
    });
  }

  /**
   * Get translation parameters from element data attributes
   */
  getElementParams(element) {
    const params = {};
    const paramData = element.getAttribute('data-i18n-params');
    
    if (paramData) {
      try {
        Object.assign(params, JSON.parse(paramData));
      } catch (error) {
        console.warn('Invalid i18n params:', paramData);
      }
    }
    
    return params;
  }

  /**
   * Initialize auto-translation service
   */
  async initializeAutoTranslation() {
    try {
      // Check if browser supports the Web Translation API (experimental)
      if ('translation' in window && 'createTranslator' in window.translation) {
        this.translationService = 'web-api';
        console.log('Using Web Translation API for auto-translation');
      } else {
        // Fallback to external service integration
        this.translationService = 'external';
        console.log('Web Translation API not available, using external service');
      }
    } catch (error) {
      console.warn('Auto-translation initialization failed:', error);
      this.autoTranslationEnabled = false;
    }
  }

  /**
   * Auto-translate text content
   */
  async autoTranslate(text, targetLanguage = this.currentLanguage) {
    if (!this.autoTranslationEnabled || !text || text.trim() === '') {
      return text;
    }

    // Check cache first
    const cacheKey = `${text}_${targetLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey);
    }

    try {
      let translatedText = text;

      if (this.translationService === 'web-api') {
        translatedText = await this.translateWithWebAPI(text, targetLanguage);
      } else {
        translatedText = await this.translateWithExternalService(text, targetLanguage);
      }

      // Cache the translation
      this.translationCache.set(cacheKey, translatedText);
      
      return translatedText;
    } catch (error) {
      console.error('Auto-translation failed:', error);
      return text; // Return original text on failure
    }
  }

  /**
   * Translate using Web Translation API
   */
  async translateWithWebAPI(text, targetLanguage) {
    try {
      const translator = await window.translation.createTranslator({
        sourceLanguage: 'auto',
        targetLanguage: targetLanguage
      });

      const result = await translator.translate(text);
      return result;
    } catch (error) {
      throw new Error(`Web API translation failed: ${error.message}`);
    }
  }

  /**
   * Translate using external service (placeholder)
   */
  async translateWithExternalService(text, targetLanguage) {
    // This would integrate with services like Google Translate API, Azure Translator, etc.
    // For now, return the original text
    console.log(`External translation requested: "${text}" to ${targetLanguage}`);
    return text;
  }

  /**
   * Format date according to locale
   */
  formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    const formatOptions = { ...defaultOptions, ...options };
    
    try {
      return new Intl.DateTimeFormat(this.getFullLocale(), formatOptions).format(date);
    } catch (error) {
      console.warn('Date formatting failed, using fallback:', error);
      return date.toLocaleString(this.fallbackLanguage, formatOptions);
    }
  }

  /**
   * Format numbers according to locale
   */
  formatNumber(number, options = {}) {
    try {
      return new Intl.NumberFormat(this.getFullLocale(), options).format(number);
    } catch (error) {
      console.warn('Number formatting failed, using fallback:', error);
      return number.toLocaleString(this.fallbackLanguage, options);
    }
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount, currency = 'USD', options = {}) {
    const formatOptions = {
      style: 'currency',
      currency: currency,
      ...options
    };

    try {
      return new Intl.NumberFormat(this.getFullLocale(), formatOptions).format(amount);
    } catch (error) {
      console.warn('Currency formatting failed, using fallback:', error);
      return new Intl.NumberFormat(this.fallbackLanguage, formatOptions).format(amount);
    }
  }

  /**
   * Get full locale string (language-region)
   */
  getFullLocale() {
    const localeMap = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'he': 'he-IL'
    };

    return localeMap[this.currentLanguage] || `${this.currentLanguage}-${this.currentLanguage.toUpperCase()}`;
  }

  /**
   * Load RTL-specific CSS
   */
  loadRTLStyles() {
    if (!this.isRTL(this.currentLanguage)) return;

    const existingLink = document.querySelector('link[data-rtl-styles]');
    if (existingLink) return; // Already loaded

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/rtl.css';
    link.setAttribute('data-rtl-styles', 'true');
    
    document.head.appendChild(link);
  }

  /**
   * Unload RTL-specific CSS
   */
  unloadRTLStyles() {
    const existingLink = document.querySelector('link[data-rtl-styles]');
    if (existingLink) {
      existingLink.remove();
    }
  }

  /**
   * Get supported languages list
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'he', name: 'Hebrew', nativeName: 'עברית' }
    ];
  }

  /**
   * Add observer for language changes
   */
  observe(callback) {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  /**
   * Notify observers of changes
   */
  notifyObservers(event, data) {
    this.observers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.warn('Observer callback failed:', error);
      }
    });
  }

  /**
   * Enable/disable auto-translation
   */
  setAutoTranslation(enabled) {
    this.autoTranslationEnabled = enabled;
    localStorage.setItem('quickchat_auto_translation', enabled.toString());
    
    if (typeof window !== 'undefined' && window.eventBus) {
      window.eventBus.emit('auto-translation-changed', { enabled });
    }
  }

  /**
   * Create translation helper for Vue.js/React components
   */
  createTranslationHelper() {
    return {
      t: this.t.bind(this),
      changeLanguage: this.changeLanguage.bind(this),
      currentLanguage: this.currentLanguage,
      isRTL: this.isRTL.bind(this),
      formatNumber: this.formatNumber.bind(this),
      formatDate: this.formatDate.bind(this),
      formatRelativeTime: this.formatRelativeTime.bind(this)
    };
  }
}

// Create singleton instance
const i18nManager = new I18nManager();

// Global translation function for easy access
window.t = i18nManager.t.bind(i18nManager);

export default i18nManager;
