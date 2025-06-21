/**
 * File Upload Progress Manager - DEPRECATED
 * This file is maintained for backward compatibility
 * Please use the new module at ./ui/upload-progress.js
 */

// Import the new implementation
import UploadProgressManager from './ui/upload-progress.js';

// Create a compatibility class that delegates to the new implementation
class FileUploadProgressManager {
    constructor() {
        console.warn('FileUploadProgressManager is deprecated. Please use UploadProgressManager from ui/upload-progress.js instead.');
        
        // Create an instance of the new UploadProgressManager class
        this.progressManager = new UploadProgressManager();
        
        // For backward compatibility
        this.uploads = this.progressManager.uploads;
        this.uploadQueue = this.progressManager.uploadQueue;
        this.maxConcurrentUploads = this.progressManager.maxConcurrentUploads;
    }
    
    // Proxy methods to the new implementation
    initializeProgressContainer() {
        // Already handled in the constructor
    }
    
    bindEvents() {
        // Already handled in the constructor
    }
    
    showProgressContainer() {
        this.progressManager.showProgressContainer();
    }
    
    hideProgressContainer() {
        this.progressManager.hideProgressContainer();
    }
    
    addProgressItem(id, file, options = {}) {
        this.progressManager.addProgressItem(id, file);
    }
    
    updateProgress(id, progress) {
        this.progressManager.updateProgressItem(id, progress);
    }
    
    completeUpload(id, result) {
        this.progressManager.handleUploadComplete({ id, result });
    }
    
    failUpload(id, error) {
        this.progressManager.handleUploadError({ id, error });
    }
    
    cancelUpload(id) {
        this.progressManager.cancelUpload(id);
    }
}

