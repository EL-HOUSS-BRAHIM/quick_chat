<?php
/**
 * Quick Chat - Database Tables Creation Script
 * 
 * This script creates all the required database tables for the Quick Chat application
 * and initializes the database with an admin user and a welcome group.
 * 
 * Run this script after drop_tables.php or on a fresh database.
 * 
 * Date: June 17, 2025
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Database.php';

// Confirm execution if not in development
if (php_sapi_name() !== 'cli') {
    die("This script can only be run from the command line");
}

if (!Config::isDevelopment() && !isset($argv[1])) {
    echo "WARNING: You are about to create all tables in a non-development environment.\n";
    echo "Type 'YES' to continue: ";
    $handle = fopen("php://stdin", "r");
    $line = trim(fgets($handle));
    if ($line !== 'YES') {
        echo "Aborting...\n";
        exit;
    }
}

echo "=== Quick Chat Database Setup ===\n";
echo "Started at: " . date('Y-m-d H:i:s') . "\n";
echo "Database: " . Config::getDbName() . " on " . Config::getDbHost() . "\n\n";

try {
    $db = Database::getInstance();
    $connection = $db->getConnection();
    
    // Disable foreign key checks during table creation
    $connection->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Array of SQL statements to create tables
    $tables = [
        // Users table
        'users' => "
            CREATE TABLE IF NOT EXISTS `users` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `username` VARCHAR(50) NOT NULL,
                `email` VARCHAR(255) NOT NULL,
                `password_hash` VARCHAR(255) NOT NULL,
                `display_name` VARCHAR(100) NOT NULL,
                `avatar` VARCHAR(255) NULL,
                `email_verified` BOOLEAN DEFAULT FALSE,
                `verification_token` VARCHAR(64) NULL,
                `is_active` BOOLEAN DEFAULT TRUE,
                `is_online` BOOLEAN DEFAULT FALSE,
                `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `locked_until` TIMESTAMP NULL,
                `failed_login_attempts` INT DEFAULT 0,
                `last_failed_login` TIMESTAMP NULL,
                `reset_token` VARCHAR(64) NULL,
                `reset_token_expires` TIMESTAMP NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_username` (`username`),
                UNIQUE KEY `uk_email` (`email`),
                INDEX `idx_is_online` (`is_online`),
                INDEX `idx_last_seen` (`last_seen`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // User settings table
        'user_settings' => "
            CREATE TABLE IF NOT EXISTS `user_settings` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `setting_key` VARCHAR(50) NOT NULL,
                `setting_value` TEXT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `user_setting` (`user_id`, `setting_key`),
                INDEX `idx_user_id` (`user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // User sessions table
        'user_sessions' => "
            CREATE TABLE IF NOT EXISTS `user_sessions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `session_id` VARCHAR(128) NOT NULL,
                `user_id` INT NOT NULL,
                `login_type` ENUM('password', 'remember_me', 'oauth') DEFAULT 'password',
                `expires_at` TIMESTAMP NOT NULL,
                `ip_address` VARCHAR(45) NOT NULL,
                `user_agent` TEXT NULL,
                `is_active` BOOLEAN DEFAULT TRUE,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `last_activity` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `uk_session_id` (`session_id`),
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_expires_at` (`expires_at`),
                INDEX `idx_last_activity` (`last_activity`),
                INDEX `idx_is_active` (`is_active`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Chat groups table
        'groups' => "
            CREATE TABLE IF NOT EXISTS `groups` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `name` VARCHAR(100) NOT NULL,
                `description` TEXT NULL,
                `avatar` VARCHAR(255) NULL,
                `is_public` BOOLEAN DEFAULT FALSE,
                `max_members` INT DEFAULT 100,
                `created_by` INT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                INDEX `idx_created_by` (`created_by`),
                INDEX `idx_is_public` (`is_public`),
                INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Group members table
        'group_members' => "
            CREATE TABLE IF NOT EXISTS `group_members` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `group_id` INT NOT NULL,
                `user_id` INT NOT NULL,
                `role` ENUM('member', 'moderator', 'admin') DEFAULT 'member',
                `is_banned` BOOLEAN DEFAULT FALSE,
                `banned_until` TIMESTAMP NULL,
                `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `left_at` TIMESTAMP NULL,
                FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `unique_member` (`group_id`, `user_id`),
                INDEX `idx_group_id` (`group_id`),
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_role` (`role`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Messages table
        'messages' => "
            CREATE TABLE IF NOT EXISTS `messages` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `content` TEXT NULL,
                `message_type` ENUM('text', 'image', 'video', 'audio', 'file') DEFAULT 'text',
                `file_path` VARCHAR(500) NULL,
                `file_size` INT NULL,
                `file_type` VARCHAR(100) NULL,
                `is_encrypted` BOOLEAN DEFAULT FALSE,
                `reply_to_id` INT NULL,
                `group_id` INT NULL,
                `recipient_id` INT NULL,
                `edited_at` TIMESTAMP NULL,
                `deleted_at` TIMESTAMP NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`reply_to_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
                FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_created_at` (`created_at`),
                INDEX `idx_message_type` (`message_type`),
                INDEX `idx_deleted_at` (`deleted_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Message reactions table
        'message_reactions' => "
            CREATE TABLE IF NOT EXISTS `message_reactions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `message_id` INT NOT NULL,
                `user_id` INT NOT NULL,
                `emoji` VARCHAR(10) NOT NULL,
                `group_id` INT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `unique_reaction` (`message_id`, `user_id`, `emoji`),
                INDEX `idx_message_id` (`message_id`),
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_group_id` (`group_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Rate limits table
        'rate_limits' => "
            CREATE TABLE IF NOT EXISTS `rate_limits` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(255) NOT NULL,
                `action_type` VARCHAR(50) NOT NULL,
                `attempts` INT DEFAULT 1,
                `window_start` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY `unique_rate_limit` (`identifier`, `action_type`),
                INDEX `idx_window_start` (`window_start`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Audit logs table
        'audit_logs' => "
            CREATE TABLE IF NOT EXISTS `audit_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NULL,
                `event_type` VARCHAR(50) NOT NULL,
                `event_data` JSON NULL,
                `ip_address` VARCHAR(45) NOT NULL,
                `user_agent` TEXT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_event_type` (`event_type`),
                INDEX `idx_created_at` (`created_at`),
                INDEX `idx_ip_address` (`ip_address`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Notifications table
        'notifications' => "
            CREATE TABLE IF NOT EXISTS `notifications` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `type` VARCHAR(50) NOT NULL,
                `title` VARCHAR(255) NOT NULL,
                `message` TEXT NOT NULL,
                `data` JSON NULL,
                `is_read` BOOLEAN DEFAULT FALSE,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `read_at` TIMESTAMP NULL,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_is_read` (`is_read`),
                INDEX `idx_type` (`type`),
                INDEX `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // File uploads table
        'file_uploads' => "
            CREATE TABLE IF NOT EXISTS `file_uploads` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_id` INT NOT NULL,
                `original_filename` VARCHAR(255) NOT NULL,
                `stored_filename` VARCHAR(255) NOT NULL,
                `file_path` VARCHAR(500) NOT NULL,
                `file_size` INT NOT NULL,
                `mime_type` VARCHAR(100) NOT NULL,
                `file_hash` VARCHAR(64) NOT NULL,
                `upload_type` VARCHAR(50) NOT NULL,
                `is_deleted` BOOLEAN DEFAULT FALSE,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                INDEX `idx_user_id` (`user_id`),
                INDEX `idx_file_hash` (`file_hash`),
                INDEX `idx_upload_type` (`upload_type`),
                INDEX `idx_is_deleted` (`is_deleted`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Group invites table
        'group_invites' => "
            CREATE TABLE IF NOT EXISTS `group_invites` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `group_id` INT NOT NULL,
                `created_by` INT NOT NULL,
                `invite_code` VARCHAR(32) NOT NULL,
                `max_uses` INT NULL,
                `current_uses` INT DEFAULT 0,
                `expires_at` TIMESTAMP NULL,
                `is_active` BOOLEAN DEFAULT TRUE,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `uk_invite_code` (`invite_code`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ",
        
        // Message read receipts
        'message_read_receipts' => "
            CREATE TABLE IF NOT EXISTS `message_read_receipts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `message_id` INT NOT NULL,
                `user_id` INT NOT NULL,
                `read_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
                FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
                UNIQUE KEY `unique_read_receipt` (`message_id`, `user_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "
    ];
    
    // Create tables
    foreach ($tables as $tableName => $sql) {
        try {
            $connection->exec($sql);
            echo "Table '$tableName' created successfully\n";
        } catch (PDOException $e) {
            echo "Error creating table '$tableName': " . $e->getMessage() . "\n";
            exit(1);
        }
    }
    
    // Re-enable foreign key checks
    $connection->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    echo "=== Initializing Data ===\n";
    
    // Create admin user
    $adminUsername = 'admin';
    $adminEmail = 'admin@quickchat.local';
    $adminPassword = 'Admin@123'; // Default password, should be changed immediately
    
    // Check if admin user already exists
    $stmt = $connection->prepare("SELECT id FROM users WHERE username = :username OR email = :email");
    $stmt->execute([
        'username' => $adminUsername,
        'email' => $adminEmail
    ]);
    
    if ($stmt->rowCount() == 0) {
        // Create admin user
        $hashedPassword = password_hash($adminPassword . Config::getPasswordPepper(), PASSWORD_ARGON2ID);
        
        $stmt = $connection->prepare("
            INSERT INTO users (username, email, password_hash, display_name, email_verified, is_active, created_at)
            VALUES (:username, :email, :password_hash, 'Admin User', true, true, NOW())
        ");
        
        $stmt->execute([
            'username' => $adminUsername,
            'email' => $adminEmail,
            'password_hash' => $hashedPassword
        ]);
        
        $adminId = $connection->lastInsertId();
        
        // Create default user settings for admin
        $defaultSettings = [
            'theme' => 'dark',
            'notifications_enabled' => 'true',
            'sound_enabled' => 'true',
            'desktop_notifications' => 'true'
        ];
        
        foreach ($defaultSettings as $key => $value) {
            $stmt = $connection->prepare("
                INSERT INTO user_settings (user_id, setting_key, setting_value, created_at)
                VALUES (:user_id, :setting_key, :setting_value, NOW())
            ");
            
            $stmt->execute([
                'user_id' => $adminId,
                'setting_key' => $key,
                'setting_value' => $value
            ]);
        }
        
        echo "Admin user created successfully with username: $adminUsername and password: $adminPassword\n";
        echo "IMPORTANT: Please change the admin password after first login!\n";
    } else {
        echo "Admin user already exists\n";
    }
    
    // Create Welcome group
    $stmt = $connection->prepare("SELECT id FROM `groups` WHERE name = 'Welcome'");
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        // Get admin ID
        $stmt = $connection->prepare("SELECT id FROM users WHERE username = :username");
        $stmt->execute(['username' => $adminUsername]);
        $admin = $stmt->fetch();
        
        if ($admin) {
            // Create welcome group
            $stmt = $connection->prepare("
                INSERT INTO `groups` (name, description, created_by, is_public, created_at)
                VALUES ('Welcome', 'Welcome to Quick Chat! This is a public group for all users.', :created_by, true, NOW())
            ");
            
            $stmt->execute([
                'created_by' => $admin['id']
            ]);
            
            $groupId = $connection->lastInsertId();
            
            // Add admin as group member
            $stmt = $connection->prepare("
                INSERT INTO group_members (group_id, user_id, role, joined_at)
                VALUES (:group_id, :user_id, 'admin', NOW())
            ");
            
            $stmt->execute([
                'group_id' => $groupId,
                'user_id' => $admin['id']
            ]);
            
            // Add welcome message
            $stmt = $connection->prepare("
                INSERT INTO messages (group_id, user_id, content, message_type, created_at)
                VALUES (:group_id, :user_id, 'Welcome to Quick Chat! This is the beginning of the group chat history.', 'text', NOW())
            ");
            
            $stmt->execute([
                'group_id' => $groupId,
                'user_id' => $admin['id']
            ]);
            
            echo "Welcome group created successfully\n";
        }
    } else {
        echo "Welcome group already exists\n";
    }
    
    // Create a backup of the fresh database
    $backupDir = __DIR__ . '/../backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $backupFile = $backupDir . '/backup_' . date('Y-m-d_H-i-s') . '.sql';
    echo "Creating initial database backup at: $backupFile\n";
    
    $dbHost = Config::getDbHost();
    $dbPort = Config::getDbPort();
    $dbUser = Config::getDbUser();
    $dbPass = Config::getDbPass();
    $dbName = Config::getDbName();
    
    $command = sprintf(
        'mysqldump --host=%s --port=%d --user=%s --password=%s --single-transaction --routines --triggers %s > %s 2>/dev/null',
        escapeshellarg($dbHost),
        $dbPort,
        escapeshellarg($dbUser),
        escapeshellarg($dbPass),
        escapeshellarg($dbName),
        escapeshellarg($backupFile)
    );
    
    $output = [];
    $returnCode = 0;
    exec($command, $output, $returnCode);
    
    if ($returnCode === 0) {
        echo "Initial database backup created successfully\n";
    } else {
        echo "Warning: Failed to create initial database backup\n";
    }
    
    echo "\nAll tables have been created successfully.\n";
    echo "Initial data has been set up.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Database setup completed successfully at " . date('Y-m-d H:i:s') . ".\n";
?>
