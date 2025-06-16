<?php
require_once __DIR__ . '/classes/Database.php';

try {
    // Display SSL configuration
    echo "SSL Configuration:\n";
    echo "SSL Enabled: " . (Config::isDbSslEnabled() ? "Yes" : "No") . "\n";
    echo "SSL CA Path: " . Config::getDbSslCaPath() . "\n";
    $caPath = __DIR__ . '/' . Config::getDbSslCaPath();
    echo "CA File exists: " . (file_exists($caPath) ? "Yes" : "No") . "\n";
    echo "Database host: " . Config::getDbHost() . "\n";
    echo "Database name: " . Config::getDbName() . "\n\n";
    
    // Get database instance
    $db = Database::getInstance();
    $connection = $db->getConnection();
    
    // Check if connection is successful
    echo "Connection successful!\n";
    
    // Get database server version to confirm connection
    $version = $connection->getAttribute(PDO::ATTR_SERVER_VERSION);
    echo "Database server version: " . $version . "\n";
    
    // Check SSL status
    $sslStatus = $connection->query("SHOW STATUS LIKE 'Ssl_cipher'")->fetch();
    if (!empty($sslStatus['Value'])) {
        echo "SSL is enabled. Cipher: " . $sslStatus['Value'] . "\n";
    } else {
        echo "SSL is NOT enabled for this connection.\n";
    }
    
    // Show all SSL related information
    echo "\nDetailed SSL Information:\n";
    $sslInfo = $connection->query("SHOW STATUS LIKE 'Ssl_%'")->fetchAll();
    foreach ($sslInfo as $info) {
        echo $info['Variable_name'] . ": " . $info['Value'] . "\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    
    // Show more detailed error info
    if ($e instanceof PDOException) {
        echo "PDO Error Code: " . $e->getCode() . "\n";
        if (isset($e->errorInfo)) {
            echo "SQL Error: " . implode(", ", $e->errorInfo) . "\n";
        }
    }
}
?>
