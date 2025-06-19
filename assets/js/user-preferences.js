/**
 * User Preferences System - LEGACY FILE
 * Now imports from features/profile/preferences.js for backward compatibility
 */

import { UserPreferences as UserPreferencesNew } from './features/profile/preferences.js';

// Re-export the class with backward compatibility
class UserPreferences {
    constructor() {
        console.warn('user-preferences.js is deprecated. Use features/profile/preferences.js instead.');
        // Create an instance of the new class
        const instance = new UserPreferencesNew();
        
        // Copy all properties and methods from the new instance to this one
        Object.setPrototypeOf(this, instance);
        
        return this;
    }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.userPreferences = new UserPreferences();
});

// Export for use in other modules
export { UserPreferences };
export default UserPreferences;

    setupNotificationSound() {
        if (this.preferences.notifications.customSounds && this.preferences.notifications.soundFile) {
            // Create audio element for custom sound
            let audio = document.getElementById('notification-sound');
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = 'notification-sound';
                audio.preload = 'auto';
                document.body.appendChild(audio);
            }
            audio.src = `/assets/sounds/${this.preferences.notifications.soundFile}`;
        }
    }

    setupEventListeners() {
        // Preferences modal events
        document.addEventListener('click', (e) => {
            if (e.target.matches('.open-preferences-btn')) {
                this.openPreferencesModal();
            }
            if (e.target.matches('.save-preferences-btn')) {
                this.savePreferences();
            }
            if (e.target.matches('.reset-preferences-btn')) {
                this.resetPreferences();
            }
        });

        // Font size changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('#fontSize')) {
                this.preferences.display.fontSize = e.target.value;
                this.applyPreferences();
            }
            if (e.target.matches('#theme')) {
                this.preferences.display.theme = e.target.value;
                this.applyPreferences();
            }
        });

        // Sound file upload
        document.addEventListener('change', (e) => {
            if (e.target.matches('#customSoundFile')) {
                this.handleSoundFileUpload(e.target.files[0]);
            }
        });
    }

    openPreferencesModal() {
        const modal = this.createPreferencesModal();
        document.body.appendChild(modal);
        
        // Populate current values
        this.populatePreferencesForm(modal);
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
    }

    createPreferencesModal() {
        const modal = document.createElement('div');
        modal.className = 'modal preferences-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>User Preferences</h2>
                    <button type="button" class="close-modal-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="preferences-tabs">
                        <button type="button" class="tab-btn active" data-tab="display">Display</button>
                        <button type="button" class="tab-btn" data-tab="notifications">Notifications</button>
                        <button type="button" class="tab-btn" data-tab="privacy">Privacy</button>
                        <button type="button" class="tab-btn" data-tab="messages">Messages</button>
                    </div>
                    
                    <div class="tab-content active" data-content="display">
                        <div class="preference-group">
                            <label for="fontSize">Font Size:</label>
                            <select id="fontSize">
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="extra-large">Extra Large</option>
                            </select>
                        </div>
                        
                        <div class="preference-group">
                            <label for="theme">Theme:</label>
                            <select id="theme">
                                <option value="auto">Auto</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="compactMode"> Compact Mode
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="showTimestamps"> Show Timestamps
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-content" data-content="notifications">
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="customSounds"> Enable Custom Sounds
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label for="customSoundFile">Upload Custom Sound:</label>
                            <input type="file" id="customSoundFile" accept="audio/*">
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="enableDesktop"> Desktop Notifications
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="enableEmail"> Email Notifications
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-content" data-content="privacy">
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="showOnlineStatus"> Show Online Status
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="allowCallsFromAnyone"> Allow Calls from Anyone
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="showReadReceipts"> Show Read Receipts
                            </label>
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="showTypingIndicator"> Show Typing Indicator
                            </label>
                        </div>
                    </div>
                    
                    <div class="tab-content" data-content="messages">
                        <div class="preference-group">
                            <label for="autoDeleteDays">Auto-delete messages after (days, 0 = never):</label>
                            <input type="number" id="autoDeleteDays" min="0" max="365">
                        </div>
                        
                        <div class="preference-group">
                            <label for="archiveAfterDays">Archive messages after (days):</label>
                            <input type="number" id="archiveAfterDays" min="1" max="365">
                        </div>
                        
                        <div class="preference-group">
                            <label>
                                <input type="checkbox" id="enterToSend"> Enter to Send (Shift+Enter for new line)
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary reset-preferences-btn">Reset to Defaults</button>
                    <button type="button" class="btn btn-primary save-preferences-btn">Save Changes</button>
                </div>
            </div>
        `;

        // Tab switching
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.tab-btn')) {
                const tabName = e.target.dataset.tab;
                
                // Update active tab
                modal.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update active content
                modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                modal.querySelector(`[data-content="${tabName}"]`).classList.add('active');
            }
            
            if (e.target.matches('.close-modal-btn')) {
                this.closeModal(modal);
            }
        });

        return modal;
    }

    populatePreferencesForm(modal) {
        // Display preferences
        modal.querySelector('#fontSize').value = this.preferences.display.fontSize;
        modal.querySelector('#theme').value = this.preferences.display.theme;
        modal.querySelector('#compactMode').checked = this.preferences.display.compactMode;
        modal.querySelector('#showTimestamps').checked = this.preferences.display.showTimestamps;

        // Notification preferences
        modal.querySelector('#customSounds').checked = this.preferences.notifications.customSounds;
        modal.querySelector('#enableDesktop').checked = this.preferences.notifications.enableDesktop;
        modal.querySelector('#enableEmail').checked = this.preferences.notifications.enableEmail;

        // Privacy preferences
        modal.querySelector('#showOnlineStatus').checked = this.preferences.privacy.showOnlineStatus;
        modal.querySelector('#allowCallsFromAnyone').checked = this.preferences.privacy.allowCallsFromAnyone;
        modal.querySelector('#showReadReceipts').checked = this.preferences.privacy.showReadReceipts;
        modal.querySelector('#showTypingIndicator').checked = this.preferences.privacy.showTypingIndicator;

        // Message preferences
        modal.querySelector('#autoDeleteDays').value = this.preferences.messages.autoDeleteDays;
        modal.querySelector('#archiveAfterDays').value = this.preferences.messages.archiveAfterDays;
        modal.querySelector('#enterToSend').checked = this.preferences.messages.enterToSend;
    }

    async savePreferences() {
        const modal = document.querySelector('.preferences-modal');
        if (!modal) return;

        // Collect form values
        this.preferences.display.fontSize = modal.querySelector('#fontSize').value;
        this.preferences.display.theme = modal.querySelector('#theme').value;
        this.preferences.display.compactMode = modal.querySelector('#compactMode').checked;
        this.preferences.display.showTimestamps = modal.querySelector('#showTimestamps').checked;

        this.preferences.notifications.customSounds = modal.querySelector('#customSounds').checked;
        this.preferences.notifications.enableDesktop = modal.querySelector('#enableDesktop').checked;
        this.preferences.notifications.enableEmail = modal.querySelector('#enableEmail').checked;

        this.preferences.privacy.showOnlineStatus = modal.querySelector('#showOnlineStatus').checked;
        this.preferences.privacy.allowCallsFromAnyone = modal.querySelector('#allowCallsFromAnyone').checked;
        this.preferences.privacy.showReadReceipts = modal.querySelector('#showReadReceipts').checked;
        this.preferences.privacy.showTypingIndicator = modal.querySelector('#showTypingIndicator').checked;

        this.preferences.messages.autoDeleteDays = parseInt(modal.querySelector('#autoDeleteDays').value);
        this.preferences.messages.archiveAfterDays = parseInt(modal.querySelector('#archiveAfterDays').value);
        this.preferences.messages.enterToSend = modal.querySelector('#enterToSend').checked;

        try {
            // Save to server
            const response = await fetch('/api/users.php?action=save_preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify(this.preferences)
            });

            const result = await response.json();
            if (result.success) {
                // Save to localStorage as backup
                localStorage.setItem('userPreferences', JSON.stringify(this.preferences));
                
                // Apply changes
                this.applyPreferences();
                
                this.showToast('Preferences saved successfully', 'success');
                this.closeModal(modal);
            } else {
                this.showToast('Failed to save preferences: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Save preferences error:', error);
            this.showToast('Failed to save preferences', 'error');
        }
    }

    async handleSoundFileUpload(file) {
        if (!file) return;

        const formData = new FormData();
        formData.append('sound_file', file);
        formData.append('csrf_token', this.getCSRFToken());

        try {
            const response = await fetch('/api/upload.php?type=sound', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                this.preferences.notifications.soundFile = result.filename;
                this.showToast('Custom sound uploaded successfully', 'success');
            } else {
                this.showToast('Failed to upload sound file: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Sound upload error:', error);
            this.showToast('Failed to upload sound file', 'error');
        }
    }

    resetPreferences() {
        if (confirm('Are you sure you want to reset all preferences to defaults?')) {
            this.preferences = {
                notifications: {
                    customSounds: true,
                    soundFile: 'default_notification.mp3',
                    enableDesktop: true,
                    enableEmail: false,
                    enableSMS: false
                },
                display: {
                    fontSize: 'medium',
                    theme: 'auto',
                    compactMode: false,
                    showTimestamps: true
                },
                emoji: {
                    customSets: ['default'],
                    recentEmojis: [],
                    skinTone: 'default'
                },
                privacy: {
                    showOnlineStatus: true,
                    allowCallsFromAnyone: false,
                    showReadReceipts: true,
                    showTypingIndicator: true
                },
                messages: {
                    autoDeleteDays: 0,
                    archiveAfterDays: 90,
                    enableAutoCorrect: true,
                    enterToSend: true
                }
            };

            const modal = document.querySelector('.preferences-modal');
            if (modal) {
                this.populatePreferencesForm(modal);
            }
            this.applyPreferences();
        }
    }

    closeModal(modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.userPreferences = new UserPreferences();
});
