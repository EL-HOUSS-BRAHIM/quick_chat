<?php
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Database.php';
require_once __DIR__ . '/classes/User.php';
require_once __DIR__ . '/classes/Security.php';

echo "Creating test user...\n";

try {
    $user = new User();
    
    // Create a test user with known credentials
    $testUsername = 'testuser';
    $testEmail = 'test@example.com';
    $testPassword = 'TestPass123!';
    
    echo "Attempting to create user: $testUsername\n";
    echo "Email: $testEmail\n";
    echo "Password: $testPassword\n\n";
    
    // Check if user already exists
    $existingUser = $user->getUserByUsername($testUsername);
    if ($existingUser) {
        echo "✓ Test user '$testUsername' already exists\n";
        echo "User ID: " . $existingUser['id'] . "\n";
        echo "Email verified: " . ($existingUser['email_verified'] ? 'Yes' : 'No') . "\n";
        
        // If not verified, let's verify it manually
        if (!$existingUser['email_verified']) {
            echo "Manually verifying email for test user...\n";
            $db = Database::getInstance();
            $db->query("UPDATE users SET email_verified = 1 WHERE username = ?", [$testUsername]);
            echo "✓ Email verified\n";
        }
    } else {
        $userId = $user->register($testUsername, $testEmail, $testPassword);
        echo "✓ Test user created with ID: $userId\n";
        
        // Verify the email automatically for testing
        echo "Auto-verifying email for test user...\n";
        $db = Database::getInstance();
        $db->query("UPDATE users SET email_verified = 1 WHERE username = ?", [$testUsername]);
        echo "✓ Email verified\n";
    }
    
    // Test login with the test user
    echo "\nTesting login with test user...\n";
    try {
        $loginResult = $user->login($testUsername, $testPassword);
        echo "✓ Login successful!\n";
        echo "User ID: " . $loginResult['user_id'] . "\n";
        echo "Username: " . $loginResult['username'] . "\n";
        echo "Display name: " . $loginResult['display_name'] . "\n";
        echo "Session ID: " . $loginResult['session_id'] . "\n";
    } catch (Exception $e) {
        echo "✗ Login failed: " . $e->getMessage() . "\n";
    }
    
    // Also test with admin user if we can determine the password
    echo "\nFor admin user login, you'll need to know the admin password.\n";
    echo "The admin user exists with email: admin@quickchat.local\n";
    echo "If you don't know the admin password, you can reset it by running a separate script.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
