/**
 * Chat User Mentions Module
 * Provides @mention functionality with user suggestions
 */

/**
 * User Mentions class for handling @mentions in chat
 */
export class UserMentions {
    /**
     * Create a new UserMentions instance
     * @param {Object} chatInstance - The chat instance to attach to
     */
    constructor(chatInstance) {
        this.chat = chatInstance;
        this.users = [];
        this.suggestions = [];
        this.activeSuggestionIndex = -1;
        this.mentionStartPos = -1;
        this.currentMentionText = '';
        this.isShowingSuggestions = false;
        
        this.initMentionsInterface();
        this.bindEvents();
        this.loadUsers();
    }
    
    /**
     * Initialize the mentions dropdown interface
     */
    initMentionsInterface() {
        // Create mentions dropdown
        const mentionsDropdown = document.createElement('div');
        mentionsDropdown.id = 'mentions-dropdown';
        mentionsDropdown.className = 'mentions-dropdown hidden';
        mentionsDropdown.setAttribute('role', 'listbox');
        mentionsDropdown.setAttribute('aria-label', 'User suggestions');
        
        // Insert dropdown before message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput && messageInput.parentNode) {
            messageInput.parentNode.insertBefore(mentionsDropdown, messageInput);
        }
        
        this.elements = {
            dropdown: mentionsDropdown,
            messageInput: messageInput
        };
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        if (!this.elements.messageInput) return;
        
        // Input event for mention detection
        this.elements.messageInput.addEventListener('input', (e) => {
            this.handleInput(e);
        });
        
