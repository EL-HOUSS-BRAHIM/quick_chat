<?php
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class User {
    private $db;
    private $security;
    
    public function __construct() {
        $this->db = Database::getInstance();
        $this->security = new Security();
    }
    
    public function register($username, $email, $password) {
        // Validate input
        if (!$this->validateUsername($username)) {
            throw new Exception("Invalid username. Must be 3-20 characters, alphanumeric only.");
        }
        
        if (!$this->validateEmail($email)) {
            throw new Exception("Invalid email address.");
        }
        
        if (!$this->validatePassword($password)) {
            throw new Exception("Password must be at least 8 characters with uppercase, lowercase, number and special character.");
        }
        
        // Check if user already exists
        if ($this->usernameExists($username)) {
            throw new Exception("Username already exists.");
        }
        
        if ($this->emailExists($email)) {
            throw new Exception("Email already registered.");
        }
        
        try {
            $this->db->beginTransaction();
            
            // Hash password
            $passwordHash = $this->security->hashPassword($password);
            
            // Generate verification token
            $verificationToken = bin2hex(random_bytes(32));
            
            // Insert user
            $sql = "INSERT INTO users (username, email, password_hash, display_name, verification_token) 
                    VALUES (?, ?, ?, ?, ?)";
            
            $this->db->query($sql, [
                $username,
                $email,
                $passwordHash,
                $username,
                $verificationToken
            ]);
            
            $userId = $this->db->lastInsertId();
            
            // Create default settings
            $this->createDefaultSettings($userId);
            
            // Log registration
            $this->logAuditEvent($userId, 'user_registered', [
                'username' => $username,
                'email' => $email
            ]);
            
            $this->db->commit();
            
            // Send verification email (if email settings configured)
            $this->sendVerificationEmail($email, $verificationToken);
            
            return $userId;
            
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }
    }
    
    public function login($username, $password, $rememberMe = false) {
        // Check rate limiting
        if ($this->isRateLimited($username, 'login')) {
            throw new Exception("Too many login attempts. Please try again later.");
        }
        
        // Get user
        $user = $this->getUserByUsername($username);
        if (!$user) {
            $this->recordFailedLogin($username);
            throw new Exception("Invalid username or password.");
        }
        
        // Check if account is locked
        if ($user['locked_until'] && new DateTime() < new DateTime($user['locked_until'])) {
            throw new Exception("Account is temporarily locked. Please try again later.");
        }
        
        // Verify password
        if (!$this->security->verifyPassword($password, $user['password_hash'])) {
            $this->recordFailedLogin($username);
            $this->incrementFailedAttempts($user['id']);
            throw new Exception("Invalid username or password.");
        }
        
        // Check if email is verified
        if (!$user['email_verified']) {
            throw new Exception("Please verify your email address before logging in.");
        }
        
        // Reset failed attempts
        $this->resetFailedAttempts($user['id']);
        
        // Create session
        $sessionId = $this->createSession($user['id'], $rememberMe);
        
        // Update last seen and online status
        $this->updateLastSeen($user['id']);
        $this->setOnlineStatus($user['id'], true);
        
        // Log successful login
        $this->logAuditEvent($user['id'], 'user_login', [
            'session_id' => $sessionId,
            'remember_me' => $rememberMe
        ]);
        
        return [
            'user_id' => $user['id'],
            'username' => $user['username'],
            'display_name' => $user['display_name'],
            'session_id' => $sessionId
        ];
    }
    
    public function logout($sessionId = null) {
        if (!$sessionId && isset($_SESSION['session_id'])) {
            $sessionId = $_SESSION['session_id'];
        }
        
        if ($sessionId) {
            // Get user ID before deleting session
            $session = $this->getSession($sessionId);
            if ($session) {
                $userId = $session['user_id'];
                
                // Delete session
                $this->deleteSession($sessionId);
                
                // Update online status
                $this->setOnlineStatus($userId, false);
                
                // Log logout
                $this->logAuditEvent($userId, 'user_logout', [
                    'session_id' => $sessionId
                ]);
            }
        }
        
        // Clear PHP session
        session_destroy();
    }
    
    public function getUserById($userId) {
        $sql = "SELECT id, username, email, display_name, avatar, last_seen, is_online, email_verified, created_at 
                FROM users WHERE id = ?";
        return $this->db->fetch($sql, [$userId]);
    }
    
    public function getUserByUsername($username) {
        $sql = "SELECT * FROM users WHERE username = ?";
        return $this->db->fetch($sql, [$username]);
    }
    
    public function updateProfile($userId, $displayName, $avatar = null) {
        $sql = "UPDATE users SET display_name = ?";
        $params = [$displayName];
        
        if ($avatar) {
            $sql .= ", avatar = ?";
            $params[] = $avatar;
        }
        
        $sql .= " WHERE id = ?";
        $params[] = $userId;
        
        $this->db->query($sql, $params);
        
        $this->logAuditEvent($userId, 'profile_updated', [
            'display_name' => $displayName,
            'avatar_updated' => !is_null($avatar)
        ]);
    }
    
    public function changePassword($userId, $oldPassword, $newPassword) {
        $user = $this->getUserById($userId);
        if (!$user) {
            throw new Exception("User not found.");
        }
        
        // Verify old password
        $fullUser = $this->db->fetch("SELECT password_hash FROM users WHERE id = ?", [$userId]);
        if (!$this->security->verifyPassword($oldPassword, $fullUser['password_hash'])) {
            throw new Exception("Current password is incorrect.");
        }
        
        // Validate new password
        if (!$this->validatePassword($newPassword)) {
            throw new Exception("New password does not meet requirements.");
        }
        
        // Hash new password
        $newPasswordHash = $this->security->hashPassword($newPassword);
        
        // Update password
        $this->db->query("UPDATE users SET password_hash = ? WHERE id = ?", [$newPasswordHash, $userId]);
        
        // Invalidate all sessions except current
        $currentSessionId = $_SESSION['session_id'] ?? null;
        $sql = "DELETE FROM sessions WHERE user_id = ?";
        $params = [$userId];
        
        if ($currentSessionId) {
            $sql .= " AND id != ?";
            $params[] = $currentSessionId;
        }
        
        $this->db->query($sql, $params);
        
        $this->logAuditEvent($userId, 'password_changed');
    }
    
    public function resetPassword($email) {
        $user = $this->db->fetch("SELECT * FROM users WHERE email = ?", [$email]);
        if (!$user) {
            // Don't reveal if email exists
            return true;
        }
        
        // Generate reset token
        $resetToken = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));
        
        // Save reset token
        $this->db->query(
            "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
            [$resetToken, $expiresAt, $user['id']]
        );
        
        // Send reset email
        $this->sendPasswordResetEmail($email, $resetToken);
        
        $this->logAuditEvent($user['id'], 'password_reset_requested');
        
        return true;
    }
    
    public function getOnlineUsers() {
        $sql = "SELECT id, username, display_name, avatar, last_seen 
                FROM users 
                WHERE is_online = TRUE 
                ORDER BY last_seen DESC";
        return $this->db->fetchAll($sql);
    }
    
    public function updateLastSeen($userId) {
        $this->db->query("UPDATE users SET last_seen = NOW() WHERE id = ?", [$userId]);
    }
    
    public function setOnlineStatus($userId, $isOnline) {
        $this->db->query("UPDATE users SET is_online = ? WHERE id = ?", [$isOnline, $userId]);
    }
    
    public function getUserSettings($userId) {
        $sql = "SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?";
        $rows = $this->db->fetchAll($sql, [$userId]);
        
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = json_decode($row['setting_value'], true);
        }
        
        return $settings;
    }
    
    public function updateUserSetting($userId, $key, $value) {
        $sql = "INSERT INTO user_settings (user_id, setting_key, setting_value) 
                VALUES (?, ?, ?) 
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)";
        
        $this->db->query($sql, [$userId, $key, json_encode($value)]);
    }
    
    private function validateUsername($username) {
        return preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username);
    }
    
    private function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    private function validatePassword($password) {
        // At least 8 characters, uppercase, lowercase, number, special character
        return strlen($password) >= 8 &&
               preg_match('/[A-Z]/', $password) &&
               preg_match('/[a-z]/', $password) &&
               preg_match('/[0-9]/', $password) &&
               preg_match('/[^A-Za-z0-9]/', $password);
    }
    
    private function usernameExists($username) {
        $result = $this->db->fetch("SELECT id FROM users WHERE username = ?", [$username]);
        return $result !== false;
    }
    
    private function emailExists($email) {
        $result = $this->db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
        return $result !== false;
    }
    
    private function createDefaultSettings($userId) {
        $defaultSettings = [
            'notifications_sound' => true,
            'notifications_desktop' => true,
            'theme' => 'light',
            'language' => 'en'
        ];
        
        foreach ($defaultSettings as $key => $value) {
            $this->updateUserSetting($userId, $key, $value);
        }
    }
    
    private function createSession($userId, $rememberMe = false) {
        $sessionId = bin2hex(random_bytes(32));
        $expiresAt = $rememberMe 
            ? date('Y-m-d H:i:s', time() + Config::getRememberMeLifetime())
            : date('Y-m-d H:i:s', time() + Config::getSessionLifetime());
        
        $sql = "INSERT INTO sessions (id, user_id, ip_address, user_agent, expires_at, is_remember_token) 
                VALUES (?, ?, ?, ?, ?, ?)";
        
        $this->db->query($sql, [
            $sessionId,
            $userId,
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? '',
            $expiresAt,
            $rememberMe
        ]);
        
        // Set session cookie
        setcookie('session_id', $sessionId, $rememberMe ? time() + Config::getRememberMeLifetime() : 0, '/', '', isset($_SERVER['HTTPS']), true);
        $_SESSION['session_id'] = $sessionId;
        $_SESSION['user_id'] = $userId;
        
        return $sessionId;
    }
    
    private function getSession($sessionId) {
        $sql = "SELECT * FROM sessions WHERE id = ? AND expires_at > NOW()";
        return $this->db->fetch($sql, [$sessionId]);
    }
    
    private function deleteSession($sessionId) {
        $this->db->query("DELETE FROM sessions WHERE id = ?", [$sessionId]);
    }
    
    private function isRateLimited($identifier, $action) {
        $sql = "SELECT attempts FROM rate_limits 
                WHERE identifier = ? AND action_type = ? 
                AND window_start > DATE_SUB(NOW(), INTERVAL 1 HOUR)";
        
        $result = $this->db->fetch($sql, [$identifier, $action]);
        
        $maxAttempts = $action === 'login' ? Config::getMaxLoginAttempts() : 10;
        
        return $result && $result['attempts'] >= $maxAttempts;
    }
    
    private function recordFailedLogin($username) {
        $sql = "INSERT INTO rate_limits (identifier, action_type, attempts) 
                VALUES (?, 'login', 1) 
                ON DUPLICATE KEY UPDATE attempts = attempts + 1";
        
        $this->db->query($sql, [$username]);
    }
    
    private function incrementFailedAttempts($userId) {
        $sql = "UPDATE users SET failed_login_attempts = failed_login_attempts + 1";
        
        // Lock account after max attempts
        if ($this->getFailedAttempts($userId) >= Config::getMaxLoginAttempts() - 1) {
            $lockUntil = date('Y-m-d H:i:s', time() + Config::getLoginLockoutTime());
            $sql .= ", locked_until = '$lockUntil'";
        }
        
        $sql .= " WHERE id = ?";
        $this->db->query($sql, [$userId]);
    }
    
    private function resetFailedAttempts($userId) {
        $this->db->query("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", [$userId]);
    }
    
    private function getFailedAttempts($userId) {
        $result = $this->db->fetch("SELECT failed_login_attempts FROM users WHERE id = ?", [$userId]);
        return $result ? $result['failed_login_attempts'] : 0;
    }
    
    private function logAuditEvent($userId, $action, $details = null) {
        $sql = "INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
                VALUES (?, ?, ?, ?, ?)";
        
        $this->db->query($sql, [
            $userId,
            $action,
            $details ? json_encode($details) : null,
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
    
    private function sendVerificationEmail($email, $token) {
        // Implementation depends on your email service
        // This is a placeholder for email verification
        error_log("Verification email sent to: $email with token: $token");
    }
    
    private function sendPasswordResetEmail($email, $token) {
        // Implementation depends on your email service
        // This is a placeholder for password reset email
        error_log("Password reset email sent to: $email with token: $token");
    }
}
?>
