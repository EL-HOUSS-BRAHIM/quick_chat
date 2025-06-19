/**
 * App.js - Backward Compatibility Layer
 * 
 * This file forwards calls to the new core/app.js module while maintaining
 * backward compatibility with existing code that uses the old app.js.
 */

import coreApp from './core/app.js';
import appState from './core/state.js';
import performanceMonitor from './core/performance-monitor.js';

// Log migration notice
console.warn('Using app.js compatibility layer. Please migrate to the new architecture.');

// Create a proxy to forward method calls to the core app
class AppCompatibilityLayer {
    constructor() {
        this.coreApp = coreApp;
        this.performanceMonitor = performanceMonitor;
        
        // Initialize with state from the state manager
        const state = appState.getState();
        this.state = {
            user: state.user || null,
            messages: state.messages || [],
            isOnline: state.isOnline || navigator.onLine,
            isVisible: state.isVisible || !document.hidden,
            isLoggingIn: false,
            lastMessageId: null,
            reconnectAttempts: 0,
            soundEnabled: state.soundEnabled || true,
            theme: state.theme || 'light',
            typingUsers: new Set(),
            replyingTo: null,
            lastActivityTime: Date.now(),
            pendingUploads: new Map()
        };
        
        // For backward compatibility, add messages property
        this.messages = this.state.messages;
        
        // Forward state changes
        appState.subscribe((newState) => {
            this.state = {
                ...this.state,
                ...newState
            };
            this.messages = this.state.messages;
        });
    }
    
    // Forward init call to core app
    async init() {
        console.log('Initializing app through compatibility layer');
        return this.coreApp.init();
    }
    
    // Forward other methods to core app or provide compatibility implementations
    // Add other forwarding methods as needed for backward compatibility
}

// Create a global instance
const appCompatibilityLayer = new AppCompatibilityLayer();
window.chatApp = appCompatibilityLayer;

// Export for ES modules
export default appCompatibilityLayer;
