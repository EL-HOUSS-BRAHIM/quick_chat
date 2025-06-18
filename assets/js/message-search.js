/**
 * Message Search Component - DEPRECATED
 * This file is maintained for backward compatibility
 * Please use the new module at ./features/chat/search.js
 */

// Import the new implementation
import ChatSearch from './features/chat/search.js';

// Create a compatibility class that delegates to the new implementation
class MessageSearch {
    constructor(chatInstance) {
        console.warn('MessageSearch is deprecated. Please use ChatSearch from features/chat/search.js instead.');
        
        // Create an instance of the new ChatSearch class
        this.chatSearch = new ChatSearch();
        this.chat = chatInstance;
        this.searchResults = [];
        this.currentQuery = '';
    }
    
    // No need to initialize interface or bind events as those are handled by the new implementation
    initSearchInterface() {
        // Already handled by new implementation
    }
    
    bindEvents() {
        // Already handled by new implementation
    }
    
    // Proxy methods to the new implementation
    search(query) {
        if (this.chatSearch.searchInput) {
            this.chatSearch.searchInput.value = query;
            this.chatSearch.handleSearchInput();
        }
    }
    
    clearSearch() {
        this.chatSearch.clearSearch();
    }
    
    showSearchOverlay() {
        this.chatSearch.showResults();
    }
    
    hideSearchOverlay() {
        this.chatSearch.hideResults();
    }
    
    highlightSearchResult(index) {
        // This method might not have a direct equivalent in the new implementation
        // but we can try to navigate to the message if possible
        if (this.searchResults && this.searchResults[index]) {
            const messageId = this.searchResults[index].id;
            if (messageId) {
                this.chatSearch.navigateToMessage(messageId);
            }
        }
    }
}

