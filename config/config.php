<?php
require_once __DIR__ . '/../classes/Env.php';

// Load environment variables
Env::load();

// Validate required environment variables
Env::required([
    'DB_HOST', 'DB_NAME', 'DB_USER', 'ENCRYPTION_KEY', 'JWT_SECRET', 'PASSWORD_PEPPER'
]);

// Configuration class using environment variables
class Config {
    // Database settings
    public static function getDbHost() { return Env::get('DB_HOST', 'localhost'); }
    public static function getDbPort() { return Env::int('DB_PORT', 3306); }
    public static function getDbName() { return Env::get('DB_NAME'); }
    public static function getDbUser() { return Env::get('DB_USER'); }
    public static function getDbPass() { return Env::get('DB_PASS', ''); }
    public static function getDbCharset() { return Env::get('DB_CHARSET', 'utf8mb4'); }
    public static function isDbSslEnabled() { return Env::bool('DB_SSL_ENABLED', false); }
    public static function getDbSslCaPath() { return Env::get('DB_SSL_CA_PATH', '.cert/ca.pem'); }
    
    // Security settings
    public static function getEncryptionKey() { return Env::get('ENCRYPTION_KEY'); }
    public static function getJwtSecret() { return Env::get('JWT_SECRET'); }
    public static function getPasswordPepper() { return Env::get('PASSWORD_PEPPER'); }
    
    // Session settings
    public static function getSessionLifetime() { return Env::int('SESSION_LIFETIME', 3600); }
    public static function getSessionTimeout() { return Env::int('SESSION_TIMEOUT', 3600); }
    public static function getRememberMeLifetime() { return Env::int('REMEMBER_ME_LIFETIME', 2592000); }
    public static function isSessionCookieSecure() { return Env::bool('SESSION_COOKIE_SECURE', false); }
    public static function isSessionCookieHttpOnly() { return Env::bool('SESSION_COOKIE_HTTPONLY', true); }
    public static function getSessionCookieSameSite() { return Env::get('SESSION_COOKIE_SAMESITE', 'Strict'); }
    
    // Google SSO settings
    public static function getGoogleClientId() { return Env::get('GOOGLE_CLIENT_ID'); }
    public static function getGoogleClientSecret() { return Env::get('GOOGLE_CLIENT_SECRET'); }
    public static function isGoogleSSOEnabled() { return !empty(self::getGoogleClientId()) && !empty(self::getGoogleClientSecret()); }
    
    // Facebook SSO settings
    public static function getFacebookClientId() { return Env::get('FACEBOOK_CLIENT_ID'); }
    public static function getFacebookClientSecret() { return Env::get('FACEBOOK_CLIENT_SECRET'); }
    public static function isFacebookSSOEnabled() { return !empty(self::getFacebookClientId()) && !empty(self::getFacebookClientSecret()); }
    
    // File upload settings
    public static function getMaxFileSize() { return Env::int('MAX_FILE_SIZE', 10485760); }
    public static function getAllowedImageTypes() { 
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; 
    }
    public static function getAllowedVideoTypes() { 
        return ['video/mp4', 'video/webm', 'video/ogg']; 
    }
    public static function getAllowedAudioTypes() { 
        return ['audio/mp3', 'audio/ogg', 'audio/wav', 'audio/m4a']; 
    }
    public static function getAllowedDocumentTypes() { 
        return ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']; 
    }
    
    // Rate limiting settings
    public static function getMaxMessagesPerMinute() { return Env::int('MAX_MESSAGES_PER_MINUTE', 30); }
    public static function getMaxLoginAttempts() { return Env::int('MAX_LOGIN_ATTEMPTS', 5); }
    public static function getLoginLockoutTime() { return Env::int('LOGIN_LOCKOUT_TIME', 900); }
    public static function getApiRateLimit() { return Env::int('API_RATE_LIMIT', 100); }
    
    // Application settings
    public static function getAppName() { return Env::get('APP_NAME', 'Quick Chat'); }
    public static function getAppVersion() { return Env::get('APP_VERSION', '2.0.0'); }
    public static function getAppUrl() { return Env::get('APP_URL', 'http://localhost'); }
    public static function getAppEnv() { return Env::get('APP_ENV', 'production'); }
    public static function getTimezone() { return Env::get('APP_TIMEZONE', 'UTC'); }
    
    // Email settings
    public static function getMailHost() { return Env::get('MAIL_HOST', 'smtp.gmail.com'); }
    public static function getMailPort() { return Env::int('MAIL_PORT', 587); }
    public static function getMailUsername() { return Env::get('MAIL_USERNAME'); }
    public static function getMailPassword() { return Env::get('MAIL_PASSWORD'); }
    public static function getMailEncryption() { return Env::get('MAIL_ENCRYPTION', 'tls'); }
    public static function getMailFromAddress() { return Env::get('MAIL_FROM_ADDRESS', 'noreply@quickchat.com'); }
    public static function getMailFromName() { return Env::get('MAIL_FROM_NAME', 'Quick Chat'); }
    
    // WebSocket settings
    public static function getWebSocketHost() { return Env::get('WEBSOCKET_HOST', 'localhost'); }
    public static function getWebSocketPort() { return Env::int('WEBSOCKET_PORT', 8080); }
    public static function isWebSocketEnabled() { return Env::bool('WEBSOCKET_ENABLED', false); }
    
