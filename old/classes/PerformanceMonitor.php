<?php
/**
 * Application Performance Monitor
 * Comprehensive monitoring and logging system for Quick Chat
 */

class PerformanceMonitor {
    private static $instance = null;
    private $startTime;
    private $memoryStart;
    private $metrics = [];
    private $config;
    private $logHandlers = [];
    
    private function __construct() {
        $this->startTime = microtime(true);
        $this->memoryStart = memory_get_usage(true);
        $this->config = include __DIR__ . '/../config/production-config.php';
        $this->initializeLogHandlers();
        
        // Register shutdown function for final metrics
        register_shutdown_function([$this, 'shutdown']);
        
        // Set error and exception handlers
        set_error_handler([$this, 'errorHandler']);
        set_exception_handler([$this, 'exceptionHandler']);
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Initialize log handlers based on configuration
     */
    private function initializeLogHandlers() {
        $handlers = $this->config->get('logging.handlers', ['file']);
        
        foreach ($handlers as $handler) {
            switch ($handler) {
                case 'file':
                    $this->logHandlers['file'] = new FileLogHandler(
                        __DIR__ . '/../logs/app.log',
                        $this->config->get('logging.level', 'info'),
                        $this->config->get('logging.max_file_size', '10MB')
                    );
                    break;
                    
                case 'syslog':
                    $this->logHandlers['syslog'] = new SyslogHandler(
                        'quickchat',
                        $this->config->get('logging.level', 'info')
                    );
                    break;
                    
                case 'email':
                    if ($this->config->get('logging.email_alerts')) {
                        $this->logHandlers['email'] = new EmailLogHandler(
                            $this->config->get('logging.error_email'),
                            'error' // Only send errors via email
                        );
                    }
                    break;
                    
                case 'database':
                    $this->logHandlers['database'] = new DatabaseLogHandler();
                    break;
                    
                case 'console':
                    if (php_sapi_name() === 'cli') {
                        $this->logHandlers['console'] = new ConsoleLogHandler();
                    }
                    break;
            }
        }
    }
    
    /**
     * Start timing a specific operation
     */
    public function startTimer($name) {
        $this->metrics[$name] = [
            'start_time' => microtime(true),
            'start_memory' => memory_get_usage(true),
            'type' => 'timer'
        ];
    }
    
    /**
     * End timing a specific operation
     */
    public function endTimer($name) {
        if (!isset($this->metrics[$name])) {
            $this->log('warning', "Timer '$name' was not started");
            return;
        }
        
        $this->metrics[$name]['end_time'] = microtime(true);
        $this->metrics[$name]['end_memory'] = memory_get_usage(true);
        $this->metrics[$name]['duration'] = $this->metrics[$name]['end_time'] - $this->metrics[$name]['start_time'];
        $this->metrics[$name]['memory_used'] = $this->metrics[$name]['end_memory'] - $this->metrics[$name]['start_memory'];
        
        // Log slow operations
        $slowThreshold = 1.0; // 1 second
        if ($this->metrics[$name]['duration'] > $slowThreshold) {
            $this->log('warning', "Slow operation detected: $name took {$this->metrics[$name]['duration']}s");
        }
    }
    
    /**
     * Record a custom metric
     */
    public function recordMetric($name, $value, $type = 'gauge') {
        $this->metrics[$name] = [
            'value' => $value,
            'type' => $type,
            'timestamp' => time()
        ];
    }
    
    /**
     * Increment a counter metric
     */
    public function incrementCounter($name, $value = 1) {
        if (!isset($this->metrics[$name])) {
            $this->metrics[$name] = ['value' => 0, 'type' => 'counter'];
        }
        $this->metrics[$name]['value'] += $value;
        $this->metrics[$name]['timestamp'] = time();
    }
    
    /**
     * Log a message with specified level
     */
    public function log($level, $message, $context = []) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'level' => strtoupper($level),
            'message' => $message,
            'context' => $context,
            'request_id' => $this->getRequestId(),
            'user_id' => $this->getCurrentUserId(),
            'ip_address' => $this->getClientIp(),
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'memory_usage' => memory_get_usage(true),
            'memory_peak' => memory_get_peak_usage(true)
        ];
        
