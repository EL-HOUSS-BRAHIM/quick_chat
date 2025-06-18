/**
 * Upload Progress UI Component
 * Handles file upload progress indicators, queue management, and controls
 */

import eventBus from '../../core/event-bus.js';

class UploadProgressManager {
    constructor() {
        this.uploads = new Map(); // Track active uploads
        this.uploadQueue = []; // Queue for pending uploads
        this.maxConcurrentUploads = 3;
        this.activeUploads = 0;
        
        this.container = null;
        this.progressList = null;
        
        this.init();
    }

    /**
     * Initialize the upload progress UI
     */
    init() {
        this.createProgressContainer();
        this.bindEvents();
        
        // Subscribe to upload events
        eventBus.subscribe('upload:start', this.handleUploadStart.bind(this));
        eventBus.subscribe('upload:progress', this.handleUploadProgress.bind(this));
        eventBus.subscribe('upload:complete', this.handleUploadComplete.bind(this));
        eventBus.subscribe('upload:error', this.handleUploadError.bind(this));
    }
    
    /**
     * Create the upload progress container
     */
    createProgressContainer() {
        // Create progress container if it doesn't exist
        if (!document.getElementById('upload-progress-container')) {
            const container = document.createElement('div');
            container.id = 'upload-progress-container';
            container.className = 'upload-progress-container hidden';
            container.innerHTML = `
                <div class="upload-progress-header">
                    <h4>File Uploads</h4>
                    <button class="close-uploads" aria-label="Close uploads panel">×</button>
                </div>
                <div class="upload-progress-list"></div>
            `;
            document.body.appendChild(container);
            
            this.container = container;
            this.progressList = container.querySelector('.upload-progress-list');
            
            // Add close button handler
            const closeButton = container.querySelector('.close-uploads');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.hideProgressContainer());
            }
        } else {
            this.container = document.getElementById('upload-progress-container');
            this.progressList = this.container.querySelector('.upload-progress-list');
        }
    }
    
    /**
     * Bind events
     */
    bindEvents() {
        // Global event delegation for cancel buttons
        document.addEventListener('click', (event) => {
            if (event.target.matches('.cancel-upload') || event.target.closest('.cancel-upload')) {
                const button = event.target.matches('.cancel-upload') ? 
                    event.target : event.target.closest('.cancel-upload');
                
                const uploadId = button.dataset.uploadId;
                if (uploadId) {
                    this.cancelUpload(uploadId);
                }
            }
        });
    }
    
    /**
     * Handle upload start event
     * @param {Object} data Upload data
     */
    handleUploadStart(data) {
        const { id, file } = data;
        
        // Add to tracking map
        this.uploads.set(id, {
            id,
            file,
            progress: 0,
            status: 'uploading'
        });
        
        // Show the progress container
        this.showProgressContainer();
        
        // Add progress item to UI
        this.addProgressItem(id, file);
    }
    
    /**
     * Handle upload progress event
     * @param {Object} data Progress data
     */
    handleUploadProgress(data) {
        const { id, progress } = data;
        
        if (this.uploads.has(id)) {
            const upload = this.uploads.get(id);
            upload.progress = progress;
            
            // Update progress in UI
            this.updateProgressItem(id, progress);
        }
    }
    
    /**
     * Handle upload complete event
     * @param {Object} data Completion data
     */
    handleUploadComplete(data) {
        const { id, result } = data;
        
        if (this.uploads.has(id)) {
            const upload = this.uploads.get(id);
            upload.status = 'completed';
            upload.result = result;
            
            // Update UI
            this.completeProgressItem(id);
            
            // Remove from tracking after a delay
            setTimeout(() => {
                this.removeProgressItem(id);
                this.uploads.delete(id);
                
                // Hide container if no more uploads
                if (this.uploads.size === 0) {
                    this.hideProgressContainer();
                }
            }, 3000);
        }
    }
    
    /**
     * Handle upload error event
     * @param {Object} data Error data
     */
    handleUploadError(data) {
        const { id, error } = data;
        
        if (this.uploads.has(id)) {
            const upload = this.uploads.get(id);
            upload.status = 'error';
            upload.error = error;
            
            // Update UI
            this.errorProgressItem(id, error);
        }
    }
    
    /**
     * Add a new progress item to the UI
     * @param {string} id Upload ID
     * @param {File} file File being uploaded
     */
    addProgressItem(id, file) {
        if (!this.progressList) return;
        
        const item = document.createElement('div');
        item.className = 'upload-progress-item';
        item.dataset.uploadId = id;
        
        // Format file size
        const fileSize = this.formatFileSize(file.size);
        
        item.innerHTML = `
            <div class="upload-info">
                <div class="upload-filename" title="${file.name}">${file.name}</div>
                <div class="upload-filesize">${fileSize}</div>
            </div>
            <div class="upload-progress-bar-container">
                <div class="upload-progress-bar" style="width: 0%"></div>
            </div>
            <div class="upload-actions">
                <button class="cancel-upload" data-upload-id="${id}" aria-label="Cancel upload">
                    <span class="icon">×</span>
                </button>
            </div>
        `;
        
        this.progressList.appendChild(item);
    }
    
    /**
     * Update progress for an item
     * @param {string} id Upload ID
     * @param {number} progress Progress percentage
     */
    updateProgressItem(id, progress) {
        const item = this.progressList.querySelector(`.upload-progress-item[data-upload-id="${id}"]`);
        if (!item) return;
        
        const progressBar = item.querySelector('.upload-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }
    
    /**
     * Mark an item as completed
     * @param {string} id Upload ID
     */
    completeProgressItem(id) {
        const item = this.progressList.querySelector(`.upload-progress-item[data-upload-id="${id}"]`);
        if (!item) return;
        
        item.classList.add('completed');
        
        const progressBar = item.querySelector('.upload-progress-bar');
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        // Replace cancel button with check mark
        const actions = item.querySelector('.upload-actions');
        if (actions) {
            actions.innerHTML = `
                <span class="upload-complete-icon">✓</span>
            `;
        }
    }
    
    /**
     * Mark an item as errored
     * @param {string} id Upload ID
     * @param {string} error Error message
     */
    errorProgressItem(id, error) {
        const item = this.progressList.querySelector(`.upload-progress-item[data-upload-id="${id}"]`);
        if (!item) return;
        
        item.classList.add('error');
        
        // Add error message
        const progressContainer = item.querySelector('.upload-progress-bar-container');
        if (progressContainer) {
            progressContainer.innerHTML = `
                <div class="upload-error-message">${error}</div>
            `;
        }
    }
    
    /**
     * Remove a progress item from the UI
     * @param {string} id Upload ID
     */
    removeProgressItem(id) {
        const item = this.progressList.querySelector(`.upload-progress-item[data-upload-id="${id}"]`);
        if (item) {
            // Fade out then remove
            item.classList.add('fade-out');
            setTimeout(() => {
                item.remove();
            }, 300);
        }
    }
    
    /**
     * Cancel an upload
     * @param {string} id Upload ID
     */
    cancelUpload(id) {
        if (this.uploads.has(id)) {
            // Publish cancel event
            eventBus.publish('upload:cancel', { id });
            
            // Update UI
            const item = this.progressList.querySelector(`.upload-progress-item[data-upload-id="${id}"]`);
            if (item) {
                item.classList.add('cancelled');
                
                const progressContainer = item.querySelector('.upload-progress-bar-container');
                if (progressContainer) {
                    progressContainer.innerHTML = `
                        <div class="upload-cancelled-message">Upload cancelled</div>
                    `;
                }
                
                // Remove after delay
                setTimeout(() => {
                    this.removeProgressItem(id);
                    this.uploads.delete(id);
                }, 2000);
            }
        }
    }
    
    /**
     * Show the progress container
     */
    showProgressContainer() {
        if (this.container) {
            this.container.classList.remove('hidden');
        }
    }
    
    /**
     * Hide the progress container
     */
    hideProgressContainer() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }
    
    /**
     * Format file size for display
     * @param {number} bytes File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export default UploadProgressManager;
