<?php
namespace QuickChat\Services;

use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Formatter\LineFormatter;
use Monolog\Level;

/**
 * Logger Service
 * 
 * Provides application-wide logging capabilities
 */
class Logger
{
    /**
     * @var \Monolog\Logger
     */
    private static $logger;
    
    /**
     * Initialize the logger
     */
    public static function init(): void
    {
        if (self::$logger !== null) {
            return;
        }
        
        // Create logger instance
        self::$logger = new \Monolog\Logger('quick_chat');
        
        // Determine log path
        $logPath = defined('APP_ROOT') ? APP_ROOT . '/logs/app.log' : __DIR__ . '/../../logs/app.log';
        
        // Create directory if it doesn't exist
        $logDir = dirname($logPath);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        // Setup handlers based on environment
        if (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production') {
            // In production, use rotating file handler
            $handler = new RotatingFileHandler($logPath, 30, Level::Info);
        } else {
            // In development, use stream handler with debug level
            $handler = new StreamHandler($logPath, Level::Debug);
        }
        
        // Setup formatter
        $formatter = new LineFormatter(
            "[%datetime%] %level_name%: %message% %context% %extra%\n",
            'Y-m-d H:i:s',
            true,
            true
        );
        
        $handler->setFormatter($formatter);
        self::$logger->pushHandler($handler);
    }
    
    /**
     * Log a debug message
     * 
     * @param string $message The log message
     * @param array $context Additional context
     */
    public static function debug(string $message, array $context = []): void
    {
        self::ensureInitialized();
        self::$logger->debug($message, $context);
    }
    
    /**
     * Log an info message
     * 
     * @param string $message The log message
     * @param array $context Additional context
     */
    public static function info(string $message, array $context = []): void
    {
        self::ensureInitialized();
        self::$logger->info($message, $context);
    }
    
    /**
     * Log a warning message
     * 
     * @param string $message The log message
     * @param array $context Additional context
     */
    public static function warning(string $message, array $context = []): void
    {
        self::ensureInitialized();
        self::$logger->warning($message, $context);
    }
    
    /**
     * Log an error message
     * 
     * @param string $message The log message
     * @param array $context Additional context
     */
    public static function error(string $message, array $context = []): void
    {
        self::ensureInitialized();
        self::$logger->error($message, $context);
    }
    
    /**
     * Log a critical message
     * 
     * @param string $message The log message
     * @param array $context Additional context
     */
    public static function critical(string $message, array $context = []): void
    {
        self::ensureInitialized();
        self::$logger->critical($message, $context);
    }
    
    /**
     * Ensure the logger is initialized
     */
    private static function ensureInitialized(): void
    {
        if (self::$logger === null) {
            self::init();
        }
    }
}
