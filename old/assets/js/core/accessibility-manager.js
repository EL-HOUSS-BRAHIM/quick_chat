/**
 * Accessibility Manager - Handles keyboard navigation and ARIA attributes
 * Part of Phase 2 enhancement for accessibility improvements
 * Progress: 70% complete (keyboard navigation) + 60% complete (ARIA)
 */

class AccessibilityManager {
  constructor() {
    this.focusableElements = [];
    this.currentFocusIndex = -1;
    this.keyboardNavigationEnabled = true;
    this.screenReaderEnabled = false;
    this.initialized = false;
    
    // Text-to-Speech features (NEW - from TODO)
    this.speech = null;
    this.textToSpeechEnabled = false;
    
    // Speech-to-Text features (NEW - from TODO)
    this.recognition = null;
    this.speechToTextEnabled = false;
    this.isListening = false;
    
    // Detect screen reader
    this.detectScreenReader();
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocusIn = this.handleFocusIn.bind(this);
    this.handleFocusOut = this.handleFocusOut.bind(this);
  }

  /**
   * Initialize accessibility features
   */
  init() {
    if (this.initialized) return;
    
    console.log('Initializing Accessibility Manager');
    
    // Setup keyboard navigation
    this.setupKeyboardNavigation();
    
    // Setup ARIA attributes
    this.setupAriaAttributes();
    
    // Setup focus management
    this.setupFocusManagement();
    
    // Setup screen reader announcements
    this.setupScreenReaderSupport();
    
    // Setup high contrast mode detection
    this.setupHighContrastMode();
    
    // Initialize text-to-speech (NEW - from TODO)
    this.initTextToSpeech();
    
    // Initialize speech-to-text (NEW - from TODO)
    this.initSpeechToText();
    
    // Setup message reading events
    this.setupMessageReading();
    
    this.initialized = true;
    
    // Dispatch initialization event
    document.dispatchEvent(new CustomEvent('quickchat:accessibility:initialized'));
  }

  /**
   * Setup keyboard navigation for all interactive elements
   */
  setupKeyboardNavigation() {
    // Add keyboard event listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('focusout', this.handleFocusOut);
    
    // Update focusable elements list
    this.updateFocusableElements();
    
    // Setup tab navigation enhancement
    this.setupTabNavigation();
    
    // Setup arrow key navigation for chat messages
    this.setupArrowKeyNavigation();
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(event) {
    if (!this.keyboardNavigationEnabled) return;
    
    switch (event.key) {
    case 'Tab':
      this.handleTabNavigation(event);
      break;
    case 'ArrowUp':
    case 'ArrowDown':
      this.handleArrowNavigation(event);
      break;
    case 'Escape':
      this.handleEscapeKey(event);
      break;
    case 'Enter':
    case ' ':
      this.handleActivation(event);
      break;
    case 'F6':
      this.handleF6Navigation(event);
      break;
    }
  }

  /**
   * Setup ARIA attributes for better screen reader support
   */
  setupAriaAttributes() {
    // Chat container
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.setAttribute('role', 'main');
      chatContainer.setAttribute('aria-label', 'Chat messages');
    }
    
    // Message input
    const messageInput = document.querySelector('#message-input');
    if (messageInput) {
      messageInput.setAttribute('aria-label', 'Type your message');
      messageInput.setAttribute('aria-describedby', 'message-help');
    }
    
    // Chat messages
    this.setupMessageAriaAttributes();
    
    // Navigation elements
    this.setupNavigationAriaAttributes();
    
    // Form elements
    this.setupFormAriaAttributes();
    
    // Modal dialogs
    this.setupModalAriaAttributes();
  }

  /**
   * Setup message ARIA attributes
   */
  setupMessageAriaAttributes() {
    const messages = document.querySelectorAll('.message');
    messages.forEach((message, index) => {
      message.setAttribute('role', 'article');
      message.setAttribute('aria-label', `Message ${index + 1}`);
      
      const author = message.querySelector('.message-author');
      if (author) {
        author.setAttribute('aria-label', `From ${author.textContent}`);
      }
      
      const time = message.querySelector('.message-time');
      if (time) {
        time.setAttribute('aria-label', `Sent at ${time.textContent}`);
      }
      
      const content = message.querySelector('.message-content');
      if (content) {
        content.setAttribute('role', 'text');
      }
    });
  }

