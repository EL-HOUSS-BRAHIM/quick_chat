<?php
namespace QuickChat\Services;

/**
 * Client IP Service
 * 
 * Utility service to detect client IP address
 */
class ClientIp
{
    /**
     * Get client IP address
     * 
     * @return string The client IP address
     */
    public static function get(): string
    {
        // Check for proxy headers
        $headers = [
            'HTTP_CF_CONNECTING_IP', // Cloudflare
            'HTTP_X_FORWARDED_FOR',  // Common proxy header
            'HTTP_X_REAL_IP',        // Nginx
            'HTTP_CLIENT_IP',        // Client IP
            'HTTP_X_FORWARDED',      // General forwarded
            'HTTP_FORWARDED_FOR',    // Alternative
            'HTTP_FORWARDED',        // Alternative
            'REMOTE_ADDR'            // Fallback to direct connection
        ];
        
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                // For X-Forwarded-For, get first IP
                if ($header === 'HTTP_X_FORWARDED_FOR') {
                    $ips = explode(',', $_SERVER[$header]);
                    $ip = trim($ips[0]);
                    
                    if (self::validateIp($ip)) {
                        return $ip;
                    }
                } else {
                    $ip = $_SERVER[$header];
                    
                    if (self::validateIp($ip)) {
                        return $ip;
                    }
                }
            }
        }
        
        // Default fallback
        return '0.0.0.0';
    }
    
    /**
     * Validate IP address
     * 
     * @param string $ip The IP address to validate
     * @return bool True if valid
     */
    private static function validateIp(string $ip): bool
    {
        // Filter for valid IPv4 or IPv6 address
        return filter_var($ip, FILTER_VALIDATE_IP) !== false;
    }
}