        // Add stack trace for errors
        if (in_array($level, ['error', 'critical', 'emergency'])) {
            $logEntry['stack_trace'] = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
        }
        
        // Send to all configured handlers
        foreach ($this->logHandlers as $handler) {
            $handler->handle($logEntry);
        }
        
        // Real-time alerting for critical errors
        if (in_array($level, ['critical', 'emergency'])) {
            $this->sendCriticalAlert($logEntry);
        }
    }
    
    /**
     * Monitor database queries
     */
    public function monitorQuery($query, $params = [], $duration = 0) {
        $this->incrementCounter('database.queries');
        
        if ($duration > 0.5) { // Log slow queries (> 500ms)
            $this->log('warning', 'Slow database query detected', [
                'query' => $query,
                'params' => $params,
                'duration' => $duration,
                'type' => 'slow_query'
            ]);
            $this->incrementCounter('database.slow_queries');
        }
        
        // Track query patterns
        $queryType = strtoupper(strtok(trim($query), ' '));
        $this->incrementCounter("database.queries.$queryType");
    }
    
    /**
     * Monitor API requests
     */
    public function monitorApiRequest($endpoint, $method, $responseTime, $statusCode) {
        $this->incrementCounter('api.requests');
        $this->incrementCounter("api.requests.$method");
        $this->incrementCounter("api.responses.$statusCode");
        
        // Track response times
        $this->recordMetric("api.response_time.$endpoint", $responseTime, 'histogram');
        
        if ($responseTime > 2.0) { // Log slow API requests
            $this->log('warning', 'Slow API request', [
                'endpoint' => $endpoint,
                'method' => $method,
                'response_time' => $responseTime,
                'status_code' => $statusCode
            ]);
        }
        
        // Track error rates
        if ($statusCode >= 400) {
            $this->incrementCounter('api.errors');
            if ($statusCode >= 500) {
                $this->incrementCounter('api.server_errors');
            }
        }
    }
    
    /**
     * Monitor file uploads
     */
    public function monitorFileUpload($filename, $size, $type, $duration, $success) {
        $this->incrementCounter('uploads.total');
        $this->incrementCounter("uploads.type.$type");
        $this->recordMetric('uploads.size', $size, 'histogram');
        $this->recordMetric('uploads.duration', $duration, 'histogram');
        
        if ($success) {
            $this->incrementCounter('uploads.success');
        } else {
            $this->incrementCounter('uploads.failed');
            $this->log('warning', 'File upload failed', [
                'filename' => $filename,
                'size' => $size,
                'type' => $type,
                'duration' => $duration
            ]);
        }
    }
    
    /**
     * Monitor WebRTC connections
     */
    public function monitorWebRTCConnection($event, $data = []) {
        $this->incrementCounter("webrtc.$event");
        
        $this->log('info', "WebRTC event: $event", array_merge($data, [
            'event_type' => 'webrtc',
            'event' => $event
        ]));
        
        if (in_array($event, ['connection_failed', 'call_dropped'])) {
            $this->incrementCounter('webrtc.failures');
        }
    }
    
    /**
     * Get system health metrics
     */
    public function getHealthMetrics() {
        return [
            'timestamp' => time(),
            'uptime' => time() - $this->startTime,
            'memory' => [
                'current' => memory_get_usage(true),
                'peak' => memory_get_peak_usage(true),
                'limit' => ini_get('memory_limit')
            ],
            'cpu' => [
                'load_average' => function_exists('sys_getloadavg') ? sys_getloadavg() : null,
                'usage_percent' => $this->getCpuUsage()
            ],
            'disk' => [
                'free_space' => disk_free_space('.'),
                'total_space' => disk_total_space('.'),
                'usage_percent' => (1 - disk_free_space('.') / disk_total_space('.')) * 100
            ],
            'database' => $this->getDatabaseHealth(),
            'cache' => $this->getCacheHealth(),
            'file_system' => $this->getFileSystemHealth()
        ];
    }
    
    /**
     * Get application performance metrics
     */
    public function getPerformanceMetrics() {
        return [
            'requests' => $this->metrics,
            'response_times' => $this->getResponseTimeStats(),
            'error_rates' => $this->getErrorRates(),
            'throughput' => $this->getThroughputStats(),
            'active_users' => $this->getActiveUserCount(),
            'database_performance' => $this->getDatabasePerformance()
        ];
    }
    
    /**
     * Error handler
     */
    public function errorHandler($severity, $message, $file, $line) {
        $level = $this->getLogLevelFromPhpError($severity);
        
        $this->log($level, $message, [
            'type' => 'php_error',
            'severity' => $severity,
            'file' => $file,
            'line' => $line,
            'error_type' => $this->getErrorType($severity)
        ]);
        
        // Don't execute PHP internal error handler
        return true;
    }
    
    /**
     * Exception handler
     */
    public function exceptionHandler($exception) {
        $this->log('error', $exception->getMessage(), [
            'type' => 'exception',
            'exception_class' => get_class($exception),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'stack_trace' => $exception->getTraceAsString()
        ]);
        
        // Send critical alert for uncaught exceptions
        $this->sendCriticalAlert([
            'message' => 'Uncaught exception: ' . $exception->getMessage(),
            'exception' => get_class($exception),
            'file' => $exception->getFile(),
            'line' => $exception->getLine()
        ]);
    }
    
    /**
     * Shutdown handler - record final metrics
     */
    public function shutdown() {
        $endTime = microtime(true);
        $endMemory = memory_get_usage(true);
        
        $this->recordMetric('request.total_time', $endTime - $this->startTime);
        $this->recordMetric('request.memory_used', $endMemory - $this->memoryStart);
        $this->recordMetric('request.memory_peak', memory_get_peak_usage(true));
        
        // Check for fatal errors
        $error = error_get_last();
        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
            $this->log('critical', 'Fatal error occurred', [
                'type' => 'fatal_error',
                'message' => $error['message'],
                'file' => $error['file'],
                'line' => $error['line']
            ]);
        }
        
        // Flush all log handlers
        foreach ($this->logHandlers as $handler) {
            if (method_exists($handler, 'flush')) {
                $handler->flush();
            }
        }
    }
    
    // Helper methods
    private function getRequestId() {
        static $requestId = null;
        if ($requestId === null) {
            $requestId = uniqid('req_', true);
        }
        return $requestId;
    }
    
    private function getCurrentUserId() {
        // This would integrate with your authentication system
        return $_SESSION['user_id'] ?? null;
    }
    
    private function getClientIp() {
        $ipKeys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_FORWARDED_FOR', 'HTTP_FORWARDED', 'REMOTE_ADDR'];
        
        foreach ($ipKeys as $key) {
            if (!empty($_SERVER[$key])) {
                $ips = explode(',', $_SERVER[$key]);
                return trim($ips[0]);
            }
        }
        
        return 'unknown';
    }
    
    private function sendCriticalAlert($logEntry) {
        // Implementation would depend on your alerting system
        // Could send to Slack, PagerDuty, email, etc.
        if ($this->config->get('monitoring.critical_alerts_enabled')) {
            // Example: send to webhook
            $this->sendWebhookAlert($logEntry);
        }
    }
    
    private function sendWebhookAlert($data) {
        $webhookUrl = $this->config->get('monitoring.webhook_url');
        if (!$webhookUrl) return;
        
        $payload = json_encode([
            'text' => 'Critical error in Quick Chat',
            'attachments' => [
                [
                    'color' => 'danger',
                    'fields' => [
                        ['title' => 'Message', 'value' => $data['message'] ?? 'Unknown error', 'short' => false],
                        ['title' => 'Time', 'value' => date('Y-m-d H:i:s'), 'short' => true],
                        ['title' => 'Server', 'value' => gethostname(), 'short' => true]
                    ]
                ]
            ]
        ]);
        
        $ch = curl_init($webhookUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        curl_close($ch);
    }
    
    private function getLogLevelFromPhpError($severity) {
        switch ($severity) {
            case E_ERROR:
            case E_CORE_ERROR:
            case E_COMPILE_ERROR:
            case E_PARSE:
                return 'critical';
            case E_WARNING:
            case E_CORE_WARNING:
            case E_COMPILE_WARNING:
                return 'warning';
            case E_NOTICE:
            case E_USER_NOTICE:
                return 'notice';
            case E_DEPRECATED:
            case E_USER_DEPRECATED:
                return 'info';
            default:
                return 'error';
        }
    }
    
    private function getErrorType($severity) {
        $errorTypes = [
            E_ERROR => 'E_ERROR',
            E_WARNING => 'E_WARNING',
            E_PARSE => 'E_PARSE',
            E_NOTICE => 'E_NOTICE',
            E_CORE_ERROR => 'E_CORE_ERROR',
            E_CORE_WARNING => 'E_CORE_WARNING',
            E_COMPILE_ERROR => 'E_COMPILE_ERROR',
            E_COMPILE_WARNING => 'E_COMPILE_WARNING',
            E_USER_ERROR => 'E_USER_ERROR',
            E_USER_WARNING => 'E_USER_WARNING',
            E_USER_NOTICE => 'E_USER_NOTICE',
            E_STRICT => 'E_STRICT',
            E_RECOVERABLE_ERROR => 'E_RECOVERABLE_ERROR',
            E_DEPRECATED => 'E_DEPRECATED',
            E_USER_DEPRECATED => 'E_USER_DEPRECATED'
        ];
        
        return $errorTypes[$severity] ?? 'UNKNOWN';
    }
    
    private function getCpuUsage() {
        if (function_exists('sys_getloadavg')) {
            $load = sys_getloadavg();
            return $load[0]; // 1-minute load average
        }
        return null;
    }
    
    private function getDatabaseHealth() {
        // This would check database connectivity, query performance, etc.
        return [
            'connected' => true, // Check actual connection
            'queries_per_second' => $this->metrics['database.queries']['value'] ?? 0,
            'slow_queries' => $this->metrics['database.slow_queries']['value'] ?? 0
        ];
    }
    
    private function getCacheHealth() {
        // This would check cache connectivity and hit rates
        return [
            'connected' => true,
            'hit_rate' => 0.95 // Example
        ];
    }
    
    private function getFileSystemHealth() {
        return [
            'uploads_writable' => is_writable(__DIR__ . '/../uploads'),
            'logs_writable' => is_writable(__DIR__ . '/../logs'),
            'config_readable' => is_readable(__DIR__ . '/../config')
        ];
    }
    
    private function getResponseTimeStats() {
        // Calculate response time statistics from recorded metrics
        return [
            'average' => 0.5, // Example values
            'p95' => 1.2,
            'p99' => 2.5
        ];
    }
    
    private function getErrorRates() {
        $totalRequests = $this->metrics['api.requests']['value'] ?? 0;
        $errors = $this->metrics['api.errors']['value'] ?? 0;
        
        return [
            'total_errors' => $errors,
            'error_rate' => $totalRequests > 0 ? ($errors / $totalRequests) * 100 : 0
        ];
    }
    
    private function getThroughputStats() {
        return [
            'requests_per_minute' => $this->metrics['api.requests']['value'] ?? 0,
            'messages_per_minute' => $this->metrics['messages.sent']['value'] ?? 0
        ];
    }
    
    private function getActiveUserCount() {
        // This would query the database for active users
        return 0; // Placeholder
    }
    
    private function getDatabasePerformance() {
        return [
            'avg_query_time' => 0.1, // Example
            'connections' => 5,
            'slow_queries' => $this->metrics['database.slow_queries']['value'] ?? 0
        ];
    }
}

