<?php
/**
 * API Rate Limiting Class
 * Implements rate limiting for API endpoints to prevent abuse
 */

class RateLimiter {
    private $db;
    private $redis;
    private $useRedis;
    
    public function __construct() {
        $this->db = new Database();
        
        // Try to use Redis if available, fallback to database
        $this->useRedis = class_exists('Redis') && Config::isRedisEnabled();
        if ($this->useRedis) {
            try {
                $this->redis = new Redis();
                $this->redis->connect(Config::getRedisHost(), Config::getRedisPort());
                if (Config::getRedisPassword()) {
                    $this->redis->auth(Config::getRedisPassword());
                }
            } catch (Exception $e) {
                $this->useRedis = false;
                error_log("Redis connection failed, falling back to database: " . $e->getMessage());
            }
        }
    }
    
    /**
     * Check if request is within rate limit
     * @param string $identifier Unique identifier (IP, user ID, etc.)
     * @param string $endpoint API endpoint
     * @param int $limit Maximum requests allowed
     * @param int $window Time window in seconds
     * @return array Rate limit status
     */
    public function checkRateLimit($identifier, $endpoint, $limit, $window) {
        $key = "rate_limit:{$endpoint}:{$identifier}";
        $now = time();
        
        if ($this->useRedis) {
            return $this->checkRateLimitRedis($key, $limit, $window, $now);
        } else {
            return $this->checkRateLimitDatabase($identifier, $endpoint, $limit, $window, $now);
        }
    }
    
    /**
     * Check rate limit using Redis
     */
    private function checkRateLimitRedis($key, $limit, $window, $now) {
        try {
            // Use sliding window algorithm
            $windowStart = $now - $window;
            
            // Remove old entries
            $this->redis->zRemRangeByScore($key, 0, $windowStart);
            
            // Count current requests
            $currentCount = $this->redis->zCard($key);
            
            if ($currentCount >= $limit) {
                // Get reset time (when oldest entry expires)
                $oldestEntry = $this->redis->zRange($key, 0, 0, true);
                $resetTime = empty($oldestEntry) ? $now + $window : array_values($oldestEntry)[0] + $window;
                
                return [
                    'allowed' => false,
                    'limit' => $limit,
                    'remaining' => 0,
                    'resetTime' => $resetTime,
                    'retryAfter' => $resetTime - $now
                ];
            }
            
            // Add current request
            $this->redis->zAdd($key, $now, uniqid());
            $this->redis->expire($key, $window);
            
            return [
                'allowed' => true,
                'limit' => $limit,
                'remaining' => $limit - $currentCount - 1,
                'resetTime' => $now + $window,
                'retryAfter' => 0
            ];
            
        } catch (Exception $e) {
            error_log("Redis rate limiting error: " . $e->getMessage());
            // Fallback to allowing request if Redis fails
            return [
                'allowed' => true,
                'limit' => $limit,
                'remaining' => $limit - 1,
                'resetTime' => $now + $window,
                'retryAfter' => 0
            ];
        }
    }
    
