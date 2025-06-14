<?php
require_once __DIR__ . '/../config/config.php';

class Security {
    
    public function hashPassword($password) {
        // Add pepper to password before hashing
        $pepperedPassword = $password . Config::getPasswordPepper();
        return password_hash($pepperedPassword, PASSWORD_ARGON2ID, [
            'memory_cost' => 65536, // 64 MB
            'time_cost' => 4,       // 4 iterations
            'threads' => 3          // 3 threads
        ]);
    }
    
    public function verifyPassword($password, $hash) {
        $pepperedPassword = $password . Config::getPasswordPepper();
        return password_verify($pepperedPassword, $hash);
    }
    
    public function sanitizeInput($input) {
        if (is_array($input)) {
            return array_map([$this, 'sanitizeInput'], $input);
        }
        
        return htmlspecialchars(trim($input), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    
    public function validateCSRF($token) {
        return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
    }
    
    public function generateCSRF() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
    
    public function encryptData($data, $key = null) {
        $key = $key ?: Config::getEncryptionKey();
        $iv = random_bytes(16);
        $encrypted = openssl_encrypt($data, 'AES-256-CBC', $key, 0, $iv);
        return base64_encode($iv . $encrypted);
    }
    
    public function decryptData($encryptedData, $key = null) {
        $key = $key ?: Config::getEncryptionKey();
        $data = base64_decode($encryptedData);
        $iv = substr($data, 0, 16);
        $encrypted = substr($data, 16);
        return openssl_decrypt($encrypted, 'AES-256-CBC', $key, 0, $iv);
    }
    
    public function generateJWT($payload, $expirationTime = null) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        if ($expirationTime) {
            $payload['exp'] = time() + $expirationTime;
        }
        $payload['iat'] = time();
        
        $payload = json_encode($payload);
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, Config::getJwtSecret(), true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        return $base64Header . "." . $base64Payload . "." . $base64Signature;
    }
    
    public function verifyJWT($jwt) {
        $tokenParts = explode('.', $jwt);
        if (count($tokenParts) !== 3) {
            return false;
        }
        
        $header = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[0]));
        $payload = base64_decode(str_replace(['-', '_'], ['+', '/'], $tokenParts[1]));
        $signatureProvided = $tokenParts[2];
        
        $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
        
