<?php
$pageTitle = 'Profile Settings - Quick Chat';
$pageClass = 'profile-page';
$additionalCSS = [];
$additionalJS = [];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Handle form submissions
$message = '';
$messageType = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!AuthChecker::validateCSRF($_POST['csrf_token'] ?? '')) {
        $message = 'Invalid security token. Please try again.';
        $messageType = 'error';
    } else {
        require_once __DIR__ . '/classes/User.php';
        $userClass = new User();
        
        try {
            $action = $_POST['action'] ?? '';
            
            switch ($action) {
                case 'update_profile':
                    $displayName = trim($_POST['display_name'] ?? '');
                    $email = trim($_POST['email'] ?? '');
                    
                    if (empty($displayName)) {
                        throw new Exception('Display name is required.');
                    }
                    
                    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                        throw new Exception('Valid email address is required.');
                    }
                    
                    // Handle avatar upload if provided
                    $avatarPath = null;
                    if (isset($_FILES['avatar']) && $_FILES['avatar']['error'] === UPLOAD_ERR_OK) {
                        $avatarPath = $this->handleAvatarUpload($_FILES['avatar']);
                    }
                    
                    $userClass->updateProfile($currentUser['id'], $displayName, $avatarPath);
                    
                    // Update email if changed
                    if ($email !== $currentUser['email']) {
                        $userClass->updateEmail($currentUser['id'], $email);
                    }
                    
                    $message = 'Profile updated successfully!';
                    $messageType = 'success';
                    
                    // Refresh user data
                    $currentUser = $userClass->getUserById($currentUser['id']);
                    break;
                    
                case 'change_password':
                    $currentPassword = $_POST['current_password'] ?? '';
                    $newPassword = $_POST['new_password'] ?? '';
                    $confirmPassword = $_POST['confirm_password'] ?? '';
                    
                    if (empty($currentPassword) || empty($newPassword) || empty($confirmPassword)) {
                        throw new Exception('All password fields are required.');
                    }
                    
                    if ($newPassword !== $confirmPassword) {
                        throw new Exception('New passwords do not match.');
                    }
                    
                    $userClass->changePassword($currentUser['id'], $currentPassword, $newPassword);
                    
                    $message = 'Password changed successfully!';
                    $messageType = 'success';
                    break;
                    
                case 'update_settings':
                    $settings = [
                        'notifications_sound' => isset($_POST['notifications_sound']),
                        'notifications_desktop' => isset($_POST['notifications_desktop']),
                        'notifications_email' => isset($_POST['notifications_email']),
                        'theme' => $_POST['theme'] ?? 'light',
                        'language' => $_POST['language'] ?? 'en',
                        'timezone' => $_POST['timezone'] ?? 'UTC',
                        'privacy_online_status' => $_POST['privacy_online_status'] ?? 'everyone',
                        'privacy_last_seen' => $_POST['privacy_last_seen'] ?? 'everyone'
                    ];
                    
                    foreach ($settings as $key => $value) {
                        $userClass->updateUserSetting($currentUser['id'], $key, $value);
                    }
                    
                    $message = 'Settings updated successfully!';
                    $messageType = 'success';
                    break;
                    
                default:
                    throw new Exception('Invalid action.');
            }
        } catch (Exception $e) {
            $message = $e->getMessage();
            $messageType = 'error';
        }
    }
}

// Get user settings
require_once __DIR__ . '/classes/User.php';
$userClass = new User();
$userSettings = $userClass->getUserSettings($currentUser['id']);

include __DIR__ . '/includes/header.php';
?>

