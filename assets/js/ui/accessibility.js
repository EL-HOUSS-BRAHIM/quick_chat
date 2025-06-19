/**
 * Accessibility enhancements for Quick Chat
 * Version: 2.0.0
 * 
 * This module provides accessibility features for the chat application including:
 * - Screen reader announcements
 * - Focus management
 * - Keyboard navigation
 * - ARIA attributes management
 * - High contrast mode support
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
            announceMessages: true
        };
        
        // DOM elements
        this.elements = {
            liveRegion: null,
            focusTrap: null
        };
        
        // Bind methods to maintain context
        this.announce = this.announce.bind(this);
        this.trapFocus = this.trapFocus.bind(this);
        this.handlePreferenceChange = this.handlePreferenceChange.bind(this);
    }
    
    /**
     * Initialize accessibility features
     */
    init() {
        if (this.initialized) return;
        
        console.log('Initializing accessibility features...');
        
        // Create live region for screen reader announcements
        this.createLiveRegion();
        
        // Load user preferences
        this.loadPreferences();
        
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
        
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                menu.remove();
            });
        }
        
        // Return the menu element
        return menu;
    }
}

// Export the class for ES modules
export default AccessibilityManager;

// Create global instance for backward compatibility
window.accessibilityManager = new AccessibilityManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.accessibilityManager.init();
});
