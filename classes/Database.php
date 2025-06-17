<?php
require_once __DIR__ . '/../config/config.php';

class Database {
    private static $instance = null;
    private static $connectionPool = [];
    private static $poolSize = 10;
    private static $activeConnections = 0;
    private $connection;
    
    private function __construct() {
        $this->connection = $this->createConnection();
    }
    
    /**    public function cleanup() {
        // Clean expired sessions
        $this->query("DELETE FROM sessions WHERE expires_at < NOW()");
        
        // Clean expired user sessions
        $this->query("DELETE FROM user_sessions WHERE expires_at < NOW()");
        
        // Clean old rate limit records (older than 1 hour)
        $this->query("DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
        
        // Clean old audit logs (older than 90 days)
        $this->query("DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        
        // Update offline status for users who haven't been seen in 5 minutes
        $this->query("UPDATE users SET is_online = FALSE WHERE last_seen < DATE_SUB(NOW(), INTERVAL 5 MINUTE) AND is_online = TRUE");
    }e a new database connection
     * @return PDO Database connection
     */
    private function createConnection() {
        try {
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES " . Config::getDbCharset(),
                // Connection pooling optimizations
                PDO::ATTR_PERSISTENT => true,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::ATTR_TIMEOUT => 30,
                PDO::MYSQL_ATTR_COMPRESS => true
            ];
            
            // Add SSL options if SSL is enabled
            if (Config::isDbSslEnabled()) {
                $caPath = __DIR__ . '/../' . Config::getDbSslCaPath();
                if (file_exists($caPath)) {
                    $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
                    // For cloud database providers like Aiven, sometimes we need to set this to false
                    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
                } else {
                    error_log("SSL CA certificate not found at: " . $caPath);
                    throw new Exception("SSL CA certificate not found");
                }
            }
            
            $connection = new PDO(
                Config::getDSN(),
                Config::getDbUser(),
                Config::getDbPass(),
                $options
            );
            
            // Set connection-specific optimizations
            $connection->exec("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
            $connection->exec("SET SESSION innodb_lock_wait_timeout=10");
            
            return $connection;
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed");
        }
    }
    
    /**
     * Get a connection from the pool or create a new one
     * @return PDO Database connection
     */
    public static function getPooledConnection() {
        // If pool is empty and we haven't reached max connections, create new
        if (empty(self::$connectionPool) && self::$activeConnections < self::$poolSize) {
            $db = new self();
            self::$activeConnections++;
            return $db->connection;
        }
        
        // Get connection from pool if available
        if (!empty(self::$connectionPool)) {
            return array_pop(self::$connectionPool);
        }
        
        // If pool is full, wait and retry or return singleton instance
        return self::getInstance()->getConnection();
    }
    
