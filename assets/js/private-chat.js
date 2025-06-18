/**
 * Private Chat JavaScript - Quick Chat
 * 
 * This file contains specialized functionality for private chats.
 */

class PrivateChatManager {
    constructor(chatApp) {
        this.chatApp = chatApp;
        this.targetUserId = chatApp.config.targetUserId;
        this.init();
    }

    init() {
        // Initialize private chat specific functionality
        this.setupUserStatus();
        this.setupTypingIndicator();
        this.setupReadReceipts();
    }

    setupUserStatus() {
        // Set up user status monitoring
        if (!this.targetUserId) return;

        // Poll for user status updates
        this.statusInterval = setInterval(() => {
            this.checkUserStatus();
        }, 30000); // Check every 30 seconds

        // Initial check
        this.checkUserStatus();
    }

    checkUserStatus() {
        fetch(`${this.chatApp.config.apiBase}users.php?action=status&user_id=${this.targetUserId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.chatApp.config.csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const statusIndicator = document.querySelector('.chat-header .status-indicator');
                const statusText = document.querySelector('.chat-header .status-text');
                
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator ' + (data.is_online ? 'online' : 'offline');
                }
                
                if (statusText) {
                    statusText.textContent = data.is_online 
                        ? 'Online' 
                        : `Last seen ${this.formatLastSeen(data.last_seen)}`;
                }
            }
        })
        .catch(error => {
            console.error('Error checking user status:', error);
        });
    }

    formatLastSeen(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }

    setupTypingIndicator() {
        // Setup typing indicator for private chats
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        let typingTimer;
        let isTyping = false;

        messageInput.addEventListener('keydown', () => {
            if (!isTyping) {
                isTyping = true;
                this.sendTypingStatus(true);
            }
            
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                isTyping = false;
                this.sendTypingStatus(false);
            }, 3000);
        });

        // Listen for typing events from the other user
        this.setupTypingListener();
    }

    sendTypingStatus(isTyping) {
        if (!this.targetUserId) return;
        
        fetch(`${this.chatApp.config.apiBase}messages.php?action=typing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.chatApp.config.csrfToken
            },
            body: JSON.stringify({
                recipient_id: this.targetUserId,
                is_typing: isTyping
            })
        })
        .catch(error => {
            console.error('Error sending typing status:', error);
        });
    }

    setupTypingListener() {
        // In a real app, this would use WebSockets
        // For now, we'll poll the server
        this.typingInterval = setInterval(() => {
            this.checkTypingStatus();
        }, 3000);
    }

    checkTypingStatus() {
        if (!this.targetUserId) return;
        
        fetch(`${this.chatApp.config.apiBase}messages.php?action=check_typing&user_id=${this.targetUserId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.chatApp.config.csrfToken
            }
        })
        .then(response => response.json())
        .then(data => {
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.style.display = data.is_typing ? 'flex' : 'none';
            }
        })
        .catch(error => {
            console.error('Error checking typing status:', error);
        });
    }

    setupReadReceipts() {
        // Set up read receipts for private chats
        // Mark messages as read when they're visible
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        // Use Intersection Observer to detect when messages are visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageElement = entry.target;
                    const messageId = messageElement.dataset.messageId;
                    const fromCurrentUser = messageElement.classList.contains('outgoing');
                    
                    // Only mark messages from the other user as read
                    if (!fromCurrentUser && messageId) {
                        this.markMessageAsRead(messageId);
                        observer.unobserve(messageElement);
                    }
                }
            });
        }, {
            root: messagesContainer,
            threshold: 0.5
        });

        // Observe all message elements
        document.querySelectorAll('.message-item').forEach(message => {
            observer.observe(message);
        });

        // Update when new messages are added
        this.chatApp.on('messagesLoaded', () => {
            document.querySelectorAll('.message-item').forEach(message => {
                if (!message.dataset.observed) {
                    observer.observe(message);
                    message.dataset.observed = 'true';
                }
            });
        });
    }

    markMessageAsRead(messageId) {
        fetch(`${this.chatApp.config.apiBase}messages.php?action=mark_read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.chatApp.config.csrfToken
            },
            body: JSON.stringify({
                message_id: messageId
            })
        })
        .catch(error => {
            console.error('Error marking message as read:', error);
        });
    }

    cleanup() {
        // Clean up all intervals when navigating away
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
        
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
        }
    }
}

// This will be initialized by the ModernChatApp class when the chat type is 'private'
if (typeof window !== 'undefined') {
    window.PrivateChatManager = PrivateChatManager;
}