// Log Handler Classes
class FileLogHandler {
    private $logFile;
    private $minLevel;
    private $maxFileSize;
    
    public function __construct($logFile, $minLevel = 'info', $maxFileSize = '10MB') {
        $this->logFile = $logFile;
        $this->minLevel = $minLevel;
        $this->maxFileSize = $this->parseFileSize($maxFileSize);
        
        // Create log directory if it doesn't exist
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
    }
    
    public function handle($logEntry) {
        if (!$this->shouldLog($logEntry['level'])) {
            return;
        }
        
        // Rotate log file if needed
        $this->rotateLogFile();
        
        $line = $this->formatLogLine($logEntry);
        file_put_contents($this->logFile, $line, FILE_APPEND | LOCK_EX);
    }
    
    private function shouldLog($level) {
        $levels = ['debug' => 0, 'info' => 1, 'notice' => 2, 'warning' => 3, 'error' => 4, 'critical' => 5, 'emergency' => 6];
        $currentLevel = $levels[strtolower($level)] ?? 1;
        $minLevel = $levels[strtolower($this->minLevel)] ?? 1;
        
        return $currentLevel >= $minLevel;
    }
    
    private function formatLogLine($logEntry) {
        $context = !empty($logEntry['context']) ? ' ' . json_encode($logEntry['context']) : '';
        return "[{$logEntry['timestamp']}] {$logEntry['level']}: {$logEntry['message']}{$context}\n";
    }
    
