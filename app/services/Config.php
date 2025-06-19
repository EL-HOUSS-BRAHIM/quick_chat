<?php
namespace QuickChat\Services;

/**
 * Config Service
 * 
 * Handles application configuration
 */
class Config
{
    /**
     * @var array
     */
    private static $config = [];
    
    /**
     * Initialize the configuration
     */
    public static function init(): void
    {
        // Load the configuration file
        $configPath = defined('APP_ROOT') ? APP_ROOT . '/config/config.php' : __DIR__ . '/../../config/config.php';
        
        if (file_exists($configPath)) {
            self::$config = require $configPath;
        }
        
        // Override with environment-specific config if exists
        $envConfig = isset($_ENV['APP_ENV']) ? $_ENV['APP_ENV'] : 'development';
        $envConfigPath = defined('APP_ROOT') ? APP_ROOT . "/config/{$envConfig}.php" : __DIR__ . "/../../config/{$envConfig}.php";
        
        if (file_exists($envConfigPath)) {
            self::$config = array_merge(self::$config, require $envConfigPath);
        }
    }
    
    /**
     * Get a configuration value
     * 
     * @param string $key The configuration key (dot notation supported)
     * @param mixed $default The default value if key doesn't exist
     * @return mixed The configuration value
     */
    public static function get(string $key, $default = null)
    {
        // Ensure config is loaded
        if (empty(self::$config)) {
            self::init();
        }
        
        // Handle dot notation
        if (strpos($key, '.') !== false) {
            $parts = explode('.', $key);
            $value = self::$config;
            
            foreach ($parts as $part) {
                if (!isset($value[$part])) {
                    return $default;
                }
                
                $value = $value[$part];
            }
            
            return $value;
        }
        
        return self::$config[$key] ?? $default;
    }
    
    /**
     * Set a configuration value
     * 
     * @param string $key The configuration key
     * @param mixed $value The value to set
     */
    public static function set(string $key, $value): void
    {
        // Ensure config is loaded
        if (empty(self::$config)) {
            self::init();
        }
        
        // Handle dot notation
        if (strpos($key, '.') !== false) {
            $parts = explode('.', $key);
            $reference = &self::$config;
            
            foreach ($parts as $i => $part) {
                // Create array if it doesn't exist
                if (!isset($reference[$part])) {
                    $reference[$part] = [];
                }
                
                // If last part, set the value
                if ($i === count($parts) - 1) {
                    $reference[$part] = $value;
                } else {
                    $reference = &$reference[$part];
                }
            }
            
            return;
        }
        
        self::$config[$key] = $value;
    }
    
    /**
     * Check if a configuration key exists
     * 
     * @param string $key The configuration key
     * @return bool True if key exists
     */
    public static function has(string $key): bool
    {
        // Ensure config is loaded
        if (empty(self::$config)) {
            self::init();
        }
        
        // Handle dot notation
        if (strpos($key, '.') !== false) {
            $parts = explode('.', $key);
            $value = self::$config;
            
            foreach ($parts as $part) {
                if (!isset($value[$part])) {
                    return false;
                }
                
                $value = $value[$part];
            }
            
            return true;
        }
        
        return isset(self::$config[$key]);
    }
    
    /**
     * Get all configuration values
     * 
     * @return array The configuration array
     */
    public static function all(): array
    {
        // Ensure config is loaded
        if (empty(self::$config)) {
            self::init();
        }
        
        return self::$config;
    }
}
