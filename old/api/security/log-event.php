<?php
/**
 * Security Event Logging API
 * Logs security-related events for audit trail
 */

require_once '../../config/config.php';
require_once '../../classes/Database.php';
require_once '../../classes/Security.php';

header('Content-Type: application/json');

// Enable CORS if needed
if (Config::getAppEnv() === 'development') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    // Initialize security and database
    $security = new Security();
    $db = new Database();

    // Get input data
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Verify CSRF token
    if (!$security->verifyCSRFToken($input['csrfToken'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit;
    }

    // Get user session
    session_start();
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }

    $userId = $_SESSION['user_id'];

    // Validate required fields
    if (empty($input['eventType'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Event type is required']);
        exit;
    }

    // Prepare event data
    $eventType = $input['eventType'];
    $eventData = $input['eventData'] ?? [];
    $ipAddress = $input['ipAddress'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $input['userAgent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $timestamp = $input['timestamp'] ?? time() * 1000; // JavaScript timestamp

    // Additional security context
    $securityContext = [
        'session_id' => session_id(),
        'referer' => $_SERVER['HTTP_REFERER'] ?? null,
        'request_method' => $_SERVER['REQUEST_METHOD'],
        'server_time' => time(),
        'client_timestamp' => $timestamp
    ];

    // Merge event data with security context
    $fullEventData = array_merge($eventData, $securityContext);

    // Insert security event into database
    $stmt = $db->prepare("
        INSERT INTO security_events (
            user_id, 
            event_type, 
            event_data, 
            ip_address, 
            user_agent, 
            created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $userId,
        $eventType,
        json_encode($fullEventData),
        $ipAddress,
        $userAgent
    ]);

    // Check for high-priority security events that need immediate attention
    $highPriorityEvents = [
        'screen_share_consent_denied',
        'recording_consent_denied',
        'encryption_verification_failed',
        'turn_authentication_failed',
        'suspicious_activity_detected'
    ];

    if (in_array($eventType, $highPriorityEvents)) {
        // Send alert to administrators
        $security->sendSecurityAlert($eventType, $fullEventData, $userId);
    }

    // Log to file for backup
    $logEntry = sprintf(
        "[%s] User:%d Event:%s IP:%s Data:%s\n",
        date('Y-m-d H:i:s'),
        $userId,
        $eventType,
        $ipAddress,
        json_encode($eventData)
    );
    
    error_log($logEntry, 3, Config::getLogFile());

    echo json_encode([
        'success' => true,
        'eventId' => $db->lastInsertId(),
        'timestamp' => time()
    ]);

} catch (Exception $e) {
    error_log("Security event logging error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}
