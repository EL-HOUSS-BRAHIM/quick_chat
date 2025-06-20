/**
 * Accessibility enhancements for Quick Chat
 * Version: 3.0.0 - Enhanced with keyboard shortcuts and navigation announcements
 * 
 * This module provides accessibility features for the chat application including:
 * - Screen reader announcements
 * - Focus management
 * - Keyboard navigation with shortcuts
 * - ARIA attributes management
 * - High contrast mode support
 * - Text-to-speech integration
 * - Speech-to-text support
 * - Navigation announcements
 */

class AccessibilityManager {
    constructor() {
        // Initialization state
        this.initialized = false;
        
        // Preferences
        this.preferences = {
            highContrast: false,
            largeText: false,
            reduceMotion: false,
            announceMessages: true,
            textToSpeech: false,
            speechToText: false,
            keyboardShortcuts: true,
            navigationAnnouncements: true,
            magnification: 1.0
        };
        
        // DOM elements
        this.elements = {
            liveRegion: null,
            focusTrap: null,
            shortcutsModal: null
        };

        // Keyboard shortcuts registry
        this.shortcuts = new Map();
        this.activeShortcuts = new Set();
        
        // Text-to-speech support
        this.speechSynthesis = null;
        this.speechRecognition = null;
        
        // Navigation state
        this.navigationHistory = [];
        this.currentFocus = null;
        
        // Bind methods to maintain context
        this.announce = this.announce.bind(this);
        this.trapFocus = this.trapFocus.bind(this);
        this.handlePreferenceChange = this.handlePreferenceChange.bind(this);
        this.handleKeyboardShortcut = this.handleKeyboardShortcut.bind(this);
        this.announceNavigation = this.announceNavigation.bind(this);
    }
    
    /**
     * Initialize accessibility features
     */
    init() {
        if (this.initialized) return;
        
        console.log('Initializing enhanced accessibility features...');
        
        // Create live region for screen reader announcements
        this.createLiveRegion();
        
        // Load user preferences
        this.loadPreferences();

        // Initialize keyboard shortcuts
        this.initializeKeyboardShortcuts();
        
        // Initialize text-to-speech
        this.initializeTextToSpeech();
        
        // Initialize speech recognition
        this.initializeSpeechRecognition();
        
        // Initialize navigation announcements
        this.initializeNavigationAnnouncements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Apply initial preferences
        this.applyPreferences();
        
        // Check for prefers-reduced-motion
        this.checkReducedMotionPreference();
        
        this.initialized = true;
    }
    
    /**
     * Create live region for screen reader announcements
     */
    createLiveRegion() {
        // Check if already exists
        let liveRegion = document.getElementById('a11y-live-region');
        
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'a11y-live-region';
            liveRegion.className = 'sr-only';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(liveRegion);
        }
        
