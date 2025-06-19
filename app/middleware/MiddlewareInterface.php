<?php
namespace QuickChat\Middleware;

/**
 * Middleware Interface
 * 
 * Interface for all middleware classes
 */
interface MiddlewareInterface
{
    /**
     * Process the request
     * 
     * @param callable $next The next middleware to call
     */
    public function process(callable $next): void;
}
