<?php
// Suppress output and start clean buffer
ob_start();

// Load configuration first (which sets session settings)
require_once __DIR__ . '/../config/config.php';

// Start session after configuration is loaded
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Security.php';

class AuthAPI {
    private $user;
    private $security;
    
    public function __construct() {
        $this->user = new User();
        $this->security = new Security();
    }
    
    public function handleRequest() {
        try {
            // Clear any output that might have been generated
            if (ob_get_level()) {
                ob_clean();
            }
            
            $method = $_SERVER['REQUEST_METHOD'];
            
            // Allow GET requests for session checking
            if (!in_array($method, ['POST', 'GET'])) {
                throw new Exception('Method not allowed', 405);
            }
            
            $action = $_POST['action'] ?? $_GET['action'] ?? '';
            
            // CSRF protection for state-changing operations
            if (in_array($action, ['login', 'register', 'reset_password', 'change_password'])) {
                if (!$this->security->validateCSRF($_POST['csrf_token'] ?? '')) {
                    throw new Exception('Invalid CSRF token', 403);
                }
            }
            
            // Rate limiting
            $clientId = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $this->security->rateLimitCheck($clientId, 'auth_api', Config::getApiRateLimit(), 60);
            
            // Detect suspicious activity
            $suspiciousActivity = $this->security->detectSuspiciousActivity();
            if ($suspiciousActivity['suspicious']) {
                $this->security->logSecurityEvent('suspicious_auth_attempt', $suspiciousActivity);
                throw new Exception('Access denied due to suspicious activity', 429);
            }
            
            switch ($action) {
                case 'test':
                    $this->sendResponse([
                        'success' => true,
                        'message' => 'API is working',
                        'timestamp' => date('c')
                    ]);
                    break;
                    
                case 'login':
                    return $this->login();
                    
                case 'register':
                    return $this->register();
                    
                case 'logout':
                    return $this->logout();
                    
                case 'reset_password':
                    return $this->resetPassword();
                    
                case 'change_password':
                    return $this->changePassword();
                    
                case 'verify_email':
                    return $this->verifyEmail();
                    
                case 'refresh_session':
                    return $this->refreshSession();
                    
                case 'check_session':
                    return $this->checkSession();
                    
                case 'get_csrf_token':
                    return $this->getCSRFToken();
                    
                default:
                    throw new Exception('Invalid action', 400);
            }
            
        } catch (Exception $e) {
            $this->sendError($e->getMessage(), $e->getCode() ?: 400);
        }
    }
    
