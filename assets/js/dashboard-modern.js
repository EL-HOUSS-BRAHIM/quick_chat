/**
 * Modern Dashboard Application
 */

class ModernDashboard {
    constructor() {
        this.config = window.dashboardConfig || {};
        this.state = {
            currentUser: this.config.currentUser,
            stats: this.config.stats,
            settings: this.loadSettings()
        };
        
        this.timers = {
            statsUpdate: null,
            usersUpdate: null
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadOnlineUsers();
        this.startPeriodicUpdates();
        this.applySettings();
    }
    
    bindEvents() {
        // New chat search
        const newChatSearch = document.getElementById('newChatSearch');
        newChatSearch?.addEventListener('input', (e) => this.handleNewChatSearch(e.target.value));
        
        // Settings checkboxes
        document.querySelectorAll('#settingsModal input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSettings());
        });
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
    
    async loadOnlineUsers() {
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=get_online`);
            const result = await response.json();
            
            if (result.success) {
                this.renderOnlineUsers(result.users || []);
                this.updateUserCount(result.users?.length || 0);
            }
        } catch (error) {
            console.error('Failed to load online users:', error);
        }
    }
    
    renderOnlineUsers(users) {
        const container = document.getElementById('onlineUsersList');
        if (!container) return;
        
        const currentUserId = this.state.currentUser.id;
        const onlineUsers = users.filter(user => user.id !== currentUserId);
        
        if (onlineUsers.length === 0) {
            container.innerHTML = this.createEmptyState('No users online', 'Check back later');
            return;
        }
        
        container.innerHTML = onlineUsers
            .map(user => this.createUserElement(user))
            .join('');
    }
    
    createUserElement(user) {
        const avatar = user.avatar || 'assets/images/default-avatar.png';
        const displayName = user.display_name || user.username;
        
        return `
            <div class="user-item" onclick="startDirectMessage(${user.id})" data-user-id="${user.id}">
                <img src="${this.escapeHtml(avatar)}" 
                     alt="${this.escapeHtml(displayName)}" 
                     class="user-avatar">
                <div class="user-info">
                    <h4>${this.escapeHtml(displayName)}</h4>
                    <p class="user-status online">Online now</p>
                </div>
                <div class="user-actions">
                    <i class="fas fa-comment"></i>
                </div>
            </div>
        `;
    }
    
    createEmptyState(title, subtitle) {
        return `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <p><strong>${title}</strong></p>
                <p>${subtitle}</p>
            </div>
        `;
    }
    
    updateUserCount(count) {
        const counter = document.querySelector('.user-count');
        if (counter) {
            counter.textContent = count;
        }
    }
    
    async handleNewChatSearch(query) {
        if (!query.trim()) {
            document.getElementById('newChatUsers').innerHTML = '';
            return;
        }
        
        try {
            const response = await fetch(`${this.config.apiEndpoints.users}?action=search&query=${encodeURIComponent(query)}`);
            const result = await response.json();
            
            if (result.success) {
                const users = result.users.filter(user => user.id !== this.state.currentUser.id);
                const container = document.getElementById('newChatUsers');
                
                if (container) {
                    if (users.length === 0) {
                        container.innerHTML = this.createEmptyState('No users found', 'Try a different search term');
                    } else {
                        container.innerHTML = users.map(user => this.createSearchUserElement(user)).join('');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }
    
    createSearchUserElement(user) {
        const avatar = user.avatar || 'assets/images/default-avatar.png';
        const displayName = user.display_name || user.username;
        const isOnline = user.is_online;
        
        return `
            <div class="user-item" onclick="startDirectMessage(${user.id})" data-user-id="${user.id}">
                <img src="${this.escapeHtml(avatar)}" 
                     alt="${this.escapeHtml(displayName)}" 
                     class="user-avatar">
                <div class="user-info">
                    <h4>${this.escapeHtml(displayName)}</h4>
                    <p class="user-status ${isOnline ? 'online' : 'offline'}">
                        ${isOnline ? 'Online' : 'Offline'}
                    </p>
                </div>
                <div class="user-actions">
                    <i class="fas fa-comment"></i>
                </div>
            </div>
        `;
    }
    
    startPeriodicUpdates() {
        // Update online users every 30 seconds
        this.timers.usersUpdate = setInterval(() => {
            this.loadOnlineUsers();
        }, 30000);
        
        // Update stats every 5 minutes
        this.timers.statsUpdate = setInterval(() => {
            this.updateStats();
        }, 300000);
    }
    
    async updateStats() {
        try {
            // In a real implementation, you would fetch updated stats from the server
            // For now, we'll just increment some values to show activity
            const statsCards = document.querySelectorAll('.stat-card');
            statsCards.forEach(card => {
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 200);
            });
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('quickchat_dashboard_settings');
            return saved ? JSON.parse(saved) : {
                notificationSounds: true,
                desktopNotifications: true,
                darkMode: false
            };
        } catch (error) {
            console.warn('Failed to load settings:', error);
            return {
                notificationSounds: true,
                desktopNotifications: true,
                darkMode: false
            };
        }
    }
    
    saveSettings() {
        try {
            localStorage.setItem('quickchat_dashboard_settings', JSON.stringify(this.state.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }
    
    updateSettings() {
        const notificationSounds = document.getElementById('notificationSounds')?.checked || false;
        const desktopNotifications = document.getElementById('desktopNotifications')?.checked || false;
        const darkMode = document.getElementById('darkMode')?.checked || false;
        
        this.state.settings = {
            notificationSounds,
            desktopNotifications,
            darkMode
        };
        
        this.applySettings();
    }
    
    applySettings() {
        // Apply dark mode
        if (this.state.settings.darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Set checkbox states
        const notificationSoundsCheckbox = document.getElementById('notificationSounds');
        const desktopNotificationsCheckbox = document.getElementById('desktopNotifications');
        const darkModeCheckbox = document.getElementById('darkMode');
        
        if (notificationSoundsCheckbox) {
            notificationSoundsCheckbox.checked = this.state.settings.notificationSounds;
        }
        if (desktopNotificationsCheckbox) {
            desktopNotificationsCheckbox.checked = this.state.settings.desktopNotifications;
        }
        if (darkModeCheckbox) {
            darkModeCheckbox.checked = this.state.settings.darkMode;
        }
    }
    
    handleVisibilityChange() {
        if (!document.hidden) {
            // User came back to the tab, refresh data
            this.loadOnlineUsers();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type = 'info') {
        // Only show if notifications are enabled
        if (!this.state.settings.desktopNotifications) return;
        
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
        
        if (type === 'success') {
            toast.style.background = '#06d6a0';
        } else if (type === 'error') {
            toast.style.background = '#ef476f';
        } else {
            toast.style.background = '#667eea';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
    
    cleanup() {
        // Clear all timers
        Object.values(this.timers).forEach(timer => {
            if (timer) clearInterval(timer);
        });
        
        // Save settings
        this.saveSettings();
    }
}

// Global functions for modal handling
function showNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.style.display = 'flex';
        const searchInput = document.getElementById('newChatSearch');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }
}

function closeNewChatModal() {
    const modal = document.getElementById('newChatModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('newChatUsers').innerHTML = '';
        document.getElementById('newChatSearch').value = '';
    }
}

function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveSettings() {
    if (window.dashboard) {
        window.dashboard.updateSettings();
        window.dashboard.saveSettings();
        window.dashboard.showNotification('Settings saved successfully!', 'success');
        closeSettingsModal();
    }
}

function startDirectMessage(userId) {
    window.location.href = `chat-modern.php?user=${userId}`;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize dashboard
    window.dashboard = new ModernDashboard();
    
    // Add interactive animations
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.animation = 'pulse 0.6s ease-in-out';
        });
        
        card.addEventListener('animationend', () => {
            card.style.animation = '';
        });
    });
    
    // Add click handlers for modal backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                const modal = backdrop.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            }
        });
    });
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (window.dashboard) {
        window.dashboard.cleanup();
    }
});