    /**
     * Check rate limit using database
     */
    private function checkRateLimitDatabase($identifier, $endpoint, $limit, $window, $now) {
        try {
            $windowStart = $now - $window;
            
            // Clean up old entries
            $stmt = $this->db->prepare("
                DELETE FROM rate_limits 
                WHERE created_at < FROM_UNIXTIME(?)
            ");
            $stmt->execute([$windowStart]);
            
            // Count current requests
            $stmt = $this->db->prepare("
                SELECT COUNT(*) as count 
                FROM rate_limits 
                WHERE identifier = ? AND endpoint = ? AND created_at >= FROM_UNIXTIME(?)
            ");
            $stmt->execute([$identifier, $endpoint, $windowStart]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $currentCount = $result['count'];
            
            if ($currentCount >= $limit) {
                // Get reset time
                $stmt = $this->db->prepare("
                    SELECT UNIX_TIMESTAMP(created_at) as created_at 
                    FROM rate_limits 
                    WHERE identifier = ? AND endpoint = ? 
                    ORDER BY created_at ASC 
                    LIMIT 1
                ");
                $stmt->execute([$identifier, $endpoint]);
                $oldest = $stmt->fetch(PDO::FETCH_ASSOC);
                $resetTime = $oldest ? $oldest['created_at'] + $window : $now + $window;
                
                return [
                    'allowed' => false,
                    'limit' => $limit,
                    'remaining' => 0,
                    'resetTime' => $resetTime,
                    'retryAfter' => $resetTime - $now
                ];
            }
            
            // Add current request
            $stmt = $this->db->prepare("
                INSERT INTO rate_limits (identifier, endpoint, created_at) 
                VALUES (?, ?, FROM_UNIXTIME(?))
            ");
            $stmt->execute([$identifier, $endpoint, $now]);
            
            return [
                'allowed' => true,
                'limit' => $limit,
                'remaining' => $limit - $currentCount - 1,
                'resetTime' => $now + $window,
                'retryAfter' => 0
            ];
            
        } catch (Exception $e) {
            error_log("Database rate limiting error: " . $e->getMessage());
            // Fallback to allowing request if database fails
            return [
                'allowed' => true,
                'limit' => $limit,
                'remaining' => $limit - 1,
                'resetTime' => $now + $window,
                'retryAfter' => 0
            ];
        }
    }
    
    /**
     * Apply rate limit to API endpoint
     * @param string $endpoint API endpoint name
     * @param array $limits Rate limit configuration
     * @return bool Whether request is allowed
     */
    public function applyRateLimit($endpoint, $limits = []) {
        // Default rate limits per endpoint
        $defaultLimits = [
            'auth' => ['limit' => 5, 'window' => 300], // 5 requests per 5 minutes
            'messages' => ['limit' => 100, 'window' => 60], // 100 messages per minute
            'upload' => ['limit' => 10, 'window' => 60], // 10 uploads per minute
            'api' => ['limit' => 200, 'window' => 60], // 200 API calls per minute
            'webrtc' => ['limit' => 20, 'window' => 60], // 20 WebRTC calls per minute
            'default' => ['limit' => 60, 'window' => 60] // Default: 60 requests per minute
        ];
        
        // Get limits for this endpoint
        $endpointLimits = $limits ?: ($defaultLimits[$endpoint] ?? $defaultLimits['default']);
        
        // Get identifier (prefer user ID, fallback to IP)
        session_start();
        $identifier = $_SESSION['user_id'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        
        // Check rate limit
        $rateLimitStatus = $this->checkRateLimit(
            $identifier, 
            $endpoint, 
            $endpointLimits['limit'], 
            $endpointLimits['window']
        );
        
        // Add rate limit headers
        header("X-RateLimit-Limit: " . $rateLimitStatus['limit']);
        header("X-RateLimit-Remaining: " . $rateLimitStatus['remaining']);
        header("X-RateLimit-Reset: " . $rateLimitStatus['resetTime']);
        
        if (!$rateLimitStatus['allowed']) {
            header("Retry-After: " . $rateLimitStatus['retryAfter']);
            http_response_code(429);
            echo json_encode([
                'error' => 'Rate limit exceeded',
                'message' => 'Too many requests. Please try again later.',
                'retryAfter' => $rateLimitStatus['retryAfter']
            ]);
            
            // Log rate limit violation
            $this->logRateLimitViolation($identifier, $endpoint, $rateLimitStatus);
            return false;
        }
        
        return true;
    }
    
    /**
     * Log rate limit violations for monitoring
     */
    private function logRateLimitViolation($identifier, $endpoint, $rateLimitStatus) {
        try {
            $logData = [
                'identifier' => $identifier,
                'endpoint' => $endpoint,
                'limit' => $rateLimitStatus['limit'],
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
                'timestamp' => time()
            ];
            
            error_log("Rate limit violation: " . json_encode($logData), 3, Config::getLogFile());
            
            // Store in database for analysis
            $stmt = $this->db->prepare("
                INSERT INTO rate_limit_violations (
                    identifier, endpoint, ip_address, user_agent, violation_data, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $identifier,
                $endpoint,
                $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
                json_encode($logData)
            ]);
            
        } catch (Exception $e) {
            error_log("Failed to log rate limit violation: " . $e->getMessage());
        }
    }
    
    /**
     * Get rate limit status for an identifier and endpoint
     */
    public function getRateLimitStatus($identifier, $endpoint) {
        $defaultLimits = [
            'auth' => ['limit' => 5, 'window' => 300],
            'messages' => ['limit' => 100, 'window' => 60],
            'upload' => ['limit' => 10, 'window' => 60],
            'api' => ['limit' => 200, 'window' => 60],
            'webrtc' => ['limit' => 20, 'window' => 60],
            'default' => ['limit' => 60, 'window' => 60]
        ];
        
        $limits = $defaultLimits[$endpoint] ?? $defaultLimits['default'];
        
        return $this->checkRateLimit($identifier, $endpoint, $limits['limit'], $limits['window']);
    }
}
