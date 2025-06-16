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
    
    // Create additional tables for missing functionality
    createFileUploadsTable($db);
    createCallHistoryTable($db);
    createGroupsTable($db);
    createAdminLogsTable($db);
    createSecurityEventsTable($db);
    createRateLimitsTable($db);
    createRateLimitViolationsTable($db);
    
    // Add performance indexes
    addPerformanceIndexes($db);
    
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
    
} catch (PDOException $e) {
    echo "✗ Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}

// Function to create file uploads table
function createFileUploadsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS file_uploads (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        thumbnail_path VARCHAR(500),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_uploaded_at (uploaded_at)
    )";
    
    $db->exec($sql);
    echo "✓ File uploads table created/verified\n";
}

// Function to create call history table
function createCallHistoryTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS call_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        caller_id INT NOT NULL,
        callee_id INT NOT NULL,
        call_type ENUM('audio', 'video') NOT NULL,
        duration INT DEFAULT 0,
        status ENUM('completed', 'missed', 'rejected') NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_caller_id (caller_id),
        INDEX idx_callee_id (callee_id),
        INDEX idx_started_at (started_at)
    )";
    
    $db->exec($sql);
    echo "✓ Call history table created/verified\n";
}

// Function to create groups table
function createGroupsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS groups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_by INT NOT NULL,
        is_private BOOLEAN DEFAULT TRUE,
        max_members INT DEFAULT 50,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_created_by (created_by),
        INDEX idx_created_at (created_at)
    )";
    
    $db->exec($sql);
    
    $sql2 = "CREATE TABLE IF NOT EXISTS group_members (
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_joined_at (joined_at)
    )";
    
    $db->exec($sql2);
    echo "✓ Groups tables created/verified\n";
}

// Function to create admin logs table
function createAdminLogsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS admin_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        description TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_admin_id (admin_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
    )";
    
    $db->exec($sql);
    echo "✓ Admin logs table created/verified\n";
}

/**
 * Create security events table for audit logging
 */
function createSecurityEventsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS security_events (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        event_type VARCHAR(100) NOT NULL,
        event_data JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_event_type (event_type),
        INDEX idx_created_at (created_at),
        INDEX idx_ip_address (ip_address)
    )";
    
    $db->exec($sql);
    echo "✓ Security events table created/verified\n";
}

/**
 * Create rate limits table for tracking API usage
 */
function createRateLimitsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS rate_limits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        identifier VARCHAR(255) NOT NULL,
        endpoint VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier_endpoint (identifier, endpoint),
        INDEX idx_created_at (created_at)
    )";
    
    $db->exec($sql);
    echo "✓ Rate limits table created/verified\n";
}

/**
 * Create rate limit violations table for monitoring abuse
 */
function createRateLimitViolationsTable($db) {
    $sql = "CREATE TABLE IF NOT EXISTS rate_limit_violations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        identifier VARCHAR(255) NOT NULL,
        endpoint VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        violation_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_endpoint (endpoint),
        INDEX idx_ip_address (ip_address),
        INDEX idx_created_at (created_at)
    )";
    
    $db->exec($sql);
    echo "✓ Rate limit violations table created/verified\n";
}

/**
 * Add performance indexes to existing tables
 */
function addPerformanceIndexes($db) {
    echo "\nAdding performance indexes...\n";
    
    $indexes = [
        // Messages table indexes
        "CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_messages_created_desc ON messages(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_messages_search ON messages(content(100))",
        "CREATE INDEX IF NOT EXISTS idx_messages_group_created ON messages(group_id, created_at DESC)",
        
        // Users table indexes  
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)",
        "CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity DESC)",
        
        // File uploads indexes
        "CREATE INDEX IF NOT EXISTS idx_uploads_user_created ON file_uploads(user_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_uploads_message ON file_uploads(message_id)",
        "CREATE INDEX IF NOT EXISTS idx_uploads_type ON file_uploads(file_type)",
        "CREATE INDEX IF NOT EXISTS idx_uploads_size ON file_uploads(file_size)",
        
        // Sessions indexes
        "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)",
        
        // Groups indexes
        "CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id)",
        "CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active)",
        "CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)",
        
        // Call history indexes
        "CREATE INDEX IF NOT EXISTS idx_calls_caller_created ON call_history(caller_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_calls_callee_created ON call_history(callee_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_calls_status ON call_history(status)",
        "CREATE INDEX IF NOT EXISTS idx_calls_duration ON call_history(duration)",
    ];
    
    foreach ($indexes as $indexSql) {
        try {
            $db->exec($indexSql);
            echo "✓ Index added\n";
        } catch (Exception $e) {
            echo "! Index warning: " . $e->getMessage() . "\n";
        }
    }
}