// Export for backward compatibility
window.FileUploadProgressManager = FileUploadProgressManager;
window.uploadManager = new FileUploadProgressManager();

        // Listen for drag and drop
        document.addEventListener('drop', (event) => {
            if (event.dataTransfer && event.dataTransfer.files.length > 0) {
                event.preventDefault();
                this.handleFileSelection(event.dataTransfer.files);
            }
        });
    }

    handleFileSelection(files, inputElement = null) {
        const fileArray = Array.from(files);
        
        fileArray.forEach(file => {
            const uploadId = this.generateUploadId();
            const uploadItem = {
                id: uploadId,
                file: file,
                progress: 0,
                status: 'queued', // queued, uploading, completed, failed
                inputElement: inputElement,
                startTime: null,
                xhr: null
            };
            
            this.uploads.set(uploadId, uploadItem);
            this.uploadQueue.push(uploadId);
            this.createProgressItem(uploadItem);
        });

        this.showProgressContainer();
        this.processUploadQueue();
    }

    generateUploadId() {
        return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    createProgressItem(uploadItem) {
        const progressList = document.querySelector('.upload-progress-list');
        const progressElement = document.createElement('div');
        progressElement.className = 'upload-progress-item';
        progressElement.id = `progress-${uploadItem.id}`;
        
        const fileSize = this.formatFileSize(uploadItem.file.size);
        const fileName = uploadItem.file.name;
        
        progressElement.innerHTML = `
            <div class="upload-file-info">
                <div class="file-icon">${this.getFileIcon(uploadItem.file.type)}</div>
                <div class="file-details">
                    <div class="file-name" title="${fileName}">${fileName}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
            </div>
            <div class="upload-progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
                <div class="progress-text">Queued</div>
            </div>
            <div class="upload-controls">
                <button class="cancel-upload" onclick="uploadManager.cancelUpload('${uploadItem.id}')" 
                        title="Cancel Upload">×</button>
                <button class="retry-upload" onclick="uploadManager.retryUpload('${uploadItem.id}')" 
                        title="Retry Upload" style="display: none;">↻</button>
            </div>
        `;
        
        progressList.appendChild(progressElement);
    }

    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
        return '📁';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    processUploadQueue() {
        while (this.activeUploads < this.maxConcurrentUploads && this.uploadQueue.length > 0) {
            const uploadId = this.uploadQueue.shift();
            this.startUpload(uploadId);
        }
    }

    startUpload(uploadId) {
        const uploadItem = this.uploads.get(uploadId);
        if (!uploadItem || uploadItem.status !== 'queued') return;

        this.activeUploads++;
        uploadItem.status = 'uploading';
        uploadItem.startTime = Date.now();

        this.updateProgressItem(uploadId, 0, 'Uploading...');

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', uploadItem.file);
        formData.append('upload_id', uploadId);

        // Create XMLHttpRequest for upload with progress tracking
        const xhr = new XMLHttpRequest();
        uploadItem.xhr = xhr;

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const progress = Math.round((event.loaded / event.total) * 100);
                this.updateProgressItem(uploadId, progress, `Uploading... ${progress}%`);
            }
        });

        xhr.addEventListener('load', () => {
            this.handleUploadComplete(uploadId, xhr);
        });

        xhr.addEventListener('error', () => {
            this.handleUploadError(uploadId, 'Network error occurred');
        });

        xhr.addEventListener('abort', () => {
            this.handleUploadCanceled(uploadId);
        });

        // Send the upload request
        xhr.open('POST', 'api/upload.php');
        xhr.send(formData);
    }

    handleUploadComplete(uploadId, xhr) {
        const uploadItem = this.uploads.get(uploadId);
        this.activeUploads--;

        try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                uploadItem.status = 'completed';
                this.updateProgressItem(uploadId, 100, 'Upload complete');
                
                // Trigger upload success event
                this.triggerUploadEvent('uploadSuccess', {
                    uploadId: uploadId,
                    file: uploadItem.file,
                    response: response
                });

                // Auto-remove completed uploads after 3 seconds
                setTimeout(() => {
                    this.removeProgressItem(uploadId);
                }, 3000);
            } else {
                this.handleUploadError(uploadId, response.error || 'Upload failed');
            }
        } catch (error) {
            this.handleUploadError(uploadId, 'Invalid server response');
        }

        this.processUploadQueue();
    }

    handleUploadError(uploadId, errorMessage) {
        const uploadItem = this.uploads.get(uploadId);
        uploadItem.status = 'failed';
        this.activeUploads--;

        this.updateProgressItem(uploadId, 0, `Failed: ${errorMessage}`, true);
        
        // Show retry button
        const progressElement = document.getElementById(`progress-${uploadId}`);
        if (progressElement) {
            const retryButton = progressElement.querySelector('.retry-upload');
            if (retryButton) retryButton.style.display = 'inline-block';
        }

        // Trigger upload error event
        this.triggerUploadEvent('uploadError', {
            uploadId: uploadId,
            file: uploadItem.file,
            error: errorMessage
        });

        this.processUploadQueue();
    }

    handleUploadCanceled(uploadId) {
        const uploadItem = this.uploads.get(uploadId);
        uploadItem.status = 'canceled';
        this.activeUploads--;

        this.removeProgressItem(uploadId);
        this.processUploadQueue();
    }

    updateProgressItem(uploadId, progress, text, isError = false) {
        const progressElement = document.getElementById(`progress-${uploadId}`);
        if (!progressElement) return;

        const progressFill = progressElement.querySelector('.progress-fill');
        const progressText = progressElement.querySelector('.progress-text');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.className = `progress-fill ${isError ? 'error' : ''}`;
        }

        if (progressText) {
            progressText.textContent = text;
            progressText.className = `progress-text ${isError ? 'error' : ''}`;
        }
    }

    cancelUpload(uploadId) {
        const uploadItem = this.uploads.get(uploadId);
        if (!uploadItem) return;

        if (uploadItem.xhr) {
            uploadItem.xhr.abort();
        } else {
            // Remove from queue if not yet started
            const queueIndex = this.uploadQueue.indexOf(uploadId);
            if (queueIndex > -1) {
                this.uploadQueue.splice(queueIndex, 1);
            }
            this.removeProgressItem(uploadId);
        }
    }

    retryUpload(uploadId) {
        const uploadItem = this.uploads.get(uploadId);
        if (!uploadItem || uploadItem.status !== 'failed') return;

        uploadItem.status = 'queued';
        uploadItem.xhr = null;
        this.uploadQueue.push(uploadId);

        // Hide retry button
        const progressElement = document.getElementById(`progress-${uploadId}`);
        if (progressElement) {
            const retryButton = progressElement.querySelector('.retry-upload');
            if (retryButton) retryButton.style.display = 'none';
        }

        this.updateProgressItem(uploadId, 0, 'Queued');
        this.processUploadQueue();
    }

    removeProgressItem(uploadId) {
        const progressElement = document.getElementById(`progress-${uploadId}`);
        if (progressElement) {
            progressElement.remove();
        }
        this.uploads.delete(uploadId);

        // Hide container if no uploads remain
        if (this.uploads.size === 0) {
            this.hideProgressContainer();
        }
    }

    showProgressContainer() {
        const container = document.getElementById('upload-progress-container');
        if (container) {
            container.style.display = 'block';
            container.classList.add('show');
        }
    }

    hideProgressContainer() {
        const container = document.getElementById('upload-progress-container');
        if (container) {
            container.classList.remove('show');
            setTimeout(() => {
                container.style.display = 'none';
            }, 300);
        }
    }

    triggerUploadEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        document.dispatchEvent(event);
    }

    // Public API methods
    getActiveUploads() {
        return Array.from(this.uploads.values()).filter(upload => 
            upload.status === 'uploading' || upload.status === 'queued'
        );
    }

    getUploadById(uploadId) {
        return this.uploads.get(uploadId);
    }

    clearCompletedUploads() {
        const completed = Array.from(this.uploads.entries())
            .filter(([id, upload]) => upload.status === 'completed');
        
        completed.forEach(([id]) => {
            this.removeProgressItem(id);
        });
    }

    cancelAllUploads() {
        const activeUploads = this.getActiveUploads();
        activeUploads.forEach(upload => {
            this.cancelUpload(upload.id);
        });
    }
}

