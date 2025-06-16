<?php
$pageTitle = 'Dashboard - Quick Chat';
$pageClass = 'dashboard-page';
$additionalCSS = ['assets/css/dashboard-modern.css'];
$additionalJS = ['assets/js/dashboard-modern.js'];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Generate CSRF token
require_once __DIR__ . '/classes/Security.php';
$security = new Security();
$csrfToken = $security->generateCSRFToken();

// Get dashboard data
require_once __DIR__ . '/classes/Message.php';
require_once __DIR__ . '/classes/User.php';

$messageClass = new Message();
$userClass = new User();

// Get statistics
$stats = [
    'totalMessages' => $messageClass->getUserMessageCount($currentUser['id']),
    'onlineUsers' => count($userClass->getOnlineUsers()),
    'totalUsers' => $userClass->getTotalUserCount(),
    'todayMessages' => $messageClass->getTodayMessageCount($currentUser['id'])
];

$recentMessages = $messageClass->getRecentMessages(10);
$onlineUsers = $userClass->getOnlineUsers();

include __DIR__ . '/includes/header.php';
?>

<div class="dashboard-layout">
    <!-- Main Dashboard Content -->
    <main class="dashboard-main">
        <!-- Welcome Section -->
        <section class="welcome-section">
            <div class="welcome-content">
                <div class="welcome-text">
                    <h1>Welcome back, <?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>! 👋</h1>
                    <p>Here's what's happening in your chat world today</p>
                </div>
                <div class="welcome-actions">
                    <a href="chat-modern.php" class="primary-btn">
                        <i class="fas fa-comments"></i>
                        Start Chatting
                    </a>
                    <a href="profile.php" class="secondary-btn">
                        <i class="fas fa-user-cog"></i>
                        Edit Profile
                    </a>
                </div>
            </div>
        </section>

        <!-- Statistics Cards -->
        <section class="stats-section">
            <div class="stats-grid">
                <div class="stat-card messages">
                    <div class="stat-icon">
                        <i class="fas fa-comment-alt"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['totalMessages']); ?></h3>
                        <p>Total Messages</p>
                        <div class="stat-trend positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>+<?php echo number_format($stats['todayMessages']); ?> today</span>
                        </div>
                    </div>
                </div>

                <div class="stat-card users">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['onlineUsers']); ?></h3>
                        <p>Online Users</p>
                        <div class="stat-trend">
                            <span>of <?php echo number_format($stats['totalUsers']); ?> total</span>
                        </div>
                    </div>
                </div>

                <div class="stat-card activity">
                    <div class="stat-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="stat-content">
                        <h3><?php echo number_format($stats['todayMessages']); ?></h3>
                        <p>Today's Activity</p>
                        <div class="stat-trend <?php echo $stats['todayMessages'] > 0 ? 'positive' : ''; ?>">
                            <i class="fas fa-<?php echo $stats['todayMessages'] > 0 ? 'arrow-up' : 'minus'; ?>"></i>
                            <span><?php echo $stats['todayMessages'] > 0 ? 'Active' : 'Quiet'; ?> day</span>
                        </div>
                    </div>
                </div>

                <div class="stat-card profile">
                    <div class="stat-icon">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="stat-content">
                        <h3>Profile</h3>
                        <p>Your Account</p>
                        <div class="stat-trend">
                            <span>Member since <?php echo date('M Y', strtotime($currentUser['created_at'] ?? 'now')); ?></span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Dashboard Content Grid -->
        <section class="content-section">
            <div class="content-grid">
                <!-- Quick Actions -->
                <div class="card quick-actions-card">
                    <div class="card-header">
                        <h3>Quick Actions</h3>
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div class="card-body">
                        <div class="quick-actions">
                            <a href="chat-modern.php" class="quick-action">
                                <div class="action-icon">
                                    <i class="fas fa-comments"></i>
                                </div>
                                <div class="action-content">
                                    <h4>General Chat</h4>
                                    <p>Join the main conversation</p>
                                </div>
                            </a>
                            
                            <button onclick="showNewChatModal()" class="quick-action">
                                <div class="action-icon">
                                    <i class="fas fa-user-plus"></i>
                                </div>
                                <div class="action-content">
                                    <h4>Start New Chat</h4>
                                    <p>Find and message someone</p>
                                </div>
                            </button>
                            
                            <a href="profile.php" class="quick-action">
                                <div class="action-icon">
                                    <i class="fas fa-user-edit"></i>
                                </div>
                                <div class="action-content">
                                    <h4>Edit Profile</h4>
                                    <p>Update your information</p>
                                </div>
                            </button>
                            
                            <button onclick="showSettingsModal()" class="quick-action">
                                <div class="action-icon">
                                    <i class="fas fa-cog"></i>
                                </div>
                                <div class="action-content">
                                    <h4>Settings</h4>
                                    <p>Customize your experience</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Online Users -->
                <div class="card online-users-card">
                    <div class="card-header">
                        <h3>Online Users</h3>
                        <span class="user-count"><?php echo count($onlineUsers); ?></span>
                    </div>
                    <div class="card-body">
                        <div class="users-list" id="onlineUsersList">
                            <?php if (empty($onlineUsers)): ?>
                                <div class="empty-state">
                                    <i class="fas fa-user-friends"></i>
                                    <p>No users online right now</p>
                                </div>
                            <?php else: ?>
                                <?php foreach ($onlineUsers as $user): ?>
                                    <?php if ($user['id'] != $currentUser['id']): ?>
                                    <div class="user-item" onclick="startDirectMessage(<?php echo $user['id']; ?>)">
                                        <img src="<?php echo htmlspecialchars($user['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                                             alt="<?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?>" 
                                             class="user-avatar">
                                        <div class="user-info">
                                            <h4><?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?></h4>
                                            <p class="user-status online">Online now</p>
                                        </div>
                                        <div class="user-actions">
                                            <i class="fas fa-comment"></i>
                                        </div>
                                    </div>
                                    <?php endif; ?>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="card recent-activity-card">
                    <div class="card-header">
                        <h3>Recent Activity</h3>
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="card-body">
                        <div class="activity-list" id="recentActivity">
                            <?php if (empty($recentMessages)): ?>
                                <div class="empty-state">
                                    <i class="fas fa-comments"></i>
                                    <p>No recent messages</p>
                                </div>
                            <?php else: ?>
                                <?php foreach ($recentMessages as $message): ?>
                                <div class="activity-item">
                                    <img src="<?php echo htmlspecialchars($message['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                                         alt="<?php echo htmlspecialchars($message['display_name'] ?? $message['username']); ?>" 
                                         class="activity-avatar">
                                    <div class="activity-content">
                                        <div class="activity-header">
                                            <h4><?php echo htmlspecialchars($message['display_name'] ?? $message['username']); ?></h4>
                                            <span class="activity-time"><?php echo date('g:i A', strtotime($message['created_at'])); ?></span>
                                        </div>
                                        <p class="activity-message"><?php echo htmlspecialchars(substr($message['content'], 0, 100)) . (strlen($message['content']) > 100 ? '...' : ''); ?></p>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                        <div class="card-footer">
                            <a href="chat-modern.php" class="view-all-link">
                                View all messages
                                <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- Sidebar -->
    <aside class="dashboard-sidebar">
        <div class="sidebar-content">
            <!-- User Profile Card -->
            <div class="profile-card">
                <div class="profile-background"></div>
                <div class="profile-info">
                    <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                         alt="Your avatar" 
                         class="profile-avatar">
                    <h3><?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?></h3>
                    <p class="profile-email"><?php echo htmlspecialchars($currentUser['email']); ?></p>
                    <div class="profile-status">
                        <span class="status-indicator online"></span>
                        <span>Online</span>
                    </div>
                </div>
                <div class="profile-actions">
                    <a href="profile.php" class="profile-action">
                        <i class="fas fa-edit"></i>
                        Edit Profile
                    </a>
                </div>
            </div>

            <!-- Navigation -->
            <nav class="sidebar-nav">
                <h4>Quick Links</h4>
                <ul>
                    <li><a href="dashboard.php" class="nav-link active">
                        <i class="fas fa-home"></i> Dashboard
                    </a></li>
                    <li><a href="chat-modern.php" class="nav-link">
                        <i class="fas fa-comments"></i> Chat
                    </a></li>
                    <li><a href="profile.php" class="nav-link">
                        <i class="fas fa-user"></i> Profile
                    </a></li>
                    <li><button onclick="showSettingsModal()" class="nav-link">
                        <i class="fas fa-cog"></i> Settings
                    </button></li>
                </ul>
            </nav>

            <!-- Recent Notifications -->
            <div class="notifications-section">
                <h4>Notifications</h4>
                <div class="notifications-list" id="notificationsList">
                    <div class="empty-state">
                        <i class="fas fa-bell"></i>
                        <p>No new notifications</p>
                    </div>
                </div>
            </div>
        </div>
    </aside>
