/**
 * Internationalization Manager
 * Handles multi-language support and localization
 * Implementation of TODO: Internationalization features
 */

import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import errorHandler from '../../core/error-handler.js';

class I18nManager {
  constructor() {
    this.currentLanguage = 'en';
    this.defaultLanguage = 'en';
    this.translations = new Map();
    this.loadedLanguages = new Set();
    this.pluralRules = new Map();
    this.dateTimeFormats = new Map();
    this.numberFormats = new Map();
    
    // Supported languages and their configurations
    this.supportedLanguages = new Map([
      ['en', { 
        name: 'English', 
        nativeName: 'English', 
        rtl: false,
        pluralRule: 'english',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: 'h:mm a'
      }],
      ['es', { 
        name: 'Spanish', 
        nativeName: 'Español', 
        rtl: false,
        pluralRule: 'spanish',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm'
      }],
      ['fr', { 
        name: 'French', 
        nativeName: 'Français', 
        rtl: false,
        pluralRule: 'french',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'HH:mm'
      }],
      ['de', { 
        name: 'German', 
        nativeName: 'Deutsch', 
        rtl: false,
        pluralRule: 'german',
        dateFormat: 'dd.MM.yyyy',
        timeFormat: 'HH:mm'
      }],
      ['ar', { 
        name: 'Arabic', 
        nativeName: 'العربية', 
        rtl: true,
        pluralRule: 'arabic',
        dateFormat: 'dd/MM/yyyy',
        timeFormat: 'h:mm a'
      }],
      ['zh', { 
        name: 'Chinese', 
        nativeName: '中文', 
        rtl: false,
        pluralRule: 'chinese',
        dateFormat: 'yyyy/MM/dd',
        timeFormat: 'HH:mm'
      }],
      ['ja', { 
        name: 'Japanese', 
        nativeName: '日本語', 
        rtl: false,
        pluralRule: 'japanese',
        dateFormat: 'yyyy/MM/dd',
        timeFormat: 'HH:mm'
      }],
      ['ru', { 
        name: 'Russian', 
        nativeName: 'Русский', 
        rtl: false,
        pluralRule: 'russian',
        dateFormat: 'dd.MM.yyyy',
        timeFormat: 'HH:mm'
      }]
    ]);
    
    // Initialize state
    state.register('i18n', {
      currentLanguage: this.currentLanguage,
      isRTL: false,
      isInitialized: false,
      loadedLanguages: [],
      autoTranslateEnabled: false
    });
  }

  /**
   * Initialize i18n manager
   */
  async init() {
    try {
      // Detect user language preference
      await this.detectLanguage();
      
      // Load default language
      await this.loadLanguage(this.defaultLanguage);
      
      // Load user's preferred language if different
      if (this.currentLanguage !== this.defaultLanguage) {
        await this.loadLanguage(this.currentLanguage);
      }
      
      // Set up HTML lang attribute and direction
      this.updateDocumentLanguage();
      
      // Set up RTL support (TODO: Add support for right-to-left languages - 40% complete)
      this.setupRTLSupport();
      
      // Initialize auto-translation feature
      this.setupAutoTranslation();
      
      // Set up locale-specific formatting
      this.setupLocaleFormatting();
      
      // Register event listeners
      this.registerEventListeners();
      
      // Update state
      state.update('i18n', {
        isInitialized: true,
        loadedLanguages: Array.from(this.loadedLanguages),
        isRTL: this.isRTL()
      });
      
      console.log(`I18n initialized with language: ${this.currentLanguage}`);
      return this;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize i18n');
    }
  }

  /**
   * Detect user's preferred language
   */
  async detectLanguage() {
    // Check localStorage first
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && this.supportedLanguages.has(savedLanguage)) {
      this.currentLanguage = savedLanguage;
      return;
    }
    
    // Check user's browser languages
    const browserLanguages = navigator.languages || [navigator.language];
    
