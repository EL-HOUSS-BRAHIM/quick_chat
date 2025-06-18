<?php
$pageTitle = 'Private Chat - Quick Chat';
$pageClass = 'modern-chat-page private-chat-page';
$additionalCSS = ['assets/css/modern-chat.css', 'assets/css/message-reactions.css'];
$additionalJS = ['assets/js/modern-chat.js', 'assets/js/emoji.js', 'assets/js/message-reactions.js', 'assets/js/private-chat.js', 'assets/js/chat-extensions.js', 'assets/js/chat-fix.js'];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Get target user for direct messaging
$targetUserId = isset($_GET['user']) ? (int)$_GET['user'] : null;
$targetUser = null;

if ($targetUserId) {
    require_once __DIR__ . '/classes/User.php';
    $userClass = new User();
    $targetUser = $userClass->getUserById($targetUserId);
    
    // If user not found, redirect to dashboard
    if (!$targetUser) {
        header('Location: dashboard.php');
        exit;
    }
} else {
    // Must specify a user for private chat
    header('Location: dashboard.php');
    exit;
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
                    <button class="action-btn" onclick="window.location.href='group-chat.php'">
                        <i class="fas fa-users"></i>
                    </button>
                    <button class="action-btn" onclick="showNewChatModal()" title="New Chat">
                        <i class="fas fa-plus"></i>
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
                    <input type="text" id="searchInput" placeholder="Search conversations..." autocomplete="off">
                </div>
            </div>

            <div class="sidebar-nav">
                <button class="nav-btn active" data-tab="chats">
                    <i class="fas fa-comments"></i>
                    <span>Private Chats</span>
                </button>
                <button class="nav-btn" data-tab="contacts">
                    <i class="fas fa-address-book"></i>
                    <span>Contacts</span>
                </button>
                <button class="nav-btn" data-tab="settings">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </button>
            </div>

            <div class="sidebar-content">
                <div class="tab-content active" id="chatsTab">
                    <div class="section">
                        <h4 class="section-title">Online Now</h4>
                        <div class="online-users" id="onlineUsers">
                            <!-- Online users will be loaded here -->
                        </div>
                    </div>
                    <div class="section">
                        <h4 class="section-title">Recent Chats</h4>
                        <div class="chat-list" id="chatList">
                            <!-- Recent chats will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <div class="tab-content" id="contactsTab">
                    <div class="contact-list" id="contactList">
                        <!-- Contacts will be loaded here -->
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
            <div class="chat-container" id="chatContainer">
                <!-- Direct Message Interface -->
                <header class="chat-header">
                    <div class="chat-info">
                        <button class="mobile-back-btn" onclick="showSidebar()">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="chat-avatar">
                            <img src="<?php echo htmlspecialchars($targetUser['avatar'] ?? 'assets/images/default-avatar.svg'); ?>" 
                                 alt="<?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?>">
                            <div class="status-indicator <?php echo $targetUser['is_online'] ? 'online' : 'offline'; ?>"></div>
                        </div>
                        <div class="chat-details">
                            <h3><?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?></h3>
                            <span class="status-text"><?php echo $targetUser['is_online'] ? 'Online' : 'Last seen ' . date('M j, g:i A', strtotime($targetUser['last_seen'])); ?></span>
                        </div>
                    </div>
                    <div class="chat-actions">
                        <button class="action-btn" onclick="startCall('audio')" title="Voice call">
                            <i class="fas fa-phone"></i>
                        </button>
                        <button class="action-btn" onclick="startCall('video')" title="Video call">
                            <i class="fas fa-video"></i>
                        </button>
                        <button class="action-btn" onclick="showChatInfo()" title="Chat info">
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
                        <span class="typing-text"><?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?> is typing...</span>
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
        </main>
    </div>

    <!-- Hidden file input -->
    <input type="file" id="fileInput" style="display: none;" multiple>

    <!-- Modals -->
    <div class="modal" id="newChatModal" onclick="closeModal(event)">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Start New Chat</h3>
                <button class="close-btn" onclick="closeNewChatModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="search-container">
                    <i class="fas fa-search"></i>
                    <input type="text" id="userSearchInput" placeholder="Search users..." autocomplete="off">
                </div>
                <div class="user-list" id="userSearchResults">
                    <!-- Search results will be loaded here -->
                </div>
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
            // Initialize chat app for private chat
            const chatApp = new ModernChatApp({
                currentUserId: <?php echo $currentUser['id']; ?>,
                targetUserId: <?php echo $targetUserId; ?>,
                apiBase: 'api/',
                chatType: 'private',
                csrfToken: document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            });
            
            // Make chatApp globally available
            window.chatApp = chatApp;
            
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
            
            window.showChatInfo = function() {
                console.log('Show chat info clicked');
                // Implement chat info functionality
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
            
            window.startCall = function(type) {
                console.log('Start call clicked:', type);
                // Implement call functionality
                if (window.chatApp && typeof window.chatApp.startCall === 'function') {
                    window.chatApp.startCall(type);
                }
            };
            
            window.closeNewChatModal = function() {
                if (window.chatApp && typeof window.chatApp.closeNewChatModal === 'function') {
                    window.chatApp.closeNewChatModal();
                }
            };
            
            window.closeModal = function(event) {
                if (event && event.target.classList.contains('modal')) {
                    event.target.style.display = 'none';
                }
            };
            
            window.showNewChatModal = function() {
                if (window.chatApp && typeof window.chatApp.showNewChatModal === 'function') {
                    window.chatApp.showNewChatModal();
                } else {
                    console.error('showNewChatModal function not available on chatApp');
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
                console.log('Private chat app fully initialized');
            }).catch((error) => {
                console.error('Failed to initialize private chat app:', error);
            });
        });
    </script>
</body>
</html>
