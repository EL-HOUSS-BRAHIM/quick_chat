<?php
/**
 * Group Chat Search API
 * Handles searching for messages in group chats
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
    header('Access-Control-Allow-Methods: GET, OPTIONS');
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

    // Handle GET request to search group messages
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $groupId = intval($_GET['group_id'] ?? 0);
        $query = trim($_GET['query'] ?? '');
        $limit = isset($_GET['limit']) ? min(intval($_GET['limit']), 50) : 20;

        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        if (empty($query) || strlen($query) < 2) {
            http_response_code(400);
            echo json_encode(['error' => 'Search query too short']);
            exit;
        }

        // Search messages
        $results = $message->searchGroupMessages($groupId, $query, $userId, $limit);

        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'query' => $query,
            'results' => $results,
            'count' => count($results)
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
