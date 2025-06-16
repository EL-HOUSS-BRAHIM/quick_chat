/**
 * Enhanced Integration module for connecting app.js with chat.js
 * Version: 2.0.0
 */

(function() {
    // Initialization state
    let initialized = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 1000;
    
    // Event handlers registry
    const eventHandlers = {};
    
    // Integration bridge state
    const state = {
        integrationReady: false,
        componentRegistry: new Map(),
        lastError: null,
        connectionState: navigator.onLine ? 'online' : 'offline'
    };
    
    /**
     * Initialize integration bridge
     */
    function init() {
        if (initialized) return;
        
        console.log('Initializing chat integration bridge...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeIntegration);
        } else {
            initializeIntegration();
        }
        
        // Set up online/offline handling
        window.addEventListener('online', handleOnlineChange);
        window.addEventListener('offline', handleOnlineChange);
        
        initialized = true;
    }
    
    /**
     * Initialize integration between components
     */
    function initializeIntegration() {
        console.log('Starting integration initialization...');
        
        // First check if both chat handler and app are available
        if (window.chatHandler && window.quickChatApp) {
            console.log('Components detected immediately, connecting...');
            connectComponents();
            return;
        }
        
        // Set up observer to wait for both components
        console.log('Waiting for components...');
        
        // Add a delay to ensure all components are fully initialized
        setTimeout(() => {
            // Use a more patient approach - check periodically
            let attempts = 0;
            const checkInterval = setInterval(function() {
                attempts++;
                
                if (checkComponents()) {
                    clearInterval(checkInterval);
                    console.log('Components connected successfully after', attempts, 'attempts');
                    return;
                }
                
                // Give up after max attempts
                if (attempts >= maxReconnectAttempts * 2) { // Double the attempts
                    clearInterval(checkInterval);
                    console.error('Failed to connect components after maximum attempts');
                    triggerEvent('integrationFailed', { 
                        reason: 'Components not available after max attempts',
                        attempts: attempts
                    });
                }
            }, reconnectDelay);
        }, 1500); // Add 1.5 second delay
        
        // Also set up a fallback timeout
        setTimeout(() => {
            if (!state.integrationReady) {
                console.log('Integration timeout, trying one final check...');
                checkComponents();
            }
        }, 5000);
    }
     /**
     * Check if components are available and connect them
     * @returns {boolean} Whether components were connected
     */
    function checkComponents() {
        // More thorough checking with debugging
        const chatHandler = window.chatHandler;
        const quickChatApp = window.quickChatApp;
        const appendMessage = window.appendMessage; // Check for global appendMessage too
        
        console.log('Checking components:', {
            chatHandler: !!chatHandler,
            quickChatApp: !!quickChatApp,
            appendMessage: !!appendMessage, // Include appendMessage check
            chatHandlerType: typeof chatHandler,
            quickChatAppType: typeof quickChatApp,
            appendMessageType: typeof appendMessage
        });

        if (chatHandler && quickChatApp && appendMessage) {
            console.log('All components found, connecting...');
            connectComponents();
            return true;
        } else {
            console.log('Components not ready yet:', {
                missingChatHandler: !chatHandler,
                missingQuickChatApp: !quickChatApp,
                missingAppendMessage: !appendMessage
            });
        }
        return false;
    }
    
    /**
     * Connect chat.js handler with app.js
     */
    function connectComponents() {
        const app = window.quickChatApp;
        const chat = window.chatHandler;
        
        // Register components
        registerComponent('app', app);
        registerComponent('chat', chat);
        
        // Check if we have all required methods
        if (!validateComponents()) {
            console.error('Component validation failed');
            triggerEvent('integrationFailed', { reason: 'Component validation failed' });
            return;
        }
        
        // Add methods to app to call chat methods
        enhanceAppWithChatMethods(app, chat);
        
        // Add methods to chat to call app methods
        enhanceChatWithAppMethods(chat, app);
        
        // Connect error handling
        connectErrorHandling();
        
        // Connect accessibility features
        connectAccessibilityFeatures();
        
        // Set integration as ready
        state.integrationReady = true;
        
        console.log('Successfully connected chat.js with app.js');
        triggerEvent('integrationReady', { components: ['app', 'chat'] });
    }
    
    /**
     * Register a component in the registry
     * @param {string} name - Component name
     * @param {Object} component - Component instance
     */
    function registerComponent(name, component) {
        if (!component) {
            console.error(`Cannot register ${name}: component is null or undefined`);
            return;
        }
        
        state.componentRegistry.set(name, component);
        console.log(`Registered component: ${name}`);
    }
    
    /**
     * Validate that components have required methods
     * @returns {boolean} Validation result
     */
    function validateComponents() {
        const app = state.componentRegistry.get('app');
        const chat = state.componentRegistry.get('chat');
        
        if (!app || !chat) return false;
        
        // Define required methods for each component
        const requiredAppMethods = [
            'sendMessage', 
            'applyTheme', 
            'showError',
            'showToast'
        ];
        
        const requiredChatMethods = [
            'appendMessage', 
            'scrollToBottom', 
            'hideEmojiPicker'
        ];
        
        // Check app methods
        const appValid = requiredAppMethods.every(method => {
            const hasMethod = typeof app[method] === 'function';
            if (!hasMethod) {
                console.warn(`App is missing required method: ${method}`);
            }
            return hasMethod;
        });
        
        // Check chat methods
        const chatValid = requiredChatMethods.every(method => {
            const hasMethod = typeof chat[method] === 'function';
            if (!hasMethod) {
                console.warn(`Chat is missing required method: ${method}`);
            }
            return hasMethod;
        });
        
        return appValid && chatValid;
    }
    
    /**
     * Enhance app with chat methods
     * @param {Object} app - App instance
     * @param {Object} chat - Chat instance
     */
    function enhanceAppWithChatMethods(app, chat) {
        // Add methods to app to call chat methods
        app.updateChatUI = function(messages) {
            if (typeof chat.renderMessages === 'function') {
                chat.renderMessages(messages);
            } else if (typeof chat.appendMessage === 'function' && Array.isArray(messages)) {
                // Fallback if renderMessages doesn't exist
                messages.forEach(msg => {
                    chat.appendMessage(msg.user || 'Unknown', msg.text || '');
                });
            }
        };
        
        // Add upload progress support
        app.updateUploadProgress = function(id, progress) {
            if (typeof chat.updateUploadProgress === 'function') {
                chat.updateUploadProgress(id, progress);
            }
        };
        
        // Add typing indicator support
        app.updateTypingIndicator = function(users) {
            if (typeof chat.updateTypingIndicator === 'function') {
                chat.updateTypingIndicator(users);
            }
        };
        
        // Enhance app's sendMessage to work with chat.js
        const originalSendMessage = app.sendMessage;
        app.sendMessage = function(content, options = {}) {
            // If content is provided directly, use it
            if (content) {
                if (typeof originalSendMessage === 'function') {
                    return originalSendMessage.call(app, content, options);
                }
            } else {
                // Get content from input via chat.js
                const messageInput = document.getElementById('messageInput');
                if (messageInput && messageInput.value.trim()) {
                    const text = messageInput.value.trim();
                    
                    // Clear input via chat.js
                    messageInput.value = '';
                    if (typeof chat.updateCharacterCount === 'function') {
                        chat.updateCharacterCount();
                    }
                    
                    // Send via app.js
                    if (typeof originalSendMessage === 'function') {
                        return originalSendMessage.call(app, text, options);
                    } else {
                        // Fallback if app doesn't have sendMessage
                        if (typeof chat.appendMessage === 'function') {
                            chat.appendMessage('You', text);
                            return Promise.resolve({ success: true, message: { text } });
                        }
                    }
                }
            }
            
            return Promise.resolve({ success: false });
        };
        
        // Connect theme toggling
        const originalApplyTheme = app.applyTheme;
        app.applyTheme = function(theme) {
            if (typeof originalApplyTheme === 'function') {
                originalApplyTheme.call(app, theme);
            }
            
            // Make sure chat.js knows about theme changes
            if (typeof chat.updateTheme === 'function') {
                chat.updateTheme(theme);
            }
        };
        
        // Connect emoji picker
        if (typeof app.getEmojis === 'function' && typeof chat.populateEmojiPicker === 'function') {
            const emojis = app.getEmojis();
            if (emojis && emojis.length) {
                chat.populateEmojiPicker(emojis);
            }
        }
    }
    
    /**
     * Enhance chat with app methods
     * @param {Object} chat - Chat instance
     * @param {Object} app - App instance
     */
    function enhanceChatWithAppMethods(chat, app) {
        // Add methods to chat to call app methods
        chat.uploadFile = function(file) {
            if (typeof app.uploadFile === 'function') {
                return app.uploadFile(file);
            }
            return Promise.reject(new Error('File upload not supported'));
        };
        
        // Connect notification sound
        chat.playNotificationSound = function() {
            if (typeof app.playNotificationSound === 'function') {
                app.playNotificationSound();
            }
        };
        
        // Connect error display
        chat.showError = function(message) {
            if (typeof app.showError === 'function') {
                app.showError(message);
            } else {
                console.error(message);
                alert(message);
            }
        };
        
        // Connect success message display
        chat.showSuccess = function(message) {
            if (typeof app.showSuccess === 'function') {
                app.showSuccess(message);
            } else if (typeof app.showToast === 'function') {
                app.showToast(message, 'success');
            } else {
                console.log(message);
            }
        };
        
        // Connect toast messages
        chat.showToast = function(message, type = 'info') {
            // Don't call app.showToast to avoid circular calls - implement toast directly
            if (window.utils && typeof window.utils.showToast === 'function') {
                window.utils.showToast(message, type);
            } else {
                // Add CSS animation styles if they don't exist
                if (!document.querySelector('#toast-animations')) {
                    const style = document.createElement('style');
                    style.id = 'toast-animations';
                    style.textContent = `
                        @keyframes slideIn {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                        @keyframes slideOut {
                            from { transform: translateX(0); opacity: 1; }
                            to { transform: translateX(100%); opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // Create a simple toast notification directly
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.textContent = message;
                toast.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    font-weight: 500;
                    z-index: 9999;
                    max-width: 350px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: slideIn 0.3s ease-out;
                    background-color: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                `;
                
                document.body.appendChild(toast);
                
                // Remove toast after 5 seconds
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.style.animation = 'slideOut 0.3s ease-in';
                        setTimeout(() => {
                            if (toast.parentNode) {
                                toast.parentNode.removeChild(toast);
                            }
                        }, 300);
                    }
                }, 5000);
                
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        };
    }
    
    /**
     * Connect error handling between components
     */
    function connectErrorHandling() {
        // Connect to error handler if available
        if (window.errorHandler) {
            console.log('Connecting to error handler...');
            
            // Register integration module with error handler
            if (typeof window.errorHandler.registerModule === 'function') {
                window.errorHandler.registerModule('integration', {
                    name: 'Integration Bridge',
                    version: '2.0.0'
                });
            }
            
            // Set up global fetch error handling
            if (typeof window.handleFetchError === 'function') {
                const app = state.componentRegistry.get('app');
                if (app && typeof app.setupFetchErrorHandling === 'function') {
                    app.setupFetchErrorHandling(window.handleFetchError);
                }
            }
        }
    }
    
    /**
     * Connect accessibility features between components
     */
    function connectAccessibilityFeatures() {
        if (window.accessibilityManager) {
            console.log('Connecting to accessibility manager...');
            
            // Connect announcement feature
            const chat = state.componentRegistry.get('chat');
            const app = state.componentRegistry.get('app');
            
            if (chat) {
                chat.announceForScreenReader = function(message, priority = 'polite') {
                    if (window.accessibilityManager && typeof window.accessibilityManager.announce === 'function') {
                        window.accessibilityManager.announce(message, priority);
                    }
                };
            }
            
            if (app) {
                app.announceForScreenReader = function(message, priority = 'polite') {
                    if (window.accessibilityManager && typeof window.accessibilityManager.announce === 'function') {
                        window.accessibilityManager.announce(message, priority);
                    }
                };
                
                // Connect message announcement
                const originalReceiveMessage = app.receiveMessage;
                if (typeof originalReceiveMessage === 'function') {
                    app.receiveMessage = function(message) {
                        const result = originalReceiveMessage.call(app, message);
                        
                        // Announce new message for screen readers
                        if (window.accessibilityManager && 
                            typeof window.accessibilityManager.announceNewMessage === 'function') {
                            window.accessibilityManager.announceNewMessage(message);
                        }
                        
                        return result;
                    };
                }
            }
        }
    }
    
    /**
     * Handle online/offline status change
     */
    function handleOnlineChange() {
        const online = navigator.onLine;
        const previousState = state.connectionState;
        state.connectionState = online ? 'online' : 'offline';
        
        // Only trigger event if state actually changed
        if (previousState !== state.connectionState) {
            console.log(`Connection state changed: ${state.connectionState}`);
            triggerEvent('connectionChange', { 
                online, 
                previous: previousState 
            });
        }
    }
    
    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Function to remove listener
     */
    function on(event, handler) {
        if (!eventHandlers[event]) {
            eventHandlers[event] = [];
        }
        
        eventHandlers[event].push(handler);
        
        // Return function to remove this specific handler
        return function off() {
            const index = eventHandlers[event].indexOf(handler);
            if (index !== -1) {
                eventHandlers[event].splice(index, 1);
            }
        };
    }
    
    /**
     * Trigger event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    function triggerEvent(event, data = {}) {
        if (!eventHandlers[event]) return;
        
        // Call all handlers with data
        eventHandlers[event].forEach(handler => {
            try {
                handler(data);
            } catch (err) {
                console.error(`Error in ${event} event handler:`, err);
            }
        });
    }
    
    /**
     * Get component by name
     * @param {string} name - Component name
     * @returns {Object|null} Component or null if not found
     */
    function getComponent(name) {
        return state.componentRegistry.get(name) || null;
    }
    
    /**
     * Get integration state
     * @returns {Object} Current state
     */
    function getState() {
        return { ...state };
    }
    
    // Public API
    window.chatIntegration = {
        init,
        on,
        getComponent,
        getState
    };
    
    // Auto-initialize if both scripts are loaded
    init();
})();