    private function rotateLogFile() {
        if (!file_exists($this->logFile)) {
            return;
        }
        
        if (filesize($this->logFile) > $this->maxFileSize) {
            $rotatedFile = $this->logFile . '.' . date('Y-m-d-H-i-s');
            rename($this->logFile, $rotatedFile);
            
            // Compress rotated file
            if (function_exists('gzencode')) {
                $content = file_get_contents($rotatedFile);
                file_put_contents($rotatedFile . '.gz', gzencode($content));
                unlink($rotatedFile);
            }
        }
    }
    
    private function parseFileSize($size) {
        $units = ['B' => 1, 'KB' => 1024, 'MB' => 1048576, 'GB' => 1073741824];
        $size = strtoupper($size);
        
        foreach ($units as $unit => $multiplier) {
            if (strpos($size, $unit) !== false) {
                return (int)$size * $multiplier;
            }
        }
        
        return (int)$size;
    }
}

class SyslogHandler {
    private $facility;
    private $minLevel;
    
    public function __construct($facility = 'quickchat', $minLevel = 'info') {
        $this->facility = $facility;
        $this->minLevel = $minLevel;
        openlog($facility, LOG_PID | LOG_PERROR, LOG_LOCAL0);
    }
    
    public function handle($logEntry) {
        if (!$this->shouldLog($logEntry['level'])) {
            return;
        }
        
        $priority = $this->getLevelPriority($logEntry['level']);
        $message = $logEntry['message'];
        
        if (!empty($logEntry['context'])) {
            $message .= ' ' . json_encode($logEntry['context']);
        }
        
        syslog($priority, $message);
    }
    
