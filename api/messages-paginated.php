<?php
/**
 * Message Pagination API
 * Provides paginated message retrieval for improved performance
 */

require_once '../config/config.php';
require_once '../classes/Database.php';
require_once '../classes/Security.php';
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

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // Initialize security and database
    $security = new Security();
    $db = new Database();

    // Get user session
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Get pagination parameters
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = min(100, max(10, intval($_GET['limit'] ?? 50))); // Between 10-100 messages per page
    $offset = ($page - 1) * $limit;
    
    // Optional filters
    $groupId = $_GET['group_id'] ?? null;
    $beforeDate = $_GET['before_date'] ?? null;
    $afterDate = $_GET['after_date'] ?? null;
    $search = $_GET['search'] ?? null;
    $messageType = $_GET['type'] ?? null; // text, file, image, etc.

    // Build query based on filters
    $whereConditions = [];
    $params = [];

    // Group filter
    if ($groupId) {
        $whereConditions[] = "m.group_id = ?";
        $params[] = $groupId;
    } else {
        // For direct messages, show messages where user is sender or in a private conversation
        $whereConditions[] = "(m.group_id IS NULL AND (m.user_id = ? OR m.user_id IN (
            SELECT DISTINCT user_id FROM messages WHERE user_id != ? 
            UNION SELECT DISTINCT ? as user_id
        )))";
        $params[] = $userId;
        $params[] = $userId;
        $params[] = $userId;
    }

    // Date filters
    if ($beforeDate) {
        $whereConditions[] = "m.created_at < ?";
        $params[] = $beforeDate;
    }
    
    if ($afterDate) {
        $whereConditions[] = "m.created_at > ?";
        $params[] = $afterDate;
    }

    // Search filter
    if ($search) {
        $whereConditions[] = "m.content LIKE ?";
        $params[] = '%' . $search . '%';
    }

    // Message type filter
    if ($messageType) {
        $whereConditions[] = "m.message_type = ?";
        $params[] = $messageType;
    }

    $whereClause = $whereConditions ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Get total count for pagination metadata
    $countSql = "
        SELECT COUNT(*) as total 
        FROM messages m 
        LEFT JOIN users u ON m.user_id = u.id 
        $whereClause
    ";
    
    $countStmt = $db->prepare($countSql);
    $countStmt->execute($params);
    $totalMessages = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];

    // Get messages with pagination
    $messagesSql = "
        SELECT 
            m.id,
            m.user_id,
            m.group_id,
            m.content,
            m.message_type,
            m.file_path,
            m.file_name,
            m.file_size,
            m.edited_at,
            m.created_at,
            u.username,
            u.avatar_url,
            CASE WHEN m.user_id = ? THEN true ELSE false END as is_own_message,
            (SELECT COUNT(*) FROM message_reactions mr WHERE mr.message_id = m.id) as reaction_count
        FROM messages m
        LEFT JOIN users u ON m.user_id = u.id
        $whereClause
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    ";

    $messagesParams = array_merge([$userId], $params, [$limit, $offset]);
    $messagesStmt = $db->prepare($messagesSql);
    $messagesStmt->execute($messagesParams);
    $messages = $messagesStmt->fetchAll(PDO::FETCH_ASSOC);

    // Get message reactions for each message (if any)
    $messageIds = array_column($messages, 'id');
    $reactions = [];
    
    if (!empty($messageIds)) {
        $reactionsSql = "
            SELECT 
                mr.message_id,
                mr.emoji,
                COUNT(*) as count,
                GROUP_CONCAT(u.username) as users
            FROM message_reactions mr
            LEFT JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id IN (" . str_repeat('?,', count($messageIds) - 1) . "?) 
            GROUP BY mr.message_id, mr.emoji
        ";
        
        $reactionsStmt = $db->prepare($reactionsSql);
        $reactionsStmt->execute($messageIds);
        $reactionResults = $reactionsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($reactionResults as $reaction) {
            $reactions[$reaction['message_id']][] = [
                'emoji' => $reaction['emoji'],
                'count' => intval($reaction['count']),
                'users' => explode(',', $reaction['users'])
            ];
        }
    }

    // Add reactions to messages
    foreach ($messages as &$message) {
        $message['reactions'] = $reactions[$message['id']] ?? [];
        $message['created_at'] = date('c', strtotime($message['created_at'])); // ISO format
        $message['edited_at'] = $message['edited_at'] ? date('c', strtotime($message['edited_at'])) : null;
        
        // Format file size
        if ($message['file_size']) {
            $message['file_size_formatted'] = formatFileSize($message['file_size']);
        }
    }

    // Reverse to show oldest first (since we ordered by DESC for pagination)
    $messages = array_reverse($messages);

    // Calculate pagination metadata
    $totalPages = ceil($totalMessages / $limit);
    $hasNextPage = $page < $totalPages;
    $hasPrevPage = $page > 1;

    // Response
    echo json_encode([
        'success' => true,
        'messages' => $messages,
        'pagination' => [
            'current_page' => $page,
            'per_page' => $limit,
            'total_messages' => intval($totalMessages),
            'total_pages' => $totalPages,
            'has_next_page' => $hasNextPage,
            'has_prev_page' => $hasPrevPage,
            'next_page' => $hasNextPage ? $page + 1 : null,
            'prev_page' => $hasPrevPage ? $page - 1 : null
        ],
        'filters' => [
            'group_id' => $groupId,
            'before_date' => $beforeDate,
            'after_date' => $afterDate,
            'search' => $search,
            'type' => $messageType
        ]
    ]);

} catch (Exception $e) {
    error_log("Message pagination API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

/**
 * Format file size in human readable format
 */
function formatFileSize($bytes) {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 2) . ' GB';
    } elseif ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 2) . ' MB';
    } elseif ($bytes >= 1024) {
        return number_format($bytes / 1024, 2) . ' KB';
    } else {
        return $bytes . ' bytes';
    }
}
