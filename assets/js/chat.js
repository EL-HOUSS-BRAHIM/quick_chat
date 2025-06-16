// chat.js - Enhanced chat logic for Quick Chat

document.addEventListener('DOMContentLoaded', function() {
    // Chat state
    const state = {
        isEmojiPickerVisible: false,
        isTyping: false,
        typingTimeout: null,
        previousMessages: [],
        historyIndex: -1,
        soundEnabled: localStorage.getItem('soundEnabled') !== 'false',
        unreadMessages: 0,
        pendingFileUploads: new Map(),
        replyingTo: null,
        editingMessage: null,
        userMentions: new Set(),
        visibilityState: document.visibilityState
    };

    // Elements
    const elements = {
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        messagesContainer: document.getElementById('messagesContainer'),
        charCount: document.getElementById('charCount'),
        emojiBtn: document.getElementById('emojiBtn'),
        emojiPicker: document.getElementById('emojiPicker'),
        themeToggle: document.getElementById('themeToggle'),
        fileBtn: document.getElementById('fileBtn'),
        fileInput: document.getElementById('fileInput'),
        typingIndicator: document.getElementById('typingIndicator'),
        soundToggle: document.getElementById('soundToggle'),
        messageTemplate: document.getElementById('messageTemplate'),
        userList: document.getElementById('userList'),
        unreadBadge: document.getElementById('unreadBadge')
    };

    // Wait for DOM to be ready before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChat);
    } else {
        // DOM is already ready
        initChat();
    }

    /**
     * Initialize chat features
     */
    function initChat() {
        bindEvents();
        loadTheme();
        setupDragAndDrop();
        setupKeyboardShortcuts();
        setupVisibilityTracking();
        setupUserMentionsSupport();
        loadChatPreferences();
    }

    /**
     * Load user preferences from storage
     */
    function loadChatPreferences() {
        // Load sound preference
        if (elements.soundToggle) {
            elements.soundToggle.checked = state.soundEnabled;
        }

        // Load message history
        try {
            const storedHistory = localStorage.getItem('messageHistory');
            if (storedHistory) {
                state.previousMessages = JSON.parse(storedHistory).slice(0, 10);
            }
        } catch (e) {
            console.error('Failed to load message history:', e);
        }
    }

    /**
     * Save chat preferences to storage
     */
    function saveChatPreferences() {
        // Save sound preference
        localStorage.setItem('soundEnabled', state.soundEnabled.toString());
        
        // Save message history
        try {
            localStorage.setItem('messageHistory', JSON.stringify(state.previousMessages.slice(0, 10)));
        } catch (e) {
            console.error('Failed to save message history:', e);
        }
    }

    /**
     * Set up tracking for visibility changes
     */
    function setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            const wasHidden = state.visibilityState === 'hidden';
            state.visibilityState = document.visibilityState;
            
            if (wasHidden && state.visibilityState === 'visible') {
                // User returned to the tab
                if (state.unreadMessages > 0) {
                    resetUnreadCounter();
                }
                scrollToBottom();
            }
        });
    }

    /**
     * Set up drag and drop functionality for file uploads
     */
    function setupDragAndDrop() {
        if (!elements.messagesContainer) return;

        let dragCounter = 0;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            elements.messagesContainer.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        // Highlight drop area
        ['dragenter', 'dragover'].forEach(eventName => {
            elements.messagesContainer.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            elements.messagesContainer.addEventListener(eventName, unhighlight, false);
        });

        // Handle dropped files
        elements.messagesContainer.addEventListener('drop', handleDrop, false);

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function highlight(e) {
            if (e.type === 'dragenter') {
                dragCounter++;
            }
            elements.messagesContainer.classList.add('drag-over');
        }

        function unhighlight(e) {
            if (e.type === 'dragleave') {
                dragCounter--;
                if (dragCounter === 0) {
                    elements.messagesContainer.classList.remove('drag-over');
                }
            } else if (e.type === 'drop') {
                dragCounter = 0;
                elements.messagesContainer.classList.remove('drag-over');
            }
        }

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                handleFileUpload(files);
            }
        }
    }

    /**
     * Reset unread message counter
     */
    function resetUnreadCounter() {
        state.unreadMessages = 0;
        updateUnreadBadge();
    }

    /**
     * Update unread message badge
     */
    function updateUnreadBadge() {
        if (elements.unreadBadge) {
            if (state.unreadMessages > 0) {
                elements.unreadBadge.textContent = state.unreadMessages > 99 ? '99+' : state.unreadMessages;
                elements.unreadBadge.classList.remove('hidden');
            } else {
                elements.unreadBadge.classList.add('hidden');
            }
        }

        // Update page title with unread count
        if (state.unreadMessages > 0) {
            document.title = `(${state.unreadMessages}) Quick Chat`;
        } else {
            document.title = 'Quick Chat';
        }
    }

    /**
     * Set up keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Alt+S to toggle sound
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                toggleSound();
            }
            
            // Alt+T to toggle theme
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                toggleTheme();
            }
            
            // Alt+E to open emoji picker
            if (e.altKey && e.key === 'e') {
                e.preventDefault();
                toggleEmojiPicker();
            }
            
            // Alt+U to upload file
            if (e.altKey && e.key === 'u' && elements.fileInput) {
                e.preventDefault();
                elements.fileInput.click();
            }
            
            // Escape to cancel reply/edit
            if (e.key === 'Escape') {
                if (state.replyingTo) {
                    cancelReply();
                    e.preventDefault();
                } else if (state.editingMessage) {
                    cancelEdit();
                    e.preventDefault();
                }
            }
        });
    }

    /**
     * Set up user mentions support
     */
    function setupUserMentionsSupport() {
        if (!elements.messageInput) return;

        elements.messageInput.addEventListener('input', function() {
            // Check for @ symbol to trigger mentions
            const value = elements.messageInput.value;
            const cursorPos = elements.messageInput.selectionStart;
            const textBeforeCursor = value.substring(0, cursorPos);
            
            // Find @ symbol before cursor
            const lastAtPos = textBeforeCursor.lastIndexOf('@');
            if (lastAtPos !== -1) {
                const textAfterAt = textBeforeCursor.substring(lastAtPos + 1);
                // Check if we have a valid mention query (no spaces)
                if (textAfterAt.indexOf(' ') === -1) {
                    showUserMentionSuggestions(textAfterAt, lastAtPos);
                    return;
                }
            }
            
            // Hide suggestions if no @ found or invalid query
            hideUserMentionSuggestions();
        });
    }

    /**
     * Show user mention suggestions
     * @param {string} query - Search query
     * @param {number} atPosition - Position of @ symbol
     */
    function showUserMentionSuggestions(query, atPosition) {
        // Implement with integration.js
        if (window.quickChatApp && typeof window.quickChatApp.getUserSuggestions === 'function') {
            window.quickChatApp.getUserSuggestions(query, atPosition);
        }
    }

    /**
     * Hide user mention suggestions
     */
    function hideUserMentionSuggestions() {
        // Implement with integration.js
        if (window.quickChatApp && typeof window.quickChatApp.hideUserSuggestions === 'function') {
            window.quickChatApp.hideUserSuggestions();
        }
    }

    /**
     * Toggle sound notifications
     */
    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        if (elements.soundToggle) {
            elements.soundToggle.checked = state.soundEnabled;
        }
        
        saveChatPreferences();
        
        showToast(`Sound notifications ${state.soundEnabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Show toast message
     * @param {string} message - Message to display
     * @param {string} type - Toast type (info, success, warning, error)
     */
    function showToast(message, type = 'info') {
        if (window.utils && typeof window.utils.showToast === 'function') {
            window.utils.showToast(message, type);
        } else if (window.quickChatApp && typeof window.quickChatApp.showToast === 'function') {
            window.quickChatApp.showToast(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Handle input in message input field
     */
    function handleInput() {
        if (!elements.messageInput || !elements.charCount) return;
        
        const currentLength = elements.messageInput.value.length;
        const maxLength = elements.messageInput.maxLength || 2000;
        
        elements.charCount.textContent = currentLength;
        
        // Update character count color based on length
        if (currentLength > maxLength * 0.9) {
            elements.charCount.style.color = '#ff4444';
        } else if (currentLength > maxLength * 0.8) {
            elements.charCount.style.color = '#ff8800';
        } else {
            elements.charCount.style.color = '';
        }
    }

    /**
     * Send message
     */
    function sendMessage() {
        if (!elements.messageInput) return;
        
        const content = elements.messageInput.value.trim();
        if (!content) return;
        
        // Use the app's sendMessage if available
        if (window.quickChatApp && typeof window.quickChatApp.sendMessage === 'function') {
            window.quickChatApp.sendMessage(content);
        } else {
            console.log('No app sendMessage method available');
        }
        
        // Clear input
        elements.messageInput.value = '';
        handleInput(); // Update character count
    }

    /**
     * Handle keydown events in message input
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow new line with Shift+Enter
                return;
            } else {
                // Send message with Enter
                e.preventDefault();
                sendMessage();
            }
        } else if (e.key === 'ArrowUp' && elements.messageInput.value === '') {
            // Edit last message
            if (state.previousMessages.length > 0) {
                e.preventDefault();
                const lastMessage = state.previousMessages[state.previousMessages.length - 1];
                elements.messageInput.value = lastMessage;
                handleInput();
            }
        }
    }

    /**
     * Handle paste events
     * @param {ClipboardEvent} e - Paste event
     */
    function handlePaste(e) {
        // Let the app handle paste events if available
        if (window.quickChatApp && typeof window.quickChatApp.handlePaste === 'function') {
            window.quickChatApp.handlePaste(e);
        }
    }

    /**
     * Toggle emoji picker visibility
     */
    function toggleEmojiPicker() {
        if (!elements.emojiPicker) return;
        
        state.isEmojiPickerVisible = !state.isEmojiPickerVisible;
        
        if (state.isEmojiPickerVisible) {
            elements.emojiPicker.style.display = 'block';
            setupEmojiPicker();
        } else {
            elements.emojiPicker.style.display = 'none';
        }
    }

    /**
     * Handle file selection
     * @param {Event} e - File input change event
     */
    function handleFileSelect(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files);
        }
    }

    /**
     * Toggle theme
     */
    function toggleTheme() {
        if (window.quickChatApp && typeof window.quickChatApp.toggleTheme === 'function') {
            window.quickChatApp.toggleTheme();
        }
    }

    /**
     * Setup emoji picker with emojis from config
     */
    function setupEmojiPicker() {
        if (!elements.emojiPicker || !window.ChatConfig || !window.ChatConfig.emojiCategories) return;
        
        const emojiGrid = elements.emojiPicker.querySelector('.emoji-grid');
        if (!emojiGrid) return;
        
        // Clear existing emojis
        emojiGrid.innerHTML = '';
        
        // Add emojis from first category (smileys)
        const smileys = window.ChatConfig.emojiCategories.smileys || [];
        smileys.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-button';
            emojiBtn.textContent = emoji;
            emojiBtn.addEventListener('click', () => {
                insertEmoji(emoji);
            });
            emojiGrid.appendChild(emojiBtn);
        });
    }

    /**
     * Insert emoji into message input
     * @param {string} emoji - Emoji to insert
     */
    function insertEmoji(emoji) {
        if (!elements.messageInput) return;
        
        const cursorPos = elements.messageInput.selectionStart;
        const textBefore = elements.messageInput.value.substring(0, cursorPos);
        const textAfter = elements.messageInput.value.substring(elements.messageInput.selectionEnd);
        
        elements.messageInput.value = textBefore + emoji + textAfter;
        elements.messageInput.selectionStart = elements.messageInput.selectionEnd = cursorPos + emoji.length;
        
        handleInput(); // Update character count
        elements.messageInput.focus();
        
        // Hide emoji picker
        hideEmojiPicker();
    }

    /**
     * Send message
     */
    function sendMessage() {
        if (!elements.messageInput) return;
        
        const content = elements.messageInput.value.trim();
        if (!content) return;
        
        // Use the app's sendMessage if available
        if (window.quickChatApp && typeof window.quickChatApp.sendMessage === 'function') {
            window.quickChatApp.sendMessage(content);
        } else {
            console.log('No app sendMessage method available');
        }
        
        // Clear input
        elements.messageInput.value = '';
        handleInput(); // Update character count
    }

    /**
     * Handle keydown events in message input
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Allow new line with Shift+Enter
                return;
            } else {
                // Send message with Enter
                e.preventDefault();
                sendMessage();
            }
        } else if (e.key === 'ArrowUp' && elements.messageInput.value === '') {
            // Edit last message
            if (state.previousMessages.length > 0) {
                e.preventDefault();
                const lastMessage = state.previousMessages[state.previousMessages.length - 1];
                elements.messageInput.value = lastMessage;
                handleInput();
            }
        }
    }

    /**
     * Handle paste events
     * @param {ClipboardEvent} e - Paste event
     */
    function handlePaste(e) {
        // Let the app handle paste events if available
        if (window.quickChatApp && typeof window.quickChatApp.handlePaste === 'function') {
            window.quickChatApp.handlePaste(e);
        }
    }

    /**
     * Toggle emoji picker visibility
     */
    function toggleEmojiPicker() {
        if (!elements.emojiPicker) return;
        
        state.isEmojiPickerVisible = !state.isEmojiPickerVisible;
        
        if (state.isEmojiPickerVisible) {
            elements.emojiPicker.style.display = 'block';
            setupEmojiPicker();
        } else {
            elements.emojiPicker.style.display = 'none';
        }
    }

    /**
     * Handle file selection
     * @param {Event} e - File input change event
     */
    function handleFileSelect(e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files);
        }
    }

    /**
     * Toggle theme
     */
    function toggleTheme() {
        if (window.quickChatApp && typeof window.quickChatApp.toggleTheme === 'function') {
            window.quickChatApp.toggleTheme();
        }
    }

    /**
     * Setup emoji picker with emojis from config
     */
    function setupEmojiPicker() {
        if (!elements.emojiPicker || !window.ChatConfig || !window.ChatConfig.emojiCategories) return;
        
        const emojiGrid = elements.emojiPicker.querySelector('.emoji-grid');
        if (!emojiGrid) return;
        
        // Clear existing emojis
        emojiGrid.innerHTML = '';
        
        // Add emojis from first category (smileys)
        const smileys = window.ChatConfig.emojiCategories.smileys || [];
        smileys.forEach(emoji => {
            const emojiBtn = document.createElement('button');
            emojiBtn.className = 'emoji-button';
            emojiBtn.textContent = emoji;
            emojiBtn.addEventListener('click', () => {
                insertEmoji(emoji);
            });
            emojiGrid.appendChild(emojiBtn);
        });
    }

    /**
     * Insert emoji into message input
     * @param {string} emoji - Emoji to insert
     */
    function insertEmoji(emoji) {
        if (!elements.messageInput) return;
        
        const cursorPos = elements.messageInput.selectionStart;
        const textBefore = elements.messageInput.value.substring(0, cursorPos);
        const textAfter = elements.messageInput.value.substring(elements.messageInput.selectionEnd);
        
        elements.messageInput.value = textBefore + emoji + textAfter;
        elements.messageInput.selectionStart = elements.messageInput.selectionEnd = cursorPos + emoji.length;
        
        handleInput(); // Update character count
        elements.messageInput.focus();
        
        // Hide emoji picker
        hideEmojiPicker();
    }

    /**
     * Bind all event listeners
     */
    function bindEvents() {
        // Character count
        if (elements.messageInput && elements.charCount) {
            elements.messageInput.addEventListener('input', handleInput);
        }

        // Send message
        if (elements.sendBtn && elements.messageInput) {
            elements.sendBtn.addEventListener('click', sendMessage);
            elements.messageInput.addEventListener('keydown', handleKeyDown);
            elements.messageInput.addEventListener('paste', handlePaste);
        }

        // Emoji picker
        if (elements.emojiBtn && elements.emojiPicker) {
            elements.emojiBtn.addEventListener('click', toggleEmojiPicker);
            // Close emoji picker when clicking outside
            document.addEventListener('click', function(e) {
                if (e.target !== elements.emojiBtn && !elements.emojiPicker.contains(e.target)) {
                    hideEmojiPicker();
                }
            });
        }

        // Theme toggle
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', toggleTheme);
        }

        // Sound toggle
        if (elements.soundToggle) {
            elements.soundToggle.addEventListener('change', function() {
                state.soundEnabled = elements.soundToggle.checked;
                saveChatPreferences();
            });
        }

        // File upload
        if (elements.fileBtn && elements.fileInput) {
            elements.fileBtn.addEventListener('click', function() {
                elements.fileInput.click();
            });
            elements.fileInput.addEventListener('change', handleFileSelect);
        }

        // Setup emoji picker items if using the emoji.js module
        if (window.EmojiHelper && elements.emojiPicker) {
            setupEmojiPicker();
        }

        // Message container events for context menu and image preview
        if (elements.messagesContainer) {
            elements.messagesContainer.addEventListener('click', handleMessageClick);
            elements.messagesContainer.addEventListener('contextmenu', handleMessageContextMenu);
        }
    }

    /**
     * Handle click events within messages
     * @param {Event} e - Click event
     */
    function handleMessageClick(e) {
        // Handle image preview
        if (e.target.classList.contains('message-image')) {
            e.preventDefault();
            showImagePreview(e.target.src);
            return;
        }
        
        // Handle message actions
        if (e.target.classList.contains('message-action')) {
            e.preventDefault();
            const action = e.target.dataset.action;
            const messageId = getMessageIdFromElement(e.target);
            
            if (messageId) {
                switch (action) {
                    case 'reply':
                        replyToMessage(messageId);
                        break;
                    case 'edit':
                        startEditingMessage(messageId);
                        break;
                    case 'delete':
                        deleteMessage(messageId);
                        break;
                    case 'copy':
                        copyMessageText(messageId);
                        break;
                }
            }
            return;
        }
        
        // Handle user mention
        if (e.target.classList.contains('user-mention')) {
            e.preventDefault();
            const userId = e.target.dataset.userId;
            if (userId && window.quickChatApp && typeof window.quickChatApp.handleUserMentionClick === 'function') {
                window.quickChatApp.handleUserMentionClick(userId);
            }
            return;
        }
    }

    /**
     * Get message ID from an element within a message
     * @param {HTMLElement} element - Element inside a message
     * @returns {string|null} Message ID or null if not found
     */
    function getMessageIdFromElement(element) {
        const messageElement = element.closest('.message');
        return messageElement ? messageElement.dataset.messageId : null;
    }

    /**
     * Handle right-click context menu on messages
     * @param {Event} e - ContextMenu event
     */
    function handleMessageContextMenu(e) {
        const messageElement = e.target.closest('.message');
        if (!messageElement) return;
        
        e.preventDefault();
        
        const messageId = messageElement.dataset.messageId;
        if (!messageId) return;
        
        // Show context menu
        if (window.quickChatApp && typeof window.quickChatApp.showMessageContextMenu === 'function') {
            window.quickChatApp.showMessageContextMenu(messageId, e.clientX, e.clientY);
        }
    }

    /**
     * Start replying to a message
     * @param {string} messageId - ID of message to reply to
     */
    function replyToMessage(messageId) {
        if (!messageId) return;
        
        // Update state
        state.replyingTo = messageId;
        
        // Show reply UI
        const replyContainer = document.getElementById('replyContainer');
        if (replyContainer) {
            // Get message text
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                const userName = messageElement.querySelector('.message-user')?.textContent || 'Unknown';
                const messageText = messageElement.querySelector('.message-content')?.textContent || '';
                
                // Limit preview text length
                const previewText = messageText.length > 50 ? messageText.substring(0, 47) + '...' : messageText;
                
                // Update reply UI
                replyContainer.innerHTML = `
                    <div class="reply-preview">
                        <span class="reply-to">Replying to <strong>${userName}</strong>:</span>
                        <span class="reply-text">${previewText}</span>
                        <button class="reply-cancel" aria-label="Cancel reply">&times;</button>
                    </div>
                `;
                
                // Show the container
                replyContainer.classList.remove('hidden');
                
                // Add cancel handler
                const cancelBtn = replyContainer.querySelector('.reply-cancel');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', cancelReply);
                }
                
                // Focus input
                elements.messageInput?.focus();
            }
        }
    }

    /**
     * Cancel reply to message
     */
    function cancelReply() {
        state.replyingTo = null;
        
        const replyContainer = document.getElementById('replyContainer');
        if (replyContainer) {
            replyContainer.innerHTML = '';
            replyContainer.classList.add('hidden');
        }
    }

    /**
     * Start editing a message
     * @param {string} messageId - ID of message to edit
     */
    function startEditingMessage(messageId) {
        if (!messageId) return;
        
        // Get the message element
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        // Get current message text
        const contentElement = messageElement.querySelector('.message-content');
        if (!contentElement) return;
        
        const currentText = contentElement.textContent || '';
        
        // Update state
        state.editingMessage = {
            id: messageId,
            originalText: currentText
        };
        
        // Replace content with input field
        const editInput = document.createElement('textarea');
        editInput.className = 'edit-message-input';
        editInput.value = currentText;
        
        const editControls = document.createElement('div');
        editControls.className = 'edit-controls';
        editControls.innerHTML = `
            <button class="edit-save">Save</button>
            <button class="edit-cancel">Cancel</button>
        `;
        
        // Clear and replace content
        contentElement.innerHTML = '';
        contentElement.appendChild(editInput);
        contentElement.appendChild(editControls);
        
        // Focus input and place cursor at end
        editInput.focus();
        editInput.selectionStart = editInput.value.length;
        
        // Add event listeners for save/cancel
        const saveBtn = editControls.querySelector('.edit-save');
        const cancelBtn = editControls.querySelector('.edit-cancel');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveMessageEdit(messageId, editInput.value));
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', cancelEdit);
        }
        
        // Save on Ctrl+Enter
        editInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveMessageEdit(messageId, editInput.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
    }

    /**
     * Save edited message
     * @param {string} messageId - ID of message being edited
     * @param {string} newText - New message text
     */
    function saveMessageEdit(messageId, newText) {
        if (!messageId || !state.editingMessage) return;
        
        // Trim the text
        const trimmedText = newText.trim();
        
        if (trimmedText === '') {
            showToast('Message cannot be empty', 'error');
            return;
        }
        
        // If integrated with main app, use its method
        if (window.quickChatApp && typeof window.quickChatApp.updateMessage === 'function') {
            window.quickChatApp.updateMessage(messageId, trimmedText)
                .then(() => {
                    // Reset state after successful update
                    state.editingMessage = null;
                })
                .catch(error => {
                    showToast('Failed to update message: ' + error.message, 'error');
                });
        } else {
            // Demo mode: just update the message locally
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-content');
                if (contentElement) {
                    // Use security module if available
                    const sanitizedText = window.security && typeof window.security.sanitizeInput === 'function' 
                        ? window.security.sanitizeInput(trimmedText) 
                        : sanitizeHTML(trimmedText);
                    
                    contentElement.innerHTML = sanitizedText;
                    contentElement.appendChild(document.createElement('small')).innerHTML = ' (edited)';
                }
            }
            
            // Reset state
            state.editingMessage = null;
        }
    }

    /**
     * Cancel message editing
     */
    function cancelEdit() {
        if (!state.editingMessage) return;
        
        const messageId = state.editingMessage.id;
        const originalText = state.editingMessage.originalText;
        
        // Reset the message content
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (messageElement) {
            const contentElement = messageElement.querySelector('.message-content');
            if (contentElement) {
                // Use security module if available
                const sanitizedText = window.security && typeof window.security.sanitizeInput === 'function' 
                    ? window.security.sanitizeInput(originalText) 
                    : sanitizeHTML(originalText);
                
                contentElement.innerHTML = sanitizedText;
            }
        }
        
        // Reset state
        state.editingMessage = null;
    }

    /**
     * Delete a message
     * @param {string} messageId - ID of message to delete
     */
    function deleteMessage(messageId) {
        if (!messageId) return;
        
        // Confirm deletion
        const confirmDelete = window.confirm('Are you sure you want to delete this message?');
        if (!confirmDelete) return;
        
        // If integrated with main app, use its method
        if (window.quickChatApp && typeof window.quickChatApp.deleteMessage === 'function') {
            window.quickChatApp.deleteMessage(messageId)
                .catch(error => {
                    showToast('Failed to delete message: ' + error.message, 'error');
                });
        } else {
            // Demo mode: just remove the message from UI
            const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.classList.add('message-deleted');
                setTimeout(() => {
                    messageElement.remove();
                }, 300);
            }
        }
    }

    /**
     * Copy message text to clipboard
     * @param {string} messageId - ID of message to copy
     */
    function copyMessageText(messageId) {
        if (!messageId) return;
        
        const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        const contentElement = messageElement.querySelector('.message-content');
        if (!contentElement) return;
        
        const textToCopy = contentElement.textContent || '';
        
        // Copy to clipboard
        if (window.utils && typeof window.utils.copyToClipboard === 'function') {
            window.utils.copyToClipboard(textToCopy)
                .then(success => {
                    if (success) {
                        showToast('Message copied to clipboard', 'success');
                    } else {
                        showToast('Failed to copy message', 'error');
                    }
                });
        } else {
            try {
                navigator.clipboard.writeText(textToCopy).then(
                    () => showToast('Message copied to clipboard', 'success'),
                    () => showToast('Failed to copy message', 'error')
                );
            } catch (err) {
                showToast('Failed to copy message', 'error');
                console.error('Copy failed:', err);
            }
        }
    }

    /**
     * Show image preview
     * @param {string} src - Image source URL
     */
    function showImagePreview(src) {
        if (!src) return;
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        modal.innerHTML = `
            <div class="image-preview-container">
                <button class="image-preview-close" aria-label="Close preview">&times;</button>
                <img src="${src}" alt="Image preview" class="image-preview">
            </div>
        `;
        
        // Add to body
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
        
        // Add close handler
        const closeBtn = modal.querySelector('.image-preview-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
                document.body.classList.remove('modal-open');
            });
        }
        
        // Close on background click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
                document.body.classList.remove('modal-open');
            }
        });
        
        // Close on Escape
        const closeOnEscape = function(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.body.classList.remove('modal-open');
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    }

    /**
     * Handle file upload from drag and drop or file input
     * @param {FileList} files - Files to upload
     */
    function handleFileUpload(files) {
        if (!files || files.length === 0) return;

        // Check if file input element exists and delegate to it
        if (elements.fileInput) {
            // Create a new FileList-like object and assign to file input
            try {
                const dt = new DataTransfer();
                Array.from(files).forEach(file => {
                    dt.items.add(file);
                });
                elements.fileInput.files = dt.files;
                
                // Trigger change event on file input to handle upload
                const event = new Event('change', { bubbles: true });
                elements.fileInput.dispatchEvent(event);
            } catch (error) {
                console.error('Error handling file upload:', error);
                showToast('Failed to upload files', 'error');
            }
        } else {
            // If no file input, show error message
            showToast('File upload not available', 'error');
        }
    }

    /**
     * Append a message to the chat container
     * @param {Object} message - Message object with id, content, user, timestamp, etc.
     * @param {boolean} shouldScroll - Whether to scroll to bottom after appending
     */
    function appendMessage(message, shouldScroll = true) {
        if (!elements.messagesContainer) {
            console.error('Messages container not found');
            return;
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.dataset.messageId = message.id || Date.now();
        
        // Add message type classes
        if (message.type) {
            messageElement.classList.add(`message-${message.type}`);
        }
        
        // Add user-specific classes
        if (message.user_id && window.quickChatApp && window.quickChatApp.state.user) {
            if (message.user_id === window.quickChatApp.state.user.id) {
                messageElement.classList.add('message-own');
            }
        }

        // Format timestamp
        const timestamp = message.timestamp ? new Date(message.timestamp) : new Date();
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Build message HTML
        let messageHTML = `
            <div class="message-info">
                <span class="message-user">${escapeHtml(message.username || message.user || 'Unknown')}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${escapeHtml(message.content || message.message || '')}</div>
        `;

        messageElement.innerHTML = messageHTML;

        // Add to messages container
        elements.messagesContainer.appendChild(messageElement);

        // Update unread counter if not focused
        if (state.visibilityState === 'hidden') {
            state.unreadMessages++;
            updateUnreadBadge();
        }

        // Scroll to bottom if requested
        if (shouldScroll) {
            scrollToBottom();
        }

        // Play notification sound for new messages
        if (message.id && message.user_id !== (window.quickChatApp?.state?.user?.id)) {
            if (state.soundEnabled && ('Notification' in window)) {
                // Use integration to play sound
                if (window.quickChatApp && typeof window.quickChatApp.playNotificationSound === 'function') {
                    window.quickChatApp.playNotificationSound();
                }
            }
        }
    }

    /**
     * Scroll the messages container to the bottom
     */
    function scrollToBottom() {
        if (!elements.messagesContainer) {
            return;
        }

        // Use smooth scrolling if supported
        try {
            elements.messagesContainer.scrollTo({
                top: elements.messagesContainer.scrollHeight,
                behavior: 'smooth'
            });
        } catch (error) {
            // Fallback for older browsers
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }
    }

    /**
     * Show error message to user
     * @param {string} message - Error message to display
     * @param {number} duration - Duration to show error (ms)
     */
    function showError(message, duration = 5000) {
        showToast(message, 'error');
    }

    /**
     * Hide the emoji picker
     */
    function hideEmojiPicker() {
        if (elements.emojiPicker) {
            elements.emojiPicker.style.display = 'none';
        }
        state.isEmojiPickerVisible = false;
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose key functions to global scope for app.js integration
    window.chatHandler = {
        appendMessage,
        scrollToBottom,
        hideEmojiPicker,
        showError
    };

    // Also expose appendMessage globally for backward compatibility
    window.appendMessage = appendMessage;
});
