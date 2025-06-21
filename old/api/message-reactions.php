<?php
/**
 * Message Reactions API
 * Handles adding and retrieving message reactions
 */

require_once '../config/config.php';
require_once '../classes/Database.php';
require_once '../classes/Security.php';
require_once '../classes/Message.php';
require_once 'middleware/rate-limit.php';

header('Content-Type: application/json');

// Enable CORS if needed
if (Config::getAppEnv() === 'development') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // Initialize security and database
    $security = new Security();
    $db = new Database();
    $message = new Message($db, $security);

    // Get user session
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Handle POST request to add reaction
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Validate CSRF token
        if (!$security->validateCSRF($_POST['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        // Get message ID and emoji
        $messageId = intval($_POST['message_id'] ?? 0);
        $emoji = $_POST['emoji'] ?? '';
        $groupId = intval($_POST['group_id'] ?? 0) ?: null;

        if ($messageId <= 0 || empty($emoji)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid message ID or emoji']);
            exit;
        }

        // Add reaction
        $result = $message->addMessageReaction($messageId, $userId, $emoji, $groupId);

        // Get updated reactions
        $reactions = $message->getMessageReactions($messageId);

        echo json_encode([
            'success' => true,
            'added' => $result,
            'message_id' => $messageId,
            'emoji' => $emoji,
            'reactions' => $reactions
        ]);
        exit;
    }

    // Handle DELETE request to remove reaction
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        // Parse DELETE request body
        parse_str(file_get_contents("php://input"), $delete_vars);
        
        // Validate CSRF token
        if (!$security->validateCSRF($delete_vars['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        // Get message ID and emoji
        $messageId = intval($delete_vars['message_id'] ?? 0);
        $emoji = $delete_vars['emoji'] ?? '';

        if ($messageId <= 0 || empty($emoji)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid message ID or emoji']);
            exit;
        }

        // Remove reaction
        $result = $message->removeMessageReaction($messageId, $userId, $emoji);

        // Get updated reactions
        $reactions = $message->getMessageReactions($messageId);

        echo json_encode([
            'success' => $result,
            'message_id' => $messageId,
            'emoji' => $emoji,
            'reactions' => $reactions
        ]);
        exit;
    }

    // Handle GET request to retrieve reactions
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $messageId = intval($_GET['message_id'] ?? 0);

        if ($messageId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid message ID']);
            exit;
        }

        // Get reactions
        $reactions = $message->getMessageReactions($messageId);

        echo json_encode([
            'success' => true,
            'message_id' => $messageId,
            'reactions' => $reactions
        ]);
        exit;
    }

    // Invalid request method
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}
?>
