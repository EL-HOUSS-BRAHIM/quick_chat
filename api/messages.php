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

require_once __DIR__ . '/../classes/Message.php';
require_once __DIR__ . '/../classes/User.php';
require_once __DIR__ . '/../classes/Security.php';

class MessageAPI {
    private $message;
    private $user;
    private $security;
    
    public function __construct() {
        $this->message = new Message();
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
            $this->security->rateLimitCheck($_SESSION['user_id'], 'message_api', 200, 60);
            
            switch ($method) {
                case 'POST':
                    return $this->handlePost($action);
                    
                case 'GET':
                    return $this->handleGet($action);
                    
                case 'PUT':
                    return $this->handlePut($action);
                    
                case 'DELETE':
                    return $this->handleDelete($action);
                    
                default:
                    throw new Exception('Method not allowed', 405);
            }
            
        } catch (Exception $e) {
            $this->sendError($e->getMessage(), $e->getCode() ?: 400);
        }
    }
    
    private function handlePost($action) {
        // CSRF protection - but allow some actions without CSRF for better UX
        $requireCSRF = !in_array($action, ['typing']);
        
        if ($requireCSRF && !$this->security->validateCSRF($_POST['csrf_token'] ?? '')) {
            throw new Exception('Invalid CSRF token', 403);
        }
        
        switch ($action) {
            case 'send':
                return $this->sendMessage();
                
            case 'upload_file':
                return $this->uploadFile();
                
            case 'add_reaction':
                return $this->addReaction();
                
            case 'typing':
                return $this->handleTyping();
                
            default:
                throw new Exception('Invalid action', 400);
        }
    }
    
    private function handleGet($action) {
        switch ($action) {
            case 'get':
            case 'list':
                return $this->getMessages();
                
            case 'search':
                return $this->searchMessages();
                
            case 'stats':
                return $this->getStats();
                
            case 'reactions':
                return $this->getReactions();
                
            default:
                return $this->getMessages(); // Default action
        }
    }
    
    private function handlePut($action) {
        // Parse JSON input for PUT requests
        $input = json_decode(file_get_contents('php://input'), true);
        
        switch ($action) {
            case 'edit':
                return $this->editMessage($input);
                
            default:
                throw new Exception('Invalid action', 400);
        }
    }
    
    private function handleDelete($action) {
        switch ($action) {
            case 'delete':
                return $this->deleteMessage();
                
            case 'remove_reaction':
                return $this->removeReaction();
                
            default:
                throw new Exception('Invalid action', 400);
        }
    }
    
    private function sendMessage() {
        // Handle both POST data and JSON input
        $input = $_POST;
        if (empty($input) || (!isset($input['message']) && !isset($input['content']))) {
            $jsonInput = json_decode(file_get_contents('php://input'), true);
            if ($jsonInput) {
                $input = array_merge($input, $jsonInput);
            }
        }
        
        $content = trim($input['message'] ?? $input['content'] ?? '');
        $messageType = $input['message_type'] ?? $input['type'] ?? 'text';
        $filePath = $input['file_path'] ?? null;
        $replyToId = $input['reply_to_id'] ?? null;
        $targetUserId = $input['target_user_id'] ?? null;
        
        // Handle typing indicator requests
        if (isset($input['action']) && $input['action'] === 'typing') {
            return $this->handleTypingIndicator($input);
        }
        
        if ($messageType === 'text' && empty($content)) {
            throw new Exception('Message content cannot be empty');
        }
        
        $message = $this->message->sendMessage(
            $_SESSION['user_id'],
            $content,
            $messageType,
            $filePath,
            $replyToId
        );
        
        // Broadcast to other users (WebSocket implementation would go here)
        $this->broadcastMessage($message);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Message sent successfully',
            'data' => $message
        ]);
    }
    
    private function uploadFile() {
        if (empty($_FILES['file'])) {
            throw new Exception('No file uploaded');
        }
        
        $file = $_FILES['file'];
        $allowedTypes = array_merge(
            Config::getAllowedImageTypes(),
            Config::getAllowedVideoTypes(),
            Config::getAllowedAudioTypes(),
            Config::getAllowedDocumentTypes()
        );
        
        // Validate file
        $fileInfo = $this->security->validateFileUpload($file, $allowedTypes);
        
        // Determine upload directory based on file type
        $uploadDir = $this->getUploadDirectory($fileInfo['mime_type']);
        
        // Generate secure filename
        $filename = $this->security->generateSecureFilename($fileInfo['original_name']);
        $filePath = $uploadDir . $filename;
        
        // Create directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        // Move uploaded file
        if (!move_uploaded_file($fileInfo['tmp_name'], $filePath)) {
            throw new Exception('Failed to save uploaded file');
        }
        
        // Determine message type based on MIME type
        $messageType = $this->getMessageTypeFromMime($fileInfo['mime_type']);
        
        // Send message with file
        $message = $this->message->sendMessage(
            $_SESSION['user_id'],
            $fileInfo['original_name'], // Use original filename as content
            $messageType,
            $filePath
        );
        
        $this->sendResponse([
            'success' => true,
            'message' => 'File uploaded successfully',
            'data' => $message
        ]);
    }
    
    private function handleTyping() {
        $isTyping = ($_POST['is_typing'] ?? '0') === '1';
        $targetUserId = $_POST['target_user_id'] ?? null;
        
        // Store typing status in session or database
        $_SESSION['typing_status'] = [
            'is_typing' => $isTyping,
            'target_user_id' => $targetUserId,
            'timestamp' => time()
        ];
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Typing status updated'
        ]);
    }
    
    private function getMessages() {
        $limit = min((int)($_GET['limit'] ?? 50), 100); // Max 100 messages
        $offset = (int)($_GET['offset'] ?? 0);
        $beforeId = $_GET['before_id'] ?? null;
        $targetUserId = $_GET['target_user_id'] ?? null;
        
        if ($targetUserId) {
            // Get direct messages between current user and target user
            $messages = $this->message->getDirectMessages($_SESSION['user_id'], $targetUserId, $limit, $offset);
        } else {
            // Get general chat messages
            $messages = $this->message->getMessages($limit, $offset, $beforeId);
        }
        
        $this->sendResponse([
            'success' => true,
            'data' => $messages,
            'count' => count($messages)
        ]);
    }
    
    private function searchMessages() {
        $query = trim($_GET['query'] ?? '');
        $limit = min((int)($_GET['limit'] ?? 20), 50);
        
        if (empty($query)) {
            throw new Exception('Search query is required');
        }
        
        if (strlen($query) < 3) {
            throw new Exception('Search query must be at least 3 characters');
        }
        
        $messages = $this->message->searchMessages($query, null, $limit);
        
        $this->sendResponse([
            'success' => true,
            'data' => $messages,
            'query' => $query,
            'count' => count($messages)
        ]);
    }
    
    private function editMessage($input) {
        $messageId = (int)($input['message_id'] ?? 0);
        $newContent = trim($input['content'] ?? '');
        
        if (!$messageId) {
            throw new Exception('Message ID is required');
        }
        
        if (empty($newContent)) {
            throw new Exception('Message content cannot be empty');
        }
        
        $message = $this->message->editMessage($messageId, $_SESSION['user_id'], $newContent);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Message edited successfully',
            'data' => $message
        ]);
    }
    
    private function deleteMessage() {
        $messageId = (int)($_GET['message_id'] ?? $_POST['message_id'] ?? 0);
        
        if (!$messageId) {
            throw new Exception('Message ID is required');
        }
        
        $this->message->deleteMessage($messageId, $_SESSION['user_id']);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Message deleted successfully'
        ]);
    }
    
    private function addReaction() {
        $messageId = (int)($_POST['message_id'] ?? 0);
        $reaction = trim($_POST['reaction'] ?? '');
        
        if (!$messageId) {
            throw new Exception('Message ID is required');
        }
        
        if (empty($reaction)) {
            throw new Exception('Reaction is required');
        }
        
        $reactions = $this->message->addReaction($messageId, $_SESSION['user_id'], $reaction);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Reaction added successfully',
            'data' => $reactions
        ]);
    }
    
    private function removeReaction() {
        $messageId = (int)($_GET['message_id'] ?? 0);
        $reaction = trim($_GET['reaction'] ?? '');
        
        if (!$messageId) {
            throw new Exception('Message ID is required');
        }
        
        if (empty($reaction)) {
            throw new Exception('Reaction is required');
        }
        
        $reactions = $this->message->removeReaction($messageId, $_SESSION['user_id'], $reaction);
        
        $this->sendResponse([
            'success' => true,
            'message' => 'Reaction removed successfully',
            'data' => $reactions
        ]);
    }
    
    private function getReactions() {
        $messageId = (int)($_GET['message_id'] ?? 0);
        
        if (!$messageId) {
            throw new Exception('Message ID is required');
        }
        
        $reactions = $this->message->getMessageReactions($messageId);
        
        $this->sendResponse([
            'success' => true,
            'data' => $reactions
        ]);
    }
    
    private function getStats() {
        $userId = $_GET['user_id'] ?? $_SESSION['user_id'];
        
        // Only allow users to see their own stats unless admin
        if ($userId != $_SESSION['user_id']) {
            // Check if current user is admin (implementation depends on your role system)
            $userId = $_SESSION['user_id'];
        }
        
        $stats = $this->message->getMessageStats($userId);
        
        $this->sendResponse([
            'success' => true,
            'data' => $stats
        ]);
    }
    
    private function getUploadDirectory($mimeType) {
        $baseDir = Config::getUploadPath();
        
        if (strpos($mimeType, 'image/') === 0) {
            return $baseDir . 'images/';
        } elseif (strpos($mimeType, 'video/') === 0) {
            return $baseDir . 'videos/';
        } elseif (strpos($mimeType, 'audio/') === 0) {
            return $baseDir . 'audio/';
        } else {
            return $baseDir . 'files/';
        }
    }
    
    private function getMessageTypeFromMime($mimeType) {
        if (strpos($mimeType, 'image/') === 0) {
            return 'image';
        } elseif (strpos($mimeType, 'video/') === 0) {
            return 'video';
        } elseif (strpos($mimeType, 'audio/') === 0) {
            return 'audio';
        } else {
            return 'file';
        }
    }
    
    private function broadcastMessage($message) {
        // In a real implementation, this would broadcast to WebSocket connections
        // For now, we'll just log it
        error_log("Broadcasting message: " . json_encode([
            'type' => 'new_message',
            'data' => $message
        ]));
        
        // You could also implement Server-Sent Events or polling here
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
    
    private function handleTypingIndicator($input) {
        $targetUserId = $input['target_user_id'] ?? null;
        $isTyping = isset($input['typing']) ? (bool)$input['typing'] : true;
        
        // Store typing status in session or cache (simplified version)
        if (!isset($_SESSION['typing_status'])) {
            $_SESSION['typing_status'] = [];
        }
        
        $typingKey = $targetUserId ? "dm_{$targetUserId}" : 'general';
        $_SESSION['typing_status'][$typingKey] = [
            'user_id' => $_SESSION['user_id'],
            'is_typing' => $isTyping,
            'timestamp' => time()
        ];
        
        return $this->sendResponse([
            'success' => true,
            'message' => 'Typing status updated'
        ]);
    }
}

// Initialize and handle request
$api = new MessageAPI();
$api->handleRequest();
?>
