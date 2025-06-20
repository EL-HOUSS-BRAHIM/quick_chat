/**
 * Accessibility Manager Module
 * Comprehensive accessibility features for Quick Chat
 * Implementation of TODO: Accessibility Enhancements (High Priority)
 */

import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import errorHandler from '../../core/error-handler.js';

class AccessibilityManager {
  constructor() {
    this.config = {
      announceMessages: true,
      keyboardShortcuts: true,
      screenReaderSupport: true,
      highContrast: false,
      textToSpeech: false,
      speechToText: false,
      voiceCommands: false
    };

    this.shortcuts = new Map();
    this.speechSynthesis = null;
    this.speechRecognition = null;
    this.isListening = false;
    
    // Initialize state
    state.register('accessibility', {
      ...this.config,
      isInitialized: false
    });
  }

  /**
   * Initialize accessibility features
   */
  async init() {
    try {
      // Load saved preferences
      await this.loadPreferences();
      
      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts();
      
      // Initialize speech synthesis
      this.initSpeechSynthesis();
      
      // Initialize speech recognition
      this.initSpeechRecognition();
      
      // Set up ARIA live regions
      this.setupLiveRegions();
      
      // Enhanced focus management
      this.setupFocusManagement();
      
      // High contrast theme support
      this.setupHighContrastSupport();
      
      // Voice command support
      this.setupVoiceCommands();
      
      // Screen reader navigation
      this.setupScreenReaderNavigation();
      
      // Register event listeners
      this.registerEventListeners();
      
      state.update('accessibility', { isInitialized: true });
      
      console.log('Accessibility Manager initialized');
      return this;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize accessibility features');
    }
  }

  /**
   * Set up keyboard shortcuts (TODO: Add keyboard shortcuts documentation - 80% complete)
   */
  setupKeyboardShortcuts() {
    // Core navigation shortcuts
    this.registerShortcut('Alt+1', () => this.navigateTo('/dashboard.php'), 'Navigate to Dashboard');
    this.registerShortcut('Alt+2', () => this.navigateTo('/chat.php'), 'Navigate to Chats');
    this.registerShortcut('Alt+3', () => this.navigateTo('/profile.php'), 'Navigate to Profile');
    
    // Chat shortcuts
    this.registerShortcut('Ctrl+Enter', () => this.sendMessage(), 'Send Message');
    this.registerShortcut('Escape', () => this.closeChatModal(), 'Close Chat/Modal');
    this.registerShortcut('Ctrl+/', () => this.toggleShortcutsHelp(), 'Show Keyboard Shortcuts');
    
    // Accessibility shortcuts
    this.registerShortcut('Alt+Shift+S', () => this.toggleSpeech(), 'Toggle Text-to-Speech');
    this.registerShortcut('Alt+Shift+L', () => this.toggleListening(), 'Toggle Speech-to-Text');
    this.registerShortcut('Alt+Shift+H', () => this.toggleHighContrast(), 'Toggle High Contrast');
    
    // Message navigation
    this.registerShortcut('ArrowUp', () => this.navigateMessages('up'), 'Previous Message');
    this.registerShortcut('ArrowDown', () => this.navigateMessages('down'), 'Next Message');
    
    // Quick actions
    this.registerShortcut('Shift+F', () => this.focusSearch(), 'Focus Search');
    this.registerShortcut('Shift+N', () => this.startNewChat(), 'Start New Chat');
    
    // Set up global keyboard event listener
    document.addEventListener('keydown', this.handleKeydown.bind(this));
    
    console.log('Keyboard shortcuts initialized');
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(combination, action, description) {
    this.shortcuts.set(combination, { action, description });
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(event) {
    const combination = this.getKeyCombination(event);
    const shortcut = this.shortcuts.get(combination);
    
    if (shortcut && this.config.keyboardShortcuts) {
      event.preventDefault();
      shortcut.action();
      
      // Announce action to screen readers
      this.announceToScreenReader(`${shortcut.description} activated`);
    }
  }

  /**
   * Get key combination string from event
   */
  getKeyCombination(event) {
    let combination = '';
    
    if (event.ctrlKey) combination += 'Ctrl+';
    if (event.altKey) combination += 'Alt+';
    if (event.shiftKey) combination += 'Shift+';
    
    combination += event.key;
    
    return combination;
  }

  /**
   * Initialize text-to-speech (TODO: Add text-to-speech for messages - completed)
   */
  initSpeechSynthesis() {
    if ('speechSynthesis' in window) {
      this.speechSynthesis = window.speechSynthesis;
      console.log('Text-to-speech initialized');
    } else {
      console.warn('Text-to-speech not supported in this browser');
    }
  }

  /**
   * Initialize speech-to-text (TODO: Implement speech-to-text for message input - completed)
   */
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';
      
      this.speechRecognition.onresult = this.handleSpeechResult.bind(this);
      this.speechRecognition.onerror = this.handleSpeechError.bind(this);
      this.speechRecognition.onend = this.handleSpeechEnd.bind(this);
      
      console.log('Speech-to-text initialized');
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  /**
   * Set up ARIA live regions for screen reader announcements
   */
  setupLiveRegions() {
    // Create polite live region for non-urgent announcements
    const politeRegion = document.createElement('div');
    politeRegion.id = 'aria-live-polite';
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    politeRegion.className = 'sr-only';
    document.body.appendChild(politeRegion);
    
    // Create assertive live region for urgent announcements
    const assertiveRegion = document.createElement('div');
    assertiveRegion.id = 'aria-live-assertive';
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.className = 'sr-only';
    document.body.appendChild(assertiveRegion);
    
    console.log('ARIA live regions set up');
  }

  /**
   * Enhanced focus management
   */
  setupFocusManagement() {
    // Track focus for better navigation
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
    
    // Trap focus in modals
    document.addEventListener('keydown', this.handleModalFocusTrap.bind(this));
    
    console.log('Focus management initialized');
  }

  /**
   * Set up high contrast theme support (TODO: Add high contrast theme improvements - 60% complete)
   */
  setupHighContrastSupport() {
    // Detect system high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.config.highContrast = true;
      this.applyHighContrast();
    }
    
    // Listen for changes
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
      this.config.highContrast = e.matches;
      this.applyHighContrast();
    });
    
