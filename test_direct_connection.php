<?php
// Direct connection to MySQL for testing
$host = "//";
$port = //;
$dbname = "//";
$username = "//";
$password = "//";
$ca_cert = __DIR__ . "///////";

echo "Connecting to: $host:$port/$dbname\n";
echo "Using CA cert: $ca_cert (exists: " . (file_exists($ca_cert) ? "Yes" : "No") . ")\n";

try {
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4",
        PDO::MYSQL_ATTR_SSL_CA => $ca_cert,
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => false
    ];
    
    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password, $options);
    
    echo "Connection successful!\n";
    
    // Test query
    $stmt = $pdo->query("SELECT VERSION() as version");
    $version = $stmt->fetch();
    echo "MySQL Version: " . $version['version'] . "\n";
    
    // Check SSL status
    $sslStatus = $pdo->query("SHOW STATUS LIKE 'Ssl_cipher'")->fetch();
    if (!empty($sslStatus['Value'])) {
        echo "SSL is enabled. Cipher: " . $sslStatus['Value'] . "\n";
    } else {
        echo "SSL is NOT enabled for this connection.\n";
    }
    
} catch (PDOException $e) {
    echo "Connection failed: " . $e->getMessage() . "\n";
}
?>
