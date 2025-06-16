<?php
/**
 * Admin API Endpoint
 * Handles admin functionality including user management, message moderation,
 * system monitoring, backup/restore, configuration management, and audit logs
 */

require_once '../config/config.php';
require_once '../classes/Database.php';
require_once '../classes/User.php';
require_once '../classes/Security.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// Enable CORS for same origin
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $origin = $_SERVER['HTTP_ORIGIN'];
    if (in_array($origin, ['http://localhost', 'https://localhost'])) {
        header("Access-Control-Allow-Origin: $origin");
    }
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();

try {
    $db = new Database();
    $userClass = new User($db);
    $security = new Security();
    
    // Check if user is logged in and is admin
    if (!isset($_SESSION['user_id'])) {
        throw new Exception('Authentication required', 401);
    }
    
    $currentUser = $userClass->getUserById($_SESSION['user_id']);
    if (!$currentUser || $currentUser['role'] !== 'admin') {
        throw new Exception('Admin privileges required', 403);
    }
    
    $action = $_GET['action'] ?? $_POST['action'] ?? '';
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($action) {
        case 'get_users':
            handleGetUsers($db, $security);
            break;
            
        case 'create_user':
            handleCreateUser($db, $userClass, $security);
            break;
            
        case 'update_user':
            handleUpdateUser($db, $userClass, $security);
            break;
            
        case 'delete_user':
            handleDeleteUser($db, $userClass, $security);
            break;
            
        case 'moderate_message':
            handleModerateMessage($db, $security);
            break;
            
        case 'get_system_stats':
            handleGetSystemStats($db);
            break;
            
        case 'get_audit_logs':
            handleGetAuditLogs($db, $security);
            break;
            
        case 'backup_data':
            handleBackupData($db);
            break;
            
        case 'restore_data':
            handleRestoreData($db);
            break;
            
        case 'update_config':
            handleUpdateConfig($security);
            break;
            
        case 'get_config':
            handleGetConfig();
            break;
            
        default:
            throw new Exception('Invalid action', 400);
    }
    
} catch (Exception $e) {
    $code = $e->getCode() ?: 500;
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'code' => $code
    ]);
}

function handleGetUsers($db, $security) {
    $page = (int)($_GET['page'] ?? 1);
    $limit = min((int)($_GET['limit'] ?? 20), 100);
    $search = $security->sanitizeInput($_GET['search'] ?? '');
    $role = $security->sanitizeInput($_GET['role'] ?? '');
    $status = $security->sanitizeInput($_GET['status'] ?? '');
    
    $offset = ($page - 1) * $limit;
    
    $sql = "SELECT id, username, email, display_name, role, is_active, avatar, 
                   created_at, last_login_at, 
                   (SELECT COUNT(*) FROM messages WHERE sender_id = users.id) as message_count
            FROM users WHERE 1=1";
    
    $params = [];
    
    if ($search) {
        $sql .= " AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)";
        $searchTerm = "%$search%";
        $params = array_merge($params, [$searchTerm, $searchTerm, $searchTerm]);
    }
    
    if ($role) {
        $sql .= " AND role = ?";
        $params[] = $role;
    }
    
    if ($status === 'active') {
        $sql .= " AND is_active = 1";
    } elseif ($status === 'inactive') {
        $sql .= " AND is_active = 0";
    }
    
    // Get total count
    $countSql = str_replace('SELECT id, username, email, display_name, role, is_active, avatar, created_at, last_login_at, (SELECT COUNT(*) FROM messages WHERE sender_id = users.id) as message_count', 'SELECT COUNT(*)', $sql);
    $stmt = $db->prepare($countSql);
    $stmt->execute($params);
    $total = $stmt->fetchColumn();
    
    // Get users
    $sql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $users,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => ceil($total / $limit)
        ]
    ]);
}

function handleCreateUser($db, $userClass, $security) {
    $username = $security->sanitizeInput($_POST['username'] ?? '');
    $email = $security->sanitizeInput($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $displayName = $security->sanitizeInput($_POST['display_name'] ?? '');
    $role = $security->sanitizeInput($_POST['role'] ?? 'user');
    
    if (empty($username) || empty($email) || empty($password)) {
        throw new Exception('Username, email, and password are required', 400);
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Invalid email format', 400);
    }
    
    if (!in_array($role, ['user', 'moderator', 'admin'])) {
        throw new Exception('Invalid role', 400);
    }
    
    // Check if username or email already exists
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $email]);
    if ($stmt->fetch()) {
        throw new Exception('Username or email already exists', 409);
    }
    
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $db->prepare("
        INSERT INTO users (username, email, password_hash, display_name, role, is_active) 
        VALUES (?, ?, ?, ?, ?, 1)
    ");
    
    $stmt->execute([$username, $email, $hashedPassword, $displayName ?: $username, $role]);
    $userId = $db->lastInsertId();
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'create_user', "Created user: $username (ID: $userId)");
    
    echo json_encode([
        'success' => true,
        'message' => 'User created successfully',
        'user_id' => $userId
    ]);
}

