<?php
/**
 * Group Chat Moderation API
 * Handles moderation actions for group chats
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

    // Handle GET request to list moderation actions
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $groupId = intval($_GET['group_id'] ?? 0);
        $targetUserId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;

        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        // Check if user has permission to view moderation actions
        $stmt = $db->prepare("SELECT g.created_by, gm.is_admin 
                             FROM groups g
                             LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = ?
                             WHERE g.id = ?");
        $stmt->execute([$userId, $groupId]);
        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {
            http_response_code(404);
            echo json_encode(['error' => 'Group not found']);
            exit;
        }

        if ($group['created_by'] != $userId && !$group['is_admin']) {
            http_response_code(403);
            echo json_encode(['error' => 'You do not have permission to view moderation actions']);
            exit;
        }

        // Build query
        $sql = "SELECT gma.*, 
                       u.username as user_username, u.display_name as user_display_name,
                       m.username as moderator_username, m.display_name as moderator_display_name
                FROM group_moderation_actions gma
                JOIN users u ON gma.user_id = u.id
                JOIN users m ON gma.moderator_id = m.id
                WHERE gma.group_id = ?";
        $params = [$groupId];

        if ($targetUserId) {
            $sql .= " AND gma.user_id = ?";
            $params[] = $targetUserId;
        }

        $sql .= " ORDER BY gma.created_at DESC";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $actions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'moderation_actions' => $actions
        ]);
        exit;
    }

    // Handle POST request to create a moderation action
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Validate CSRF token
        if (!$security->validateCSRF($_POST['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        $groupId = intval($_POST['group_id'] ?? 0);
        $targetUserId = intval($_POST['user_id'] ?? 0);
        $actionType = $_POST['action_type'] ?? '';
        $duration = isset($_POST['duration']) && $_POST['duration'] > 0 ? intval($_POST['duration']) : null;
        $reason = $_POST['reason'] ?? '';

        if ($groupId <= 0 || $targetUserId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID or user ID']);
            exit;
        }

        if (!in_array($actionType, ['warn', 'mute', 'kick', 'ban', 'unban'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action type']);
            exit;
        }

        // Create moderation action
        $action = $message->moderateGroupUser($groupId, $targetUserId, $userId, $actionType, $duration, $reason);

        echo json_encode([
            'success' => true,
            'action' => $action
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