<div class="profile-container">
    <div class="profile-header">
        <h1>Profile Settings</h1>
        <p>Manage your account information and preferences</p>
    </div>
    
    <?php if ($message): ?>
    <div class="message <?php echo htmlspecialchars($messageType); ?>">
        <i class="fas fa-<?php 
            echo $messageType === 'success' ? 'check-circle' : 
                ($messageType === 'error' ? 'exclamation-circle' : 'exclamation-triangle'); 
        ?>"></i>
        <?php echo htmlspecialchars($message); ?>
    </div>
    <?php endif; ?>
    
    <div class="profile-tabs">
        <button class="tab-btn active" onclick="switchTab('profile')">
            <i class="fas fa-user"></i>
            Profile
        </button>
        <button class="tab-btn" onclick="switchTab('security')">
            <i class="fas fa-shield-alt"></i>
            Security
        </button>
        <button class="tab-btn" onclick="switchTab('settings')">
            <i class="fas fa-cog"></i>
            Settings
        </button>
        <button class="tab-btn" onclick="switchTab('privacy')">
            <i class="fas fa-lock"></i>
            Privacy
        </button>
    </div>
    
    <!-- Profile Tab -->
    <div id="profileTab" class="tab-content active">
        <div class="section-card">
            <div class="section-header">
                <h2>Profile Information</h2>
                <p>Update your personal information and profile picture</p>
            </div>
            
            <form method="POST" enctype="multipart/form-data" class="profile-form">
                <input type="hidden" name="action" value="update_profile">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                
                <div class="avatar-section">
                    <div class="current-avatar">
                        <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                             alt="Current Avatar" 
                             id="avatarPreview">
                    </div>
                    <div class="avatar-controls">
                        <label for="avatarUpload" class="upload-btn">
                            <i class="fas fa-camera"></i>
                            Change Photo
                        </label>
                        <input type="file" id="avatarUpload" name="avatar" accept="image/*" style="display: none;">
                        <button type="button" onclick="removeAvatar()" class="remove-btn">
                            <i class="fas fa-trash"></i>
                            Remove
                        </button>
                    </div>
                </div>
                
                <div class="form-grid">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" value="<?php echo htmlspecialchars($currentUser['username']); ?>" disabled>
                        <small>Username cannot be changed</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="display_name">Display Name</label>
                        <input type="text" id="display_name" name="display_name" 
                               value="<?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>" 
                               required minlength="2" maxlength="50">
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email Address</label>
                        <input type="email" id="email" name="email" 
                               value="<?php echo htmlspecialchars($currentUser['email']); ?>" 
                               required>
                        <?php if (!$currentUser['email_verified']): ?>
                        <small class="warning">
                            <i class="fas fa-exclamation-triangle"></i>
                            Email not verified. <a href="javascript:void(0)" onclick="resendVerification()">Resend verification</a>
                        </small>
                        <?php endif; ?>
                    </div>
                    
                    <div class="form-group">
                        <label for="member_since">Member Since</label>
                        <input type="text" value="<?php echo date('F j, Y', strtotime($currentUser['created_at'])); ?>" disabled>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i>
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- Security Tab -->
    <div id="securityTab" class="tab-content">
        <div class="section-card">
            <div class="section-header">
                <h2>Change Password</h2>
                <p>Keep your account secure by using a strong password</p>
            </div>
            
            <form method="POST" class="security-form">
                <input type="hidden" name="action" value="change_password">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                
                <div class="form-group">
                    <label for="current_password">Current Password</label>
                    <div class="password-input">
                        <input type="password" id="current_password" name="current_password" required>
                        <button type="button" class="toggle-password" onclick="togglePassword('current_password')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="new_password">New Password</label>
                    <div class="password-input">
                        <input type="password" id="new_password" name="new_password" required minlength="8">
                        <button type="button" class="toggle-password" onclick="togglePassword('new_password')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="password-strength" id="passwordStrength"></div>
                </div>
                
                <div class="form-group">
                    <label for="confirm_password">Confirm New Password</label>
                    <div class="password-input">
                        <input type="password" id="confirm_password" name="confirm_password" required minlength="8">
                        <button type="button" class="toggle-password" onclick="togglePassword('confirm_password')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-key"></i>
                        Change Password
                    </button>
                </div>
            </form>
        </div>
        
        <div class="section-card">
            <div class="section-header">
                <h2>Account Security</h2>
                <p>Monitor and manage your account security</p>
            </div>
            
            <div class="security-info">
                <div class="security-item">
                    <div class="security-icon">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="security-content">
                        <h4>Two-Factor Authentication</h4>
                        <p>Add an extra layer of security to your account</p>
                        <button class="btn btn-secondary" onclick="setup2FA()">
                            <i class="fas fa-mobile-alt"></i>
                            Set up 2FA
                        </button>
                    </div>
                </div>
                
                <div class="security-item">
                    <div class="security-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <div class="security-content">
                        <h4>Login History</h4>
                        <p>Review recent login activity on your account</p>
                        <button class="btn btn-secondary" onclick="viewLoginHistory()">
                            <i class="fas fa-list"></i>
                            View History
                        </button>
                    </div>
                </div>
                
                <div class="security-item">
                    <div class="security-icon">
                        <i class="fas fa-devices"></i>
                    </div>
                    <div class="security-content">
                        <h4>Active Sessions</h4>
                        <p>Manage devices that are currently signed in</p>
                        <button class="btn btn-secondary" onclick="manageSessions()">
                            <i class="fas fa-cog"></i>
                            Manage Sessions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Settings Tab -->
    <div id="settingsTab" class="tab-content">
        <div class="section-card">
            <div class="section-header">
                <h2>Preferences</h2>
                <p>Customize your Quick Chat experience</p>
            </div>
            
            <form method="POST" class="settings-form">
                <input type="hidden" name="action" value="update_settings">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                
                <div class="settings-section">
                    <h3>Notifications</h3>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label class="switch">
                                <input type="checkbox" name="notifications_sound" 
                                       <?php echo (!empty($userSettings['notifications_sound'])) ? 'checked' : ''; ?>>
                                <span class="slider"></span>
                            </label>
                            <div class="setting-info">
                                <h4>Sound Notifications</h4>
                                <p>Play sounds for new messages</p>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label class="switch">
                                <input type="checkbox" name="notifications_desktop" 
                                       <?php echo (!empty($userSettings['notifications_desktop'])) ? 'checked' : ''; ?>>
                                <span class="slider"></span>
                            </label>
                            <div class="setting-info">
                                <h4>Desktop Notifications</h4>
                                <p>Show desktop notifications for new messages</p>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label class="switch">
                                <input type="checkbox" name="notifications_email" 
                                       <?php echo (!empty($userSettings['notifications_email'])) ? 'checked' : ''; ?>>
                                <span class="slider"></span>
                            </label>
                            <div class="setting-info">
                                <h4>Email Notifications</h4>
                                <p>Receive email notifications for important updates</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Appearance</h3>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <div class="setting-info">
                                <h4>Theme</h4>
                                <p>Choose your preferred theme</p>
                            </div>
                            <select name="theme" class="form-select">
                                <option value="light" <?php echo ($userSettings['theme'] ?? 'light') === 'light' ? 'selected' : ''; ?>>Light</option>
                                <option value="dark" <?php echo ($userSettings['theme'] ?? 'light') === 'dark' ? 'selected' : ''; ?>>Dark</option>
                                <option value="auto" <?php echo ($userSettings['theme'] ?? 'light') === 'auto' ? 'selected' : ''; ?>>Auto</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <h4>Language</h4>
                                <p>Select your preferred language</p>
                            </div>
                            <select name="language" class="form-select">
                                <option value="en" <?php echo ($userSettings['language'] ?? 'en') === 'en' ? 'selected' : ''; ?>>English</option>
                                <option value="es" <?php echo ($userSettings['language'] ?? 'en') === 'es' ? 'selected' : ''; ?>>Español</option>
                                <option value="fr" <?php echo ($userSettings['language'] ?? 'en') === 'fr' ? 'selected' : ''; ?>>Français</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <div class="setting-info">
                                <h4>Timezone</h4>
                                <p>Set your local timezone</p>
                            </div>
                            <select name="timezone" class="form-select">
                                <option value="UTC" <?php echo ($userSettings['timezone'] ?? 'UTC') === 'UTC' ? 'selected' : ''; ?>>UTC</option>
                                <option value="America/New_York" <?php echo ($userSettings['timezone'] ?? 'UTC') === 'America/New_York' ? 'selected' : ''; ?>>Eastern Time</option>
                                <option value="America/Chicago" <?php echo ($userSettings['timezone'] ?? 'UTC') === 'America/Chicago' ? 'selected' : ''; ?>>Central Time</option>
                                <option value="America/Denver" <?php echo ($userSettings['timezone'] ?? 'UTC') === 'America/Denver' ? 'selected' : ''; ?>>Mountain Time</option>
                                <option value="America/Los_Angeles" <?php echo ($userSettings['timezone'] ?? 'UTC') === 'America/Los_Angeles' ? 'selected' : ''; ?>>Pacific Time</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i>
                        Save Settings
                    </button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- Privacy Tab -->
    <div id="privacyTab" class="tab-content">
        <div class="section-card">
            <div class="section-header">
                <h2>Privacy Settings</h2>
                <p>Control who can see your information and activity</p>
            </div>
            
            <form method="POST" class="privacy-form">
                <input type="hidden" name="action" value="update_settings">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                
                <div class="privacy-section">
                    <div class="privacy-item">
                        <div class="privacy-info">
                            <h4>Online Status</h4>
                            <p>Control who can see when you're online</p>
                        </div>
                        <select name="privacy_online_status" class="form-select">
                            <option value="everyone" <?php echo ($userSettings['privacy_online_status'] ?? 'everyone') === 'everyone' ? 'selected' : ''; ?>>Everyone</option>
                            <option value="contacts" <?php echo ($userSettings['privacy_online_status'] ?? 'everyone') === 'contacts' ? 'selected' : ''; ?>>Contacts Only</option>
                            <option value="nobody" <?php echo ($userSettings['privacy_online_status'] ?? 'everyone') === 'nobody' ? 'selected' : ''; ?>>Nobody</option>
                        </select>
                    </div>
                    
                    <div class="privacy-item">
                        <div class="privacy-info">
                            <h4>Last Seen</h4>
                            <p>Control who can see when you were last active</p>
                        </div>
                        <select name="privacy_last_seen" class="form-select">
                            <option value="everyone" <?php echo ($userSettings['privacy_last_seen'] ?? 'everyone') === 'everyone' ? 'selected' : ''; ?>>Everyone</option>
                            <option value="contacts" <?php echo ($userSettings['privacy_last_seen'] ?? 'everyone') === 'contacts' ? 'selected' : ''; ?>>Contacts Only</option>
                            <option value="nobody" <?php echo ($userSettings['privacy_last_seen'] ?? 'everyone') === 'nobody' ? 'selected' : ''; ?>>Nobody</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i>
                        Save Privacy Settings
                    </button>
                </div>
            </form>
        </div>
        
        <div class="section-card danger-zone">
            <div class="section-header">
                <h2>Danger Zone</h2>
                <p>Irreversible actions that affect your account</p>
            </div>
            
            <div class="danger-actions">
                <div class="danger-item">
                    <div class="danger-info">
                        <h4>Export Data</h4>
                        <p>Download a copy of all your data</p>
                    </div>
                    <button class="btn btn-secondary" onclick="exportData()">
                        <i class="fas fa-download"></i>
                        Export Data
                    </button>
                </div>
                
                <div class="danger-item">
                    <div class="danger-info">
                        <h4>Delete Account</h4>
                        <p>Permanently delete your account and all data</p>
                    </div>
                    <button class="btn btn-danger" onclick="confirmDeleteAccount()">
                        <i class="fas fa-trash"></i>
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.profile-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
}