    console.log('High contrast support initialized');
  }

  /**
   * Set up voice commands (TODO: Add voice command support for navigation)
   */
  setupVoiceCommands() {
    this.voiceCommands = new Map([
      ['go to dashboard', () => this.navigateTo('/dashboard.php')],
      ['go to chat', () => this.navigateTo('/chat.php')],
      ['go to profile', () => this.navigateTo('/profile.php')],
      ['start new chat', () => this.startNewChat()],
      ['search', () => this.focusSearch()],
      ['send message', () => this.sendMessage()],
      ['toggle speech', () => this.toggleSpeech()],
      ['toggle high contrast', () => this.toggleHighContrast()]
    ]);
    
    console.log('Voice commands initialized');
  }

  /**
   * Set up screen reader navigation (TODO: Add screen reader navigation announcements - 70% complete)
   */
  setupScreenReaderNavigation() {
    // Add landmark roles
    this.addLandmarkRoles();
    
    // Add navigation announcements
    this.setupNavigationAnnouncements();
    
    // Add skip links
    this.addSkipLinks();
    
    console.log('Screen reader navigation initialized');
  }

  /**
   * Register event listeners
   */
  registerEventListeners() {
    // Listen for new messages to announce them
    eventBus.on('message:new', this.handleNewMessage.bind(this));
    
    // Listen for navigation changes
    eventBus.on('navigation:changed', this.handleNavigationChange.bind(this));
    
    // Listen for modal open/close
    eventBus.on('modal:opened', this.handleModalOpened.bind(this));
    eventBus.on('modal:closed', this.handleModalClosed.bind(this));
    
    console.log('Accessibility event listeners registered');
  }

  /**
   * Handle new message for announcement
   */
  handleNewMessage(messageData) {
    if (this.config.announceMessages && this.config.textToSpeech) {
      const announcement = `New message from ${messageData.sender}: ${messageData.content}`;
      this.speak(announcement);
    }
  }

  /**
   * Speak text using text-to-speech
   */
  speak(text, options = {}) {
    if (!this.speechSynthesis || !this.config.textToSpeech) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    
    this.speechSynthesis.speak(utterance);
  }

  /**
   * Toggle text-to-speech
   */
  toggleSpeech() {
    this.config.textToSpeech = !this.config.textToSpeech;
    state.update('accessibility', { textToSpeech: this.config.textToSpeech });
    
    const message = this.config.textToSpeech ? 'Text-to-speech enabled' : 'Text-to-speech disabled';
    this.announceToScreenReader(message);
    
    if (this.config.textToSpeech) {
      this.speak(message);
    }
  }

  /**
   * Toggle speech-to-text listening
   */
  toggleListening() {
    if (!this.speechRecognition) {
      this.announceToScreenReader('Speech recognition not supported');
      return;
    }
    
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  /**
   * Start speech recognition
   */
  startListening() {
    if (!this.speechRecognition) return;
    
    try {
      this.speechRecognition.start();
      this.isListening = true;
      this.announceToScreenReader('Listening for speech...');
      
      // Add visual indicator
      this.addListeningIndicator();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.announceToScreenReader('Failed to start speech recognition');
    }
  }

  /**
   * Stop speech recognition
   */
  stopListening() {
    if (!this.speechRecognition) return;
    
    this.speechRecognition.stop();
    this.isListening = false;
    this.announceToScreenReader('Stopped listening');
    
    // Remove visual indicator
    this.removeListeningIndicator();
  }

  /**
   * Handle speech recognition results
   */
  handleSpeechResult(event) {
    const results = event.results;
    let transcript = '';
    
    for (let i = 0; i < results.length; i++) {
      transcript += results[i][0].transcript;
    }
    
    // Check for voice commands
    const command = transcript.toLowerCase().trim();
    if (this.voiceCommands.has(command) && this.config.voiceCommands) {
      this.voiceCommands.get(command)();
      this.announceToScreenReader(`Command executed: ${command}`);
    } else {
      // Insert text into active input
      this.insertTextIntoActiveInput(transcript);
    }
  }

  /**
   * Toggle high contrast mode
   */
  toggleHighContrast() {
    this.config.highContrast = !this.config.highContrast;
    state.update('accessibility', { highContrast: this.config.highContrast });
    
    this.applyHighContrast();
    
    const message = this.config.highContrast ? 'High contrast enabled' : 'High contrast disabled';
    this.announceToScreenReader(message);
  }

  /**
   * Apply high contrast styling
   */
  applyHighContrast() {
    const body = document.body;
    
    if (this.config.highContrast) {
      body.classList.add('high-contrast');
    } else {
      body.classList.remove('high-contrast');
    }
  }

  /**
   * Announce message to screen readers
   */
  announceToScreenReader(message, priority = 'polite') {
    const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
    const region = document.getElementById(regionId);
    
    if (region) {
      region.textContent = message;
      
      // Clear after a short delay to allow for re-announcement
      setTimeout(() => {
        region.textContent = '';
      }, 1000);
    }
  }

  /**
   * Show keyboard shortcuts help
   */
  toggleShortcutsHelp() {
    const existingModal = document.getElementById('shortcuts-help-modal');
    
    if (existingModal) {
      existingModal.remove();
      return;
    }
    
    const modal = this.createShortcutsModal();
    document.body.appendChild(modal);
    
    // Focus the modal
    modal.focus();
    
    this.announceToScreenReader('Keyboard shortcuts help opened');
  }

  /**
   * Create shortcuts help modal
   */
  createShortcutsModal() {
    const modal = document.createElement('div');
    modal.id = 'shortcuts-help-modal';
    modal.className = 'modal accessibility-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'shortcuts-title');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', '-1');
    
    const shortcuts = Array.from(this.shortcuts.entries());
    const shortcutsList = shortcuts.map(([key, { description }]) => 
      `<li><kbd>${key}</kbd> - ${description}</li>`
    ).join('');
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <ul class="shortcuts-list">
            ${shortcutsList}
          </ul>
        </div>
      </div>
    `;
    
    // Add close functionality
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
      this.announceToScreenReader('Keyboard shortcuts help closed');
    });
    
    // Close on Escape
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        this.announceToScreenReader('Keyboard shortcuts help closed');
      }
    });
    
    return modal;
  }

  /**
   * Add landmark roles to page elements
   */
  addLandmarkRoles() {
    // Add roles to main content areas
    const header = document.querySelector('header');
    if (header && !header.getAttribute('role')) {
      header.setAttribute('role', 'banner');
    }
    
    const nav = document.querySelector('nav');
    if (nav && !nav.getAttribute('role')) {
      nav.setAttribute('role', 'navigation');
    }
    
    const main = document.querySelector('main');
    if (main && !main.getAttribute('role')) {
      main.setAttribute('role', 'main');
    }
    
    const footer = document.querySelector('footer');
    if (footer && !footer.getAttribute('role')) {
      footer.setAttribute('role', 'contentinfo');
    }
  }

  /**
   * Add skip links for keyboard navigation
   */
  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Skip to main content</a>
      <a href="#navigation" class="skip-link">Skip to navigation</a>
    `;
    
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Navigation helper functions
   */
  navigateTo(path) {
    window.location.href = path;
  }

  sendMessage() {
    const messageInput = document.querySelector('#messageInput, .message-input');
    if (messageInput) {
      const sendButton = document.querySelector('#sendMessage, .send-button');
      if (sendButton) {
        sendButton.click();
      }
    }
  }

  startNewChat() {
    const newChatButton = document.querySelector('#newChat, .new-chat-button');
    if (newChatButton) {
      newChatButton.click();
    }
  }

  focusSearch() {
    const searchInput = document.querySelector('#search, .search-input');
    if (searchInput) {
      searchInput.focus();
    }
  }

  /**
   * Load accessibility preferences from storage
   */
  async loadPreferences() {
    try {
      const saved = localStorage.getItem('accessibility-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.config = { ...this.config, ...preferences };
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    }
  }

  /**
   * Save accessibility preferences to storage
   */
  async savePreferences() {
    try {
      localStorage.setItem('accessibility-preferences', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }

  /**
   * Get current accessibility status
   */
  getStatus() {
    return {
      ...this.config,
      isListening: this.isListening,
      hasTextToSpeech: !!this.speechSynthesis,
      hasSpeechRecognition: !!this.speechRecognition
    };
  }

  // Additional helper methods for focus management, modal handling, etc.
  handleFocusIn(event) {
    // Track focus for navigation
    this.lastFocusedElement = event.target;
  }

  handleFocusOut(event) {
    // Clean up focus tracking
  }

  handleModalFocusTrap(event) {
    const modal = document.querySelector('.modal[aria-modal="true"]');
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.key === 'Tab') {
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  handleModalOpened(modalData) {
    this.announceToScreenReader(`${modalData.title || 'Dialog'} opened`);
  }

  handleModalClosed(modalData) {
    this.announceToScreenReader(`${modalData.title || 'Dialog'} closed`);
  }

  handleNavigationChange(navData) {
    this.announceToScreenReader(`Navigated to ${navData.title || navData.path}`);
  }

  addListeningIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'speech-listening-indicator';
    indicator.className = 'speech-indicator';
    indicator.innerHTML = '🎤 Listening...';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(indicator);
  }

  removeListeningIndicator() {
    const indicator = document.getElementById('speech-listening-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  insertTextIntoActiveInput(text) {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const value = activeElement.value;
      
      activeElement.value = value.substring(0, start) + text + value.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
      
      // Trigger input event
      activeElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  handleSpeechError(event) {
    console.error('Speech recognition error:', event.error);
    this.isListening = false;
    this.removeListeningIndicator();
    this.announceToScreenReader('Speech recognition error occurred');
  }

  handleSpeechEnd() {
    this.isListening = false;
    this.removeListeningIndicator();
  }

  navigateMessages(direction) {
    const messages = document.querySelectorAll('.message');
    const currentIndex = Array.from(messages).findIndex(msg => msg.classList.contains('focused'));
    
    let newIndex;
    if (direction === 'up') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : messages.length - 1;
    } else {
      newIndex = currentIndex < messages.length - 1 ? currentIndex + 1 : 0;
    }
    
    // Remove previous focus
    messages.forEach(msg => msg.classList.remove('focused'));
    
    // Add focus to new message
    if (messages[newIndex]) {
      messages[newIndex].classList.add('focused');
      messages[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Announce message content
      const content = messages[newIndex].textContent;
      this.announceToScreenReader(`Message: ${content}`);
    }
  }

  closeChatModal() {
    const modal = document.querySelector('.modal, .chat-modal');
    if (modal) {
      const closeButton = modal.querySelector('.close, .modal-close');
      if (closeButton) {
        closeButton.click();
      }
    }
  }

  setupNavigationAnnouncements() {
    // Add navigation landmarks
    const navItems = document.querySelectorAll('nav a, .nav-link');
    navItems.forEach(item => {
      if (!item.getAttribute('aria-label')) {
        const text = item.textContent.trim();
        if (text) {
          item.setAttribute('aria-label', `Navigate to ${text}`);
        }
      }
    });
  }
}

// Create and export singleton instance
const accessibilityManager = new AccessibilityManager();

export default accessibilityManager;

// For backwards compatibility
if (typeof window !== 'undefined') {
  window.accessibilityManager = accessibilityManager;
}
