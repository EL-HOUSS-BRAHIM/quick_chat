/**
 * Virtual Scrolling Component for Large Message Lists
 * Improves performance by only rendering visible messages
 */

class VirtualScrollMessaging {
    constructor(options = {}) {
        this.container = document.querySelector(options.container || '.messages-container');
        this.messagesList = document.querySelector(options.messagesList || '.messages-list');
        this.options = {
            itemHeight: options.itemHeight || 80, // Average message height
            buffer: options.buffer || 5, // Extra items to render outside viewport
            threshold: options.threshold || 200, // Pixels before loading more
            pageSize: options.pageSize || 50,
            ...options
        };

        this.state = {
            messages: [],
            visibleStart: 0,
            visibleEnd: 0,
            scrollTop: 0,
            containerHeight: 0,
            totalHeight: 0,
            isLoading: false,
            hasMore: true,
            page: 1
        };

        this.messageCache = new Map();
        this.observedElements = new Map();
        this.resizeObserver = null;
        this.intersectionObserver = null;

        this.init();
    }

    /**
     * Initialize virtual scrolling
     */
    init() {
        if (!this.container || !this.messagesList) {
            throw new Error('Virtual scroll container or messages list not found');
        }

        // Setup container styles
        this.container.style.position = 'relative';
        this.container.style.overflowY = 'auto';
        this.container.style.height = this.container.style.height || '400px';

        // Setup messages list styles
        this.messagesList.style.position = 'relative';
        this.messagesList.style.minHeight = '100%';

        // Bind events
        this.bindEvents();

        // Setup observers
        this.setupObservers();

        // Initial load
        this.loadInitialMessages();
    }

