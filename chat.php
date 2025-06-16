<?php
$pageTitle = 'Chat - Quick Chat';
$pageClass = 'chat-page';
$additionalCSS = [];
$additionalJS = ['assets/js/chat.js', 'assets/js/emoji.js', 'assets/js/webrtc.js'];

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

include __DIR__ . '/includes/header.php';
?>

<div class="chat-container">
    <!-- Chat Sidebar -->
    <div class="chat-sidebar">
        <div class="sidebar-header">
            <h3>
                <i class="fas fa-comments"></i>
                Conversations
            </h3>
            <button class="new-chat-btn" onclick="showNewChatDialog()">
                <i class="fas fa-plus"></i>
            </button>
        </div>
        
        <div class="search-container">
            <div class="search-input">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search users..." id="userSearch">
            </div>
        </div>
        
        <div class="online-users">
            <h4>Online Users</h4>
            <div id="onlineUsersList" class="users-list">
                <!-- Online users will be loaded here -->
            </div>
        </div>
        
        <div class="recent-chats">
            <h4>Recent Chats</h4>
            <div id="recentChatsList" class="chats-list">
                <!-- Recent chats will be loaded here -->
            </div>
        </div>
    </div>
    
    <!-- Chat Main Area -->
    <div class="chat-main">
        <?php if ($targetUser): ?>
        <!-- Direct Message Interface -->
        <div class="chat-header">
            <div class="chat-user-info">
                <img src="<?php echo htmlspecialchars($targetUser['avatar'] ?? 'assets/images/default-avatar.png'); ?>" 
                     alt="<?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?>" 
                     class="user-avatar">
                <div class="user-details">
                    <h3><?php echo htmlspecialchars($targetUser['display_name'] ?? $targetUser['username']); ?></h3>
                    <span class="user-status" id="userStatus">
                        <span class="status-dot <?php echo $targetUser['is_online'] ? 'online' : 'offline'; ?>"></span>
                        <?php echo $targetUser['is_online'] ? 'Online' : 'Last seen ' . date('M j, g:i A', strtotime($targetUser['last_seen'])); ?>
                    </span>
                </div>
            </div>
            <div class="chat-actions">
                <button class="action-btn" onclick="toggleAudioCall()" title="Audio Call">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="action-btn" onclick="toggleVideoCall()" title="Video Call">
                    <i class="fas fa-video"></i>
                </button>
                <button class="action-btn" onclick="showChatInfo()" title="Chat Info">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
        </div>
        <?php else: ?>
        <!-- General Chat Interface -->
        <div class="chat-header">
            <div class="chat-info">
                <h3>
                    <i class="fas fa-comments"></i>
                    General Chat
                </h3>
                <span class="chat-description">Public chat room for all users</span>
            </div>
            <div class="chat-actions">
                <button class="action-btn" onclick="toggleNotifications()" title="Toggle Notifications">
                    <i class="fas fa-bell" id="notificationIcon"></i>
                </button>
                <button class="action-btn" onclick="showChatSettings()" title="Chat Settings">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
        </div>
        <?php endif; ?>
        
        <!-- Messages Area -->
        <div class="messages-container" id="messagesContainer">
            <div class="messages-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading messages...</p>
            </div>
        </div>
        
        <!-- Typing Indicator -->
        <div class="typing-indicator" id="typingIndicator" style="display: none;">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <span class="typing-text">Someone is typing...</span>
        </div>
        
        <!-- Message Input -->
        <div class="message-input-container">
            <form id="messageForm" class="message-form">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrfToken); ?>">
                <?php if ($targetUser): ?>
                <input type="hidden" name="target_user_id" value="<?php echo $targetUser['id']; ?>">
                <?php endif; ?>
                
                <div class="message-input-wrapper">
                    <button type="button" class="attach-btn" onclick="showAttachmentOptions()">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    
                    <textarea 
                        id="messageInput" 
                        name="message" 
                        placeholder="Type your message..." 
                        rows="1"
                        maxlength="2000"
                        required></textarea>
                    
                    <button type="button" class="emoji-btn" onclick="toggleEmojiPicker()">
                        <i class="fas fa-smile"></i>
                    </button>
                    
                    <button type="submit" class="send-btn" id="sendBtn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                
                <!-- File Upload -->
                <input type="file" id="fileInput" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style="display: none;">
                
                <!-- Character Counter -->
                <div class="message-info">
                    <span class="char-counter">0/2000</span>
                </div>
            </form>
            
            <!-- Emoji Picker -->
            <div class="emoji-picker" id="emojiPicker" style="display: none;">
                <!-- Emoji categories will be loaded here -->
            </div>
        </div>
    </div>
