<?php
namespace QuickChat\Middleware;

use QuickChat\Services\Session;

/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery attacks
 */
class CsrfProtection implements MiddlewareInterface
{
    /**
     * Process the request
     * 
     * @param callable $next The next middleware to call
     */
    public function process(callable $next): void
    {
        // Only apply CSRF protection to POST, PUT, PATCH, DELETE requests
        if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            // Check for AJAX requests or API endpoints
            $isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
            $isApiRequest = strpos($_SERVER['REQUEST_URI'], '/api/') === 0;
            
            if ($isAjax || $isApiRequest) {
                // For AJAX/API requests, check CSRF token in header
                $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
                if (!$this->validateToken($token)) {
                    $this->handleInvalidToken();
                    return;
                }
            } else {
                // For regular form submissions, check token in POST data
                $token = $_POST['csrf_token'] ?? '';
                if (!$this->validateToken($token)) {
                    $this->handleInvalidToken();
                    return;
                }
            }
        }
        
        // Generate new CSRF token for this request if not exists
        if (!Session::has('csrf_token')) {
            Session::set('csrf_token', bin2hex(random_bytes(32)));
        }
        
        // Continue to next middleware
        call_user_func($next);
    }
    
    /**
     * Validate the CSRF token
     * 
     * @param string $token The token to validate
     * @return bool True if token is valid
     */
    private function validateToken(string $token): bool
    {
        // Get token from session
        $sessionToken = Session::get('csrf_token', '');
        
        // Validate token using constant-time comparison
        return !empty($sessionToken) && hash_equals($sessionToken, $token);
    }
    
    /**
     * Handle invalid CSRF token
     */
    private function handleInvalidToken(): void
    {
        // Log CSRF attack attempt
        if (class_exists('\\QuickChat\\Services\\Logger')) {
            \QuickChat\Services\Logger::warning('CSRF token validation failed', [
                'ip' => $_SERVER['REMOTE_ADDR'],
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
                'uri' => $_SERVER['REQUEST_URI']
            ]);
        }
        
        // Return 403 Forbidden
        header('HTTP/1.1 403 Forbidden');
        header('Content-Type: application/json');
        echo json_encode(['error' => 'CSRF token validation failed']);
        exit;
    }
}