function handleUpdateUser($db, $userClass, $security) {
    $userId = (int)($_POST['user_id'] ?? 0);
    $username = $security->sanitizeInput($_POST['username'] ?? '');
    $email = $security->sanitizeInput($_POST['email'] ?? '');
    $displayName = $security->sanitizeInput($_POST['display_name'] ?? '');
    $role = $security->sanitizeInput($_POST['role'] ?? '');
    $isActive = isset($_POST['is_active']) ? (int)$_POST['is_active'] : null;
    
    if (!$userId) {
        throw new Exception('User ID is required', 400);
    }
    
    // Build update query dynamically
    $updates = [];
    $params = [];
    
    if ($username) {
        $updates[] = "username = ?";
        $params[] = $username;
    }
    
    if ($email) {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format', 400);
        }
        $updates[] = "email = ?";
        $params[] = $email;
    }
    
    if ($displayName) {
        $updates[] = "display_name = ?";
        $params[] = $displayName;
    }
    
    if ($role && in_array($role, ['user', 'moderator', 'admin'])) {
        $updates[] = "role = ?";
        $params[] = $role;
    }
    
    if ($isActive !== null) {
        $updates[] = "is_active = ?";
        $params[] = $isActive;
    }
    
    if (empty($updates)) {
        throw new Exception('No valid fields to update', 400);
    }
    
    $params[] = $userId;
    $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    
    if ($stmt->rowCount() === 0) {
        throw new Exception('User not found or no changes made', 404);
    }
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'update_user', "Updated user ID: $userId");
    
    echo json_encode([
        'success' => true,
        'message' => 'User updated successfully'
    ]);
}

function handleDeleteUser($db, $userClass, $security) {
    $userId = (int)($_POST['user_id'] ?? $_GET['user_id'] ?? 0);
    
    if (!$userId) {
        throw new Exception('User ID is required', 400);
    }
    
    if ($userId === $_SESSION['user_id']) {
        throw new Exception('Cannot delete your own account', 400);
    }
    
    // Get user info for logging
    $stmt = $db->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        throw new Exception('User not found', 404);
    }
    
    // Delete user (cascade will handle related records)
    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'delete_user', "Deleted user: {$user['username']} (ID: $userId)");
    
    echo json_encode([
        'success' => true,
        'message' => 'User deleted successfully'
    ]);
}

function handleModerateMessage($db, $security) {
    $messageId = (int)($_POST['message_id'] ?? 0);
    $action = $security->sanitizeInput($_POST['moderate_action'] ?? '');
    $reason = $security->sanitizeInput($_POST['reason'] ?? '');
    
    if (!$messageId || !in_array($action, ['hide', 'delete', 'restore'])) {
        throw new Exception('Invalid message ID or action', 400);
    }
    
    $stmt = $db->prepare("SELECT id, content, sender_id FROM messages WHERE id = ?");
    $stmt->execute([$messageId]);
    $message = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$message) {
        throw new Exception('Message not found', 404);
    }
    
    if ($action === 'delete') {
        $stmt = $db->prepare("DELETE FROM messages WHERE id = ?");
        $stmt->execute([$messageId]);
    } else {
        $isHidden = $action === 'hide' ? 1 : 0;
        $stmt = $db->prepare("UPDATE messages SET is_hidden = ?, moderated_by = ?, moderated_at = NOW() WHERE id = ?");
        $stmt->execute([$isHidden, $_SESSION['user_id'], $messageId]);
    }
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'moderate_message', "Message $action: ID $messageId, Reason: $reason");
    
    echo json_encode([
        'success' => true,
        'message' => 'Message moderated successfully'
    ]);
}

