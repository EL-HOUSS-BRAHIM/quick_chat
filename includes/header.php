<?php
// Common header template for all pages
require_once __DIR__ . '/../includes/auth_check.php';

// Get current user if authenticated
$currentUser = AuthChecker::getCurrentUser();
$isAuthenticated = AuthChecker::isAuthenticated();
$csrfToken = AuthChecker::getCSRFToken();

// Get page title and additional CSS/JS
$pageTitle = $pageTitle ?? 'Quick Chat';
$additionalCSS = $additionalCSS ?? [];
$additionalJS = $additionalJS ?? [];
$pageClass = $pageClass ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle); ?></title>
    
    <!-- Base Stylesheets -->
    <link rel="stylesheet" href="assets/css/styles.css">
    <link rel="stylesheet" href="assets/css/enhanced-chat.css">
    <link rel="stylesheet" href="assets/css/accessibility.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    
    <!-- Additional CSS -->
    <?php foreach ($additionalCSS as $css): ?>
        <link rel="stylesheet" href="<?php echo htmlspecialchars($css); ?>">
    <?php endforeach; ?>
    
    <!-- Meta Tags -->
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrfToken); ?>">
    <meta name="description" content="Quick Chat - A secure, accessible, and feature-rich messaging platform">
    <meta name="theme-color" content="#667eea">
    <link rel="manifest" href="manifest.json">
    
    <!-- SEO Meta Tags -->
    <meta name="keywords" content="chat app, secure messaging, online chat, real-time chat, web chat, PHP chat, accessible chat">
    <meta name="author" content="Quick Chat Team">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . strtok($_SERVER['REQUEST_URI'], '?'); ?>">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']; ?>">
    <meta property="og:title" content="<?php echo htmlspecialchars($pageTitle); ?>">
    <meta property="og:description" content="A secure, accessible, and feature-rich messaging platform">
    <meta property="og:image" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>/assets/images/og-image.jpg">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI']; ?>">
    <meta property="twitter:title" content="<?php echo htmlspecialchars($pageTitle); ?>">
    <meta property="twitter:description" content="A secure, accessible, and feature-rich messaging platform">
    <meta property="twitter:image" content="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']; ?>/assets/images/twitter-image.jpg">
    
    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" href="assets/images/apple-touch-icon.png">
    <link rel="apple-touch-icon" sizes="152x152" href="assets/images/apple-touch-icon-152x152.png">
    <link rel="apple-touch-icon" sizes="180x180" href="assets/images/apple-touch-icon-180x180.png">
    <link rel="apple-touch-icon" sizes="167x167" href="assets/images/apple-touch-icon-167x167.png">
    
    <style>
        /* Common navigation styles */
        .main-nav {
            background: #fff;
            border-bottom: 1px solid #e1e5e9;
            padding: 0.5rem 0;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .nav-container {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1rem;
        }
        
        .nav-brand {
            font-size: 1.5rem;
            font-weight: 600;
            color: #667eea;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .nav-links {
            display: flex;
            align-items: center;
            gap: 1rem;
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .nav-links a {
            text-decoration: none;
            color: #6c757d;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .nav-links a:hover,
        .nav-links a.active {
            background: #f8f9fa;
            color: #667eea;
        }
        
        .user-menu {
            position: relative;
        }
        
        .user-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid #e1e5e9;
            cursor: pointer;
        }
        
        .user-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            background: #fff;
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 200px;
            z-index: 1001;
            display: none;
        }
        
        .user-dropdown.show {
            display: block;
        }
        
        .user-dropdown a {
            display: block;
            padding: 0.75rem 1rem;
            color: #6c757d;
            text-decoration: none;
            border-bottom: 1px solid #f8f9fa;
        }
        
        .user-dropdown a:hover {
            background: #f8f9fa;
        }
        
        .user-dropdown a:last-child {
            border-bottom: none;
        }
        
        .logout-btn {
            color: #dc3545 !important;
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
            .nav-links {
                gap: 0.5rem;
            }
            
            .nav-links a {
                padding: 0.5rem;
                font-size: 0.9rem;
            }
            
            .nav-links a span {
                display: none;
            }
        }
    </style>
</head>
<body class="<?php echo htmlspecialchars($pageClass); ?>">
    <?php if ($isAuthenticated): ?>
    <!-- Navigation Bar -->
    <nav class="main-nav">
        <div class="nav-container">
            <a href="dashboard.php" class="nav-brand">
                <i class="fas fa-comments"></i>
                Quick Chat
            </a>
            
            <ul class="nav-links">
                <li><a href="dashboard.php" class="<?php echo basename($_SERVER['PHP_SELF']) === 'dashboard.php' ? 'active' : ''; ?>">
                    <i class="fas fa-home"></i>
                    <span>Dashboard</span>
                </a></li>
                <li><a href="chat.php" class="<?php echo basename($_SERVER['PHP_SELF']) === 'chat.php' ? 'active' : ''; ?>">
                    <i class="fas fa-comments"></i>
                    <span>Chat</span>
                </a></li>
                <li><a href="profile.php" class="<?php echo basename($_SERVER['PHP_SELF']) === 'profile.php' ? 'active' : ''; ?>">
                    <i class="fas fa-user"></i>
                    <span>Profile</span>
                </a></li>
                <?php if (isset($currentUser['role']) && $currentUser['role'] === 'admin'): ?>
                <li><a href="admin.php" class="<?php echo basename($_SERVER['PHP_SELF']) === 'admin.php' ? 'active' : ''; ?>">
                    <i class="fas fa-cog"></i>
                    <span>Admin</span>
                </a></li>
                <?php endif; ?>
                
                <li class="user-menu">
                    <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                         alt="<?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>" 
                         class="user-avatar" 
                         onclick="toggleUserMenu()">
                    
                    <div class="user-dropdown" id="userDropdown">
                        <a href="profile.php">
                            <i class="fas fa-user"></i>
                            Profile Settings
                        </a>
                        <a href="javascript:void(0)" onclick="confirmLogout()" class="logout-btn">
                            <i class="fas fa-sign-out-alt"></i>
                            Logout
                        </a>
                    </div>
                </li>
            </ul>
        </div>
    </nav>
    <?php endif; ?>
    
    <!-- Page Content Starts Here -->
    <div class="page-content">

<script>
// Common navigation JavaScript
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userDropdown');
    
    if (dropdown && !userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Logout function
async function confirmLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        const response = await fetch('api/auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: new URLSearchParams({
                action: 'logout',
                csrf_token: document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            })
        });

        const result = await response.json();
        
        if (result.success) {
            window.location.href = 'auth.php';
        } else {
            alert('Logout failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// CSRF token management
window.csrfToken = '<?php echo htmlspecialchars($csrfToken); ?>';

// Update CSRF token helper
function updateCSRFToken(newToken) {
    window.csrfToken = newToken;
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
        csrfMeta.setAttribute('content', newToken);
    }
}
</script>
