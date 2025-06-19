/**
 * User Mentions Component - LEGACY FILE
 * Now imports from features/chat/mentions.js for backward compatibility
 */

import { UserMentions as UserMentionsNew } from './features/chat/mentions.js';

// Re-export the class with backward compatibility
class UserMentions {
    constructor(chatInstance) {
        console.warn('user-mentions.js is deprecated. Use features/chat/mentions.js instead.');
        // Create an instance of the new class
        const instance = new UserMentionsNew(chatInstance);
        
        // Copy all properties and methods from the new instance to this one
        Object.setPrototypeOf(this, instance);
        
        return this;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserMentions;
} else {
    window.UserMentions = UserMentions;
}

// Also export as ES module
export default UserMentions;
export { UserMentions };
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
    
    getRecentUsers() {
        // Prioritize online users and recently messaged users
        const onlineUsers = this.users.filter(u => u.is_online);
        const offlineUsers = this.users.filter(u => !u.is_online);
        
        return [...onlineUsers, ...offlineUsers];
    }
    
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
    
    selectActiveSuggestion() {
        if (this.activeSuggestionIndex >= 0 && this.suggestions[this.activeSuggestionIndex]) {
            const user = this.suggestions[this.activeSuggestionIndex];
            this.selectMention(user.id, user.username);
        }
    }
    
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
    
    showSuggestions() {
        if (this.suggestions.length === 0) return;
        
        this.isShowingSuggestions = true;
        this.elements.dropdown.classList.remove('hidden');
        this.positionDropdown();
        
        // Announce to screen readers
        const announcement = `${this.suggestions.length} user suggestions available`;
        this.announceToScreenReader(announcement);
    }
    
    hideSuggestions() {
        this.isShowingSuggestions = false;
        this.elements.dropdown.classList.add('hidden');
        this.activeSuggestionIndex = -1;
        this.mentionStartPos = -1;
        this.currentMentionText = '';
    }
    
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
    
    // Extract mentions from message text
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
    
    // Highlight mentions in message text
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
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public methods for integration
    refreshUsers() {
        this.loadUsers();
    }
    
    getMentionsInText(text) {
        return this.extractMentions(text);
    }
    
    clearCurrentMentions() {
        if (this.chat.state.currentMessageMentions) {
            this.chat.state.currentMessageMentions = [];
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserMentions;
} else {
    window.UserMentions = UserMentions;
}
