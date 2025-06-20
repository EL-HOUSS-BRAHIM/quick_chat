/**
 * Application Constants - Organized Architecture
 * 
 * Central location for all application constants, configurations, and enums
 * This helps maintain consistency across the application
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: '/api/v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// WebSocket Configuration
export const WEBSOCKET_CONFIG = {
  URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 2000,
  HEARTBEAT_INTERVAL: 30000
};

// WebRTC Configuration
export const WEBRTC_CONFIG = {
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  MEDIA_CONSTRAINTS: {
    video: {
      width: { min: 640, ideal: 1280, max: 1920 },
      height: { min: 480, ideal: 720, max: 1080 },
      frameRate: { min: 10, ideal: 24, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  }
};

// Chat Configuration
export const CHAT_CONFIG = {
  MESSAGE_LIMIT: 50,
  LOAD_MORE_INCREMENT: 20,
  TYPING_TIMEOUT: 3000,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_MESSAGE_LENGTH: 4000,
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm',
    'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
};

// UI Configuration
export const UI_CONFIG = {
  NOTIFICATION_TIMEOUT: 5000,
  MODAL_TRANSITION_DURATION: 300,
  LOADING_SPINNER_DELAY: 200,
  VIRTUAL_SCROLL_BUFFER: 5,
  SIDEBAR_WIDTH: 300,
  MOBILE_BREAKPOINT: 768
};

// Theme Configuration
export const THEME_CONFIG = {
  DEFAULT_THEME: 'auto',
  THEMES: ['light', 'dark', 'auto'],
  STORAGE_KEY: 'quickchat_theme',
  SYSTEM_PREFERENCE_QUERY: '(prefers-color-scheme: dark)'
};

// Accessibility Configuration
export const A11Y_CONFIG = {
  SCREEN_READER_ANNOUNCEMENTS: true,
  KEYBOARD_NAVIGATION: true,
  HIGH_CONTRAST_SUPPORT: true,
  FOCUS_MANAGEMENT: true,
  ARIA_LIVE_REGIONS: true
};

// Internationalization Configuration
export const I18N_CONFIG = {
  DEFAULT_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'es', 'ar'],
  RTL_LOCALES: ['ar'],
  STORAGE_KEY: 'quickchat_locale',
  FALLBACK_LOCALE: 'en'
};

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
  VOICE: 'voice',
  SYSTEM: 'system',
  CALL_START: 'call_start',
  CALL_END: 'call_end'
};

// Call Types
export const CALL_TYPES = {
  AUDIO: 'audio',
  VIDEO: 'video',
  SCREEN_SHARE: 'screen_share'
};

// Connection States
export const CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
};

// User Roles
export const USER_ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Group Permissions
export const GROUP_PERMISSIONS = {
  READ: 'read',
  WRITE: 'write',
  INVITE: 'invite',
  MODERATE: 'moderate',
  ADMIN: 'admin'
};

// Event Types
export const EVENT_TYPES = {
  // Chat Events
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  
  // User Events
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
  
  // Call Events
  CALL_INCOMING: 'call:incoming',
  CALL_ACCEPTED: 'call:accepted',
  CALL_REJECTED: 'call:rejected',
  CALL_ENDED: 'call:ended',
  
  // System Events
  CONNECTION_CHANGED: 'connection:changed',
  ERROR_OCCURRED: 'error:occurred',
  NOTIFICATION_SHOW: 'notification:show',
  THEME_CHANGED: 'theme:changed',
  LOCALE_CHANGED: 'locale:changed'
};

// Error Codes
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  WEBRTC_ERROR: 'WEBRTC_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  MESSAGE_SENT: 'Message sent successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  CALL_STARTED: 'Call started',
  CALL_ENDED: 'Call ended',
  SETTINGS_SAVED: 'Settings saved successfully',
  PROFILE_UPDATED: 'Profile updated successfully'
};

// Feature Flags
export const FEATURE_FLAGS = {
  E2E_ENCRYPTION: true,
  GROUP_VIDEO_CALLS: true,
  CALL_RECORDING: true,
  AUTO_TRANSLATION: false,
  BIOMETRIC_AUTH: false,
  ADVANCED_MODERATION: true,
  ANALYTICS: true,
  PWA_FEATURES: true
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  VIRTUAL_SCROLL_ENABLED: true,
  LAZY_LOADING_ENABLED: true,
  IMAGE_OPTIMIZATION: true,
  BUNDLE_SPLITTING: true,
  SERVICE_WORKER_ENABLED: true,
  OFFLINE_SUPPORT: true
};

export default {
  API_CONFIG,
  WEBSOCKET_CONFIG,
  WEBRTC_CONFIG,
  CHAT_CONFIG,
  UI_CONFIG,
  THEME_CONFIG,
  A11Y_CONFIG,
  I18N_CONFIG,
  MESSAGE_TYPES,
  CALL_TYPES,
  CONNECTION_STATES,
  USER_ROLES,
  GROUP_PERMISSIONS,
  EVENT_TYPES,
  ERROR_CODES,
  SUCCESS_MESSAGES,
  FEATURE_FLAGS,
  PERFORMANCE_CONFIG
};
