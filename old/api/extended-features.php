<?php
/**
 * Additional API endpoints for new features
 * Extends existing API functionality with configuration, preferences, and sync
 */

require_once '../config/config.php';
require_once '../classes/Database.php';
require_once '../classes/User.php';
require_once '../classes/Security.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Initialize security
$security = new Security();
$security->validateRequest();

// Get request method and action
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $db = new Database();
    $user = new User($db);
    
    // Check authentication for most actions
    if (!in_array($action, ['ping', 'check_duplicate'])) {
        $user->checkAuthentication();
    }
    
    switch ($action) {
        case 'get_preferences':
            handleGetPreferences($user);
            break;
            
        case 'save_preferences':
            handleSavePreferences($user);
            break;
            
        case 'update_presence':
            handleUpdatePresence($user);
            break;
            
        case 'typing_status':
            handleTypingStatus($user);
            break;
            
        case 'mark_read':
            handleMarkRead($user);
            break;
            
        case 'storage_usage':
            handleStorageUsage($user);
            break;
            
        case 'cleanup_old':
            handleCleanupOld($user);
            break;
            
        case 'archive_old':
            handleArchiveOld($user);
            break;
            
        case 'check_duplicate':
            handleCheckDuplicate($user);
            break;
            
        case 'sync_offline_data':
            handleSyncOfflineData($user);
            break;
            
        case 'ping':
            handlePing();
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function handleGetPreferences($user) {
    $userId = $_SESSION['user_id'];
    
    $stmt = $user->db->prepare("
        SELECT preferences 
        FROM user_preferences 
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();
    
    $preferences = $result ? json_decode($result['preferences'], true) : [];
    
    echo json_encode([
        'success' => true,
        'preferences' => $preferences
    ]);
}

function handleSavePreferences($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $preferences = $input;
    
    // Validate preferences structure
    $validKeys = ['notifications', 'display', 'emoji', 'privacy', 'messages'];
    foreach (array_keys($preferences) as $key) {
        if (!in_array($key, $validKeys)) {
            throw new Exception("Invalid preference key: $key");
        }
    }
    
    $stmt = $user->db->prepare("
        INSERT INTO user_preferences (user_id, preferences, updated_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE 
        preferences = VALUES(preferences), 
        updated_at = NOW()
    ");
    $stmt->execute([$userId, json_encode($preferences)]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Preferences saved successfully'
    ]);
}

function handleUpdatePresence($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $status = $input['status'] ?? 'online';
    $lastSeen = $input['last_seen'] ?? time() * 1000;
    
    // Validate status
    $validStatuses = ['online', 'away', 'offline'];
    if (!in_array($status, $validStatuses)) {
        throw new Exception('Invalid status');
    }
    
    $stmt = $user->db->prepare("
        UPDATE users 
        SET presence_status = ?, last_seen = ?, updated_at = NOW() 
        WHERE id = ?
    ");
    $stmt->execute([$status, date('Y-m-d H:i:s', $lastSeen / 1000), $userId]);
    
    echo json_encode([
        'success' => true,
        'status' => $status
    ]);
}

function handleTypingStatus($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $targetUserId = $input['target_user_id'];
    $isTyping = $input['is_typing'] ?? false;
    
    // Store typing status (with expiration)
    $expiresAt = date('Y-m-d H:i:s', time() + 5); // Expire in 5 seconds
    
    if ($isTyping) {
        $stmt = $user->db->prepare("
            INSERT INTO typing_status (user_id, target_user_id, expires_at) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
        ");
        $stmt->execute([$userId, $targetUserId, $expiresAt]);
    } else {
        $stmt = $user->db->prepare("
            DELETE FROM typing_status 
            WHERE user_id = ? AND target_user_id = ?
        ");
        $stmt->execute([$userId, $targetUserId]);
    }
    
    echo json_encode([
        'success' => true,
        'is_typing' => $isTyping
    ]);
}

function handleMarkRead($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $messageId = $input['message_id'];
    $senderId = $input['sender_id'];
    
    // Don't mark own messages as read
    if ($senderId == $userId) {
        echo json_encode(['success' => true, 'message' => 'Own message']);
        return;
    }
    
    $stmt = $user->db->prepare("
        INSERT INTO message_read_receipts (message_id, user_id, read_at) 
        VALUES (?, ?, NOW()) 
        ON DUPLICATE KEY UPDATE read_at = NOW()
    ");
    $stmt->execute([$messageId, $userId]);
    
    echo json_encode([
        'success' => true,
        'message_id' => $messageId
    ]);
}

function handleStorageUsage($user) {
    $userId = $_SESSION['user_id'];
    
    $stmt = $user->db->prepare("
        SELECT COALESCE(SUM(file_size), 0) as total_usage 
        FROM file_uploads 
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);
    $result = $stmt->fetch();
    
    echo json_encode([
        'success' => true,
        'usage' => (int)$result['total_usage']
    ]);
}

function handleCleanupOld($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $daysOld = $input['days_old'] ?? 30;
    
    // Validate days
    if ($daysOld < 1 || $daysOld > 365) {
        throw new Exception('Invalid days value');
    }
    
    $cutoffDate = date('Y-m-d H:i:s', time() - ($daysOld * 24 * 60 * 60));
    
    // Get files to delete
    $stmt = $user->db->prepare("
        SELECT file_path 
        FROM file_uploads 
        WHERE user_id = ? AND created_at < ?
    ");
    $stmt->execute([$userId, $cutoffDate]);
    $files = $stmt->fetchAll();
    
    // Delete files from filesystem
    $deletedCount = 0;
    foreach ($files as $file) {
        $filePath = '../' . $file['file_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
            $deletedCount++;
        }
    }
    
    // Delete from database
    $stmt = $user->db->prepare("
        DELETE FROM file_uploads 
        WHERE user_id = ? AND created_at < ?
    ");
    $stmt->execute([$userId, $cutoffDate]);
    
    echo json_encode([
        'success' => true,
        'files_deleted' => $deletedCount
    ]);
}

function handleArchiveOld($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $daysOld = $input['days_old'] ?? 90;
    
    $cutoffDate = date('Y-m-d H:i:s', time() - ($daysOld * 24 * 60 * 60));
    
    // Mark files as archived
    $stmt = $user->db->prepare("
        UPDATE file_uploads 
        SET is_archived = 1, archived_at = NOW() 
        WHERE user_id = ? AND created_at < ? AND is_archived = 0
    ");
    $stmt->execute([$userId, $cutoffDate]);
    
    $archivedCount = $stmt->rowCount();
    
    echo json_encode([
        'success' => true,
        'files_archived' => $archivedCount
    ]);
}

function handleCheckDuplicate($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $hash = $input['hash'];
    $userId = $input['user_id'];
    
    $stmt = $user->db->prepare("
        SELECT id, file_name, file_path, file_size 
        FROM file_uploads 
        WHERE file_hash = ? AND user_id = ? 
        LIMIT 1
    ");
    $stmt->execute([$hash, $userId]);
    $result = $stmt->fetch();
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'duplicate' => true,
            'file' => $result
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'duplicate' => false
        ]);
    }
}

function handleSyncOfflineData($user) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POST method required');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $_SESSION['user_id'];
    $offlineData = $input;
    
    $syncedItems = 0;
    
    foreach ($offlineData as $item) {
        try {
            switch ($item['type']) {
                case 'message':
                    // Process offline message
                    $stmt = $user->db->prepare("
                        INSERT INTO messages (user_id, content, created_at) 
                        VALUES (?, ?, ?)
                    ");
                    $stmt->execute([
                        $userId, 
                        $item['content'], 
                        date('Y-m-d H:i:s', $item['timestamp'] / 1000)
                    ]);
                    $syncedItems++;
                    break;
                    
                case 'read_receipt':
                    // Process offline read receipt
                    $stmt = $user->db->prepare("
                        INSERT INTO message_read_receipts (message_id, user_id, read_at) 
                        VALUES (?, ?, ?) 
                        ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)
                    ");
                    $stmt->execute([
                        $item['message_id'], 
                        $userId, 
                        date('Y-m-d H:i:s', $item['timestamp'] / 1000)
                    ]);
                    $syncedItems++;
                    break;
            }
        } catch (Exception $e) {
            error_log("Failed to sync offline item: " . $e->getMessage());
        }
    }
    
    echo json_encode([
        'success' => true,
        'synced_items' => $syncedItems
    ]);
}

function handlePing() {
    echo json_encode([
        'success' => true,
        'timestamp' => time(),
        'message' => 'pong'
    ]);
}
?>
