<?php
/**
 * Group Chat Notifications API
 * Handles group chat notification settings
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
    header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
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

    // Handle GET request to retrieve settings
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $groupId = intval($_GET['group_id'] ?? 0);

        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        // Get notification settings
        $settings = $message->getGroupNotificationSettings($userId, $groupId);

        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'settings' => $settings
        ]);
        exit;
    }

    // Handle PUT request to update settings
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        // Parse PUT data
        parse_str(file_get_contents('php://input'), $putData);
        
        // Validate CSRF token
        if (!$security->validateCSRF($putData['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        $groupId = intval($putData['group_id'] ?? 0);

        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        // Prepare settings array
        $settings = [];
        
        if (isset($putData['muted'])) {
            $settings['muted'] = (bool)$putData['muted'];
        }
        
        if (isset($putData['notify_all_messages'])) {
            $settings['notify_all_messages'] = (bool)$putData['notify_all_messages'];
        }
        
        if (isset($putData['notify_mentions'])) {
            $settings['notify_mentions'] = (bool)$putData['notify_mentions'];
        }
        
        if (isset($putData['notify_reactions'])) {
            $settings['notify_reactions'] = (bool)$putData['notify_reactions'];
        }

        // Update settings
        $updatedSettings = $message->updateGroupNotificationSettings($userId, $groupId, $settings);

        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'settings' => $updatedSettings
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