        // Keydown for navigation and selection
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (this.isShowingSuggestions) {
                this.handleKeyNavigation(e);
            }
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mentions-dropdown') && !e.target.closest('#messageInput')) {
                this.hideSuggestions();
            }
        });
        
        // Dropdown click handling
        this.elements.dropdown.addEventListener('click', (e) => {
            const suggestionItem = e.target.closest('.mention-suggestion');
            if (suggestionItem) {
                const userId = suggestionItem.dataset.userId;
                const username = suggestionItem.dataset.username;
                this.selectMention(userId, username);
            }
        });
    }
    
    /**
     * Handle input changes to detect potential mentions
     * @param {InputEvent} e - Input event
     */
    handleInput(e) {
        const input = e.target;
        const value = input.value;
        const cursorPos = input.selectionStart;
        
        // Check if we're typing a mention
        const mentionMatch = this.findMentionAt(value, cursorPos);
        
        if (mentionMatch) {
            this.mentionStartPos = mentionMatch.start;
            this.currentMentionText = mentionMatch.text;
            this.searchUsers(mentionMatch.text);
        } else {
            this.hideSuggestions();
        }
    }
    
    /**
     * Find a potential mention at the cursor position
     * @param {string} text - The full message text
     * @param {number} cursorPos - The current cursor position
     * @returns {Object|null} Mention start position and text, or null if no mention
     */
    findMentionAt(text, cursorPos) {
        // Look backwards from cursor to find @
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                atPos = i;
                break;
            }
            if (text[i] === ' ' || text[i] === '\\n') {
                break; // Mention must be continuous
            }
        }
        
        if (atPos === -1) return null;
        
        // Check if @ is at start or preceded by whitespace
        if (atPos > 0 && text[atPos - 1] !== ' ' && text[atPos - 1] !== '\\n') {
            return null;
        }
        
        // Extract mention text
        const mentionText = text.substring(atPos + 1, cursorPos);
        
        // Don't show suggestions if mention is too long
        if (mentionText.length > 20) return null;
        
        return {
            start: atPos,
            text: mentionText
        };
    }
    
    /**
     * Load users for mentions
     */
    async loadUsers() {
        try {
            // Try to get users from chat instance first
            if (this.chat.state.onlineUsers) {
                this.users = this.chat.state.onlineUsers;
                return;
            }
            
            // Fallback to API call
            const response = await fetch('/api/users.php?action=list_for_mentions');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.users = data.users || [];
                }
            }
        } catch (error) {
            console.error('Failed to load users for mentions:', error);
            // Use fallback users if available
            this.users = this.getFallbackUsers();
        }
    }
    
    /**
     * Get fallback users from DOM if API fails
     * @returns {Array} List of users
     */
    getFallbackUsers() {
        // Get users from DOM or other sources
        const userElements = document.querySelectorAll('[data-user-id]');
        const users = [];
        
        userElements.forEach(el => {
            const userId = el.dataset.userId;
            const username = el.dataset.username || el.textContent.trim();
            const avatar = el.querySelector('img')?.src;
            
            if (userId && username && !users.find(u => u.id === userId)) {
                users.push({
                    id: userId,
                    username: username,
                    display_name: el.dataset.displayName || username,
                    avatar: avatar,
                    is_online: el.classList.contains('online')
                });
            }
        });
        
        return users;
    }
    
    /**
     * Search for users based on the mention text
     * @param {string} query - The query to search for
     */
    searchUsers(query) {
        if (query.length === 0) {
            // Show recent/frequent users
            this.suggestions = this.getRecentUsers().slice(0, 8);
        } else {
            // Filter users by query
            const lowerQuery = query.toLowerCase();
            this.suggestions = this.users.filter(user => {
                return user.username.toLowerCase().includes(lowerQuery) ||
                       (user.display_name && user.display_name.toLowerCase().includes(lowerQuery));
            }).slice(0, 8);
        }
        
        this.activeSuggestionIndex = 0;
        this.renderSuggestions();
        this.showSuggestions();
    }
    
    /**
     * Get recent users, prioritizing online users
     * @returns {Array} List of users sorted by online status
     */
    getRecentUsers() {
        // Prioritize online users and recently messaged users
        const onlineUsers = this.users.filter(u => u.is_online);
        const offlineUsers = this.users.filter(u => !u.is_online);
        
        return [...onlineUsers, ...offlineUsers];
    }
    
    /**
     * Render the suggestions dropdown
     */
    renderSuggestions() {
        if (this.suggestions.length === 0) {
            this.elements.dropdown.innerHTML = `
                <div class="mention-no-results">
                    <i class="fas fa-user-slash"></i>
                    <span>No users found</span>
                </div>
            `;
            return;
        }
        
        const suggestionsHTML = this.suggestions.map((user, index) => `
            <div class="mention-suggestion ${index === this.activeSuggestionIndex ? 'active' : ''}" 
                 data-user-id="${user.id}"
                 data-username="${user.username}"
                 role="option"
                 aria-selected="${index === this.activeSuggestionIndex}">
                <div class="mention-avatar">
                    <img src="${user.avatar || '/assets/images/default-avatar.svg'}" 
                         alt="${user.display_name || user.username}"
                         onerror="this.src='/assets/images/default-avatar.svg'">
                    ${user.is_online ? '<div class="online-indicator"></div>' : ''}
                </div>
                <div class="mention-info">
                    <div class="mention-name">${this.escapeHtml(user.display_name || user.username)}</div>
                    <div class="mention-username">@${this.escapeHtml(user.username)}</div>
                </div>
                <div class="mention-status">
                    ${user.is_online ? '<i class="fas fa-circle online"></i>' : '<i class="fas fa-circle offline"></i>'}
                </div>
            </div>
        `).join('');
        
        this.elements.dropdown.innerHTML = suggestionsHTML;
    }
    
    /**
     * Handle keyboard navigation in the suggestions dropdown
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyNavigation(e) {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateSuggestions('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateSuggestions('down');
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                this.selectActiveSuggestion();
                break;
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                break;
        }
    }
    
    /**
     * Navigate through suggestions with keyboard
     * @param {string} direction - Navigation direction ('up' or 'down')
     */
    navigateSuggestions(direction) {
        if (this.suggestions.length === 0) return;
        
        const prevIndex = this.activeSuggestionIndex;
        
        if (direction === 'up') {
            this.activeSuggestionIndex = this.activeSuggestionIndex <= 0 
                ? this.suggestions.length - 1 
                : this.activeSuggestionIndex - 1;
        } else {
            this.activeSuggestionIndex = (this.activeSuggestionIndex + 1) % this.suggestions.length;
        }
        
        this.updateActiveSuggestion(prevIndex, this.activeSuggestionIndex);
    }
    
    /**
     * Update the active suggestion in the dropdown
     * @param {number} prevIndex - Previous active index
     * @param {number} newIndex - New active index
     */
    updateActiveSuggestion(prevIndex, newIndex) {
        const suggestions = this.elements.dropdown.querySelectorAll('.mention-suggestion');
        
        if (suggestions[prevIndex]) {
            suggestions[prevIndex].classList.remove('active');
            suggestions[prevIndex].setAttribute('aria-selected', 'false');
        }
        
        if (suggestions[newIndex]) {
            suggestions[newIndex].classList.add('active');
            suggestions[newIndex].setAttribute('aria-selected', 'true');
            suggestions[newIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    /**
     * Select the currently active suggestion
     */
    selectActiveSuggestion() {
        if (this.activeSuggestionIndex >= 0 && this.suggestions[this.activeSuggestionIndex]) {
            const user = this.suggestions[this.activeSuggestionIndex];
            this.selectMention(user.id, user.username);
        }
    }
    
    /**
     * Select a mention and insert it into the input
     * @param {string} userId - User ID
     * @param {string} username - Username
     */
    selectMention(userId, username) {
        const input = this.elements.messageInput;
        const value = input.value;
        const cursorPos = input.selectionStart;
        
        // Replace the @mention text with the selected username
        const beforeMention = value.substring(0, this.mentionStartPos);
        const afterMention = value.substring(cursorPos);
        const mentionText = `@${username} `;
        
        const newValue = beforeMention + mentionText + afterMention;
        const newCursorPos = this.mentionStartPos + mentionText.length;
        
        input.value = newValue;
        input.setSelectionRange(newCursorPos, newCursorPos);
        
        // Store mention for later use
        this.addMentionToMessage(userId, username);
        
        // Hide suggestions
        this.hideSuggestions();
        
        // Focus back on input
        input.focus();
        
        // Trigger input event for other handlers
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    /**
     * Add a mention to the current message
     * @param {string} userId - User ID
     * @param {string} username - Username
     */
    addMentionToMessage(userId, username) {
        // Store mention data for when message is sent
        if (!this.chat.state.currentMessageMentions) {
            this.chat.state.currentMessageMentions = [];
        }
        
        // Avoid duplicates
        if (!this.chat.state.currentMessageMentions.find(m => m.userId === userId)) {
            this.chat.state.currentMessageMentions.push({
                userId: userId,
                username: username
            });
        }
    }
    
    /**
     * Show the suggestions dropdown
     */
    showSuggestions() {
        if (this.suggestions.length === 0) return;
        
        this.isShowingSuggestions = true;
        this.elements.dropdown.classList.remove('hidden');
        this.positionDropdown();
        
        // Announce to screen readers
        const announcement = `${this.suggestions.length} user suggestions available`;
        this.announceToScreenReader(announcement);
    }
    
    /**
     * Hide the suggestions dropdown
     */
    hideSuggestions() {
        this.isShowingSuggestions = false;
        this.elements.dropdown.classList.add('hidden');
        this.activeSuggestionIndex = -1;
        this.mentionStartPos = -1;
        this.currentMentionText = '';
    }
    
    /**
     * Position the dropdown relative to the input
     */
    positionDropdown() {
        const input = this.elements.messageInput;
        const dropdown = this.elements.dropdown;
        
        // Position dropdown above the input
        const inputRect = input.getBoundingClientRect();
        const dropdownHeight = dropdown.offsetHeight || 200; // Estimated height
        
        dropdown.style.position = 'absolute';
        dropdown.style.left = inputRect.left + 'px';
        dropdown.style.width = Math.min(300, inputRect.width) + 'px';
        
        // Position above input if there's space, otherwise below
        if (inputRect.top - dropdownHeight > 20) {
            dropdown.style.top = (inputRect.top - dropdownHeight - 5) + 'px';
            dropdown.classList.remove('dropdown-below');
            dropdown.classList.add('dropdown-above');
        } else {
            dropdown.style.top = (inputRect.bottom + 5) + 'px';
            dropdown.classList.remove('dropdown-above');
            dropdown.classList.add('dropdown-below');
        }
    }
    
    /**
     * Extract mentions from message text
     * @param {string} text - Message text
     * @returns {Array} List of mentions with position info
     */
    extractMentions(text) {
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            const username = match[1];
            const user = this.users.find(u => u.username === username);
            if (user) {
                mentions.push({
                    userId: user.id,
                    username: username,
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        }
        
        return mentions;
    }
    
    /**
     * Highlight mentions in message text
     * @param {string} text - Message text
     * @returns {string} HTML with highlighted mentions
     */
    highlightMentions(text) {
        const mentions = this.extractMentions(text);
        if (mentions.length === 0) return this.escapeHtml(text);
        
        let highlightedText = text;
        let offset = 0;
        
        mentions.forEach(mention => {
            const mentionHtml = `<span class="mention" data-user-id="${mention.userId}">@${mention.username}</span>`;
            const startPos = mention.start + offset;
            const endPos = mention.end + offset;
            
            highlightedText = highlightedText.substring(0, startPos) + 
                            mentionHtml + 
                            highlightedText.substring(endPos);
            
            offset += mentionHtml.length - (mention.end - mention.start);
        });
        
        return highlightedText;
    }
    
    /**
     * Announce text to screen readers
     * @param {string} text - Text to announce
     */
    announceToScreenReader(text) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = text;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Refresh the users list
     */
    refreshUsers() {
        this.loadUsers();
    }
    
    /**
     * Get mentions in text
     * @param {string} text - Text to extract mentions from
     * @returns {Array} List of mentions
     */
    getMentionsInText(text) {
        return this.extractMentions(text);
    }
    
    /**
     * Clear current mentions
     */
    clearCurrentMentions() {
        if (this.chat.state.currentMessageMentions) {
            this.chat.state.currentMessageMentions = [];
        }
    }
}

// Helper functions for working with mentions outside the class
/**
 * Create a new mentions instance
 * @param {Object} chatInstance - Chat instance
 * @returns {UserMentions} New UserMentions instance
 */
export function createMentions(chatInstance) {
    return new UserMentions(chatInstance);
}

/**
 * Parse text and extract mentions
 * @param {string} text - Text to parse
 * @param {Array} users - List of users to check against
 * @returns {Array} Extracted mentions
 */
export function parseMentions(text, users) {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
        const username = match[1];
        const user = users.find(u => u.username === username);
        if (user) {
            mentions.push({
                userId: user.id,
                username: username
            });
        }
    }
    
    return mentions;
}

// Default export
export default {
    UserMentions,
    createMentions,
    parseMentions
};