  /**
   * Setup navigation ARIA attributes
   */
  setupNavigationAriaAttributes() {
    const nav = document.querySelector('nav');
    if (nav) {
      nav.setAttribute('role', 'navigation');
      nav.setAttribute('aria-label', 'Main navigation');
    }
    
    // Breadcrumbs
    const breadcrumbs = document.querySelector('.breadcrumbs');
    if (breadcrumbs) {
      breadcrumbs.setAttribute('role', 'navigation');
      breadcrumbs.setAttribute('aria-label', 'Breadcrumb');
    }
    
    // Menu buttons
    const menuButtons = document.querySelectorAll('.menu-button');
    menuButtons.forEach(button => {
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Detect if screen reader is active
   */
  detectScreenReader() {
    // Check for common screen reader indicators
    this.screenReaderEnabled = (
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      navigator.userAgent.includes('WindowEyes') ||
      navigator.userAgent.includes('VoiceOver') ||
      window.speechSynthesis !== undefined
    );
    
    // Enhanced detection using media queries
    if (window.matchMedia) {
      const screenReaderQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.screenReaderEnabled = this.screenReaderEnabled || screenReaderQuery.matches;
    }
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    // Create live region for announcements
    this.createLiveRegion();
    
    // Setup automatic announcements
    this.setupAutoAnnouncements();
    
    // Setup manual announcement methods
    this.setupAnnouncementMethods();
  }

  /**
   * Create ARIA live region for screen reader announcements
   */
  createLiveRegion() {
    const liveRegion = document.createElement('div');
    liveRegion.id = 'screen-reader-announcements';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(liveRegion);
    this.liveRegion = liveRegion;
  }

  /**
   * Announce message to screen reader
   */
  announce(message, priority = 'polite') {
    if (!this.liveRegion) return;
    
    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      this.liveRegion.textContent = '';
    }, 1000);
  }

  /**
   * Setup automatic announcements for chat events
   */
  setupAutoAnnouncements() {
    // New message announcements
    document.addEventListener('quickchat:message:received', (event) => {
      const message = event.detail;
      this.announce(`New message from ${message.author}: ${message.content}`);
    });
    
    // User join/leave announcements
    document.addEventListener('quickchat:user:joined', (event) => {
      this.announce(`${event.detail.username} joined the chat`);
    });
    
    document.addEventListener('quickchat:user:left', (event) => {
      this.announce(`${event.detail.username} left the chat`);
    });
    
    // Error announcements
    document.addEventListener('quickchat:error', (event) => {
      this.announce(`Error: ${event.detail.message}`, 'assertive');
    });
  }

  /**
   * Update list of focusable elements
   */
  updateFocusableElements() {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];
    
    this.focusableElements = Array.from(
      document.querySelectorAll(focusableSelectors.join(', '))
    ).filter(el => {
      return el.offsetWidth > 0 && el.offsetHeight > 0 && 
             getComputedStyle(el).visibility !== 'hidden';
    });
  }

  /**
   * Setup high contrast mode detection
   */
  setupHighContrastMode() {
    if (window.matchMedia) {
      const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
      
      const handleHighContrast = (e) => {
        document.body.classList.toggle('high-contrast', e.matches);
        this.announce('High contrast mode ' + (e.matches ? 'enabled' : 'disabled'));
      };
      
      highContrastQuery.addListener(handleHighContrast);
      handleHighContrast(highContrastQuery);
    }
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Add focus-visible polyfill behavior
    this.setupFocusVisible();
    
    // Setup focus trap management for modals
    this.setupFocusTraps();
    
    // Setup roving tabindex for complex widgets
    this.setupRovingTabindex();
  }

