/**
 * Accessibility Manager Service
 * 
 * Manages accessibility features and ARIA attributes for better screen reader support
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class AccessibilityManager {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    this.focusVisible = false;
    this.reducedMotion = false;
    this.highContrast = false;
    this.announcements = [];
    this.focusStack = [];
  }

  /**
   * Initialize accessibility manager
   */
  init() {
    if (this.initialized) return;

    try {
      this.detectPreferences();
      this.setupKeyboardNavigation();
      this.setupScreenReaderSupport();
      this.setupEventListeners();
      this.createLiveRegions();
      
      this.initialized = true;
      logger.debug('Accessibility manager initialized');
    } catch (error) {
      logger.error('Failed to initialize accessibility manager:', error);
    }
  }

  /**
   * Detect user accessibility preferences
   */
  detectPreferences() {
    // Detect reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.reducedMotion = true;
      document.body.classList.add('reduced-motion');
      logger.debug('Reduced motion preference detected');
    }

    // Detect high contrast preference
    if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
      this.highContrast = true;
      document.body.classList.add('high-contrast');
      logger.debug('High contrast preference detected');
    }

    // Listen for preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        document.body.classList.toggle('reduced-motion', e.matches);
        this.eventBus.emit('accessibility:reducedMotion', e.matches);
      });

      window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
        this.highContrast = e.matches;
        document.body.classList.toggle('high-contrast', e.matches);
        this.eventBus.emit('accessibility:highContrast', e.matches);
      });
    }
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    // Track focus visibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.focusVisible = true;
        document.body.classList.add('focus-visible');
      }
    });

    document.addEventListener('mousedown', () => {
      this.focusVisible = false;
      document.body.classList.remove('focus-visible');
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleGlobalKeyboard(e);
    });
  }

  /**
   * Handle global keyboard shortcuts
   */
  handleGlobalKeyboard(event) {
    // Skip in input elements
    if (event.target.matches('input, textarea, select, [contenteditable]')) {
      return;
    }

    const { key, ctrlKey, altKey, shiftKey } = event;

    // Alt + M: Open main menu
    if (altKey && key === 'm') {
      event.preventDefault();
      this.eventBus.emit('navigation:showMenu');
      this.announce('Main menu opened');
    }

    // Alt + C: Focus chat input
    if (altKey && key === 'c') {
      event.preventDefault();
      const chatInput = document.querySelector('.message-input input, .message-input textarea');
      if (chatInput) {
        chatInput.focus();
        this.announce('Chat input focused');
      }
    }

    // Alt + S: Focus search
    if (altKey && key === 's') {
      event.preventDefault();
      const searchInput = document.querySelector('.search-input, [role="search"] input');
      if (searchInput) {
        searchInput.focus();
        this.announce('Search focused');
      }
    }

    // Escape: Close modal/dropdown
    if (key === 'Escape') {
      this.eventBus.emit('accessibility:escape');
    }
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    // Ensure all interactive elements have proper roles
    this.ensureProperRoles();

    // Setup focus management
    this.setupFocusManagement();

    // Monitor dynamic content
    this.monitorDynamicContent();
  }

  /**
   * Ensure interactive elements have proper ARIA roles
   */
  ensureProperRoles() {
    // Add button role to clickable elements without it
    document.querySelectorAll('[onclick], .btn, .clickable').forEach(element => {
      if (!element.getAttribute('role') && element.tagName !== 'BUTTON') {
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
      }
    });

    // Add proper roles to lists
    document.querySelectorAll('.user-list, .group-list, .message-list').forEach(list => {
      if (!list.getAttribute('role')) {
        list.setAttribute('role', 'list');
      }
    });

    // Add navigation landmarks
    document.querySelectorAll('.sidebar, .nav').forEach(nav => {
      if (!nav.getAttribute('role')) {
        nav.setAttribute('role', 'navigation');
      }
    });
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Track focus for modal management
    this.eventBus.on('modal:show', () => {
      this.pushFocus();
    });

    this.eventBus.on('modal:hide', () => {
      this.popFocus();
    });

    // Trap focus in modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const modal = document.querySelector('.modal:not(.hiding)');
        if (modal) {
          this.trapFocus(e, modal);
        }
      }
    });
  }

  /**
   * Trap focus within an element
   */
  trapFocus(event, container) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Push current focus to stack
   */
  pushFocus() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body) {
      this.focusStack.push(activeElement);
    }
  }

  /**
   * Pop focus from stack and restore
   */
  popFocus() {
    const previousFocus = this.focusStack.pop();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      // Delay to ensure modal is fully hidden
      setTimeout(() => {
        previousFocus.focus();
      }, 100);
    }
  }

  /**
   * Monitor dynamic content changes
   */
  monitorDynamicContent() {
    // Listen for new messages
    this.eventBus.on('message:received', (message) => {
      this.announce(`New message from ${message.username}: ${message.content}`);
    });

    // Listen for user status changes
    this.eventBus.on('user:statusChanged', (data) => {
      this.announce(`${data.username} is now ${data.status}`);
    });

    // Listen for notifications
    this.eventBus.on('notification:show', (notification) => {
      if (notification.type === 'error') {
        this.announceError(notification.message);
      } else {
        this.announce(notification.message);
      }
    });
  }

  /**
   * Create live regions for announcements
   */
  createLiveRegions() {
    // Polite announcements
    if (!document.getElementById('aria-live-polite')) {
      const politeRegion = document.createElement('div');
      politeRegion.id = 'aria-live-polite';
      politeRegion.setAttribute('aria-live', 'polite');
      politeRegion.setAttribute('aria-atomic', 'true');
      politeRegion.className = 'sr-only';
      document.body.appendChild(politeRegion);
    }

    // Assertive announcements
    if (!document.getElementById('aria-live-assertive')) {
      const assertiveRegion = document.createElement('div');
      assertiveRegion.id = 'aria-live-assertive';
      assertiveRegion.setAttribute('aria-live', 'assertive');
      assertiveRegion.setAttribute('aria-atomic', 'true');
      assertiveRegion.className = 'sr-only';
      document.body.appendChild(assertiveRegion);
    }
  }

  /**
   * Announce message to screen readers
   */
  announce(message, priority = 'polite') {
    const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
    const region = document.getElementById(regionId);
    
    if (region) {
      // Clear previous announcement
      region.textContent = '';
      
      // Add new announcement after a brief delay
      setTimeout(() => {
        region.textContent = message;
        
        // Add to announcements history
        this.announcements.unshift({
          message,
          priority,
          timestamp: new Date().toISOString()
        });
        
        // Keep only recent announcements
        if (this.announcements.length > 20) {
          this.announcements = this.announcements.slice(0, 20);
        }
      }, 100);
    }

    logger.debug('Accessibility announcement:', message);
  }

  /**
   * Announce error with assertive priority
   */
  announceError(message) {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Set element as landmark
   */
  setLandmark(element, role, label) {
    element.setAttribute('role', role);
    if (label) {
      element.setAttribute('aria-label', label);
    }
  }

  /**
   * Set element description
   */
  setDescription(element, description) {
    const descId = `desc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const descElement = document.createElement('div');
    descElement.id = descId;
    descElement.className = 'sr-only';
    descElement.textContent = description;
    
    element.parentNode.insertBefore(descElement, element.nextSibling);
    element.setAttribute('aria-describedby', descId);
  }

  /**
   * Update element state for screen readers
   */
  updateElementState(element, state) {
    Object.entries(state).forEach(([key, value]) => {
      element.setAttribute(`aria-${key}`, value);
    });
  }

  /**
   * Mark region as live
   */
  makeLiveRegion(element, priority = 'polite') {
    element.setAttribute('aria-live', priority);
    element.setAttribute('aria-atomic', 'true');
  }

  /**
   * Skip to main content
   */
  skipToMain() {
    const main = document.querySelector('main, [role="main"], .main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
      this.announce('Skipped to main content');
    }
  }

  /**
   * Get accessibility preferences
   */
  getPreferences() {
    return {
      reducedMotion: this.reducedMotion,
      highContrast: this.highContrast,
      focusVisible: this.focusVisible
    };
  }

  /**
   * Get recent announcements
   */
  getRecentAnnouncements() {
    return [...this.announcements];
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus.on('accessibility:announce', (data) => {
      this.announce(data.message, data.priority);
    });

    this.eventBus.on('accessibility:focus', (element) => {
      if (element && typeof element.focus === 'function') {
        element.focus();
      }
    });

    this.eventBus.on('accessibility:skipToMain', () => {
      this.skipToMain();
    });
  }

  /**
   * Destroy accessibility manager
   */
  destroy() {
    // Remove live regions
    const politeRegion = document.getElementById('aria-live-polite');
    const assertiveRegion = document.getElementById('aria-live-assertive');
    
    if (politeRegion) politeRegion.remove();
    if (assertiveRegion) assertiveRegion.remove();
    
    // Clear focus stack
    this.focusStack = [];
    this.announcements = [];
    
    this.initialized = false;
  }
}

// Create singleton instance
export const accessibilityManager = new AccessibilityManager();
export default accessibilityManager;