</div>

<!-- Modals -->
<div id="newChatModal" class="modal" style="display: none;">
    <div class="modal-backdrop" onclick="closeNewChatModal()"></div>
    <div class="modal-content">
        <div class="modal-header">
            <h3>Start New Chat</h3>
            <button class="modal-close" onclick="closeNewChatModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="search-input-wrapper">
                <i class="fas fa-search"></i>
                <input type="text" id="newChatSearch" placeholder="Search users..." autocomplete="off">
            </div>
            <div class="user-results" id="newChatUsers">
                <!-- Search results will appear here -->
            </div>
        </div>
    </div>
</div>

<div id="settingsModal" class="modal" style="display: none;">
    <div class="modal-backdrop" onclick="closeSettingsModal()"></div>
    <div class="modal-content">
        <div class="modal-header">
            <h3>Settings</h3>
            <button class="modal-close" onclick="closeSettingsModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="settings-section">
                <h4>Notifications</h4>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="notificationSounds" checked>
                        <span class="checkmark"></span>
                        Sound notifications
                    </label>
                </div>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="desktopNotifications" checked>
                        <span class="checkmark"></span>
                        Desktop notifications
                    </label>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Appearance</h4>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="darkMode">
                        <span class="checkmark"></span>
                        Dark mode
                    </label>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button onclick="saveSettings()" class="primary-btn">Save Settings</button>
        </div>
    </div>
</div>

<!-- Global Dashboard Data -->
<script>
window.dashboardConfig = {
    currentUser: <?php echo json_encode($currentUser); ?>,
    stats: <?php echo json_encode($stats); ?>,
    apiEndpoints: {
        users: 'api/users.php',
        messages: 'api/messages.php'
    }
};
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
