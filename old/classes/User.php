<?php
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class User {
    public $db;
    private $security;
    
    public function __construct($db = null) {
        $this->db = $db ?: Database::getInstance();
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
        $sql = "DELETE FROM user_sessions WHERE user_id = ?";
        $params = [$userId];
        
        if ($currentSessionId) {
            $sql .= " AND session_id != ?";
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
        $sql = "SELECT * FROM user_settings WHERE user_id = ?";
        $result = $this->db->query($sql, [$userId]);
        $settings = $result->fetch();
        
        // Return default settings if none exist
        if (!$settings) {
            return [
                'notifications_enabled' => true,
                'sound_enabled' => true,
                'theme' => 'light',
                'privacy_level' => 'normal'
            ];
        }
        
        return $settings;
    }
    
    public function getTotalUserCount() {
        $sql = "SELECT COUNT(*) as count FROM users";
        $result = $this->db->query($sql);
        $row = $result->fetch();
        return $row['count'] ?? 0;
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
                WHERE user_id = ? AND event_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)";
        
        $result = $this->db->fetch($sql, [$userId, $action, $timeWindow]);
        return $result['attempts'] >= $maxAttempts;
    }
    
    public function recordFailedLogin($identifier, $reason = 'invalid_credentials') {
        // Record failed login attempt in audit logs
        $sql = "INSERT INTO audit_logs (event_type, event_data, ip_address, user_agent, created_at) 
                VALUES (?, ?, ?, ?, NOW())";
        
        $eventData = json_encode([
            'identifier' => $identifier,
            'reason' => $reason,
            'login_attempt' => true
        ]);
        
        $this->db->query($sql, [
            'user_login_failed',
            $eventData,
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
    
    public function recordSuccessfulLogin($userId, $username) {
        // Record successful login in audit logs
        $sql = "INSERT INTO audit_logs (user_id, event_type, event_data, ip_address, user_agent, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())";
        
        $eventData = json_encode([
            'username' => $username,
            'login_successful' => true
        ]);
        
        $this->db->query($sql, [
            $userId,
            'user_login_success',
            $eventData,
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
        $sql = "UPDATE users SET last_seen = NOW() WHERE id = ?";
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
    
    // Validation methods
    private function validateUsername($username) {
        return preg_match('/^[a-zA-Z0-9_]{3,20}$/', $username);
    }
    
    private function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    private function validatePassword($password) {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
        return preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/', $password);
    }
    
    private function usernameExists($username) {
        $sql = "SELECT COUNT(*) as count FROM users WHERE username = ?";
        $result = $this->db->fetch($sql, [$username]);
        return $result['count'] > 0;
    }
    
    private function emailExists($email) {
        $sql = "SELECT COUNT(*) as count FROM users WHERE email = ?";
        $result = $this->db->fetch($sql, [$email]);
        return $result['count'] > 0;
    }
    
    private function createDefaultSettings($userId) {
        $defaultSettings = [
            'theme' => 'light',
            'notifications_enabled' => 1,
            'sound_enabled' => 1,
            'auto_play_media' => 1,
            'show_online_status' => 1,
            'language' => 'en'
        ];
        
        foreach ($defaultSettings as $key => $value) {
            $sql = "INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)";
            $this->db->query($sql, [$userId, $key, json_encode($value)]);
        }
    }
    
    private function logAuditEvent($userId, $action, $details = []) {
        $sql = "INSERT INTO audit_logs (user_id, event_type, event_data, ip_address, user_agent, created_at) 
                VALUES (?, ?, ?, ?, ?, NOW())";
        
        $this->db->query($sql, [
            $userId,
            $action,
            json_encode($details),
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
    }
    
    private function sendVerificationEmail($email, $token) {
        // In a real application, you would send an actual email
        // For now, just log it
        error_log("Verification email would be sent to: $email with token: $token");
    }
    
    public function createSession($userId, $type = 'password', $rememberMe = false) {
        $sessionId = bin2hex(random_bytes(32));
        $expiresAt = $rememberMe ? 
            date('Y-m-d H:i:s', time() + Config::getRememberMeLifetime()) :
            date('Y-m-d H:i:s', time() + Config::getSessionLifetime());
        
        $sql = "INSERT INTO user_sessions (session_id, user_id, login_type, expires_at, ip_address, user_agent, created_at, last_activity) 
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())";
        
        $this->db->query($sql, [
            $sessionId,
            $userId,
            $type,
            $expiresAt,
            $_SERVER['REMOTE_ADDR'] ?? '',
            $_SERVER['HTTP_USER_AGENT'] ?? ''
        ]);
        
        return [
            'session_id' => $sessionId,
            'expires_at' => $expiresAt
        ];
    }
    
    private function sendPasswordResetEmail($email, $token) {
        // In a real application, you would send an actual email
        // For now, just log it
        error_log("Password reset email would be sent to: $email with token: $token");
    }
    
    // Missing methods referenced in API files
    public function searchUsers($query, $limit = 20) {
        $query = '%' . $query . '%';
        $sql = "SELECT id, username, display_name, email, avatar, status, last_seen 
                FROM users 
                WHERE (username LIKE ? OR display_name LIKE ? OR email LIKE ?) 
                AND is_active = 1
                ORDER BY username ASC 
                LIMIT ?";
        
        return $this->db->fetchAll($sql, [$query, $query, $query, $limit]);
    }
    
    public function getUserStats($userId) {
        $sql = "SELECT 
                    u.id,
                    u.username,
                    u.display_name,
                    u.created_at,
                    u.last_seen,
                    u.is_online,
                    COUNT(DISTINCT m.id) as message_count,
                    COUNT(DISTINCT s.id) as session_count
                FROM users u
                LEFT JOIN messages m ON u.id = m.user_id
                LEFT JOIN user_sessions s ON u.id = s.user_id
                WHERE u.id = ?
                GROUP BY u.id";
        
        return $this->db->fetch($sql, [$userId]);
    }
    
    public function updateUserStatus($userId, $status) {
        // Map status to boolean for is_online field
        $isOnline = ($status === 'online') ? 1 : 0;
        
        $sql = "UPDATE users SET is_online = ?, last_seen = NOW() WHERE id = ?";
        return $this->db->query($sql, [$isOnline, $userId]);
    }
    
    public function updateUserProfile($userId, $data) {
        $allowedFields = ['display_name', 'email', 'bio', 'avatar'];
        $updates = [];
        $params = [];
        
        foreach ($data as $field => $value) {
            if (in_array($field, $allowedFields)) {
                $updates[] = "$field = ?";
                $params[] = $value;
            }
        }
        
        if (empty($updates)) {
            throw new Exception("No valid fields to update");
        }
        
        $params[] = $userId;
        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
        
        return $this->db->query($sql, $params);
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
    
    /**
     * Update user's Google SSO information
     */
    public function updateGoogleSSO($userId, $googleId, $userInfo) {
        $sql = "UPDATE users SET 
                google_id = ?,
                google_email = ?,
                google_name = ?,
                google_picture = ?,
                updated_at = NOW()
                WHERE id = ?";
        
        return $this->db->query($sql, [
            $googleId,
            $userInfo['email'],
            $userInfo['name'],
            $userInfo['picture'] ?? null,
            $userId
        ]);
    }
    
    /**
     * Create new user from Google SSO data
     */
    public function createUserFromSSO($userInfo, $googleId) {
        $username = $this->generateUsername($userInfo['email']);
        
        $sql = "INSERT INTO users (
                    username, 
                    email, 
                    display_name, 
                    google_id, 
                    google_email, 
                    google_name, 
                    google_picture, 
                    email_verified,
                    password_hash,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, '', NOW())";
        
        $this->db->query($sql, [
            $username,
            $userInfo['email'],
            $userInfo['name'],
            $googleId,
            $userInfo['email'],
            $userInfo['name'],
            $userInfo['picture'] ?? null
        ]);
        
        return $this->db->lastInsertId();
    }
    
    /**
     * Generate unique username from email
     */
    private function generateUsername($email) {
        $baseUsername = strtolower(explode('@', $email)[0]);
        $baseUsername = preg_replace('/[^a-z0-9_]/', '', $baseUsername);
        
        $username = $baseUsername;
        $counter = 1;
        
        while ($this->getUserByUsername($username)) {
            $username = $baseUsername . $counter;
            $counter++;
        }
        
        return $username;
    }
    
    public function checkAuthentication() {
        // Start session if not already started
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Check if user is logged in
        if (!isset($_SESSION['user_id'])) {
            throw new Exception('Authentication required');
        }
        
        // Validate session
        if (!$this->isValidSession($_SESSION['user_id'])) {
            $this->logout();
            throw new Exception('Invalid session');
        }
        
        // Update last activity
        $this->updateLastActivity($_SESSION['user_id']);
        
        return $_SESSION['user_id'];
    }
    
    private function isValidSession($userId) {
        try {
            $stmt = $this->db->prepare("
                SELECT id, is_active, locked_until 
                FROM users 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user || !$user['is_active']) {
                return false;
            }
            
            // Check if account is locked
            if ($user['locked_until'] && new DateTime() < new DateTime($user['locked_until'])) {
                return false;
            }
            
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    private function updateLastActivity($userId) {
        try {
            $stmt = $this->db->prepare("
                UPDATE users 
                SET last_activity = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$userId]);
        } catch (Exception $e) {
            // Log error but don't throw - this is not critical
            error_log("Failed to update last activity: " . $e->getMessage());
        }
    }
}
?>