// Initialize the upload manager
window.uploadManager = new FileUploadProgressManager();

// CSS styles for upload progress
const uploadStyles = `
.upload-progress-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    max-height: 400px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.15);
    z-index: 1000;
    display: none;
    overflow: hidden;
    transform: translateY(100%);
    opacity: 0;
    transition: all 0.3s ease;
}

.upload-progress-container.show {
    transform: translateY(0);
    opacity: 1;
}

.upload-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.upload-progress-header h4 {
    margin: 0;
    color: #333;
    font-size: 16px;
}

.close-uploads {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-uploads:hover {
    color: #333;
}

.upload-progress-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 10px;
}

.upload-progress-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    margin-bottom: 10px;
    background: #f8f9fa;
    transition: all 0.2s ease;
}

.upload-progress-item:last-child {
    margin-bottom: 0;
}

.upload-file-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.file-icon {
    font-size: 20px;
    flex-shrink: 0;
}

.file-details {
    min-width: 0;
    flex: 1;
}

.file-name {
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
}

.file-size {
    color: #666;
    font-size: 12px;
}

.upload-progress-bar {
    flex: 1;
    position: relative;
    height: 6px;
    background: #e9ecef;
    border-radius: 3px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #007bff, #0056b3);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.progress-fill.error {
    background: linear-gradient(90deg, #dc3545, #c82333);
}

.progress-text {
    position: absolute;
    top: -20px;
    left: 0;
    font-size: 11px;
    color: #666;
    white-space: nowrap;
}

.progress-text.error {
    color: #dc3545;
}

.upload-controls {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}

.cancel-upload,
.retry-upload {
    background: none;
    border: none;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    font-size: 14px;
    color: #666;
    transition: all 0.2s ease;
}

.cancel-upload:hover {
    background: #dc3545;
    color: white;
}

.retry-upload:hover {
    background: #28a745;
    color: white;
}

@media (max-width: 768px) {
    .upload-progress-container {
        width: calc(100% - 40px);
        right: 20px;
        left: 20px;
    }
    
    .upload-progress-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }
    
    .upload-file-info {
        order: 1;
    }
    
    .upload-progress-bar {
        order: 2;
        margin: 5px 0;
    }
    
    .upload-controls {
        order: 3;
        justify-content: center;
    }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = uploadStyles;
document.head.appendChild(styleSheet);