    for (const lang of browserLanguages) {
      // Check exact match first
      if (this.supportedLanguages.has(lang)) {
        this.currentLanguage = lang;
        return;
      }
      
      // Check language prefix (e.g., 'en-US' -> 'en')
      const langPrefix = lang.split('-')[0];
      if (this.supportedLanguages.has(langPrefix)) {
        this.currentLanguage = langPrefix;
        return;
      }
    }
    
    // Fall back to default language
    this.currentLanguage = this.defaultLanguage;
  }

  /**
   * Load translations for a specific language
   */
  async loadLanguage(languageCode) {
    if (this.loadedLanguages.has(languageCode)) {
      return; // Already loaded
    }
    
    try {
      // Load translation file
      const response = await fetch(`/assets/i18n/${languageCode}.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${languageCode}`);
      }
      
      const translations = await response.json();
      this.translations.set(languageCode, translations);
      this.loadedLanguages.add(languageCode);
      
      console.log(`Loaded translations for ${languageCode}`);
    } catch (error) {
      console.warn(`Failed to load translations for ${languageCode}:`, error);
      
      // If loading current language fails, fall back to default
      if (languageCode === this.currentLanguage && languageCode !== this.defaultLanguage) {
        this.currentLanguage = this.defaultLanguage;
      }
    }
  }

  /**
   * Get translated text
   */
  t(key, params = {}, languageCode = null) {
    const lang = languageCode || this.currentLanguage;
    const translations = this.translations.get(lang) || this.translations.get(this.defaultLanguage);
    
    if (!translations) {
      console.warn('No translations loaded');
      return key;
    }
    
    // Support nested keys like 'chat.messages.sent'
    const keys = key.split('.');
    let value = translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found, return the key itself
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    // If we have a string, process parameters
    if (typeof value === 'string') {
      return this.processParameters(value, params);
    }
    
    // Handle pluralization
    if (typeof value === 'object' && 'one' in value) {
      return this.handlePluralization(value, params);
    }
    
    return key;
  }

  /**
   * Process parameters in translation strings
   */
  processParameters(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      return params[paramName] !== undefined ? params[paramName] : match;
    });
  }

  /**
   * Handle pluralization rules
   */
  handlePluralization(pluralObject, params) {
    const count = params.count || 0;
    const langConfig = this.supportedLanguages.get(this.currentLanguage);
    const pluralRule = langConfig?.pluralRule || 'english';
    
    let key;
    switch (pluralRule) {
      case 'english':
        key = count === 1 ? 'one' : 'other';
        break;
      case 'russian':
        // Complex Russian plural rules
        if (count % 10 === 1 && count % 100 !== 11) {
          key = 'one';
        } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
          key = 'few';
        } else {
          key = 'many';
        }
        break;
      case 'arabic':
        // Arabic plural rules
        if (count === 0) key = 'zero';
        else if (count === 1) key = 'one';
        else if (count === 2) key = 'two';
        else if (count >= 3 && count <= 10) key = 'few';
        else if (count >= 11 && count <= 99) key = 'many';
        else key = 'other';
        break;
      default:
        key = count === 1 ? 'one' : 'other';
    }
    
    const text = pluralObject[key] || pluralObject.other || pluralObject.one;
    return this.processParameters(text, { ...params, count });
  }

  /**
   * Change language
   */
  async changeLanguage(languageCode) {
    if (!this.supportedLanguages.has(languageCode)) {
      throw new Error(`Unsupported language: ${languageCode}`);
    }
    
    // Load language if not already loaded
    await this.loadLanguage(languageCode);
    
    const previousLanguage = this.currentLanguage;
    this.currentLanguage = languageCode;
    
    // Update document language and direction
    this.updateDocumentLanguage();
    
    // Save preference
    localStorage.setItem('preferred-language', languageCode);
    
    // Update state
    state.update('i18n', {
      currentLanguage: languageCode,
      isRTL: this.isRTL()
    });
    
    // Emit language change event
    eventBus.emit('i18n:languageChanged', {
      previousLanguage,
      currentLanguage: languageCode,
      isRTL: this.isRTL()
    });
    
    // Re-translate existing content
    this.retranslateContent();
    
    console.log(`Language changed to ${languageCode}`);
  }

  /**
   * Update document language settings
   */
  updateDocumentLanguage() {
    const html = document.documentElement;
    html.lang = this.currentLanguage;
    
    // Set direction for RTL languages
    if (this.isRTL()) {
      html.dir = 'rtl';
      document.body.classList.add('rtl');
    } else {
      html.dir = 'ltr';
      document.body.classList.remove('rtl');
    }
  }

  /**
   * Check if current language is RTL
   */
  isRTL() {
    const langConfig = this.supportedLanguages.get(this.currentLanguage);
    return langConfig?.rtl || false;
  }

  /**
   * Set up RTL support (TODO: Add support for right-to-left languages - 40% complete)
   */
  setupRTLSupport() {
    // Add CSS classes for RTL support
    const style = document.createElement('style');
    style.textContent = `
      .rtl {
        direction: rtl;
      }
      
      .rtl .chat-message {
        text-align: right;
      }
      
      .rtl .chat-input {
        text-align: right;
      }
      
      .rtl .modal {
        text-align: right;
      }
      
      .rtl .nav-links {
        flex-direction: row-reverse;
      }
      
      .rtl .dropdown-menu {
        left: auto;
        right: 0;
      }
      
      /* Additional RTL styles can be added here */
    `;
    document.head.appendChild(style);
  }

  /**
   * Set up auto-translation feature (TODO: Add auto-translation feature for messages)
   */
  setupAutoTranslation() {
    // This would integrate with a translation service like Google Translate API
    // For now, we'll set up the infrastructure
    
    this.autoTranslateEnabled = false;
    
    // Check if translation service is available
    if (window.google && window.google.translate) {
      this.autoTranslateEnabled = true;
      console.log('Auto-translation service available');
    }
  }

  /**
   * Set up locale-specific formatting (TODO: Implement locale-specific date/time formatting)
   */
  setupLocaleFormatting() {
    const langConfig = this.supportedLanguages.get(this.currentLanguage);
    
    if (langConfig) {
      // Set up date/time formatting
      this.dateTimeFormats.set(this.currentLanguage, {
        date: new Intl.DateTimeFormat(this.currentLanguage, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        time: new Intl.DateTimeFormat(this.currentLanguage, {
          hour: '2-digit',
          minute: '2-digit'
        }),
        dateTime: new Intl.DateTimeFormat(this.currentLanguage, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      });
      
      // Set up number formatting
      this.numberFormats.set(this.currentLanguage, {
        decimal: new Intl.NumberFormat(this.currentLanguage),
        currency: new Intl.NumberFormat(this.currentLanguage, {
          style: 'currency',
          currency: 'USD' // This should be configurable
        }),
        percent: new Intl.NumberFormat(this.currentLanguage, {
          style: 'percent'
        })
      });
    }
  }

  /**
   * Format date according to current locale
   */
  formatDate(date, format = 'date') {
    const formatter = this.dateTimeFormats.get(this.currentLanguage)?.[format];
    if (formatter && date) {
      return formatter.format(new Date(date));
    }
    return date;
  }

  /**
   * Format number according to current locale
   */
  formatNumber(number, format = 'decimal') {
    const formatter = this.numberFormats.get(this.currentLanguage)?.[format];
    if (formatter && number !== undefined) {
      return formatter.format(number);
    }
    return number;
  }

  /**
   * Auto-translate text
   */
  async autoTranslate(text, targetLanguage = null) {
    if (!this.autoTranslateEnabled) {
      return text;
    }
    
    const target = targetLanguage || this.currentLanguage;
    
    try {
      // This would call a translation service
      // For now, return the original text
      console.log(`Auto-translating to ${target}: ${text}`);
      return text;
    } catch (error) {
      console.error('Auto-translation failed:', error);
      return text;
    }
  }

  /**
   * Register event listeners
   */
  registerEventListeners() {
    // Listen for language preference changes
    eventBus.on('user:preferencesChanged', this.handleUserPreferencesChange.bind(this));
    
    // Listen for message events for auto-translation
    eventBus.on('message:received', this.handleMessageReceived.bind(this));
  }

  /**
   * Handle user preferences change
   */
  handleUserPreferencesChange(preferences) {
    if (preferences.language && preferences.language !== this.currentLanguage) {
      this.changeLanguage(preferences.language);
    }
  }

  /**
   * Handle received message for auto-translation
   */
  async handleMessageReceived(messageData) {
    if (this.autoTranslateEnabled && messageData.language && messageData.language !== this.currentLanguage) {
      const translatedText = await this.autoTranslate(messageData.content, this.currentLanguage);
      
      if (translatedText !== messageData.content) {
        eventBus.emit('message:translated', {
          ...messageData,
          originalContent: messageData.content,
          translatedContent: translatedText,
          targetLanguage: this.currentLanguage
        });
      }
    }
  }

  /**
   * Re-translate existing content when language changes
   */
  retranslateContent() {
    // Find all elements with data-i18n attribute
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    
    elementsToTranslate.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const params = element.getAttribute('data-i18n-params');
      
      let parsedParams = {};
      if (params) {
        try {
          parsedParams = JSON.parse(params);
        } catch (error) {
          console.warn('Invalid i18n params:', params);
        }
      }
      
      const translatedText = this.t(key, parsedParams);
      
      // Update text content or attribute based on element type
      if (element.tagName === 'INPUT' && element.type === 'text') {
        element.placeholder = translatedText;
      } else if (element.hasAttribute('title')) {
        element.title = translatedText;
      } else {
        element.textContent = translatedText;
      }
    });
    
    // Emit event for components to re-render
    eventBus.emit('i18n:contentRetranslated');
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages() {
    return Array.from(this.supportedLanguages.entries()).map(([code, config]) => ({
      code,
      ...config
    }));
  }

  /**
   * Get current language info
   */
  getCurrentLanguageInfo() {
    return {
      code: this.currentLanguage,
      ...this.supportedLanguages.get(this.currentLanguage)
    };
  }

  /**
   * Check if language is loaded
   */
  isLanguageLoaded(languageCode) {
    return this.loadedLanguages.has(languageCode);
  }

  /**
   * Create language selector UI
   */
  createLanguageSelector() {
    const selector = document.createElement('select');
    selector.id = 'language-selector';
    selector.className = 'language-selector';
    selector.setAttribute('aria-label', this.t('ui.selectLanguage'));
    
    this.getSupportedLanguages().forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = `${lang.nativeName} (${lang.name})`;
      option.selected = lang.code === this.currentLanguage;
      selector.appendChild(option);
    });
    
    selector.addEventListener('change', (e) => {
      this.changeLanguage(e.target.value);
    });
    
    return selector;
  }

  /**
   * Extract translatable strings from the page (development helper)
   */
  extractTranslatableStrings() {
    const strings = new Set();
    
    // Find text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.textContent.trim();
          if (text && text.length > 1 && !text.match(/^\d+$/)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      strings.add(node.textContent.trim());
    }
    
    // Find placeholder and title attributes
    const elementsWithText = document.querySelectorAll('[placeholder], [title]');
    elementsWithText.forEach(element => {
      if (element.placeholder) strings.add(element.placeholder);
      if (element.title) strings.add(element.title);
    });
    
    return Array.from(strings);
  }
}

// Create and export singleton instance
const i18nManager = new I18nManager();

export default i18nManager;

// For backwards compatibility
if (typeof window !== 'undefined') {
  window.i18nManager = i18nManager;
}

// Helper function for templates
export function t(key, params = {}) {
  return i18nManager.t(key, params);
}