    private function login() {
        $username = $this->security->sanitizeInput($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $rememberMe = isset($_POST['remember_me']);
        
        if (empty($username) || empty($password)) {
            throw new Exception('Username and password are required');
        }
        
        // Honeypot check
        if (!$this->security->checkHoneypot($_POST['honeypot'] ?? '')) {
            $this->security->logSecurityEvent('honeypot_triggered', ['username' => $username]);
            throw new Exception('Invalid request');
        }
        
        error_log('=== Login Debug ===');
        error_log('Attempting login for username: ' . $username);
        error_log('POST data: ' . json_encode($_POST));
        error_log('Session data before login: ' . json_encode($_SESSION));
        
        try {
            $result = $this->user->login($username, $password, $rememberMe);
            error_log('Login result: ' . json_encode($result));
        } catch (Exception $e) {
            error_log('User login failed: ' . $e->getMessage());
            throw $e;
        }
        
        $_SESSION['user_id'] = $result['user_id'];
        $_SESSION['username'] = $result['username'];
        $_SESSION['session_id'] = $result['session_id'];
        
        error_log('Session set - User ID: ' . $_SESSION['user_id'] . ', Session ID: ' . $_SESSION['session_id']);
        
        // Generate a new CSRF token for the logged in session
        $newCSRFToken = $this->security->generateCSRF();
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => $result['user_id'],
                'username' => $result['username'],
                'display_name' => $result['display_name']
            ],
            'csrf_token' => $newCSRFToken
        ]);
    }
    
    private function register() {
        $username = $this->security->sanitizeInput($_POST['username'] ?? '');
        $email = $this->security->sanitizeInput($_POST['email'] ?? '');
        $password = $_POST['password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';
        $termsAccepted = isset($_POST['terms']);
        
        if (empty($username) || empty($email) || empty($password)) {
            throw new Exception('All fields are required');
        }
        
        if ($password !== $confirmPassword) {
            throw new Exception('Passwords do not match');
        }
        
        if (!$termsAccepted) {
            throw new Exception('You must accept the terms of service');
        }
        
        // Honeypot check
        if (!$this->security->checkHoneypot($_POST['honeypot'] ?? '')) {
            $this->security->logSecurityEvent('honeypot_triggered', ['username' => $username]);
            throw new Exception('Invalid request');
        }
        
        $userId = $this->user->register($username, $email, $password);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Registration successful! Please check your email to verify your account.',
            'user_id' => $userId
        ]);
    }
    
    private function logout() {
        $sessionId = $_SESSION['session_id'] ?? null;
        
        if ($sessionId) {
            $this->user->logout($sessionId);
        }
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Logout successful',
            'redirect' => 'index.php'
        ]);
    }
    
    private function resetPassword() {
        $email = $this->security->sanitizeInput($_POST['email'] ?? '');
        
        if (empty($email)) {
            throw new Exception('Email is required');
        }
        
        $this->user->resetPassword($email);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'If an account with this email exists, a password reset link has been sent.'
        ]);
    }
    
    private function changePassword() {
        if (!isset($_SESSION['user_id'])) {
            throw new Exception('Not authenticated', 401);
        }
        
        $oldPassword = $_POST['old_password'] ?? '';
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';
        
        if (empty($oldPassword) || empty($newPassword)) {
            throw new Exception('All password fields are required');
        }
        
        if ($newPassword !== $confirmPassword) {
            throw new Exception('New passwords do not match');
        }
        
        $this->user->changePassword($_SESSION['user_id'], $oldPassword, $newPassword);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Password changed successfully'
        ]);
    }
    
    private function verifyEmail() {
        $token = $_GET['token'] ?? '';
        
        if (empty($token)) {
            throw new Exception('Verification token is required');
        }
        
        // Implementation would verify the token and mark email as verified
        // This is a placeholder
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Email verified successfully',
            'redirect' => 'index.php'
        ]);
    }
    
    private function refreshSession() {
        if (!isset($_SESSION['user_id'])) {
            throw new Exception('Not authenticated', 401);
        }
        
        $user = $this->user->getUserById($_SESSION['user_id']);
        if (!$user) {
            throw new Exception('User not found', 404);
        }
        
        // Update last seen
        $this->user->updateLastSeen($_SESSION['user_id']);
        
        $this->sendResponse([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'username' => $user['username'],
                'display_name' => $user['display_name'],
                'avatar' => $user['avatar'],
                'last_seen' => $user['last_seen'],
                'is_online' => $user['is_online']
            ]
        ]);
    }
    
    private function checkSession() {
        try {
            // Add debug logging
            error_log('=== Session Check Debug ===');
            error_log('Session ID set: ' . (isset($_SESSION['session_id']) ? 'YES' : 'NO'));
            error_log('User ID set: ' . (isset($_SESSION['user_id']) ? 'YES' : 'NO'));
            if (isset($_SESSION['session_id'])) {
                error_log('Session ID: ' . $_SESSION['session_id']);
            }
            if (isset($_SESSION['user_id'])) {
                error_log('User ID: ' . $_SESSION['user_id']);
            }
            
            // First, clean up expired sessions
            $this->user->cleanupExpiredSessions();
            
            $isLoggedIn = isset($_SESSION['user_id']) && isset($_SESSION['session_id']);
            
            if ($isLoggedIn) {
                // Validate session against database
                $session = $this->user->validateSession($_SESSION['session_id']);
                error_log('Database session found: ' . ($session ? 'YES' : 'NO'));
                
                if ($session && $session['user_id'] == $_SESSION['user_id']) {
                    // Session is valid, get user info
                    try {
                        $user = $this->user->getUserById($_SESSION['user_id']);
                        if ($user) {
                            // Update user activity
                            $this->user->updateLastSeen($_SESSION['user_id']);
                            $this->user->setOnlineStatus($_SESSION['user_id'], true);
                            
                            error_log('Session validation successful for user: ' . $user['username']);
                            
                            $this->sendResponse([
                                'success' => true,
                                'authenticated' => true,
                                'user' => [
                                    'id' => $user['id'],
                                    'username' => $user['username'],
                                    'display_name' => $user['display_name'] ?? $user['username'],
                                    'avatar' => $user['avatar'] ?? null
                                ]
                            ]);
                        } else {
                            // User not found in database, clear session
                            error_log('User not found in database, clearing session');
                            $this->clearInvalidSession();
                            $this->sendResponse([
                                'success' => true,
                                'authenticated' => false,
                                'message' => 'User not found'
                            ]);
                        }
                    } catch (Exception $userError) {
                        // Database error, but don't expose details
                        error_log('User lookup error: ' . $userError->getMessage());
                        $this->sendResponse([
                            'success' => true,
                            'authenticated' => false,
                            'error' => 'Database error'
                        ]);
                    }
                } else {
                    // Invalid session, clear it
                    error_log('Invalid session, clearing. Session user_id: ' . ($session ? $session['user_id'] : 'null') . ', PHP session user_id: ' . $_SESSION['user_id']);
                    $this->clearInvalidSession();
                    $this->sendResponse([
                        'success' => true,
                        'authenticated' => false,
                        'message' => 'Session expired or invalid'
                    ]);
                }
            } else {
                error_log('No valid session found in PHP session');
                $this->sendResponse([
                    'success' => true,
                    'authenticated' => false
                ]);
            }
        } catch (Exception $e) {
            error_log('Session check error: ' . $e->getMessage());
            $this->sendResponse([
                'success' => true,
                'authenticated' => false,
                'error' => 'Session check failed'
            ]);
        }
    }
    
    private function getCSRFToken() {
        // Generate a new CSRF token
        $newToken = $this->security->generateCSRF();
        
        $this->sendResponse([
            'success' => true,
            'csrf_token' => $newToken
        ]);
    }
    
    private function sendResponse($data, $statusCode = 200) {
        // Clear any output buffer
        if (ob_get_level()) {
            ob_clean();
        }
        
        // Ensure clean JSON output
        header('Content-Type: application/json');
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
    
    private function sendError($message, $statusCode = 400) {
        // Clear any output buffer
        if (ob_get_level()) {
            ob_clean();
        }
        
        // Ensure clean JSON output
        header('Content-Type: application/json');
        http_response_code($statusCode);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c')
        ]);
        exit;
    }
    
    private function clearInvalidSession() {
        // Delete session from database if it exists
        if (isset($_SESSION['session_id'])) {
            try {
                $this->user->deleteSession($_SESSION['session_id']);
            } catch (Exception $e) {
                error_log('Error deleting session: ' . $e->getMessage());
            }
        }
        
        // Clear PHP session
        session_unset();
        session_destroy();
        
        // Start a new session for CSRF token
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
}

// Global error handler for uncaught exceptions
set_exception_handler(function($exception) {
    // Clear any output buffer
    if (ob_get_level()) {
        ob_clean();
    }
    
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error: ' . $exception->getMessage(),
        'timestamp' => date('c')
    ]);
    exit;
});

// Initialize and handle request
try {
    $api = new AuthAPI();
    $api->handleRequest();
} catch (Exception $e) {
    // Clear any output buffer
    if (ob_get_level()) {
        ob_clean();
    }
    
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'API initialization failed: ' . $e->getMessage(),
        'timestamp' => date('c')
    ]);
}
?>