</div>

<!-- Attachment Options Modal -->
<div id="attachmentModal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Share File</h3>
            <button onclick="closeAttachmentModal()" class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="attachment-options">
                <button class="attachment-option" onclick="selectFiles('image/*')">
                    <i class="fas fa-image"></i>
                    <span>Photos</span>
                </button>
                <button class="attachment-option" onclick="selectFiles('video/*')">
                    <i class="fas fa-video"></i>
                    <span>Videos</span>
                </button>
                <button class="attachment-option" onclick="selectFiles('audio/*')">
                    <i class="fas fa-music"></i>
                    <span>Audio</span>
                </button>
                <button class="attachment-option" onclick="selectFiles('.pdf,.doc,.docx,.txt')">
                    <i class="fas fa-file-alt"></i>
                    <span>Documents</span>
                </button>
                <button class="attachment-option" onclick="selectFiles()">
                    <i class="fas fa-file"></i>
                    <span>All Files</span>
                </button>
            </div>
        </div>
    </div>
</div>

<!-- New Chat Dialog -->
<div id="newChatModal" class="modal" style="display: none;">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Start New Chat</h3>
            <button onclick="closeNewChatModal()" class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="search-users">
                <input type="text" placeholder="Search users..." id="newChatSearch">
            </div>
            <div class="users-results" id="newChatUsers">
                <!-- Search results will appear here -->
            </div>
        </div>
    </div>
</div>

<style>
.chat-page {
    background: #f8f9fa;
}

.chat-container {
    display: flex;
    height: calc(100vh - 70px); /* Account for navigation */
    max-width: 1400px;
    margin: 0 auto;
    background: white;
    border-radius: 12px 12px 0 0;
    overflow: hidden;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
}

.chat-sidebar {
    width: 320px;
    background: white;
    border-right: 1px solid #e9ecef;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
}

.sidebar-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.new-chat-btn {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
}

.new-chat-btn:hover {
    background: #5a6fd8;
}

.search-container {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.search-input {
    position: relative;
    display: flex;
    align-items: center;
}

.search-input i {
    position: absolute;
    left: 1rem;
    color: #6c757d;
}

.search-input input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 2.5rem;
    border: 1px solid #e9ecef;
    border-radius: 25px;
    background: #f8f9fa;
    font-size: 0.9rem;
}

.search-input input:focus {
    outline: none;
    border-color: #667eea;
    background: white;
}

.online-users, .recent-chats {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.online-users h4, .recent-chats h4 {
    margin: 0 0 1rem 0;
    color: #2c3e50;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.users-list, .chats-list {
    max-height: 200px;
    overflow-y: auto;
}

.user-item, .chat-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease;
}

.user-item:hover, .chat-item:hover {
    background: #f8f9fa;
}

.user-item.active, .chat-item.active {
    background: #e3f2fd;
    color: #667eea;
}

.user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e9ecef;
}

.user-info {
    flex: 1;
    min-width: 0;
}

.user-name {
    font-weight: 500;
    color: #2c3e50;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

.status-dot.offline {
    background: #6c757d;
}

.chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #fafbfc;
}

