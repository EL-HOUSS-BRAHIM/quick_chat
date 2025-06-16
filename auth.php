<?php
$pageTitle = 'Login - Quick Chat';
$pageClass = 'auth-page';

// Load required classes
require_once __DIR__ . '/classes/GoogleSSO.php';

// Check if user is already logged in
require_once __DIR__ . '/includes/auth_check.php';

if (AuthChecker::isAuthenticated()) {
    header('Location: dashboard.php');
    exit();
}

// Handle OAuth actions
if (isset($_GET['action'])) {
    $action = $_GET['action'];
    
    switch ($action) {
        case 'google_login':
            try {
                $googleSSO = new GoogleSSO();
                $state = $_GET['state'] ?? null;
                $loginUrl = $googleSSO->getLoginUrl($state);
                header('Location: ' . $loginUrl);
                exit();
            } catch (Exception $e) {
                error_log("Google OAuth login error: " . $e->getMessage());
                header('Location: auth.php?error=' . urlencode('Google login is not available at this time'));
                exit();
            }
            
        case 'google_callback':
            try {
                if (isset($_GET['error'])) {
                    $error = $_GET['error_description'] ?? $_GET['error'];
                    header('Location: auth.php?error=' . urlencode($error));
                    exit();
                }
                
                if (!isset($_GET['code'])) {
                    header('Location: auth.php?error=' . urlencode('Authorization code not received'));
                    exit();
                }
                
                $googleSSO = new GoogleSSO();
                $result = $googleSSO->handleCallback($_GET['code'], $_GET['state'] ?? null);
                
                if ($result['success']) {
                    header('Location: ' . $result['redirect'] . '?oauth_success=1');
                    exit();
                } else {
                    header('Location: auth.php?error=' . urlencode($result['error']));
                    exit();
                }
            } catch (Exception $e) {
                error_log("Google OAuth callback error: " . $e->getMessage());
                header('Location: auth.php?error=' . urlencode('Google authentication failed'));
                exit();
            }
            
        case 'logout':
            AuthChecker::logout();
            header('Location: auth.php?message=logged_out');
            exit();
    }
}

// Handle logout from other pages
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    AuthChecker::logout();
    header('Location: auth.php?message=logged_out');
    exit();
}

$message = '';
$messageType = '';

if (isset($_GET['message'])) {
    switch ($_GET['message']) {
        case 'logged_out':
            $message = 'You have been successfully logged out.';
            $messageType = 'success';
            break;
        case 'session_expired':
            $message = 'Your session has expired. Please log in again.';
            $messageType = 'warning';
            break;
        case 'access_denied':
            $message = 'Access denied. Please log in to continue.';
            $messageType = 'error';
            break;
    }
}

