<?php
/**
 * Database Migration Script
 * Adds missing columns and tables to existing database
 */

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../config/config.php';

class DatabaseMigration {
    private $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    public function migrate() {
        echo "Starting database migration...\n";
        
        try {
            $this->addGoogleSSOColumns();
            $this->createMissingTables();
            echo "Migration completed successfully!\n";
        } catch (Exception $e) {
            echo "Migration failed: " . $e->getMessage() . "\n";
            return false;
        }
        
        return true;
    }
    
    private function addGoogleSSOColumns() {
        echo "Adding Google SSO columns to users table...\n";
        
        $columns = [
            'google_id' => "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL",
            'google_email' => "ALTER TABLE users ADD COLUMN google_email VARCHAR(255) DEFAULT NULL", 
            'google_name' => "ALTER TABLE users ADD COLUMN google_name VARCHAR(255) DEFAULT NULL",
            'google_picture' => "ALTER TABLE users ADD COLUMN google_picture VARCHAR(500) DEFAULT NULL"
        ];
        
        foreach ($columns as $columnName => $sql) {
            if (!$this->columnExists('users', $columnName)) {
                try {
                    $this->db->query($sql);
                    echo "Added column: $columnName\n";
                } catch (Exception $e) {
                    echo "Failed to add column $columnName: " . $e->getMessage() . "\n";
                }
            } else {
                echo "Column $columnName already exists\n";
            }
        }
        
        // Add index for google_id
        if (!$this->indexExists('users', 'idx_google_id')) {
            try {
                $this->db->query("ALTER TABLE users ADD INDEX idx_google_id (google_id)");
                echo "Added index: idx_google_id\n";
            } catch (Exception $e) {
                echo "Failed to add index idx_google_id: " . $e->getMessage() . "\n";
            }
        }
    }
    
    private function createMissingTables() {
        echo "Creating missing tables...\n";
        
        $tables = [
            'file_uploads' => "
                CREATE TABLE IF NOT EXISTS file_uploads (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    message_id INT DEFAULT NULL,
                    group_id INT DEFAULT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    stored_filename VARCHAR(255) NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    file_type VARCHAR(100) NOT NULL,
                    file_size INT NOT NULL,
                    file_hash VARCHAR(64) DEFAULT NULL,
                    thumbnail_path VARCHAR(500) DEFAULT NULL,
                    mime_type VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_message_id (message_id),
                    INDEX idx_file_hash (file_hash),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            'rate_limits' => "
                CREATE TABLE IF NOT EXISTS rate_limits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    identifier VARCHAR(255) NOT NULL,
                    endpoint VARCHAR(100) NOT NULL,
                    window_start TIMESTAMP NOT NULL,
                    request_count INT DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_identifier_endpoint (identifier, endpoint),
                    INDEX idx_window_start (window_start)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            "
        ];
        
        foreach ($tables as $tableName => $sql) {
            if (!$this->tableExists($tableName)) {
                try {
                    $this->db->query($sql);
                    echo "Created table: $tableName\n";
                } catch (Exception $e) {
                    echo "Failed to create table $tableName: " . $e->getMessage() . "\n";
                }
            } else {
                echo "Table $tableName already exists\n";
            }
        }
    }
    
    private function tableExists($tableName) {
        $result = $this->db->query("SHOW TABLES LIKE ?", [$tableName]);
        return $result->rowCount() > 0;
    }
    
    private function columnExists($tableName, $columnName) {
        $result = $this->db->query("SHOW COLUMNS FROM `$tableName` LIKE ?", [$columnName]);
        return $result->rowCount() > 0;
    }
    
    private function indexExists($tableName, $indexName) {
        $result = $this->db->query("SHOW INDEX FROM `$tableName` WHERE Key_name = ?", [$indexName]);
        return $result->rowCount() > 0;
    }
}

// Run migration if called directly
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $migration = new DatabaseMigration();
    $migration->migrate();
}
?>
