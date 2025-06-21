<?php
/**
 * Group Message Read Receipts API
 * Handles marking group messages as read and retrieving read receipts
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
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

    // Handle POST request to mark message as read
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Validate CSRF token
        if (!$security->validateCSRF($_POST['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        // Get message ID and group ID
        $messageId = intval($_POST['message_id'] ?? 0);
        $groupId = intval($_POST['group_id'] ?? 0);

        if ($messageId <= 0 || $groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid message or group ID']);
            exit;
        }

        // Mark message as read
        $result = $message->markGroupMessageAsRead($messageId, $userId, $groupId);

        echo json_encode([
            'success' => $result,
            'message_id' => $messageId,
            'group_id' => $groupId,
            'user_id' => $userId
        ]);
        exit;
    }

    // Handle GET request to retrieve read receipts
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $messageId = intval($_GET['message_id'] ?? 0);
        $groupId = intval($_GET['group_id'] ?? 0);

        if ($messageId <= 0 || $groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid message or group ID']);
            exit;
        }

        // Check if user is a member of the group
        if (!$message->validateGroupMembership($userId, $groupId)) {
            http_response_code(403);
            echo json_encode(['error' => 'User is not a member of this group']);
            exit;
        }

        // Get read receipts
        $readReceipts = $message->getGroupMessageReadReceipts($messageId, $groupId);

        echo json_encode([
            'success' => true,
            'message_id' => $messageId,
            'group_id' => $groupId,
            'read_receipts' => $readReceipts
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
