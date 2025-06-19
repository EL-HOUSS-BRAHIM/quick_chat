<?php
namespace QuickChat\Services;

/**
 * Rate Limit Service
 * 
 * Handles rate limiting for API and sensitive endpoints
 */
class RateLimit
{
    /**
     * @var string
     */
    private $key;
    
    /**
     * @var int
     */
    private $limit;
    
    /**
     * @var int
     */
    private $interval;
    
    /**
     * @var int
     */
    private $remaining;
    
    /**
     * @var int
     */
    private $reset;
    
    /**
     * @var array
     */
    private static $routes = [
        // API routes (default: 60 requests per minute)
        'api' => [
            'limit' => 60,
            'interval' => 60
        ],
        
        // Authentication routes (default: 5 requests per minute)
        'auth' => [
            'limit' => 5,
            'interval' => 60
        ]
    ];
    
    /**
     * Constructor
     * 
     * @param string $ip The client IP address
     * @param string $route The requested route
     * @param string $method The HTTP method
     */
    public function __construct(string $ip, string $route, string $method)
    {
        // Determine rate limit configuration for the route
        $config = $this->getRouteConfig($route, $method);
        
        $this->limit = $config['limit'];
        $this->interval = $config['interval'];
        
        // Create a unique key for this rate limit
        $this->key = 'rate_limit:' . md5($ip . ':' . $route . ':' . $method);
        
        // Get current rate limit status
        $this->loadStatus();
    }
    
