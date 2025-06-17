<?php
/**
 * Quick Chat - Database Tables Deletion Script
 * 
 * This script drops all tables in the Quick Chat database.
 * WARNING: This will permanently delete all data!
 * 
 * Date: June 17, 2025
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../classes/Database.php';

// Confirm execution
if (php_sapi_name() !== 'cli') {
    die("This script can only be run from the command line");
}

echo "=== Quick Chat Database Cleanup ===\n";
echo "Started at: " . date('Y-m-d H:i:s') . "\n";
echo "Database: " . Config::getDbName() . " on " . Config::getDbHost() . "\n\n";

echo "WARNING: This script will DROP ALL TABLES in the database '" . Config::getDbName() . "'.\n";
echo "All data will be permanently deleted.\n";
echo "Type 'YES' to continue: ";
$handle = fopen("php://stdin", "r");
$line = trim(fgets($handle));
if ($line !== 'YES') {
    echo "Aborting...\n";
    exit;
}

try {
    $db = Database::getInstance();
    $connection = $db->getConnection();
    
    // Create backup before dropping tables
    $backupDir = __DIR__ . '/../backups';
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $backupFile = $backupDir . '/backup_before_drop_' . date('Y-m-d_H-i-s') . '.sql';
    echo "Creating backup before dropping tables: $backupFile\n";
    
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
        echo "Backup created successfully\n";
    } else {
        echo "Warning: Failed to create backup. Do you want to continue? (YES/no): ";
        $handle = fopen("php://stdin", "r");
        $line = trim(fgets($handle));
        if ($line !== 'YES') {
            echo "Aborting...\n";
            exit;
        }
    }
    
    // Disable foreign key checks to avoid constraint issues
    $connection->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Get all tables in the database
    $stmt = $connection->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tables)) {
        echo "No tables found in the database.\n";
    } else {
        echo "Dropping " . count($tables) . " tables...\n";
        
        foreach ($tables as $table) {
            $connection->exec("DROP TABLE `$table`");
            echo "Dropped table: $table\n";
        }
        
        echo "All tables have been dropped successfully.\n";
    }
    
    // Re-enable foreign key checks
    $connection->exec("SET FOREIGN_KEY_CHECKS = 1");
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Operation completed at " . date('Y-m-d H:i:s') . ".\n";
echo "To recreate the database tables, run: php create_tables.php\n";
?>
