<?php
/**
 * Production Configuration Manager
 * Handles environment-specific configurations for Quick Chat
 */

class ProductionConfig {
    private static $instance = null;
    private $config = [];
    private $environment = 'development';
    
    private function __construct() {
        $this->detectEnvironment();
        $this->loadConfiguration();
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Detect the current environment
     */
    private function detectEnvironment() {
        // Check environment variable first
        $env = getenv('QUICK_CHAT_ENV');
        if ($env) {
            $this->environment = $env;
            return;
        }
        
        // Check for environment-specific files
        if (file_exists(__DIR__ . '/.env.production')) {
            $this->environment = 'production';
        } elseif (file_exists(__DIR__ . '/.env.staging')) {
            $this->environment = 'staging';
        } elseif (file_exists(__DIR__ . '/.env.development')) {
            $this->environment = 'development';
        }
        
        // Check server characteristics
        $serverName = $_SERVER['SERVER_NAME'] ?? '';
        if (strpos($serverName, 'localhost') !== false || 
            strpos($serverName, '127.0.0.1') !== false) {
            $this->environment = 'development';
        } elseif (strpos($serverName, 'staging') !== false || 
                  strpos($serverName, 'test') !== false) {
            $this->environment = 'staging';
        } else {
            $this->environment = 'production';
        }
    }
    
    /**
     * Load configuration based on environment
     */
    private function loadConfiguration() {
        // Load base configuration
        $this->config = $this->getBaseConfig();
        
        // Load environment-specific configuration
        $envConfig = $this->getEnvironmentConfig($this->environment);
        $this->config = array_merge_recursive($this->config, $envConfig);
        
        // Load secrets from environment variables
        $this->loadSecrets();
    }
    
    /**
     * Get base configuration shared across all environments
     */
    private function getBaseConfig() {
        return [
            'app' => [
                'name' => 'Quick Chat',
                'version' => '1.2.0',
                'timezone' => 'UTC',
                'charset' => 'UTF-8',
                'session_timeout' => 3600,
                'max_login_attempts' => 5,
                'login_lockout_time' => 900, // 15 minutes
            ],
            'database' => [
                'charset' => 'utf8mb4',
                'collation' => 'utf8mb4_unicode_ci',
                'pool_size' => 10,
                'timeout' => 30,
                'retry_attempts' => 3,
            ],
            'security' => [
                'password_min_length' => 8,
                'password_require_special' => true,
                'password_require_numbers' => true,
                'token_expiry' => 86400, // 24 hours
                'csrf_protection' => true,
                'secure_cookies' => true,
                'rate_limiting' => true,
            ],
            'file_upload' => [
                'allowed_types' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp3', 'mp4'],
                'virus_scan' => true,
                'image_compression' => true,
                'thumbnail_generation' => true,
            ],
            'api' => [
                'version' => 'v1',
                'rate_limit_default' => 100,
                'rate_limit_auth' => 10,
                'rate_limit_upload' => 20,
                'response_timeout' => 30,
            ],
            'webrtc' => [
                'ice_servers' => [
                    ['urls' => 'stun:stun.l.google.com:19302'],
                    ['urls' => 'stun:stun1.l.google.com:19302'],
                ],
                'connection_timeout' => 10000,
                'max_participants' => 8,
            ],
            'logging' => [
                'level' => 'info',
                'max_file_size' => '10MB',
                'max_files' => 5,
                'log_rotation' => true,
            ],
            'cache' => [
                'default_ttl' => 3600,
                'prefix' => 'quickchat_',
            ],
            'notifications' => [
                'email_enabled' => true,
                'push_enabled' => true,
                'sms_enabled' => false,
            ],
        ];
    }
    
    /**
     * Get environment-specific configuration
     */
    private function getEnvironmentConfig($environment) {
        switch ($environment) {
            case 'production':
                return $this->getProductionConfig();
            case 'staging':
                return $this->getStagingConfig();
            case 'development':
            default:
                return $this->getDevelopmentConfig();
        }
    }
    
    /**
     * Production environment configuration
     */
    private function getProductionConfig() {
        return [
            'app' => [
                'debug' => false,
                'error_reporting' => false,
                'display_errors' => false,
                'log_errors' => true,
            ],
            'database' => [
                'host' => getenv('DB_HOST') ?: 'localhost',
                'port' => getenv('DB_PORT') ?: 3306,
                'name' => getenv('DB_NAME') ?: 'quickchat_prod',
                'username' => getenv('DB_USER') ?: 'quickchat_user',
                'password' => getenv('DB_PASS') ?: '',
                'ssl' => true,
                'pool_size' => 20,
            ],
            'security' => [
                'https_only' => true,
                'hsts_enabled' => true,
                'csp_enabled' => true,
                'xss_protection' => true,
                'content_type_nosniff' => true,
                'referrer_policy' => 'strict-origin-when-cross-origin',
            ],
            'file_upload' => [
                'max_size_image' => 10 * 1024 * 1024, // 10MB
                'max_size_document' => 25 * 1024 * 1024, // 25MB
                'max_size_audio' => 50 * 1024 * 1024, // 50MB
                'max_size_video' => 100 * 1024 * 1024, // 100MB
                'storage_path' => '/var/www/uploads/',
                'cdn_enabled' => true,
                'cdn_url' => getenv('CDN_URL') ?: '',
            ],
            'api' => [
                'rate_limit_default' => 1000,
                'rate_limit_auth' => 50,
                'rate_limit_upload' => 100,
                'cors_enabled' => true,
                'cors_origins' => explode(',', getenv('ALLOWED_ORIGINS') ?: ''),
            ],
            'webrtc' => [
                'turn_servers' => [
                    [
                        'urls' => getenv('TURN_SERVER_URL') ?: 'turn:turn.example.com:3478',
                        'username' => getenv('TURN_USERNAME') ?: '',
                        'credential' => getenv('TURN_PASSWORD') ?: '',
                    ],
                ],
                'stun_servers' => [
                    ['urls' => 'stun:stun.example.com:19302'],
                ],
            ],
            'logging' => [
                'level' => 'warning',
                'handlers' => ['file', 'syslog', 'email'],
                'email_alerts' => true,
                'error_email' => getenv('ERROR_EMAIL') ?: 'admin@example.com',
            ],
            'cache' => [
                'driver' => 'redis',
                'redis_host' => getenv('REDIS_HOST') ?: 'localhost',
                'redis_port' => getenv('REDIS_PORT') ?: 6379,
                'redis_password' => getenv('REDIS_PASSWORD') ?: '',
                'redis_database' => 0,
            ],
            'email' => [
                'driver' => 'smtp',
                'smtp_host' => getenv('SMTP_HOST') ?: '',
                'smtp_port' => getenv('SMTP_PORT') ?: 587,
                'smtp_username' => getenv('SMTP_USERNAME') ?: '',
                'smtp_password' => getenv('SMTP_PASSWORD') ?: '',
                'smtp_encryption' => 'tls',
                'from_address' => getenv('MAIL_FROM_ADDRESS') ?: 'noreply@example.com',
                'from_name' => getenv('MAIL_FROM_NAME') ?: 'Quick Chat',
            ],
            'backup' => [
                'enabled' => true,
                'schedule' => '0 2 * * *', // Daily at 2 AM
                'retention_days' => 30,
                'storage_path' => '/var/backups/quickchat/',
                's3_enabled' => true,
                's3_bucket' => getenv('S3_BACKUP_BUCKET') ?: '',
                's3_region' => getenv('S3_BACKUP_REGION') ?: 'us-east-1',
            ],
            'monitoring' => [
                'enabled' => true,
                'apm_enabled' => true,
                'metrics_enabled' => true,
                'health_check_enabled' => true,
                'performance_monitoring' => true,
            ],
        ];
    }
    
    /**
     * Staging environment configuration
     */
    private function getStagingConfig() {
        return [
            'app' => [
                'debug' => true,
                'error_reporting' => true,
                'display_errors' => true,
                'log_errors' => true,
            ],
            'database' => [
                'host' => getenv('DB_HOST') ?: 'localhost',
                'port' => getenv('DB_PORT') ?: 3306,
                'name' => getenv('DB_NAME') ?: 'quickchat_staging',
                'username' => getenv('DB_USER') ?: 'quickchat_user',
                'password' => getenv('DB_PASS') ?: '',
                'ssl' => false,
                'pool_size' => 10,
            ],
            'security' => [
                'https_only' => false,
                'hsts_enabled' => false,
                'csp_enabled' => false,
            ],
            'file_upload' => [
                'max_size_image' => 5 * 1024 * 1024, // 5MB
                'max_size_document' => 10 * 1024 * 1024, // 10MB
                'storage_path' => '/var/www/uploads/',
                'cdn_enabled' => false,
            ],
            'api' => [
                'rate_limit_default' => 500,
                'rate_limit_auth' => 25,
                'rate_limit_upload' => 50,
            ],
            'logging' => [
                'level' => 'debug',
                'handlers' => ['file', 'console'],
                'email_alerts' => false,
            ],
            'cache' => [
                'driver' => 'file',
                'file_path' => '/tmp/quickchat_cache/',
            ],
            'email' => [
                'driver' => 'log',
                'log_file' => '/var/log/quickchat/emails.log',
            ],
            'backup' => [
                'enabled' => false,
            ],
            'monitoring' => [
                'enabled' => true,
                'apm_enabled' => false,
                'metrics_enabled' => true,
            ],
        ];
    }
    
    /**
     * Development environment configuration
     */
    private function getDevelopmentConfig() {
        return [
            'app' => [
                'debug' => true,
                'error_reporting' => true,
                'display_errors' => true,
                'log_errors' => true,
            ],
            'database' => [
                'host' => 'localhost',
                'port' => 3306,
                'name' => 'quickchat_dev',
                'username' => 'root',
                'password' => '',
                'ssl' => false,
                'pool_size' => 5,
            ],
            'security' => [
                'https_only' => false,
                'hsts_enabled' => false,
                'csp_enabled' => false,
                'rate_limiting' => false,
            ],
            'file_upload' => [
                'max_size_image' => 2 * 1024 * 1024, // 2MB
                'max_size_document' => 5 * 1024 * 1024, // 5MB
                'storage_path' => __DIR__ . '/../uploads/',
                'cdn_enabled' => false,
                'virus_scan' => false,
            ],
            'api' => [
                'rate_limit_default' => 10000,
                'rate_limit_auth' => 1000,
                'rate_limit_upload' => 1000,
                'cors_enabled' => true,
                'cors_origins' => ['*'],
            ],
            'logging' => [
                'level' => 'debug',
                'handlers' => ['file', 'console'],
                'email_alerts' => false,
            ],
            'cache' => [
                'driver' => 'array',
            ],
            'email' => [
                'driver' => 'log',
                'log_file' => __DIR__ . '/../logs/emails.log',
            ],
            'backup' => [
                'enabled' => false,
            ],
            'monitoring' => [
                'enabled' => false,
                'apm_enabled' => false,
                'metrics_enabled' => false,
            ],
        ];
    }
    
    /**
     * Load secrets from environment variables
     */
    private function loadSecrets() {
        $secrets = [
            'app.secret_key' => 'APP_SECRET_KEY',
            'jwt.secret' => 'JWT_SECRET',
            'encryption.key' => 'ENCRYPTION_KEY',
            'database.password' => 'DB_PASS',
            'email.smtp_password' => 'SMTP_PASSWORD',
            'webrtc.turn_secret' => 'TURN_SECRET',
            'aws.access_key_id' => 'AWS_ACCESS_KEY_ID',
            'aws.secret_access_key' => 'AWS_SECRET_ACCESS_KEY',
            'google.client_secret' => 'GOOGLE_CLIENT_SECRET',
            'push.vapid_private_key' => 'VAPID_PRIVATE_KEY',
        ];
        
        foreach ($secrets as $configKey => $envVar) {
            $value = getenv($envVar);
            if ($value !== false) {
                $this->setNestedValue($this->config, $configKey, $value);
            }
        }
    }
    
    /**
     * Set nested configuration value
     */
    private function setNestedValue(&$array, $key, $value) {
        $keys = explode('.', $key);
        $current = &$array;
        
        foreach ($keys as $k) {
            if (!isset($current[$k]) || !is_array($current[$k])) {
                $current[$k] = [];
            }
            $current = &$current[$k];
        }
        
        $current = $value;
    }
    
    /**
     * Get configuration value
     */
    public function get($key, $default = null) {
        $keys = explode('.', $key);
        $value = $this->config;
        
        foreach ($keys as $k) {
            if (!isset($value[$k])) {
                return $default;
            }
            $value = $value[$k];
        }
        
        return $value;
    }
    
    /**
     * Set configuration value
     */
    public function set($key, $value) {
        $this->setNestedValue($this->config, $key, $value);
    }
    
    /**
     * Get current environment
     */
    public function getEnvironment() {
        return $this->environment;
    }
    
    /**
     * Check if in production environment
     */
    public function isProduction() {
        return $this->environment === 'production';
    }
    
    /**
     * Check if in development environment
     */
    public function isDevelopment() {
        return $this->environment === 'development';
    }
    
    /**
     * Check if in staging environment
     */
    public function isStaging() {
        return $this->environment === 'staging';
    }
    
    /**
     * Get all configuration
     */
    public function all() {
        return $this->config;
    }
    
    /**
     * Validate configuration
     */
    public function validate() {
        $errors = [];
        
        // Required settings for production
        if ($this->isProduction()) {
            $required = [
                'app.secret_key',
                'jwt.secret',
                'database.password',
                'email.smtp_host',
                'email.smtp_username',
                'email.smtp_password',
            ];
            
            foreach ($required as $key) {
                if (empty($this->get($key))) {
                    $errors[] = "Required configuration missing: {$key}";
                }
            }
        }
        
        // Validate database connection
        if (!$this->validateDatabaseConnection()) {
            $errors[] = "Database connection failed";
        }
        
        // Validate file upload directory
        $uploadPath = $this->get('file_upload.storage_path');
        if (!is_dir($uploadPath) || !is_writable($uploadPath)) {
            $errors[] = "Upload directory not writable: {$uploadPath}";
        }
        
        return $errors;
    }
    
    /**
     * Validate database connection
     */
    private function validateDatabaseConnection() {
        try {
            $pdo = new PDO(
                "mysql:host={$this->get('database.host')};port={$this->get('database.port')};dbname={$this->get('database.name')}",
                $this->get('database.username'),
                $this->get('database.password'),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_TIMEOUT => 5,
                ]
            );
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }
    
    /**
     * Export configuration for other applications
     */
    public function export($format = 'php') {
        switch ($format) {
            case 'json':
                return json_encode($this->config, JSON_PRETTY_PRINT);
            case 'yaml':
                return yaml_emit($this->config);
            case 'php':
            default:
                return '<?php return ' . var_export($this->config, true) . ';';
        }
    }
    
    /**
     * Generate environment file template
     */
    public function generateEnvTemplate() {
        $template = "# Quick Chat Environment Configuration\n";
        $template .= "# Environment: {$this->environment}\n\n";
        
        $envVars = [
            'QUICK_CHAT_ENV' => $this->environment,
            'APP_SECRET_KEY' => 'your-secret-key-here',
            'JWT_SECRET' => 'your-jwt-secret-here',
            'ENCRYPTION_KEY' => 'your-encryption-key-here',
            'DB_HOST' => 'localhost',
            'DB_PORT' => '3306',
            'DB_NAME' => 'quickchat',
            'DB_USER' => 'quickchat_user',
            'DB_PASS' => 'your-database-password',
            'SMTP_HOST' => 'smtp.example.com',
            'SMTP_PORT' => '587',
            'SMTP_USERNAME' => 'your-smtp-username',
            'SMTP_PASSWORD' => 'your-smtp-password',
            'TURN_SERVER_URL' => 'turn:turn.example.com:3478',
            'TURN_USERNAME' => 'your-turn-username',
            'TURN_PASSWORD' => 'your-turn-password',
            'REDIS_HOST' => 'localhost',
            'REDIS_PORT' => '6379',
            'REDIS_PASSWORD' => 'your-redis-password',
            'CDN_URL' => 'https://cdn.example.com',
            'ALLOWED_ORIGINS' => 'https://example.com,https://app.example.com',
            'ERROR_EMAIL' => 'admin@example.com',
            'S3_BACKUP_BUCKET' => 'quickchat-backups',
            'S3_BACKUP_REGION' => 'us-east-1',
            'AWS_ACCESS_KEY_ID' => 'your-aws-access-key',
            'AWS_SECRET_ACCESS_KEY' => 'your-aws-secret-key',
            'VAPID_PRIVATE_KEY' => 'your-vapid-private-key',
        ];
        
        foreach ($envVars as $var => $value) {
            $template .= "{$var}={$value}\n";
        }
        
        return $template;
    }
}

// Global configuration helper function
function config($key = null, $default = null) {
    $config = ProductionConfig::getInstance();
    
    if ($key === null) {
        return $config;
    }
    
    return $config->get($key, $default);
}

// Initialize configuration
$config = ProductionConfig::getInstance();

// Validate configuration in production
if ($config->isProduction()) {
    $errors = $config->validate();
    if (!empty($errors)) {
        error_log('Configuration validation failed: ' . implode(', ', $errors));
        if ($config->get('app.debug')) {
            throw new Exception('Configuration validation failed: ' . implode(', ', $errors));
        }
    }
}
