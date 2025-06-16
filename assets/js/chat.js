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
        setupAccessibility(); // Add this line
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
        // Initialize user mentions functionality
        if (typeof UserMentions !== 'undefined') {
            state.userMentions = new UserMentions({
                messageInput: elements.messageInput,
                onlineUsers: state.onlineUsers || []
            });
        }
    }

    /**
     * Setup accessibility enhancements
     */
    function setupAccessibility() {
        // Add missing ARIA labels
        addAriaLabels();
        
        // Setup keyboard navigation
        setupKeyboardNavigation();
        
        // Setup screen reader announcements
        setupScreenReaderSupport();
        
        // Setup focus management
        setupFocusManagement();
    }
    
    /**
     * Add missing ARIA labels to UI elements
     */
    function addAriaLabels() {
        // File upload button
        if (elements.fileBtn) {
            elements.fileBtn.setAttribute('aria-label', 'Attach file');
            elements.fileBtn.setAttribute('aria-describedby', 'file-upload-help');
            
            // Add help text
            if (!document.getElementById('file-upload-help')) {
                const helpText = document.createElement('div');
                helpText.id = 'file-upload-help';
                helpText.className = 'sr-only';
                helpText.textContent = 'Upload files up to 10MB. Supported formats: images, documents, audio, video.';
                elements.fileBtn.parentNode.appendChild(helpText);
            }
        }
        
        // Emoji button
        if (elements.emojiBtn) {
            elements.emojiBtn.setAttribute('aria-label', 'Open emoji picker');
            elements.emojiBtn.setAttribute('aria-expanded', 'false');
        }
        
        // Send button
        if (elements.sendBtn) {
            elements.sendBtn.setAttribute('aria-label', 'Send message');
        }
        
        // Message input
        if (elements.messageInput) {
            elements.messageInput.setAttribute('aria-label', 'Type your message');
            elements.messageInput.setAttribute('aria-describedby', 'char-count message-input-help');
            
            // Add help text for message input
            if (!document.getElementById('message-input-help')) {
                const helpText = document.createElement('div');
                helpText.id = 'message-input-help';
                helpText.className = 'sr-only';
                helpText.textContent = 'Press Enter to send, Shift+Enter for new line, @ to mention users.';
                elements.messageInput.parentNode.appendChild(helpText);
            }
        }
        
        // Messages container
        if (elements.messagesContainer) {
            elements.messagesContainer.setAttribute('role', 'log');
            elements.messagesContainer.setAttribute('aria-label', 'Chat messages');
            elements.messagesContainer.setAttribute('aria-live', 'polite');
        }
        
        // User list
        if (elements.userList) {
            elements.userList.setAttribute('role', 'list');
            elements.userList.setAttribute('aria-label', 'Online users');
        }
    }
    
    /**
     * Setup keyboard navigation
     */
    function setupKeyboardNavigation() {
        // Message navigation with arrow keys
        document.addEventListener('keydown', (e) => {
            // Only handle when not typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    navigateMessages('up');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    navigateMessages('down');
                    break;
                case '/':
                    e.preventDefault();
                    openMessageSearch();
                    break;
                case 'Escape':
                    e.preventDefault();
                    closeModalsAndDropdowns();
                    break;
            }
        });
        
        // Emoji picker keyboard navigation
        if (elements.emojiPicker) {
            elements.emojiPicker.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'Escape':
                        e.preventDefault();
                        hideEmojiPicker();
                        elements.messageInput.focus();
                        break;
                    case 'Tab':
                        // Allow normal tab navigation
                        break;
                }
            });
        }
    }
    
    /**
     * Navigate through messages with keyboard
     */
    function navigateMessages(direction) {
        const messages = elements.messagesContainer.querySelectorAll('.message');
        if (messages.length === 0) return;
        
        let currentIndex = Array.from(messages).findIndex(msg => msg.classList.contains('keyboard-focused'));
        
        if currentIndex === -1) {
            // No message focused, start from first or last
            currentIndex = direction === 'up' ? messages.length - 1 : 0;
        } else {
            // Remove current focus
            messages[currentIndex].classList.remove('keyboard-focused');
            messages[currentIndex].removeAttribute('tabindex');
            
            // Move to next/previous
            if (direction === 'up') {
                currentIndex = Math.max(0, currentIndex - 1);
            } else {
                currentIndex = Math.min(messages.length - 1, currentIndex + 1);
            }
        }
        
        // Focus new message
        const targetMessage = messages[currentIndex];
        targetMessage.classList.add('keyboard-focused');
        targetMessage.setAttribute('tabindex', '0');
        targetMessage.focus();
        targetMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Announce message content to screen reader
        announceMessageContent(targetMessage);
    }
    
    /**
     * Setup screen reader support
     */
    function setupScreenReaderSupport() {
        // Create live region for announcements
        if (!document.getElementById('screen-reader-announcements')) {
            const liveRegion = document.createElement('div');
            liveRegion.id = 'screen-reader-announcements';
            liveRegion.setAttribute('aria-live', 'assertive');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        
        // Announce typing indicators
        observeTypingIndicators();
        
        // Announce new messages
        observeNewMessages();
        
        // Announce connection status changes
        observeConnectionStatus();
    }
    
    /**
     * Announce message content to screen reader
     */
    function announceMessageContent(messageElement) {
        const author = messageElement.querySelector('.message-author')?.textContent || 'Unknown user';
        const time = messageElement.querySelector('.message-time')?.textContent || '';
        const content = messageElement.querySelector('.message-content')?.textContent || '';
        const type = getMessageType(messageElement);
        
        let announcement = `Message from ${author}`;
        if (time) announcement += ` at ${time}`;
        if (type !== 'text') announcement += `, ${type}`;
        announcement += `: ${content}`;
        
        announceToScreenReader(announcement);
    }
    
    /**
     * Get message type for announcements
     */
    function getMessageType(messageElement) {
        if (messageElement.querySelector('img:not(.avatar)')) return 'image';
        if (messageElement.querySelector('video')) return 'video';
        if (messageElement.querySelector('audio')) return 'audio';
        if (messageElement.querySelector('a[download]')) return 'file attachment';
        return 'text';
    }
    
    /**
     * Observe typing indicators for screen reader announcements
     */
    function observeTypingIndicators() {
        if (!elements.typingIndicator) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const typingText = elements.typingIndicator.textContent.trim();
                    if (typingText) {
                        announceToScreenReader(typingText);
                    }
                }
            });
        });
        
        observer.observe(elements.typingIndicator, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    /**
     * Observe new messages for screen reader announcements
     */
    function observeNewMessages() {
        if (!elements.messagesContainer) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('message')) {
                            // Only announce messages from others
                            if (!node.classList.contains('own-message')) {
                                setTimeout(() => {
                                    announceNewMessage(node);
                                }, 100);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(elements.messagesContainer, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Announce new message to screen reader
     */
    function announceNewMessage(messageElement) {
        // Only announce if user is not actively typing
        if (document.activeElement !== elements.messageInput) {
            const author = messageElement.querySelector('.message-author')?.textContent || 'Someone';
            const content = messageElement.querySelector('.message-content')?.textContent || '';
            const type = getMessageType(messageElement);
            
            let announcement = `New message from ${author}`;
            if (type !== 'text') announcement += `, ${type}`;
            if (content.length > 100) {
                announcement += `: ${content.substring(0, 100)}...`;
            } else {
                announcement += `: ${content}`;
            }
            
            announceToScreenReader(announcement);
        }
    }
    
    /**
     * Observe connection status changes
     */
    function observeConnectionStatus() {
        // Watch for connection status indicators
        const statusElements = document.querySelectorAll('.connection-status, .online-status');
        
        statusElements.forEach(element => {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const element = mutation.target;
                        if (element.classList.contains('offline')) {
                            announceToScreenReader('Connection lost. Messages may not be delivered.');
                        } else if (element.classList.contains('online')) {
                            announceToScreenReader('Connection restored.');
                        }
                    }
                });
            });
            
            observer.observe(element, { attributes: true });
        });
    }
    
    /**
     * Setup focus management
     */
    function setupFocusManagement() {
        // Modal focus trapping
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const activeModal = document.querySelector('.modal.show, .modal.active');
                if (activeModal) {
                    trapFocusInModal(e, activeModal);
                }
            }
        });
        
        // Return focus when modals close
        setupModalFocusRestore();
    }
    
    /**
     * Trap focus within modal
     */
    function trapFocusInModal(e, modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }
    
    /**
     * Setup modal focus restoration
     */
    function setupModalFocusRestore() {
        let lastFocusedElement = null;
        
        // Store focus when modal opens
        document.addEventListener('focus', (e) => {
            if (!e.target.closest('.modal')) {
                lastFocusedElement = e.target;
            }
        }, true);
        
        // Restore focus when modal closes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const element = mutation.target;
                    if (element.classList.contains('modal') && !element.classList.contains('show') && !element.classList.contains('active')) {
                        // Modal closed, restore focus
                        if (lastFocusedElement && document.contains(lastFocusedElement)) {
                            setTimeout(() => {
                                lastFocusedElement.focus();
                            }, 100);
                        }
                    }
                }
            });
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            observer.observe(modal, { attributes: true });
        });
    }
    
    /**
     * Open message search
     */
    function openMessageSearch() {
        if (typeof MessageSearch !== 'undefined' && window.messageSearch) {
            window.messageSearch.showSearch();
        }
    }
    
    /**
     * Close all modals and dropdowns
     */
    function closeModalsAndDropdowns() {
        // Close modals
        document.querySelectorAll('.modal.show, .modal.active').forEach(modal => {
            modal.classList.remove('show', 'active');
        });
        
        // Close dropdowns
        document.querySelectorAll('.dropdown.show, .popup.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        
        // Hide emoji picker
        if (elements.emojiPicker) {
            elements.emojiPicker.style.display = 'none';
            if (elements.emojiBtn) {
                elements.emojiBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }
    
    /**
     * Announce text to screen reader
     */
    function announceToScreenReader(text) {
        const liveRegion = document.getElementById('screen-reader-announcements');
        if (liveRegion) {
            liveRegion.textContent = text;
            
            // Clear after announcement
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
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
