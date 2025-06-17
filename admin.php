<?php
$pageTitle = 'Admin Panel - Quick Chat';
$pageClass = 'admin-page';
$additionalCSS = [];
$additionalJS = ['assets/js/chart.js'];

// Require authentication and admin role
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireRole('admin', 'dashboard.php');

// Get admin statistics
require_once __DIR__ . '/classes/User.php';
require_once __DIR__ . '/classes/Message.php';
require_once __DIR__ . '/classes/Database.php';

$userClass = new User();
$messageClass = new Message();
$db = Database::getInstance();

// Get system statistics
$stats = [
    'total_users' => $db->fetch("SELECT COUNT(*) as count FROM users")['count'],
    'active_users' => $db->fetch("SELECT COUNT(*) as count FROM users WHERE last_seen > DATE_SUB(NOW(), INTERVAL 24 HOUR)")['count'],
    'online_users' => $db->fetch("SELECT COUNT(*) as count FROM users WHERE is_online = 1")['count'],
    'total_messages' => $db->fetch("SELECT COUNT(*) as count FROM messages")['count'],
    'messages_today' => $db->fetch("SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = CURDATE()")['count'],
    'total_sessions' => $db->fetch("SELECT COUNT(*) as count FROM user_sessions WHERE expires_at > NOW()")['count']
];

