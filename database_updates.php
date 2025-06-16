<?php
/**
 * Database Schema Updates for New Features
 * Adds tables and columns needed for the enhanced functionality
 */

require_once '../config/config.php';
require_once '../classes/Database.php';

try {
    $db = new Database();
    $pdo = $db->getConnection();
    
    echo "Starting database schema updates...\n";
    
    // User Preferences Table
    $sql = "CREATE TABLE IF NOT EXISTS user_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        preferences JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_preferences (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ User preferences table created/updated\n";
    
    // Typing Status Table
    $sql = "CREATE TABLE IF NOT EXISTS typing_status (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        target_user_id INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_typing (user_id, target_user_id),
        INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ Typing status table created/updated\n";
    
    // Message Read Receipts Table
    $sql = "CREATE TABLE IF NOT EXISTS message_read_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_read_receipt (message_id, user_id),
        INDEX idx_message_id (message_id),
        INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ Message read receipts table created/updated\n";
    
    // System Configuration Table
    $sql = "CREATE TABLE IF NOT EXISTS system_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL,
        config_value JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_config_key (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ System configuration table created/updated\n";
    
    // File Uploads Enhancements
    $sql = "ALTER TABLE file_uploads 
        ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64) AFTER file_size,
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE AFTER file_hash,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL AFTER is_archived,
        ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(500) NULL AFTER archived_at,
        ADD COLUMN IF NOT EXISTS preview_data TEXT NULL AFTER thumbnail_path,
        ADD INDEX IF NOT EXISTS idx_file_hash (file_hash),
        ADD INDEX IF NOT EXISTS idx_archived (is_archived),
        ADD INDEX IF NOT EXISTS idx_user_created (user_id, created_at)";
    
    $pdo->exec($sql);
    echo "✓ File uploads table enhanced\n";
    
    // Users Table Enhancements
    $sql = "ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS presence_status ENUM('online', 'away', 'offline') DEFAULT 'offline' AFTER email,
        ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP NULL AFTER presence_status,
        ADD INDEX IF NOT EXISTS idx_presence (presence_status),
        ADD INDEX IF NOT EXISTS idx_last_seen (last_seen)";
    
    $pdo->exec($sql);
    echo "✓ Users table enhanced\n";
    
    // Push Subscriptions Table
    $sql = "CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh_key TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ Push subscriptions table created/updated\n";
    
    // Browser Sessions Table (for compatibility tracking)
    $sql = "CREATE TABLE IF NOT EXISTS browser_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id VARCHAR(128) NOT NULL,
        browser_info JSON NOT NULL,
        features_supported JSON NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_session_id (session_id),
        INDEX idx_last_activity (last_activity)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ Browser sessions table created/updated\n";
    
    // Background Sync Queue Table
    $sql = "CREATE TABLE IF NOT EXISTS sync_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        action_data JSON NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        error_message TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_status (user_id, status),
        INDEX idx_created_at (created_at),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "✓ Background sync queue table created/updated\n";
    
    // Insert default system configuration
    $defaultConfig = [
        'file_upload' => [
            'max_size_bytes' => 50 * 1024 * 1024,
            'allowed_types' => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
            'max_files' => 10
        ],
        'messages' => [
            'retention_days' => 365,
            'max_length' => 5000,
            'enable_reactions' => true,
            'enable_editing' => true
        ],
        'users' => [
            'allow_registration' => true,
            'require_email_verification' => false,
            'max_username_length' => 50,
            'min_password_length' => 8
        ],
        'notifications' => [
            'enable_email_notifications' => true,
            'smtp_host' => '',
            'smtp_port' => 587,
            'smtp_username' => '',
            'smtp_password' => ''
        ]
    ];
    
    foreach ($defaultConfig as $key => $value) {
        $sql = "INSERT INTO system_config (config_key, config_value) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$key, json_encode($value)]);
    }
    echo "✓ Default system configuration inserted\n";
    
    // Clean up expired typing status entries (add to cleanup routine)
    $sql = "DELETE FROM typing_status WHERE expires_at < NOW()";
    $pdo->exec($sql);
    echo "✓ Cleaned up expired typing status entries\n";
    
    // Create cleanup event (MySQL Event Scheduler)
    $sql = "CREATE EVENT IF NOT EXISTS cleanup_typing_status
            ON SCHEDULE EVERY 1 MINUTE
            DO DELETE FROM typing_status WHERE expires_at < NOW()";
    
    try {
        $pdo->exec($sql);
        echo "✓ Cleanup event created\n";
    } catch (Exception $e) {
        echo "⚠ Could not create cleanup event (Event Scheduler may be disabled): " . $e->getMessage() . "\n";
    }
    
    echo "\nDatabase schema updates completed successfully!\n";
    echo "All new features are now supported in the database.\n";
    
} catch (Exception $e) {
    echo "Error updating database schema: " . $e->getMessage() . "\n";
    exit(1);
}
?>