  /**
   * Setup focus-visible polyfill for better focus indicators
   */
  setupFocusVisible() {
    let hadKeyboardEvent = true;
    let keyboardThrottleTimeout = 0;

    const pointerEvents = ['mousedown', 'pointerdown', 'touchstart'];
    const keyboardEvents = ['keydown', 'keyup'];

    // Helper to detect keyboard usage
    const onPointerDown = () => {
      hadKeyboardEvent = false;
    };

    const onKeyDown = (e) => {
      if (e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      hadKeyboardEvent = true;
    };

    // Add event listeners
    pointerEvents.forEach(event => {
      document.addEventListener(event, onPointerDown, true);
    });

    keyboardEvents.forEach(event => {
      document.addEventListener(event, onKeyDown, true);
    });

    // Apply focus-visible class
    document.addEventListener('focus', (e) => {
      if (hadKeyboardEvent || e.target.matches(':focus-visible')) {
        e.target.classList.add('focus-visible');
      }
    }, true);

    document.addEventListener('blur', (e) => {
      e.target.classList.remove('focus-visible');
    }, true);
  }

  /**
   * Setup focus traps for modal dialogs
   */
  setupFocusTraps() {
    // Listen for modal open events
    document.addEventListener('quickchat:modal:opened', (event) => {
      this.trapFocus(event.detail.modal);
    });

    document.addEventListener('quickchat:modal:closed', (event) => {
      this.releaseFocus(event.detail.modal);
    });
  }

  /**
   * Trap focus within an element
   */
  trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Store original focus for restoration
    element.dataset.previousFocus = document.activeElement;

    const trapHandler = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', trapHandler);
    element.dataset.trapHandler = trapHandler;

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Release focus trap
   */
  releaseFocus(element) {
    const trapHandler = element.dataset.trapHandler;
    if (trapHandler) {
      element.removeEventListener('keydown', trapHandler);
      delete element.dataset.trapHandler;
    }

    // Restore previous focus
    const previousFocus = element.dataset.previousFocus;
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
    delete element.dataset.previousFocus;
  }

  /**
   * Setup roving tabindex for complex widgets
   */
  setupRovingTabindex() {
    // Setup for toolbar widgets
    const toolbars = document.querySelectorAll('[role="toolbar"]');
    toolbars.forEach(toolbar => {
      this.setupToolbarNavigation(toolbar);
    });

    // Setup for menu widgets
    const menus = document.querySelectorAll('[role="menu"]');
    menus.forEach(menu => {
      this.setupMenuNavigation(menu);
    });
  }

  /**
   * Setup toolbar navigation with roving tabindex
   */
  setupToolbarNavigation(toolbar) {
    const items = toolbar.querySelectorAll('[role="button"], button');
    let currentIndex = 0;

    // Set initial tabindex
    items.forEach((item, index) => {
      item.tabIndex = index === 0 ? 0 : -1;
    });

    toolbar.addEventListener('keydown', (e) => {
      let newIndex = currentIndex;

      switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        newIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        newIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = items.length - 1;
        break;
      default:
        return;
      }

      // Update tabindex and focus
      items[currentIndex].tabIndex = -1;
      items[newIndex].tabIndex = 0;
      items[newIndex].focus();
      currentIndex = newIndex;
    });
  }