    /**
     * Return connection to pool
     * @param PDO $connection Connection to return
     */
    public static function returnToPool(PDO $connection) {
        // Check if connection is still valid
        try {
            $connection->query('SELECT 1');
            if (count(self::$connectionPool) < self::$poolSize) {
                self::$connectionPool[] = $connection;
            } else {
                // Pool is full, let connection close naturally
                self::$activeConnections--;
            }
        } catch (Exception $e) {
            // Connection is invalid, don't return to pool
            self::$activeConnections--;
            error_log("Invalid connection not returned to pool: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            error_log("Query failed: " . $e->getMessage() . " SQL: " . $sql);
            
            // Load config to check debug mode
            require_once __DIR__ . '/../config/config.php';
            
            // Provide more specific error message while hiding sensitive SQL details in production
            if (Config::isDebugMode()) {
                throw new Exception("Query execution failed: " . $e->getMessage() . " (SQL: " . $sql . ")");
            } else {
                // Map common errors to user-friendly messages
                $errorCode = $e->getCode();
                $errorMessage = $e->getMessage();
                
                if (strpos($errorMessage, 'Duplicate entry') !== false) {
                    throw new Exception("Duplicate entry error");
                } elseif (strpos($errorMessage, 'doesn\'t exist') !== false) {
                    throw new Exception("Database table missing");
                } elseif (strpos($errorMessage, 'Connection') !== false) {
                    throw new Exception("Database connection error");
                } elseif (strpos($errorMessage, 'Access denied') !== false) {
                    throw new Exception("Database access denied");
                } else {
                    throw new Exception("Database query failed: " . $errorMessage);
                }
            }
        }
    }
    
    public function fetch($sql, $params = []) {
        return $this->query($sql, $params)->fetch();
    }
    
    public function fetchAll($sql, $params = []) {
        return $this->query($sql, $params)->fetchAll();
    }
    
    public function lastInsertId() {
        return $this->connection->lastInsertId();
    }
    
    public function beginTransaction() {
        return $this->connection->beginTransaction();
    }
    
    public function commit() {
        return $this->connection->commit();
    }
    
    public function rollback() {
        return $this->connection->rollback();
    }
    
    public function prepare($sql) {
        try {
            return $this->connection->prepare($sql);
        } catch (PDOException $e) {
            error_log("Prepare failed: " . $e->getMessage() . " SQL: " . $sql);
            throw new Exception("Statement preparation failed: " . $e->getMessage());
        }
    }
    
    public function exec($sql) {
        try {
            return $this->connection->exec($sql);
        } catch (PDOException $e) {
            error_log("Exec failed: " . $e->getMessage() . " SQL: " . $sql);
            throw new Exception("Statement execution failed: " . $e->getMessage());
        }
    }
    
    public function createTables() {
        $tables = [
            'users' => "
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    avatar VARCHAR(255) DEFAULT NULL,
                    display_name VARCHAR(100) NOT NULL,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_online BOOLEAN DEFAULT FALSE,
                    email_verified BOOLEAN DEFAULT FALSE,
                    verification_token VARCHAR(255) DEFAULT NULL,
                    reset_token VARCHAR(255) DEFAULT NULL,
                    reset_token_expires TIMESTAMP NULL,
                    failed_login_attempts INT DEFAULT 0,
                    locked_until TIMESTAMP NULL,
                    google_id VARCHAR(255) DEFAULT NULL,
                    google_email VARCHAR(255) DEFAULT NULL,
                    google_name VARCHAR(255) DEFAULT NULL,
                    google_picture VARCHAR(500) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_username (username),
                    INDEX idx_email (email),
                    INDEX idx_last_seen (last_seen),
                    INDEX idx_google_id (google_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
            'messages' => "
                CREATE TABLE IF NOT EXISTS messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    content TEXT,
                    message_type ENUM('text', 'image', 'video', 'audio', 'file') DEFAULT 'text',
                    file_path VARCHAR(500) DEFAULT NULL,
                    file_size INT DEFAULT NULL,
                    file_type VARCHAR(100) DEFAULT NULL,
                    is_encrypted BOOLEAN DEFAULT FALSE,
                    reply_to_id INT DEFAULT NULL,
                    edited_at TIMESTAMP NULL,
                    deleted_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_created_at (created_at),
                    INDEX idx_reply_to (reply_to_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
            'sessions' => "
                CREATE TABLE IF NOT EXISTS sessions (
                    id VARCHAR(128) PRIMARY KEY,
                    user_id INT NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    is_remember_token BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_expires_at (expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
            'user_sessions' => "
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_id VARCHAR(128) NOT NULL UNIQUE,
                    user_id INT NOT NULL,
                    login_type VARCHAR(50) DEFAULT 'password',
                    expires_at TIMESTAMP NOT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    INDEX idx_user_id (user_id),
                    INDEX idx_session_id (session_id),
                    INDEX idx_expires_at (expires_at),
                    INDEX idx_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
            'user_settings' => "
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    setting_key VARCHAR(100) NOT NULL,
                    setting_value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_user_setting (user_id, setting_key),
                    INDEX idx_user_id (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
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
            ",
            
            'message_reactions' => "
                CREATE TABLE IF NOT EXISTS message_reactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    message_id INT NOT NULL,
                    user_id INT NOT NULL,
                    reaction VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_reaction (message_id, user_id, reaction),
                    INDEX idx_message_id (message_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ",
            
            'audit_logs' => "
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT DEFAULT NULL,
                    action VARCHAR(100) NOT NULL,
                    details JSON DEFAULT NULL,
                    ip_address VARCHAR(45) NOT NULL,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_action (action),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            "
        ];
        
        foreach ($tables as $tableName => $sql) {
            try {
                $this->connection->exec($sql);
                error_log("Table '$tableName' created successfully");
            } catch (PDOException $e) {
                error_log("Failed to create table '$tableName': " . $e->getMessage());
                throw new Exception("Failed to create database tables");
            }
        }
        
        return true;
    }
    
    public function cleanup() {
        // Clean expired sessions
        $this->query("DELETE FROM sessions WHERE expires_at < NOW()");
        
        // Clean old rate limit records (older than 1 hour)
        $this->query("DELETE FROM rate_limits WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR)");
        
        // Clean old audit logs (older than 90 days)
        $this->query("DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        
        // Update offline status for users who haven't been seen in 5 minutes
        $this->query("UPDATE users SET is_online = FALSE WHERE last_seen < DATE_SUB(NOW(), INTERVAL 5 MINUTE) AND is_online = TRUE");
    }
}
?>
