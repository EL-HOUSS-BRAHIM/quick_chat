<?php
namespace QuickChat\Services;

/**
 * Session Service
 * 
 * Handles session management for the application
 */
class Session
{
    /**
     * Start the session
     */
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            // Set secure session settings
            ini_set('session.use_strict_mode', 1);
            ini_set('session.use_only_cookies', 1);
            ini_set('session.cookie_httponly', 1);
            
            // Use secure cookies in production
            if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production') {
                ini_set('session.cookie_secure', 1);
                ini_set('session.cookie_samesite', 'Lax');
            }
            
            // Start the session
            session_start();
        }
    }
    
    /**
     * Get a value from the session
     * 
     * @param string $key The session key
     * @param mixed $default The default value if key doesn't exist
     * @return mixed The session value
     */
    public static function get(string $key, $default = null)
    {
        return $_SESSION[$key] ?? $default;
    }
    
    /**
     * Set a value in the session
     * 
     * @param string $key The session key
     * @param mixed $value The value to store
     */
    public static function set(string $key, $value): void
    {
        $_SESSION[$key] = $value;
    }
    
    /**
     * Check if a key exists in the session
     * 
     * @param string $key The session key
     * @return bool True if key exists
     */
    public static function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }
    
    /**
     * Remove a value from the session
     * 
     * @param string $key The session key
     */
    public static function remove(string $key): void
    {
        if (isset($_SESSION[$key])) {
            unset($_SESSION[$key]);
        }
    }
    
    /**
     * Clear all session data
     */
    public static function clear(): void
    {
        session_unset();
    }
    
    /**
     * Destroy the session
     */
    public static function destroy(): void
    {
        session_destroy();
    }
    
    /**
     * Regenerate the session ID
     * 
     * @param bool $deleteOldSession Whether to delete the old session data
     */
    public static function regenerate(bool $deleteOldSession = true): void
    {
        session_regenerate_id($deleteOldSession);
    }
    
    /**
     * Set a flash message
     * 
     * @param string $key The flash key
     * @param mixed $value The flash value
     */
    public static function flash(string $key, $value): void
    {
        $_SESSION['_flash'][$key] = $value;
    }
    
    /**
     * Get a flash message
     * 
     * @param string $key The flash key
     * @param mixed $default The default value if key doesn't exist
     * @return mixed The flash value
     */
    public static function getFlash(string $key, $default = null)
    {
        $value = $_SESSION['_flash'][$key] ?? $default;
        
        if (isset($_SESSION['_flash'][$key])) {
            unset($_SESSION['_flash'][$key]);
        }
        
        return $value;
    }
}