// Export for backward compatibility
window.MessageSearch = MessageSearch;
                            Images
                        </button>
                        <button class="filter-btn" data-filter="files" aria-label="Search files only">
                            Files
                        </button>
                        <button class="filter-btn" data-filter="links" aria-label="Search links only">
                            Links
                        </button>
                    </div>
                </div>
                <div class="search-results-container">
                    <div id="search-results-list" class="search-results-list" role="listbox" aria-label="Search results">
                        <div class="search-placeholder">
                            <i class="fas fa-search"></i>
                            <p>Type to search messages</p>
                        </div>
                    </div>
                    <div class="search-navigation">
                        <button id="search-prev-btn" class="nav-btn" disabled aria-label="Previous result">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                        <span id="search-counter" class="search-counter" aria-live="polite">0 of 0</span>
                        <button id="search-next-btn" class="nav-btn" disabled aria-label="Next result">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(searchOverlay);
        
        // Store references
        this.elements = {
            overlay: searchOverlay,
            input: document.getElementById('message-search-input'),
            resultsList: document.getElementById('search-results-list'),
            counter: document.getElementById('search-counter'),
            prevBtn: document.getElementById('search-prev-btn'),
            nextBtn: document.getElementById('search-next-btn'),
            closeBtn: searchOverlay.querySelector('.search-close-btn'),
            filterBtns: searchOverlay.querySelectorAll('.filter-btn')
        };
    }
    
    bindEvents() {
        // Search input
        this.elements.input.addEventListener('input', (e) => {
            this.debounce(() => this.performSearch(e.target.value), 300);
        });
        
        // Navigation
        this.elements.prevBtn.addEventListener('click', () => this.navigateResults('prev'));
        this.elements.nextBtn.addEventListener('click', () => this.navigateResults('next'));
        
        // Close search
        this.elements.closeBtn.addEventListener('click', () => this.hideSearch());
        
        // Filter buttons
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setActiveFilter(e.target);
                this.performSearch(this.elements.input.value);
            });
        });
        
        // Keyboard shortcuts
        this.elements.input.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    this.hideSearch();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateResults('prev');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateResults('next');
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.jumpToCurrentResult();
                    break;
            }
        });
        
        // Result click handling
        this.elements.resultsList.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.search-result-item');
            if (resultItem) {
                const messageId = resultItem.dataset.messageId;
                this.jumpToMessage(messageId);
            }
        });
        
        // Close on overlay click
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) {
                this.hideSearch();
            }
        });
    }
    
    async performSearch(query) {
        if (!query || query.trim().length < 2) {
            this.clearResults();
            return;
        }
        
        this.currentQuery = query.trim();
        this.isSearching = true;
        this.showSearchingState();
        
        try {
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            const results = await this.searchMessages(query, activeFilter);
            
            this.searchResults = results;
            this.searchIndex = results.length > 0 ? 0 : -1;
            this.renderResults(results);
            this.updateNavigation();
            
        } catch (error) {
            console.error('Search error:', error);
            this.showErrorState();
        } finally {
            this.isSearching = false;
        }
    }
    
    async searchMessages(query, filter = 'all') {
        // First try server-side search if available
        try {
            const response = await fetch('/api/messages.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'search',
                    query: query,
                    filter: filter,
                    target_user_id: this.chat.state.targetUser?.id
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return data.results || [];
                }
            }
        } catch (error) {
            console.log('Server search not available, falling back to client-side search');
        }
        
        // Fallback to client-side search
        return this.performClientSideSearch(query, filter);
    }
    
    performClientSideSearch(query, filter) {
        const messages = this.chat.state.messages || [];
        const searchQuery = query.toLowerCase();
        
        return messages.filter(message => {
            // Apply filter
            if (filter !== 'all') {
                switch (filter) {
                    case 'images':
                        if (message.type !== 'image') return false;
                        break;
                    case 'files':
                        if (!['file', 'audio', 'video'].includes(message.type)) return false;
                        break;
                    case 'links':
                        if (!this.containsLinks(message.content)) return false;
                        break;
                }
            }
            
            // Search in message content
            if (message.content && message.content.toLowerCase().includes(searchQuery)) {
                return true;
            }
            
            // Search in file names
            if (message.filename && message.filename.toLowerCase().includes(searchQuery)) {
                return true;
            }
            
            // Search in user names
            if (message.username && message.username.toLowerCase().includes(searchQuery)) {
                return true;
            }
            
            return false;
        }).map(message => ({
            ...message,
            highlightedContent: this.highlightText(message.content || message.filename || '', query)
        }));
    }
    
    containsLinks(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return urlRegex.test(text);
    }
    
    highlightText(text, query) {
        if (!text || !query) return text;
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    renderResults(results) {
        if (results.length === 0) {
            this.elements.resultsList.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>No messages found for "${this.currentQuery}"</p>
                </div>
            `;
            return;
        }
        
        const resultsHTML = results.map((message, index) => `
            <div class="search-result-item ${index === this.searchIndex ? 'active' : ''}" 
                 data-message-id="${message.id}"
                 role="option"
                 aria-selected="${index === this.searchIndex}">
                <div class="result-avatar">
                    <img src="${message.avatar || '/assets/images/default-avatar.svg'}" 
                         alt="${message.username}" 
                         onerror="this.src='/assets/images/default-avatar.svg'">
                </div>
                <div class="result-content">
                    <div class="result-header">
                        <span class="result-author">${this.escapeHtml(message.username)}</span>
                        <span class="result-time">${this.formatMessageTime(message.timestamp)}</span>
                    </div>
                    <div class="result-message">
                        ${this.renderMessagePreview(message)}
                    </div>
                </div>
                <div class="result-type">
                    ${this.getMessageTypeIcon(message.type)}
                </div>
            </div>
        `).join('');
        
        this.elements.resultsList.innerHTML = resultsHTML;
    }
    
    renderMessagePreview(message) {
        switch (message.type) {
            case 'image':
                return `<div class="media-preview"><i class="fas fa-image"></i> Image: ${message.highlightedContent}</div>`;
            case 'file':
                return `<div class="media-preview"><i class="fas fa-file"></i> File: ${message.highlightedContent}</div>`;
            case 'audio':
                return `<div class="media-preview"><i class="fas fa-microphone"></i> Audio: ${message.highlightedContent}</div>`;
            case 'video':
                return `<div class="media-preview"><i class="fas fa-video"></i> Video: ${message.highlightedContent}</div>`;
            default:
                return message.highlightedContent || this.escapeHtml(message.content || '');
        }
    }
    
    getMessageTypeIcon(type) {
        const icons = {
            text: 'fas fa-comment',
            image: 'fas fa-image',
            file: 'fas fa-file',
            audio: 'fas fa-microphone',
            video: 'fas fa-video'
        };
        
        return `<i class="${icons[type] || icons.text}"></i>`;
    }
    
    navigateResults(direction) {
        if (this.searchResults.length === 0) return;
        
        const prevIndex = this.searchIndex;
        
        if (direction === 'next') {
            this.searchIndex = (this.searchIndex + 1) % this.searchResults.length;
        } else {
            this.searchIndex = this.searchIndex <= 0 
                ? this.searchResults.length - 1 
                : this.searchIndex - 1;
        }
        
        this.updateActiveResult(prevIndex, this.searchIndex);
        this.updateNavigation();
        this.scrollToActiveResult();
    }
    
    updateActiveResult(prevIndex, newIndex) {
        const results = this.elements.resultsList.querySelectorAll('.search-result-item');
        
        if (results[prevIndex]) {
            results[prevIndex].classList.remove('active');
            results[prevIndex].setAttribute('aria-selected', 'false');
        }
        
        if (results[newIndex]) {
            results[newIndex].classList.add('active');
            results[newIndex].setAttribute('aria-selected', 'true');
        }
    }
    
    scrollToActiveResult() {
        const activeResult = this.elements.resultsList.querySelector('.search-result-item.active');
        if (activeResult) {
            activeResult.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    updateNavigation() {
        const hasResults = this.searchResults.length > 0;
        const currentIndex = this.searchIndex + 1;
        const totalResults = this.searchResults.length;
        
        this.elements.counter.textContent = hasResults 
            ? `${currentIndex} of ${totalResults}` 
            : '0 of 0';
        
        this.elements.prevBtn.disabled = !hasResults;
        this.elements.nextBtn.disabled = !hasResults;
    }
    
    jumpToCurrentResult() {
        if (this.searchIndex >= 0 && this.searchResults[this.searchIndex]) {
            const message = this.searchResults[this.searchIndex];
            this.jumpToMessage(message.id);
        }
    }
    
    jumpToMessage(messageId) {
        // Hide search overlay
        this.hideSearch();
        
        // Find message in chat and scroll to it
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        
        if (messageElement) {
            // Highlight the message temporarily
            messageElement.classList.add('search-highlight');
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remove highlight after animation
            setTimeout(() => {
                messageElement.classList.remove('search-highlight');
            }, 2000);
        } else {
            // Message not visible, might need to load more history
            this.chat.loadMessageHistory(messageId);
        }
    }
    
    setActiveFilter(filterBtn) {
        this.elements.filterBtns.forEach(btn => btn.classList.remove('active'));
        filterBtn.classList.add('active');
    }
    
    showSearch() {
        this.elements.overlay.classList.remove('hidden');
        this.elements.input.focus();
        document.body.style.overflow = 'hidden';
    }
    
    hideSearch() {
        this.elements.overlay.classList.add('hidden');
        document.body.style.overflow = '';
        this.clearResults();
        this.elements.input.value = '';
        this.currentQuery = '';
    }
    
    clearResults() {
        this.searchResults = [];
        this.searchIndex = -1;
        this.elements.resultsList.innerHTML = `
            <div class="search-placeholder">
                <i class="fas fa-search"></i>
                <p>Type to search messages</p>
            </div>
        `;
        this.updateNavigation();
    }
    
    showSearchingState() {
        this.elements.resultsList.innerHTML = `
            <div class="search-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Searching...</p>
            </div>
        `;
    }
    
    showErrorState() {
        this.elements.resultsList.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Search failed. Please try again.</p>
            </div>
        `;
    }
    
    formatMessageTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(func, wait);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageSearch;
} else {
    window.MessageSearch = MessageSearch;
}
