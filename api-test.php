<?php
// Simple API test script
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "=== API Test Debug ===\n";
echo "PHP Version: " . phpversion() . "\n";
echo "Current directory: " . getcwd() . "\n";

// Test if config loads
echo "\n=== Testing Config Load ===\n";
try {
    require_once __DIR__ . '/config/config.php';
    echo "Config loaded successfully\n";
} catch (Exception $e) {
    echo "Config load failed: " . $e->getMessage() . "\n";
    exit;
}

// Test if classes load
echo "\n=== Testing Class Load ===\n";
try {
    require_once __DIR__ . '/classes/User.php';
    require_once __DIR__ . '/classes/Security.php';
    echo "Classes loaded successfully\n";
} catch (Exception $e) {
    echo "Class load failed: " . $e->getMessage() . "\n";
    exit;
}

// Test session
echo "\n=== Testing Session ===\n";
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
echo "Session ID: " . session_id() . "\n";

// Test basic auth API
echo "\n=== Testing Auth API ===\n";
try {
    // Manually create a test response
    header('Content-Type: application/json');
    $response = [
        'success' => true,
        'message' => 'API test working',
        'timestamp' => date('c'),
        'session_status' => session_status(),
        'php_version' => phpversion()
    ];
    echo json_encode($response);
} catch (Exception $e) {
    echo "API test failed: " . $e->getMessage() . "\n";
}
?>
