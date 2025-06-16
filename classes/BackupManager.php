<?php
/**
 * Backup and Recovery System for Quick Chat
 * Automated database and file backups with recovery capabilities
 */

class BackupManager {
    private $config;
    private $logger;
    private $backupPath;
    private $s3Client;
    
    public function __construct() {
        require_once __DIR__ . '/../config/production-config.php';
        require_once __DIR__ . '/PerformanceMonitor.php';
        
        $this->config = ProductionConfig::getInstance();
        $this->logger = PerformanceMonitor::getInstance();
        $this->backupPath = $this->config->get('backup.storage_path', '/var/backups/quickchat/');
        
        // Initialize S3 client if enabled
        if ($this->config->get('backup.s3_enabled')) {
            $this->initializeS3Client();
        }
        
        // Ensure backup directories exist
        $this->createBackupDirectories();
    }
    
    /**
     * Initialize AWS S3 client for remote backups
     */
    private function initializeS3Client() {
        try {
            // Check if AWS SDK is available
            if (!class_exists('Aws\S3\S3Client')) {
                $this->logger->log('warning', 'AWS SDK not available, S3 backups disabled');
                $this->s3Client = null;
                return;
            }
            
            $this->s3Client = new Aws\S3\S3Client([
                'version' => 'latest',
                'region' => $this->config->get('backup.s3_region', 'us-east-1'),
                'credentials' => [
                    'key' => $this->config->get('aws.access_key_id'),
                    'secret' => $this->config->get('aws.secret_access_key'),
                ]
            ]);
            
            $this->logger->log('info', 'S3 client initialized for backups');
        } catch (Exception $e) {
            $this->logger->log('error', 'Failed to initialize S3 client', ['error' => $e->getMessage()]);
            $this->s3Client = null;
        }
    }
    