.profile-header {
    text-align: center;
    margin-bottom: 2rem;
}

.profile-header h1 {
    color: #2c3e50;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

.profile-header p {
    color: #6c757d;
    font-size: 1.1rem;
}

.message {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.message.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.message.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.profile-tabs {
    display: flex;
    background: white;
    border-radius: 12px 12px 0 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 0;
}

.tab-btn {
    flex: 1;
    padding: 1rem 1.5rem;
    border: none;
    background: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #6c757d;
    font-weight: 500;
    border-bottom: 3px solid transparent;
}

.tab-btn:first-child {
    border-radius: 12px 0 0 0;
}

.tab-btn:last-child {
    border-radius: 0 12px 0 0;
}

.tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
    background: #f8f9fa;
}

.tab-content {
    display: none;
    background: white;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tab-content.active {
    display: block;
}

.section-card {
    padding: 2rem;
    border-bottom: 1px solid #e9ecef;
}

.section-card:last-child {
    border-bottom: none;
}

.section-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.section-header h2 {
    color: #2c3e50;
    margin-bottom: 0.5rem;
}

.section-header p {
    color: #6c757d;
    margin: 0;
}

.avatar-section {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.current-avatar img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.avatar-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.upload-btn, .remove-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
}

.upload-btn {
    background: #667eea;
    color: white;
}

.upload-btn:hover {
    background: #5a6fd8;
}

.remove-btn {
    background: #dc3545;
    color: white;
}

.remove-btn:hover {
    background: #c82333;
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-group label {
    font-weight: 500;
    color: #2c3e50;
}

.form-group input,
.form-group select {
    padding: 0.75rem;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    font-size: 1rem;
    transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: #667eea;
}

.form-group input:disabled {
    background: #f8f9fa;
    color: #6c757d;
}

.form-group small {
    color: #6c757d;
    font-size: 0.8rem;
}

.form-group small.warning {
    color: #ffc107;
}

.form-group small.warning a {
    color: #667eea;
    text-decoration: none;
}

.form-group small.warning a:hover {
    text-decoration: underline;
}

.password-input {
    position: relative;
    display: flex;
    align-items: center;
}

.password-input input {
    width: 100%;
    padding-right: 3rem;
}

.toggle-password {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: #6c757d;
    cursor: pointer;
    padding: 0.5rem;
}

.password-strength {
    margin-top: 0.5rem;
}

.form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5a6fd8;
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-secondary:hover {
    background: #5a6268;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    background: #c82333;
}

.security-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.security-item {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.security-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
}

.security-content {
    flex: 1;
}

.security-content h4 {
    margin: 0 0 0.5rem 0;
    color: #2c3e50;
}

.security-content p {
    color: #6c757d;
    margin: 0 0 1rem 0;
}

.settings-section {
    margin-bottom: 2rem;
}

.settings-section h3 {
    color: #2c3e50;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e9ecef;
}

.settings-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.setting-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
}

.setting-info {
    flex: 1;
}

.setting-info h4 {
    margin: 0 0 0.25rem 0;
    color: #2c3e50;
}

.setting-info p {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
}

.switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 34px;
}

.slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
}

