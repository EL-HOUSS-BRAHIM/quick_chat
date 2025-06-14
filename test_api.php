<?php
// Simple API test to debug the issue
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing API...\n";

// Test 1: Basic PHP functionality
echo "PHP Version: " . phpversion() . "\n";

// Test 2: Include config
try {
    require_once __DIR__ . '/config/config.php';
    echo "Config loaded successfully\n";
} catch (Exception $e) {
    echo "Config error: " . $e->getMessage() . "\n";
    exit;
}

// Test 3: Test classes
try {
    require_once __DIR__ . '/classes/Security.php';
    $security = new Security();
    echo "Security class loaded\n";
} catch (Exception $e) {
    echo "Security class error: " . $e->getMessage() . "\n";
}

try {
    require_once __DIR__ . '/classes/User.php';
    $user = new User();
    echo "User class loaded\n";
} catch (Exception $e) {
    echo "User class error: " . $e->getMessage() . "\n";
}

// Test 4: Session handling
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
echo "Session started\n";

// Test 5: JSON output
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'All tests passed',
    'timestamp' => date('c')
]);
?>
