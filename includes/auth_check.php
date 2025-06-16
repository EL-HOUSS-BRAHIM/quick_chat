<?php
/**
 * Authentication Checker Class
 * Handles user authentication, session management, and role-based access control
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Security.php';

class AuthChecker {
    private static $security;
    
    private static function getSecurity() {
        if (self::$security === null) {
            self::$security = new Security();
        }
        return self::$security;
    }
    
    /**
     * Check if user is authenticated
     */
    public static function isAuthenticated() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        return isset($_SESSION['user_id']) && 
               isset($_SESSION['user_authenticated']) && 
               $_SESSION['user_authenticated'] === true;
    }
    
    /**
     * Require authentication, redirect if not authenticated
     */
    public static function requireAuth($redirectTo = 'auth.php') {
        if (!self::isAuthenticated()) {
            header('Location: ' . $redirectTo);
            exit();
        }
        
        return self::getCurrentUser();
    }
    
    /**
     * Require specific role, redirect if not authorized
     */
    public static function requireRole($role, $redirectTo = 'dashboard.php') {
        $user = self::requireAuth();
        
        if (!self::hasRole($user, $role)) {
            header('Location: ' . $redirectTo . '?error=insufficient_permissions');
            exit();
        }
        
        return $user;
    }
    
    /**
     * Check if user has specific role
     */
    public static function hasRole($user, $role) {
        if (is_array($user) && isset($user['role'])) {
            return $user['role'] === $role;
        }
        return false;
    }
    
    /**
     * Get current authenticated user
     */
    public static function getCurrentUser() {
        if (!self::isAuthenticated()) {
            return null;
        }
        
        try {
            $userClass = new User();
            return $userClass->getUserById($_SESSION['user_id']);
        } catch (Exception $e) {
            // If user not found, clear session
            self::logout();
            return null;
        }
    }
    
    /**
     * Login user
     */
    public static function login($userId, $userData = null) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Regenerate session ID for security
        session_regenerate_id(true);
        
        $_SESSION['user_id'] = $userId;
        $_SESSION['user_authenticated'] = true;
        $_SESSION['login_time'] = time();
        
        if ($userData) {
            $_SESSION['user_data'] = $userData;
        }
        
        // Update last login time
        try {
            $userClass = new User();
            $userClass->updateLastLogin($userId);
        } catch (Exception $e) {
            error_log("Failed to update last login: " . $e->getMessage());
        }
        
        return true;
    }
    
    /**
     * Logout user
     */
    public static function logout() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Clear all session variables
        $_SESSION = array();
        
        // Destroy session cookie
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        
        // Destroy session
        session_destroy();
        
        return true;
    }
    
    /**
     * Generate CSRF token
     */
    public static function getCSRFToken() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        return self::getSecurity()->generateCSRF();
    }
    
    /**
     * Validate CSRF token
     */
    public static function validateCSRF($token) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        return self::getSecurity()->validateCSRF($token);
    }
    
    /**
     * Check if session is expired
     */
    public static function isSessionExpired() {
        if (!self::isAuthenticated()) {
            return true;
        }
        
        $loginTime = $_SESSION['login_time'] ?? 0;
        $sessionTimeout = Config::getSessionTimeout();
        
        return (time() - $loginTime) > $sessionTimeout;
    }
    
    /**
     * Refresh session
     */
    public static function refreshSession() {
        if (self::isAuthenticated()) {
            $_SESSION['login_time'] = time();
            return true;
        }
        return false;
    }
}
