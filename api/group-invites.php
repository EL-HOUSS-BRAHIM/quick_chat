<?php
/**
 * Group Chat Invite Links API
 * Handles creating and using group chat invite links
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

    // Handle GET request to list invite links
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['code'])) {
        $groupId = intval($_GET['group_id'] ?? 0);

        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        // Check if user has permission to view invite links
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
            echo json_encode(['error' => 'You do not have permission to view invite links']);
            exit;
        }

        // Get invite links
        $stmt = $db->prepare("SELECT * FROM group_invite_links WHERE group_id = ? ORDER BY created_at DESC");
        $stmt->execute([$groupId]);
        $inviteLinks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'group_id' => $groupId,
            'invite_links' => $inviteLinks
        ]);
        exit;
    }

    // Handle GET request to use an invite link
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['code'])) {
        $inviteCode = $_GET['code'];

        try {
            $group = $message->useGroupInviteLink($inviteCode, $userId);
            
            echo json_encode([
                'success' => true,
                'message' => 'Successfully joined the group',
                'group' => $group
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
        }
        exit;
    }

    // Handle POST request to create an invite link
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Validate CSRF token
        if (!$security->validateCSRF($_POST['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'Invalid CSRF token']);
            exit;
        }

        $groupId = intval($_POST['group_id'] ?? 0);
        $maxUses = isset($_POST['max_uses']) && $_POST['max_uses'] > 0 ? intval($_POST['max_uses']) : null;
        $expiresIn = isset($_POST['expires_in']) && $_POST['expires_in'] > 0 ? intval($_POST['expires_in']) : null;
        
        if ($groupId <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid group ID']);
            exit;
        }

        // Calculate expiration date if provided
        $expiresAt = null;
        if ($expiresIn) {
            // Convert hours to timestamp
            $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiresIn} hours"));
        }

        // Create invite link
        $inviteLink = $message->createGroupInviteLink($groupId, $userId, $maxUses, $expiresAt);
        
        // Generate full invite URL
        $baseUrl = Config::getAppUrl();
        $inviteUrl = $baseUrl . '/join-group.php?code=' . $inviteLink['invite_code'];
        
        echo json_encode([
            'success' => true,
            'invite_link' => $inviteLink,
            'invite_url' => $inviteUrl
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
