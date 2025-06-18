<?php
$pageTitle = 'Chat - Quick Chat';
$pageClass = 'modern-chat-page';
$additionalCSS = ['assets/css/modern-chat.css'];
$additionalJS = ['assets/js/modern-chat.js', 'assets/js/emoji.js'];

// Require authentication
require_once __DIR__ . '/includes/auth_check.php';
$currentUser = AuthChecker::requireAuth();

// Get target user for direct messaging if specified
$targetUserId = isset($_GET['user']) ? (int)$_GET['user'] : null;
$targetUser = null;

if ($targetUserId) {
    require_once __DIR__ . '/classes/User.php';
    $userClass = new User();
    $targetUser = $userClass->getUserById($targetUserId);
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
    <link href="assets/css/modern-chat.css" rel="stylesheet">
    <link href="assets/css/group-chat.css" rel="stylesheet">
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
                    <button class="action-btn" onclick="chatApp.showNewGroupModal()">
                        <i class="fas fa-users"></i>
                    </button>
                    <button class="action-btn" onclick="showNewChatModal()" title="New Chat">
                        <i class="fas fa-plus"></i>
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
                    <span>Chats</span>
                </button>
                <button class="nav-btn" data-tab="contacts">
                    <i class="fas fa-users"></i>
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
                            <!-- Chat list will be loaded here -->
                        </div>
                    </div>
                    <div class="section">
                        <div class="group-header">
                            <h4 class="section-title">Group Chats</h4>
                            <button class="create-group-btn" onclick="chatApp.showNewGroupModal()">
                                <i class="fas fa-plus"></i> New
                            </button>
                        </div>
                        <div class="group-list" id="groupList">
                            <!-- Group list will be loaded here -->
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
                            <label>
                                <input type="checkbox" id="notificationsEnabled">
                                <span>Enable notifications</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" id="soundEnabled">
                                <span>Sound notifications</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <select id="themeSelect">
                                    <option value="light">Light Theme</option>
                                    <option value="dark">Dark Theme</option>
                                    <option value="auto">Auto</option>
                                </select>
                                <span>Theme</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Main Chat Area -->
        <main class="chat-main">
            <div class="chat-container" id="chatContainer">
                <?php if ($targetUser): ?>
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
                            <h2><?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?></h2>
                            <span class="status-text" id="userStatus">
                                <?php echo $targetUser['is_online'] ? 'Online' : 'Last seen ' . date('M j, g:i A', strtotime($targetUser['last_seen'])); ?>
                            </span>
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
                <?php else: ?>
                <!-- General Chat Interface -->
                <header class="chat-header">
                    <div class="chat-info">
                        <button class="mobile-back-btn" onclick="showSidebar()">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div class="chat-avatar">
                            <div class="group-avatar">
                                <i class="fas fa-users"></i>
                            </div>
                        </div>
                        <div class="chat-details">
                            <h2>General Chat</h2>
                            <span class="status-text" id="participantCount">Loading...</span>
                        </div>
                    </div>
                    <div class="chat-actions">
                        <button class="action-btn" onclick="toggleNotifications()" title="Notifications">
                            <i class="fas fa-bell" id="notificationIcon"></i>
                        </button>
                        <button class="action-btn" onclick="showChatInfo()" title="Chat info">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </header>
                <?php endif; ?>

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
                    <form class="message-form" id="messageForm">
                        <div class="input-actions">
                            <button type="button" class="action-btn" onclick="toggleEmojiPicker()" title="Emoji">
                                <i class="fas fa-smile"></i>
                            </button>
                            <button type="button" class="action-btn" onclick="showAttachMenu()" title="Attach">
                                <i class="fas fa-paperclip"></i>
                            </button>
                        </div>
                        <div class="input-wrapper">
                            <textarea id="messageInput" 
                                    placeholder="Type a message..." 
                                    rows="1" 
                                    autocomplete="off"
                                    oninput="window.handleInput(event)"></textarea>
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
                            <i class="fas fa-image"></i>
                            <span>Photo</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('video')">
                            <i class="fas fa-video"></i>
                            <span>Video</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('audio')">
                            <i class="fas fa-microphone"></i>
                            <span>Audio</span>
                        </button>
                        <button class="attach-option" onclick="selectFile('file')">
                            <i class="fas fa-file"></i>
                            <span>Document</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Welcome Screen -->
            <div class="welcome-screen" id="welcomeScreen">
                <div class="welcome-content">
                    <div class="welcome-icon">
                        <i class="fas fa-comments"></i>
                    </div>
                    <h2>Welcome to Quick Chat</h2>
                    <p>Select a conversation to start chatting</p>
                    <button class="primary-btn" onclick="showNewChatModal()">
                        <i class="fas fa-plus"></i>
                        Start New Chat
                    </button>
                </div>
            </div>

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
                            <div class="avatar-preview" id="groupInfoAvatar">
                                <img src="assets/images/default-group.svg" alt="Group Avatar">
                            </div>
                        </div>
                        <h2 id="groupInfoName" class="text-center">Group Name</h2>
                        <div class="text-center text-muted" id="groupInfoMeta">
                            <span id="groupInfoMemberCount">0 members</span> • 
                            <span id="groupInfoCreatedAt">Created June 18, 2025</span>
                        </div>
                    </div>

                    <div class="group-info-section">
                        <h4 class="group-info-section-title">Description</h4>
                        <p class="group-description" id="groupInfoDescription">
                            No description available.
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
                            <button class="group-action-btn" id="inviteToGroupBtn">
                                <i class="fas fa-user-plus"></i> Invite People
                            </button>
                            <button class="group-action-btn" id="leaveGroupBtn">
                                <i class="fas fa-sign-out-alt"></i> Leave Group
                            </button>
                            <button class="group-action-btn danger" id="deleteGroupBtn">
                                <i class="fas fa-trash-alt"></i> Delete Group
                            </button>
                        </div>
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
                            <option value="0">Private</option>
                            <option value="1">Public</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Group Avatar</label>
                        <div class="avatar-upload">
                            <input type="file" id="groupAvatarInput" accept="image/*" style="display: none;">
                            <div class="avatar-preview" id="groupAvatarPreview">
                                <i class="fas fa-users"></i>
                            </div>
                            <button type="button" class="upload-btn" onclick="document.getElementById('groupAvatarInput').click()">
                                <i class="fas fa-camera"></i> Upload Image
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Add Members</label>
                        <div class="member-search">
                            <input type="text" id="memberSearch" placeholder="Search users...">
                        </div>
                        <div class="selected-members" id="selectedMembers">
                            <!-- Selected members will be shown here -->
                        </div>
                        <div class="member-results" id="memberSearchResults">
                            <!-- Search results will be loaded here -->
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
                    <strong>Group Name</strong>
                </div>
                
                <div class="form-group">
                    <label>Share Invite Link</label>
                    <div class="invite-link-container">
                        <input type="text" id="inviteLinkInput" readonly>
                        <button class="copy-link-btn" onclick="copyInviteLink()">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Or Invite Specific People</label>
                    <div class="member-search">
                        <input type="text" id="inviteUserSearch" placeholder="Search users...">
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

    <!-- Scripts -->
    <meta name="csrf-token" content="<?php 
        require_once __DIR__ . '/classes/Security.php';
        $security = new Security();
        echo $security->generateCSRF();
    ?>">
    <script src="assets/js/emoji.js"></script>
    <script src="assets/js/modern-chat.js"></script>
    <script>
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize chat app
            const chatApp = new ModernChatApp({
                currentUserId: <?php echo $currentUser['id']; ?>,
                targetUserId: <?php echo $targetUserId ?? 'null'; ?>,
                apiBase: 'api/',
                csrfToken: document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            });
            
            // Make chatApp globally available
            window.chatApp = chatApp;

            // Setup event listeners for the new group modal
            const newGroupModal = document.getElementById('newGroupModal');
            const createGroupBtn = document.getElementById('createGroupBtn');
            
            if (createGroupBtn) {
                createGroupBtn.addEventListener('click', async function() {
                    try {
                        // Get form values
                        const name = document.getElementById('groupName').value.trim();
                        const description = document.getElementById('groupDescription').value.trim();
                        const isPublic = document.getElementById('groupVisibility').value === '1';
                        
                        if (!name) {
                            alert('Group name is required');
                            return;
                        }
                        
                        console.log('Creating group with data:', {
                            name, 
                            description, 
                            isPublic
                        });
                        
                        // Create the group
                        const formData = new FormData();
                        formData.append('action', 'create');
                        formData.append('name', name);
                        formData.append('description', description);
                        formData.append('is_public', isPublic ? '1' : '0');
                        formData.append('csrf_token', chatApp.getCSRFToken());
                        
                        // Add group avatar if selected
                        const avatarInput = document.getElementById('groupAvatarInput');
                        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
                            formData.append('avatar', avatarInput.files[0]);
                        }
                        
                        const response = await fetch('api/groups.php', {
                            method: 'POST',
                            body: formData,
                            credentials: 'same-origin'
                        });
                        
                        const data = await response.json();
                        
                        if (!data.success) {
                            throw new Error(data.error || 'Failed to create group');
                        }
                        
                        alert('Group created successfully!');
                        
                        // Close the modal
                        if (newGroupModal) {
                            newGroupModal.style.display = 'none';
                        }
                        
                        // Reload the page to see the new group
                        window.location.reload();
                        
                    } catch (error) {
                        console.error('Error creating group:', error);
                        alert('Failed to create group: ' + error.message);
                    }
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
            
            window.showChatInfo = function() {
                console.log('Show chat info clicked');
                // Implement chat info functionality
            };
            
            window.toggleNotifications = function() {
                console.log('Toggle notifications clicked');
                // Implement notification toggle functionality
            };
            
            window.showSidebar = function() {
                console.log('Show sidebar clicked');
                // Implement sidebar show functionality
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
                    if (window.chatApp && typeof window.chatApp.closeModal === 'function') {
                        window.chatApp.closeModal();
                    }
                }
            };
            
            window.showNewChatModal = function() {
                if (window.chatApp && typeof window.chatApp.showNewChatModal === 'function') {
                    window.chatApp.showNewChatModal();
                } else {
                    console.error('showNewChatModal function not available on chatApp');
                }
            };
            
            window.showNewGroupModal = function() {
                if (window.chatApp && typeof window.chatApp.showNewGroupModal === 'function') {
                    window.chatApp.showNewGroupModal();
                } else {
                    const modal = document.getElementById('newGroupModal');
                    if (modal) {
                        modal.style.display = 'flex';
                    } else {
                        console.error('New group modal element not found');
                    }
                }
            };
            
            window.closeNewGroupModal = function() {
                const modal = document.getElementById('newGroupModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            };
            
            window.createNewGroup = function() {
                if (window.chatApp && typeof window.chatApp.createNewGroup === 'function') {
                    window.chatApp.createNewGroup();
                }
            };
            
            window.toggleGroupInfo = function() {
                if (window.chatApp && typeof window.chatApp.toggleGroupInfo === 'function') {
                    window.chatApp.toggleGroupInfo();
                }
            };
            
            window.closeGroupInviteModal = function() {
                if (window.chatApp && typeof window.chatApp.closeGroupInviteModal === 'function') {
                    window.chatApp.closeGroupInviteModal();
                }
            };
            
            window.copyInviteLink = function() {
                if (window.chatApp && typeof window.chatApp.copyInviteLink === 'function') {
                    window.chatApp.copyInviteLink();
                }
            };
            
            window.sendGroupInvites = function() {
                if (window.chatApp && typeof window.chatApp.sendGroupInvites === 'function') {
                    window.chatApp.sendGroupInvites();
                }
            };
            
            // Start the app
            chatApp.init().then(() => {
                console.log('Chat app fully initialized');
            }).catch((error) => {
                console.error('Failed to initialize chat app:', error);
            });
        });
    </script>
</body>
</html>
