/**
 * Missing Functions for ModernChatApp
 * 
 * This file adds missing functions to the ModernChatApp class that are
 * referenced in the HTML but not implemented in the main class.
 */

// Extend ModernChatApp prototype immediately
(function() {
    // Add missing group info toggle function
    ModernChatApp.prototype.toggleGroupInfo = function() {
        console.log('Toggling group info sidebar');
        const groupInfoSidebar = document.getElementById('groupInfoSidebar');
        if (groupInfoSidebar) {
            if (groupInfoSidebar.classList.contains('visible')) {
                groupInfoSidebar.classList.remove('visible');
            } else {
                groupInfoSidebar.classList.add('visible');
                // Load group members if not already loaded
                if (this.currentGroupId) {
                    this.loadGroupMembers(this.currentGroupId);
                }
            }
        }
    };

        // Add missing reply to message function
        ModernChatApp.prototype.replyToMessage = function(messageId) {
            console.log('Replying to message:', messageId);
            const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
            if (!messageElement) return;
            
            // Get the message data
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
                
                // Store the message ID for sending with the reply
                this.replyToMessageId = messageId;
                
                // Focus message input
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    messageInput.focus();
                }
            }
        };
        
        // Add missing cancel reply function
        ModernChatApp.prototype.cancelReply = function() {
            const replyContainer = document.getElementById('replyContainer');
            if (replyContainer) {
                replyContainer.style.display = 'none';
                replyContainer.innerHTML = '';
                this.replyToMessageId = null;
            }
        };
        
        // Add missing show reaction picker function
        ModernChatApp.prototype.showReactionPicker = function(messageId, event) {
            console.log('Showing reaction picker for message:', messageId);
            event?.preventDefault();
            
            const reactionPicker = document.getElementById('reactionPicker');
            if (!reactionPicker) return;
            
            // Get position based on clicked element
            const target = event?.currentTarget || event?.target;
            if (target) {
                const rect = target.getBoundingClientRect();
                
                // Position the picker above the button
                reactionPicker.style.bottom = `${window.innerHeight - rect.top + 10}px`;
                reactionPicker.style.left = `${rect.left}px`;
                
                // Make picker visible
                reactionPicker.style.display = 'block';
                
                // Store the message ID for the reaction
                reactionPicker.dataset.messageId = messageId;
                
                // Add click handler to hide picker when clicking outside
                document.addEventListener('click', this.hideReactionPicker.bind(this), { once: true });
            }
        };
        
        // Add missing hide reaction picker function
        ModernChatApp.prototype.hideReactionPicker = function(event) {
            const reactionPicker = document.getElementById('reactionPicker');
            if (!reactionPicker) return;
            
            // Check if the click was inside the picker
            if (event && reactionPicker.contains(event.target)) {
                // If inside, don't hide and re-add the event listener
                document.addEventListener('click', this.hideReactionPicker.bind(this), { once: true });
                return;
            }
            
            // Hide the picker
            reactionPicker.style.display = 'none';
        };
        
        // Add missing function to add reaction
        ModernChatApp.prototype.addReaction = function(emoji) {
            const reactionPicker = document.getElementById('reactionPicker');
            if (!reactionPicker) return;
            
            const messageId = reactionPicker.dataset.messageId;
            if (!messageId) return;
            
            console.log('Adding reaction:', emoji, 'to message:', messageId);
            
            // Hide the picker
            reactionPicker.style.display = 'none';
            
            // Send reaction to server
            this.sendReaction(messageId, emoji);
        };
        
        // Add missing function to send reaction to server
        ModernChatApp.prototype.sendReaction = function(messageId, emoji) {
            const data = {
                message_id: messageId,
                emoji: emoji,
                csrf_token: this.csrfToken
            };
            
            fetch('api/message-reactions.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update the UI to show the new reaction
                    this.updateMessageReactions(messageId, data.reactions);
                } else {
                    console.error('Error adding reaction:', data.error);
                }
            })
            .catch(error => {
                console.error('Error sending reaction:', error);
            });
        };
        
        // Add missing function to update message reactions in the UI
        ModernChatApp.prototype.updateMessageReactions = function(messageId, reactions) {
            const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
            if (!messageElement) return;
            
            const reactionsContainer = messageElement.querySelector('.message-reactions');
            if (!reactionsContainer) return;
            
            // Clear existing reactions
            reactionsContainer.innerHTML = '';
            
            // Group reactions by emoji
            const groupedReactions = {};
            reactions.forEach(reaction => {
                if (!groupedReactions[reaction.emoji]) {
                    groupedReactions[reaction.emoji] = [];
                }
                groupedReactions[reaction.emoji].push(reaction);
            });
            
            // Add reactions to UI
            Object.entries(groupedReactions).forEach(([emoji, users]) => {
                const reactionBtn = document.createElement('button');
                reactionBtn.className = 'reaction-badge';
                reactionBtn.innerHTML = `${emoji} <span class="reaction-count">${users.length}</span>`;
                
                // Add tooltip with user names
                const userNames = users.map(r => r.username).join(', ');
                reactionBtn.title = userNames;
                
                // Add click handler to toggle reaction
                reactionBtn.addEventListener('click', () => {
                    // Check if current user already reacted
                    const currentUserId = this.currentUserId;
                    const userReacted = users.some(r => r.user_id === currentUserId);
                    
                    if (userReacted) {
                        // Remove reaction
                        this.removeReaction(messageId, emoji);
                    } else {
                        // Add reaction
                        this.sendReaction(messageId, emoji);
                    }
                });
                
                reactionsContainer.appendChild(reactionBtn);
            });
        };
        
        // Add missing function to remove a reaction
        ModernChatApp.prototype.removeReaction = function(messageId, emoji) {
            const data = {
                message_id: messageId,
                emoji: emoji,
                action: 'remove',
                csrf_token: this.csrfToken
            };
            
            fetch('api/message-reactions.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update the UI to show the updated reactions
                    this.updateMessageReactions(messageId, data.reactions);
                } else {
                    console.error('Error removing reaction:', data.error);
                }
            })
            .catch(error => {
                console.error('Error removing reaction:', error);
            });
        };

        // Add missing function to get CSRF token
        ModernChatApp.prototype.getCSRFToken = function() {
            return this.csrfToken;
        };

        // Add missing renderMessages function if not already defined
        if (!ModernChatApp.prototype.renderMessages) {
            ModernChatApp.prototype.renderMessages = function() {
                console.log('Rendering messages:', this.messages.length);
                const messagesContainer = document.getElementById('messagesList');
                if (!messagesContainer) return;
                
                // Clear current messages
                messagesContainer.innerHTML = '';
                
                // No messages yet
                if (this.messages.length === 0) {
                    messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
                    return;
                }
                
                // Group messages by date
                const messagesByDate = {};
                this.messages.forEach(message => {
                    const date = new Date(message.created_at);
                    const dateStr = date.toDateString();
                    
                    if (!messagesByDate[dateStr]) {
                        messagesByDate[dateStr] = [];
                    }
                    messagesByDate[dateStr].push(message);
                });
                
                // Render messages by date
                Object.entries(messagesByDate).forEach(([dateStr, messages]) => {
                    // Add date separator
                    const dateSeparator = document.createElement('div');
                    dateSeparator.className = 'date-separator';
                    dateSeparator.innerHTML = `<span>${this.formatDate(dateStr)}</span>`;
                    messagesContainer.appendChild(dateSeparator);
                    
                    // Add messages for this date
                    messages.forEach(message => {
                        const messageHTML = this.renderMessage(message);
                        messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
                    });
                });
                
                // Scroll to the bottom
                this.scrollToBottom();
            };
        }

        // Add missing renderMessage function if not already defined
        if (!ModernChatApp.prototype.renderMessage) {
            ModernChatApp.prototype.renderMessage = function(message) {
                const isCurrentUser = message.user_id == this.currentUserId;
                const messageClass = isCurrentUser ? 'message-item outgoing' : 'message-item incoming';
                const timeStr = this.formatTime(message.created_at);
                
                // Handle different message types
                let messageContent = '';
                switch (message.message_type) {
                    case 'text':
                        messageContent = `<div class="message-text">${this.formatMessageText(message.content)}</div>`;
                        break;
                    case 'image':
                        messageContent = `
                            <div class="message-image">
                                <img src="${message.file_path}" alt="Image" />
                            </div>
                        `;
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
                        messageContent = `<div class="message-text">${this.formatMessageText(message.content)}</div>`;
                }
                
                // Add reply if present
                let replyHTML = '';
                if (message.reply_to_id && message.reply_content) {
                    replyHTML = `
                        <div class="message-reply">
                            <div class="reply-content">
                                <span class="reply-username">${message.reply_username}</span>
                                <p>${message.reply_content}</p>
                            </div>
                        </div>
                    `;
                }
                
                // Add reactions if present
                let reactionsHTML = '';
                if (message.reactions && message.reactions.length > 0) {
                    // Group reactions by emoji
                    const groupedReactions = {};
                    message.reactions.forEach(reaction => {
                        if (!groupedReactions[reaction.emoji]) {
                            groupedReactions[reaction.emoji] = [];
                        }
                        groupedReactions[reaction.emoji].push(reaction);
                    });
                    
                    // Create reaction badges
                    reactionsHTML = '<div class="message-reactions">';
                    Object.entries(groupedReactions).forEach(([emoji, users]) => {
                        const userNames = users.map(r => r.username).join(', ');
                        reactionsHTML += `
                            <button class="reaction-badge" title="${userNames}">
                                ${emoji} <span class="reaction-count">${users.length}</span>
                            </button>
                        `;
                    });
                    reactionsHTML += '</div>';
                }
                
                // Message actions menu
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
                
                return `
                    <div class="${messageClass}" data-id="${message.id}">
                        <div class="message-avatar">
                            <img src="${message.avatar || 'assets/images/default-avatar.svg'}" alt="${message.username}" />
                        </div>
                        <div class="message-bubble">
                            <div class="message-info">
                                <span class="message-sender">${message.display_name || message.username}</span>
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

        // Add missing helper functions for formatting
        ModernChatApp.prototype.formatMessageText = function(text) {
            if (!text) return '';
            
            // Convert URLs to links
            text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
            
            // Convert line breaks to <br>
            text = text.replace(/\n/g, '<br>');
            
            return text;
        };
        
        ModernChatApp.prototype.formatTime = function(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        
        ModernChatApp.prototype.formatDate = function(dateStr) {
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (date.toDateString() === today.toDateString()) {
                return 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                return 'Yesterday';
            } else {
                return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
            }
        };
        
        ModernChatApp.prototype.formatFileSize = function(bytes) {
            if (!bytes) return '';
            
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes === 0) return '0 Byte';
            const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        };
        
        ModernChatApp.prototype.scrollToBottom = function() {
            const messagesContainer = document.getElementById('messagesContainer');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };

        console.log('Extended ModernChatApp with missing functions');
})();
