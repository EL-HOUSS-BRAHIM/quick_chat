<?php
require_once 'classes/Database.php';
require_once 'classes/User.php';

try {
    $user = new User();
    
    // Test creating a session for user ID 1
    echo "Testing session creation...\n";
    
    $sessionData = $user->createSession(1, '127.0.0.1', 'Test User Agent');
    
    if ($sessionData) {
        echo "Session created successfully!\n";
        echo "Session ID: " . $sessionData['session_id'] . "\n";
        echo "Expires at: " . $sessionData['expires_at'] . "\n";
        
        // Test validating the session
        echo "\nTesting session validation...\n";
        $validatedSession = $user->validateSession($sessionData['session_id']);
        
        if ($validatedSession) {
            echo "Session validation: SUCCESS\n";
            echo "User ID: " . $validatedSession['user_id'] . "\n";
        } else {
            echo "Session validation: FAILED\n";
        }
    } else {
        echo "Session creation: FAILED\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
?>
