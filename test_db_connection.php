<?php
// Database connection test script
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Database.php';

echo "Testing database connection...\n";

try {
    $db = Database::getInstance();
    echo "Database instance created successfully.\n";
    
    // Test a simple query
    $result = $db->query("SELECT 1 as test");
    $row = $result->fetch();
    
    if ($row && $row['test'] == 1) {
        echo "Database connection test passed!\n";
        
        // Test if users table exists
        $usersCheck = $db->query("SHOW TABLES LIKE 'users'");
        if ($usersCheck->fetch()) {
            echo "Users table exists.\n";
            
            // Count users
            $userCount = $db->fetch("SELECT COUNT(*) as count FROM users");
            echo "Users table has " . $userCount['count'] . " records.\n";
        } else {
            echo "Users table does not exist - need to run setup.\n";
        }
        
        echo "SUCCESS: Database is working properly!\n";
    } else {
        throw new Exception('Database test query failed');
    }
    
} catch (Exception $e) {
    echo "ERROR: Database connection failed: " . $e->getMessage() . "\n";
    
    // Try to get more specific error info
    if (class_exists('PDOException')) {
        echo "PDO is available.\n";
    } else {
        echo "PDO is NOT available - check PHP configuration.\n";
    }
}
?>