.chat-header {
    padding: 1rem 1.5rem;
    background: white;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.chat-user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.user-details h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.1rem;
}

.chat-info h3 {
    margin: 0;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.chat-description {
    color: #6c757d;
    font-size: 0.9rem;
}

.chat-actions {
    display: flex;
    gap: 0.5rem;
}

.action-btn {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #6c757d;
}

.action-btn:hover {
    background: #e9ecef;
    color: #495057;
}

.messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.messages-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6c757d;
}

.message {
    display: flex;
    gap: 0.75rem;
    max-width: 70%;
}

.message.own {
    align-self: flex-end;
    flex-direction: row-reverse;
}

.message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
}

.message-content {
    background: white;
    border-radius: 18px;
    padding: 0.75rem 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    position: relative;
}

.message.own .message-content {
    background: #667eea;
    color: white;
}

.message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

.message-author {
    font-weight: 500;
    font-size: 0.8rem;
    color: #667eea;
}

.message.own .message-author {
    color: rgba(255,255,255,0.9);
}

.message-time {
    font-size: 0.7rem;
    color: #6c757d;
}

.message.own .message-time {
    color: rgba(255,255,255,0.7);
}

.message-text {
    line-height: 1.4;
    word-wrap: break-word;
}

.typing-indicator {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6c757d;
    font-style: italic;
}

.typing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6c757d;
    animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 60%, 100% {
        transform: translateY(0);
    }
    30% {
        transform: translateY(-10px);
    }
}

.message-input-container {
    background: white;
    border-top: 1px solid #e9ecef;
    padding: 1rem;
}

.message-input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: #f8f9fa;
    border-radius: 25px;
    padding: 0.5rem;
}

.attach-btn, .emoji-btn {
    background: none;
    border: none;
    color: #6c757d;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    transition: background 0.2s ease;
}

.attach-btn:hover, .emoji-btn:hover {
    background: #e9ecef;
}

#messageInput {
    flex: 1;
    border: none;
    background: none;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
    padding: 0.5rem;
    max-height: 120px;
}

#messageInput:focus {
    outline: none;
}

.send-btn {
    background: #667eea;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
}

.send-btn:hover {
    background: #5a6fd8;
}

.send-btn:disabled {
    background: #e9ecef;
    color: #6c757d;
    cursor: not-allowed;
}

.message-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #6c757d;
}

.emoji-picker {
    position: absolute;
    bottom: 100%;
    right: 0;
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    width: 350px;
    height: 300px;
    z-index: 1000;
}

.attachment-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 1rem 0;
}

.attachment-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.5rem 1rem;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
}

.attachment-option:hover {
    background: #f8f9fa;
    border-color: #667eea;
}

.attachment-option i {
    font-size: 1.5rem;
    color: #667eea;
}

