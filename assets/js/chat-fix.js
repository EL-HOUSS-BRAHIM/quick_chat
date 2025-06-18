/**
 * Quick Fix for Modern Chat App
 * This script patches the ModernChatApp class with all the missing functions
 * and makes sure everything works together correctly.
 */

// Immediate execution to patch the ModernChatApp prototype
(function() {
    // Ensure the missing functions are available regardless of load order
    
    // Group info toggle
    ModernChatApp.prototype.toggleGroupInfo = function() {
        console.log('Toggling group info sidebar');
        const groupInfoSidebar = document.getElementById('groupInfoSidebar');
        if (groupInfoSidebar) {
            groupInfoSidebar.classList.toggle('visible');
            
            // Load members if needed
            if (groupInfoSidebar.classList.contains('visible') && this.currentGroupId) {
                this.loadGroupMembers(this.currentGroupId);
            }
        }
    };
    
    // Reply to message
    ModernChatApp.prototype.replyToMessage = function(messageId) {
        console.log('Replying to message:', messageId);
        const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
        if (!messageElement) return;
        
        // Get message data
        const sender = messageElement.querySelector('.message-sender').textContent;
        const content = messageElement.querySelector('.message-content').textContent;
        
        // Create reply indicator
        const replyContainer = document.getElementById('replyContainer');
        if (replyContainer) {
            replyContainer.innerHTML = `
                <div class="reply-preview">
                    <div class="reply-info">
                        <strong>Replying to ${sender}</strong>
                        <p>${content.substring(0, 50)}${content.length > 50 ? '...' : ''}</p>
                    </div>
                    <button class="reply-close" onclick="chatApp.cancelReply()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            replyContainer.style.display = 'block';
            
            // Store for sending
            this.replyToMessageId = messageId;
            
            // Focus input
            if (this.elements.messageInput) {
                this.elements.messageInput.focus();
            }
        }
    };
    
    // Cancel reply
    ModernChatApp.prototype.cancelReply = function() {
        const replyContainer = document.getElementById('replyContainer');
        if (replyContainer) {
            replyContainer.style.display = 'none';
            replyContainer.innerHTML = '';
            this.replyToMessageId = null;
        }
    };
    
    // Show reaction picker
    ModernChatApp.prototype.showReactionPicker = function(messageId, event) {
        console.log('Showing reaction picker for message:', messageId);
        
        // Prevent default browser behavior
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        // Get the reaction picker element
        const reactionPicker = document.getElementById('reactionPicker');
        if (!reactionPicker) return;
        
        // Position the picker
        if (event && event.target) {
            const rect = event.target.getBoundingClientRect();
            reactionPicker.style.position = 'absolute';
            reactionPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
            reactionPicker.style.left = `${rect.left}px`;
        }
        
        // Store the message ID and show the picker
        reactionPicker.dataset.messageId = messageId;
        reactionPicker.style.display = 'block';
        
        // Close when clicking outside
        const closeReactionPicker = (e) => {
            if (!reactionPicker.contains(e.target) && 
                !e.target.classList.contains('react-btn') && 
                !e.target.closest('.react-btn')) {
                reactionPicker.style.display = 'none';
                document.removeEventListener('click', closeReactionPicker);
            }
        };
        
        // Add the click listener with a slight delay to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', closeReactionPicker);
        }, 100);
    };
    
    // Add reaction
    ModernChatApp.prototype.addReaction = function(emoji) {
        const reactionPicker = document.getElementById('reactionPicker');
        if (!reactionPicker) return;
        
        const messageId = reactionPicker.dataset.messageId;
        if (!messageId) return;
        
        console.log('Adding reaction:', emoji, 'to message:', messageId);
        
        // Hide picker
        reactionPicker.style.display = 'none';
        
        // Send the reaction
        this.sendReaction(messageId, emoji);
    };
    
    // Send reaction to server
    ModernChatApp.prototype.sendReaction = function(messageId, emoji) {
        fetch('api/message-reactions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message_id: messageId,
                emoji: emoji,
                csrf_token: this.csrfToken
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.updateMessageReactions(messageId, data.reactions);
            } else {
                console.error('Failed to add reaction:', data.error);
            }
        })
        .catch(error => {
            console.error('Error sending reaction:', error);
        });
    };
    
    // Update reactions display
    ModernChatApp.prototype.updateMessageReactions = function(messageId, reactions) {
        const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
        if (!messageElement) return;
        
        let reactionsContainer = messageElement.querySelector('.message-reactions');
        
        // Create container if it doesn't exist
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            
            // Find where to insert it (after message-content)
            const messageContent = messageElement.querySelector('.message-content');
            if (messageContent) {
                messageContent.after(reactionsContainer);
            } else {
                return; // Can't find where to add reactions
            }
        }
        
        // Clear existing reactions
        reactionsContainer.innerHTML = '';
        
        if (!reactions || reactions.length === 0) return;
        
        // Group by emoji
        const groupedReactions = {};
        reactions.forEach(reaction => {
            if (!groupedReactions[reaction.emoji]) {
                groupedReactions[reaction.emoji] = [];
            }
            groupedReactions[reaction.emoji].push(reaction);
        });
        
        // Add to UI
        Object.entries(groupedReactions).forEach(([emoji, users]) => {
            const reactionBtn = document.createElement('button');
            reactionBtn.className = 'reaction-badge';
            reactionBtn.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
            
            // Tooltip with usernames
            const usernames = users.map(u => u.username || 'User').join(', ');
            reactionBtn.title = usernames;
            
            // Add click handler to toggle
            reactionBtn.onclick = () => {
                const hasReacted = users.some(u => u.user_id == this.currentUserId);
                if (hasReacted) {
                    this.removeReaction(messageId, emoji);
                } else {
                    this.sendReaction(messageId, emoji);
                }
            };
            
            reactionsContainer.appendChild(reactionBtn);
        });
    };
    
    // Remove reaction
    ModernChatApp.prototype.removeReaction = function(messageId, emoji) {
        fetch('api/message-reactions.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message_id: messageId,
                emoji: emoji,
                action: 'remove',
                csrf_token: this.csrfToken
            }),
            credentials: 'same-origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.updateMessageReactions(messageId, data.reactions);
            } else {
                console.error('Failed to remove reaction:', data.error);
            }
        })
        .catch(error => {
            console.error('Error removing reaction:', error);
        });
    };
    
    // Ensure renderMessage exists and works properly
    if (!ModernChatApp.prototype.renderMessage || typeof ModernChatApp.prototype.renderMessage !== 'function') {
        ModernChatApp.prototype.renderMessage = function(message) {
            const isCurrentUser = message.user_id == this.currentUserId;
            const messageClass = isCurrentUser ? 'message-item outgoing' : 'message-item incoming';
            
            // Format time
            const date = new Date(message.created_at);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Handle message content based on type
            let messageContent = '';
            switch (message.message_type || message.type) {
                case 'image':
                    messageContent = `<div class="message-image"><img src="${message.file_path}" alt="Image"></div>`;
                    break;
                case 'file':
                    const fileName = message.file_path.split('/').pop();
                    messageContent = `
                        <div class="message-file">
                            <i class="fas fa-file"></i>
                            <a href="${message.file_path}" target="_blank" download>${fileName}</a>
                            <span class="file-size">${this.formatFileSize(message.file_size)}</span>
                        </div>
                    `;
                    break;
                default:
                    // Text message
                    messageContent = `<div class="message-text">${this.formatMessageText(message.content)}</div>`;
            }
            
            // Handle reply content if present
            let replyHTML = '';
            if (message.reply_to_id && message.reply_content) {
                replyHTML = `
                    <div class="message-reply">
                        <div class="reply-content">
                            <span class="reply-sender">${message.reply_username || 'User'}</span>
                            <p>${message.reply_content}</p>
                        </div>
                    </div>
                `;
            }
            
            // Build actions menu
            const actionsHTML = `
                <div class="message-actions">
                    <button class="action-btn react-btn" onclick="chatApp.showReactionPicker(${message.id}, event)">
                        <i class="far fa-smile"></i>
                    </button>
                    <button class="action-btn reply-btn" onclick="chatApp.replyToMessage(${message.id})">
                        <i class="fas fa-reply"></i>
                    </button>
                    ${isCurrentUser ? `
                        <button class="action-btn edit-btn" onclick="chatApp.editMessage(${message.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete-btn" onclick="chatApp.deleteMessage(${message.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            
            // Reactions placeholder (will be populated by updateMessageReactions)
            const reactionsHTML = message.reactions && message.reactions.length > 0 
                ? '<div class="message-reactions"></div>' 
                : '';
            
            // Build final HTML
            return `
                <div class="${messageClass}" data-id="${message.id}">
                    <div class="message-avatar">
                        <img src="${message.avatar || 'assets/images/default-avatar.svg'}" alt="${message.username || 'User'}">
                    </div>
                    <div class="message-bubble">
                        <div class="message-info">
                            <span class="message-sender">${message.display_name || message.username || 'User'}</span>
                            <span class="message-time">${timeStr}</span>
                        </div>
                        ${replyHTML}
                        <div class="message-content">
                            ${messageContent}
                        </div>
                        ${reactionsHTML}
                    </div>
                    ${actionsHTML}
                </div>
            `;
        };
    }
    
    // Helper for formatting message text (links, etc)
    ModernChatApp.prototype.formatMessageText = function(text) {
        if (!text) return '';
        
        // Escape HTML first for security
        text = text.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#039;');
        
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Convert line breaks to <br>
        text = text.replace(/\n/g, '<br>');
        
        return text;
    };
    
    // Helper for formatting file sizes
    ModernChatApp.prototype.formatFileSize = function(bytes) {
        if (!bytes) return '';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    };
    
    // Patch the loadMessages function to ensure messages display properly
    const originalLoadConversations = ModernChatApp.prototype.loadConversations;
    ModernChatApp.prototype.loadConversations = function() {
        const result = originalLoadConversations?.apply(this, arguments) || Promise.resolve();
        
        // Add rendering hook
        return result.then(() => {
            // If messages are loaded but not displayed, force render them
            if (this.messages && this.messages.length > 0 && 
                this.elements.messagesList && 
                this.elements.messagesList.children.length === 0) {
                
                console.log('Forcing message render:', this.messages.length, 'messages');
                this.renderMessages();
            }
            return result;
        });
    };
    
    // Ensure we have a renderMessages function
    if (!ModernChatApp.prototype.renderMessages) {
        ModernChatApp.prototype.renderMessages = function() {
            console.log('Rendering messages:', this.messages ? this.messages.length : 0);
            
            if (!this.elements.messagesList) return;
            
            // Clear existing messages
            this.elements.messagesList.innerHTML = '';
            
            if (!this.messages || this.messages.length === 0) {
                this.elements.messagesList.innerHTML = '<div class="no-messages">No messages yet</div>';
                return;
            }
            
            // Group by date for date separators
            const messagesByDate = {};
            this.messages.forEach(msg => {
                const date = new Date(msg.created_at);
                const dateKey = date.toDateString();
                
                if (!messagesByDate[dateKey]) {
                    messagesByDate[dateKey] = [];
                }
                messagesByDate[dateKey].push(msg);
            });
            
            // Render each date group
            Object.keys(messagesByDate).forEach(dateKey => {
                // Add date separator
                const date = new Date(dateKey);
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                let dateLabel = '';
                if (date.toDateString() === today.toDateString()) {
                    dateLabel = 'Today';
                } else if (date.toDateString() === yesterday.toDateString()) {
                    dateLabel = 'Yesterday';
                } else {
                    dateLabel = date.toLocaleDateString(undefined, { 
                        weekday: 'long',
                        month: 'long', 
                        day: 'numeric'
                    });
                }
                
                this.elements.messagesList.innerHTML += `
                    <div class="date-separator">
                        <span>${dateLabel}</span>
                    </div>
                `;
                
                // Add messages for this date
                messagesByDate[dateKey].forEach(message => {
                    this.elements.messagesList.innerHTML += this.renderMessage(message);
                });
            });
            
            // Process reactions for all messages
            this.messages.forEach(message => {
                if (message.reactions && message.reactions.length > 0) {
                    this.updateMessageReactions(message.id, message.reactions);
                }
            });
            
            // Scroll to bottom
            this.scrollToBottom();
        };
    }
    
    // Ensure we can scroll to bottom
    if (!ModernChatApp.prototype.scrollToBottom) {
        ModernChatApp.prototype.scrollToBottom = function() {
            const container = document.getElementById('messagesContainer');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        };
    }
    
    // Make sure we load messages when a group is opened
    const originalOpenGroupChat = ModernChatApp.prototype.openGroupChat;
    ModernChatApp.prototype.openGroupChat = function(groupId) {
        const result = originalOpenGroupChat?.apply(this, arguments) || Promise.resolve();
        
        // Add hook for message rendering
        return result.then(() => {
            // If this is a direct function call without the original implementation
            if (!originalOpenGroupChat && groupId) {
                this.currentGroupId = groupId;
                this.currentConversation = null;
                
                // Load messages for this group
                this.loadGroupMessages(groupId);
            }
            return result;
        });
    };
    
    // Implement group message loading if missing
    if (!ModernChatApp.prototype.loadGroupMessages) {
        ModernChatApp.prototype.loadGroupMessages = function(groupId) {
            console.log('Loading messages for group:', groupId);
            
            return fetch(`api/messages.php?group_id=${groupId}&limit=50`, {
                method: 'GET',
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.messages = data.data;
                    this.renderMessages();
                    return data;
                } else {
                    console.error('Failed to load group messages:', data.error);
                    throw new Error(data.error);
                }
            })
            .catch(error => {
                console.error('Error loading group messages:', error);
                throw error;
            });
        };
    }
    
    console.log('Chat extensions loaded successfully');
})();
