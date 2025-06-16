/**
 * Admin Configuration Panel
 * Provides interface for managing system-wide settings
 */
class AdminConfigPanel {
    constructor() {
        this.settings = {
            fileUpload: {
                maxSizeBytes: 50 * 1024 * 1024, // 50MB default
                allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
                maxFiles: 10
            },
            messages: {
                retentionDays: 365,
                maxLength: 5000,
                enableReactions: true,
                enableEditing: true
            },
            users: {
                allowRegistration: true,
                requireEmailVerification: false,
                maxUsernameLength: 50,
                minPasswordLength: 8
            },
            notifications: {
                enableEmailNotifications: true,
                smtpHost: '',
                smtpPort: 587,
                smtpUsername: '',
                smtpPassword: ''
            }
        };
        
        this.init();
    }

    init() {
        this.loadCurrentSettings();
        this.setupEventListeners();
    }

    async loadCurrentSettings() {
        try {
            const response = await fetch('/api/admin.php?action=get_config', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.settings = { ...this.settings, ...data.settings };
                    this.updateUI();
                }
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    setupEventListeners() {
        // Save settings button
        document.addEventListener('click', (e) => {
            if (e.target.matches('.save-config-btn')) {
                this.saveSettings();
            }
        });

        // Reset to defaults
        document.addEventListener('click', (e) => {
            if (e.target.matches('.reset-config-btn')) {
                this.resetToDefaults();
            }
        });

        // File type management
        document.addEventListener('click', (e) => {
            if (e.target.matches('.add-file-type-btn')) {
                this.addFileType();
            }
            if (e.target.matches('.remove-file-type-btn')) {
                this.removeFileType(e.target.dataset.type);
            }
        });
    }

    updateUI() {
        // File upload settings
        const maxSizeInput = document.getElementById('maxFileSize');
        if (maxSizeInput) {
            maxSizeInput.value = Math.round(this.settings.fileUpload.maxSizeBytes / (1024 * 1024));
        }

        const maxFilesInput = document.getElementById('maxFiles');
        if (maxFilesInput) {
            maxFilesInput.value = this.settings.fileUpload.maxFiles;
        }

        // Message settings
        const retentionInput = document.getElementById('messageRetention');
        if (retentionInput) {
            retentionInput.value = this.settings.messages.retentionDays;
        }

        const maxLengthInput = document.getElementById('maxMessageLength');
        if (maxLengthInput) {
            maxLengthInput.value = this.settings.messages.maxLength;
        }

        // User settings
        const allowRegCheckbox = document.getElementById('allowRegistration');
        if (allowRegCheckbox) {
            allowRegCheckbox.checked = this.settings.users.allowRegistration;
        }

        const requireEmailCheckbox = document.getElementById('requireEmailVerification');
        if (requireEmailCheckbox) {
            requireEmailCheckbox.checked = this.settings.users.requireEmailVerification;
        }

        // Update file types list
        this.updateFileTypesList();
    }

    updateFileTypesList() {
        const container = document.getElementById('allowedFileTypes');
        if (!container) return;

        container.innerHTML = '';
        this.settings.fileUpload.allowedTypes.forEach(type => {
            const item = document.createElement('div');
            item.className = 'file-type-item';
            item.innerHTML = `
                <span>${type}</span>
                <button type="button" class="remove-file-type-btn" data-type="${type}">
                    Remove
                </button>
            `;
            container.appendChild(item);
        });
    }

    addFileType() {
        const input = document.getElementById('newFileType');
        if (!input || !input.value.trim()) return;

        const newType = input.value.trim();
        if (!this.settings.fileUpload.allowedTypes.includes(newType)) {
            this.settings.fileUpload.allowedTypes.push(newType);
            this.updateFileTypesList();
            input.value = '';
        }
    }

    removeFileType(type) {
        this.settings.fileUpload.allowedTypes = this.settings.fileUpload.allowedTypes.filter(t => t !== type);
        this.updateFileTypesList();
    }

    async saveSettings() {
        try {
            // Collect current form values
            this.collectFormValues();

            const response = await fetch('/api/admin.php?action=save_config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify(this.settings)
            });

            const result = await response.json();
            if (result.success) {
                this.showToast('Settings saved successfully', 'success');
            } else {
                this.showToast('Failed to save settings: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Save settings error:', error);
            this.showToast('Failed to save settings', 'error');
        }
    }

    collectFormValues() {
        // File upload settings
        const maxSizeInput = document.getElementById('maxFileSize');
        if (maxSizeInput) {
            this.settings.fileUpload.maxSizeBytes = parseInt(maxSizeInput.value) * 1024 * 1024;
        }

        const maxFilesInput = document.getElementById('maxFiles');
        if (maxFilesInput) {
            this.settings.fileUpload.maxFiles = parseInt(maxFilesInput.value);
        }

        // Message settings
        const retentionInput = document.getElementById('messageRetention');
        if (retentionInput) {
            this.settings.messages.retentionDays = parseInt(retentionInput.value);
        }

        const maxLengthInput = document.getElementById('maxMessageLength');
        if (maxLengthInput) {
            this.settings.messages.maxLength = parseInt(maxLengthInput.value);
        }

        // User settings
        const allowRegCheckbox = document.getElementById('allowRegistration');
        if (allowRegCheckbox) {
            this.settings.users.allowRegistration = allowRegCheckbox.checked;
        }

        const requireEmailCheckbox = document.getElementById('requireEmailVerification');
        if (requireEmailCheckbox) {
            this.settings.users.requireEmailVerification = requireEmailCheckbox.checked;
        }

        // Email settings
        const smtpHostInput = document.getElementById('smtpHost');
        if (smtpHostInput) {
            this.settings.notifications.smtpHost = smtpHostInput.value;
        }

        const smtpPortInput = document.getElementById('smtpPort');
        if (smtpPortInput) {
            this.settings.notifications.smtpPort = parseInt(smtpPortInput.value);
        }
    }

    resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            this.settings = {
                fileUpload: {
                    maxSizeBytes: 50 * 1024 * 1024,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
                    maxFiles: 10
                },
                messages: {
                    retentionDays: 365,
                    maxLength: 5000,
                    enableReactions: true,
                    enableEditing: true
                },
                users: {
                    allowRegistration: true,
                    requireEmailVerification: false,
                    maxUsernameLength: 50,
                    minPasswordLength: 8
                },
                notifications: {
                    enableEmailNotifications: true,
                    smtpHost: '',
                    smtpPort: 587,
                    smtpUsername: '',
                    smtpPassword: ''
                }
            };
            this.updateUI();
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
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

// Export for use
window.AdminConfigPanel = AdminConfigPanel;
