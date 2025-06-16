<?php
// Database test and setup script
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Database.php';

try {
    echo "Testing database connection...\n";
    
    $db = Database::getInstance();
    echo "✓ Database connection successful\n";
    
    // Test basic query
    $result = $db->query("SELECT 1 as test")->fetch();
    if ($result && $result['test'] == 1) {
        echo "✓ Basic query test successful\n";
    }
    
    // Check if tables exist
    $tables = ['users', 'messages', 'sessions', 'user_sessions'];
    
    foreach ($tables as $table) {
        try {
            $result = $db->query("SELECT COUNT(*) as count FROM $table")->fetch();
            echo "✓ Table '$table' exists with {$result['count']} records\n";
        } catch (Exception $e) {
            echo "✗ Table '$table' missing or error: " . $e->getMessage() . "\n";
        }
    }
    
    // Check if we can create tables
    echo "\nAttempting to create missing tables...\n";
    $db->createTables();
    echo "✓ Tables created/verified\n";
    
    // Create a test user if none exists
    $userCount = $db->fetch("SELECT COUNT(*) as count FROM users")['count'];
    if ($userCount == 0) {
        echo "\nCreating test user...\n";
        require_once __DIR__ . '/classes/User.php';
        
        $user = new User();
        try {
            $result = $user->register('testuser', 'test@example.com', 'TestPass123!');
            
            // Mark email as verified for testing
            $db->query("UPDATE users SET email_verified = 1 WHERE username = 'testuser'");
            
            echo "✓ Test user created: testuser / TestPass123!\n";
        } catch (Exception $e) {
            echo "✗ Failed to create test user: " . $e->getMessage() . "\n";
        }
    } else {
        echo "\n✓ Users table has $userCount existing users\n";
    }
    
    echo "\nDatabase setup complete!\n";
    
} catch (Exception $e) {
    echo "✗ Database error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
?>