$csrfToken = AuthChecker::getCSRFToken();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    <link rel="stylesheet" href="assets/css/styles.css">
    <link rel="stylesheet" href="assets/css/enhanced-chat.css">
    <link rel="stylesheet" href="assets/css/accessibility.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrfToken); ?>">
    <style>
        .auth-page {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }
        
        .auth-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
            padding: 2rem;
            position: relative;
            overflow: hidden;
        }
        
        .auth-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }
        
        .auth-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .auth-header i {
            font-size: 3rem;
            color: #667eea;
            margin-bottom: 1rem;
        }
        
        .auth-header h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
            font-size: 2rem;
            font-weight: 600;
        }
        
        .auth-header p {
            color: #6c757d;
            font-size: 1rem;
        }
        
        .auth-tabs {
            display: flex;
            margin-bottom: 2rem;
            border-bottom: 1px solid #e9ecef;
        }
        
        .auth-tab {
            flex: 1;
            padding: 1rem;
            text-align: center;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
            color: #6c757d;
            font-weight: 500;
        }
        
        .auth-tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }
        
        .auth-form {
            display: none;
        }
        
        .auth-form.active {
            display: block;
        }
        
        .message {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
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
        
        .message.warning {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        
        #loading {
            display: none;
            text-align: center;
            padding: 2rem;
            color: #667eea;
        }
        
        .forgot-password-link {
            text-align: center;
            margin-top: 1rem;
        }
        
        .forgot-password-link a {
            color: #667eea;
            text-decoration: none;
            font-size: 0.9rem;
        }
        
        .forgot-password-link a:hover {
            text-decoration: underline;
        }
        
        .back-to-login {
            text-align: center;
            margin-top: 1rem;
        }
        
        .back-to-login a {
            color: #667eea;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .back-to-login a:hover {
            text-decoration: underline;
        }

        /* Social Login Styles */
        .social-divider {
            text-align: center;
            margin: 2rem 0 1.5rem;
            position: relative;
        }

        .social-divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #e0e0e0;
        }

        .social-divider span {
            background: white;
            padding: 0 1rem;
            color: #666;
            font-size: 0.9rem;
        }

        .social-login-buttons {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .social-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            background: white;
            color: #333;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.2s ease;
            cursor: pointer;
            font-size: 0.95rem;
        }

        .social-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .google-btn {
            border-color: #dd4b39;
        }

        .google-btn:hover {
            background: #dd4b39;
            color: white;
        }

        .facebook-btn {
            border-color: #4267B2;
        }

        .facebook-btn:hover {
            background: #4267B2;
            color: white;
        }

        .social-btn i {
            font-size: 1.1rem;
        }

        /* OAuth Loading State */
        .oauth-loading {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }

        .oauth-loading.active {
            display: flex;
        }

        .oauth-loading-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .oauth-loading-content i {
            font-size: 2rem;
            color: #667eea;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body class="auth-page">
    <div class="auth-container">
        <div class="auth-header">
            <i class="fas fa-comments"></i>
            <h1>Quick Chat</h1>
            <p>Secure messaging platform</p>
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
        
        <div class="auth-tabs">
            <div class="auth-tab active" onclick="switchTab('login')">
                <i class="fas fa-sign-in-alt"></i>
                Sign In
            </div>
            <div class="auth-tab" onclick="switchTab('register')">
                <i class="fas fa-user-plus"></i>
                Sign Up
            </div>
        </div>
        
        <!-- Login Form -->
        <form id="loginForm" class="auth-form active" action="api/auth.php" method="POST">
            <input type="hidden" name="action" value="login">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
            
            <div class="form-group">
                <label for="login_username">Username</label>
                <input type="text" id="login_username" name="username" required minlength="3" maxlength="20" autocomplete="username">
            </div>
            
            <div class="form-group">
                <label for="login_password">Password</label>
                <div class="password-input">
                    <input type="password" id="login_password" name="password" required minlength="6" autocomplete="current-password">
                    <button type="button" class="toggle-password" onclick="togglePassword('login_password')">
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
            
            <div class="forgot-password-link">
                <a href="javascript:void(0)" onclick="switchTab('forgot')">Forgot Password?</a>
            </div>

            <!-- Social Login Divider -->
            <div class="social-divider">
                <span>or continue with</span>
            </div>

            <!-- Social Login Buttons -->
            <div class="social-login-buttons">
                <?php if (Config::isGoogleSSOEnabled()): ?>
                <button type="button" class="social-btn google-btn" onclick="loginWithGoogle()">
                    <i class="fab fa-google"></i>
                    <span>Continue with Google</span>
                </button>
                <?php endif; ?>
                
                <?php if (Config::isFacebookSSOEnabled()): ?>
                <button type="button" class="social-btn facebook-btn" onclick="loginWithFacebook()">
                    <i class="fab fa-facebook-f"></i>
                    <span>Continue with Facebook</span>
                </button>
                <?php endif; ?>
            </div>
        </form>
        
        <!-- Register Form -->
        <form id="registerForm" class="auth-form" action="api/auth.php" method="POST">
            <input type="hidden" name="action" value="register">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
            
            <div class="form-group">
                <label for="register_username">Username</label>
                <input type="text" id="register_username" name="username" required minlength="3" maxlength="20" autocomplete="username">
            </div>
            
            <div class="form-group">
                <label for="register_email">Email</label>
                <input type="email" id="register_email" name="email" required autocomplete="email">
            </div>
            
            <div class="form-group">
                <label for="register_password">Password</label>
                <div class="password-input">
                    <input type="password" id="register_password" name="password" required minlength="8" autocomplete="new-password">
                    <button type="button" class="toggle-password" onclick="togglePassword('register_password')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <div class="password-strength" id="passwordStrength"></div>
            </div>
            
            <div class="form-group">
                <label for="confirm_password">Confirm Password</label>
                <div class="password-input">
                    <input type="password" id="confirm_password" name="confirm_password" required minlength="8" autocomplete="new-password">
                    <button type="button" class="toggle-password" onclick="togglePassword('confirm_password')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="terms" required>
                    <span class="checkmark"></span>
                    I agree to the <a href="terms.html" target="_blank">Terms of Service</a>
                </label>
            </div>
            
            <button type="submit" class="login-btn">
                <i class="fas fa-user-plus"></i>
                Create Account
            </button>

            <!-- Social Login Divider -->
            <div class="social-divider">
                <span>or continue with</span>
            </div>

            <!-- Social Login Buttons -->
            <div class="social-login-buttons">
                <?php if (Config::isGoogleSSOEnabled()): ?>
                <button type="button" class="social-btn google-btn" onclick="loginWithGoogle()">
                    <i class="fab fa-google"></i>
                    <span>Continue with Google</span>
                </button>
                <?php endif; ?>
                
                <?php if (Config::isFacebookSSOEnabled()): ?>
                <button type="button" class="social-btn facebook-btn" onclick="loginWithFacebook()">
                    <i class="fab fa-facebook-f"></i>
                    <span>Continue with Facebook</span>
                </button>
                <?php endif; ?>
            </div>
        </form>
        
        <!-- Forgot Password Form -->
        <form id="forgotForm" class="auth-form" action="api/auth.php" method="POST">
            <input type="hidden" name="action" value="reset_password">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
            
            <div class="form-group">
                <label for="reset_email">Email Address</label>
                <input type="email" id="reset_email" name="email" required autocomplete="email">
                <small>We'll send you a password reset link</small>
            </div>
            
            <button type="submit" class="login-btn">
                <i class="fas fa-paper-plane"></i>
                Send Reset Link
            </button>
            
            <div class="back-to-login">
                <a href="javascript:void(0)" onclick="switchTab('login')">
                    <i class="fas fa-arrow-left"></i>
                    Back to Login
                </a>
            </div>
        </form>
        
        <!-- Loading State -->
        <div id="loading">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Please wait...</p>
        </div>
    </div>
    
    <script src="assets/js/utils.js"></script>
    <script src="assets/js/error-handler.js"></script>
    <script>
        // Tab switching
        function switchTab(tab) {
            // Update tab buttons
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            if (tab === 'login') {
                document.querySelectorAll('.auth-tab')[0].classList.add('active');
                document.getElementById('loginForm').classList.add('active');
            } else if (tab === 'register') {
                document.querySelectorAll('.auth-tab')[1].classList.add('active');
                document.getElementById('registerForm').classList.add('active');
            } else if (tab === 'forgot') {
                document.getElementById('forgotForm').classList.add('active');
            }
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
        
        // Form submission handlers
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
        document.getElementById('registerForm').addEventListener('submit', handleRegister);
        document.getElementById('forgotForm').addEventListener('submit', handleForgotPassword);
        
        // Password strength indicator
        document.getElementById('register_password').addEventListener('input', function() {
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
        
        async function handleLogin(event) {
            event.preventDefault();
            
            const form = event.target;
            const formData = new FormData(form);
            const submitButton = form.querySelector('button[type="submit"]');
            
            try {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
                
                const response = await fetch('api/auth.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.php';
                    }, 1000);
                } else {
                    showMessage(result.error || 'Login failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            }
        }
        
        async function handleRegister(event) {
            event.preventDefault();
            
            const form = event.target;
            const formData = new FormData(form);
            const submitButton = form.querySelector('button[type="submit"]');
            
            // Check password confirmation
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            
            if (password !== confirmPassword) {
                showMessage('Passwords do not match', 'error');
                return;
            }
            
            try {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
                
                const response = await fetch('api/auth.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage('Account created successfully! Please check your email to verify your account.', 'success');
                    setTimeout(() => {
                        switchTab('login');
                    }, 2000);
                } else {
                    showMessage(result.error || 'Registration failed', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            }
        }
        
        async function handleForgotPassword(event) {
            event.preventDefault();
            
            const form = event.target;
            const formData = new FormData(form);
            const submitButton = form.querySelector('button[type="submit"]');
            
            try {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
                
                const response = await fetch('api/auth.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage('If an account with this email exists, a password reset link has been sent.', 'success');
                    setTimeout(() => {
                        switchTab('login');
                    }, 3000);
                } else {
                    showMessage(result.error || 'Failed to send reset email', 'error');
                }
            } catch (error) {
                showMessage('Network error. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
            }
        }
        
        // Social Login Functions
        function loginWithGoogle() {
            showOAuthLoading('Connecting to Google...');
            
            // Generate state parameter for security
            const state = generateRandomString(32);
            localStorage.setItem('oauth_state', state);
            
            // Redirect to Google OAuth
            window.location.href = 'auth.php?action=google_login&state=' + encodeURIComponent(state);
        }

        function loginWithFacebook() {
            showOAuthLoading('Connecting to Facebook...');
            
            // Generate state parameter for security
            const state = generateRandomString(32);
            localStorage.setItem('oauth_state', state);
            
            // Redirect to Facebook OAuth
            window.location.href = 'auth.php?action=facebook_login&state=' + encodeURIComponent(state);
        }

        function showOAuthLoading(message) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'oauth-loading active';
            loadingDiv.innerHTML = `
                <div class="oauth-loading-content">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>${message}</p>
                </div>
            `;
            document.body.appendChild(loadingDiv);
        }

        function generateRandomString(length) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        // Handle OAuth callback messages
        function handleOAuthCallback() {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            const success = urlParams.get('oauth_success');
            const message = urlParams.get('message');
            
            if (error) {
                showMessage('OAuth authentication failed: ' + decodeURIComponent(error), 'error');
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (success) {
                showMessage('Successfully logged in!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.php';
                }, 1000);
            } else if (message) {
                // Handle other message types
                const messageText = decodeURIComponent(message);
                if (messageText.includes('success')) {
                    showMessage(messageText, 'success');
                } else {
                    showMessage(messageText, 'error');
                }
            }
        }

        // Check for OAuth callback on page load
        document.addEventListener('DOMContentLoaded', function() {
            handleOAuthCallback();
        });
        
        function showMessage(text, type) {
            // Remove existing messages
            document.querySelectorAll('.message').forEach(msg => {
                if (!msg.classList.contains('initial-message')) {
                    msg.remove();
                }
            });
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            messageDiv.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : 
                    (type === 'error' ? 'exclamation-circle' : 'exclamation-triangle')}"></i>
                ${text}
            `;
            
            const authHeader = document.querySelector('.auth-header');
            authHeader.insertAdjacentElement('afterend', messageDiv);
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
    </script>
    
    <style>
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
    </style>
</body>
</html>