    // TURN server settings
    public static function getTurnSecret() { return Env::get('TURN_SECRET', 'default-turn-secret-change-in-production'); }
    public static function getTurnServers() { 
        return [
            'turn:' . Env::get('TURN_HOST', 'turn.quickchat.local') . ':3478',
            'turns:' . Env::get('TURN_HOST', 'turn.quickchat.local') . ':5349'
        ];
    }
    
    // Redis settings
    public static function isRedisEnabled() { return Env::bool('REDIS_ENABLED', false); }
    public static function getRedisHost() { return Env::get('REDIS_HOST', 'localhost'); }
    public static function getRedisPort() { return Env::int('REDIS_PORT', 6379); }
    public static function getRedisPassword() { return Env::get('REDIS_PASSWORD', ''); }
    public static function getRedisDatabase() { return Env::int('REDIS_DATABASE', 0); }
    
    // Cache settings
    public static function isCacheEnabled() { return Env::bool('CACHE_ENABLED', true); }
    public static function getCacheLifetime() { return Env::int('CACHE_LIFETIME', 3600); }
    public static function getCacheDriver() { return Env::get('CACHE_DRIVER', 'file'); }
    
    // Security settings
    public static function isCsrfEnabled() { return Env::bool('CSRF_ENABLED', true); }
    public static function isRateLimitingEnabled() { return Env::bool('RATE_LIMITING_ENABLED', true); }
    public static function isSecurityHeadersEnabled() { return Env::bool('SECURITY_HEADERS_ENABLED', true); }
    public static function isAuditLoggingEnabled() { return Env::bool('AUDIT_LOGGING_ENABLED', true); }
    
    // Logging
    public static function getLogLevel() { return Env::get('LOG_LEVEL', 'INFO'); }
    public static function getLogFile() { return Env::get('LOG_FILE', __DIR__ . '/../logs/app.log'); }
    public static function getLogMaxFiles() { return Env::int('LOG_MAX_FILES', 10); }
    public static function getLogMaxSize() { return Env::int('LOG_MAX_SIZE', 10485760); }
    
    // Feature flags
    public static function isFeatureEnabled($feature) {
        return Env::bool("FEATURE_{$feature}", false);
    }
    
    // File paths
    public static function getUploadPath() { 
        return rtrim(__DIR__ . '/../' . trim(Env::get('UPLOAD_PATH', 'uploads/'), '/'), '/') . '/';
    }
    
    public static function getAvatarPath() { 
        return rtrim(__DIR__ . '/../' . trim(Env::get('AVATAR_PATH', 'uploads/avatars/'), '/'), '/') . '/';
    }
    
    // Site URL and application settings
    public static function getSiteUrl() { 
        $siteUrl = Env::get('SITE_URL');
        if ($siteUrl) {
            return rtrim($siteUrl, '/');
        }
        
        // Auto-detect site URL if not set
        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $path = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        
        return $protocol . '://' . $host . ($path !== '/' ? $path : '');
    }
    
    // Debug and environment settings
    public static function isDebugMode() { 
        return Env::bool('APP_DEBUG', false);
    }
    
    public static function isDevelopment() { 
        return self::getAppEnv() === 'development';
    }
    
    public static function isProduction() { 
        return self::getAppEnv() === 'production';
    }
    
    // Database connection string
    public static function getDSN() {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            self::getDbHost(),
            self::getDbPort(),
            self::getDbName(),
            self::getDbCharset()
        );
        
        return $dsn;
    }
    
    // API constants
    public static function getApiKeyLength() {
        return Env::int('API_KEY_LENGTH', 32);
    }
    
    // File deduplication settings
    public static function isDeduplicationEnabled() {
        return Env::bool('FILE_DEDUPLICATION_ENABLED', false);
    }
    
    // Backup settings
    public static function getBackupStoragePath() {
        return rtrim(__DIR__ . '/../' . trim(Env::get('BACKUP_PATH', 'backups/'), '/'), '/') . '/';
    }
    
    public static function isS3BackupEnabled() {
        return Env::bool('S3_BACKUP_ENABLED', false);
    }
    
    public static function getS3BackupBucket() {
        return Env::get('S3_BACKUP_BUCKET');
    }
    
    public static function getS3BackupRegion() {
        return Env::get('S3_BACKUP_REGION', 'us-east-1');
    }
    
    public static function getS3BackupKey() {
        return Env::get('S3_BACKUP_KEY');
    }
    
    public static function getS3BackupSecret() {
        return Env::get('S3_BACKUP_SECRET');
    }
}

// Initialize error reporting based on debug mode
if (Config::isDebugMode()) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('log_errors', 1);
    ini_set('error_log', Config::getLogFile());
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('error_log', Config::getLogFile());
}

// Set timezone
date_default_timezone_set(Config::getTimezone());

// Configure session settings BEFORE any session_start() calls
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', Config::isSessionCookieHttpOnly() ? 1 : 0);
    ini_set('session.cookie_secure', Config::isSessionCookieSecure() ? 1 : 0);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_samesite', Config::getSessionCookieSameSite());
    ini_set('session.gc_maxlifetime', Config::getSessionLifetime());
}

// Set upload limits
ini_set('upload_max_filesize', Config::getMaxFileSize());
ini_set('post_max_size', Config::getMaxFileSize() * 2);

// Create necessary directories
$uploadPath = Config::getUploadPath();
if (!is_dir($uploadPath)) {
    mkdir($uploadPath, 0755, true);
}

$avatarPath = Config::getAvatarPath();
if (!is_dir($avatarPath)) {
    mkdir($avatarPath, 0755, true);
}

$logDir = dirname(Config::getLogFile());
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
?>
