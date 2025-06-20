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
