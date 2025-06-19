// Quick Chat Configuration
// NOTICE: This file is maintained for backward compatibility.
// New code should use the modular architecture in /assets/js/core/config.js
import coreConfig from './core/config.js';

// Keep backward compatibility
window.ChatConfig = window.ChatConfig || {
    // API endpoints
    apiUrl: 'api/',
    uploadUrl: 'api/upload.php',
    
    // File upload settings
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/ogg'],
    allowedAudioTypes: ['audio/mp3', 'audio/ogg', 'audio/wav', 'audio/m4a'],
    allowedDocumentTypes: ['application/pdf', 'text/plain', 'application/msword'],
    
    // Message settings
    maxMessageLength: 2000,
    maxMessagesPerLoad: 50,
    messageEditTimeLimit: 15, // minutes
    
    // Real-time settings
    pollInterval: 5000, // 5 seconds
    typingTimeout: 3000, // 3 seconds
    activityUpdateInterval: 30000, // 30 seconds
    
    // UI settings
    theme: localStorage.getItem('chat_theme') || 'light',
    soundEnabled: localStorage.getItem('chat_sound') !== 'false',
    desktopNotifications: localStorage.getItem('chat_notifications') !== 'false',
    
    // Security settings
    sessionTimeout: 3600000, // 1 hour in milliseconds
    passwordMinLength: 8,
    passwordRequireSpecial: true,
    passwordRequireNumbers: true,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    
    // Feature flags
    features: {
        fileUpload: true,
        audioRecording: true,
        messageReactions: true,
        messageSearch: true,
        userMentions: true,
        messageThreads: false,
        videoChat: false,
        screenShare: false
    },
    
    // Emoji configuration
    emojiCategories: {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
        people: ['👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧓', '👴', '👵', '👱', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦲', '👩‍🦲', '👨‍🦳', '👩‍🦳', '🧔', '👯', '👯‍♂️', '👯‍♀️'],
        nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇'],
        food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞'],
        activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'],
        travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚁'],
        objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓', '🪚', '🔩', '⚙️', '🪤', '🧲', '🔫'],
        symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐']
    },
    
    // Notification sounds
    sounds: {
        message: 'assets/sounds/message.mp3',
        mention: 'assets/sounds/mention.mp3',
        error: 'assets/sounds/error.mp3',
        success: 'assets/sounds/success.mp3'
    },
    
    // Keyboard shortcuts
    shortcuts: {
        send: 'Enter',
        newLine: 'Shift+Enter',
        search: 'Ctrl+F',
        settings: 'Ctrl+,',
        logout: 'Ctrl+Shift+Q'
    },
    
    // Development settings
    debug: false,
    logLevel: 'warn' // 'debug', 'info', 'warn', 'error'
};

// Theme configuration
window.ChatThemes = {
    light: {
        name: 'Light',
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#333333',
        textSecondary: '#666666',
        border: '#e9ecef',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8'
    },
    
    dark: {
        name: 'Dark',
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#1a1a1a',
        surface: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#cccccc',
        border: '#404040',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8'
    },
    
    blue: {
        name: 'Ocean Blue',
        primary: '#0066cc',
        secondary: '#004499',
        background: '#ffffff',
        surface: '#f0f8ff',
        text: '#003366',
        textSecondary: '#0066cc',
        border: '#cce6ff',
        success: '#00cc66',
        warning: '#ff9900',
        danger: '#cc0000',
        info: '#0099cc'
    }
};

// Localization strings
window.ChatStrings = {
    en: {
        welcome: 'Welcome to Quick Chat!',
        login: 'Sign In',
        register: 'Create Account',
        logout: 'Logout',
        sendMessage: 'Send Message',
        typeMessage: 'Type your message...',
        uploadFile: 'Upload File',
        recordAudio: 'Record Audio',
        addEmoji: 'Add Emoji',
        clearChat: 'Clear Chat',
        settings: 'Settings',
        darkMode: 'Dark Mode',
        notifications: 'Notifications',
        sounds: 'Sounds',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        warning: 'Warning',
        info: 'Information',
        confirmLogout: 'Are you sure you want to logout?',
        confirmClearChat: 'Are you sure you want to clear all messages?',
        fileTooBig: 'File is too large. Maximum size is {size}MB',
        unsupportedFile: 'Unsupported file type',
        messageEmpty: 'Message cannot be empty',
        messageTooLong: 'Message is too long. Maximum length is {length} characters',
        passwordTooWeak: 'Password is too weak',
        emailInvalid: 'Invalid email address',
        usernameInvalid: 'Username must be 3-20 characters, letters and numbers only',
        passwordMismatch: 'Passwords do not match',
        connectionLost: 'Connection lost. Trying to reconnect...',
        connectionRestored: 'Connection restored'
    }
};

// Utility functions
window.ChatUtils = {
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    formatTime: function(date) {
        return new Intl.DateTimeFormat('default', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    },
    
    formatDate: function(date) {
        const now = new Date();
        const messageDate = new Date(date);
        const diffDays = Math.floor((now - messageDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return messageDate.toLocaleDateString('default', { weekday: 'long' });
        } else {
            return messageDate.toLocaleDateString();
        }
    },
    
    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    debounce: function(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    },
    
    throttle: function(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Export configuration for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ChatConfig: window.ChatConfig,
        ChatThemes: window.ChatThemes,
        ChatStrings: window.ChatStrings,
        ChatUtils: window.ChatUtils
    };
}

// Export for ES modules
export default window.ChatConfig;
