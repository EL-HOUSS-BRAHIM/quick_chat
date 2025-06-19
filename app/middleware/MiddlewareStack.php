<?php
namespace QuickChat\Middleware;

/**
 * Middleware Stack
 * 
 * Manages and executes a stack of middleware in order
 */
class MiddlewareStack
{
    /**
     * @var array
     */
    private $middleware = [];
    
    /**
     * Add middleware to the stack
     * 
     * @param MiddlewareInterface $middleware
     */
    public function add(MiddlewareInterface $middleware): void
    {
        $this->middleware[] = $middleware;
    }
    
    /**
     * Process the request through all middleware
     * 
     * @param callable $coreFunction The core function to call after middleware
     */
    public function process(callable $coreFunction): void
    {
        $this->executeMiddlewareStack(0, $coreFunction);
    }
    
    /**
     * Execute the middleware stack recursively
     * 
     * @param int $index Current middleware index
     * @param callable $coreFunction The core function to call after middleware
     */
    private function executeMiddlewareStack(int $index, callable $coreFunction): void
    {
        if ($index < count($this->middleware)) {
            // Get current middleware
            $currentMiddleware = $this->middleware[$index];
            
            // Execute current middleware with next middleware as callback
            $currentMiddleware->process(function() use ($index, $coreFunction) {
                $this->executeMiddlewareStack($index + 1, $coreFunction);
            });
        } else {
            // All middleware processed, execute core function
            call_user_func($coreFunction);
        }
    }
}