    /**
     * Check if the request is rate limited
     * 
     * @return bool True if request is limited
     */
    public function isLimited(): bool
    {
        // If no remaining requests or reset time has passed
        if ($this->remaining <= 0 && time() < $this->reset) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Increment the request count
     */
    public function increment(): void
    {
        // If reset time has passed, reset the count
        if (time() > $this->reset) {
            $this->remaining = $this->limit - 1;
            $this->reset = time() + $this->interval;
        } else {
            // Decrement remaining requests
            $this->remaining--;
        }
        
        // Store the updated values
        $this->saveStatus();
    }
    
    /**
     * Get the time until rate limit resets
     * 
     * @return int Seconds until reset
     */
    public function getRetryAfter(): int
    {
        return max(0, $this->reset - time());
    }
    
    /**
     * Get the rate limit
     * 
     * @return int The rate limit
     */
    public function getLimit(): int
    {
        return $this->limit;
    }
    
    /**
     * Get remaining requests
     * 
     * @return int Remaining requests
     */
    public function getRemaining(): int
    {
        return max(0, $this->remaining);
    }
    
    /**
     * Get reset timestamp
     * 
     * @return int Reset timestamp
     */
    public function getReset(): int
    {
        return $this->reset;
    }
    
    /**
     * Get rate limit configuration for a route
     * 
     * @param string $route The requested route
     * @param string $method The HTTP method
     * @return array The rate limit configuration
     */
    private function getRouteConfig(string $route, string $method): array
    {
        // Check for specific route configuration
        foreach (self::$routes as $pattern => $config) {
            if (strpos($route, "/{$pattern}/") === 0) {
                return $config;
            }
        }
        
        // Check for authentication endpoints
        $authEndpoints = [
            '/login',
            '/register',
            '/password/reset',
            '/password/forgot',
            '/auth'
        ];
        
        foreach ($authEndpoints as $endpoint) {
            if (strpos($route, $endpoint) !== false) {
                return self::$routes['auth'];
            }
        }
        
        // Default to API rate limit
        return self::$routes['api'];
    }
    
    /**
     * Load the current rate limit status
     */
    private function loadStatus(): void
    {
        // Check if we have Redis available
        if (class_exists('\\Redis') && isset($_ENV['REDIS_ENABLED']) && $_ENV['REDIS_ENABLED'] === 'true') {
            $this->loadFromRedis();
        } else {
            $this->loadFromApc();
        }
    }
    
    /**
     * Save the rate limit status
     */
    private function saveStatus(): void
    {
        // Check if we have Redis available
        if (class_exists('\\Redis') && isset($_ENV['REDIS_ENABLED']) && $_ENV['REDIS_ENABLED'] === 'true') {
            $this->saveToRedis();
        } else {
            $this->saveToApc();
        }
    }
    
    /**
     * Load rate limit status from Redis
     */
    private function loadFromRedis(): void
    {
        try {
            $redis = new \Redis();
            $redis->connect($_ENV['REDIS_HOST'] ?? '127.0.0.1', $_ENV['REDIS_PORT'] ?? 6379);
            
            if (isset($_ENV['REDIS_PASSWORD'])) {
                $redis->auth($_ENV['REDIS_PASSWORD']);
            }
            
            // Get rate limit data
            $data = $redis->get($this->key);
            
            if ($data) {
                $data = json_decode($data, true);
                $this->remaining = $data['remaining'];
                $this->reset = $data['reset'];
            } else {
                // New rate limit
                $this->remaining = $this->limit;
                $this->reset = time() + $this->interval;
            }
            
            $redis->close();
        } catch (\Exception $e) {
            // Fallback to APC if Redis fails
            $this->loadFromApc();
            
            // Log the error
            if (class_exists('\\QuickChat\\Services\\Logger')) {
                Logger::error('Redis connection failed for rate limiting', [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
    
    /**
     * Save rate limit status to Redis
     */
    private function saveToRedis(): void
    {
        try {
            $redis = new \Redis();
            $redis->connect($_ENV['REDIS_HOST'] ?? '127.0.0.1', $_ENV['REDIS_PORT'] ?? 6379);
            
            if (isset($_ENV['REDIS_PASSWORD'])) {
                $redis->auth($_ENV['REDIS_PASSWORD']);
            }
            
            // Save rate limit data
            $data = json_encode([
                'remaining' => $this->remaining,
                'reset' => $this->reset
            ]);
            
            // Set with expiration based on reset time
            $ttl = max(1, $this->reset - time() + 10); // Add 10 seconds buffer
            $redis->setex($this->key, $ttl, $data);
            
            $redis->close();
        } catch (\Exception $e) {
            // Fallback to APC if Redis fails
            $this->saveToApc();
            
            // Log the error
            if (class_exists('\\QuickChat\\Services\\Logger')) {
                Logger::error('Redis connection failed for rate limiting', [
                    'error' => $e->getMessage()
                ]);
            }
        }
    }
    
    /**
     * Load rate limit status from APC/APCu
     */
    private function loadFromApc(): void
    {
        // Check if APC or APCu is available
        $apcExists = function_exists('apc_fetch');
        $apcuExists = function_exists('apcu_fetch');
        
        if (!$apcExists && !$apcuExists) {
            // No caching available, use default values
            $this->remaining = $this->limit;
            $this->reset = time() + $this->interval;
            return;
        }
        
        // Fetch from cache
        $data = null;
        
        if ($apcuExists) {
            $data = apcu_fetch($this->key, $success);
        } else {
            $data = apc_fetch($this->key, $success);
        }
        
        if ($data) {
            $this->remaining = $data['remaining'];
            $this->reset = $data['reset'];
        } else {
            // New rate limit
            $this->remaining = $this->limit;
            $this->reset = time() + $this->interval;
        }
    }
    
    /**
     * Save rate limit status to APC/APCu
     */
    private function saveToApc(): void
    {
        // Check if APC or APCu is available
        $apcExists = function_exists('apc_store');
        $apcuExists = function_exists('apcu_store');
        
        if (!$apcExists && !$apcuExists) {
            // No caching available, can't save
            return;
        }
        
        // Save to cache
        $data = [
            'remaining' => $this->remaining,
            'reset' => $this->reset
        ];
        
        // TTL should be at least until reset time
        $ttl = max(1, $this->reset - time() + 10); // Add 10 seconds buffer
        
        if ($apcuExists) {
            apcu_store($this->key, $data, $ttl);
        } else {
            apc_store($this->key, $data, $ttl);
        }
    }
}
