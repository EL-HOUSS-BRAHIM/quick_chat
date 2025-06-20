/**
 * Internationalization Manager Service
 * 
 * Manages multi-language support and text localization
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class I18nManager {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    this.currentLanguage = 'en';
    this.fallbackLanguage = 'en';
    this.translations = {};
    this.loadedLanguages = new Set();
    this.rtlLanguages = new Set(['ar', 'he', 'fa', 'ur']);
    this.pluralRules = {};
  }

  /**
   * Initialize the i18n manager
   */
  async init(options = {}) {
    if (this.initialized) return;

    try {
      // Set configuration
      this.currentLanguage = options.language || this.detectLanguage();
      this.fallbackLanguage = options.fallbackLanguage || 'en';
      
      // Load initial language
      await this.loadLanguage(this.currentLanguage);
      
      // Apply language to document
      this.applyLanguage();
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      logger.debug('I18n manager initialized with language:', this.currentLanguage);
    } catch (error) {
      logger.error('Failed to initialize i18n manager:', error);
    }
  }

  /**
   * Detect user's preferred language
   */
  detectLanguage() {
    // Check stored preference
    const storedLang = localStorage.getItem('quickchat_language');
    if (storedLang) {
      return storedLang;
    }

    // Check browser language
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang) {
      // Extract language code (e.g., 'en-US' -> 'en')
      return browserLang.split('-')[0];
    }

    return 'en';
  }

  /**
   * Load language translations
   */
  async loadLanguage(language) {
    if (this.loadedLanguages.has(language)) {
      return this.translations[language];
    }

    try {
      // Try to load from assets
      const response = await fetch(`/assets/i18n/${language}.json`);
      
      if (response.ok) {
        const translations = await response.json();
        this.translations[language] = translations;
        this.loadedLanguages.add(language);
        
        logger.debug(`Loaded translations for language: ${language}`);
        return translations;
      } else {
        throw new Error(`Failed to load language: ${language}`);
      }
    } catch (error) {
      logger.warn(`Failed to load language ${language}, using fallback:`, error);
      
      // Load fallback if not the same as requested language
      if (language !== this.fallbackLanguage && !this.loadedLanguages.has(this.fallbackLanguage)) {
        return this.loadLanguage(this.fallbackLanguage);
      }
      
      // Return empty translations if fallback also fails
      this.translations[language] = this.getDefaultTranslations();
      this.loadedLanguages.add(language);
      return this.translations[language];
    }
  }

  /**
   * Get default English translations
   */
  getDefaultTranslations() {
    return {
      // Common UI elements
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
        settings: 'Settings',
        help: 'Help',
        logout: 'Logout',
        login: 'Login',
        register: 'Register'
      },
      
      // Chat specific
      chat: {
        typeMessage: 'Type a message...',
        sendMessage: 'Send message',
        online: 'Online',
        offline: 'Offline',
        typing: 'typing...',
        newMessage: 'New message',
        messageDeleted: 'Message deleted',
        messageEdited: 'Message edited',
        uploadFile: 'Upload file',
        emojiPicker: 'Choose emoji',
        groupInfo: 'Group info',
        memberList: 'Member list',
        leaveGroup: 'Leave group',
        joinGroup: 'Join group'
      },
      
      // Navigation
      nav: {
        dashboard: 'Dashboard',
        chat: 'Chat',
        profile: 'Profile',
        admin: 'Admin',
        groups: 'Groups',
        users: 'Users'
      },
      
      // Time and dates
      time: {
        now: 'now',
        minuteAgo: 'a minute ago',
        minutesAgo: '{count} minutes ago',
        hourAgo: 'an hour ago',
        hoursAgo: '{count} hours ago',
        dayAgo: 'a day ago',
        daysAgo: '{count} days ago',
        weekAgo: 'a week ago',
        weeksAgo: '{count} weeks ago',
        monthAgo: 'a month ago',
        monthsAgo: '{count} months ago',
        yearAgo: 'a year ago',
        yearsAgo: '{count} years ago'
      },
      
      // Errors and messages
      errors: {
        networkError: 'Network error. Please check your connection.',
        serverError: 'Server error. Please try again later.',
        notFound: 'Not found',
        accessDenied: 'Access denied',
        sessionExpired: 'Session expired. Please login again.',
        invalidInput: 'Invalid input',
        fileTooLarge: 'File is too large',
        unsupportedFile: 'Unsupported file type'
      },
      
      // Success messages
      success: {
        messageSent: 'Message sent',
        fileUploaded: 'File uploaded',
        profileUpdated: 'Profile updated',
        settingsSaved: 'Settings saved',
        groupCreated: 'Group created',
        groupJoined: 'Joined group',
        groupLeft: 'Left group'
      }
    };
  }

  /**
   * Translate a key with optional interpolation
   */
  translate(key, params = {}) {
    const translation = this.getTranslation(key);
    return this.interpolate(translation, params);
  }

  /**
   * Alias for translate (shorter syntax)
   */
  t(key, params = {}) {
    return this.translate(key, params);
  }

  /**
   * Get translation by key
   */
  getTranslation(key) {
    const translations = this.translations[this.currentLanguage] || {};
    const fallbackTranslations = this.translations[this.fallbackLanguage] || {};
    
    // Support nested keys like 'common.loading'
    const keys = key.split('.');
    let value = translations;
    let fallbackValue = fallbackTranslations;
    
    for (const k of keys) {
      value = value?.[k];
      fallbackValue = fallbackValue?.[k];
    }
    
    // Return translation, fallback, or key itself
    return value || fallbackValue || key;
  }

  /**
   * Interpolate variables in translation
   */
  interpolate(translation, params) {
    if (typeof translation !== 'string' || !params) {
      return translation;
    }
    
    return translation.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Handle pluralization
   */
  plural(key, count, params = {}) {
    const baseKey = count === 1 ? key : `${key}_plural`;
    return this.translate(baseKey, { count, ...params });
  }

  /**
   * Change current language
   */
  async changeLanguage(language) {
    if (language === this.currentLanguage) {
      return;
    }

    try {
      // Load the new language
      await this.loadLanguage(language);
      
      // Update current language
      const previousLanguage = this.currentLanguage;
      this.currentLanguage = language;
      
      // Store preference
      localStorage.setItem('quickchat_language', language);
      
      // Apply language changes
      this.applyLanguage();
      
      // Emit language change event
      this.eventBus.emit('i18n:languageChanged', {
        from: previousLanguage,
        to: language
      });
      
      logger.debug(`Language changed from ${previousLanguage} to ${language}`);
    } catch (error) {
      logger.error('Failed to change language:', error);
      throw error;
    }
  }

  /**
   * Apply language settings to document
   */
  applyLanguage() {
    // Set document language
    document.documentElement.lang = this.currentLanguage;
    
    // Set text direction for RTL languages
    const isRTL = this.rtlLanguages.has(this.currentLanguage);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', isRTL);
    
    // Update all elements with data-i18n attributes
    this.updateDOMTranslations();
  }

  /**
   * Update DOM elements with translations
   */
  updateDOMTranslations() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.translate(key);
      
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translation;
      } else {
        element.textContent = translation;
      }
    });
    
    // Update elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.translate(key);
    });
    
    // Update elements with data-i18n-aria-label attribute
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria-label');
      element.setAttribute('aria-label', this.translate(key));
    });
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
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
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }
    ];
  }

  /**
   * Get current language info
   */
  getCurrentLanguage() {
    const available = this.getAvailableLanguages();
    return available.find(lang => lang.code === this.currentLanguage) || 
           { code: this.currentLanguage, name: this.currentLanguage, nativeName: this.currentLanguage };
  }

  /**
   * Check if language is RTL
   */
  isRTL(language = this.currentLanguage) {
    return this.rtlLanguages.has(language);
  }

  /**
   * Format number according to locale
   */
  formatNumber(number, options = {}) {
    try {
      return new Intl.NumberFormat(this.currentLanguage, options).format(number);
    } catch (error) {
      return number.toString();
    }
  }

  /**
   * Format date according to locale
   */
  formatDate(date, options = {}) {
    try {
      return new Intl.DateTimeFormat(this.currentLanguage, options).format(new Date(date));
    } catch (error) {
      return new Date(date).toLocaleDateString();
    }
  }

  /**
   * Format time according to locale
   */
  formatTime(date, options = {}) {
    try {
      return new Intl.DateTimeFormat(this.currentLanguage, {
        hour: '2-digit',
        minute: '2-digit',
        ...options
      }).format(new Date(date));
    } catch (error) {
      return new Date(date).toLocaleTimeString();
    }
  }

  /**
   * Get relative time string
   */
  getRelativeTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diffInSeconds = Math.floor((now - target) / 1000);
    
    if (diffInSeconds < 60) {
      return this.translate('time.now');
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return minutes === 1 ? 
        this.translate('time.minuteAgo') : 
        this.translate('time.minutesAgo', { count: minutes });
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1 ? 
        this.translate('time.hourAgo') : 
        this.translate('time.hoursAgo', { count: hours });
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      if (days === 1) {
        return this.translate('time.dayAgo');
      } else if (days < 7) {
        return this.translate('time.daysAgo', { count: days });
      } else if (days < 30) {
        const weeks = Math.floor(days / 7);
        return weeks === 1 ? 
          this.translate('time.weekAgo') : 
          this.translate('time.weeksAgo', { count: weeks });
      } else if (days < 365) {
        const months = Math.floor(days / 30);
        return months === 1 ? 
          this.translate('time.monthAgo') : 
          this.translate('time.monthsAgo', { count: months });
      } else {
        const years = Math.floor(days / 365);
        return years === 1 ? 
          this.translate('time.yearAgo') : 
          this.translate('time.yearsAgo', { count: years });
      }
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus.on('i18n:changeLanguage', (language) => {
      this.changeLanguage(language);
    });
    
    this.eventBus.on('i18n:updateDOM', () => {
      this.updateDOMTranslations();
    });
  }

  /**
   * Add translations for a language
   */
  addTranslations(language, translations) {
    if (!this.translations[language]) {
      this.translations[language] = {};
    }
    
    // Deep merge translations
    this.translations[language] = this.deepMerge(this.translations[language], translations);
    this.loadedLanguages.add(language);
    
    // Update DOM if this is the current language
    if (language === this.currentLanguage) {
      this.updateDOMTranslations();
    }
  }

  /**
   * Deep merge objects
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
   * Destroy the i18n manager
   */
  destroy() {
    this.translations = {};
    this.loadedLanguages.clear();
    this.initialized = false;
  }

  /**
   * Auto-translation service integration
   */
  async enableAutoTranslation(config = {}) {
    this.autoTranslation = {
      enabled: true,
      service: config.service || 'browser', // 'browser', 'google', 'deepl'
      apiKey: config.apiKey,
      cache: new Map(),
      maxCacheSize: config.maxCacheSize || 1000,
      supportedLanguages: config.supportedLanguages || [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'
      ],
      ...config
    };

    logger.debug('Auto-translation enabled with service:', this.autoTranslation.service);
  }

  /**
   * Translate text using configured service
   */
  async translateText(text, targetLanguage, sourceLanguage = 'auto') {
    if (!this.autoTranslation?.enabled) {
      return text;
    }

    const cacheKey = `${sourceLanguage}:${targetLanguage}:${text}`;
    
    // Check cache first
    if (this.autoTranslation.cache.has(cacheKey)) {
      return this.autoTranslation.cache.get(cacheKey);
    }

    try {
      let translatedText = text;

      switch (this.autoTranslation.service) {
        case 'browser':
          translatedText = await this.translateWithBrowser(text, targetLanguage, sourceLanguage);
          break;
        case 'google':
          translatedText = await this.translateWithGoogle(text, targetLanguage, sourceLanguage);
          break;
        case 'deepl':
          translatedText = await this.translateWithDeepL(text, targetLanguage, sourceLanguage);
          break;
        default:
          logger.warn('Unknown translation service:', this.autoTranslation.service);
          return text;
      }

      // Cache the result
      this.cacheTranslation(cacheKey, translatedText);
      
      return translatedText;
    } catch (error) {
      logger.error('Translation failed:', error);
      return text; // Return original text on error
    }
  }

  /**
   * Translate using browser's built-in translation API
   */
  async translateWithBrowser(text, targetLanguage, sourceLanguage) {
    if (!('translation' in window) || !window.translation) {
      throw new Error('Browser translation API not available');
    }

    try {
      const translator = await window.translation.createTranslator({
        sourceLanguage,
        targetLanguage
      });

      const result = await translator.translate(text);
      return result;
    } catch (error) {
      logger.error('Browser translation error:', error);
      throw error;
    }
  }

  /**
   * Translate using Google Translate API
   */
  async translateWithGoogle(text, targetLanguage, sourceLanguage) {
    if (!this.autoTranslation.apiKey) {
      throw new Error('Google Translate API key not configured');
    }

    const url = 'https://translation.googleapis.com/language/translate/v2';
    const params = new URLSearchParams({
      key: this.autoTranslation.apiKey,
      q: text,
      target: targetLanguage,
      format: 'text'
    });

    if (sourceLanguage !== 'auto') {
      params.append('source', sourceLanguage);
    }

    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  }

  /**
   * Translate using DeepL API
   */
  async translateWithDeepL(text, targetLanguage, sourceLanguage) {
    if (!this.autoTranslation.apiKey) {
      throw new Error('DeepL API key not configured');
    }

    const url = 'https://api-free.deepl.com/v2/translate';
    const params = new URLSearchParams({
      auth_key: this.autoTranslation.apiKey,
      text: text,
      target_lang: targetLanguage.toUpperCase()
    });

    if (sourceLanguage !== 'auto') {
      params.append('source_lang', sourceLanguage.toUpperCase());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  }

  /**
   * Cache translation result
   */
  cacheTranslation(key, value) {
    if (this.autoTranslation.cache.size >= this.autoTranslation.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.autoTranslation.cache.keys().next().value;
      this.autoTranslation.cache.delete(firstKey);
    }
    
    this.autoTranslation.cache.set(key, value);
  }

  /**
   * Auto-translate message content
   */
  async autoTranslateMessage(message, targetLanguage = this.currentLanguage) {
    if (!this.autoTranslation?.enabled || !message.content) {
      return message;
    }

    try {
      const translatedContent = await this.translateText(
        message.content, 
        targetLanguage,
        message.language || 'auto'
      );

      return {
        ...message,
        content: translatedContent,
        originalContent: message.content,
        translatedFrom: message.language || 'auto',
        translatedTo: targetLanguage,
        isTranslated: true
      };
    } catch (error) {
      logger.error('Auto-translation failed for message:', error);
      return message;
    }
  }

  /**
   * Enhanced RTL support with dynamic text detection
   */
  detectTextDirection(text) {
    // Simple RTL character detection
    const rtlChars = /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/;
    const ltrChars = /[A-Za-z]/;

    const rtlCount = (text.match(rtlChars) || []).length;
    const ltrCount = (text.match(ltrChars) || []).length;

    if (rtlCount > ltrCount) {
      return 'rtl';
    } else if (ltrCount > rtlCount) {
      return 'ltr';
    }

    // Default to current language direction
    return this.isRTL() ? 'rtl' : 'ltr';
  }

  /**
   * Apply text direction to specific element
   */
  applyTextDirection(element, text) {
    if (!element || !text) return;

    const direction = this.detectTextDirection(text);
    element.dir = direction;
    element.classList.toggle('rtl-content', direction === 'rtl');
    element.classList.toggle('ltr-content', direction === 'ltr');
  }

  /**
   * Enhanced language detection
   */
  async detectLanguage(text) {
    if (!text || text.length < 10) {
      return this.currentLanguage;
    }

    try {
      // Use browser language detection if available
      if ('detectLanguage' in navigator && navigator.detectLanguage) {
        const detected = await navigator.detectLanguage(text);
        if (detected && detected.confidence > 0.7) {
          return detected.language;
        }
      }

      // Fallback to simple character-based detection
      return this.detectLanguageByCharacters(text);
    } catch (error) {
      logger.error('Language detection failed:', error);
      return this.currentLanguage;
    }
  }

  /**
   * Simple character-based language detection
   */
  detectLanguageByCharacters(text) {
    const patterns = {
      'ar': /[\u0600-\u06FF]/,
      'he': /[\u0590-\u05FF]/,
      'ru': /[\u0400-\u04FF]/,
      'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
      'ko': /[\uAC00-\uD7AF]/,
      'zh': /[\u4E00-\u9FFF]/,
      'th': /[\u0E00-\u0E7F]/,
      'hi': /[\u0900-\u097F]/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    return 'en'; // Default to English
  }

  /**
   * Real-time translation for chat messages
   */
  setupRealTimeTranslation() {
    if (!this.autoTranslation?.enabled) return;

    // Listen for new messages
    this.eventBus.on('message:received', async (message) => {
      if (message.language && message.language !== this.currentLanguage) {
        const translatedMessage = await this.autoTranslateMessage(message);
        this.eventBus.emit('message:translated', translatedMessage);
      }
    });

    // Listen for language changes
    this.eventBus.on('language:changed', (newLanguage) => {
      // Re-translate visible messages if needed
      this.eventBus.emit('messages:retranslate', newLanguage);
    });
  }

  /**
   * Get translation statistics
   */
  getTranslationStats() {
    if (!this.autoTranslation) {
      return { enabled: false };
    }

    return {
      enabled: this.autoTranslation.enabled,
      service: this.autoTranslation.service,
      cacheSize: this.autoTranslation.cache.size,
      maxCacheSize: this.autoTranslation.maxCacheSize,
      supportedLanguages: this.autoTranslation.supportedLanguages.length
    };
  }
}

// Create singleton instance
export const i18nManager = new I18nManager();
export default i18nManager;
