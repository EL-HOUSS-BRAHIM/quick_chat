<?php
/**
 * WebRTC TURN Server Credentials API
 * Provides temporary credentials for TURN server authentication
 */

require_once '../config/config.php';
require_once '../classes/Database.php';
require_once '../classes/Security.php';

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

    // Verify CSRF token
    if (!$security->verifyCSRFToken($_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
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
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate user exists and is active
    $stmt = $db->prepare("SELECT id, username, is_active FROM users WHERE id = ? AND is_active = 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid user']);
        exit;
    }

    // Generate temporary TURN credentials
    $turnCredentials = generateTURNCredentials($userId);

    // Log the credential request for security audit
    $security->logSecurityEvent('turn_credentials_requested', [
        'user_id' => $userId,
        'username' => $user['username'],
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
        'credentials_valid_until' => $turnCredentials['validUntil']
    ]);

    // Return credentials
    echo json_encode([
        'success' => true,
        'turnUrls' => $turnCredentials['urls'],
        'username' => $turnCredentials['username'],
        'credential' => $turnCredentials['credential'],
        'validUntil' => $turnCredentials['validUntil']
    ]);

} catch (Exception $e) {
    error_log("TURN credentials API error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

/**
 * Generate temporary TURN server credentials
 * @param int $userId User ID
 * @return array TURN credentials
 */
function generateTURNCredentials($userId) {
    // TURN server configuration
    $turnServers = [
        'turn:turn.quickchat.local:3478',
        'turns:turn.quickchat.local:5349'
    ];

    // Credentials valid for 1 hour
    $validUntil = time() + 3600;
    
    // Generate username (format: timestamp:userid)
    $username = $validUntil . ':' . $userId;
    
    // Generate credential using HMAC-SHA1
    $turnSecret = Config::getTurnSecret(); // Add this to config
    $credential = base64_encode(hash_hmac('sha1', $username, $turnSecret, true));

    return [
        'urls' => $turnServers,
        'username' => $username,
        'credential' => $credential,
        'validUntil' => $validUntil
    ];
}
