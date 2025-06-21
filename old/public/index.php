<?php
/**
 * Front Controller for Quick Chat Application
 * 
 * This file serves as the single entry point for all requests to the application.
 * It bootstraps the application, handles routing, and dispatches requests to the
 * appropriate controllers.
 */

// Define application root path
define('APP_ROOT', __DIR__);

// Load Composer autoloader
require_once APP_ROOT . '/vendor/autoload.php';

// Load environment variables
if (file_exists(APP_ROOT . '/.env')) {
    $dotenv = \Dotenv\Dotenv::createImmutable(APP_ROOT);
    $dotenv->load();
}

// Initialize error handling
error_reporting(E_ALL);
ini_set('display_errors', $_ENV['APP_DEBUG'] ?? false);

// Initialize the application
$app = new \QuickChat\App();
$app->run();
