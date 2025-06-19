<?php
namespace QuickChat\Middleware;

use QuickChat\Services\RateLimit;

/**
 * Rate Limiter Middleware
 * 
 * Protects against brute force attacks and API abuse
 */
class RateLimiter implements MiddlewareInterface
{
    /**
     * Process the request
     * 
     * @param callable $next The next middleware to call
     */
    public function process(callable $next): void
    {
        // Skip rate limiting for non-API requests if configured
        if (!$this->shouldRateLimit()) {
            call_user_func($next);
            return;
        }
        
        // Get client IP address
        $ip = $this->getClientIp();
        
        // Get route-specific rate limit configuration
        $route = $_SERVER['REQUEST_URI'];
        $method = $_SERVER['REQUEST_METHOD'];
        
        // Initialize rate limiter
        $rateLimiter = new RateLimit($ip, $route, $method);
        
        // Check if request should be rate limited
        if ($rateLimiter->isLimited()) {
            // Request has been rate limited
            $this->handleRateLimited($rateLimiter);
            return;
        }
        
        // Increment request count
        $rateLimiter->increment();
        
        // Add rate limit headers
        $this->addRateLimitHeaders($rateLimiter);
        
        // Continue to next middleware
        call_user_func($next);
    }
    
    /**
     * Check if the current request should be rate limited
     * 
     * @return bool True if request should be rate limited
     */
    private function shouldRateLimit(): bool
    {
        // Check if rate limiting is enabled
        if (!isset($_ENV['RATE_LIMIT_ENABLED']) || $_ENV['RATE_LIMIT_ENABLED'] !== 'true') {
            return false;
        }
        
        // Always rate limit API requests
        if (strpos($_SERVER['REQUEST_URI'], '/api/') === 0) {
            return true;
        }
        
        // Rate limit authentication endpoints
        $authEndpoints = [
            '/login',
            '/register',
            '/password/reset',
            '/password/forgot',
            '/auth'
        ];
        
        foreach ($authEndpoints as $endpoint) {
            if (strpos($_SERVER['REQUEST_URI'], $endpoint) !== false) {
                return true;
            }
        }
        
        // Don't rate limit other requests
        return false;
    }
    
    /**
     * Get client IP address
     * 
     * @return string The client IP address
     */
    private function getClientIp(): string
    {
        // Use the ClientIp service if available
        if (class_exists('\\QuickChat\\Services\\ClientIp')) {
            return \QuickChat\Services\ClientIp::get();
        }
        
        // Fallback to basic IP detection
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return $_SERVER['HTTP_X_FORWARDED_FOR'];
        }
        
        return $_SERVER['REMOTE_ADDR'];
    }
    
    /**
     * Handle rate limited request
     * 
     * @param RateLimit $rateLimiter The rate limiter instance
     */
    private function handleRateLimited(RateLimit $rateLimiter): void
    {
        // Log rate limit event
        if (class_exists('\\QuickChat\\Services\\Logger')) {
            \QuickChat\Services\Logger::warning('Rate limit exceeded', [
                'ip' => $this->getClientIp(),
                'uri' => $_SERVER['REQUEST_URI'],
                'method' => $_SERVER['REQUEST_METHOD']
            ]);
        }
        
        // Add rate limit headers
        $this->addRateLimitHeaders($rateLimiter);
        
        // Return 429 Too Many Requests
        header('HTTP/1.1 429 Too Many Requests');
        header('Content-Type: application/json');
        
        // Calculate retry after time
        $retryAfter = $rateLimiter->getRetryAfter();
        header('Retry-After: ' . $retryAfter);
        
        // Return error response
        echo json_encode([
            'error' => 'Rate limit exceeded',
            'retry_after' => $retryAfter
        ]);
        exit;
    }
    
    /**
     * Add rate limit headers to response
     * 
     * @param RateLimit $rateLimiter The rate limiter instance
     */
    private function addRateLimitHeaders(RateLimit $rateLimiter): void
    {
        header('X-RateLimit-Limit: ' . $rateLimiter->getLimit());
        header('X-RateLimit-Remaining: ' . $rateLimiter->getRemaining());
        header('X-RateLimit-Reset: ' . $rateLimiter->getReset());
    }
}
