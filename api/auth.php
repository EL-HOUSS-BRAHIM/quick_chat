<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';
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
            $method = $_SERVER['REQUEST_METHOD'];
            
            if ($method !== 'POST') {
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
        
        $result = $this->user->login($username, $password, $rememberMe);
        
        $_SESSION['user_id'] = $result['user_id'];
        $_SESSION['username'] = $result['username'];
        $_SESSION['session_id'] = $result['session_id'];
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => $result['user_id'],
                'username' => $result['username'],
                'display_name' => $result['display_name']
            ],
            'redirect' => 'index.php'
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
        $isLoggedIn = isset($_SESSION['user_id']);
        
        if ($isLoggedIn) {
            $user = $this->user->getUserById($_SESSION['user_id']);
            
            $this->sendResponse([
                'success' => true,
                'authenticated' => true,
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'display_name' => $user['display_name'],
                    'avatar' => $user['avatar']
                ]
            ]);
        } else {
            $this->sendResponse([
                'success' => true,
                'authenticated' => false
            ]);
        }
    }
    
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
    
    private function sendError($message, $statusCode = 400) {
        http_response_code($statusCode);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c')
        ]);
        exit;
    }
}

// Initialize and handle request
$api = new AuthAPI();
$api->handleRequest();
?>