        $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, Config::getJwtSecret(), true);
        $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
        
        if (!hash_equals($base64Signature, $signatureProvided)) {
            return false;
        }
        
        $payloadData = json_decode($payload, true);
        
        // Check expiration
        if (isset($payloadData['exp']) && time() > $payloadData['exp']) {
            return false;
        }
        
        return $payloadData;
    }
    
    public function validateFileUpload($file, $allowedTypes = [], $maxSize = null) {
        $maxSize = $maxSize ?: Config::getMaxFileSize();
        
        // Check if file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new Exception("Invalid file upload");
        }
        
        // Check file size
        if ($file['size'] > $maxSize) {
            throw new Exception("File size exceeds maximum allowed size");
        }
        
        // Check MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        
        if (!empty($allowedTypes) && !in_array($mimeType, $allowedTypes)) {
            throw new Exception("File type not allowed");
        }
        
        // Additional security checks for images
        if (strpos($mimeType, 'image/') === 0) {
            $imageInfo = getimagesize($file['tmp_name']);
            if ($imageInfo === false) {
                throw new Exception("Invalid image file");
            }
            
            // Check for embedded PHP code in images
            $fileContents = file_get_contents($file['tmp_name']);
            if (strpos($fileContents, '<?php') !== false || strpos($fileContents, '<?=') !== false) {
                throw new Exception("Suspicious file content detected");
            }
        }
        
        return [
            'original_name' => $file['name'],
            'mime_type' => $mimeType,
            'size' => $file['size'],
            'tmp_name' => $file['tmp_name']
        ];
    }
    
    public function generateSecureFilename($originalFilename) {
        $extension = pathinfo($originalFilename, PATHINFO_EXTENSION);
        $basename = pathinfo($originalFilename, PATHINFO_FILENAME);
        
        // Sanitize basename
        $basename = preg_replace('/[^a-zA-Z0-9_-]/', '', $basename);
        $basename = substr($basename, 0, 50); // Limit length
        
        // Generate unique suffix
        $uniqueSuffix = bin2hex(random_bytes(8));
        
        return $basename . '_' . $uniqueSuffix . '.' . $extension;
    }
    
    public function rateLimitCheck($identifier, $action, $maxAttempts = 60, $timeWindow = 3600) {
        $db = Database::getInstance();
        
        // Clean old records
        $db->query(
            "DELETE FROM rate_limits WHERE action_type = ? AND window_start < DATE_SUB(NOW(), INTERVAL ? SECOND)",
            [$action, $timeWindow]
        );
        
        // Get current attempts
        $result = $db->fetch(
            "SELECT attempts FROM rate_limits WHERE identifier = ? AND action_type = ?",
            [$identifier, $action]
        );
        
        $attempts = $result ? $result['attempts'] : 0;
        
        if ($attempts >= $maxAttempts) {
            throw new Exception("Rate limit exceeded for action: $action");
        }
        
        // Update or insert rate limit record
        $db->query(
            "INSERT INTO rate_limits (identifier, action_type, attempts, window_start) 
             VALUES (?, ?, 1, NOW()) 
             ON DUPLICATE KEY UPDATE attempts = attempts + 1",
            [$identifier, $action]
        );
        
        return true;
    }
    
    public function logSecurityEvent($event, $details = []) {
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'event' => $event,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'details' => $details
        ];
        
        error_log("SECURITY EVENT: " . json_encode($logData));
        
        // You could also store this in the database
        $db = Database::getInstance();
        $db->query(
            "INSERT INTO audit_logs (action, details, ip_address, user_agent) VALUES (?, ?, ?, ?)",
            [
                'security_event_' . $event,
                json_encode($details),
                $logData['ip_address'],
                $logData['user_agent']
            ]
        );
    }
    
    public function detectSuspiciousActivity($userId = null) {
        $db = Database::getInstance();
        $suspicious = false;
        $reasons = [];
        
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
        
        // Check for multiple failed logins from same IP
        $failedLogins = $db->fetch(
            "SELECT COUNT(*) as count FROM audit_logs 
             WHERE action = 'user_login_failed' 
             AND ip_address = ? 
             AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            [$ip]
        );
        
        if ($failedLogins && $failedLogins['count'] > 10) {
            $suspicious = true;
            $reasons[] = 'Multiple failed logins from IP';
        }
        
        // Check for rapid session creation
        if ($userId) {
            $recentSessions = $db->fetch(
                "SELECT COUNT(*) as count FROM sessions 
                 WHERE user_id = ? 
                 AND created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)",
                [$userId]
            );
            
            if ($recentSessions && $recentSessions['count'] > 5) {
                $suspicious = true;
                $reasons[] = 'Rapid session creation';
            }
        }
        
        // Check for unusual user agent patterns
        if (preg_match('/(bot|crawler|spider|scraper)/i', $userAgent)) {
            $suspicious = true;
            $reasons[] = 'Bot-like user agent';
        }
        
        if ($suspicious) {
            $this->logSecurityEvent('suspicious_activity', [
                'user_id' => $userId,
                'reasons' => $reasons
            ]);
        }
        
        return ['suspicious' => $suspicious, 'reasons' => $reasons];
    }
    
    public function generateApiKey() {
        return bin2hex(random_bytes(Config::getApiKeyLength() / 2));
    }
    
    public function validateApiKey($apiKey) {
        // In a real implementation, you'd check this against a database
        // For now, we'll just validate the format
        return preg_match('/^[a-f0-9]{' . Config::getApiKeyLength() . '}$/', $apiKey);
    }
    
    public function checkHoneypot($honeypotField) {
        // Honeypot field should be empty if filled by human
        return empty($honeypotField);
    }
    
    public function generateId() {
        return bin2hex(random_bytes(16));
    }
    
    public function isValidUUID($uuid) {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid);
    }
    
    public function maskSensitiveData($data, $mask = '***') {
        if (is_string($data)) {
            if (strlen($data) <= 4) {
                return $mask;
            }
            return substr($data, 0, 2) . $mask . substr($data, -2);
        }
        
        if (is_array($data)) {
            $masked = [];
            foreach ($data as $key => $value) {
                if (in_array(strtolower($key), ['password', 'token', 'secret', 'key'])) {
                    $masked[$key] = $mask;
                } else {
                    $masked[$key] = $value;
                }
            }
            return $masked;
        }
        
        return $data;
    }
}
?>
