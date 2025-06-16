<?php
$pageTitle = 'Dashboard - Quick Chat';
$pageClass = 'dashboard-page';
$additionalCSS = [];
$additionalJS = ['assets/js/chart.js']; // For analytics charts

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Get user statistics
require_once __DIR__ . '/classes/Message.php';
require_once __DIR__ . '/classes/User.php';

$messageClass = new Message();
$userClass = new User();

// Get dashboard data
$totalMessages = $messageClass->getUserMessageCount($currentUser['id']);
$onlineUsers = $userClass->getOnlineUsers();
$recentMessages = $messageClass->getRecentMessages(5);
$userSettings = $userClass->getUserSettings($currentUser['id']);

include __DIR__ . '/includes/header.php';
?>

<div class="dashboard-container">
    <div class="dashboard-header">
        <h1>Welcome back, <?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?>!</h1>
        <p>Here's what's happening in your chat world</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-comments"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo number_format($totalMessages); ?></h3>
                <p>Total Messages</p>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo count($onlineUsers); ?></h3>
                <p>Online Users</p>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-clock"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo $currentUser['last_seen'] ? date('M j, g:i A', strtotime($currentUser['last_seen'])) : 'Never'; ?></h3>
                <p>Last Active</p>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-calendar"></i>
            </div>
            <div class="stat-content">
                <h3><?php echo date('M j, Y', strtotime($currentUser['created_at'])); ?></h3>
                <p>Member Since</p>
            </div>
        </div>
    </div>
    
    <div class="dashboard-grid">
        <!-- Quick Actions -->
        <div class="dashboard-section">
            <div class="section-header">
                <h2><i class="fas fa-bolt"></i> Quick Actions</h2>
            </div>
            <div class="quick-actions">
                <a href="chat.php" class="action-btn primary">
                    <i class="fas fa-comments"></i>
                    Start Chatting
                </a>
                <a href="profile.php" class="action-btn secondary">
                    <i class="fas fa-user-edit"></i>
                    Edit Profile
                </a>
                <a href="profile.php#settings" class="action-btn secondary">
                    <i class="fas fa-cog"></i>
                    Settings
                </a>
                <a href="javascript:void(0)" onclick="showInviteDialog()" class="action-btn secondary">
                    <i class="fas fa-user-plus"></i>
                    Invite Friends
                </a>
            </div>
        </div>
        
        <!-- Online Users -->
        <div class="dashboard-section">
            <div class="section-header">
                <h2><i class="fas fa-users"></i> Online Users</h2>
                <span class="online-count"><?php echo count($onlineUsers); ?> online</span>
            </div>
            <div class="users-list">
                <?php if (empty($onlineUsers)): ?>
                    <div class="empty-state">
                        <i class="fas fa-user-slash"></i>
                        <p>No users online right now</p>
                    </div>
                <?php else: ?>
                    <?php foreach ($onlineUsers as $user): ?>
                        <?php if ($user['id'] != $currentUser['id']): ?>
                        <div class="user-item">
                            <img src="<?php echo htmlspecialchars($user['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                                 alt="<?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?>" 
                                 class="user-avatar">
                            <div class="user-info">
                                <div class="user-name"><?php echo htmlspecialchars($user['display_name'] ?? $user['username']); ?></div>
                                <div class="user-status">
                                    <span class="status-dot online"></span>
                                    Online
                                </div>
                            </div>
                            <button onclick="startDirectMessage(<?php echo $user['id']; ?>)" class="chat-btn">
                                <i class="fas fa-comment"></i>
                            </button>
                        </div>
                        <?php endif; ?>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- Recent Activity -->
        <div class="dashboard-section full-width">
            <div class="section-header">
                <h2><i class="fas fa-history"></i> Recent Activity</h2>
                <a href="chat.php" class="view-all-link">View All Messages</a>
            </div>
            <div class="activity-list">
                <?php if (empty($recentMessages)): ?>
                    <div class="empty-state">
                        <i class="fas fa-comment-slash"></i>
                        <p>No recent messages</p>
                        <a href="chat.php" class="btn btn-primary">Start a conversation</a>
                    </div>
                <?php else: ?>
                    <?php foreach ($recentMessages as $message): ?>
                    <div class="activity-item">
                        <img src="<?php echo htmlspecialchars($message['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                             alt="<?php echo htmlspecialchars($message['display_name'] ?? $message['username']); ?>" 
                             class="activity-avatar">
                        <div class="activity-content">
                            <div class="activity-header">
                                <span class="activity-user"><?php echo htmlspecialchars($message['display_name'] ?? $message['username']); ?></span>
                                <span class="activity-time"><?php echo date('M j, g:i A', strtotime($message['created_at'])); ?></span>
                            </div>
                            <div class="activity-message">
                                <?php 
                                $content = htmlspecialchars($message['content']);
                                echo strlen($content) > 100 ? substr($content, 0, 100) . '...' : $content;
                                ?>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- System Status -->
        <div class="dashboard-section">
            <div class="section-header">
                <h2><i class="fas fa-server"></i> System Status</h2>
            </div>
            <div class="status-list">
                <div class="status-item">
                    <span class="status-dot online"></span>
                    <span>Chat Service</span>
                    <span class="status-label">Online</span>
                </div>
                <div class="status-item">
                    <span class="status-dot online"></span>
                    <span>File Upload</span>
                    <span class="status-label">Online</span>
                </div>
                <div class="status-item">
                    <span class="status-dot online"></span>
                    <span>Notifications</span>
                    <span class="status-label">Online</span>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Invite Friends Dialog -->