input:checked + .slider {
    background-color: #667eea;
}

input:checked + .slider:before {
    transform: translateX(26px);
}

.form-select {
    min-width: 200px;
}

.privacy-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.privacy-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.privacy-info h4 {
    margin: 0 0 0.25rem 0;
    color: #2c3e50;
}

.privacy-info p {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
}

.danger-zone {
    border: 1px solid #dc3545;
    border-radius: 12px;
}

.danger-zone .section-header {
    border-bottom-color: #dc3545;
}

.danger-zone .section-header h2 {
    color: #dc3545;
}

.danger-actions {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.danger-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 8px;
}

.danger-info h4 {
    margin: 0 0 0.25rem 0;
    color: #dc3545;
}

.danger-info p {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .profile-container {
        padding: 1rem;
    }
    
    .profile-tabs {
        flex-direction: column;
    }
    
    .tab-btn {
        border-bottom: 1px solid #e9ecef;
        border-radius: 0;
    }
    
    .tab-btn:first-child {
        border-radius: 12px 12px 0 0;
    }
    
    .tab-btn:last-child {
        border-radius: 0 0 12px 12px;
        border-bottom: none;
    }
    
    .form-grid {
        grid-template-columns: 1fr;
    }
    
    .avatar-section {
        flex-direction: column;
        text-align: center;
    }
    
    .security-item {
        flex-direction: column;
        text-align: center;
        gap: 1rem;
    }
    
    .privacy-item {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
    
    .danger-item {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
}
</style>

<script>
// Tab switching
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Add active class to selected tab button
    event.target.classList.add('active');
}

// Password visibility toggle
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = input.parentElement.querySelector('.toggle-password');
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// Avatar upload preview
document.getElementById('avatarUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('avatarPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Remove avatar
function removeAvatar() {
    if (confirm('Are you sure you want to remove your profile picture?')) {
        document.getElementById('avatarPreview').src = 'assets/images/default-avatar.png';
        document.getElementById('avatarUpload').value = '';
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];
    
    if (password.length >= 8) strength++;
    else feedback.push('At least 8 characters');
    
    if (/[A-Z]/.test(password)) strength++;
    else feedback.push('Uppercase letter');
    
    if (/[a-z]/.test(password)) strength++;
    else feedback.push('Lowercase letter');
    
    if (/[0-9]/.test(password)) strength++;
    else feedback.push('Number');
    
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    else feedback.push('Special character');
    
    return { strength, feedback };
}

// Password strength indicator
document.getElementById('new_password').addEventListener('input', function() {
    const password = this.value;
    const strengthDiv = document.getElementById('passwordStrength');
    
    if (password.length === 0) {
        strengthDiv.innerHTML = '';
        return;
    }
    
    const { strength, feedback } = checkPasswordStrength(password);
    const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#28a745'];
    
    strengthDiv.innerHTML = `
        <div class="strength-meter">
            <div class="strength-bar" style="width: ${(strength/5)*100}%; background: ${colors[strength-1] || colors[0]}"></div>
        </div>
        <div class="strength-text" style="color: ${colors[strength-1] || colors[0]}">
            ${levels[strength-1] || levels[0]}
            ${feedback.length > 0 ? '<br><small>Missing: ' + feedback.join(', ') + '</small>' : ''}
        </div>
    `;
});

// Security functions
function setup2FA() {
    alert('Two-Factor Authentication setup will be implemented.');
}

function viewLoginHistory() {
    alert('Login history viewer will be implemented.');
}

function manageSessions() {
    alert('Session management will be implemented.');
}

function exportData() {
    if (confirm('This will generate a download link for all your data. Continue?')) {
        alert('Data export functionality will be implemented.');
    }
}

function confirmDeleteAccount() {
    if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
        if (confirm('This will permanently delete all your messages, settings, and account data. Type DELETE to confirm.')) {
            const confirmation = prompt('Please type DELETE to confirm account deletion:');
            if (confirmation === 'DELETE') {
                alert('Account deletion functionality will be implemented.');
            }
        }
    }
}

function resendVerification() {
    if (confirm('Resend email verification?')) {
        // Implement resend verification
        fetch('api/auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'resend_verification',
                csrf_token: window.csrfToken
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('Verification email sent!');
            } else {
                alert('Failed to send verification email: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            alert('Network error. Please try again.');
        });
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check URL hash for tab
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash + 'Tab')) {
        switchTab(hash);
    }
});

// Add CSS for password strength meter
const style = document.createElement('style');
style.textContent = `
    .strength-meter {
        height: 4px;
        background: #e9ecef;
        border-radius: 2px;
        margin: 0.5rem 0;
        overflow: hidden;
    }
    
    .strength-bar {
        height: 100%;
        transition: all 0.3s ease;
    }
    
    .strength-text {
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    .strength-text small {
        color: #6c757d;
    }
`;
document.head.appendChild(style);
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
