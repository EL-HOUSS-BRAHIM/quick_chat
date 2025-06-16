/**
 * Advanced Chat Features - Message Reactions
 * Handles message reactions, replies, editing, and other advanced features
 */

class MessageReactionsManager {
    constructor() {
        this.reactions = new Map(); // messageId -> reactions
        this.reactionPicker = null;
        this.currentMessage = null;
        this.popularReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉'];
        
        this.init();
    }

    init() {
        this.createReactionComponents();
        this.bindEvents();
        this.loadReactions();
    }

    createReactionComponents() {
        // Create reaction picker
        const reactionPicker = document.createElement('div');
        reactionPicker.id = 'reaction-picker';
        reactionPicker.className = 'reaction-picker';
        reactionPicker.innerHTML = `
            <div class="reaction-picker-content">
                <div class="popular-reactions">
                    ${this.popularReactions.map(emoji => `
                        <button class="reaction-btn" data-emoji="${emoji}" 
                                onclick="messageReactions.selectReaction('${emoji}')">
                            ${emoji}
                        </button>
                    `).join('')}
                </div>
                <div class="reaction-categories">
                    <div class="category-tabs">
                        <button class="category-tab active" data-category="recent">Recent</button>
                        <button class="category-tab" data-category="people">People</button>
                        <button class="category-tab" data-category="nature">Nature</button>
                        <button class="category-tab" data-category="objects">Objects</button>
                        <button class="category-tab" data-category="symbols">Symbols</button>
                    </div>
                    <div class="emoji-grid" id="emoji-grid">
                        <!-- Emojis will be loaded here -->
                    </div>
                </div>
                <div class="reaction-search">
                    <input type="text" placeholder="Search reactions..." 
                           onkeyup="messageReactions.searchReactions(this.value)">
                </div>
            </div>
        `;

        // Create message context menu
        const messageContextMenu = document.createElement('div');
        messageContextMenu.id = 'message-context-menu';
        messageContextMenu.className = 'context-menu';
        messageContextMenu.innerHTML = `
            <div class="context-menu-item" onclick="messageReactions.showReactionPicker()">
                <i class="fas fa-smile"></i>
                <span>Add Reaction</span>
            </div>
            <div class="context-menu-item" onclick="messageReactions.replyToMessage()">
                <i class="fas fa-reply"></i>
                <span>Reply</span>
            </div>
            <div class="context-menu-item" onclick="messageReactions.editMessage()">
                <i class="fas fa-edit"></i>
                <span>Edit</span>
            </div>
            <div class="context-menu-item" onclick="messageReactions.copyMessage()">
                <i class="fas fa-copy"></i>
                <span>Copy</span>
            </div>
            <div class="context-menu-item" onclick="messageReactions.forwardMessage()">
                <i class="fas fa-share"></i>
                <span>Forward</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" onclick="messageReactions.deleteMessage()">
                <i class="fas fa-trash"></i>
                <span>Delete</span>
            </div>
        `;

        // Create reply interface
        const replyInterface = document.createElement('div');
        replyInterface.id = 'reply-interface';
        replyInterface.className = 'reply-interface';
        replyInterface.innerHTML = `
            <div class="reply-content">
                <div class="reply-header">
                    <span class="reply-label">Replying to:</span>
                    <button class="close-reply" onclick="messageReactions.cancelReply()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="reply-message">
                    <div class="reply-author" id="reply-author"></div>
                    <div class="reply-text" id="reply-text"></div>
                </div>
            </div>
        `;

        // Create edit interface
        const editInterface = document.createElement('div');
        editInterface.id = 'edit-interface';
        editInterface.className = 'edit-interface';
        editInterface.innerHTML = `
            <div class="edit-content">
                <div class="edit-header">
                    <span class="edit-label">Editing message:</span>
                    <button class="close-edit" onclick="messageReactions.cancelEdit()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="edit-input">
                    <textarea id="edit-message-text" placeholder="Edit your message..."></textarea>
                    <div class="edit-actions">
                        <button class="btn btn-secondary" onclick="messageReactions.cancelEdit()">
                            Cancel
                        </button>
                        <button class="btn btn-primary" onclick="messageReactions.saveEdit()">
                            Save
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add components to DOM
        document.body.appendChild(reactionPicker);
        document.body.appendChild(messageContextMenu);
        document.body.appendChild(replyInterface);
        document.body.appendChild(editInterface);

        // Store references
        this.reactionPicker = reactionPicker;
        this.messageContextMenu = messageContextMenu;
        this.replyInterface = replyInterface;
        this.editInterface = editInterface;
    }

    bindEvents() {
        // Click outside to close components
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.reaction-picker') && !e.target.closest('.reaction-trigger')) {
                this.hideReactionPicker();
            }
            if (!e.target.closest('.context-menu') && !e.target.closest('.message-item')) {
                this.hideContextMenu();
            }
        });

        // Message hover events for reaction triggers
        document.addEventListener('mouseover', (e) => {
            const messageElement = e.target.closest('.message-item');
            if (messageElement) {
                this.showReactionTrigger(messageElement);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const messageElement = e.target.closest('.message-item');
            if (messageElement && !messageElement.contains(e.relatedTarget)) {
                this.hideReactionTrigger(messageElement);
            }
        });

        // Right-click context menu
        document.addEventListener('contextmenu', (e) => {
            const messageElement = e.target.closest('.message-item');
            if (messageElement) {
                e.preventDefault();
                this.showContextMenu(e, messageElement);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllInterfaces();
            }
        });

        // Message reactions click events
        document.addEventListener('click', (e) => {
            if (e.target.closest('.message-reaction')) {
                const reactionElement = e.target.closest('.message-reaction');
                const messageId = reactionElement.closest('.message-item').dataset.messageId;
                const emoji = reactionElement.dataset.emoji;
                this.toggleReaction(messageId, emoji);
            }
        });
    }

    showReactionTrigger(messageElement) {
        // Remove existing trigger
        const existingTrigger = messageElement.querySelector('.reaction-trigger');
        if (existingTrigger) return;

        // Create reaction trigger button
        const trigger = document.createElement('button');
        trigger.className = 'reaction-trigger';
        trigger.innerHTML = '<i class="fas fa-smile"></i>';
        trigger.onclick = (e) => {
            e.stopPropagation();
            this.currentMessage = messageElement;
            this.showReactionPicker(e);
        };

        // Position trigger
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContent) {
            messageContent.appendChild(trigger);
        }
    }

    hideReactionTrigger(messageElement) {
        const trigger = messageElement.querySelector('.reaction-trigger');
        if (trigger) {
            trigger.remove();
        }
    }

    showReactionPicker(event = null) {
        if (!this.currentMessage) return;

        this.reactionPicker.style.display = 'block';
        this.reactionPicker.classList.add('show');

        // Position picker
        if (event) {
            const rect = event.target.getBoundingClientRect();
            this.reactionPicker.style.top = (rect.top - 250) + 'px';
            this.reactionPicker.style.left = rect.left + 'px';
        }

        // Load emoji categories
        this.loadEmojiCategory('recent');
    }

    hideReactionPicker() {
        this.reactionPicker.classList.remove('show');
        setTimeout(() => {
            this.reactionPicker.style.display = 'none';
        }, 300);
    }

    showContextMenu(event, messageElement) {
        this.currentMessage = messageElement;
        
        this.messageContextMenu.style.display = 'block';
        this.messageContextMenu.style.top = event.pageY + 'px';
        this.messageContextMenu.style.left = event.pageX + 'px';

        // Check if user can edit/delete message
        const userId = messageElement.dataset.userId;
        const currentUserId = window.currentUser?.id;
        
        const editItem = this.messageContextMenu.querySelector('.context-menu-item:nth-child(3)');
        const deleteItem = this.messageContextMenu.querySelector('.context-menu-item:last-child');
        
        if (userId !== currentUserId) {
            editItem.style.display = 'none';
            deleteItem.style.display = 'none';
        } else {
            editItem.style.display = 'flex';
            deleteItem.style.display = 'flex';
        }
    }

    hideContextMenu() {
        this.messageContextMenu.style.display = 'none';
    }

    async selectReaction(emoji) {
        if (!this.currentMessage) return;

        const messageId = this.currentMessage.dataset.messageId;
        await this.addReaction(messageId, emoji);
        this.hideReactionPicker();
    }

    async addReaction(messageId, emoji) {
        try {
            const response = await fetch('api/reactions.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'add',
                    messageId: messageId,
                    emoji: emoji
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.updateMessageReactions(messageId, result.reactions);
                this.addToRecentReactions(emoji);
            } else {
                console.error('Failed to add reaction:', result.error);
            }
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    }

    async removeReaction(messageId, emoji) {
        try {
            const response = await fetch('api/reactions.php', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'remove',
                    messageId: messageId,
                    emoji: emoji
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.updateMessageReactions(messageId, result.reactions);
            }
        } catch (error) {
            console.error('Error removing reaction:', error);
        }
    }

    async toggleReaction(messageId, emoji) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        const reactionElement = messageElement.querySelector(`[data-emoji="${emoji}"]`);
        
        if (reactionElement && reactionElement.classList.contains('user-reacted')) {
            await this.removeReaction(messageId, emoji);
        } else {
            await this.addReaction(messageId, emoji);
        }
    }

    updateMessageReactions(messageId, reactions) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        let reactionsContainer = messageElement.querySelector('.message-reactions');
        
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'message-reactions';
            messageElement.querySelector('.message-content').appendChild(reactionsContainer);
        }

        // Clear existing reactions
        reactionsContainer.innerHTML = '';

        // Add reactions
        if (reactions && reactions.length > 0) {
            reactions.forEach(reaction => {
                const reactionElement = document.createElement('button');
                reactionElement.className = 'message-reaction';
                reactionElement.dataset.emoji = reaction.emoji;
                
                if (reaction.userReacted) {
                    reactionElement.classList.add('user-reacted');
                }
                
                reactionElement.innerHTML = `
                    <span class="reaction-emoji">${reaction.emoji}</span>
                    <span class="reaction-count">${reaction.count}</span>
                `;
                
                reactionElement.title = reaction.users.join(', ');
                reactionsContainer.appendChild(reactionElement);
            });
        }

        // Store reactions data
        this.reactions.set(messageId, reactions);
    }

    // Reply functionality
    replyToMessage() {
        if (!this.currentMessage) return;

        const messageId = this.currentMessage.dataset.messageId;
        const author = this.currentMessage.querySelector('.message-author').textContent;
        const text = this.currentMessage.querySelector('.message-text').textContent;

        document.getElementById('reply-author').textContent = author;
        document.getElementById('reply-text').textContent = text.length > 100 ? 
            text.substring(0, 100) + '...' : text;

        this.replyInterface.style.display = 'block';
        this.replyInterface.classList.add('show');
        this.replyInterface.dataset.replyToId = messageId;

        this.hideContextMenu();
        
        // Focus message input
        const messageInput = document.getElementById('message-input');
        if (messageInput) messageInput.focus();
    }

    cancelReply() {
        this.replyInterface.classList.remove('show');
        setTimeout(() => {
            this.replyInterface.style.display = 'none';
            delete this.replyInterface.dataset.replyToId;
        }, 300);
    }

    // Edit functionality
    editMessage() {
        if (!this.currentMessage) return;

        const messageId = this.currentMessage.dataset.messageId;
        const messageText = this.currentMessage.querySelector('.message-text').textContent;

        document.getElementById('edit-message-text').value = messageText;
        
        this.editInterface.style.display = 'block';
        this.editInterface.classList.add('show');
        this.editInterface.dataset.editMessageId = messageId;

        this.hideContextMenu();
        
        // Focus edit textarea
        document.getElementById('edit-message-text').focus();
    }

    async saveEdit() {
        const messageId = this.editInterface.dataset.editMessageId;
        const newText = document.getElementById('edit-message-text').value.trim();

        if (!newText) {
            this.showNotification('Message cannot be empty', 'error');
            return;
        }

        try {
            const response = await fetch('api/messages.php', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'edit',
                    messageId: messageId,
                    text: newText
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // Update message in UI
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                const messageTextElement = messageElement.querySelector('.message-text');
                messageTextElement.textContent = newText;
                
                // Add edited indicator
                let editedIndicator = messageElement.querySelector('.edited-indicator');
                if (!editedIndicator) {
                    editedIndicator = document.createElement('span');
                    editedIndicator.className = 'edited-indicator';
                    editedIndicator.textContent = ' (edited)';
                    messageTextElement.appendChild(editedIndicator);
                }

                this.cancelEdit();
                this.showNotification('Message updated successfully', 'success');
            } else {
                this.showNotification(result.error || 'Failed to edit message', 'error');
            }
        } catch (error) {
            console.error('Error editing message:', error);
            this.showNotification('Failed to edit message', 'error');
        }
    }

    cancelEdit() {
        this.editInterface.classList.remove('show');
        setTimeout(() => {
            this.editInterface.style.display = 'none';
            delete this.editInterface.dataset.editMessageId;
            document.getElementById('edit-message-text').value = '';
        }, 300);
    }

    // Other message actions
    copyMessage() {
        if (!this.currentMessage) return;

        const messageText = this.currentMessage.querySelector('.message-text').textContent;
        
        navigator.clipboard.writeText(messageText).then(() => {
            this.showNotification('Message copied to clipboard', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = messageText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification('Message copied to clipboard', 'success');
        });

        this.hideContextMenu();
    }

    forwardMessage() {
        if (!this.currentMessage) return;

        const messageId = this.currentMessage.dataset.messageId;
        const messageText = this.currentMessage.querySelector('.message-text').textContent;
        
        // Trigger forward modal (implement as needed)
        document.dispatchEvent(new CustomEvent('showForwardModal', {
            detail: { messageId, messageText }
        }));

        this.hideContextMenu();
    }

    async deleteMessage() {
        if (!this.currentMessage) return;
        
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }

        const messageId = this.currentMessage.dataset.messageId;

        try {
            const response = await fetch('api/messages.php', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'delete',
                    messageId: messageId
                })
            });

            const result = await response.json();
            
            if (result.success) {
                // Remove message from UI
                this.currentMessage.classList.add('deleted');
                setTimeout(() => {
                    this.currentMessage.remove();
                }, 300);

                this.showNotification('Message deleted', 'success');
            } else {
                this.showNotification(result.error || 'Failed to delete message', 'error');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            this.showNotification('Failed to delete message', 'error');
        }

        this.hideContextMenu();
    }

    // Emoji utilities
    loadEmojiCategory(category) {
        const emojiGrid = document.getElementById('emoji-grid');
        
        // Update active tab
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');

        // Load emojis based on category
        const emojis = this.getEmojisByCategory(category);
        
        emojiGrid.innerHTML = emojis.map(emoji => `
            <button class="emoji-btn" onclick="messageReactions.selectReaction('${emoji}')">
                ${emoji}
            </button>
        `).join('');
    }

    getEmojisByCategory(category) {
        const emojiCategories = {
            recent: this.getRecentReactions(),
            people: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'],
            nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🌱', '🌿'],
            objects: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳'],
            symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️']
        };

        return emojiCategories[category] || [];
    }

    searchReactions(query) {
        if (!query) {
            this.loadEmojiCategory('recent');
            return;
        }

        // Simple emoji search implementation
        const allEmojis = [
            ...this.getEmojisByCategory('people'),
            ...this.getEmojisByCategory('nature'),
            ...this.getEmojisByCategory('objects'),
            ...this.getEmojisByCategory('symbols')
        ];

        // Filter emojis (this is a simplified implementation)
        const filteredEmojis = allEmojis.slice(0, 20); // Show first 20 for demo

        const emojiGrid = document.getElementById('emoji-grid');
        emojiGrid.innerHTML = filteredEmojis.map(emoji => `
            <button class="emoji-btn" onclick="messageReactions.selectReaction('${emoji}')">
                ${emoji}
            </button>
        `).join('');
    }

    getRecentReactions() {
        const recent = localStorage.getItem('recentReactions');
        return recent ? JSON.parse(recent) : this.popularReactions.slice(0, 6);
    }

    addToRecentReactions(emoji) {
        let recent = this.getRecentReactions();
        
        // Remove if already exists
        recent = recent.filter(e => e !== emoji);
        
        // Add to beginning
        recent.unshift(emoji);
        
        // Keep only last 20
        recent = recent.slice(0, 20);
        
        localStorage.setItem('recentReactions', JSON.stringify(recent));
    }

    async loadReactions() {
        try {
            const response = await fetch('api/reactions.php?action=getAll');
            const result = await response.json();
            
            if (result.success && result.data) {
                result.data.forEach(messageReaction => {
                    this.updateMessageReactions(messageReaction.messageId, messageReaction.reactions);
                });
            }
        } catch (error) {
            console.error('Error loading reactions:', error);
        }
    }

    hideAllInterfaces() {
        this.hideReactionPicker();
        this.hideContextMenu();
        this.cancelReply();
        this.cancelEdit();
    }

    showNotification(message, type = 'info') {
        // Create or update notification
        let notification = document.getElementById('reaction-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'reaction-notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        notification.className = `notification ${type} show`;
        notification.textContent = message;
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Public API for integration
    getMessageReactions(messageId) {
        return this.reactions.get(messageId) || [];
    }

    setCurrentMessage(messageElement) {
        this.currentMessage = messageElement;
    }

    isReplyMode() {
        return this.replyInterface.style.display === 'block';
    }

    getReplyToId() {
        return this.replyInterface.dataset.replyToId || null;
    }
}

// Initialize message reactions manager
window.messageReactions = new MessageReactionsManager();
