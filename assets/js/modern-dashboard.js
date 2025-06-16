/**
 * Modern Dashboard Application
 */
class ModernDashboard {
    constructor(options = {}) {
        this.currentUserId = options.currentUserId;
        this.apiBase = options.apiBase || 'api/';
        
        // State
        this.currentSection = 'overview';
        this.settings = {
            theme: 'light',
            notifications: true,
            sound: true
        };
        
        // Data
        this.onlineUsers = [];
        this.messages = [];
        this.contacts = [];
        this.activities = [];
        
        // Polling intervals
        this.userPollingInterval = null;
        this.activityPollingInterval = null;
        
        this.bindElements();
        this.loadSettings();
    }
    
    bindElements() {
        this.elements = {
            // Navigation
            menuItems: document.querySelectorAll('.menu-item[data-section]'),
            contentSections: document.querySelectorAll('.content-section'),
            pageTitle: document.getElementById('pageTitle'),
            
            // Header
            globalSearch: document.getElementById('globalSearch'),
            notificationBadge: document.getElementById('notificationBadge'),
            themeIcon: document.getElementById('themeIcon'),
            
            // Overview
            activityList: document.getElementById('activityList'),
            onlineUsersList: document.getElementById('onlineUsersList'),
            
            // Messages
            messagesList: document.getElementById('messagesList'),
            
            // Contacts
            contactsGrid: document.getElementById('contactsGrid'),
            contactsSearch: document.getElementById('contactsSearch'),
            
            // Settings
            emailNotifications: document.getElementById('emailNotifications'),
            pushNotifications: document.getElementById('pushNotifications'),
            soundNotifications: document.getElementById('soundNotifications'),
            showOnlineStatus: document.getElementById('showOnlineStatus'),
            readReceipts: document.getElementById('readReceipts'),
            whoCanMessage: document.getElementById('whoCanMessage'),
            themeSelect: document.getElementById('themeSelect'),
            fontSize: document.getElementById('fontSize'),
            
            // Modals
            newGroupModal: document.getElementById('newGroupModal'),
            groupName: document.getElementById('groupName'),
            groupDescription: document.getElementById('groupDescription'),
            memberSearch: document.getElementById('memberSearch'),
            memberResults: document.getElementById('memberResults')
        };
    }
    
    init() {
        console.log('Initializing Modern Dashboard...');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        this.loadInitialData();
        
        // Apply theme
        this.applyTheme();
        
        // Start polling
        this.startPolling();
        
        console.log('Modern Dashboard initialized successfully');
    }
    
