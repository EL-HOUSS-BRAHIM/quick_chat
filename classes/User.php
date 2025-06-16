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
        $sessionData = $this->createSession($user['id'], $rememberMe ? 'remember_me' : 'password');
        $sessionId = $sessionData['session_id'];
        
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
        // Convert boolean to integer for MySQL BOOLEAN column
        $status = $isOnline ? 1 : 0;
        $this->db->query("UPDATE users SET is_online = ? WHERE id = ?", [$status, $userId]);
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
    
    // Session management methods
    public function validateSession($sessionId) {
        $sql = "SELECT s.*, u.id as user_id, u.username, u.email, u.display_name, u.avatar 
                FROM user_sessions s 
                JOIN users u ON s.user_id = u.id 
                WHERE s.session_id = ? AND s.expires_at > NOW() AND s.is_active = 1";
        
        $session = $this->db->fetch($sql, [$sessionId]);
        
        if ($session) {
            // Update last activity
            $this->db->query("UPDATE user_sessions SET last_activity = NOW() WHERE session_id = ?", [$sessionId]);
            return $session;
        }
        
        return false;
    }
    
    public function getSession($sessionId) {
        $sql = "SELECT * FROM user_sessions WHERE session_id = ? AND is_active = 1";
        return $this->db->fetch($sql, [$sessionId]);
    }
    
    public function deleteSession($sessionId) {
        $sql = "UPDATE user_sessions SET is_active = 0 WHERE session_id = ?";
        return $this->db->query($sql, [$sessionId]);
    }
    
    // Rate limiting methods
    public function isRateLimited($userId, $action = 'login', $maxAttempts = 5, $timeWindow = 300) {
        $sql = "SELECT COUNT(*) as attempts FROM audit_logs 
                WHERE user_id = ? AND action = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)";
        
        $result = $this->db->fetch($sql, [$userId, $action, $timeWindow]);
        return $result['attempts'] >= $maxAttempts;
    }
    
    public function recordFailedLogin($identifier, $reason = 'invalid_credentials') {
        // Record failed login attempt for rate limiting
        $sql = "INSERT INTO failed_login_attempts (identifier, reason, ip_address, user_agent) 
                VALUES (?, ?, ?, ?)";
        
        $this->db->query($sql, [
            $identifier,
            $reason,
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
    
    public function incrementFailedAttempts($userId) {
        $sql = "UPDATE users SET failed_login_attempts = failed_login_attempts + 1, 
                last_failed_login = NOW() WHERE id = ?";
        $this->db->query($sql, [$userId]);
    }
    
    public function resetFailedAttempts($userId) {
        $sql = "UPDATE users SET failed_login_attempts = 0, last_failed_login = NULL WHERE id = ?";
        $this->db->query($sql, [$userId]);
    }
    
    public function updateLastLogin($userId) {
        $sql = "UPDATE users SET last_login = NOW(), last_seen = NOW() WHERE id = ?";
        $this->db->query($sql, [$userId]);
    }
    
    // User lookup methods
    public function getUserByEmail($email) {
        $sql = "SELECT * FROM users WHERE email = ?";
        return $this->db->fetch($sql, [$email]);
    }
    
    public function updateEmail($userId, $newEmail) {
        // Validate email
        if (!$this->validateEmail($newEmail)) {
            throw new Exception("Invalid email address.");
        }
        
        // Check if email already exists
        if ($this->emailExists($newEmail)) {
            throw new Exception("Email already registered to another account.");
        }
        
        $sql = "UPDATE users SET email = ?, email_verified = 0 WHERE id = ?";
        $result = $this->db->query($sql, [$newEmail, $userId]);
        
        if ($result) {
            $this->logAuditEvent($userId, 'email_updated', ['new_email' => $newEmail]);
            return true;
        }
        
        return false;
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
    
    /**
     * Create user from SSO (Google, Facebook, etc.)
     */
    public function createUserFromSSO($userData) {
        // Validate required fields
        if (empty($userData['email']) || empty($userData['username'])) {
            throw new Exception("Email and username are required for SSO user creation");
        }
        
        // Check if user already exists by email
        if ($this->emailExists($userData['email'])) {
            throw new Exception("User with this email already exists");
        }
        
        try {
            $this->db->beginTransaction();
            
            $sql = "INSERT INTO users (
                username, email, display_name, google_id, facebook_id, 
                avatar_url, email_verified, created_via, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
            
            $params = [
                $userData['username'],
                $userData['email'],
                $userData['display_name'] ?? $userData['email'],
                $userData['google_id'] ?? null,
                $userData['facebook_id'] ?? null,
                $userData['avatar_url'] ?? null,
                $userData['email_verified'] ?? true,
                $userData['created_via'] ?? 'sso'
            ];
            
            $this->db->query($sql, $params);
            $userId = $this->db->getConnection()->lastInsertId();
            
            // Create user settings
            $this->createDefaultUserSettings($userId);
            
            $this->db->commit();
            
            error_log("SSO user created successfully: ID $userId, Email: " . $userData['email']);
            
            return $userId;
            
        } catch (Exception $e) {
            $this->db->rollback();
            error_log("SSO user creation failed: " . $e->getMessage());
            throw new Exception("Failed to create user account");
        }
    }
    
    /**
     * Update user with Google SSO information
     */
    public function updateGoogleSSO($userId, $googleId, $googleData) {
        try {
            $sql = "UPDATE users SET 
                    google_id = ?, 
                    display_name = COALESCE(NULLIF(display_name, ''), ?),
                    avatar_url = COALESCE(NULLIF(avatar_url, ''), ?),
                    email_verified = 1,
                    last_login = NOW()
                    WHERE id = ?";
            
            $params = [
                $googleId,
                $googleData['name'] ?? null,
                $googleData['picture'] ?? null,
                $userId
            ];
            
            $this->db->query($sql, $params);
            
            error_log("Google SSO data updated for user ID: $userId");
            
        } catch (Exception $e) {
            error_log("Failed to update Google SSO data: " . $e->getMessage());
            throw new Exception("Failed to update user profile");
        }
    }
    
    /**
     * Update user with Facebook SSO information
     */
    public function updateFacebookSSO($userId, $facebookId, $facebookData) {
        try {
            $sql = "UPDATE users SET 
                    facebook_id = ?, 
                    display_name = COALESCE(NULLIF(display_name, ''), ?),
                    avatar_url = COALESCE(NULLIF(avatar_url, ''), ?),
                    email_verified = 1,
                    last_login = NOW()
                    WHERE id = ?";
            
            $params = [
                $facebookId,
                $facebookData['name'] ?? null,
                $facebookData['picture']['data']['url'] ?? null,
                $userId
            ];
            
            $this->db->query($sql, $params);
            
            error_log("Facebook SSO data updated for user ID: $userId");
            
        } catch (Exception $e) {
            error_log("Failed to update Facebook SSO data: " . $e->getMessage());
            throw new Exception("Failed to update user profile");
        }
    }
    
    /**
     * Get user by Google ID
     */
    public function getUserByGoogleId($googleId) {
        $sql = "SELECT * FROM users WHERE google_id = ? AND deleted_at IS NULL";
        $stmt = $this->db->query($sql, [$googleId]);
        return $stmt->fetch();
    }
    
    /**
     * Get user by Facebook ID
     */
    public function getUserByFacebookId($facebookId) {
        $sql = "SELECT * FROM users WHERE facebook_id = ? AND deleted_at IS NULL";
        $stmt = $this->db->query($sql, [$facebookId]);
        return $stmt->fetch();
    }
    
    /**
     * Create session for user (including SSO logins)
     */
    public function createSession($userId, $loginMethod = 'password') {
        try {
            // Generate session ID
            $sessionId = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', time() + Config::getSessionLifetime());
            
            // Create session record (removed login_method column as it doesn't exist)
            $sql = "INSERT INTO user_sessions (user_id, session_id, expires_at, ip_address, user_agent, created_at) 
                    VALUES (?, ?, ?, ?, ?, NOW())";
            
            $result = $this->db->query($sql, [
                $userId, 
                $sessionId, 
                $expiresAt,
                $_SERVER['REMOTE_ADDR'] ?? '',
                $_SERVER['HTTP_USER_AGENT'] ?? ''
            ]);
            
            if (!$result) {
                throw new Exception("Failed to insert session into database");
            }
            
            // Update last login
            $this->updateLastLogin($userId);
            
            return [
                'session_id' => $sessionId,
                'expires_at' => $expiresAt,
                'login_method' => $loginMethod
            ];
            
        } catch (Exception $e) {
            error_log("Failed to create session: " . $e->getMessage());
            throw new Exception("Failed to create session: " . $e->getMessage());
        }
    }
    
    /**
     * Create default user settings
     */
    private function createDefaultUserSettings($userId) {
        $sql = "INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES 
                (?, 'theme', 'light'),
                (?, 'notifications_enabled', '1'),
                (?, 'sound_enabled', '1'),
                (?, 'privacy_online_status', '1'),
                (?, 'privacy_read_receipts', '1')";
        
        $this->db->query($sql, [$userId, $userId, $userId, $userId, $userId]);
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
    
    // Session cleanup methods
    public function cleanupExpiredSessions() {
        // Delete expired sessions
        $sql = "DELETE FROM user_sessions WHERE expires_at < NOW()";
        $deletedCount = $this->db->query($sql)->rowCount();
        
        // Also cleanup inactive sessions older than 30 days
        $sql = "DELETE FROM user_sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL 30 DAY)";
        $this->db->query($sql);
        
        return $deletedCount;
    }
}
?>