    private function shouldLog($level) {
        $levels = ['debug' => 0, 'info' => 1, 'notice' => 2, 'warning' => 3, 'error' => 4, 'critical' => 5, 'emergency' => 6];
        $currentLevel = $levels[strtolower($level)] ?? 1;
        $minLevel = $levels[strtolower($this->minLevel)] ?? 1;
        
        return $currentLevel >= $minLevel;
    }
    
    private function getLevelPriority($level) {
        $priorities = [
            'emergency' => LOG_EMERG,
            'critical' => LOG_CRIT,
            'error' => LOG_ERR,
            'warning' => LOG_WARNING,
            'notice' => LOG_NOTICE,
            'info' => LOG_INFO,
            'debug' => LOG_DEBUG
        ];
        
        return $priorities[strtolower($level)] ?? LOG_INFO;
    }
}

class EmailLogHandler {
    private $email;
    private $minLevel;
    
    public function __construct($email, $minLevel = 'error') {
        $this->email = $email;
        $this->minLevel = $minLevel;
    }
    
    public function handle($logEntry) {
        if (!$this->shouldLog($logEntry['level'])) {
            return;
        }
        
        $subject = "Quick Chat {$logEntry['level']}: {$logEntry['message']}";
        $body = $this->formatEmailBody($logEntry);
        
        // Use mail() function or a more sophisticated email library
        mail($this->email, $subject, $body);
    }
    
