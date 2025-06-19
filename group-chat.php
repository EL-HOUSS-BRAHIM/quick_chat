<?php
$pageTitle = 'Group Chat - Quick Chat';
$pageClass = 'modern-chat-page group-chat-page';
$additionalCSS = ['assets/css/modern-chat.css', 'assets/css/message-reactions.css', 'assets/css/group-chat.css'];

// NOTE: We're still including these legacy files for compatibility during migration.
// They will eventually be fully replaced by the modular system loaded by module-loader.js
$additionalJS = ['assets/js/modern-chat.js', 'assets/js/emoji.js', 'assets/js/message-reactions.js', 'assets/js/group-chat.js', 'assets/js/chat-compatibility.js'];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Get group ID if specified
$groupId = isset($_GET['group']) ? (int)$_GET['group'] : null;
$group = null;

// If group ID is specified, load group details
if ($groupId) {
    require_once __DIR__ . '/classes/Database.php';
    $db = Database::getInstance();
    $connection = $db->getConnection();
    
    // Get group details
    $stmt = $connection->prepare("
        SELECT g.*, 
               gm.role, 
               COUNT(DISTINCT members.id) as member_count
        FROM `groups` g
        LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = :user_id
        LEFT JOIN group_members members ON g.id = members.group_id AND members.left_at IS NULL
        WHERE g.id = :group_id
        GROUP BY g.id
    ");
    
    $stmt->execute([
        'user_id' => $currentUser['id'],
        'group_id' => $groupId
    ]);
    
    $group = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // If group not found or user is not a member, redirect to dashboard
    if (!$group || !$group['role']) {
        header('Location: dashboard.php');
        exit;
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $pageTitle; ?></title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <?php foreach ($additionalCSS as $css): ?>
    <link href="<?php echo $css; ?>" rel="stylesheet">
    <?php endforeach; ?>
</head>
<body class="<?php echo $pageClass; ?>">
    <div class="chat-app" id="chatApp">
        <!-- Sidebar -->
        <aside class="chat-sidebar">
            <div class="sidebar-header">
                <div class="user-profile">
                    <div class="profile-avatar">
                        <img src="<?php echo htmlspecialchars($currentUser['avatar'] ?? 'assets/images/default-avatar.svg'); ?>" 
                             alt="Your avatar">
                        <div class="status-indicator online"></div>
                    </div>
                    <div class="profile-info">
                        <h3><?php echo htmlspecialchars($currentUser['display_name'] ?? $currentUser['username']); ?></h3>
                        <span class="status-text">Online</span>
                    </div>
                </div>
                <div class="header-actions">
                    <button class="action-btn" onclick="window.location.href='private-chat.php'">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="action-btn" onclick="chatApp.showNewGroupModal()">
                        <i class="fas fa-users-plus"></i>
                    </button>
                    <button class="action-btn" onclick="window.location.href='dashboard.php'">
                        <i class="fas fa-home"></i>
                    </button>
                    <button class="action-btn" onclick="showSettings()" title="Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="action-btn" onclick="logout()" title="Logout">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>

            <div class="sidebar-search">
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="searchInput" placeholder="Search groups..." autocomplete="off">
                </div>
            </div>

            <div class="sidebar-nav">
                <button class="nav-btn active" data-tab="groups">
                    <i class="fas fa-users"></i>
                    <span>My Groups</span>
                </button>
                <button class="nav-btn" data-tab="public">
                    <i class="fas fa-globe"></i>
                    <span>Public Groups</span>
                </button>
                <button class="nav-btn" data-tab="settings">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </button>
            </div>

            <div class="sidebar-content">
                <div class="tab-content active" id="groupsTab">
                    <div class="section">
                        <h4 class="section-title">My Groups</h4>
                        <div class="group-list" id="myGroupsList">
                            <!-- User's groups will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="publicTab">
                    <div class="section">
                        <h4 class="section-title">Public Groups</h4>
                        <div class="group-list" id="publicGroupsList">
                            <!-- Public groups will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="settingsTab">
                    <div class="settings-panel">
                        <div class="setting-item">
                            <h4>Notifications</h4>
                            <label class="toggle">
                                <input type="checkbox" id="notificationToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <h4>Sound Effects</h4>
                            <label class="toggle">
                                <input type="checkbox" id="soundToggle" checked>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <h4>Theme</h4>
                            <select id="themeSelect">
                                <option value="light">Light</option>
                                <option value="dark" selected>Dark</option>
                                <option value="system">System</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Chat Area -->
        <main class="chat-main">
            <?php if ($group): ?>
            <div class="chat-container" id="chatContainer">
                <!-- Group Chat Interface -->
                <header class="chat-header">
                    <div class="chat-info">
                        <button class="mobile-back-btn" onclick="showSidebar()">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="chat-avatar">
                            <img src="<?php echo htmlspecialchars($group['avatar'] ?? 'assets/images/default-group.svg'); ?>" 
                                 alt="<?php echo htmlspecialchars($group['name']); ?>">
                        </div>
                        <div class="chat-details">
                            <h3><?php echo htmlspecialchars($group['name']); ?></h3>
                            <span class="status-text"><?php echo $group['member_count']; ?> members</span>
                        </div>
                    </div>
                    <div class="chat-actions">
                        <button class="action-btn" onclick="toggleNotifications()" title="Notifications">
                            <i class="fas fa-bell"></i>
                        </button>
                        <button class="action-btn" onclick="chatApp.toggleGroupInfo()" title="Group info">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </header>

                <!-- Messages Area -->
                <div class="messages-container" id="messagesContainer">
                    <div class="messages-list" id="messagesList">
                        <!-- Messages will be loaded here -->
                    </div>
                    <div class="typing-indicator" id="typingIndicator" style="display: none;">
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <span class="typing-text">Someone is typing...</span>
                    </div>
                </div>

                <!-- Message Input -->
                <div class="message-input-container">
                    <!-- Reply Container -->
                    <div id="replyContainer" class="reply-container" style="display: none;"></div>
                    
                    <form class="message-form" id="messageForm">
                        <div class="input-actions">
                            <button type="button" class="action-btn" id="attachBtn" title="Attach files">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <button type="button" class="action-btn" id="emojiBtn" title="Insert emoji">
                                <i class="far fa-smile"></i>
                            </button>
                        </div>
                        <div class="input-wrapper">
                            <textarea id="messageInput" 
                                      placeholder="Type a message..." 
                                      onkeydown="handleKeyDown(event)" 
                                      oninput="handleInput(event)"></textarea>
                        </div>
                        <button type="submit" class="send-btn" id="sendBtn" disabled>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </form>
                    
                    <!-- Emoji Picker -->
                    <div class="emoji-picker" id="emojiPicker" style="display: none;">
                        <!-- Emoji picker will be rendered here -->
                    </div>
                    
                    <!-- Attachment Menu -->
                    <div class="attach-menu" id="attachMenu" style="display: none;">
                        <button class="attach-option" onclick="selectFile('image')">
                            <i class="far fa-image"></i>
                            <span>Image</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('video')">
                            <i class="fas fa-video"></i>
                            <span>Video</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('audio')">
                            <i class="fas fa-music"></i>
                            <span>Audio</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('file')">
                            <i class="fas fa-file"></i>
                            <span>File</span>
                        </button>
                    </div>
                </div>
            </div>
            <?php else: ?>
            <!-- Welcome Screen -->
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-content">
                    <div class="welcome-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <h2>Welcome to Group Chat</h2>
                    <p>Select a group from the sidebar or create a new one</p>
                    <button class="primary-btn" onclick="chatApp.showNewGroupModal()">
                        <i class="fas fa-plus"></i>
                        Create New Group
                    </button>
                </div>
            </div>
            <?php endif; ?>

            <!-- Group Info Sidebar -->
            <div class="group-info-sidebar" id="groupInfoSidebar">
                <div class="group-info-header">
                    <h3 class="group-info-title">Group Info</h3>
                    <button class="close-info-btn" onclick="chatApp.toggleGroupInfo()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="group-info-content">
                    <div class="group-info-section">
                        <div class="avatar-upload">
                            <img src="<?php echo htmlspecialchars($group['avatar'] ?? 'assets/images/default-group.svg'); ?>" 
                                 alt="Group avatar" id="groupInfoAvatar">
                            <?php if ($group && ($group['role'] === 'admin' || $group['role'] === 'moderator')): ?>
                            <button class="upload-btn" onclick="chatApp.uploadGroupAvatar()">
                                <i class="fas fa-camera"></i>
                            </button>
                            <?php endif; ?>
                        </div>
                        <h2 id="groupInfoName" class="text-center"><?php echo htmlspecialchars($group['name'] ?? 'Group Name'); ?></h2>
                        <div class="text-center text-muted" id="groupInfoMeta">
                            <?php if ($group): ?>
                            <span><?php echo $group['member_count']; ?> members</span> • 
                            <span><?php echo $group['is_public'] ? 'Public' : 'Private'; ?></span>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="group-info-section">
                        <h4 class="group-info-section-title">Description</h4>
                        <p class="group-description" id="groupInfoDescription">
                            <?php echo htmlspecialchars($group['description'] ?? 'No description available.'); ?>
                        </p>
                    </div>

                    <div class="group-info-section">
                        <h4 class="group-info-section-title">Members</h4>
                        <div class="group-members-list" id="groupInfoMembers">
                            <!-- Group members will be loaded here -->
                        </div>
                    </div>

                    <div class="group-info-section">
                        <h4 class="group-info-section-title">Actions</h4>
                        <div class="group-actions">
                            <?php if ($group && ($group['role'] === 'admin' || $group['role'] === 'moderator')): ?>
                            <button class="action-btn" onclick="chatApp.showGroupInviteModal()">
                                <i class="fas fa-user-plus"></i>
                                <span>Invite Members</span>
                            </button>
                            <?php endif; ?>
                            <?php if ($group && $group['role'] === 'admin'): ?>
                            <button class="action-btn" onclick="chatApp.editGroupSettings()">
                                <i class="fas fa-edit"></i>
                                <span>Edit Group</span>
                            </button>
                            <?php endif; ?>
                            <button class="action-btn danger" onclick="chatApp.leaveGroup()">
                                <i class="fas fa-sign-out-alt"></i>
                                <span>Leave Group</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Hidden file input -->
    <input type="file" id="fileInput" style="display: none;" multiple>

    <!-- New Group Modal -->
    <div class="modal" id="newGroupModal" onclick="closeModal(event)">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create New Group</h3>
                <button class="close-btn" onclick="closeNewGroupModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="newGroupForm">
                    <div class="form-group">
                        <label for="groupName">Group Name</label>
                        <input type="text" id="groupName" name="groupName" required placeholder="Enter group name">
                    </div>
                    <div class="form-group">
                        <label for="groupDescription">Description</label>
                        <textarea id="groupDescription" name="groupDescription" rows="3" placeholder="Enter group description"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="groupVisibility">Visibility</label>
                        <select id="groupVisibility" name="groupVisibility">
                            <option value="private">Private - Only invited members can join</option>
                            <option value="public">Public - Anyone can find and join</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Initial Members</label>
                        <div class="selected-members" id="selectedMembers"></div>
                        <div class="member-search">
                            <input type="text" id="memberSearchInput" placeholder="Search users to add...">
                            <div class="member-results" id="memberSearchResults"></div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="secondary-btn" onclick="closeNewGroupModal()">Cancel</button>
                <button type="button" class="primary-btn" id="createGroupBtn">Create Group</button>
            </div>
        </div>
    </div>

    <!-- Group Invite Modal -->
    <div class="modal" id="groupInviteModal" onclick="closeModal(event)">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Invite to Group</h3>
                <button class="close-btn" onclick="closeGroupInviteModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="inviteGroupName" class="mb-3 text-center">
                    <strong><?php echo htmlspecialchars($group['name'] ?? 'Group'); ?></strong>
                </div>
                
                <div class="form-group">
                    <label>Share Invite Link</label>
                    <div class="invite-link-container">
                        <input type="text" id="inviteLink" readonly>
                        <button class="copy-btn" onclick="copyInviteLink()" title="Copy link">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Or Invite Specific People</label>
                    <div class="member-search">
                        <input type="text" id="inviteSearchInput" placeholder="Search users to invite...">
                    </div>
                    <div class="member-results" id="inviteUserResults">
                        <!-- Search results will be loaded here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="closeGroupInviteModal()">Cancel</button>
                <button class="primary-btn" onclick="sendGroupInvites()">Send Invites</button>
            </div>
        </div>
    </div>

    <!-- Reaction Picker -->
    <div id="reactionPicker" class="reaction-picker" style="display:none">
        <div class="reaction-picker-content">
            <div class="popular-reactions">
                <button class="reaction-btn" onclick="chatApp.addReaction('👍')">👍</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('❤️')">❤️</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('😂')">😂</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('😮')">😮</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('😢')">😢</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('😡')">😡</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('👏')">👏</button>
                <button class="reaction-btn" onclick="chatApp.addReaction('🎉')">🎉</button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <meta name="csrf-token" content="<?php 
        require_once __DIR__ . '/classes/Security.php';
        $security = new Security();
        echo $security->generateCSRF();
    ?>">
    <?php foreach ($additionalJS as $js): ?>
    <script src="<?php echo $js; ?>"></script>
    <?php endforeach; ?>
    <script>
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize chat app for group chat
            const chatApp = new ModernChatApp({
                currentUserId: <?php echo $currentUser['id']; ?>,
                groupId: <?php echo $groupId ?? 'null'; ?>,
                apiBase: 'api/',
                chatType: 'group',
                csrfToken: document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            });
            
            // Make chatApp globally available
            window.chatApp = chatApp;
            
            // Setup event listeners for the new group modal
            const createGroupBtn = document.getElementById('createGroupBtn');
            if (createGroupBtn) {
                createGroupBtn.addEventListener('click', function() {
                    chatApp.createNewGroup();
                });
            }
            
            // Define global functions for inline event handlers
            window.handleKeyDown = function(event) {
                if (window.chatApp && typeof window.chatApp.handleKeyDown === 'function') {
                    window.chatApp.handleKeyDown(event);
                }
            };
            
            window.handleInput = function(event) {
                if (window.chatApp && typeof window.chatApp.handleInputChange === 'function') {
                    window.chatApp.handleInputChange(event);
                }
            };
            
            window.toggleNotifications = function() {
                console.log('Toggle notifications clicked');
                // Implement notification toggle functionality
            };
            
            window.showSidebar = function() {
                const sidebar = document.querySelector('.chat-sidebar');
                if (sidebar) {
                    sidebar.classList.add('visible');
                }
            };
            
            window.selectFile = function(type) {
                console.log('Select file clicked:', type);
                const fileInput = document.getElementById('fileInput');
                if (fileInput) {
                    fileInput.click();
                }
            };
            
            window.closeModal = function(event) {
                if (event && event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            };
            
            window.closeNewGroupModal = function() {
                const modal = document.getElementById('newGroupModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            };
            
            window.closeGroupInviteModal = function() {
                if (window.chatApp && typeof window.chatApp.closeGroupInviteModal === 'function') {
                    window.chatApp.closeGroupInviteModal();
                } else {
                    const modal = document.getElementById('groupInviteModal');
                    if (modal) {
                        modal.style.display = 'none';
                    }
                }
            };
            
            window.copyInviteLink = function() {
                const inviteLink = document.getElementById('inviteLink');
                if (inviteLink) {
                    inviteLink.select();
                    document.execCommand('copy');
                    alert('Invite link copied to clipboard!');
                }
            };
            
            window.sendGroupInvites = function() {
                if (window.chatApp && typeof window.chatApp.sendGroupInvites === 'function') {
                    window.chatApp.sendGroupInvites();
                }
            };
            
            window.showSettings = function() {
                const settingsTab = document.querySelector('[data-tab="settings"]');
                if (settingsTab) {
                    const activeBtn = document.querySelector('.nav-btn.active');
                    if (activeBtn) {
                        activeBtn.classList.remove('active');
                    }
                    settingsTab.classList.add('active');
                    
                    const activeTabContent = document.querySelector('.tab-content.active');
                    if (activeTabContent) {
                        activeTabContent.classList.remove('active');
                    }
                    
                    const settingsTabContent = document.getElementById('settingsTab');
                    if (settingsTabContent) {
                        settingsTabContent.classList.add('active');
                    }
                }
            };
            
            window.logout = function() {
                if (confirm('Are you sure you want to log out?')) {
                    window.location.href = 'auth.php?action=logout';
                }
            };
            
            // Set up navigation tabs
            const navButtons = document.querySelectorAll('.nav-btn');
            navButtons.forEach(button => {
                button.addEventListener('click', function() {
                    const tabName = this.dataset.tab;
                    
                    // Update active button
                    navButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Update active tab content
                    const tabContents = document.querySelectorAll('.tab-content');
                    tabContents.forEach(tab => tab.classList.remove('active'));
                    document.getElementById(tabName + 'Tab').classList.add('active');
                });
            });
            
            // Start the app
            chatApp.init().then(() => {
                console.log('Group chat app fully initialized');
            }).catch((error) => {
                console.error('Failed to initialize group chat app:', error);
            });
        });
    </script>
    
    <!-- Load Module Loader for new architecture -->
    <script src="assets/js/module-loader.js"></script>
    
    <!-- Legacy script inclusion for backward compatibility during migration -->
    <?php foreach ($additionalJS as $js): ?>
    <script src="<?php echo $js; ?>"></script>
    <?php endforeach; ?>
</body>
</html>