        this.elements.liveRegion = liveRegion;
    }
    
    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     * @param {string} priority - Announcement priority (polite, assertive)
     */
    announce(message, priority = 'polite') {
        if (!this.elements.liveRegion || !this.preferences.announceMessages) return;
        
        // Update aria-live priority if needed
        this.elements.liveRegion.setAttribute('aria-live', priority);
        
        // Clear previous message first
        this.elements.liveRegion.textContent = '';
        
        // Set new message after a small delay (helps some screen readers)
        setTimeout(() => {
            this.elements.liveRegion.textContent = message;
        }, 50);
    }
    
    /**
     * Create a focus trap for modal dialogs
     * @param {HTMLElement} container - Container to trap focus within
     * @returns {Function} Function to remove the focus trap
     */
    trapFocus(container) {
        if (!container) return () => {};
        
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return () => {};
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Focus the first element
        firstElement.focus();
        
        // Handle tabbing
        const handleKeyDown = (e) => {
            if (e.key !== 'Tab') return;
            
            // Shift+Tab on first element => move to last element
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } 
            // Tab on last element => move to first element
            else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        };
        
        container.addEventListener('keydown', handleKeyDown);
        
        // Return cleanup function
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for preference changes
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('a11y_pref_')) {
                this.loadPreferences();
                this.applyPreferences();
            }
        });
        
        // Listen for reduced motion preference changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', this.checkReducedMotionPreference);
        }
    }
    
    /**
     * Load accessibility preferences
     */
    loadPreferences() {
        try {
            this.preferences.highContrast = localStorage.getItem('a11y_pref_highContrast') === 'true';
            this.preferences.largeText = localStorage.getItem('a11y_pref_largeText') === 'true';
            this.preferences.announceMessages = localStorage.getItem('a11y_pref_announceMessages') !== 'false';
            this.preferences.textToSpeech = localStorage.getItem('a11y_pref_textToSpeech') === 'true';
            this.preferences.speechToText = localStorage.getItem('a11y_pref_speechToText') === 'true';
            this.preferences.keyboardShortcuts = localStorage.getItem('a11y_pref_keyboardShortcuts') !== 'false';
            this.preferences.navigationAnnouncements = localStorage.getItem('a11y_pref_navigationAnnouncements') !== 'false';
            this.preferences.magnification = parseFloat(localStorage.getItem('a11y_pref_magnification')) || 1.0;
            
            // Get reduced motion from localStorage or OS setting
            const storedReduceMotion = localStorage.getItem('a11y_pref_reduceMotion');
            if (storedReduceMotion !== null) {
                this.preferences.reduceMotion = storedReduceMotion === 'true';
            }
        } catch (error) {
            console.error('Failed to load accessibility preferences:', error);
        }
    }
    
    /**
     * Save accessibility preference
     * @param {string} key - Preference key
     * @param {boolean} value - Preference value
     */
    savePreference(key, value) {
        try {
            localStorage.setItem(`a11y_pref_${key}`, value.toString());
            this.preferences[key] = value;
            this.applyPreferences();
            this.handlePreferenceChange(key, value);
        } catch (error) {
            console.error(`Failed to save preference ${key}:`, error);
        }
    }
    
    /**
     * Handle preference change
     * @param {string} key - Changed preference key
     * @param {boolean} value - New preference value
     */
    handlePreferenceChange(key, value) {
        // Announce change to screen readers
        switch (key) {
            case 'highContrast':
                this.announce(`High contrast mode ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'largeText':
                this.announce(`Large text ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'reduceMotion':
                this.announce(`Reduced motion ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'announceMessages':
                if (value) {
                    this.announce('Message announcements enabled');
                }
                break;
            case 'textToSpeech':
                this.announce(`Text-to-speech ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'speechToText':
                this.announce(`Speech-to-text ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'keyboardShortcuts':
                this.announce(`Keyboard shortcuts ${value ? 'enabled' : 'disabled'}`);
                break;
            case 'navigationAnnouncements':
                this.announce(`Navigation announcements ${value ? 'enabled' : 'disabled'}`);
                break;
        }
    }
    
    /**
     * Check if user prefers reduced motion
     */
    checkReducedMotionPreference() {
        if (window.matchMedia) {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            
            // Only override if user hasn't explicitly set a preference
            if (localStorage.getItem('a11y_pref_reduceMotion') === null) {
                this.preferences.reduceMotion = prefersReducedMotion;
                this.applyPreferences();
            }
        }
    }
    
    /**
     * Apply current accessibility preferences to the UI
     */
    applyPreferences() {
        const htmlElement = document.documentElement;
        
        // High contrast mode
        if (this.preferences.highContrast) {
            htmlElement.setAttribute('data-high-contrast', 'true');
        } else {
            htmlElement.removeAttribute('data-high-contrast');
        }
        
        // Large text
        if (this.preferences.largeText) {
            htmlElement.setAttribute('data-large-text', 'true');
        } else {
            htmlElement.removeAttribute('data-large-text');
        }
        
        // Reduced motion
        if (this.preferences.reduceMotion) {
            htmlElement.setAttribute('data-reduced-motion', 'true');
        } else {
            htmlElement.removeAttribute('data-reduced-motion');
        }

        // Text-to-speech
        if (this.preferences.textToSpeech && this.speechSynthesis) {
            htmlElement.setAttribute('data-text-to-speech', 'true');
        } else {
            htmlElement.removeAttribute('data-text-to-speech');
        }
        
        // Speech-to-text
        if (this.preferences.speechToText && this.speechRecognition) {
            htmlElement.setAttribute('data-speech-to-text', 'true');
        } else {
            htmlElement.removeAttribute('data-speech-to-text');
        }
        
        // Keyboard shortcuts
        if (this.preferences.keyboardShortcuts) {
            htmlElement.setAttribute('data-keyboard-shortcuts', 'true');
        } else {
            htmlElement.removeAttribute('data-keyboard-shortcuts');
        }
        
        // Navigation announcements
        if (this.preferences.navigationAnnouncements) {
            htmlElement.setAttribute('data-navigation-announcements', 'true');
        } else {
            htmlElement.removeAttribute('data-navigation-announcements');
        }
        
        // Magnification
        htmlElement.style.fontSize = `${this.preferences.magnification}em`;
    }
    
    /**
     * Toggle high contrast mode
     * @returns {boolean} New state
     */
    toggleHighContrast() {
        const newState = !this.preferences.highContrast;
        this.savePreference('highContrast', newState);
        return newState;
    }
    
    /**
     * Toggle large text
     * @returns {boolean} New state
     */
    toggleLargeText() {
        const newState = !this.preferences.largeText;
        this.savePreference('largeText', newState);
        return newState;
    }
    
    /**
     * Toggle reduced motion
     * @returns {boolean} New state
     */
    toggleReducedMotion() {
        const newState = !this.preferences.reduceMotion;
        this.savePreference('reduceMotion', newState);
        return newState;
    }
    
    /**
     * Toggle message announcements
     * @returns {boolean} New state
     */
    toggleAnnounceMessages() {
        const newState = !this.preferences.announceMessages;
        this.savePreference('announceMessages', newState);
        return newState;
    }
    
    /**
     * Toggle text-to-speech
     * @returns {boolean} New state
     */
    toggleTextToSpeech() {
        const newState = !this.preferences.textToSpeech;
        this.savePreference('textToSpeech', newState);
        return newState;
    }
    
    /**
     * Toggle speech-to-text
     * @returns {boolean} New state
     */
    toggleSpeechToText() {
        const newState = !this.preferences.speechToText;
        this.savePreference('speechToText', newState);
        return newState;
    }
    
    /**
     * Toggle keyboard shortcuts
     * @returns {boolean} New state
     */
    toggleKeyboardShortcuts() {
        const newState = !this.preferences.keyboardShortcuts;
        this.savePreference('keyboardShortcuts', newState);
        return newState;
    }
    
    /**
     * Toggle navigation announcements
     * @returns {boolean} New state
     */
    toggleNavigationAnnouncements() {
        const newState = !this.preferences.navigationAnnouncements;
        this.savePreference('navigationAnnouncements', newState);
        return newState;
    }
    
    /**
     * Set magnification level
     * @param {number} level - Magnification level (1.0 = 100%)
     */
    setMagnification(level) {
        level = Math.max(1.0, Math.min(level, 3.0)); // Clamp between 100% and 300%
        this.savePreference('magnification', level);
    }
    
    /**
     * Announce a new message for screen readers
     * @param {Object} message - Message object
     */
    announceNewMessage(message) {
        if (!this.preferences.announceMessages) return;
        
        const userName = message.user || 'Unknown user';
        const messageText = message.text || '';
        
        this.announce(`New message from ${userName}: ${messageText}`);
    }
    
    /**
     * Create an accessibility menu
     * @param {HTMLElement} container - Container for the menu
     */
    createAccessibilityMenu(container) {
        if (!container) return;
        
        const menu = document.createElement('div');
        menu.className = 'a11y-menu';
        menu.setAttribute('aria-labelledby', 'a11y-menu-heading');
        
        menu.innerHTML = `
            <h3 id="a11y-menu-heading" class="a11y-menu-heading">Accessibility Options</h3>
            <div class="a11y-menu-options">
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-high-contrast" ${this.preferences.highContrast ? 'checked' : ''}>
                    <label for="a11y-high-contrast">High Contrast Mode</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-large-text" ${this.preferences.largeText ? 'checked' : ''}>
                    <label for="a11y-large-text">Large Text</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-reduce-motion" ${this.preferences.reduceMotion ? 'checked' : ''}>
                    <label for="a11y-reduce-motion">Reduce Motion</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-announce-messages" ${this.preferences.announceMessages ? 'checked' : ''}>
                    <label for="a11y-announce-messages">Announce New Messages</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-text-to-speech" ${this.preferences.textToSpeech ? 'checked' : ''}>
                    <label for="a11y-text-to-speech">Text-to-Speech</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-speech-to-text" ${this.preferences.speechToText ? 'checked' : ''}>
                    <label for="a11y-speech-to-text">Speech-to-Text</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-keyboard-shortcuts" ${this.preferences.keyboardShortcuts ? 'checked' : ''}>
                    <label for="a11y-keyboard-shortcuts">Keyboard Shortcuts</label>
                </div>
                <div class="a11y-option">
                    <input type="checkbox" id="a11y-navigation-announcements" ${this.preferences.navigationAnnouncements ? 'checked' : ''}>
                    <label for="a11y-navigation-announcements">Navigation Announcements</label>
                </div>
            </div>
            <div class="a11y-menu-footer">
                <button class="a11y-menu-close">Close</button>
            </div>
        `;
        
        container.appendChild(menu);
        
        // Add event listeners
        const highContrastCheckbox = document.getElementById('a11y-high-contrast');
        const largeTextCheckbox = document.getElementById('a11y-large-text');
        const reduceMotionCheckbox = document.getElementById('a11y-reduce-motion');
        const announceMessagesCheckbox = document.getElementById('a11y-announce-messages');
        const textToSpeechCheckbox = document.getElementById('a11y-text-to-speech');
        const speechToTextCheckbox = document.getElementById('a11y-speech-to-text');
        const keyboardShortcutsCheckbox = document.getElementById('a11y-keyboard-shortcuts');
        const navigationAnnouncementsCheckbox = document.getElementById('a11y-navigation-announcements');
        const closeButton = menu.querySelector('.a11y-menu-close');
        
        if (highContrastCheckbox) {
            highContrastCheckbox.addEventListener('change', () => {
                this.savePreference('highContrast', highContrastCheckbox.checked);
            });
        }
        
        if (largeTextCheckbox) {
            largeTextCheckbox.addEventListener('change', () => {
                this.savePreference('largeText', largeTextCheckbox.checked);
            });
        }
        
        if (reduceMotionCheckbox) {
            reduceMotionCheckbox.addEventListener('change', () => {
                this.savePreference('reduceMotion', reduceMotionCheckbox.checked);
            });
        }
        
        if (announceMessagesCheckbox) {
            announceMessagesCheckbox.addEventListener('change', () => {
                this.savePreference('announceMessages', announceMessagesCheckbox.checked);
            });
        }
        
        if (textToSpeechCheckbox) {
            textToSpeechCheckbox.addEventListener('change', () => {
                this.savePreference('textToSpeech', textToSpeechCheckbox.checked);
            });
        }
        
        if (speechToTextCheckbox) {
            speechToTextCheckbox.addEventListener('change', () => {
                this.savePreference('speechToText', speechToTextCheckbox.checked);
            });
        }
        
        if (keyboardShortcutsCheckbox) {
            keyboardShortcutsCheckbox.addEventListener('change', () => {
                this.savePreference('keyboardShortcuts', keyboardShortcutsCheckbox.checked);
            });
        }
        
        if (navigationAnnouncementsCheckbox) {
            navigationAnnouncementsCheckbox.addEventListener('change', () => {
                this.savePreference('navigationAnnouncements', navigationAnnouncementsCheckbox.checked);
            });
        }
        
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                menu.remove();
            });
        }
        
        // Return the menu element
        return menu;
    }
    
    /**
     * Initialize keyboard shortcuts system
     */
    initializeKeyboardShortcuts() {
        // Register default keyboard shortcuts
        this.registerShortcuts({
            // Navigation shortcuts
            'Alt+1': () => this.focusElement('#chat-messages'),
            'Alt+2': () => this.focusElement('#message-input'),
            'Alt+3': () => this.focusElement('#user-list'),
            'Alt+4': () => this.focusElement('#chat-sidebar'),
            
            // Chat shortcuts
            'Ctrl+Enter': () => this.sendMessage(),
            'Ctrl+Shift+E': () => this.toggleEmojiPicker(),
            'Ctrl+Shift+F': () => this.toggleFileUpload(),
            'Ctrl+Shift+V': () => this.toggleVoiceRecording(),
            
            // Accessibility shortcuts
            'Alt+H': () => this.showKeyboardShortcuts(),
            'Alt+C': () => this.toggleHighContrast(),
            'Alt+T': () => this.toggleTextToSpeech(),
            'Alt+R': () => this.toggleSpeechToText(),
            'Alt+Plus': () => this.increaseFontSize(),
            'Alt+Minus': () => this.decreaseFontSize(),
            
            // Navigation
            'Escape': () => this.closeModal(),
            'F1': () => this.showHelp(),
            'Ctrl+/': () => this.showKeyboardShortcuts()
        });

        // Add keyboard event listener
        document.addEventListener('keydown', this.handleKeyboardShortcut);
    }

    /**
     * Register keyboard shortcuts
     * @param {Object} shortcuts - Object mapping key combinations to functions
     */
    registerShortcuts(shortcuts) {
        for (const [combination, handler] of Object.entries(shortcuts)) {
            this.shortcuts.set(combination, handler);
        }
    }

    /**
     * Handle keyboard shortcut events
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcut(event) {
        if (!this.preferences.keyboardShortcuts) return;

        // Build key combination string
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        
        // Handle special keys
        let key = event.key;
        if (key === ' ') key = 'Space';
        if (key === 'Enter') key = 'Enter';
        if (key === 'Escape') key = 'Escape';
        if (key === '+') key = 'Plus';
        if (key === '-') key = 'Minus';
        if (key.startsWith('F') && /^F\d+$/.test(key)) key = key; // Function keys
        else if (key.length === 1) key = key.toUpperCase();
        
        parts.push(key);
        const combination = parts.join('+');

        // Execute shortcut if it exists
        if (this.shortcuts.has(combination)) {
            event.preventDefault();
            event.stopPropagation();
            this.shortcuts.get(combination)();
            this.announceShortcutUsed(combination);
        }
    }

    /**
     * Initialize text-to-speech functionality
     */
    initializeTextToSpeech() {
        if ('speechSynthesis' in window) {
            this.speechSynthesis = window.speechSynthesis;
            
            // Listen for new messages to read aloud
            document.addEventListener('newMessage', (event) => {
                if (this.preferences.textToSpeech && event.detail) {
                    this.speakText(event.detail.text, event.detail.priority);
                }
            });
        }
    }

    /**
     * Initialize speech recognition functionality
     */
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            this.speechRecognition = new SpeechRecognition();
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = true;
            this.speechRecognition.lang = 'en-US';

            this.speechRecognition.onresult = (event) => {
                const result = event.results[event.results.length - 1];
                if (result.isFinal) {
                    this.insertSpeechText(result[0].transcript);
                }
            };

            this.speechRecognition.onerror = (event) => {
                console.warn('Speech recognition error:', event.error);
                this.announce('Speech recognition error occurred', 'assertive');
            };
        }
    }

    /**
     * Initialize navigation announcements
     */
    initializeNavigationAnnouncements() {
        // Listen for focus changes
        document.addEventListener('focusin', (event) => {
            if (this.preferences.navigationAnnouncements) {
                this.announceNavigation(event.target);
            }
            this.currentFocus = event.target;
        });

        // Listen for page navigation
        window.addEventListener('popstate', () => {
            if (this.preferences.navigationAnnouncements) {
                this.announce(`Navigated to ${document.title}`, 'polite');
            }
        });

        // Listen for dynamic content changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('aria-live')) {
                            // Content was added to a live region, announce it
                            const text = node.textContent || node.innerText;
                            if (text && this.preferences.navigationAnnouncements) {
                                this.announce(text, node.getAttribute('aria-live'));
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Announce navigation context
     * @param {HTMLElement} element - Element that received focus
     */
    announceNavigation(element) {
        if (!element || !this.preferences.navigationAnnouncements) return;

        let announcement = '';
        
        // Get element context
        const role = element.getAttribute('role') || element.tagName.toLowerCase();
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('title') || 
                     element.textContent?.trim() || 
                     element.placeholder;

        // Build announcement
        if (label) {
            announcement = `${label}`;
            if (role !== 'generic' && role !== 'div') {
                announcement += `, ${role}`;
            }
        }

        // Add position context for lists
        const listItem = element.closest('[role="listitem"], li');
        if (listItem) {
            const list = listItem.closest('[role="list"], ul, ol');
            if (list) {
                const items = list.querySelectorAll('[role="listitem"], li');
                const position = Array.from(items).indexOf(listItem) + 1;
                announcement += `, ${position} of ${items.length}`;
            }
        }

        // Add expanded/collapsed state
        const expanded = element.getAttribute('aria-expanded');
        if (expanded !== null) {
            announcement += expanded === 'true' ? ', expanded' : ', collapsed';
        }

        // Add selected state
        const selected = element.getAttribute('aria-selected');
        if (selected === 'true') {
            announcement += ', selected';
        }

        if (announcement) {
            this.announce(announcement, 'polite');
        }
    }

    /**
     * Speak text using text-to-speech
     * @param {string} text - Text to speak
     * @param {string} priority - Speech priority
     */
    speakText(text, priority = 'polite') {
        if (!this.speechSynthesis || !this.preferences.textToSpeech) return;

        // Cancel previous speech if high priority
        if (priority === 'assertive') {
            this.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;

        this.speechSynthesis.speak(utterance);
    }

    /**
     * Show keyboard shortcuts modal
     */
    showKeyboardShortcuts() {
        if (this.elements.shortcutsModal) {
            this.elements.shortcutsModal.style.display = 'block';
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'shortcuts-modal modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'shortcuts-title');
        modal.setAttribute('aria-modal', 'true');

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                    <button class="modal-close" aria-label="Close shortcuts">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-grid">
                        <div class="shortcuts-section">
                            <h3>Navigation</h3>
                            <dl>
                                <dt>Alt + 1</dt><dd>Focus messages</dd>
                                <dt>Alt + 2</dt><dd>Focus message input</dd>
                                <dt>Alt + 3</dt><dd>Focus user list</dd>
                                <dt>Alt + 4</dt><dd>Focus sidebar</dd>
                            </dl>
                        </div>
                        <div class="shortcuts-section">
                            <h3>Chat Actions</h3>
                            <dl>
                                <dt>Ctrl + Enter</dt><dd>Send message</dd>
                                <dt>Ctrl + Shift + E</dt><dd>Toggle emoji picker</dd>
                                <dt>Ctrl + Shift + F</dt><dd>Toggle file upload</dd>
                                <dt>Ctrl + Shift + V</dt><dd>Toggle voice recording</dd>
                            </dl>
                        </div>
                        <div class="shortcuts-section">
                            <h3>Accessibility</h3>
                            <dl>
                                <dt>Alt + H</dt><dd>Show this help</dd>
                                <dt>Alt + C</dt><dd>Toggle high contrast</dd>
                                <dt>Alt + T</dt><dd>Toggle text-to-speech</dd>
                                <dt>Alt + R</dt><dd>Toggle speech-to-text</dd>
                                <dt>Alt + Plus</dt><dd>Increase font size</dd>
                                <dt>Alt + Minus</dt><dd>Decrease font size</dd>
                            </dl>
                        </div>
                        <div class="shortcuts-section">
                            <h3>General</h3>
                            <dl>
                                <dt>Escape</dt><dd>Close modal/cancel action</dd>
                                <dt>F1</dt><dd>Show help</dd>
                                <dt>Ctrl + /</dt><dd>Show shortcuts</dd>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.elements.shortcutsModal = modal;

        // Set up modal close functionality
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.closeModal());

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Trap focus in modal
        const removeFocusTrap = this.trapFocus(modal);
        modal.setAttribute('data-focus-trap', 'true');

        // Focus first element
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();

        this.announce('Keyboard shortcuts dialog opened', 'polite');
    }

    // ...existing code...
}

// Export the class for ES modules
export default AccessibilityManager;

// Create global instance for backward compatibility
window.accessibilityManager = new AccessibilityManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.accessibilityManager.init();
});
