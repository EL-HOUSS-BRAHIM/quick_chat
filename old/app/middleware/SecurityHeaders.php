<?php
namespace QuickChat\Middleware;

/**
 * Security Headers Middleware
 * 
 * Adds security-related HTTP headers to all responses
 */
class SecurityHeaders implements MiddlewareInterface
{
    /**
     * Process the request
     * 
     * @param callable $next The next middleware to call
     */
    public function process(callable $next): void
    {
        // Set security headers
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        
        // Content Security Policy
        if (isset($_ENV['CSP_ENABLED']) && $_ENV['CSP_ENABLED'] === 'true') {
            $csp = "default-src 'self'; ";
            $csp .= "script-src 'self' 'unsafe-inline' 'unsafe-eval'; ";
            $csp .= "style-src 'self' 'unsafe-inline'; ";
            $csp .= "img-src 'self' data: blob:; ";
            $csp .= "connect-src 'self' wss://" . $_SERVER['HTTP_HOST'] . "; ";
            $csp .= "media-src 'self' blob:; ";
            $csp .= "object-src 'none'; ";
            $csp .= "font-src 'self'; ";
            
            header('Content-Security-Policy: ' . $csp);
        }
        
        // Continue to next middleware
        call_user_func($next);
    }
}
