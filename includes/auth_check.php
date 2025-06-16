<?php
// Central authentication check for all protected pages
// Include this file at the top of any page that requires authentication

// Load configuration and start session if not already started
require_once __DIR__ . '/../config/config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Security.php';

class AuthChecker {
    private static $user = null;
    private static $security = null;
    private static $currentUser = null;
    
    public static function init() {
        self::$user = new User();
        self::$security = new Security();
    }
    
    public static function requireAuth($redirectTo = 'auth.php') {
        self::init();
        
        if (!self::isAuthenticated()) {
            // Store the requested page for redirect after login
            $_SESSION['redirect_after_login'] = $_SERVER['REQUEST_URI'];
            header('Location: ' . $redirectTo);
            exit();
        }
        
        return self::getCurrentUser();
    }
    
    public static function isAuthenticated() {
        if (self::$user === null) {
            self::init();
        }
        
        // Check if user has valid session
        $isLoggedIn = isset($_SESSION['user_id']) && isset($_SESSION['session_id']);
        
        if (!$isLoggedIn) {
            return false;
        }
        
        // Validate session against database
        try {
            $session = self::$user->validateSession($_SESSION['session_id']);
            
            if (!$session || $session['user_id'] != $_SESSION['user_id']) {
                // Invalid session, clear it
                self::clearSession();
                return false;
            }
            
            // Update user activity
            self::$user->updateLastSeen($_SESSION['user_id']);
            self::$user->setOnlineStatus($_SESSION['user_id'], true);
            
            return true;
            
        } catch (Exception $e) {
            error_log('Session validation error: ' . $e->getMessage());
            self::clearSession();
            return false;
        }
    }
    
    public static function getCurrentUser() {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }
        
        if (!self::isAuthenticated()) {
            return null;
        }
        
        try {
            self::$currentUser = self::$user->getUserById($_SESSION['user_id']);
            return self::$currentUser;
        } catch (Exception $e) {
            error_log('Error getting current user: ' . $e->getMessage());
            return null;
        }
    }
    
    public static function logout() {
        self::init();
        
        $sessionId = $_SESSION['session_id'] ?? null;
        
        if ($sessionId) {
            try {
                self::$user->logout($sessionId);
            } catch (Exception $e) {
                error_log('Error during logout: ' . $e->getMessage());
            }
        }
        
        self::clearSession();
    }
    
    public static function getCSRFToken() {
        if (self::$security === null) {
            self::init();
        }
        
        return self::$security->generateCSRF();
    }
    
    public static function validateCSRF($token) {
        if (self::$security === null) {
            self::init();
        }
        
        return self::$security->validateCSRF($token);
    }
    
    private static function clearSession() {
        session_unset();
        session_destroy();
        
        // Start a new session for CSRF tokens
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        self::$currentUser = null;
    }
    
    public static function redirectAfterLogin($defaultPage = 'dashboard.php') {
        $redirectTo = $_SESSION['redirect_after_login'] ?? $defaultPage;
        unset($_SESSION['redirect_after_login']);
        
        header('Location: ' . $redirectTo);
        exit();
    }
    
    public static function hasRole($role) {
        $user = self::getCurrentUser();
        return $user && isset($user['role']) && $user['role'] === $role;
    }
    
    public static function requireRole($role, $redirectTo = 'dashboard.php') {
        self::requireAuth();
        
        if (!self::hasRole($role)) {
            header('Location: ' . $redirectTo);
            exit();
        }
        
        return self::getCurrentUser();
    }
}
?>
