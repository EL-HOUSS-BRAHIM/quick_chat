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
        try {
            // Instead of maintaining duplicate table definitions,
            // use the comprehensive create_tables.php script
            $scriptPath = __DIR__ . '/../scripts/create_tables.php';
            
            if (!file_exists($scriptPath)) {
                throw new Exception("Table creation script not found at: $scriptPath");
            }
            
            // Execute the script directly via include
            // Pass a parameter to bypass interactive confirmation
            global $argv;
            $argv[1] = 'skip-confirmation';
            
            ob_start();
            include $scriptPath;
            $output = ob_get_clean();
            
            error_log("Tables created successfully via create_tables.php script");
            
            return true;
        } catch (Exception $e) {
            error_log("Failed to create database tables: " . $e->getMessage());
            throw new Exception("Failed to create database tables: " . $e->getMessage());
        }
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
