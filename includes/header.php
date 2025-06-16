<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($pageTitle ?? 'Quick Chat'); ?></title>
    
    <!-- Base Stylesheets -->
    <link rel="stylesheet" href="assets/css/styles.css">
    <link rel="stylesheet" href="assets/css/enhanced-chat.css">
    <link rel="stylesheet" href="assets/css/accessibility.css">
    
    <!-- Additional CSS -->
    <?php if (isset($additionalCSS) && is_array($additionalCSS)): ?>
        <?php foreach ($additionalCSS as $css): ?>
            <link rel="stylesheet" href="<?php echo htmlspecialchars($css); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    
    <!-- Font Awesome Icons -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="manifest.json">
    
    <!-- Meta Tags -->
    <meta name="description" content="Quick Chat - Secure, fast, and reliable messaging platform">
    <meta name="keywords" content="chat, messaging, secure, communication">
    <meta name="author" content="Quick Chat">
    <meta name="robots" content="index, follow">
    
    <!-- Security Headers -->
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="DENY">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">
    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
    
    <!-- Theme Color -->
    <meta name="theme-color" content="#2563eb">
    
    <!-- Favicons -->
    <link rel="icon" type="image/x-icon" href="assets/images/icon-192.png">
    <link rel="apple-touch-icon" href="assets/images/icon-192.png">
</head>
<body class="<?php echo htmlspecialchars($pageClass ?? ''); ?>">

<nav class="main-nav">
    <div class="nav-container">
        <div class="nav-brand">
            <a href="dashboard.php" class="brand-link">
                <i class="fas fa-comments"></i>
                <span>Quick Chat</span>
            </a>
        </div>
        
        <div class="nav-menu">
            <a href="dashboard.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'dashboard.php' ? 'active' : ''; ?>">
                <i class="fas fa-home"></i>
                <span>Dashboard</span>
            </a>
            
            <a href="chat-new.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'chat-new.php' ? 'active' : ''; ?>">
                <i class="fas fa-comment-dots"></i>
                <span>Chat</span>
            </a>
            
            <a href="profile.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'profile.php' ? 'active' : ''; ?>">
                <i class="fas fa-user"></i>
                <span>Profile</span>
            </a>
            
            <?php if (isset($currentUser) && $currentUser['role'] === 'admin'): ?>
            <a href="admin.php" class="nav-link <?php echo basename($_SERVER['PHP_SELF']) === 'admin.php' ? 'active' : ''; ?>">
                <i class="fas fa-cog"></i>
                <span>Admin</span>
            </a>
            <?php endif; ?>
        </div>
        
        <div class="nav-user">
            <?php if (isset($currentUser)): ?>
                <div class="user-info">
                    <img src="<?php echo htmlspecialchars($currentUser['avatar_url'] ?? 'assets/images/default-avatar.png'); ?>" 
                         alt="<?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>" 
                         class="user-avatar">
                    <span class="username"><?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?></span>
                </div>
            <?php endif; ?>
            
            <a href="index.php?action=logout" class="nav-link logout-link" title="Logout">
                <i class="fas fa-sign-out-alt"></i>
            </a>
        </div>
    </div>
</nav>

<main class="main-content">