    private function shouldLog($level) {
        $levels = ['debug' => 0, 'info' => 1, 'notice' => 2, 'warning' => 3, 'error' => 4, 'critical' => 5, 'emergency' => 6];
        $currentLevel = $levels[strtolower($level)] ?? 1;
        $minLevel = $levels[strtolower($this->minLevel)] ?? 1;
        
        return $currentLevel >= $minLevel;
    }
    
    private function formatEmailBody($logEntry) {
        $body = "Time: {$logEntry['timestamp']}\n";
        $body .= "Level: {$logEntry['level']}\n";
        $body .= "Message: {$logEntry['message']}\n";
        $body .= "Request ID: {$logEntry['request_id']}\n";
        $body .= "User ID: {$logEntry['user_id']}\n";
        $body .= "IP Address: {$logEntry['ip_address']}\n";
        
        if (!empty($logEntry['context'])) {
            $body .= "Context: " . json_encode($logEntry['context'], JSON_PRETTY_PRINT) . "\n";
        }
        
        if (!empty($logEntry['stack_trace'])) {
            $body .= "Stack Trace:\n" . print_r($logEntry['stack_trace'], true) . "\n";
        }
        
        return $body;
    }
}

class DatabaseLogHandler {
    private $pdo;
    
    public function __construct() {
        // Initialize database connection
        // This would use your existing database configuration
    }
    
    public function handle($logEntry) {
        // Store log entry in database
        // Implementation would depend on your database schema
    }
}

class ConsoleLogHandler {
    public function handle($logEntry) {
        $colors = [
            'emergency' => "\033[41m", // Red background
            'critical' => "\033[31m",  // Red
            'error' => "\033[31m",     // Red
            'warning' => "\033[33m",   // Yellow
            'notice' => "\033[36m",    // Cyan
            'info' => "\033[32m",      // Green
            'debug' => "\033[37m"      // White
        ];
        
        $color = $colors[strtolower($logEntry['level'])] ?? "\033[37m";
        $reset = "\033[0m";
        
        echo "{$color}[{$logEntry['timestamp']}] {$logEntry['level']}: {$logEntry['message']}{$reset}\n";
    }
}

// Initialize the performance monitor
$monitor = PerformanceMonitor::getInstance();

// Helper functions for easy use
function monitor() {
    return PerformanceMonitor::getInstance();
}

function logInfo($message, $context = []) {
    PerformanceMonitor::getInstance()->log('info', $message, $context);
}

function logError($message, $context = []) {
    PerformanceMonitor::getInstance()->log('error', $message, $context);
}

function logWarning($message, $context = []) {
    PerformanceMonitor::getInstance()->log('warning', $message, $context);
}

function startTimer($name) {
    PerformanceMonitor::getInstance()->startTimer($name);
}

function endTimer($name) {
    PerformanceMonitor::getInstance()->endTimer($name);
}
