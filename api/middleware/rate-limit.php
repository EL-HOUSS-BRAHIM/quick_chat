<?php
/**
 * API Rate Limiting Middleware
 * Include this at the top of API files to apply rate limiting
 */

require_once __DIR__ . '/../classes/RateLimiter.php';

// Initialize rate limiter
$rateLimiter = new RateLimiter();

// Determine endpoint from request URI
$requestUri = $_SERVER['REQUEST_URI'] ?? '';
$endpoint = 'api'; // default

// Map URIs to endpoint names for specific rate limits
$endpointMap = [
    '/api/auth' => 'auth',
    '/api/messages' => 'messages', 
    '/api/upload' => 'upload',
    '/api/webrtc' => 'webrtc',
    '/api/admin' => 'admin'
];

foreach ($endpointMap as $uri => $name) {
    if (strpos($requestUri, $uri) !== false) {
        $endpoint = $name;
        break;
    }
}

// Apply rate limiting
if (!$rateLimiter->applyRateLimit($endpoint)) {
    // Rate limit exceeded, response already sent by applyRateLimit
    exit;
}
