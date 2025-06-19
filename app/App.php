<?php
namespace QuickChat;

use FastRoute\Dispatcher;
use FastRoute\RouteCollector;
use QuickChat\Middleware\MiddlewareStack;
use QuickChat\Services\Config;
use QuickChat\Services\Logger;
use QuickChat\Services\Session;

/**
 * Main Application Class
 * 
 * Bootstraps the application, handles routing, and dispatches requests
 */
class App
{
    /**
     * @var Dispatcher
     */
    private $dispatcher;
    
    /**
     * @var MiddlewareStack
     */
    private $middlewareStack;
    
    /**
     * Initialize the application
     */
    public function __construct()
    {
        // Initialize services
        $this->initializeServices();
        
        // Load routes
        $this->loadRoutes();
        
        // Setup middleware
        $this->setupMiddleware();
    }
    
    /**
     * Initialize core services
     */
    private function initializeServices(): void
    {
        // Initialize configuration
        Config::init();
        
        // Initialize logging
        Logger::init();
        
        // Initialize session
        Session::start();
    }
    
    /**
     * Load application routes
     */
    private function loadRoutes(): void
    {
        $this->dispatcher = \FastRoute\simpleDispatcher(function(RouteCollector $r) {
            // Include route definitions from routes file
            require_once APP_ROOT . '/app/routes/web.php';
            require_once APP_ROOT . '/app/routes/api.php';
        });
    }
    
    /**
     * Setup application middleware
     */
    private function setupMiddleware(): void
    {
        $this->middlewareStack = new MiddlewareStack();
        
        // Add core middleware
        $this->middlewareStack->add(new \QuickChat\Middleware\SecurityHeaders());
        $this->middlewareStack->add(new \QuickChat\Middleware\CsrfProtection());
        $this->middlewareStack->add(new \QuickChat\Middleware\RateLimiter());
        
        // Add environment-specific middleware
        if ($_ENV['APP_ENV'] === 'production') {
            $this->middlewareStack->add(new \QuickChat\Middleware\ErrorHandler());
        }
    }
    
    /**
     * Run the application
     */
    public function run(): void
    {
        // Get HTTP method and URI
        $httpMethod = $_SERVER['REQUEST_METHOD'];
        $uri = $_SERVER['REQUEST_URI'];
        
        // Strip query string and decode URI
        if (false !== $pos = strpos($uri, '?')) {
            $uri = substr($uri, 0, $pos);
        }
        $uri = rawurldecode($uri);
        
        // Dispatch the request
        $routeInfo = $this->dispatcher->dispatch($httpMethod, $uri);
        
        switch ($routeInfo[0]) {
            case Dispatcher::NOT_FOUND:
                // Handle 404 Not Found
                header('HTTP/1.0 404 Not Found');
                include APP_ROOT . '/app/views/errors/404.php';
                break;
                
            case Dispatcher::METHOD_NOT_ALLOWED:
                // Handle 405 Method Not Allowed
                $allowedMethods = $routeInfo[1];
                header('HTTP/1.0 405 Method Not Allowed');
                header('Allow: ' . implode(', ', $allowedMethods));
                include APP_ROOT . '/app/views/errors/405.php';
                break;
                
            case Dispatcher::FOUND:
                // Process the request through middleware
                $handler = $routeInfo[1];
                $vars = $routeInfo[2];
                
                // Execute middleware stack
                $this->middlewareStack->process(function() use ($handler, $vars) {
                    // Call the route handler
                    $this->executeHandler($handler, $vars);
                });
                break;
        }
    }
    
    /**
     * Execute the route handler
     * 
     * @param mixed $handler The route handler (controller@method or closure)
     * @param array $vars Route parameters
     */
    private function executeHandler($handler, array $vars): void
    {
        if (is_string($handler)) {
            // Handle controller@method format
            list($controller, $method) = explode('@', $handler);
            
            // Create controller instance
            $controllerClass = "\\QuickChat\\Controllers\\$controller";
            $controllerInstance = new $controllerClass();
            
            // Call the method with route parameters
            call_user_func_array([$controllerInstance, $method], $vars);
        } else if (is_callable($handler)) {
            // Handle closure
            call_user_func_array($handler, $vars);
        }
    }
}