function handleGetSystemStats($db) {
    $stats = [];
    
    // User statistics
    $stmt = $db->query("SELECT COUNT(*) as total_users FROM users");
    $stats['total_users'] = $stmt->fetchColumn();
    
    $stmt = $db->query("SELECT COUNT(*) as active_users FROM users WHERE is_active = 1");
    $stats['active_users'] = $stmt->fetchColumn();
    
    $stmt = $db->query("SELECT COUNT(*) as online_users FROM users WHERE last_activity > DATE_SUB(NOW(), INTERVAL 5 MINUTE)");
    $stats['online_users'] = $stmt->fetchColumn();
    
    // Message statistics
    $stmt = $db->query("SELECT COUNT(*) as total_messages FROM messages");
    $stats['total_messages'] = $stmt->fetchColumn();
    
    $stmt = $db->query("SELECT COUNT(*) as messages_today FROM messages WHERE DATE(created_at) = CURDATE()");
    $stats['messages_today'] = $stmt->fetchColumn();
    
    // File statistics
    $stmt = $db->query("SELECT COUNT(*) as total_files, SUM(file_size) as total_size FROM file_uploads");
    $fileStats = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['total_files'] = $fileStats['total_files'] ?? 0;
    $stats['total_file_size'] = $fileStats['total_size'] ?? 0;
    
    // System health
    $stats['server_time'] = date('Y-m-d H:i:s');
    $stats['php_version'] = PHP_VERSION;
    $stats['mysql_version'] = $db->query("SELECT VERSION()")->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'data' => $stats
    ]);
}

function handleGetAuditLogs($db, $security) {
    $page = (int)($_GET['page'] ?? 1);
    $limit = min((int)($_GET['limit'] ?? 50), 100);
    $action = $security->sanitizeInput($_GET['action'] ?? '');
    $userId = (int)($_GET['user_id'] ?? 0);
    
    $offset = ($page - 1) * $limit;
    
    $sql = "SELECT al.*, u.username 
            FROM admin_logs al 
            LEFT JOIN users u ON al.admin_id = u.id 
            WHERE 1=1";
    
    $params = [];
    
    if ($action) {
        $sql .= " AND al.action = ?";
        $params[] = $action;
    }
    
    if ($userId) {
        $sql .= " AND al.admin_id = ?";
        $params[] = $userId;
    }
    
    $sql .= " ORDER BY al.created_at DESC LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => $logs
    ]);
}

function handleBackupData($db) {
    $backupDir = '../backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $filename = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
    $filepath = $backupDir . '/' . $filename;
    
    // Get database credentials
    $host = DB_HOST;
    $dbname = DB_NAME;
    $username = DB_USER;
    $password = DB_PASS;
    
    // Create backup using mysqldump
    $command = "mysqldump --host=$host --user=$username --password=$password $dbname > $filepath 2>&1";
    exec($command, $output, $returnCode);
    
    if ($returnCode !== 0) {
        throw new Exception('Backup failed: ' . implode("\n", $output), 500);
    }
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'backup_data', "Created backup: $filename");
    
    echo json_encode([
        'success' => true,
        'message' => 'Backup created successfully',
        'filename' => $filename,
        'size' => filesize($filepath)
    ]);
}

function handleRestoreData($db) {
    if (!isset($_FILES['backup_file'])) {
        throw new Exception('Backup file is required', 400);
    }
    
    $file = $_FILES['backup_file'];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('File upload error', 400);
    }
    
    if (pathinfo($file['name'], PATHINFO_EXTENSION) !== 'sql') {
        throw new Exception('Invalid file type. Only SQL files are allowed', 400);
    }
    
    $tempPath = $file['tmp_name'];
    
    // Read and execute SQL file
    $sql = file_get_contents($tempPath);
    if ($sql === false) {
        throw new Exception('Could not read backup file', 500);
    }
    
    // Execute SQL statements
    $db->exec($sql);
    
    // Log the action
    logAdminAction($db, $_SESSION['user_id'], 'restore_data', "Restored from backup: {$file['name']}");
    
    echo json_encode([
        'success' => true,
        'message' => 'Data restored successfully'
    ]);
}

function handleUpdateConfig($security) {
    $config = $_POST['config'] ?? [];
    
    if (empty($config)) {
        throw new Exception('Configuration data is required', 400);
    }
    
    $configFile = '../config/app_config.json';
    
    // Load existing config
    $existingConfig = [];
    if (file_exists($configFile)) {
        $existingConfig = json_decode(file_get_contents($configFile), true) ?? [];
    }
    
    // Merge configurations
    $newConfig = array_merge($existingConfig, $config);
    
    // Save configuration
    if (file_put_contents($configFile, json_encode($newConfig, JSON_PRETTY_PRINT)) === false) {
        throw new Exception('Could not save configuration', 500);
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Configuration updated successfully'
    ]);
}

function handleGetConfig() {
    $configFile = '../config/app_config.json';
    
    $config = [];
    if (file_exists($configFile)) {
        $config = json_decode(file_get_contents($configFile), true) ?? [];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $config
    ]);
}

function logAdminAction($db, $adminId, $action, $description) {
    try {
        $stmt = $db->prepare("
            INSERT INTO admin_logs (admin_id, action, description, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $adminId,
            $action,
            $description,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]);
    } catch (Exception $e) {
        // Log errors silently - don't break the main operation
        error_log("Failed to log admin action: " . $e->getMessage());
    }
}
?>