<div id="inviteDialog" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Invite Friends</h3>
            <button onclick="closeInviteDialog()" class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <p>Share this link with your friends to invite them to Quick Chat:</p>
            <div class="invite-link-container">
                <input type="text" id="inviteLink" readonly value="<?php echo (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'] . '/auth.php'; ?>">
                <button onclick="copyInviteLink()" class="copy-btn">
                    <i class="fas fa-copy"></i>
                    Copy
                </button>
            </div>
        </div>
    </div>
</div>

<style>
.dashboard-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.dashboard-header {
    text-align: center;
    margin-bottom: 3rem;
}

.dashboard-header h1 {
    color: #2c3e50;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

.dashboard-header p {
    color: #6c757d;
    font-size: 1.2rem;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
}

.stat-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px rgba(0,0,0,0.1);
}

.stat-icon {
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

.stat-content h3 {
    font-size: 1.8rem;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
}

.stat-content p {
    color: #6c757d;
    margin: 0;
    font-size: 0.9rem;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
}

.dashboard-section {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    overflow: hidden;
}

.dashboard-section.full-width {
    grid-column: 1 / -1;
}

.section-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
}

.section-header h2 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.online-count {
    background: #28a745;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
}

.view-all-link {
    color: #667eea;
    text-decoration: none;
    font-size: 0.9rem;
}

.view-all-link:hover {
    text-decoration: underline;
}

.quick-actions {
    padding: 1.5rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s ease;
}

.action-btn.primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.action-btn.secondary {
    background: #f8f9fa;
    color: #6c757d;
    border: 1px solid #e9ecef;
}

.action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.users-list {
    padding: 1.5rem;
    max-height: 400px;
    overflow-y: auto;
}

.user-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f8f9fa;
}

.user-item:last-child {
    border-bottom: none;
}

.user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.user-info {
    flex: 1;
}

.user-name {
    font-weight: 500;
    color: #2c3e50;
}

.user-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #6c757d;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.status-dot.online {
    background: #28a745;
}

.chat-btn {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    transition: background 0.2s ease;
}

.chat-btn:hover {
    background: #5a6fd8;
}

.activity-list {
    padding: 1.5rem;
    max-height: 500px;
    overflow-y: auto;
}

.activity-item {
    display: flex;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid #f8f9fa;
}

.activity-item:last-child {
    border-bottom: none;
}

.activity-avatar {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    object-fit: cover;
}

.activity-content {
    flex: 1;
}

.activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.activity-user {
    font-weight: 500;
    color: #2c3e50;
}

.activity-time {
    font-size: 0.8rem;
    color: #6c757d;
}

.activity-message {
    color: #6c757d;
    font-size: 0.9rem;
    line-height: 1.4;
}

.status-list {
    padding: 1.5rem;
}

.status-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f8f9fa;
}

.status-item:last-child {
    border-bottom: none;
}

.status-label {
    margin-left: auto;
    font-size: 0.8rem;
    color: #28a745;
    font-weight: 500;
}

.empty-state {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
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
    border-radius: 12px;
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

.invite-link-container {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
}

.invite-link-container input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    background: #f8f9fa;
}

.copy-btn {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background 0.2s ease;
}

.copy-btn:hover {
    background: #5a6fd8;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .dashboard-container {
        padding: 1rem;
    }
    
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .quick-actions {
        grid-template-columns: 1fr;
    }
    
    .activity-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
    }
}
</style>

<script>
function startDirectMessage(userId) {
    // Redirect to chat with user parameter
    window.location.href = `chat.php?user=${userId}`;
}

function showInviteDialog() {
    document.getElementById('inviteDialog').style.display = 'flex';
}

function closeInviteDialog() {
    document.getElementById('inviteDialog').style.display = 'none';
}

function copyInviteLink() {
    const linkInput = document.getElementById('inviteLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // For mobile
    
    try {
        document.execCommand('copy');
        
        const copyBtn = document.querySelector('.copy-btn');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy link:', err);
        alert('Failed to copy link. Please copy manually.');
    }
}

// Auto-refresh online users every 30 seconds
setInterval(async function() {
    try {
        const response = await fetch('api/users.php?action=get_online');
        const result = await response.json();
        
        if (result.success) {
            updateOnlineUsers(result.users);
        }
    } catch (error) {
        console.error('Failed to refresh online users:', error);
    }
}, 30000);

function updateOnlineUsers(users) {
    const usersList = document.querySelector('.users-list');
    const currentUserId = <?php echo $currentUser['id']; ?>;
    
    const onlineUsers = users.filter(user => user.id !== currentUserId);
    
    if (onlineUsers.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <p>No users online right now</p>
            </div>
        `;
    } else {
        usersList.innerHTML = onlineUsers.map(user => `
            <div class="user-item">
                <img src="${user.avatar || 'assets/images/default-avatar.png'}" 
                     alt="${user.display_name || user.username}" 
                     class="user-avatar">
                <div class="user-info">
                    <div class="user-name">${user.display_name || user.username}</div>
                    <div class="user-status">
                        <span class="status-dot online"></span>
                        Online
                    </div>
                </div>
                <button onclick="startDirectMessage(${user.id})" class="chat-btn">
                    <i class="fas fa-comment"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Update online count
    document.querySelector('.online-count').textContent = `${onlineUsers.length} online`;
}
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