    setupEventListeners() {
        // Navigation
        this.elements.menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                if (section) {
                    this.switchSection(section);
                }
            });
        });
        
        // Search
        if (this.elements.globalSearch) {
            this.elements.globalSearch.addEventListener('input', (e) => {
                this.debounce(() => this.globalSearch(e.target.value), 300);
            });
        }
        
        if (this.elements.contactsSearch) {
            this.elements.contactsSearch.addEventListener('input', (e) => {
                this.debounce(() => this.searchContacts(e.target.value), 300);
            });
        }
        
        // Settings
        this.bindSettingsListeners();
        
        // Modal events
        if (this.elements.memberSearch) {
            this.elements.memberSearch.addEventListener('input', (e) => {
                this.debounce(() => this.searchMembers(e.target.value), 300);
            });
        }
        
        // Chart period change
        const chartPeriod = document.getElementById('chartPeriod');
        if (chartPeriod) {
            chartPeriod.addEventListener('change', () => this.updateChart());
        }
        
        // Filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setActiveFilter(e.target);
                this.filterMessages(e.target.dataset.filter);
            });
        });
        
        // Window events
        window.addEventListener('resize', () => this.handleResize());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    bindSettingsListeners() {
        const settingsInputs = [
            'emailNotifications', 'pushNotifications', 'soundNotifications',
            'showOnlineStatus', 'readReceipts', 'whoCanMessage', 'themeSelect', 'fontSize'
        ];
        
        settingsInputs.forEach(inputId => {
            const element = this.elements[inputId];
            if (element) {
                element.addEventListener('change', () => this.saveSettings());
            }
        });
        
        // Theme select special handling
        if (this.elements.themeSelect) {
            this.elements.themeSelect.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }
    }
    
    async loadInitialData() {
        try {
            // Load data for current section
            await this.loadSectionData(this.currentSection);
            
            // Load common data
            await Promise.all([
                this.loadOnlineUsers(),
                this.loadRecentActivity()
            ]);
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }
    
    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadOverviewData();
                break;
            case 'messages':
                await this.loadMessages();
                break;
            case 'contacts':
                await this.loadContacts();
                break;
        }
    }
    
    async loadOverviewData() {
        try {
            // Load stats and charts
            this.updateActivityChart();
        } catch (error) {
            console.error('Failed to load overview data:', error);
        }
    }
    
    async loadOnlineUsers() {
        try {
            const response = await fetch(`${this.apiBase}users.php?action=online`);
            const data = await response.json();
            
            if (data.success) {
                this.onlineUsers = data.users || [];
                this.renderOnlineUsers();
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }
    
    async loadRecentActivity() {
        try {
            const response = await fetch(`${this.apiBase}messages.php?action=recent&limit=20`);
            const data = await response.json();
            
            if (data.success) {
                this.activities = data.messages || [];
                this.renderActivities();
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }
    
    async loadMessages() {
        try {
            const response = await fetch(`${this.apiBase}messages.php?action=conversations`);
            const data = await response.json();
            
            if (data.success) {
                this.messages = data.conversations || [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    async loadContacts() {
        try {
            const response = await fetch(`${this.apiBase}users.php?action=contacts`);
            const data = await response.json();
            
            if (data.success) {
                this.contacts = data.contacts || [];
                this.renderContacts();
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }
    
    // Rendering Methods
    renderOnlineUsers() {
        if (!this.elements.onlineUsersList) return;
        
        const usersHTML = this.onlineUsers.map(user => `
            <div class="user-item" onclick="startChat(${user.id})">
                <div class="user-avatar">
                    <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${user.display_name || user.username}">
                    <div class="status-dot online"></div>
                </div>
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.display_name || user.username)}</div>
                    <div class="user-status">Online</div>
                </div>
                <button class="user-action" title="Start chat">
                    <i class="fas fa-comment"></i>
                </button>
            </div>
        `).join('');
        
        this.elements.onlineUsersList.innerHTML = usersHTML || '<div class="empty-state">No users online</div>';
    }
    
    renderActivities() {
        if (!this.elements.activityList) return;
        
        const activitiesHTML = this.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-avatar">
                    <img src="${activity.avatar || 'assets/images/default-avatar.svg'}" alt="${activity.display_name || activity.username}">
                </div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${this.escapeHtml(activity.display_name || activity.username)}</strong>
                        sent a message
                    </div>
                    <div class="activity-time">${this.formatDate(activity.created_at)}</div>
                </div>
            </div>
        `).join('');
        
        this.elements.activityList.innerHTML = activitiesHTML || '<div class="empty-state">No recent activity</div>';
    }
    
    renderMessages() {
        if (!this.elements.messagesList) return;
        
        const messagesHTML = this.messages.map(conversation => {
            const lastMessage = conversation.last_message;
            return `
                <div class="conversation-item" onclick="openConversation(${conversation.id})">
                    <div class="conversation-avatar">
                        <img src="${conversation.avatar || 'assets/images/default-avatar.svg'}" alt="${conversation.name}">
                        ${conversation.unread_count > 0 ? '<div class="unread-indicator"></div>' : ''}
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${this.escapeHtml(conversation.name)}</div>
                        <div class="conversation-preview">${lastMessage ? this.escapeHtml(lastMessage.content.substring(0, 50)) : 'No messages yet'}</div>
                    </div>
                    <div class="conversation-meta">
                        <div class="conversation-time">${lastMessage ? this.formatDate(lastMessage.created_at) : ''}</div>
                        ${conversation.unread_count > 0 ? `<div class="unread-badge">${conversation.unread_count}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        this.elements.messagesList.innerHTML = messagesHTML || '<div class="empty-state">No conversations yet</div>';
    }
    
    renderContacts() {
        if (!this.elements.contactsGrid) return;
        
        const contactsHTML = this.contacts.map(contact => `
            <div class="contact-card" onclick="startChat(${contact.id})">
                <div class="contact-avatar">
                    <img src="${contact.avatar || 'assets/images/default-avatar.svg'}" alt="${contact.display_name || contact.username}">
                    <div class="status-dot ${contact.is_online ? 'online' : 'offline'}"></div>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${this.escapeHtml(contact.display_name || contact.username)}</div>
                    <div class="contact-status">${contact.is_online ? 'Online' : 'Offline'}</div>
                </div>
                <div class="contact-actions">
                    <button class="contact-action" title="Start chat">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="contact-action" title="More">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        this.elements.contactsGrid.innerHTML = contactsHTML || '<div class="empty-state">No contacts yet</div>';
    }
    
    // Navigation
    switchSection(section) {
        // Update menu items
        this.elements.menuItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        
        // Update content sections
        this.elements.contentSections.forEach(content => {
            content.classList.toggle('active', content.id === section + 'Section');
        });
        
        // Update page title
        const titles = {
            overview: 'Overview',
            messages: 'Messages',
            contacts: 'Contacts',
            settings: 'Settings'
        };
        
        if (this.elements.pageTitle) {
            this.elements.pageTitle.textContent = titles[section] || 'Dashboard';
        }
        
        // Load section data
        this.currentSection = section;
        this.loadSectionData(section);
    }
    
    // Search
    globalSearch(query) {
        if (!query.trim()) return;
        
        console.log('Global search:', query);
        // Implement global search logic
    }
    
    searchContacts(query) {
        if (!query.trim()) {
            this.renderContacts();
            return;
        }
        
        const filtered = this.contacts.filter(contact => {
            const name = (contact.display_name || contact.username).toLowerCase();
            return name.includes(query.toLowerCase());
        });
        
        // Render filtered contacts
        if (this.elements.contactsGrid) {
            const contactsHTML = filtered.map(contact => `
                <div class="contact-card" onclick="startChat(${contact.id})">
                    <div class="contact-avatar">
                        <img src="${contact.avatar || 'assets/images/default-avatar.svg'}" alt="${contact.display_name || contact.username}">
                        <div class="status-dot ${contact.is_online ? 'online' : 'offline'}"></div>
                    </div>
                    <div class="contact-info">
                        <div class="contact-name">${this.escapeHtml(contact.display_name || contact.username)}</div>
                        <div class="contact-status">${contact.is_online ? 'Online' : 'Offline'}</div>
                    </div>
                    <div class="contact-actions">
                        <button class="contact-action" title="Start chat">
                            <i class="fas fa-comment"></i>
                        </button>
                        <button class="contact-action" title="More">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            this.elements.contactsGrid.innerHTML = contactsHTML || '<div class="empty-state">No contacts found</div>';
        }
    }
    
    async searchMembers(query) {
        if (!query.trim()) {
            this.elements.memberResults.innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}users.php?action=search&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                this.renderMemberResults(data.users || []);
            }
        } catch (error) {
            console.error('Failed to search members:', error);
        }
    }
    
    renderMemberResults(users) {
        const resultsHTML = users.map(user => `
            <div class="member-result" onclick="addMember(${user.id})">
                <div class="member-avatar">
                    <img src="${user.avatar || 'assets/images/default-avatar.svg'}" alt="${user.display_name || user.username}">
                </div>
                <div class="member-info">
                    <div class="member-name">${this.escapeHtml(user.display_name || user.username)}</div>
                    <div class="member-status">${user.is_online ? 'Online' : 'Offline'}</div>
                </div>
            </div>
        `).join('');
        
        this.elements.memberResults.innerHTML = resultsHTML || '<div class="empty-state">No users found</div>';
    }
    
    // Filters
    setActiveFilter(activeBtn) {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn === activeBtn);
        });
    }
    
    filterMessages(filter) {
        console.log('Filtering messages:', filter);
        // Implement message filtering logic
    }
    
    // Charts
    updateActivityChart() {
        const canvas = document.getElementById('activityChart');
        if (!canvas) return;
        
        // Simple chart implementation
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Sample data
        const data = [12, 19, 3, 5, 2, 3, 20, 15, 8, 12, 6, 9];
        const max = Math.max(...data);
        const barWidth = width / data.length;
        
        // Draw bars
        ctx.fillStyle = '#6366f1';
        data.forEach((value, index) => {
            const barHeight = (value / max) * height * 0.8;
            const x = index * barWidth;
            const y = height - barHeight;
            
            ctx.fillRect(x + 10, y, barWidth - 20, barHeight);
        });
    }
    
    updateChart() {
        const period = document.getElementById('chartPeriod')?.value;
        console.log('Updating chart for period:', period);
        this.updateActivityChart();
    }
    
    // Settings
    loadSettings() {
        const saved = localStorage.getItem('dashboardSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
        
        // Apply settings to UI
        this.applySettingsToUI();
    }
    
    saveSettings() {
        // Get values from UI
        if (this.elements.emailNotifications) {
            this.settings.emailNotifications = this.elements.emailNotifications.checked;
        }
        if (this.elements.pushNotifications) {
            this.settings.pushNotifications = this.elements.pushNotifications.checked;
        }
        if (this.elements.soundNotifications) {
            this.settings.soundNotifications = this.elements.soundNotifications.checked;
        }
        if (this.elements.showOnlineStatus) {
            this.settings.showOnlineStatus = this.elements.showOnlineStatus.checked;
        }
        if (this.elements.readReceipts) {
            this.settings.readReceipts = this.elements.readReceipts.checked;
        }
        if (this.elements.whoCanMessage) {
            this.settings.whoCanMessage = this.elements.whoCanMessage.value;
        }
        if (this.elements.themeSelect) {
            this.settings.theme = this.elements.themeSelect.value;
        }
        if (this.elements.fontSize) {
            this.settings.fontSize = this.elements.fontSize.value;
        }
        
        localStorage.setItem('dashboardSettings', JSON.stringify(this.settings));
        this.showToast('Settings saved successfully', 'success');
    }
    
    applySettingsToUI() {
        if (this.elements.emailNotifications) {
            this.elements.emailNotifications.checked = this.settings.emailNotifications ?? true;
        }
        if (this.elements.pushNotifications) {
            this.elements.pushNotifications.checked = this.settings.pushNotifications ?? true;
        }
        if (this.elements.soundNotifications) {
            this.elements.soundNotifications.checked = this.settings.soundNotifications ?? false;
        }
        if (this.elements.showOnlineStatus) {
            this.elements.showOnlineStatus.checked = this.settings.showOnlineStatus ?? true;
        }
        if (this.elements.readReceipts) {
            this.elements.readReceipts.checked = this.settings.readReceipts ?? true;
        }
        if (this.elements.whoCanMessage) {
            this.elements.whoCanMessage.value = this.settings.whoCanMessage || 'everyone';
        }
        if (this.elements.themeSelect) {
            this.elements.themeSelect.value = this.settings.theme || 'light';
        }
        if (this.elements.fontSize) {
            this.elements.fontSize.value = this.settings.fontSize || 'medium';
        }
    }
    
    applyTheme() {
        if (this.settings.theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', this.settings.theme);
        }
        
        // Update theme icon
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    // Polling
    startPolling() {
        // Poll for online users every 30 seconds
        this.userPollingInterval = setInterval(() => {
            this.loadOnlineUsers();
        }, 30000);
        
        // Poll for activity every 60 seconds
        this.activityPollingInterval = setInterval(() => {
            this.loadRecentActivity();
        }, 60000);
    }
    
    // Modals
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    // Notifications
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        }[type] || 'fas fa-info-circle';
        
        toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, type === 'error' ? 5000 : 3000);
    }
    
    // Utility Methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ago`;
        } else if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return 'Just now';
        }
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(func, wait);
    }
    
    handleResize() {
        // Handle responsive changes
        if (window.innerWidth > 768) {
            this.closeMobileSidebar();
        }
    }
    
    handleKeyboard(e) {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    this.elements.globalSearch?.focus();
                    break;
                case '1':
                    e.preventDefault();
                    this.switchSection('overview');
                    break;
                case '2':
                    e.preventDefault();
                    this.switchSection('messages');
                    break;
                case '3':
                    e.preventDefault();
                    this.switchSection('contacts');
                    break;
                case '4':
                    e.preventDefault();
                    this.switchSection('settings');
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
    }
    
    closeMobileSidebar() {
        const sidebar = document.querySelector('.dashboard-sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }
    
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
        });
    }
    
    cleanup() {
        // Clear intervals
        if (this.userPollingInterval) {
            clearInterval(this.userPollingInterval);
        }
        if (this.activityPollingInterval) {
            clearInterval(this.activityPollingInterval);
        }
    }
}

// Global functions for onclick handlers
function toggleSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

function toggleTheme() {
    if (window.dashboard) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        window.dashboard.settings.theme = newTheme;
        window.dashboard.saveSettings();
        window.dashboard.applyTheme();
    }
}

function toggleNotifications() {
    // Toggle notification panel
    console.log('Toggle notifications');
}

function startChat(userId) {
    window.location.href = `chat-new.php?user=${userId}`;
}

function openConversation(conversationId) {
    window.location.href = `chat-new.php?conversation=${conversationId}`;
}

function refreshActivity() {
    if (window.dashboard) {
        window.dashboard.loadRecentActivity();
    }
}

function showNewGroupModal() {
    if (window.dashboard && window.dashboard.showNewGroupModal) {
        window.dashboard.showNewGroupModal();
    } else {
        // Fallback implementation
        const modal = document.getElementById('newGroupModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
    }
}

function showInviteModal() {
    if (window.dashboard && window.dashboard.showInviteModal) {
        window.dashboard.showInviteModal();
    } else {
        console.log('Show invite modal - dashboard not ready');
    }
}

// Add missing global functions for invite functionality
function copyInviteLink() {
    const linkInput = document.getElementById('inviteLink');
    if (linkInput) {
        linkInput.select();
        linkInput.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            if (window.dashboard && window.dashboard.showToast) {
                window.dashboard.showToast('Invite link copied!', 'success');
            }
        } catch (err) {
            console.error('Failed to copy invite link:', err);
        }
    }
}

function sendEmailInvite() {
    const emailInput = document.getElementById('inviteEmail');
    if (!emailInput || !emailInput.value.trim()) {
        if (window.dashboard && window.dashboard.showToast) {
            window.dashboard.showToast('Please enter an email address', 'error');
        }
        return;
    }
    
    // Here you would normally send the invite via API
    // For now, just show success message
    if (window.dashboard && window.dashboard.showToast) {
        window.dashboard.showToast('Invite sent successfully!', 'success');
    }
    
    emailInput.value = '';
}

function showAddContactModal() {
    // Create and show add contact modal
    let modal = document.getElementById('addContactModal');
    if (!modal) {
        modal = createAddContactModal();
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function createAddContactModal() {
    const modal = document.createElement('div');
    modal.id = 'addContactModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('addContactModal')"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add Contact</h3>
                <button class="modal-close" onclick="closeModal('addContactModal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Search Users</label>
                    <input type="text" id="contactSearch" placeholder="Enter username or email...">
                </div>
                <div class="search-results" id="contactSearchResults">
                    <!-- Search results will appear here -->
                </div>
            </div>
        </div>
    `;
    return modal;
}

function createGroup() {
    const groupName = document.getElementById('groupName')?.value?.trim();
    const groupDescription = document.getElementById('groupDescription')?.value?.trim();
    
    if (!groupName) {
        if (window.dashboard && window.dashboard.showToast) {
            window.dashboard.showToast('Please enter a group name', 'error');
        }
        return;
    }
    
    // Here you would normally create the group via API
    // For now, just show success message
    if (window.dashboard && window.dashboard.showToast) {
        window.dashboard.showToast('Group created successfully!', 'success');
    }
    
    closeModal('newGroupModal');
}

function addMember(userId) {
    console.log('Add member:', userId);
    // Implementation for adding member to group
    if (window.dashboard && window.dashboard.showToast) {
        window.dashboard.showToast('Member added to group!', 'success');
    }
}

function changePassword() {
    console.log('Change password');
}

function exportData() {
    console.log('Export data');
}

function deleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        console.log('Delete account');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = 'auth.php?action=logout';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Dashboard will be initialized from the main script tag in the HTML
});