    /**
     * Create necessary backup directories
     */
    private function createBackupDirectories() {
        $directories = [
            $this->backupPath,
            $this->backupPath . 'database/',
            $this->backupPath . 'files/',
            $this->backupPath . 'config/',
            $this->backupPath . 'logs/',
            $this->backupPath . 'temp/'
        ];
        
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                if (!mkdir($dir, 0755, true)) {
                    throw new Exception("Failed to create backup directory: $dir");
                }
            }
        }
    }
    
    /**
     * Perform a complete backup (database + files)
     */
    public function performFullBackup($options = []) {
        $backupId = 'backup_' . date('Y-m-d_H-i-s') . '_' . uniqid();
        $this->logger->log('info', 'Starting full backup', ['backup_id' => $backupId]);
        
        $startTime = microtime(true);
        $results = [
            'backup_id' => $backupId,
            'timestamp' => date('Y-m-d H:i:s'),
            'database' => null,
            'files' => null,
            'config' => null,
            'total_size' => 0,
            'duration' => 0,
            'success' => false
        ];
        
        try {
            // Backup database
            $results['database'] = $this->backupDatabase($backupId, $options);
            
            // Backup files
            $results['files'] = $this->backupFiles($backupId, $options);
            
            // Backup configuration
            $results['config'] = $this->backupConfiguration($backupId, $options);
            
            // Calculate total size
            $results['total_size'] = $this->calculateBackupSize($backupId);
            
            // Upload to S3 if enabled
            if ($this->config->get('backup.s3_enabled') && $this->s3Client) {
                $this->uploadToS3($backupId);
            }
            
            // Create backup manifest
            $this->createBackupManifest($backupId, $results);
            
            // Cleanup old backups
            $this->cleanupOldBackups();
            
            $results['success'] = true;
            $results['duration'] = microtime(true) - $startTime;
            
            $this->logger->log('info', 'Full backup completed successfully', $results);
            
        } catch (Exception $e) {
            $results['error'] = $e->getMessage();
            $results['duration'] = microtime(true) - $startTime;
            
            $this->logger->log('error', 'Full backup failed', [
                'backup_id' => $backupId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Cleanup failed backup
            $this->cleanupFailedBackup($backupId);
        }
        
        return $results;
    }
    
    /**
     * Backup database
     */
    public function backupDatabase($backupId = null, $options = []) {
        if (!$backupId) {
            $backupId = 'db_backup_' . date('Y-m-d_H-i-s');
        }
        
        $this->logger->log('info', 'Starting database backup', ['backup_id' => $backupId]);
        
        $dbConfig = [
            'host' => $this->config->get('database.host'),
            'port' => $this->config->get('database.port'),
            'name' => $this->config->get('database.name'),
            'user' => $this->config->get('database.username'),
            'pass' => $this->config->get('database.password')
        ];
        
        $backupFile = $this->backupPath . "database/{$backupId}.sql";
        $compressedFile = $backupFile . '.gz';
        
        // Build mysqldump command
        $command = sprintf(
            'mysqldump --host=%s --port=%s --user=%s --password=%s --single-transaction --routines --triggers --events --add-drop-database --databases %s > %s 2>&1',
            escapeshellarg($dbConfig['host']),
            escapeshellarg($dbConfig['port']),
            escapeshellarg($dbConfig['user']),
            escapeshellarg($dbConfig['pass']),
            escapeshellarg($dbConfig['name']),
            escapeshellarg($backupFile)
        );
        
        // Execute backup
        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Database backup failed: ' . implode("\n", $output));
        }
        
        // Verify backup file exists and has content
        if (!file_exists($backupFile) || filesize($backupFile) === 0) {
            throw new Exception('Database backup file is empty or does not exist');
        }
        
        $originalSize = filesize($backupFile);
        
        // Compress the backup
        if (function_exists('gzencode')) {
            $data = file_get_contents($backupFile);
            $compressed = gzencode($data, 9);
            
            if (file_put_contents($compressedFile, $compressed)) {
                unlink($backupFile); // Remove uncompressed version
                $backupFile = $compressedFile;
            }
        }
        
        $finalSize = filesize($backupFile);
        $compressionRatio = $originalSize > 0 ? (1 - $finalSize / $originalSize) * 100 : 0;
        
        $result = [
            'file' => $backupFile,
            'size' => $finalSize,
            'original_size' => $originalSize,
            'compression_ratio' => round($compressionRatio, 2),
            'checksum' => hash_file('sha256', $backupFile),
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        $this->logger->log('info', 'Database backup completed', $result);
        
        return $result;
    }
    
    /**
     * Backup files (uploads, logs, etc.)
     */
    public function backupFiles($backupId = null, $options = []) {
        if (!$backupId) {
            $backupId = 'files_backup_' . date('Y-m-d_H-i-s');
        }
        
        $this->logger->log('info', 'Starting file backup', ['backup_id' => $backupId]);
        
        $backupFile = $this->backupPath . "files/{$backupId}.tar.gz";
        $projectRoot = dirname(__DIR__);
        
        // Define directories to backup
        $backupDirs = [
            'uploads/',
            'logs/',
            'config/',
            'assets/',
            '*.php',
            '*.js',
            '*.css',
            '*.html',
            '*.md',
            '*.json',
            '*.txt'
        ];
        
        // Build tar command
        $includes = array_map(function($dir) {
            return escapeshellarg($dir);
        }, $backupDirs);
        
        $excludes = [
            '--exclude=.git',
            '--exclude=node_modules',
            '--exclude=vendor',
            '--exclude=.env',
            '--exclude=*.log',
            '--exclude=cache/*',
            '--exclude=temp/*'
        ];
        
        $command = sprintf(
            'cd %s && tar -czf %s %s %s 2>&1',
            escapeshellarg($projectRoot),
            escapeshellarg($backupFile),
            implode(' ', $excludes),
            implode(' ', $includes)
        );
        
        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('File backup failed: ' . implode("\n", $output));
        }
        
        if (!file_exists($backupFile)) {
            throw new Exception('File backup archive was not created');
        }
        
        $result = [
            'file' => $backupFile,
            'size' => filesize($backupFile),
            'checksum' => hash_file('sha256', $backupFile),
            'timestamp' => date('Y-m-d H:i:s'),
            'directories' => $backupDirs
        ];
        
        $this->logger->log('info', 'File backup completed', $result);
        
        return $result;
    }
    
    /**
     * Backup configuration files
     */
    public function backupConfiguration($backupId = null, $options = []) {
        if (!$backupId) {
            $backupId = 'config_backup_' . date('Y-m-d_H-i-s');
        }
        
        $this->logger->log('info', 'Starting configuration backup', ['backup_id' => $backupId]);
        
        $backupFile = $this->backupPath . "config/{$backupId}.json";
        
        // Gather configuration data (excluding sensitive information)
        $configData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'backup_id' => $backupId,
            'environment' => $this->config->getEnvironment(),
            'app_version' => $this->config->get('app.version'),
            'php_version' => PHP_VERSION,
            'server_info' => [
                'hostname' => gethostname(),
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
                'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? '',
            ],
            'database_schema' => $this->getDatabaseSchema(),
            'installed_extensions' => get_loaded_extensions(),
            'file_permissions' => $this->getFilePermissions(),
            'cron_jobs' => $this->getCronJobs()
        ];
        
        if (file_put_contents($backupFile, json_encode($configData, JSON_PRETTY_PRINT)) === false) {
            throw new Exception('Failed to create configuration backup');
        }
        
        $result = [
            'file' => $backupFile,
            'size' => filesize($backupFile),
            'checksum' => hash_file('sha256', $backupFile),
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        $this->logger->log('info', 'Configuration backup completed', $result);
        
        return $result;
    }
    
    /**
     * Restore from backup
     */
    public function restore($backupId, $components = ['database', 'files', 'config']) {
        $this->logger->log('info', 'Starting restore process', [
            'backup_id' => $backupId,
            'components' => $components
        ]);
        
        $manifest = $this->loadBackupManifest($backupId);
        if (!$manifest) {
            throw new Exception("Backup manifest not found for backup ID: $backupId");
        }
        
        $results = [
            'backup_id' => $backupId,
            'restored_components' => [],
            'success' => false
        ];
        
        try {
            if (in_array('database', $components) && isset($manifest['database'])) {
                $this->restoreDatabase($manifest['database']);
                $results['restored_components'][] = 'database';
            }
            
            if (in_array('files', $components) && isset($manifest['files'])) {
                $this->restoreFiles($manifest['files']);
                $results['restored_components'][] = 'files';
            }
            
            if (in_array('config', $components) && isset($manifest['config'])) {
                $this->restoreConfiguration($manifest['config']);
                $results['restored_components'][] = 'config';
            }
            
            $results['success'] = true;
            $this->logger->log('info', 'Restore completed successfully', $results);
            
        } catch (Exception $e) {
            $results['error'] = $e->getMessage();
            $this->logger->log('error', 'Restore failed', [
                'backup_id' => $backupId,
                'error' => $e->getMessage()
            ]);
        }
        
        return $results;
    }
    
    /**
     * List available backups
     */
    public function listBackups($limit = 50) {
        $backups = [];
        $pattern = $this->backupPath . 'backup_*.json';
        $manifests = glob($pattern);
        
        // Sort by date (newest first)
        usort($manifests, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        
        foreach (array_slice($manifests, 0, $limit) as $manifestFile) {
            $manifest = json_decode(file_get_contents($manifestFile), true);
            if ($manifest) {
                $backups[] = [
                    'backup_id' => $manifest['backup_id'],
                    'timestamp' => $manifest['timestamp'],
                    'total_size' => $this->formatBytes($manifest['total_size']),
                    'duration' => $manifest['duration'],
                    'success' => $manifest['success'],
                    'components' => array_keys(array_filter([
                        'database' => $manifest['database'] ?? false,
                        'files' => $manifest['files'] ?? false,
                        'config' => $manifest['config'] ?? false
                    ]))
                ];
            }
        }
        
        return $backups;
    }
    
    /**
     * Schedule automated backups
     */
    public function scheduleBackups() {
        if (!$this->config->get('backup.enabled')) {
            $this->logger->log('info', 'Backup scheduling skipped (disabled in config)');
            return;
        }
        
        $schedule = $this->config->get('backup.schedule', '0 2 * * *'); // Default: daily at 2 AM
        $scriptPath = __DIR__ . '/../scripts/backup.php';
        
        // Create backup script
        $this->createBackupScript($scriptPath);
        
        // Add to crontab
        $cronCommand = "$schedule /usr/bin/php $scriptPath >> /var/log/quickchat/backup.log 2>&1";
        
        // Get current crontab
        $currentCron = shell_exec('crontab -l 2>/dev/null');
        
        // Check if backup job already exists
        if (strpos($currentCron, $scriptPath) === false) {
            $newCron = trim($currentCron) . "\n" . $cronCommand . "\n";
            
            // Write new crontab
            $tempFile = tempnam(sys_get_temp_dir(), 'cron');
            file_put_contents($tempFile, $newCron);
            exec("crontab $tempFile");
            unlink($tempFile);
            
            $this->logger->log('info', 'Backup cron job scheduled', ['schedule' => $schedule]);
        }
    }
    
    // Helper methods
    private function calculateBackupSize($backupId) {
        $totalSize = 0;
        $patterns = [
            $this->backupPath . "database/{$backupId}*",
            $this->backupPath . "files/{$backupId}*",
            $this->backupPath . "config/{$backupId}*"
        ];
        
        foreach ($patterns as $pattern) {
            foreach (glob($pattern) as $file) {
                $totalSize += filesize($file);
            }
        }
        
        return $totalSize;
    }
    
    private function uploadToS3($backupId) {
        if (!$this->s3Client) {
            throw new Exception('S3 client not initialized');
        }
        
        $bucket = $this->config->get('backup.s3_bucket');
        if (!$bucket) {
            throw new Exception('S3 bucket not configured');
        }
        
        $files = [
            $this->backupPath . "database/{$backupId}.sql.gz",
            $this->backupPath . "files/{$backupId}.tar.gz",
            $this->backupPath . "config/{$backupId}.json",
            $this->backupPath . "{$backupId}.json" // manifest
        ];
        
        foreach ($files as $file) {
            if (file_exists($file)) {
                $key = 'quickchat-backups/' . date('Y/m/d/') . basename($file);
                
                $this->s3Client->putObject([
                    'Bucket' => $bucket,
                    'Key' => $key,
                    'SourceFile' => $file,
                    'StorageClass' => 'STANDARD_IA'
                ]);
                
                $this->logger->log('info', 'File uploaded to S3', ['file' => $file, 'key' => $key]);
            }
        }
    }
    
    private function createBackupManifest($backupId, $results) {
        $manifestFile = $this->backupPath . "{$backupId}.json";
        
        if (file_put_contents($manifestFile, json_encode($results, JSON_PRETTY_PRINT)) === false) {
            throw new Exception('Failed to create backup manifest');
        }
    }
    
    private function loadBackupManifest($backupId) {
        $manifestFile = $this->backupPath . "{$backupId}.json";
        
        if (!file_exists($manifestFile)) {
            return null;
        }
        
        return json_decode(file_get_contents($manifestFile), true);
    }
    
    private function cleanupOldBackups() {
        $retentionDays = $this->config->get('backup.retention_days', 30);
        $cutoffTime = time() - ($retentionDays * 24 * 60 * 60);
        
        $patterns = [
            $this->backupPath . 'database/backup_*',
            $this->backupPath . 'files/backup_*',
            $this->backupPath . 'config/backup_*',
            $this->backupPath . 'backup_*.json'
        ];
        
        $deletedCount = 0;
        
        foreach ($patterns as $pattern) {
            foreach (glob($pattern) as $file) {
                if (filemtime($file) < $cutoffTime) {
                    if (unlink($file)) {
                        $deletedCount++;
                    }
                }
            }
        }
        
        if ($deletedCount > 0) {
            $this->logger->log('info', "Cleaned up $deletedCount old backup files");
        }
    }
    
    private function cleanupFailedBackup($backupId) {
        $patterns = [
            $this->backupPath . "database/{$backupId}*",
            $this->backupPath . "files/{$backupId}*",
            $this->backupPath . "config/{$backupId}*",
            $this->backupPath . "{$backupId}.json"
        ];
        
        foreach ($patterns as $pattern) {
            foreach (glob($pattern) as $file) {
                unlink($file);
            }
        }
    }
    
    private function restoreDatabase($databaseBackup) {
        $backupFile = $databaseBackup['file'];
        
        if (!file_exists($backupFile)) {
            throw new Exception("Database backup file not found: $backupFile");
        }
        
        // Verify checksum
        if (hash_file('sha256', $backupFile) !== $databaseBackup['checksum']) {
            throw new Exception('Database backup file checksum mismatch');
        }
        
        $dbConfig = [
            'host' => $this->config->get('database.host'),
            'port' => $this->config->get('database.port'),
            'name' => $this->config->get('database.name'),
            'user' => $this->config->get('database.username'),
            'pass' => $this->config->get('database.password')
        ];
        
        // Handle compressed files
        if (pathinfo($backupFile, PATHINFO_EXTENSION) === 'gz') {
            $command = sprintf(
                'gunzip -c %s | mysql --host=%s --port=%s --user=%s --password=%s %s',
                escapeshellarg($backupFile),
                escapeshellarg($dbConfig['host']),
                escapeshellarg($dbConfig['port']),
                escapeshellarg($dbConfig['user']),
                escapeshellarg($dbConfig['pass']),
                escapeshellarg($dbConfig['name'])
            );
        } else {
            $command = sprintf(
                'mysql --host=%s --port=%s --user=%s --password=%s %s < %s',
                escapeshellarg($dbConfig['host']),
                escapeshellarg($dbConfig['port']),
                escapeshellarg($dbConfig['user']),
                escapeshellarg($dbConfig['pass']),
                escapeshellarg($dbConfig['name']),
                escapeshellarg($backupFile)
            );
        }
        
        $output = [];
        $returnCode = 0;
        exec($command . ' 2>&1', $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Database restore failed: ' . implode("\n", $output));
        }
        
        $this->logger->log('info', 'Database restored successfully', ['file' => $backupFile]);
    }
    
    private function restoreFiles($filesBackup) {
        $backupFile = $filesBackup['file'];
        
        if (!file_exists($backupFile)) {
            throw new Exception("Files backup not found: $backupFile");
        }
        
        // Verify checksum
        if (hash_file('sha256', $backupFile) !== $filesBackup['checksum']) {
            throw new Exception('Files backup checksum mismatch');
        }
        
        $projectRoot = dirname(__DIR__);
        
        $command = sprintf(
            'cd %s && tar -xzf %s 2>&1',
            escapeshellarg($projectRoot),
            escapeshellarg($backupFile)
        );
        
        $output = [];
        $returnCode = 0;
        exec($command, $output, $returnCode);
        
        if ($returnCode !== 0) {
            throw new Exception('Files restore failed: ' . implode("\n", $output));
        }
        
        $this->logger->log('info', 'Files restored successfully', ['file' => $backupFile]);
    }
    
    private function restoreConfiguration($configBackup) {
        // Configuration restore would depend on your specific needs
        // This is a placeholder implementation
        $this->logger->log('info', 'Configuration restore completed');
    }
    
    private function getDatabaseSchema() {
        // Get database schema information
        // This is a simplified implementation
        return [];
    }
    
    private function getFilePermissions() {
        $important_files = [
            'config/',
            'uploads/',
            'logs/',
            '.env'
        ];
        
        $permissions = [];
        $projectRoot = dirname(__DIR__);
        
        foreach ($important_files as $file) {
            $path = $projectRoot . '/' . $file;
            if (file_exists($path)) {
                $permissions[$file] = substr(sprintf('%o', fileperms($path)), -4);
            }
        }
        
        return $permissions;
    }
    
    private function getCronJobs() {
        $cron = shell_exec('crontab -l 2>/dev/null');
        return $cron ? explode("\n", trim($cron)) : [];
    }
    
    private function createBackupScript($scriptPath) {
        $script = '<?php
require_once __DIR__ . "/../classes/BackupManager.php";

$backup = new BackupManager();
$result = $backup->performFullBackup();

if ($result["success"]) {
    echo "Backup completed successfully: " . $result["backup_id"] . "\n";
    exit(0);
} else {
    echo "Backup failed: " . ($result["error"] ?? "Unknown error") . "\n";
    exit(1);
}
';
        
        $scriptDir = dirname($scriptPath);
        if (!is_dir($scriptDir)) {
            mkdir($scriptDir, 0755, true);
        }
        
        file_put_contents($scriptPath, $script);
        chmod($scriptPath, 0755);
    }
    
    private function formatBytes($bytes, $precision = 2) {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
}

// CLI interface for backup operations
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    $backup = new BackupManager();
    
    $command = $argv[1] ?? 'backup';
    
    switch ($command) {
        case 'backup':
            $result = $backup->performFullBackup();
            echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
            exit($result['success'] ? 0 : 1);
            
        case 'restore':
            if (!isset($argv[2])) {
                echo "Usage: php backup.php restore <backup_id>\n";
                exit(1);
            }
            $result = $backup->restore($argv[2]);
            echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
            exit($result['success'] ? 0 : 1);
            
        case 'list':
            $backups = $backup->listBackups();
            foreach ($backups as $backup) {
                echo sprintf("%s | %s | %s | %s\n", 
                    $backup['backup_id'], 
                    $backup['timestamp'], 
                    $backup['total_size'], 
                    $backup['success'] ? 'SUCCESS' : 'FAILED'
                );
            }
            break;
            
        case 'schedule':
            $backup->scheduleBackups();
            echo "Backup scheduling completed\n";
            break;
            
        default:
            echo "Usage: php backup.php [backup|restore|list|schedule]\n";
            exit(1);
    }
}
