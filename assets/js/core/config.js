/**
 * Enhanced Quick Chat Application - Config Compatibility Layer
 * 
 * NOTICE: This file is maintained for backward compatibility.
 * New code should use the modular architecture in /assets/js/core/config.js
 */

import appState from './core/state.js';

// Create the core config file if it doesn't exist
const coreConfig = {
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
};

// Set the config in the state manager
appState.setState({
    config: {
        ...window.ChatConfig,
        ...coreConfig
    }
});

// For backward compatibility, keep the global configs
window.ChatConfig = window.ChatConfig || coreConfig;

export default coreConfig;