    /**
     * Bind scroll and resize events
     */
    bindEvents() {
        // Throttled scroll handler
        let scrollTimeout;
        this.container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.handleScroll();
            }, 16); // ~60fps
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.updateContainerHeight();
            this.calculateVisibleRange();
            this.renderVisibleMessages();
        });
    }

    /**
     * Setup intersection and resize observers
     */
    setupObservers() {
        // Intersection Observer for dynamic height calculation
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const messageId = entry.target.dataset.messageId;
                    if (entry.isIntersecting) {
                        this.observedElements.set(messageId, entry.target.offsetHeight);
                    }
                });
            },
            { root: this.container, threshold: 0 }
        );

        // Resize Observer for container size changes
        this.resizeObserver = new ResizeObserver(() => {
            this.updateContainerHeight();
            this.calculateVisibleRange();
            this.renderVisibleMessages();
        });

        this.resizeObserver.observe(this.container);
    }

    /**
     * Load initial messages
     */
    async loadInitialMessages() {
        this.state.isLoading = true;
        this.showLoadingIndicator();

        try {
            const response = await this.fetchMessages(1);
            this.state.messages = response.messages;
            this.state.hasMore = response.pagination.has_next_page;
            this.state.page = 1;

            this.updateContainerHeight();
            this.calculateTotalHeight();
            this.calculateVisibleRange();
            this.renderVisibleMessages();
        } catch (error) {
            console.error('Failed to load initial messages:', error);
            this.showError('Failed to load messages');
        } finally {
            this.state.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    /**
     * Handle scroll events
     */
    handleScroll() {
        const scrollTop = this.container.scrollTop;
        const scrollHeight = this.container.scrollHeight;
        const clientHeight = this.container.clientHeight;

        this.state.scrollTop = scrollTop;

        // Calculate visible range
        this.calculateVisibleRange();
        this.renderVisibleMessages();

        // Load more messages when near top (for chat, older messages are above)
        if (scrollTop < this.options.threshold && this.state.hasMore && !this.state.isLoading) {
            this.loadMoreMessages();
        }

        // Auto-scroll to bottom for new messages (optional)
        if (this.isNearBottom(scrollTop, scrollHeight, clientHeight)) {
            this.autoScrollToBottom();
        }
    }

    /**
     * Calculate visible message range
     */
    calculateVisibleRange() {
        const scrollTop = this.state.scrollTop;
        const containerHeight = this.state.containerHeight;
        const itemHeight = this.options.itemHeight;
        const buffer = this.options.buffer;

        // Calculate visible range with buffer
        const visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
        const visibleEnd = Math.min(
            this.state.messages.length - 1,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
        );

        this.state.visibleStart = visibleStart;
        this.state.visibleEnd = visibleEnd;
    }

    /**
     * Render only visible messages
     */
    renderVisibleMessages() {
        // Clear current content
        this.messagesList.innerHTML = '';

        // Create spacer for messages above visible range
        const topSpacer = document.createElement('div');
        topSpacer.style.height = `${this.state.visibleStart * this.options.itemHeight}px`;
        this.messagesList.appendChild(topSpacer);

        // Render visible messages
        for (let i = this.state.visibleStart; i <= this.state.visibleEnd; i++) {
            const message = this.state.messages[i];
            if (message) {
                const messageElement = this.renderMessage(message, i);
                this.messagesList.appendChild(messageElement);
                
                // Observe for height changes
                this.intersectionObserver.observe(messageElement);
            }
        }

        // Create spacer for messages below visible range
        const bottomSpacer = document.createElement('div');
        const remainingItems = this.state.messages.length - this.state.visibleEnd - 1;
        bottomSpacer.style.height = `${remainingItems * this.options.itemHeight}px`;
        this.messagesList.appendChild(bottomSpacer);
    }

    /**
     * Render a single message
     */
    renderMessage(message, index) {
        // Check cache first
        const cacheKey = `${message.id}_${message.edited_at || message.created_at}`;
        if (this.messageCache.has(cacheKey)) {
            const cached = this.messageCache.get(cacheKey).cloneNode(true);
            cached.dataset.messageId = message.id;
            cached.dataset.index = index;
            return cached;
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.is_own_message ? 'own-message' : 'other-message'}`;
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.index = index;

        // Message content
        messageElement.innerHTML = `
            <div class="message-header">
                <img src="${message.avatar_url || '/assets/images/default-avatar.png'}" 
                     alt="${message.username}" class="message-avatar" loading="lazy">
                <span class="message-username">${this.escapeHtml(message.username)}</span>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
                ${message.edited_at ? '<span class="message-edited">(edited)</span>' : ''}
            </div>
            <div class="message-content">
                ${this.renderMessageContent(message)}
            </div>
            ${this.renderMessageReactions(message.reactions)}
        `;

        // Add interaction handlers
        this.addMessageInteractions(messageElement, message);

        // Cache the element
        this.messageCache.set(cacheKey, messageElement.cloneNode(true));

        return messageElement;
    }

    /**
     * Render message content based on type
     */
    renderMessageContent(message) {
        switch (message.message_type) {
            case 'text':
                return `<p>${this.escapeHtml(message.content)}</p>`;
            
            case 'image':
                return `
                    <div class="message-image">
                        <img src="${message.file_path}" alt="${message.file_name}" 
                             loading="lazy" onclick="this.openImageModal('${message.file_path}')">
                    </div>
                `;
            
            case 'file':
                return `
                    <div class="message-file">
                        <div class="file-icon">📄</div>
                        <div class="file-info">
                            <div class="file-name">${this.escapeHtml(message.file_name)}</div>
                            <div class="file-size">${message.file_size_formatted || ''}</div>
                        </div>
                        <a href="${message.file_path}" download class="file-download">Download</a>
                    </div>
                `;
            
            case 'audio':
                return `
                    <div class="message-audio">
                        <audio controls>
                            <source src="${message.file_path}" type="${message.file_type}">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                `;
            
            case 'video':
                return `
                    <div class="message-video">
                        <video controls width="300">
                            <source src="${message.file_path}" type="${message.file_type}">
                            Your browser does not support the video element.
                        </video>
                    </div>
                `;
            
            default:
                return `<p>${this.escapeHtml(message.content || '')}</p>`;
        }
    }

    /**
     * Render message reactions
     */
    renderMessageReactions(reactions) {
        if (!reactions || reactions.length === 0) return '';

        const reactionsHtml = reactions.map(reaction => `
            <span class="reaction" data-emoji="${reaction.emoji}">
                ${reaction.emoji} ${reaction.count}
            </span>
        `).join('');

        return `<div class="message-reactions">${reactionsHtml}</div>`;
    }

    /**
     * Add message interaction handlers
     */
    addMessageInteractions(element, message) {
        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageContextMenu(e, message);
        });

        // Double-click to reply
        element.addEventListener('dblclick', () => {
            this.startReply(message);
        });

        // Reaction click handlers
        const reactions = element.querySelectorAll('.reaction');
        reactions.forEach(reaction => {
            reaction.addEventListener('click', (e) => {
                const emoji = e.target.dataset.emoji;
                this.toggleReaction(message.id, emoji);
            });
        });
    }

    /**
     * Load more messages (pagination)
     */
    async loadMoreMessages() {
        if (this.state.isLoading || !this.state.hasMore) return;

        this.state.isLoading = true;
        this.showLoadingIndicator();

        try {
            const nextPage = this.state.page + 1;
            const response = await this.fetchMessages(nextPage);
            
            // Prepend new messages (older messages go to the beginning)
            this.state.messages = [...response.messages, ...this.state.messages];
            this.state.hasMore = response.pagination.has_next_page;
            this.state.page = nextPage;

            // Adjust scroll position to maintain view
            const addedHeight = response.messages.length * this.options.itemHeight;
            this.container.scrollTop += addedHeight;

            this.calculateTotalHeight();
            this.calculateVisibleRange();
            this.renderVisibleMessages();
        } catch (error) {
            console.error('Failed to load more messages:', error);
            this.showError('Failed to load more messages');
        } finally {
            this.state.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    /**
     * Fetch messages from API
     */
    async fetchMessages(page) {
        const params = new URLSearchParams({
            page: page,
            limit: this.options.pageSize,
            group_id: this.options.groupId || ''
        });

        const response = await fetch(`/api/messages-paginated.php?${params}`, {
            headers: {
                'X-CSRF-Token': this.getCSRFToken()
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Add new message to the list
     */
    addNewMessage(message) {
        // Add to end of messages array (newest messages at bottom)
        this.state.messages.push(message);
        
        // Clear cache for this message
        const cacheKey = `${message.id}_${message.edited_at || message.created_at}`;
        this.messageCache.delete(cacheKey);

        this.calculateTotalHeight();
        this.calculateVisibleRange();
        this.renderVisibleMessages();

        // Auto-scroll to bottom for new messages
        if (this.shouldAutoScroll()) {
            this.scrollToBottom();
        }
    }

    /**
     * Update existing message
     */
    updateMessage(messageId, updatedMessage) {
        const index = this.state.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            this.state.messages[index] = { ...this.state.messages[index], ...updatedMessage };
            
            // Clear cache for this message
            const oldCacheKey = `${messageId}_${this.state.messages[index].edited_at || this.state.messages[index].created_at}`;
            this.messageCache.delete(oldCacheKey);

            this.renderVisibleMessages();
        }
    }

    /**
     * Remove message from list
     */
    removeMessage(messageId) {
        const index = this.state.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            this.state.messages.splice(index, 1);
            
            // Clear cache for this message
            this.messageCache.forEach((value, key) => {
                if (key.startsWith(`${messageId}_`)) {
                    this.messageCache.delete(key);
                }
            });

            this.calculateTotalHeight();
            this.calculateVisibleRange();
            this.renderVisibleMessages();
        }
    }

    /**
     * Calculate total height of all messages
     */
    calculateTotalHeight() {
        this.state.totalHeight = this.state.messages.length * this.options.itemHeight;
        this.messagesList.style.height = `${this.state.totalHeight}px`;
    }

    /**
     * Update container height
     */
    updateContainerHeight() {
        this.state.containerHeight = this.container.clientHeight;
    }

    /**
     * Check if user is near bottom of messages
     */
    isNearBottom(scrollTop, scrollHeight, clientHeight, threshold = 100) {
        return scrollTop + clientHeight >= scrollHeight - threshold;
    }

    /**
     * Scroll to bottom of messages
     */
    scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Auto-scroll to bottom logic
     */
    autoScrollToBottom() {
        if (this.shouldAutoScroll()) {
            this.scrollToBottom();
        }
    }

    /**
     * Determine if should auto-scroll
     */
    shouldAutoScroll() {
        // Auto-scroll if user is already near bottom
        return this.isNearBottom(
            this.container.scrollTop,
            this.container.scrollHeight,
            this.container.clientHeight
        );
    }

    /**
     * Show loading indicator
     */
    showLoadingIndicator() {
        const indicator = document.querySelector('.loading-indicator') || 
                         this.createLoadingIndicator();
        indicator.style.display = 'block';
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        const indicator = document.querySelector('.loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Create loading indicator
     */
    createLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'loading-indicator';
        indicator.innerHTML = '<div class="spinner"></div> Loading messages...';
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            display: none;
            z-index: 1000;
        `;
        this.container.appendChild(indicator);
        return indicator;
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        // Could implement toast notification here
    }

    /**
     * Utility functions
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        this.messageCache.clear();
        this.observedElements.clear();
    }
}

// Make available globally
window.VirtualScrollMessaging = VirtualScrollMessaging;
