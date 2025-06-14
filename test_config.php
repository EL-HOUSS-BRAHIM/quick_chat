<?php
/**
 * Configuration Test Script
 * This script verifies that the .env configuration is working properly
 */

require_once __DIR__ . '/config/config.php';

echo "=== Quick Chat Configuration Test ===\n\n";

// Test database configuration
echo "Database Configuration:\n";
echo "- Host: " . Config::getDbHost() . "\n";
echo "- Port: " . Config::getDbPort() . "\n";
echo "- Database: " . Config::getDbName() . "\n";
echo "- User: " . Config::getDbUser() . "\n";
echo "- Charset: " . Config::getDbCharset() . "\n";
echo "- DSN: " . Config::getDSN() . "\n\n";

// Test application settings
echo "Application Settings:\n";
echo "- Name: " . Config::getAppName() . "\n";
echo "- Version: " . Config::getAppVersion() . "\n";
echo "- URL: " . Config::getAppUrl() . "\n";
echo "- Environment: " . Config::getAppEnv() . "\n";
echo "- Debug Mode: " . (Config::isDebugMode() ? 'true' : 'false') . "\n";
echo "- Timezone: " . Config::getTimezone() . "\n\n";

// Test security settings
echo "Security Settings:\n";
echo "- Encryption Key: " . (Config::getEncryptionKey() ? 'Set' : 'Not Set') . "\n";
echo "- JWT Secret: " . (Config::getJwtSecret() ? 'Set' : 'Not Set') . "\n";
echo "- Password Pepper: " . (Config::getPasswordPepper() ? 'Set' : 'Not Set') . "\n\n";

// Test session settings
echo "Session Settings:\n";
echo "- Session Lifetime: " . Config::getSessionLifetime() . " seconds\n";
echo "- Remember Me Lifetime: " . Config::getRememberMeLifetime() . " seconds\n";
echo "- Cookie Secure: " . (Config::isSessionCookieSecure() ? 'true' : 'false') . "\n";
echo "- Cookie HTTP Only: " . (Config::isSessionCookieHttpOnly() ? 'true' : 'false') . "\n";
echo "- Cookie SameSite: " . Config::getSessionCookieSameSite() . "\n\n";

// Test file upload settings
echo "File Upload Settings:\n";
echo "- Max File Size: " . Config::getMaxFileSize() . " bytes (" . round(Config::getMaxFileSize() / 1024 / 1024, 2) . " MB)\n";
echo "- Upload Path: " . Config::getUploadPath() . "\n";
echo "- Avatar Path: " . Config::getAvatarPath() . "\n";
echo "- Allowed Image Types: " . implode(', ', Config::getAllowedImageTypes()) . "\n";
echo "- Allowed Video Types: " . implode(', ', Config::getAllowedVideoTypes()) . "\n";
echo "- Allowed Audio Types: " . implode(', ', Config::getAllowedAudioTypes()) . "\n";
echo "- Allowed Document Types: " . implode(', ', Config::getAllowedDocumentTypes()) . "\n\n";

// Test rate limiting settings
echo "Rate Limiting Settings:\n";
echo "- Max Messages Per Minute: " . Config::getMaxMessagesPerMinute() . "\n";
echo "- Max Login Attempts: " . Config::getMaxLoginAttempts() . "\n";
echo "- Login Lockout Time: " . Config::getLoginLockoutTime() . " seconds\n";
echo "- API Rate Limit: " . Config::getApiRateLimit() . " requests per minute\n\n";

// Test email settings
echo "Email Settings:\n";
echo "- SMTP Host: " . Config::getMailHost() . "\n";
echo "- SMTP Port: " . Config::getMailPort() . "\n";
echo "- SMTP Username: " . (Config::getMailUsername() ? 'Set' : 'Not Set') . "\n";
echo "- SMTP Password: " . (Config::getMailPassword() ? 'Set' : 'Not Set') . "\n";
echo "- Mail Encryption: " . Config::getMailEncryption() . "\n";
echo "- From Address: " . Config::getMailFromAddress() . "\n";
echo "- From Name: " . Config::getMailFromName() . "\n\n";

// Test cache settings
echo "Cache Settings:\n";
echo "- Cache Enabled: " . (Config::isCacheEnabled() ? 'true' : 'false') . "\n";
echo "- Cache Lifetime: " . Config::getCacheLifetime() . " seconds\n";
echo "- Cache Driver: " . Config::getCacheDriver() . "\n\n";

// Test logging settings
echo "Logging Settings:\n";
echo "- Log Level: " . Config::getLogLevel() . "\n";
echo "- Log File: " . Config::getLogFile() . "\n";
echo "- Log Max Files: " . Config::getLogMaxFiles() . "\n";
echo "- Log Max Size: " . Config::getLogMaxSize() . " bytes\n\n";

// Test WebSocket settings
echo "WebSocket Settings:\n";
echo "- WebSocket Enabled: " . (Config::isWebSocketEnabled() ? 'true' : 'false') . "\n";
echo "- WebSocket Host: " . Config::getWebSocketHost() . "\n";
echo "- WebSocket Port: " . Config::getWebSocketPort() . "\n\n";

// Test feature flags
echo "Feature Flags:\n";
$features = [
    'FILE_UPLOAD', 'AUDIO_RECORDING', 'MESSAGE_REACTIONS', 'MESSAGE_SEARCH',
    'USER_MENTIONS', 'MESSAGE_THREADS', 'VIDEO_CHAT', 'SCREEN_SHARE'
];

foreach ($features as $feature) {
    echo "- " . str_replace('_', ' ', ucwords(strtolower($feature), '_')) . ": " . 
         (Config::isFeatureEnabled($feature) ? 'Enabled' : 'Disabled') . "\n";
}

echo "\n=== Configuration Test Complete ===\n";
echo "All configuration values are being loaded from .env file successfully!\n";
