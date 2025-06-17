/**
 * Real-time Features Implementation
 * Provides typing indicators, read receipts, and presence system
 */
class RealTimeFeatures {
    constructor() {
        this.typingUsers = new Map();
        this.readReceipts = new Map();
        this.userPresence = new Map();
        this.typingTimeout = null;
        this.typingDelay = 2000; // 2 seconds
        this.presenceInterval = null;
        this.heartbeatInterval = 30000; // 30 seconds
        
        this.init();
    }

    async init() {
        this.setupTypingIndicators();
        this.setupReadReceipts();
        this.setupPresenceSystem();
        this.startHeartbeat();
    }

    setupTypingIndicators() {
        // Listen for typing in message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });

            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    this.stopTyping();
                }
            });
        }

        // Create typing indicator container
        this.createTypingIndicatorContainer();
    }

    createTypingIndicatorContainer() {
        let container = document.getElementById('typingIndicators');
        if (!container) {
            container = document.createElement('div');
            container.id = 'typingIndicators';
            container.className = 'typing-indicators';
            
            const chatMessages = document.querySelector('.chat-messages');
            if (chatMessages) {
                chatMessages.appendChild(container);
            }
        }
    }

    handleTyping() {
        // Clear previous timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Send typing start notification
        this.sendTypingStatus(true);

        // Set timeout to stop typing
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, this.typingDelay);
    }

    stopTyping() {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
            this.typingTimeout = null;
        }

        this.sendTypingStatus(false);
    }

    async sendTypingStatus(isTyping) {
        try {
            const targetUserId = this.getCurrentChatUserId();
            if (!targetUserId) return;

            await fetch('/api/messages.php?action=typing_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    target_user_id: targetUserId,
                    is_typing: isTyping
                })
            });
        } catch (error) {
            console.error('Failed to send typing status:', error);
        }
    }

    updateTypingIndicator(userId, username, isTyping) {
        const container = document.getElementById('typingIndicators');
        if (!container) return;

        const indicatorId = `typing-${userId}`;
        let indicator = document.getElementById(indicatorId);

        if (isTyping) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = indicatorId;
                indicator.className = 'typing-indicator';
                indicator.innerHTML = `
                    <span class="typing-user">${this.escapeHtml(username)}</span>
                    <span class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </span>
                `;
                container.appendChild(indicator);
            }

            // Auto-remove after delay if no update
            clearTimeout(indicator.dataset.timeout);
            indicator.dataset.timeout = setTimeout(() => {
                this.updateTypingIndicator(userId, username, false);
            }, this.typingDelay + 1000);

        } else {
            if (indicator) {
                clearTimeout(indicator.dataset.timeout);
                indicator.remove();
            }
        }

        // Scroll to bottom if needed
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    setupReadReceipts() {
        // Mark messages as read when they come into view
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const messageElement = entry.target;
                    const messageId = messageElement.dataset.messageId;
                    const senderId = messageElement.dataset.senderId;
                    const groupId = messageElement.dataset.groupId;
                    
                    if (messageId && !messageElement.dataset.read) {
                        if (groupId) {
                            // This is a group message
                            this.markGroupMessageAsRead(messageId, groupId);
                        } else if (senderId) {
                            // This is a direct message
                            this.markMessageAsRead(messageId, senderId);
                        }
                        messageElement.dataset.read = 'true';
                    }
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe existing messages
        document.querySelectorAll('.message-item[data-message-id]').forEach(message => {
            observer.observe(message);
        });

        // Observe new messages as they're added
        this.messageObserver = observer;
    }

    async markMessageAsRead(messageId, senderId) {
        try {
            const response = await fetch('/api/messages.php?action=mark_read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    message_id: messageId,
                    sender_id: senderId
                })
            });

            const result = await response.json();
            if (result.success) {
                // Update UI to show read receipt
                this.updateReadReceiptDisplay(messageId, true);
            }
        } catch (error) {
            console.error('Failed to mark message as read:', error);
        }
    }
    
    async markGroupMessageAsRead(messageId, groupId) {
        try {
            const formData = new FormData();
            formData.append('message_id', messageId);
            formData.append('group_id', groupId);
            formData.append('csrf_token', this.getCSRFToken());
            
            const response = await fetch('/api/group-read-receipts.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                // Update UI to show read receipt
                this.updateGroupReadReceiptDisplay(messageId, true);
            }
        } catch (error) {
            console.error('Failed to mark group message as read:', error);
        }
    }
    
    async getGroupMessageReadReceipts(messageId, groupId) {
        try {
            const response = await fetch(`/api/group-read-receipts.php?message_id=${messageId}&group_id=${groupId}`);
            const data = await response.json();
            
            if (data.success) {
                return data.read_receipts;
            }
            return [];
        } catch (error) {
            console.error('Failed to get group message read receipts:', error);
            return [];
        }
    }
    
    updateGroupReadReceiptDisplay(messageId, isRead) {
        const messageElement = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
        if (messageElement) {
            if (isRead) {
                messageElement.classList.add('read');
                
                // Add or update read indicator
                let readIndicator = messageElement.querySelector('.read-indicator');
                if (!readIndicator) {
                    readIndicator = document.createElement('span');
                    readIndicator.className = 'read-indicator';
                    readIndicator.title = 'Read';
                    readIndicator.innerHTML = '<i class="fas fa-check-double"></i>';
                    
                    const messageFooter = messageElement.querySelector('.message-footer');
                    if (messageFooter) {
                        messageFooter.appendChild(readIndicator);
                    }
                }
            }
        }
    }

    updateReadReceiptDisplay(messageId, isRead) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        let readIndicator = messageElement.querySelector('.read-indicator');
        if (!readIndicator) {
            readIndicator = document.createElement('span');
            readIndicator.className = 'read-indicator';
            
            const messageFooter = messageElement.querySelector('.message-footer');
            if (messageFooter) {
                messageFooter.appendChild(readIndicator);
            }
        }

        if (isRead) {
            readIndicator.innerHTML = '✓✓';
            readIndicator.classList.add('read');
            readIndicator.title = 'Read';
        } else {
            readIndicator.innerHTML = '✓';
            readIndicator.classList.remove('read');
            readIndicator.title = 'Delivered';
        }
    }

    setupPresenceSystem() {
        this.startPresenceTracking();
        this.createPresenceIndicators();
    }

    startPresenceTracking() {
        // Update own presence
        this.updateOwnPresence('online');

        // Periodically update presence
        this.presenceInterval = setInterval(() => {
            this.updateOwnPresence('online');
        }, this.heartbeatInterval);

        // Update presence on visibility change
        document.addEventListener('visibilitychange', () => {
            const status = document.hidden ? 'away' : 'online';
            this.updateOwnPresence(status);
        });

        // Update presence before page unload
        window.addEventListener('beforeunload', () => {
            this.updateOwnPresence('offline');
        });
    }

    async updateOwnPresence(status) {
        try {
            await fetch('/api/users.php?action=update_presence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    status: status,
                    last_seen: Date.now()
                })
            });
        } catch (error) {
            console.error('Failed to update presence:', error);
        }
    }

    updateUserPresence(userId, status, lastSeen) {
        this.userPresence.set(userId, {
            status: status,
            lastSeen: lastSeen,
            updated: Date.now()
        });

        this.updatePresenceIndicators(userId, status, lastSeen);
    }

    updatePresenceIndicators(userId, status, lastSeen) {
        const indicators = document.querySelectorAll(`[data-user-id="${userId}"] .presence-indicator`);
        
        indicators.forEach(indicator => {
            indicator.className = `presence-indicator presence-${status}`;
            
            let title = '';
            switch (status) {
                case 'online':
                    title = 'Online';
                    break;
                case 'away':
                    title = 'Away';
                    break;
                case 'offline':
                    title = this.formatLastSeen(lastSeen);
                    break;
            }
            
            indicator.title = title;
        });
    }

    createPresenceIndicators() {
        // Add presence indicators to user elements
        document.querySelectorAll('[data-user-id]').forEach(element => {
            if (!element.querySelector('.presence-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'presence-indicator presence-unknown';
                element.appendChild(indicator);
            }
        });
    }

    formatLastSeen(timestamp) {
        if (!timestamp) return 'Last seen unknown';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Last seen just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `Last seen ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `Last seen ${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `Last seen ${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    startHeartbeat() {
        // Send periodic heartbeat to maintain connection
        setInterval(async () => {
            try {
                await fetch('/api/heartbeat.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        timestamp: Date.now()
                    })
                });
            } catch (error) {
                console.error('Heartbeat failed:', error);
            }
        }, this.heartbeatInterval);
    }

    // Event handlers for external integration
    onTypingStatusReceived(data) {
        this.updateTypingIndicator(data.user_id, data.username, data.is_typing);
    }

    onReadReceiptReceived(data) {
        this.updateReadReceiptDisplay(data.message_id, data.is_read);
    }

    onPresenceUpdate(data) {
        this.updateUserPresence(data.user_id, data.status, data.last_seen);
    }

    onNewMessage(message) {
        // Observe new message for read receipts
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement && this.messageObserver) {
            this.messageObserver.observe(messageElement);
        }
    }

    // Utility methods
    getCurrentChatUserId() {
        // Get current chat target user ID
        const chatContainer = document.querySelector('.chat-container');
        return chatContainer ? chatContainer.dataset.targetUserId : null;
    }

    getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        // Clean up intervals
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        // Disconnect observer
        if (this.messageObserver) {
            this.messageObserver.disconnect();
        }

        // Update presence to offline
        this.updateOwnPresence('offline');
    }
}

// Initialize real-time features
document.addEventListener('DOMContentLoaded', () => {
    window.realTimeFeatures = new RealTimeFeatures();
});

// Export for external use
window.RealTimeFeatures = RealTimeFeatures;
