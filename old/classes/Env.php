<?php
/**
 * Environment Configuration Loader
 * Loads and manages environment variables from .env file
 */

class Env {
    private static $loaded = false;
    private static $variables = [];
    
    /**
     * Load environment variables from .env file
     */
    public static function load($path = null) {
        if (self::$loaded) {
            return;
        }
        
        $path = $path ?: __DIR__ . '/../.env';
        
        if (!file_exists($path)) {
            throw new Exception(".env file not found at: $path");
        }
        
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            // Parse key=value pairs
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                
                // Remove quotes if present
                if (preg_match('/^["\'](.*)["\']\s*$/', $value, $matches)) {
                    $value = $matches[1];
                }
                
                // Convert boolean strings
                if (strtolower($value) === 'true') {
                    $value = true;
                } elseif (strtolower($value) === 'false') {
                    $value = false;
                } elseif (strtolower($value) === 'null') {
                    $value = null;
                } elseif (is_numeric($value)) {
                    $value = strpos($value, '.') !== false ? (float)$value : (int)$value;
                }
                
                self::$variables[$key] = $value;
                
                // Set as environment variable if not already set
                if (!isset($_ENV[$key])) {
                    $_ENV[$key] = $value;
                    putenv("$key=$value");
                }
            }
        }
        
        self::$loaded = true;
    }
    
    /**
     * Get environment variable value
     */
    public static function get($key, $default = null) {
        self::load();
        
        // Check if variable exists in our loaded variables
        if (isset(self::$variables[$key])) {
            return self::$variables[$key];
        }
        
        // Check PHP's environment variables
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }
        
        // Check $_ENV superglobal
        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }
        
        return $default;
    }
    
    /**
     * Set environment variable
     */
    public static function set($key, $value) {
        self::$variables[$key] = $value;
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
    
    /**
     * Check if environment variable exists
     */
    public static function has($key) {
        self::load();
        return isset(self::$variables[$key]) || getenv($key) !== false || isset($_ENV[$key]);
    }
    
    /**
     * Get all environment variables
     */
    public static function all() {
        self::load();
        return array_merge($_ENV, self::$variables);
    }
    
    /**
     * Get environment variable as boolean
     */
    public static function bool($key, $default = false) {
        $value = self::get($key, $default);
        
        if (is_bool($value)) {
            return $value;
        }
        
        if (is_string($value)) {
            $value = strtolower(trim($value));
            return in_array($value, ['true', '1', 'yes', 'on']);
        }
        
        return (bool)$value;
    }
    
    /**
     * Get environment variable as integer
     */
    public static function int($key, $default = 0) {
        return (int)self::get($key, $default);
    }
    
    /**
     * Get environment variable as float
     */
    public static function float($key, $default = 0.0) {
        return (float)self::get($key, $default);
    }
    
    /**
     * Get environment variable as array (comma-separated values)
     */
    public static function array($key, $default = []) {
        $value = self::get($key);
        
        if ($value === null) {
            return $default;
        }
        
        if (is_array($value)) {
            return $value;
        }
        
        return array_map('trim', explode(',', $value));
    }
    
    /**
     * Validate required environment variables
     */
    public static function required(array $keys) {
        $missing = [];
        
        foreach ($keys as $key) {
            if (!self::has($key) || self::get($key) === '') {
                $missing[] = $key;
            }
        }
        
        if (!empty($missing)) {
            throw new Exception('Missing required environment variables: ' . implode(', ', $missing));
        }
    }
    
    /**
     * Reload environment variables
     */
    public static function reload($path = null) {
        self::$loaded = false;
        self::$variables = [];
        self::load($path);
    }
}
?>
