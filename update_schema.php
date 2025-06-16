<?php
/**
 * Database Schema Updates
 * Run this script to add missing tables and columns
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/classes/Database.php';

try {
    $db = Database::getInstance();
    
    echo "Starting database schema updates...\n";
    
    // Create failed_login_attempts table
    $sql = "CREATE TABLE IF NOT EXISTS failed_login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        reason VARCHAR(100) DEFAULT 'invalid_credentials',
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_identifier (identifier),
        INDEX idx_created_at (created_at)
    )";
    $db->query($sql);
    echo "✓ Created failed_login_attempts table\n";
    
    // Add missing columns to users table if they don't exist
    $columns = [
        'failed_login_attempts INT DEFAULT 0',
        'last_failed_login TIMESTAMP NULL',
        'google_id VARCHAR(255) NULL',
        'facebook_id VARCHAR(255) NULL',
        'sso_provider VARCHAR(50) NULL',
        'email_verified BOOLEAN DEFAULT FALSE',
        'verification_token VARCHAR(255) NULL',
        'password_reset_token VARCHAR(255) NULL',
        'password_reset_expires TIMESTAMP NULL'
    ];
    
    foreach ($columns as $column) {
        $columnName = explode(' ', $column)[0];
        
        // Check if column exists
        $result = $db->query("SHOW COLUMNS FROM users LIKE '$columnName'");
        if ($result->rowCount() == 0) {
            $db->query("ALTER TABLE users ADD COLUMN $column");
            echo "✓ Added column '$columnName' to users table\n";
        }
    }
    
    // Create user_sessions table if it doesn't exist
    $sql = "CREATE TABLE IF NOT EXISTS user_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_session_id (session_id),
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at)
    )";
    $db->query($sql);
    echo "✓ Created user_sessions table\n";
    
    // Create audit_logs table if it doesn't exist
    $sql = "CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        details JSON NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
    )";
    $db->query($sql);
    echo "✓ Created audit_logs table\n";
    
    // Add indexes for better performance
    $indexes = [
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
        "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)",
        "CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id)",
        "CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)"
    ];
    
    foreach ($indexes as $index) {
        try {
            $db->query($index);
            echo "✓ Created index\n";
        } catch (Exception $e) {
            // Index might already exist, continue
        }
    }
    
    echo "\n✅ Database schema updates completed successfully!\n";
    
} catch (Exception $e) {
    echo "❌ Error updating database schema: " . $e->getMessage() . "\n";
    exit(1);
}
?>