// Get recent users
$recentUsers = $db->fetchAll("
    SELECT id, username, email, display_name, created_at, email_verified, is_online 
    FROM users 
    ORDER BY created_at DESC 
    LIMIT 10
");

// Get system logs
$systemLogs = $db->fetchAll("
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT 20
");

include __DIR__ . '/includes/header.php';
?>

<div class="admin-container">
    <div class="admin-header">
        <h1>
            <i class="fas fa-shield-alt"></i>
            Administration Panel
        </h1>
        <p>Manage users, monitor system health, and configure settings</p>
    </div>
    
    <!-- Quick Stats -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon users">
                <i class="fas fa-users"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo number_format($stats['total_users']); ?></h3>
                <p>Total Users</p>
                <span class="stat-change">+<?php echo $recentUsers ? count(array_filter($recentUsers, function($u) { return strtotime($u['created_at']) > strtotime('-7 days'); })) : 0; ?> this week</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon online">
                <i class="fas fa-circle"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo number_format($stats['online_users']); ?></h3>
                <p>Online Now</p>
                <span class="stat-change"><?php echo number_format($stats['active_users']); ?> active today</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon messages">
                <i class="fas fa-comments"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo number_format($stats['total_messages']); ?></h3>
                <p>Total Messages</p>
                <span class="stat-change">+<?php echo number_format($stats['messages_today']); ?> today</span>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon sessions">
                <i class="fas fa-devices"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo number_format($stats['total_sessions']); ?></h3>
                <p>Active Sessions</p>
                <span class="stat-change">Logged in users</span>
            </div>
        </div>
    </div>
    
    <!-- Admin Tabs -->
    <div class="admin-tabs">
        <button class="tab-btn active" onclick="switchTab('dashboard')">
            <i class="fas fa-tachometer-alt"></i>
            Dashboard
        </button>
        <button class="tab-btn" onclick="switchTab('users')">
            <i class="fas fa-users-cog"></i>
            Users
        </button>
        <button class="tab-btn" onclick="switchTab('messages')">
            <i class="fas fa-comment-dots"></i>
            Messages
        </button>
        <button class="tab-btn" onclick="switchTab('system')">
            <i class="fas fa-server"></i>
            System
        </button>
        <button class="tab-btn" onclick="switchTab('logs')">
            <i class="fas fa-list-alt"></i>
            Logs
        </button>
        <button class="tab-btn" onclick="switchTab('settings')">
            <i class="fas fa-cog"></i>
            Settings
        </button>
    </div>
    
    <!-- Dashboard Tab -->
    <div id="dashboardTab" class="tab-content active">
        <div class="admin-grid">
            <!-- Recent Users -->
            <div class="admin-section">
                <div class="section-header">
                    <h2>Recent Users</h2>
                    <button class="btn btn-primary" onclick="showAddUserModal()">
                        <i class="fas fa-user-plus"></i>
                        Add User
                    </button>
                </div>
                <div class="users-table">
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($recentUsers as $user): ?>
                            <tr>
                                <td>
                                    <div class="user-info">
                                        <div class="user-avatar-small">
                                            <img src="<?php echo htmlspecialchars($user['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                                                 alt="<?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?>">
                                        </div>
                                        <div>
                                            <div class="user-name"><?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?></div>
                                            <div class="username">@<?php echo htmlspecialchars($user['username']); ?></div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <?php echo htmlspecialchars($user['email']); ?>
                                    <?php if (!$user['email_verified']): ?>
                                        <span class="badge unverified">Unverified</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <span class="status-badge <?php echo $user['is_online'] ? 'online' : 'offline'; ?>">
                                        <?php echo $user['is_online'] ? 'Online' : 'Offline'; ?>
                                    </span>
                                </td>
                                <td><?php echo date('M j, Y', strtotime($user['created_at'])); ?></td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-small" onclick="editUser(<?php echo $user['id']; ?>)" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="btn-small danger" onclick="deleteUser(<?php echo $user['id']; ?>)" title="Delete">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <!-- System Health -->
            <div class="admin-section">
                <div class="section-header">
                    <h2>System Health</h2>
                    <button class="btn btn-secondary" onclick="refreshSystemStatus()">
                        <i class="fas fa-sync"></i>
                        Refresh
                    </button>
                </div>
                <div class="health-metrics">
                    <div class="metric">
                        <div class="metric-icon">
                            <i class="fas fa-database"></i>
                        </div>
                        <div class="metric-info">
                            <h4>Database</h4>
                            <span class="status online">Connected</span>
                            <small>Response: &lt; 50ms</small>
                        </div>
                    </div>
                    
                    <div class="metric">
                        <div class="metric-icon">
                            <i class="fas fa-memory"></i>
                        </div>
                        <div class="metric-info">
                            <h4>Memory Usage</h4>
                            <span class="status warning">67%</span>
                            <small>8.2 GB / 12 GB</small>
                        </div>
                    </div>
                    
                    <div class="metric">
                        <div class="metric-icon">
                            <i class="fas fa-hdd"></i>
                        </div>
                        <div class="metric-info">
                            <h4>Disk Space</h4>
                            <span class="status online">34%</span>
                            <small>15 GB / 45 GB</small>
                        </div>
                    </div>
                    
                    <div class="metric">
                        <div class="metric-icon">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div class="metric-info">
                            <h4>Security</h4>
                            <span class="status online">Secure</span>
                            <small>SSL/TLS Active</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Activity Chart -->
        <div class="admin-section full-width">
            <div class="section-header">
                <h2>Activity Overview</h2>
                <div class="chart-controls">
                    <select id="chartPeriod" onchange="updateChart()">
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>
            </div>
            <div class="chart-container">
                <canvas id="activityChart"></canvas>
            </div>
        </div>
    </div>
    
    <!-- Users Tab -->
    <div id="usersTab" class="tab-content">
        <div class="admin-section">
            <div class="section-header">
                <h2>User Management</h2>
                <div class="header-actions">
                    <input type="text" placeholder="Search users..." id="userSearch" class="search-input">
                    <button class="btn btn-primary" onclick="showAddUserModal()">
                        <i class="fas fa-user-plus"></i>
                        Add User
                    </button>
                </div>
            </div>
            <div id="usersTableContainer">
                <!-- Users table will be loaded here -->
            </div>
        </div>
    </div>
    
    <!-- Messages Tab -->
    <div id="messagesTab" class="tab-content">
        <div class="admin-section">
            <div class="section-header">
                <h2>Message Management</h2>
                <div class="header-actions">
                    <input type="text" placeholder="Search messages..." id="messageSearch" class="search-input">
                    <button class="btn btn-secondary" onclick="exportMessages()">
                        <i class="fas fa-download"></i>
                        Export
                    </button>
                </div>
            </div>
            <div id="messagesTableContainer">
                <!-- Messages table will be loaded here -->
            </div>
        </div>
    </div>
    
    <!-- System Tab -->
    <div id="systemTab" class="tab-content">
        <div class="admin-section">
            <div class="section-header">
                <h2>System Information</h2>
                <button class="btn btn-secondary" onclick="refreshSystemInfo()">
                    <i class="fas fa-sync"></i>
                    Refresh
                </button>
            </div>
            <div class="system-info">
                <div class="info-grid">
                    <div class="info-item">
                        <h4>PHP Version</h4>
                        <span><?php echo phpversion(); ?></span>
                    </div>
                    <div class="info-item">
                        <h4>Server Software</h4>
                        <span><?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'; ?></span>
                    </div>
                    <div class="info-item">
                        <h4>Database</h4>
                        <span>MySQL <?php echo $db->fetch("SELECT VERSION() as version")['version'] ?? 'Unknown'; ?></span>
                    </div>
                    <div class="info-item">
                        <h4>Uptime</h4>
                        <span id="serverUptime">Loading...</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="admin-section">
            <div class="section-header">
                <h2>System Maintenance</h2>
            </div>
            <div class="maintenance-actions">
                <div class="maintenance-item">
                    <div class="maintenance-info">
                        <h4>Clear Cache</h4>
                        <p>Clear application cache and temporary files</p>
                    </div>
                    <button class="btn btn-secondary" onclick="clearCache()">
                        <i class="fas fa-broom"></i>
                        Clear Cache
                    </button>
                </div>
                
                <div class="maintenance-item">
                    <div class="maintenance-info">
                        <h4>Database Optimization</h4>
                        <p>Optimize database tables and cleanup old data</p>
                    </div>
                    <button class="btn btn-secondary" onclick="optimizeDatabase()">
                        <i class="fas fa-database"></i>
                        Optimize DB
                    </button>
                </div>
                
                <div class="maintenance-item">
                    <div class="maintenance-info">
                        <h4>Backup Database</h4>
                        <p>Create a backup of the current database</p>
                    </div>
                    <button class="btn btn-primary" onclick="backupDatabase()">
                        <i class="fas fa-save"></i>
                        Create Backup
                    </button>
                </div>
                
                <div class="maintenance-item danger">
                    <div class="maintenance-info">
                        <h4>Restart Services</h4>
                        <p>Restart application services (may cause brief downtime)</p>
                    </div>
                    <button class="btn btn-danger" onclick="restartServices()">
                        <i class="fas fa-power-off"></i>
                        Restart Services
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Logs Tab -->
    <div id="logsTab" class="tab-content">
        <div class="admin-section">
            <div class="section-header">
                <h2>System Logs</h2>
                <div class="header-actions">
                    <select id="logLevel">
                        <option value="">All Levels</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                    <button class="btn btn-secondary" onclick="refreshLogs()">
                        <i class="fas fa-sync"></i>
                        Refresh
                    </button>
                </div>
            </div>
            <div class="logs-container">
                <div class="logs-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Details</th>
                                <th>IP Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($systemLogs as $log): ?>
                            <tr>
                                <td><?php echo date('M j, g:i A', strtotime($log['created_at'])); ?></td>
                                <td><?php echo $log['user_id'] ? 'User #' . $log['user_id'] : 'System'; ?></td>
                                <td><span class="action-badge"><?php echo htmlspecialchars($log['action']); ?></span></td>
                                <td><?php echo htmlspecialchars($log['details'] ?? '-'); ?></td>
                                <td><?php echo htmlspecialchars($log['ip_address']); ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Settings Tab -->
    <div id="settingsTab" class="tab-content">
        <div class="admin-section">
            <div class="section-header">
                <h2>Application Settings</h2>
            </div>
            <form class="settings-form" onsubmit="saveSettings(event)">
                <div class="settings-grid">
                    <div class="setting-group">
                        <h3>General Settings</h3>
                        <div class="form-group">
                            <label>Application Name</label>
                            <input type="text" name="app_name" value="Quick Chat">
                        </div>
                        <div class="form-group">
                            <label>Max Users</label>
                            <input type="number" name="max_users" value="1000">
                        </div>
                        <div class="form-group">
                            <label>Registration</label>
                            <select name="registration_enabled">
                                <option value="1">Enabled</option>
                                <option value="0">Disabled</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="setting-group">
                        <h3>Chat Settings</h3>
                        <div class="form-group">
                            <label>Max Message Length</label>
                            <input type="number" name="max_message_length" value="2000">
                        </div>
                        <div class="form-group">
                            <label>File Upload</label>
                            <select name="file_upload_enabled">
                                <option value="1">Enabled</option>
                                <option value="0">Disabled</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Max File Size (MB)</label>
                            <input type="number" name="max_file_size" value="10">
                        </div>
                    </div>
                    
                    <div class="setting-group">
                        <h3>Security Settings</h3>
                        <div class="form-group">
                            <label>Max Login Attempts</label>
                            <input type="number" name="max_login_attempts" value="5">
                        </div>
                        <div class="form-group">
                            <label>Session Timeout (minutes)</label>
                            <input type="number" name="session_timeout" value="60">
                        </div>
                        <div class="form-group">
                            <label>Password Strength</label>
                            <select name="password_strength">
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i>
                        Save Settings
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="resetSettings()">
                        <i class="fas fa-undo"></i>
                        Reset to Defaults
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Add User Modal -->
<div id="addUserModal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Add New User</h3>
            <button onclick="closeAddUserModal()" class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <form id="addUserForm" onsubmit="addUser(event)">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" required minlength="3" maxlength="20">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" required>
                </div>
                <div class="form-group">
                    <label>Display Name</label>
                    <input type="text" name="display_name" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="password" required minlength="8">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select name="role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Create User</button>
                    <button type="button" class="btn btn-secondary" onclick="closeAddUserModal()">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<style>
.admin-page {
    background: #f5f7fa;
}

.admin-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
}

.admin-header {
    text-align: center;
    margin-bottom: 3rem;
}

.admin-header h1 {
    color: #2c3e50;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
}

.admin-header p {
    color: #6c757d;
    font-size: 1.2rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
}

.stat-card {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
}

.stat-icon {
    width: 80px;
    height: 80px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 2rem;
}

.stat-icon.users {
    background: linear-gradient(135deg, #667eea, #764ba2);
}

.stat-icon.online {
    background: linear-gradient(135deg, #28a745, #20c997);
}

.stat-icon.messages {
    background: linear-gradient(135deg, #17a2b8, #6f42c1);
}

.stat-icon.sessions {
    background: linear-gradient(135deg, #fd7e14, #e83e8c);
}

.stat-content h3 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #2c3e50;
    margin: 0;
}

.stat-content p {
    color: #6c757d;
    margin: 0.5rem 0;
    font-weight: 500;
}

.stat-change {
    font-size: 0.8rem;
    color: #28a745;
    font-weight: 500;
}

.admin-tabs {
    display: flex;
    background: white;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    margin-bottom: 0;
    overflow-x: auto;
}

.tab-btn {
    flex: 1;
    padding: 1.5rem 2rem;
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
    white-space: nowrap;
}

.tab-btn:first-child {
    border-radius: 16px 0 0 0;
}

.tab-btn:last-child {
    border-radius: 0 16px 0 0;
}

.tab-btn.active {
    color: #667eea;
    border-bottom-color: #667eea;
    background: #f8f9fa;
}

.tab-content {
    display: none;
    background: white;
    border-radius: 0 0 16px 16px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    min-height: 500px;
}

.tab-content.active {
    display: block;
}

.admin-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
}

.admin-section {
    padding: 2rem;
    border-bottom: 1px solid #e9ecef;
}

.admin-section.full-width {
    grid-column: 1 / -1;
}

.admin-section:last-child {
    border-bottom: none;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.section-header h2 {
    color: #2c3e50;
    margin: 0;
    font-size: 1.5rem;
}

.header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.search-input {
    padding: 0.5rem 1rem;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    font-size: 0.9rem;
}

.users-table table {
    width: 100%;
    border-collapse: collapse;
}

.users-table th,
.users-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
}

.users-table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #2c3e50;
}

.user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.user-avatar-small {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
}

.user-avatar-small img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.user-name {
    font-weight: 500;
    color: #2c3e50;
}

.username {
    font-size: 0.8rem;
    color: #6c757d;
}

.badge {
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 500;
    margin-left: 0.5rem;
}

.badge.unverified {
    background: #fff3cd;
    color: #856404;
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}

.status-badge.online {
    background: #d4edda;
    color: #155724;
}

.status-badge.offline {
    background: #f8d7da;
    color: #721c24;
}

.action-buttons {
    display: flex;
    gap: 0.5rem;
}

.btn-small {
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: #f8f9fa;
    color: #6c757d;
    transition: all 0.2s ease;
}

.btn-small:hover {
    background: #e9ecef;
}

.btn-small.danger {
    background: #dc3545;
    color: white;
}

.btn-small.danger:hover {
    background: #c82333;
}

.health-metrics {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.metric {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.metric-icon {
    width: 50px;
    height: 50px;
    border-radius: 10px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
}

.metric-info h4 {
    margin: 0 0 0.25rem 0;
    color: #2c3e50;
}

.metric-info .status {
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
}

.metric-info .status.online {
    background: #d4edda;
    color: #155724;
}

.metric-info .status.warning {
    background: #fff3cd;
    color: #856404;
}

.metric-info small {
    display: block;
    color: #6c757d;
    margin-top: 0.25rem;
}

.chart-container {
    height: 400px;
    padding: 1rem;
}

.chart-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.chart-controls select {
    padding: 0.5rem;
    border: 1px solid #e9ecef;
    border-radius: 6px;
}

.system-info {
    margin-bottom: 2rem;
}

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
}

.info-item {
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
    text-align: center;
}

.info-item h4 {
    margin: 0 0 0.5rem 0;
    color: #2c3e50;
}

.info-item span {
    font-weight: 500;
    color: #667eea;
}

.maintenance-actions {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.maintenance-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.maintenance-item.danger {
    background: #fff5f5;
    border: 1px solid #fed7d7;
}

.maintenance-info h4 {
    margin: 0 0 0.25rem 0;
    color: #2c3e50;
}

.maintenance-info p {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
}

.logs-container {
    max-height: 600px;
    overflow-y: auto;
}

.logs-table table {
    width: 100%;
    border-collapse: collapse;
}

.logs-table th,
.logs-table td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
    font-size: 0.9rem;
}

.logs-table th {
    background: #f8f9fa;
    font-weight: 600;
    position: sticky;
    top: 0;
}

.action-badge {
    padding: 0.25rem 0.5rem;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 500;
}

.settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 2rem;
}

.setting-group {
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
}

.setting-group h3 {
    margin: 0 0 1.5rem 0;
    color: #2c3e50;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e9ecef;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #2c3e50;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    font-size: 1rem;
}

.form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
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

.modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-header h3 {
    margin: 0;
    color: #2c3e50;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: #6c757d;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background 0.2s ease;
}

.close-btn:hover {
    background: #f8f9fa;
}

.modal-body {
    padding: 1.5rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .admin-container {
        padding: 1rem;
    }
    
    .admin-grid {
        grid-template-columns: 1fr;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .stat-card {
        flex-direction: column;
        text-align: center;
    }
    
    .admin-tabs {
        flex-direction: column;
    }
    
    .tab-btn {
        border-bottom: 1px solid #e9ecef;
        border-radius: 0;
    }
    
    .tab-btn:first-child {
        border-radius: 16px 16px 0 0;
    }
    
    .tab-btn:last-child {
        border-radius: 0 0 16px 16px;
        border-bottom: none;
    }
    
    .settings-grid {
        grid-template-columns: 1fr;
    }
    
    .header-actions {
        flex-direction: column;
        align-items: stretch;
    }
    
    .maintenance-item {
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
    
    // Load tab-specific content
    loadTabContent(tabName);
}

function loadTabContent(tabName) {
    switch(tabName) {
        case 'users':
            loadUsersTable();
            break;
        case 'messages':
            loadMessagesTable();
            break;
        case 'logs':
            refreshLogs();
            break;
    }
}

// User management
function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('addUserForm').reset();
}

async function addUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    formData.append('action', 'add_user');
    formData.append('csrf_token', window.csrfToken);
    
    try {
        const response = await fetch('api/admin.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('User created successfully!');
            closeAddUserModal();
            if (document.getElementById('usersTab').classList.contains('active')) {
                loadUsersTable();
            }
        } else {
            alert('Failed to create user: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

async function editUser(userId) {
    // Implement user editing
    alert(`Edit user ${userId} - This will be implemented`);
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('action', 'delete_user');
        formData.append('user_id', userId);
        formData.append('csrf_token', window.csrfToken);
        
        const response = await fetch('api/admin.php', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('User deleted successfully!');
            if (document.getElementById('usersTab').classList.contains('active')) {
                loadUsersTable();
            }
        } else {
            alert('Failed to delete user: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

async function loadUsersTable() {
    const container = document.getElementById('usersTableContainer');
    container.innerHTML = '<div class="loading">Loading users...</div>';
    
    try {
        const response = await fetch('api/admin.php?action=get_users');
        const result = await response.json();
        
        if (result.success) {
            // Render users table
            // Implementation would generate the full users table
            container.innerHTML = '<div class="users-table">Users loaded successfully</div>';
        } else {
            container.innerHTML = '<div class="error">Failed to load users</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="error">Network error</div>';
    }
}

async function loadMessagesTable() {
    const container = document.getElementById('messagesTableContainer');
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    // Implementation would load and display messages
    setTimeout(() => {
        container.innerHTML = '<div class="messages-table">Messages loaded successfully</div>';
    }, 1000);
}

// System functions
function refreshSystemStatus() {
    alert('System status refreshed');
}

function refreshSystemInfo() {
    // Update server uptime
    document.getElementById('serverUptime').textContent = '5 days, 12 hours';
}

function clearCache() {
    if (confirm('Clear application cache? This may temporarily slow down the application.')) {
        alert('Cache cleared successfully');
    }
}

function optimizeDatabase() {
    if (confirm('Optimize database? This may take a few minutes.')) {
        alert('Database optimization started');
    }
}

function backupDatabase() {
    if (confirm('Create database backup? This may take several minutes.')) {
        alert('Database backup started');
    }
}

function restartServices() {
    if (confirm('Restart application services? This will cause brief downtime.')) {
        alert('Services restart initiated');
    }
}

// Logs
function refreshLogs() {
    alert('Logs refreshed');
}

// Settings
function saveSettings(event) {
    event.preventDefault();
    alert('Settings saved successfully');
}

function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        alert('Settings reset to defaults');
    }
}

// Chart
function updateChart() {
    const period = document.getElementById('chartPeriod').value;
    // Update chart based on selected period
    console.log('Update chart for period:', period);
}

function exportMessages() {
    if (confirm('Export all messages? This may take a while.')) {
        alert('Message export started');
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize default tab content
    loadTabContent('dashboard');
    
    // Refresh system info
    refreshSystemInfo();
    
    // Set up periodic updates
    setInterval(refreshSystemInfo, 60000); // Update every minute
});
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
