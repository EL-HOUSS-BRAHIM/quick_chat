<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';

// Start session after configuration is loaded
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Security.php';

class UserAPI {
    private $user;
    private $security;
    
    public function __construct() {
        $this->user = new User();
        $this->security = new Security();
        
        // Check authentication
        if (!isset($_SESSION['user_id'])) {
            $this->sendError('Authentication required', 401);
        }
    }
    
    public function handleRequest() {
        try {
            $method = $_SERVER['REQUEST_METHOD'];
            $action = $_POST['action'] ?? $_GET['action'] ?? '';
            
            // Rate limiting
            $this->security->rateLimitCheck($_SESSION['user_id'], 'user_api', 100, 60);
            
            switch ($method) {
                case 'GET':
                    return $this->handleGet($action);
                    
                case 'POST':
                    return $this->handlePost($action);
                    
                case 'PUT':
                    return $this->handlePut($action);
                    
                default:
                    throw new Exception('Method not allowed', 405);
            }
            
        } catch (Exception $e) {
            $this->sendError($e->getMessage(), $e->getCode() ?: 400);
        }
    }
    
    private function handleGet($action) {
        switch ($action) {
            case 'get_online':
                return $this->getOnlineUsers();
                
            case 'search':
                return $this->searchUsers();
                
            case 'profile':
                return $this->getUserProfile();
                
            case 'stats':
                return $this->getUserStats();
                
            default:
                return $this->getOnlineUsers();
        }
    }
    
    private function handlePost($action) {
        // CSRF protection for POST requests
        if (!$this->security->validateCSRF($_POST['csrf_token'] ?? '')) {
            throw new Exception('Invalid CSRF token', 403);
        }
        
        switch ($action) {
            case 'update_status':
                return $this->updateUserStatus();
                
            default:
                throw new Exception('Invalid action', 400);
        }
    }
    
    private function handlePut($action) {
        // Parse JSON input for PUT requests
        $input = json_decode(file_get_contents('php://input'), true);
        
        switch ($action) {
            case 'update_profile':
                return $this->updateProfile($input);
                
            default:
                throw new Exception('Invalid action', 400);
        }
    }
    
    private function getOnlineUsers() {
        $users = $this->user->getOnlineUsers();
        
        // Remove sensitive information
        $users = array_map(function($user) {
            unset($user['password'], $user['email']);
            return $user;
        }, $users);
        
        $this->sendResponse([
            'success' => true,
            'users' => $users,
            'count' => count($users)
        ]);
    }
    
    private function searchUsers() {
        $query = trim($_GET['query'] ?? '');
        $limit = min((int)($_GET['limit'] ?? 20), 50);
        
        if (empty($query)) {
            return $this->getOnlineUsers();
        }
        
        if (strlen($query) < 2) {
            throw new Exception('Search query must be at least 2 characters');
        }
        
        $users = $this->user->searchUsers($query, $limit);
        
        // Remove sensitive information
        $users = array_map(function($user) {
            unset($user['password'], $user['email']);
            return $user;
        }, $users);
        
        $this->sendResponse([
            'success' => true,
            'users' => $users,
            'query' => $query,
            'count' => count($users)
        ]);
    }
    
    private function getUserProfile() {
        $userId = (int)($_GET['user_id'] ?? $_SESSION['user_id']);
        
        $user = $this->user->getUserById($userId);
        
        if (!$user) {
            throw new Exception('User not found', 404);
        }
        
        // Remove sensitive information
        unset($user['password']);
        
        // Only show email to self
        if ($userId !== $_SESSION['user_id']) {
            unset($user['email']);
        }
        
        $this->sendResponse([
            'success' => true,
            'user' => $user
        ]);
    }
    
    private function getUserStats() {
        $userId = (int)($_GET['user_id'] ?? $_SESSION['user_id']);
        
        // Only allow users to see their own stats
        if ($userId !== $_SESSION['user_id']) {
            $userId = $_SESSION['user_id'];
        }
        
        $stats = $this->user->getUserStats($userId);
        
        $this->sendResponse([
            'success' => true,
            'stats' => $stats
        ]);
    }
    
    private function updateUserStatus() {
        $status = trim($_POST['status'] ?? 'online');
        
        if (!in_array($status, ['online', 'away', 'busy', 'offline'])) {
            throw new Exception('Invalid status');
        }
        
        $this->user->updateUserStatus($_SESSION['user_id'], $status);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Status updated successfully'
        ]);
    }
    
    private function updateProfile($input) {
        $allowedFields = ['display_name', 'bio', 'avatar'];
        $updates = [];
        
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updates[$field] = $input[$field];
            }
        }
        
        if (empty($updates)) {
            throw new Exception('No valid fields to update');
        }
        
        $this->user->updateUserProfile($_SESSION['user_id'], $updates);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Profile updated successfully'
        ]);
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
$api = new UserAPI();
$api->handleRequest();
?>