  /**
   * Setup menu navigation
   */
  setupMenuNavigation(menu) {
    const items = menu.querySelectorAll('[role="menuitem"]');
    let currentIndex = -1;

    menu.addEventListener('keydown', (e) => {
      switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, items.length - 1);
        items[currentIndex].focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        items[currentIndex].focus();
        break;
      case 'Home':
        e.preventDefault();
        currentIndex = 0;
        items[currentIndex].focus();
        break;
      case 'End':
        e.preventDefault();
        currentIndex = items.length - 1;
        items[currentIndex].focus();
        break;
      case 'Escape':
        e.preventDefault();
        // Close menu and return focus to trigger
        const trigger = document.querySelector(`[aria-controls="${menu.id}"]`);
        if (trigger) {
          trigger.focus();
          trigger.setAttribute('aria-expanded', 'false');
        }
        break;
      }
    });
  }

  /**
   * Handle tab navigation
   */
  handleTabNavigation(event) {
    // Let default tab behavior work, but enhance it
    this.updateFocusableElements();
  }

  /**
   * Handle arrow key navigation
   */
  handleArrowNavigation(event) {
    // Only handle arrow keys in chat message area
    if (!event.target.closest('.chat-messages')) return;
    
    event.preventDefault();
    
    const messages = document.querySelectorAll('.message');
    let currentIndex = -1;
    
    // Find currently focused message
    messages.forEach((message, index) => {
      if (message.contains(document.activeElement)) {
        currentIndex = index;
      }
    });
    
    // Navigate to next/previous message
    if (event.key === 'ArrowDown' && currentIndex < messages.length - 1) {
      messages[currentIndex + 1].focus();
    } else if (event.key === 'ArrowUp' && currentIndex > 0) {
      messages[currentIndex - 1].focus();
    }
  }

  /**
   * Handle escape key
   */
  handleEscapeKey(event) {
    // Close modals, dropdowns, etc.
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
      const closeButton = openModal.querySelector('.close');
      if (closeButton) closeButton.click();
    }
    
    // Close dropdown menus
    const openDropdown = document.querySelector('.dropdown.show');
    if (openDropdown) {
      openDropdown.classList.remove('show');
    }
  }

  /**
   * Handle enter/space activation
   */
  handleActivation(event) {
    const target = event.target;
    
    // Handle custom interactive elements
    if (target.hasAttribute('role') && 
        (target.getAttribute('role') === 'button' || 
         target.getAttribute('role') === 'menuitem')) {
      event.preventDefault();
      target.click();
    }
  }

  /**
   * Handle F6 navigation (area switching)
   */
  handleF6Navigation(event) {
    event.preventDefault();
    
    const areas = [
      '.sidebar',
      '.chat-container',
      '.message-input-container',
      '.user-list'
    ];
    
    let currentArea = -1;
    areas.forEach((selector, index) => {
      const area = document.querySelector(selector);
      if (area && area.contains(document.activeElement)) {
        currentArea = index;
      }
    });
    
    // Move to next area
    const nextArea = (currentArea + 1) % areas.length;
    const nextElement = document.querySelector(areas[nextArea]);
    if (nextElement) {
      const firstFocusable = nextElement.querySelector(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        nextElement.focus();
      }
    }
  }

  /**
   * Setup remaining methods for completeness
   */
  setupTabNavigation() {
    // Enhanced tab navigation logic
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        this.updateFocusableElements();
      }
    });
  }

  setupArrowKeyNavigation() {
    // Already implemented in handleArrowNavigation
  }

  handleFocusIn(event) {
    // Add focus styling if needed
    event.target.classList.add('keyboard-focused');
  }

  handleFocusOut(event) {
    // Remove focus styling
    event.target.classList.remove('keyboard-focused');
  }

  setupFormAriaAttributes() {
    // Add ARIA attributes to form elements
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const label = form.querySelector(`label[for="${input.id}"]`);
        if (label && !input.getAttribute('aria-label')) {
          input.setAttribute('aria-labelledby', label.id || `label_${input.id}`);
        }
      });
    });
  }

  setupModalAriaAttributes() {
    // Setup modal accessibility
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      
      const title = modal.querySelector('.modal-title');
      if (title) {
        modal.setAttribute('aria-labelledby', title.id || 'modal-title');
      }
    });
  }

  setupAnnouncementMethods() {
    // Additional methods for manual announcements
    window.quickChatAnnounce = (message, priority = 'polite') => {
      this.announce(message, priority);
    };
  }

  /**
   * Public methods for external use
   */
  enableKeyboardNavigation() {
    this.keyboardNavigationEnabled = true;
  }

  disableKeyboardNavigation() {
    this.keyboardNavigationEnabled = false;
  }

  isScreenReaderActive() {
    return this.screenReaderEnabled;
  }

  /**
   * Initialize text-to-speech functionality
   * Addresses TODO: Add text-to-speech for messages
   */
  initTextToSpeech() {
    if ('speechSynthesis' in window) {
      this.speech = window.speechSynthesis;
      this.textToSpeechEnabled = true;
      
      // Get available voices
      this.updateVoices();
      
      // Update voices when they change
      if (this.speech.onvoiceschanged !== undefined) {
        this.speech.onvoiceschanged = () => this.updateVoices();
      }
      
      console.log('Text-to-speech initialized');
    } else {
      console.warn('Text-to-speech not supported in this browser');
    }
  }

  /**
   * Initialize speech-to-text functionality
   * Addresses TODO: Implement speech-to-text for message input
   */
  initSpeechToText() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.recognition.onstart = () => {
        this.isListening = true;
        this.announce('Voice input started', 'assertive');
        document.dispatchEvent(new CustomEvent('quickchat:speech-recognition-start'));
      };
      
      this.recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        if (result.isFinal) {
          const text = result[0].transcript;
          document.dispatchEvent(new CustomEvent('quickchat:speech-recognized', {
            detail: { text, confidence: result[0].confidence }
          }));
        }
      };
      
      this.recognition.onend = () => {
        this.isListening = false;
        this.announce('Voice input ended', 'polite');
        document.dispatchEvent(new CustomEvent('quickchat:speech-recognition-end'));
      };
      
      this.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        this.announce('Voice input error', 'assertive');
      };
      
      this.speechToTextEnabled = true;
      console.log('Speech-to-text initialized');
    } else {
      console.warn('Speech-to-text not supported in this browser');
    }
  }

  /**
   * Update available voices for text-to-speech
   */
  updateVoices() {
    if (this.speech) {
      const voices = this.speech.getVoices();
      this.availableVoices = voices;
    }
  }

  /**
   * Speak text aloud
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   */
  speak(text, options = {}) {
    if (!this.speech || !this.textToSpeechEnabled) return;
    
    // Cancel any ongoing speech
    this.speech.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1; 
    utterance.volume = options.volume || 0.8;
    
    // Set voice if specified
    if (options.voice && this.availableVoices) {
      const selectedVoice = this.availableVoices.find(voice => voice.name === options.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    this.speech.speak(utterance);
  }

  /**
   * Start speech recognition for message input
   */
  startListening() {
    if (this.recognition && !this.isListening && this.speechToTextEnabled) {
      this.recognition.start();
    }
  }

  /**
   * Stop speech recognition
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Setup message reading events
   * Automatically read new messages aloud
   */
  setupMessageReading() {
    // Listen for new chat messages
    document.addEventListener('quickchat:message-received', (event) => {
      if (this.textToSpeechEnabled && event.detail) {
        const { username, message } = event.detail;
        this.speak(`New message from ${username}: ${message}`);
      }
    });
    
    // Listen for speech recognition results and insert into input
    document.addEventListener('quickchat:speech-recognized', (event) => {
      if (event.detail && event.detail.text) {
        const messageInput = document.querySelector('#messageInput, .message-input, [data-message-input]');
        if (messageInput) {
          messageInput.value = event.detail.text;
          messageInput.dispatchEvent(new Event('input', { bubbles: true }));
          messageInput.focus();
        }
      }
    });
  }

  /**
   * Toggle text-to-speech on/off
   */
  toggleTextToSpeech() {
    this.textToSpeechEnabled = !this.textToSpeechEnabled;
    this.announce(
      `Text to speech ${this.textToSpeechEnabled ? 'enabled' : 'disabled'}`, 
      'assertive'
    );
    
    // Save preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('quickchat_tts_enabled', this.textToSpeechEnabled);
    }
    
    return this.textToSpeechEnabled;
  }

  /**
   * Toggle speech-to-text on/off
   */
  toggleSpeechToText() {
    this.speechToTextEnabled = !this.speechToTextEnabled;
    this.announce(
      `Speech to text ${this.speechToTextEnabled ? 'enabled' : 'disabled'}`,
      'assertive'
    );
    
    // Save preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('quickchat_stt_enabled', this.speechToTextEnabled);
    }
    
    return this.speechToTextEnabled;
  }

  /**
   * Load saved accessibility preferences
   */
  loadPreferences() {
    if (typeof localStorage !== 'undefined') {
      const ttsEnabled = localStorage.getItem('quickchat_tts_enabled');
      const sttEnabled = localStorage.getItem('quickchat_stt_enabled');
      
      if (ttsEnabled !== null) {
        this.textToSpeechEnabled = ttsEnabled === 'true';
      }
      
      if (sttEnabled !== null) {
        this.speechToTextEnabled = sttEnabled === 'true';
      }
    }
  }

  /**
   * Cleanup method
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('focusin', this.handleFocusIn);
    document.removeEventListener('focusout', this.handleFocusOut);
    
    if (this.liveRegion) {
      this.liveRegion.remove();
    }
    
    this.initialized = false;
  }
}

export default new AccessibilityManager();
