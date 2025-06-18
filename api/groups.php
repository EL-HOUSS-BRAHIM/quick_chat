<?php
// Start the session first to ensure CSRF token access
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../includes/auth_check.php';
require_once __DIR__ . '/../classes/Message.php';
require_once __DIR__ . '/../classes/Security.php';
require_once __DIR__ . '/../config/config.php';

class GroupChatAPI {
    private $message;
    private $security;
    
    public function __construct() {
        $this->message = new Message();
        $this->security = new Security();
    }
    
    public function handleRequest() {
        // Check if user is authenticated
        if (!isset($_SESSION['user_id'])) {
            $this->sendError('Unauthorized', 401);
            return;
        }
        
        // For POST, PUT, DELETE methods, validate CSRF token
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $csrfToken = isset($_POST['csrf_token']) ? $_POST['csrf_token'] : 
                         (isset($_REQUEST['csrf_token']) ? $_REQUEST['csrf_token'] : null);
            
            // Try to get from header if not in POST/REQUEST
            if ($csrfToken === null) {
                $headers = getallheaders();
                if (isset($headers['X-CSRF-Token'])) {
                    $csrfToken = $headers['X-CSRF-Token'];
                }
            }
            
            // If we can't find a token, try to get it from the request body for PUT/DELETE
            if ($csrfToken === null && ($_SERVER['REQUEST_METHOD'] === 'PUT' || $_SERVER['REQUEST_METHOD'] === 'DELETE')) {
                parse_str(file_get_contents('php://input'), $putParams);
                $csrfToken = isset($putParams['csrf_token']) ? $putParams['csrf_token'] : null;
            }
            
            // Debug logging
            error_log("Request CSRF: " . ($csrfToken ?? 'NULL'));
            error_log("Session CSRF: " . ($_SESSION['csrf_token'] ?? 'NULL'));
            
            if ($csrfToken === null || !$this->security->validateCSRF($csrfToken)) {
                $this->sendError('Invalid or missing CSRF token', 401);
                return;
            }
        }
        
        $method = $_SERVER['REQUEST_METHOD'];
        