.users-results {
    max-height: 300px;
    overflow-y: auto;
    margin-top: 1rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
    .chat-container {
        height: calc(100vh - 60px);
        border-radius: 0;
    }
    
    .chat-sidebar {
        width: 100%;
        display: none;
    }
    
    .chat-sidebar.show {
        display: flex;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        background: white;
    }
    
    .message {
        max-width: 85%;
    }
    
    .message-input-wrapper {
        padding: 0.25rem;
    }
    
    .attachment-options {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>

<script>
// Chat application initialization
class ChatApp {
    constructor() {
        this.currentUser = <?php echo json_encode($currentUser); ?>;
        this.targetUser = <?php echo $targetUser ? json_encode($targetUser) : 'null'; ?>;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.messagePollingInterval = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadMessages();
        this.loadOnlineUsers();
        this.startMessagePolling();
        this.initEmojiPicker();
        
        // Auto-resize message input
        this.autoResizeTextarea();
    }
    
    bindEvents() {
        // Message form submission
        document.getElementById('messageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        // Message input events
        const messageInput = document.getElementById('messageInput');
        messageInput.addEventListener('input', () => {
            this.updateCharCounter();
            this.handleTyping();
            this.autoResizeTextarea();
        });
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // File input change
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // User search
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });
        
        // New chat search
        document.getElementById('newChatSearch').addEventListener('input', (e) => {
            this.searchNewChatUsers(e.target.value);
        });
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        const formData = new FormData();
        formData.append('action', 'send');
        formData.append('message', message);
        formData.append('csrf_token', window.csrfToken);
        
        if (this.targetUser) {
            formData.append('target_user_id', this.targetUser.id);
        }
        
        try {
            messageInput.disabled = true;
            document.getElementById('sendBtn').disabled = true;
            
            const response = await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                messageInput.value = '';
                this.updateCharCounter();
                this.autoResizeTextarea();
                this.loadMessages();
            } else {
                this.showError(result.error || 'Failed to send message');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            messageInput.disabled = false;
            document.getElementById('sendBtn').disabled = false;
            messageInput.focus();
        }
    }
    
    async loadMessages() {
        try {
            let url = 'api/messages.php?action=get';
            
            if (this.targetUser) {
                url += `&target_user_id=${this.targetUser.id}`;
            }
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.messages = result.messages;
                this.renderMessages();
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    renderMessages() {
        const container = document.getElementById('messagesContainer');
        
        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.messages.map(message => this.renderMessage(message)).join('');
    }
    
    renderMessage(message) {
        const isOwn = message.user_id == this.currentUser.id;
        const messageTime = new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        return `
            <div class="message ${isOwn ? 'own' : ''}">
                <img src="${message.avatar || 'assets/images/default-avatar.png'}" 
                     alt="${message.display_name || message.username}" 
                     class="message-avatar">
                <div class="message-content">
                    ${!isOwn ? `
                    <div class="message-header">
                        <span class="message-author">${message.display_name || message.username}</span>
                        <span class="message-time">${messageTime}</span>
                    </div>
                    ` : `
                    <div class="message-header">
                        <span class="message-time">${messageTime}</span>
                    </div>
                    `}
                    <div class="message-text">${this.formatMessage(message.content)}</div>
                </div>
            </div>
        `;
    }
    
    formatMessage(content) {
        // Basic message formatting
        content = this.escapeHtml(content);
        
        // Convert URLs to links
        content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        // Convert line breaks
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }
    
    updateCharCounter() {
        const messageInput = document.getElementById('messageInput');
        const counter = document.querySelector('.char-counter');
        const length = messageInput.value.length;
        
        counter.textContent = `${length}/2000`;
        
        if (length > 1900) {
            counter.style.color = '#dc3545';
        } else if (length > 1500) {
            counter.style.color = '#ffc107';
        } else {
            counter.style.color = '#6c757d';
        }
    }
    
    autoResizeTextarea() {
        const textarea = document.getElementById('messageInput');
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
    
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            // Send typing indicator to server
            this.sendTypingIndicator(true);
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.sendTypingIndicator(false);
        }, 1000);
    }
    
    async sendTypingIndicator(isTyping) {
        try {
            const formData = new FormData();
            formData.append('action', 'typing');
            formData.append('is_typing', isTyping ? '1' : '0');
            formData.append('csrf_token', window.csrfToken);
            
            if (this.targetUser) {
                formData.append('target_user_id', this.targetUser.id);
            }
            
            await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Failed to send typing indicator:', error);
        }
    }
    
    startMessagePolling() {
        this.messagePollingInterval = setInterval(() => {
            this.loadMessages();
        }, 2000);
    }
    
    async loadOnlineUsers() {
        try {
            const response = await fetch('api/users.php?action=get_online');
            const result = await response.json();
            
            if (result.success) {
                this.renderOnlineUsers(result.users);
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }
    
    renderOnlineUsers(users) {
        const container = document.getElementById('onlineUsersList');
        const currentUserId = this.currentUser.id;
        
        const onlineUsers = users.filter(user => user.id !== currentUserId);
        
        if (onlineUsers.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No users online</p></div>';
            return;
        }
        
        container.innerHTML = onlineUsers.map(user => `
            <div class="user-item" onclick="startDirectMessage(${user.id})">
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
            </div>
        `).join('');
    }
    
    initEmojiPicker() {
        // Initialize emoji picker
        if (typeof EmojiPicker !== 'undefined') {
            this.emojiPicker = new EmojiPicker();
        }
    }
    
    showError(message) {
        // Show toast notification
        console.error(message);
        // Implement toast notification system
    }
    
    async handleFileUpload(files) {
        if (files.length === 0) return;
        
        const formData = new FormData();
        formData.append('action', 'upload_file');
        formData.append('csrf_token', window.csrfToken);
        
        for (let file of files) {
            formData.append('files[]', file);
        }
        
        if (this.targetUser) {
            formData.append('target_user_id', this.targetUser.id);
        }
        
        try {
            const response = await fetch('api/messages.php', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.loadMessages();
                this.closeAttachmentModal();
            } else {
                this.showError(result.error || 'Failed to upload file');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        }
    }
    
    async searchUsers(query) {
        if (!query.trim()) {
            this.loadOnlineUsers();
            return;
        }
        
        try {
            const response = await fetch(`api/users.php?action=search&query=${encodeURIComponent(query)}`);
            const result = await response.json();
            
            if (result.success) {
                this.renderOnlineUsers(result.users);
            }
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }
    
    async searchNewChatUsers(query) {
        if (!query.trim()) {
            document.getElementById('newChatUsers').innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`api/users.php?action=search&query=${encodeURIComponent(query)}`);
            const result = await response.json();
            
            if (result.success) {
                const container = document.getElementById('newChatUsers');
                const currentUserId = this.currentUser.id;
                
                const users = result.users.filter(user => user.id !== currentUserId);
                
                container.innerHTML = users.map(user => `
                    <div class="user-item" onclick="startDirectMessage(${user.id})">
                        <img src="${user.avatar || 'assets/images/default-avatar.png'}" 
                             alt="${user.display_name || user.username}" 
                             class="user-avatar">
                        <div class="user-info">
                            <div class="user-name">${user.display_name || user.username}</div>
                            <div class="user-status">
                                <span class="status-dot ${user.is_online ? 'online' : 'offline'}"></span>
                                ${user.is_online ? 'Online' : 'Offline'}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }
}

// Global functions
function showAttachmentOptions() {
    document.getElementById('attachmentModal').style.display = 'flex';
}

function closeAttachmentModal() {
    document.getElementById('attachmentModal').style.display = 'none';
}

function selectFiles(accept = '') {
    const fileInput = document.getElementById('fileInput');
    fileInput.accept = accept;
    fileInput.click();
}

function showNewChatDialog() {
    document.getElementById('newChatModal').style.display = 'flex';
}

function closeNewChatModal() {
    document.getElementById('newChatModal').style.display = 'none';
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function startDirectMessage(userId) {
    window.location.href = `chat.php?user=${userId}`;
}

function toggleNotifications() {
    // Implement notification toggle
    const icon = document.getElementById('notificationIcon');
    icon.classList.toggle('fa-bell');
    icon.classList.toggle('fa-bell-slash');
}

function showChatSettings() {
    // Implement chat settings dialog
    console.log('Show chat settings');
}

function showChatInfo() {
    // Implement chat info dialog
    console.log('Show chat info');
}

function toggleAudioCall() {
    // Implement audio call functionality
    console.log('Toggle audio call');
}

function toggleVideoCall() {
    // Implement video call functionality
    console.log('Toggle video call');
}

// Initialize chat app when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.chatApp = new ChatApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (window.chatApp && window.chatApp.messagePollingInterval) {
        clearInterval(window.chatApp.messagePollingInterval);
    }
});
</script>

<?php include __DIR__ . '/includes/footer.php'; ?>
