<?php
/**
 * Dashboard - Quick Chat
 * Modern dashboard with enhanced UI and features
 */

$pageTitle = 'Dashboard - Quick Chat';
$pageClass = 'modern-dashboard-page';
$additionalCSS = ['assets/css/modern-dashboard.css'];
$additionalJS = ['assets/js/modern-dashboard.js'];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Get dashboard data
require_once __DIR__ . '/classes/Message.php';
require_once __DIR__ . '/classes/User.php';

$messageClass = new Message();
$userClass = new User();

// Get CSRF token
$csrfToken = AuthChecker::getCSRFToken();

// Get statistics
$totalMessages = $messageClass->getUserMessageCount($currentUser['id']);
$onlineUsers = $userClass->getOnlineUsers();
$recentMessages = $messageClass->getRecentMessages(10);
$userSettings = $userClass->getUserSettings($currentUser['id']);
$totalUsers = $userClass->getTotalUserCount();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?php echo htmlspecialchars($csrfToken); ?>">
    <title><?php echo $pageTitle; ?></title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="assets/css/modern-dashboard.css" rel="stylesheet">
</head>
<body class="<?php echo $pageClass; ?>
<a href="#main-content" class="skip-link">Skip to main content</a>
<a href="#navigation" class="skip-link">Skip to navigation</a>">
    <div class="dashboard-app">
        <!-- Sidebar Navigation -->
        <nav class="dashboard-sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <i class="fas fa-comments"></i>
                    <span>Quick Chat</span>
                </div>
                <button class="sidebar-toggle" onclick="toggleSidebar()">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
            
            <div class="sidebar-menu">
                <a href="#" class="menu-item active" data-section="overview">
                    <i class="fas fa-home"></i>
                    <span>Overview</span>
                </a>
                <a href="chat.php" class="menu-item">
                    <i class="fas fa-comments"></i>
                    <span>Chat</span>
                </a>
                <a href="#" class="menu-item" data-section="messages">
                    <i class="fas fa-envelope"></i>
                    <span>Messages</span>
                </a>
                <a href="#" class="menu-item" data-section="contacts">
                    <i class="fas fa-address-book"></i>
                    <span>Contacts</span>
                </a>
                <a href="#" class="menu-item" data-section="groups">
                    <i class="fas fa-users"></i>
                    <span>Groups</span>
                </a>
                <a href="#" class="menu-item" data-section="settings">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </a>
                <a href="profile.php" class="menu-item">
                    <i class="fas fa-user"></i>
                    <span>Profile</span>
                </a>
            </div>
            
            <div class="sidebar-footer">
                <div class="user-info">
                    <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? 'assets/images/default-avatar.svg'); ? alt="Image">" 
                         alt="Your profile picture" class="user-avatar">
                    <div class="user-details">
                        <div class="user-name"><?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?></div>
                        <div class="user-status">Online</div>
                    </div>
                </div>
                <button class="logout-btn" onclick="logout()" title="Logout">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="dashboard-main">
            <!-- Header -->
            <header class="dashboard-header">
                <div class="header-left">
                    <button class="mobile-menu-btn" onclick="toggleMobileSidebar()">
                        <i class="fas fa-bars"></i>
                    </button>
                    <h1 id="pageTitle">Overview</h1>
                </div>
                <div class="header-right">
                    <div class="header-search">
                        <i class="fas fa-search"></i>
                        <input type="text" placeholder="Search..." id="globalSearch" aria-label="Search...">
                    </div>
                    <button class="header-btn" onclick="toggleNotifications()" title="Notifications">
                        <i class="fas fa-bell"></i>
                        <span class="notification-badge" id="notificationBadge">3</span>
                    </button>
                    <button class="header-btn" onclick="toggleTheme()" title="Toggle theme">
                        <i class="fas fa-moon" id="themeIcon"></i>
                    </button>
                </div>
            </header>

            <!-- Content Sections -->
            <div class="dashboard-content">
                <!-- Overview Section -->
                <section class="content-section active" id="overviewSection">
                    <div class="welcome-banner">
                        <div class="banner-content">
                            <h2>Welcome back, <?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>! 👋</h2>
                            <p>Here's what's happening in your chat world today</p>
                        </div>
                        <div class="banner-actions">
                            <a href="chat.php" class="primary-btn">
                                <i class="fas fa-comments"></i>
                                Start Chatting
                            </a>
                        </div>
                    </div>

                    <!-- Stats Grid -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon messages">
                                <i class="fas fa-comments"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value"><?php echo number_format($totalMessages); ?></div>
                                <div class="stat-label">Messages Sent</div>
                                <div class="stat-change positive">
                                    <i class="fas fa-arrow-up"></i>
                                    <span>12% from last week</span>
                                </div>
                            </div>
                        </div>

                        <div class="stat-card">
                            <div class="stat-icon users">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value"><?php echo count($onlineUsers); ?></div>
                                <div class="stat-label">Online Now</div>
                                <div class="stat-change">
                                    <span>of <?php echo number_format($totalUsers); ?> total users</span>
                                </div>
                            </div>
                        </div>

                        <div class="stat-card">
                            <div class="stat-icon activity">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">85%</div>
                                <div class="stat-label">Activity Score</div>
                                <div class="stat-change positive">
                                    <i class="fas fa-arrow-up"></i>
                                    <span>5% increase</span>
                                </div>
                            </div>
                        </div>

                        <div class="stat-card">
                            <div class="stat-icon time">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value">2.4h</div>
                                <div class="stat-label">Daily Usage</div>
                                <div class="stat-change negative">
                                    <i class="fas fa-arrow-down"></i>
                                    <span>8% from yesterday</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Content Grid -->
                    <div class="content-grid">
                        <!-- Recent Activity -->
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3>Recent Activity</h3>
                                <button class="card-action" onclick="refreshActivity()">
                                    <i class="fas fa-refresh"></i>
                                </button>
                            </div>
                            <div class="card-content">
                                <div class="activity-list" id="activityList">
                                    <?php foreach ($recentMessages as $message): ?>
                                    <div class="activity-item">
                                        <div class="activity-avatar">
                                        <div class="activity-content">
                                        </div>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>

                        <!-- Online Users -->
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3>Online Users</h3>
                                <span class="badge"><?php echo count($onlineUsers); ?></span>
                            </div>
                            <div class="card-content">
                                <div class="user-list" id="onlineUsersList">
                                    <?php foreach ($onlineUsers as $user): ?>
                                    <div class="user-item" onclick="startChat(<?php echo $user['id']; ?>)">
                                        <div class="user-avatar">
                                        </div>
                                        <div class="user-info">
                                        </div>
                                        <button class="user-action" title="Start chat">
                                        </button>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Actions -->
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3>Quick Actions</h3>
                            </div>
                            <div class="card-content">
                                <div class="quick-actions">
                                    <button class="quick-action" onclick="location.href='chat.php'">
                                        <i class="fas fa-comments"></i>
                                        <span>Start Chat</span>
                                    </button>
                                    <button class="quick-action" onclick="showNewGroupModal()">
                                        <i class="fas fa-users-plus"></i>
                                        <span>Create Group</span>
                                    </button>
                                    <button class="quick-action" onclick="location.href='profile.php'">
                                        <i class="fas fa-user-edit"></i>
                                        <span>Edit Profile</span>
                                    </button>
                                    <button class="quick-action" onclick="showInviteModal()">
                                        <i class="fas fa-user-plus"></i>
                                        <span>Invite Friends</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Chat Stats Chart -->
                        <div class="dashboard-card full-width">
                            <div class="card-header">
                                <h3>Message Activity</h3>
                                <div class="card-actions">
                                    <select id="chartPeriod" onchange="updateChart()">
                                        <option value="7d">Last 7 days</option>
                                        <option value="30d">Last 30 days</option>
                                        <option value="90d">Last 3 months</option>
                                    </select>
                                </div>
                            </div>
                            <div class="card-content">
                                <div class="chart-container">
                                    <canvas id="activityChart" width="400" height="200"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Messages Section -->
                <section class="content-section" id="messagesSection">
                    <div class="section-header">
                        <h2>Messages</h2>
                        <button class="primary-btn" onclick="location.href='chat.php'">
                            <i class="fas fa-plus"></i>
                            New Message
                        </button>
                    </div>
                    
                    <div class="messages-container">
                        <div class="messages-filters">
                            <button class="filter-btn active" data-filter="all">All</button>
                            <button class="filter-btn" data-filter="unread">Unread</button>
                            <button class="filter-btn" data-filter="direct">Direct</button>
                            <button class="filter-btn" data-filter="groups">Groups</button>
                        </div>
                        
                        <div class="messages-list" id="messagesList">
                            <!-- Messages will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Contacts Section -->
                <section class="content-section" id="contactsSection">
                    <div class="section-header">
                        <h2>Contacts</h2>
                        <button class="primary-btn" onclick="showAddContactModal()">
                            <i class="fas fa-user-plus"></i>
                            Add Contact
                        </button>
                    </div>
                    
                    <div class="contacts-container">
                        <div class="contacts-search">
                            <div class="search-input">
                                <i class="fas fa-search"></i>
                                <input type="text" placeholder="Search contacts..." id="contactsSearch" aria-label="Search contacts...">
                            </div>
                        </div>
                        
                        <div class="contacts-grid" id="contactsGrid">
                            <!-- Contacts will be loaded here -->
                        </div>
                    </div>
                </section>

                <!-- Groups Section -->
                <section class="content-section" id="groupsSection">
                    <div class="section-header">
                        <h2>My Groups</h2>
                        <div class="section-actions">
                            <button class="action-btn" onclick="showModal('newGroupModal')">
                                <i class="fas fa-plus"></i> New Group
                            </button>
                        </div>
                    </div>
                    
                    <div class="section-content">
                        <div class="groups-container">
                            <div class="groups-list" id="groupsList">
                                <!-- Groups will be loaded here -->
                                <div class="empty-state">
                                    <i class="fas fa-users"></i>
                                    <p>No groups yet</p>
                                    <button class="primary-btn" onclick="showModal('newGroupModal')">Create Group</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Settings Section -->
                <section class="content-section" id="settingsSection">
                    <div class="section-header">
                        <h2>Settings</h2>
                    </div>
                    
                    <div class="settings-container">
                        <div class="settings-grid">
                            <div class="settings-card">
                                <h3>Notifications</h3>
                                <div class="setting-item">
                                    <label>
                                        <input type="checkbox" id="emailNotifications" checked aria-label="checkbox input">
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                            </div>

                            <div class="settings-card">
                                <h3>Privacy</h3>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                            </div>

                            <div class="settings-card">
                                <h3>Appearance</h3>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                                <div class="setting-item">
                                    <label>
                                    </label>
                                </div>
                            </div>

                            <div class="settings-card">
                                <h3>Account</h3>
                                <div class="setting-actions">
                                    <button class="secondary-btn" onclick="changePassword()">
                                    </button>
                                    <button class="secondary-btn" onclick="exportData()">
                                    </button>
                                    <button class="danger-btn" onclick="deleteAccount()">
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    </div>

    <!-- Modals -->
    <div class="modal" id="newGroupModal" onclick="closeModalOnOutsideClick(event, 'newGroupModal')">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Group</h3>
                <button class="close-btn" onclick="closeModal('newGroupModal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="newGroupForm">
                    <div class="form-group">
                        <label>Group Name</label>
                        <input type="text" id="groupName" required aria-label="text input">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="groupDescription" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Add Members</label>
                        <div class="member-search">
                            <input type="text" id="memberSearch" placeholder="Search users..." oninput="searchMembers()" aria-label="Search users...">
                            <div class="member-results" id="memberResults"></div>
                        </div>
                        <div class="selected-members" id="selectedMembers"></div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="closeModal('newGroupModal')">Cancel</button>
                <button class="primary-btn" onclick="createGroup()">Create Group</button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="assets/js/modern-dashboard.js"></script>
    <script>
        // Initialize dashboard
        const dashboard = new ModernDashboard({
            currentUserId: <?php echo $currentUser['id']; ?>,
            apiBase: 'api/',
            csrfToken: '<?php echo htmlspecialchars($csrfToken); ?>'
        });
        
        dashboard.init();
    </script>
    
    <!-- Load Module Loader for new architecture -->
    <script src="assets/js/module-loader.js"></script>
    
    <!-- Legacy script inclusion for backward compatibility during migration -->
    <?php foreach ($additionalJS as $js): ?>
    <script src="<?php echo $js; ?>"></script>
    <?php endforeach; ?>
</body>
</html>