        try {
            switch ($method) {
                case 'GET':
                    $this->handleGet();
                    break;
                case 'POST':
                    $this->handlePost();
                    break;
                case 'PUT':
                    $this->handlePut();
                    break;
                case 'DELETE':
                    $this->handleDelete();
                    break;
                default:
                    $this->sendError('Method not allowed', 405);
            }
        } catch (Exception $e) {
            $this->sendError($e->getMessage());
        }
    }
    
    private function handleGet() {
        $action = isset($_GET['action']) ? $_GET['action'] : 'list';
        
        switch ($action) {
            case 'list':
                // Get groups the user is a member of
                $groups = $this->message->getUserGroups($_SESSION['user_id']);
                $this->sendResponse(['groups' => $groups]);
                break;
                
            case 'public':
                // Get public groups
                $groups = $this->message->getPublicGroups();
                $this->sendResponse(['groups' => $groups]);
                break;
                
            case 'details':
                // Get detailed information about a group
                if (!isset($_GET['group_id'])) {
                    $this->sendError('Group ID is required');
                    return;
                }
                
                $group = $this->message->getGroupDetails($_GET['group_id']);
                $this->sendResponse(['group' => $group]);
                break;
                
            case 'members':
                // Get group members
                if (!isset($_GET['group_id'])) {
                    $this->sendError('Group ID is required');
                    return;
                }
                
                $members = $this->message->getGroupMembers($_GET['group_id']);
                $this->sendResponse(['members' => $members]);
                break;
                
            default:
                $this->sendError('Invalid action');
        }
    }
    
    private function handlePost() {
        $action = isset($_POST['action']) ? $_POST['action'] : 'create';
        
        switch ($action) {
            case 'create':
                // Create a new group
                $name = isset($_POST['name']) ? $_POST['name'] : '';
                $description = isset($_POST['description']) ? $_POST['description'] : '';
                $isPublic = isset($_POST['is_public']) ? (bool)$_POST['is_public'] : false;
                
                // Handle avatar upload if present
                $avatar = null;
                if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
                    $avatar = $this->handleAvatarUpload($_FILES['avatar']);
                }
                
                $group = $this->message->createGroupChat(
                    $_SESSION['user_id'],
                    $name,
                    $description,
                    $isPublic,
                    $avatar
                );
                
                $this->sendResponse([
                    'success' => true,
                    'message' => 'Group created successfully',
                    'group' => $group
                ]);
                break;
                
            case 'add_member':
                // Add a member to a group
                if (!isset($_POST['group_id']) || !isset($_POST['user_id'])) {
                    $this->sendError('Group ID and User ID are required');
                    return;
                }
                
                $role = isset($_POST['role']) ? $_POST['role'] : (isset($_POST['is_admin']) && (bool)$_POST['is_admin'] ? 'admin' : 'member');
                
                $this->message->addGroupMember(
                    $_POST['group_id'],
                    $_POST['user_id'],
                    $_SESSION['user_id'],
                    $role === 'admin'
                );
                
                $this->sendResponse([
                    'success' => true,
                    'message' => 'Member added successfully'
                ]);
                break;
                
            case 'ban_member':
                // Ban a member from a group
                if (!isset($_POST['group_id']) || !isset($_POST['user_id'])) {
                    $this->sendError('Group ID and User ID are required');
                    return;
                }
                
                $reason = isset($_POST['reason']) ? $_POST['reason'] : '';
                
                $this->message->banGroupMember(
                    $_POST['group_id'],
                    $_POST['user_id'],
                    $_SESSION['user_id'],
                    $reason
                );
                
                $this->sendResponse([
                    'success' => true,
                    'message' => 'Member banned successfully'
                ]);
                break;
                
            case 'update_member':
                // Update a member's role in a group
                if (!isset($_POST['group_id']) || !isset($_POST['user_id'])) {
                    $this->sendError('Group ID and User ID are required');
                    return;
                }
                
                $role = isset($_POST['role']) ? $_POST['role'] : 'member';
                
                // For backward compatibility
                if (isset($_POST['is_admin'])) {
                    $role = (bool)$_POST['is_admin'] ? 'admin' : 'member';
                }
                
                $this->message->updateGroupMember(
                    $_POST['group_id'],
                    $_POST['user_id'],
                    $_SESSION['user_id'],
                    $role
                );
                
                $this->sendResponse([
                    'success' => true,
                    'message' => 'Member updated successfully'
                ]);
                break;
                
            default:
                $this->sendError('Invalid action');
        }
    }
    
    private function handlePut() {
        // Parse PUT data
        parse_str(file_get_contents('php://input'), $putData);
        
        if (!isset($putData['group_id'])) {
            $this->sendError('Group ID is required');
            return;
        }
        
        // Update group settings
        $settings = [];
        
        if (isset($putData['name'])) {
            $settings['name'] = $putData['name'];
        }
        
        if (isset($putData['description'])) {
            $settings['description'] = $putData['description'];
        }
        
        if (isset($putData['is_public'])) {
            $settings['is_public'] = (bool)$putData['is_public'];
        }
        
        $group = $this->message->updateGroupSettings(
            $putData['group_id'],
            $_SESSION['user_id'],
            $settings
        );
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Group settings updated successfully',
            'group' => $group
        ]);
    }
    
    private function handleDelete() {
        // Parse DELETE data
        parse_str(file_get_contents('php://input'), $deleteData);
        
        $action = isset($deleteData['action']) ? $deleteData['action'] : 'remove_member';
        
        switch ($action) {
            case 'remove_member':
                // Remove a member from a group
                if (!isset($deleteData['group_id']) || !isset($deleteData['user_id'])) {
                    $this->sendError('Group ID and User ID are required');
                    return;
                }
                
                $this->message->removeGroupMember(
                    $deleteData['group_id'],
                    $deleteData['user_id'],
                    $_SESSION['user_id']
                );
                
                $this->sendResponse([
                    'success' => true,
                    'message' => 'Member removed successfully'
                ]);
                break;
                
            default:
                $this->sendError('Invalid action');
        }
    }
    
    private function handleAvatarUpload($file) {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!in_array($file['type'], $allowedTypes)) {
            throw new Exception('Invalid file type');
        }
        
        $maxFileSize = 2 * 1024 * 1024; // 2MB
        if ($file['size'] > $maxFileSize) {
            throw new Exception('File too large');
        }
        
        $uploadDir = __DIR__ . '/../uploads/group_avatars/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        $fileName = 'group_' . uniqid() . '_' . $this->security->sanitizeFilename($file['name']);
        $filePath = $uploadDir . $fileName;
        
        if (!move_uploaded_file($file['tmp_name'], $filePath)) {
            throw new Exception('Failed to upload file');
        }
        
        return 'uploads/group_avatars/' . $fileName;
    }
    
    private function sendResponse($data) {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
    
    private function sendError($message, $statusCode = 400) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => $message
        ]);
        exit;
    }
}

// Initialize and handle the request
$api = new GroupChatAPI();
$api->handleRequest();
