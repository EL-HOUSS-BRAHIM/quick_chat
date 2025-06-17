<?php
// Simple Auth API with better error handling
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors in output
ini_set('log_errors', 1);

// Set headers first
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'CORS preflight']);
    exit;
}

// Function to send JSON response and exit
function sendResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

// Function to send error response
function sendError($message, $statusCode = 400) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => false,
        'error' => $message,
        'timestamp' => date('c')
    ]);
    exit;
}

try {
    // Get the action
    $action = $_POST['action'] ?? $_GET['action'] ?? 'test';
    
    // Handle test action first (no dependencies needed)
    if ($action === 'test') {
        sendResponse([
            'success' => true,
            'message' => 'API is working',
            'timestamp' => date('c'),
            'php_version' => phpversion(),
            'method' => $_SERVER['REQUEST_METHOD']
        ]);
    }
    
    // For other actions, try to load dependencies
    try {
        require_once __DIR__ . '/../config/config.php';
    } catch (Exception $e) {
        sendError('Config load failed: ' . $e->getMessage(), 500);
    }
    
    // Start session
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    try {
        require_once __DIR__ . '/../classes/User.php';
        require_once __DIR__ . '/../classes/Security.php';
    } catch (Exception $e) {
        sendError('Class load failed: ' . $e->getMessage(), 500);
    }
    
    // Handle check_session
    if ($action === 'check_session') {
        $isLoggedIn = isset($_SESSION['user_id']) && isset($_SESSION['session_id']);
        
        if ($isLoggedIn) {
            try {
                $user = new User();
                $session = $user->validateSession($_SESSION['session_id']);
                
                if ($session && $session['user_id'] == $_SESSION['user_id']) {
                    $userData = $user->getUserById($_SESSION['user_id']);
                    
                    sendResponse([
                        'success' => true,
                        'authenticated' => true,
                        'user' => [
                            'id' => $userData['id'],
                            'username' => $userData['username'],
                            'display_name' => $userData['display_name'] ?? $userData['username']
                        ]
                    ]);
                } else {
                    // Invalid session
                    session_unset();
                    session_destroy();
                    sendResponse([
                        'success' => true,
                        'authenticated' => false,
                        'message' => 'Session invalid'
                    ]);
                }
            } catch (Exception $e) {
                sendResponse([
                    'success' => true,
                    'authenticated' => false,
                    'error' => 'Session check failed: ' . $e->getMessage()
                ]);
            }
        } else {
            sendResponse([
                'success' => true,
                'authenticated' => false
            ]);
        }
    }
    
    // Handle login
    if ($action === 'login') {
        try {
            $username = $_POST['username'] ?? '';
            $password = $_POST['password'] ?? '';
            $rememberMe = isset($_POST['remember_me']);
            
            if (empty($username) || empty($password)) {
                sendError('Username and password are required');
            }
            
            $user = new User();
            $security = new Security();
            
            // CSRF validation
            if (!$security->validateCSRF($_POST['csrf_token'] ?? '')) {
                sendError('Invalid CSRF token', 403);
            }
            
            $result = $user->login($username, $password, $rememberMe);
            
            // Use AuthChecker to properly log in the user
            require_once __DIR__ . '/../includes/auth_check.php';
            AuthChecker::login($result['user_id'], [
                'username' => $result['username'],
                'session_id' => $result['session_id']
            ]);
            
            sendResponse([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $result['user_id'],
                    'username' => $result['username'],
                    'display_name' => $result['display_name']
                ],
                'csrf_token' => $security->generateCSRF()
            ]);
            
        } catch (Exception $e) {
            sendError('Login failed: ' . $e->getMessage());
        }
    }
    
    // Handle logout
    if ($action === 'logout') {
        try {
            if (isset($_SESSION['session_id'])) {
                $user = new User();
                $user->logout($_SESSION['session_id']);
            }
            
            session_unset();
            session_destroy();
            
            sendResponse([
                'success' => true,
                'message' => 'Logout successful'
            ]);
            
        } catch (Exception $e) {
            sendError('Logout failed: ' . $e->getMessage());
        }
    }
    
    // Default response for unknown actions
    sendError('Unknown action: ' . $action, 400);
    
} catch (Exception $e) {
    sendError('API Error: ' . $e->getMessage(), 500);
} catch (Error $e) {
    sendError('PHP Error: ' . $e->getMessage(), 500);
}
?>
