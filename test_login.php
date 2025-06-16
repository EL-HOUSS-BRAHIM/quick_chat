<?php
// Simple login test
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/User.php';
require_once __DIR__ . '/classes/Security.php';

try {
    // Start session
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $user = new User();
    $security = new Security();
    
    // Generate CSRF token
    $csrfToken = $security->generateCSRF();
    
    echo "CSRF Token: " . $csrfToken . "\n";
    
    // Try to get user by username - this should work if user exists
    $testUser = $user->getUserByUsername('test');
    if ($testUser) {
        echo "Test user found: " . $testUser['username'] . "\n";
        echo "Email verified: " . ($testUser['email_verified'] ? 'Yes' : 'No') . "\n";
    } else {
        echo "Test user not found\n";
    }
    
    // Test login with fake CSRF (this will fail but show us the exact error)
    try {
        $result = $user->login('test', 'password123', false);
        echo "Login successful!\n";
        print_r($result);
    } catch (Exception $e) {
        echo "Login error: " . $e->getMessage() . "\n";
    }
    
} catch (Exception $e) {
    echo "General error: " . $e->getMessage() . "\n";
}
?>
