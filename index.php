<?php
session_start();

// Check if user is logged in
$isLoggedIn = isset($_SESSION['user_id']);
$currentUser = $isLoggedIn ? $_SESSION['username'] : null;

// Handle logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header('Location: index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quick Chat - Enhanced PHP Version</title>
    <link rel="stylesheet" href="assets/css/styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>">
</head>
<body>
    <?php if (!$isLoggedIn): ?>
    <!-- Login Screen -->
    <div id="loginScreen" class="screen active">
        <div class="login-container">
            <div class="login-header">
                <i class="fas fa-comments"></i>
                <h1>Quick Chat</h1>
                <p>Enhanced secure messaging platform</p>
            </div>
            
            <form id="loginForm" class="login-form" action="api/auth.php" method="POST">
                <input type="hidden" name="action" value="login">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>">
                
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" name="username" required minlength="3" maxlength="20" autocomplete="username">
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <div class="password-input">
                        <input type="password" id="password" name="password" required minlength="6" autocomplete="current-password">
                        <button type="button" class="toggle-password" onclick="togglePassword('password')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="remember_me">
                        <span class="checkmark"></span>
                        Remember me
                    </label>
                </div>
                
                <button type="submit" class="login-btn">
                    <i class="fas fa-sign-in-alt"></i>
                    Sign In
                </button>
            </form>
            
            <div class="register-link">
                <p>Don't have an account? <a href="#" id="showRegister">Create one</a></p>
                <p><a href="#" id="forgotPassword">Forgot Password?</a></p>
            </div>
        </div>
        
        <!-- Registration Form -->
        <div class="register-container" id="registerContainer" style="display: none;">
            <div class="login-header">
                <i class="fas fa-user-plus"></i>
                <h1>Create Account</h1>
                <p>Join our secure chat community</p>
            </div>
            
            <form id="registerForm" class="login-form" action="api/auth.php" method="POST">
                <input type="hidden" name="action" value="register">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>">
                
                <div class="form-group">
                    <label for="regUsername">Username</label>
                    <input type="text" id="regUsername" name="username" required minlength="3" maxlength="20" autocomplete="username">
                    <div class="input-hint">3-20 characters, letters and numbers only</div>
                </div>
                
                <div class="form-group">
                    <label for="regEmail">Email</label>
                    <input type="email" id="regEmail" name="email" required autocomplete="email">
                </div>
                
                <div class="form-group">
                    <label for="regPassword">Password</label>
                    <div class="password-input">
                        <input type="password" id="regPassword" name="password" required minlength="8" autocomplete="new-password">
                        <button type="button" class="toggle-password" onclick="togglePassword('regPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="password-strength" id="passwordStrength"></div>
                    <div class="input-hint">At least 8 characters with uppercase, lowercase, number and special character</div>
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <div class="password-input">
                        <input type="password" id="confirmPassword" name="confirm_password" required minlength="8" autocomplete="new-password">
                        <button type="button" class="toggle-password" onclick="togglePassword('confirmPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="terms" required>
                        <span class="checkmark"></span>
                        I agree to the <a href="#" onclick="showTerms()">Terms of Service</a>
                    </label>
                </div>
                
                <button type="submit" class="login-btn">
                    <i class="fas fa-user-plus"></i>
                    Create Account
                </button>
            </form>
            
            <div class="register-link">
                <p>Already have an account? <a href="#" id="showLogin">Sign in</a></p>
            </div>
        </div>
        
        <!-- Password Reset Form -->
        <div class="reset-container" id="resetContainer" style="display: none;">
            <div class="login-header">
                <i class="fas fa-key"></i>
                <h1>Reset Password</h1>
                <p>Enter your email to reset password</p>
            </div>
            
            <form id="resetForm" class="login-form" action="api/auth.php" method="POST">
                <input type="hidden" name="action" value="reset_password">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token'] ?? ''); ?>">
                
                <div class="form-group">
                    <label for="resetEmail">Email</label>
                    <input type="email" id="resetEmail" name="email" required autocomplete="email">
                </div>
                
                <button type="submit" class="login-btn">
                    <i class="fas fa-paper-plane"></i>
                    Send Reset Link
                </button>
            </form>
            
            <div class="register-link">
                <p><a href="#" id="backToLogin">Back to Login</a></p>
            </div>
        </div>
    </div>
    <?php else: ?>
    <!-- Chat Screen -->
    <div id="chatScreen" class="screen active">
        <div class="chat-container">
            <!-- Chat Header -->
            <div class="chat-header">
                <div class="user-info">
                    <div class="user-avatar">
                        <img src="api/avatar.php?user=<?php echo urlencode($currentUser); ?>" alt="Avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <i class="fas fa-user" style="display: none;"></i>
                    </div>
                    <div class="user-details">
                        <h3 id="currentUser"><?php echo htmlspecialchars($currentUser); ?></h3>
                        <span class="status online" id="userStatus">Online</span>
                    </div>
                </div>
                
                <div class="chat-actions">
                    <button id="themeToggle" class="action-btn" title="Toggle Theme">
                        <i class="fas fa-moon"></i>
                    </button>
                    <button id="settingsBtn" class="action-btn" title="Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button id="clearChatBtn" class="action-btn" title="Clear Chat">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button id="logoutBtn" class="action-btn" title="Logout" onclick="confirmLogout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>

            <!-- Messages Container -->
            <div class="messages-container" id="messagesContainer">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Quick Chat!</h3>
                    <p>Start a conversation by typing a message below.</p>
                    <div class="online-users">
                        <h4>Online Users</h4>
                        <div id="onlineUsersList"></div>
                    </div>
                </div>
            </div>

            <!-- Typing Indicator -->
            <div id="typingIndicator" class="typing-indicator" style="display: none;">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span id="typingText">Someone is typing...</span>
            </div>

            <!-- Message Input Area -->
            <div class="message-input-area">
                <div class="input-container">
                    <button id="emojiBtn" class="attach-btn" title="Emoji">
                        <i class="fas fa-smile"></i>
                    </button>
                    
                    <button id="attachBtn" class="attach-btn" title="Attach File">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    
                    <input type="file" id="fileInput" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display: none;" multiple>
                    
                    <div class="message-input">
                        <textarea id="messageInput" placeholder="Type your message..." rows="1" maxlength="2000"></textarea>
                        <div class="character-count">
                            <span id="charCount">0</span>/2000
                        </div>
                    </div>
                    
                    <button id="recordBtn" class="record-btn" title="Record Audio">
                        <i class="fas fa-microphone"></i>
                    </button>
                    
                    <button id="sendBtn" class="send-btn" title="Send Message">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                
                <!-- Emoji Picker -->
                <div id="emojiPicker" class="emoji-picker" style="display: none;">
                    <div class="emoji-categories">
                        <button class="emoji-category active" data-category="smileys">😀</button>
                        <button class="emoji-category" data-category="people">👤</button>
                        <button class="emoji-category" data-category="nature">🌸</button>
                        <button class="emoji-category" data-category="food">🍕</button>
                        <button class="emoji-category" data-category="activities">⚽</button>
                        <button class="emoji-category" data-category="travel">🚗</button>
                        <button class="emoji-category" data-category="objects">💡</button>
                        <button class="emoji-category" data-category="symbols">❤️</button>
                    </div>
                    <div class="emoji-grid" id="emojiGrid"></div>
                </div>
                
                <!-- Recording indicator -->
                <div id="recordingIndicator" class="recording-indicator" style="display: none;">
                    <div class="recording-animation">
                        <div class="recording-dot"></div>
                    </div>
                    <span>Recording... Click to stop</span>
                    <div class="recording-time" id="recordingTime">00:00</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div id="settingsModal" class="modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <button class="close-btn" onclick="closeSettings()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="settings-section">
                    <h3>Profile</h3>
                    <div class="form-group">
                        <label for="newAvatar">Profile Picture</label>
                        <input type="file" id="newAvatar" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="displayName">Display Name</label>
                        <input type="text" id="displayName" value="<?php echo htmlspecialchars($currentUser); ?>">
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Notifications</h3>
                    <label class="checkbox-label">
                        <input type="checkbox" id="soundNotifications" checked>
                        <span class="checkmark"></span>
                        Sound notifications
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="desktopNotifications" checked>
                        <span class="checkmark"></span>
                        Desktop notifications
                    </label>
                </div>
                
                <div class="settings-section">
                    <h3>Security</h3>
                    <button class="secondary-btn" onclick="changePassword()">
                        <i class="fas fa-key"></i>
                        Change Password
                    </button>
                    <button class="danger-btn" onclick="deleteAccount()">
                        <i class="fas fa-trash"></i>
                        Delete Account
                    </button>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="closeSettings()">Cancel</button>
                <button class="primary-btn" onclick="saveSettings()">Save Changes</button>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- Toast Notifications -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- Audio element for playback -->
    <audio id="audioPlayer" controls style="display: none;"></audio>
    
    <!-- Notification sound -->
    <!-- <audio id="notificationSound" preload="auto">
        <source src="assets/sounds/notification.mp3" type="audio/mpeg">
        <source src="assets/sounds/notification.ogg" type="audio/ogg">
    </audio> -->

    <script src="assets/js/config.js"></script>
    <script src="assets/js/utils.js"></script>
    <script src="assets/js/security.js"></script>
    <script src="assets/js/emoji.js"></script>
    <script src="assets/js/chat.js"></script>
    <script src="assets/js/app.js"></script>
</body>
</html>
