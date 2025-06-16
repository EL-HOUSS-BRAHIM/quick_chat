/**
 * Enhanced File Management System
 * Provides comprehensive file handling, organization, and media processing
 */
class FileManagementSystem {
    constructor() {
        this.fileTypes = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
            video: ['mp4', 'webm', 'ogg', 'avi', 'mov'],
            audio: ['mp3', 'wav', 'ogg', 'aac', 'm4a'],
            document: ['pdf', 'doc', 'docx', 'txt', 'rtf'],
            archive: ['zip', 'rar', '7z', 'tar', 'gz']
        };
        
        this.compressionSettings = {
            image: {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 0.8
            },
            video: {
                maxSize: 100 * 1024 * 1024, // 100MB
                generateThumbnail: true
            }
        };

        this.storageQuota = 1 * 1024 * 1024 * 1024; // 1GB default
        this.duplicateFiles = new Map();
        
        this.init();
    }

    async init() {
        this.setupFileOrganization();
        this.setupMediaProcessing();
        this.setupStorageManagement();
        this.checkStorageQuota();
    }

    setupFileOrganization() {
        // Create folder structure
        this.folderStructure = {
            images: '/uploads/images/',
            videos: '/uploads/videos/',
            audio: '/uploads/audio/',
            documents: '/uploads/files/',
            avatars: '/uploads/avatars/',
            thumbnails: '/uploads/thumbnails/'
        };
    }

    getFileCategory(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        
        for (const [category, extensions] of Object.entries(this.fileTypes)) {
            if (extensions.includes(extension)) {
                return category;
            }
        }
        
        return 'document';
    }

    generateFileName(originalName, userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        const extension = originalName.split('.').pop();
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
        
        return `${userId}_${timestamp}_${random}_${safeName}.${extension}`;
    }

    async checkDuplicateFile(file, userId) {
        const fileHash = await this.calculateFileHash(file);
        const duplicateKey = `${userId}_${fileHash}`;
        
        if (this.duplicateFiles.has(duplicateKey)) {
            return this.duplicateFiles.get(duplicateKey);
        }

        // Check server for existing file
        try {
            const response = await fetch('/api/files.php?action=check_duplicate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    hash: fileHash,
                    user_id: userId
                })
            });

            const result = await response.json();
            if (result.success && result.duplicate) {
                this.duplicateFiles.set(duplicateKey, result.file);
                return result.file;
            }
        } catch (error) {
            console.error('Duplicate check failed:', error);
        }

        return null;
    }

    async calculateFileHash(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    setupMediaProcessing() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async processImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const { maxWidth, maxHeight, quality } = this.compressionSettings.image;
                
                // Calculate new dimensions
                let { width, height } = this.calculateResizeDimensions(
                    img.width, img.height, maxWidth, maxHeight
                );

                // Set canvas size
                this.canvas.width = width;
                this.canvas.height = height;

                // Draw and compress
                this.ctx.drawImage(img, 0, 0, width, height);
                
                this.canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    calculateResizeDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
            return { width: originalWidth, height: originalHeight };
        }

        const widthRatio = maxWidth / originalWidth;
        const heightRatio = maxHeight / originalHeight;
        const ratio = Math.min(widthRatio, heightRatio);

        return {
            width: Math.round(originalWidth * ratio),
            height: Math.round(originalHeight * ratio)
        };
    }

    async generateImageThumbnail(file, maxSize = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const { width, height } = this.calculateResizeDimensions(
                    img.width, img.height, maxSize, maxSize
                );

                this.canvas.width = width;
                this.canvas.height = height;
                this.ctx.drawImage(img, 0, 0, width, height);
                
                this.canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    async generateVideoThumbnail(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            
            video.onloadedmetadata = () => {
                video.currentTime = Math.min(video.duration * 0.1, 5); // 10% or 5 seconds
            };
            
            video.onseeked = () => {
                this.canvas.width = video.videoWidth;
                this.canvas.height = video.videoHeight;
                this.ctx.drawImage(video, 0, 0);
                
                this.canvas.toBlob((blob) => {
                    URL.revokeObjectURL(video.src);
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('Failed to generate video thumbnail'));
            };
            
            video.src = URL.createObjectURL(file);
        });
    }

    async generateAudioWaveform(file) {
        return new Promise((resolve, reject) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    
                    const waveformData = this.extractWaveformData(audioBuffer);
                    const waveformSvg = this.generateWaveformSVG(waveformData);
                    
                    resolve(waveformSvg);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read audio file'));
            reader.readAsArrayBuffer(file);
        });
    }

    extractWaveformData(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const samples = 200; // Number of bars in waveform
        const blockSize = Math.floor(channelData.length / samples);
        const waveformData = [];
        
        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[i * blockSize + j]);
            }
            waveformData.push(sum / blockSize);
        }
        
        return waveformData;
    }

    generateWaveformSVG(waveformData) {
        const width = 400;
        const height = 100;
        const barWidth = width / waveformData.length;
        
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        
        waveformData.forEach((value, index) => {
            const barHeight = value * height;
            const x = index * barWidth;
            const y = (height - barHeight) / 2;
            
            svg += `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="#007bff"/>`;
        });
        
        svg += '</svg>';
        return svg;
    }

    async generateDocumentPreview(file) {
        // For PDF files, generate preview using PDF.js (if available)
        if (file.type === 'application/pdf' && window.pdfjsLib) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const page = await pdf.getPage(1);
                
                const viewport = page.getViewport({ scale: 0.5 });
                this.canvas.width = viewport.width;
                this.canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: this.ctx,
                    viewport: viewport
                }).promise;
                
                return new Promise(resolve => {
                    this.canvas.toBlob(resolve, 'image/jpeg', 0.8);
                });
            } catch (error) {
                console.error('Failed to generate PDF preview:', error);
            }
        }
        
        return null;
    }

    setupStorageManagement() {
        // Monitor storage usage
        this.storageUsage = 0;
        this.updateStorageUsage();
    }

    async updateStorageUsage() {
        try {
            const response = await fetch('/api/files.php?action=storage_usage', {
                method: 'GET',
                headers: {
                    'X-CSRF-Token': this.getCSRFToken()
                }
            });

            const result = await response.json();
            if (result.success) {
                this.storageUsage = result.usage;
                this.updateStorageIndicator();
            }
        } catch (error) {
            console.error('Failed to get storage usage:', error);
        }
    }

    updateStorageIndicator() {
        const indicator = document.getElementById('storageIndicator');
        if (indicator) {
            const usagePercent = (this.storageUsage / this.storageQuota) * 100;
            const usageMB = Math.round(this.storageUsage / (1024 * 1024));
            const quotaMB = Math.round(this.storageQuota / (1024 * 1024));
            
            indicator.innerHTML = `
                <div class="storage-bar">
                    <div class="storage-fill" style="width: ${Math.min(usagePercent, 100)}%"></div>
                </div>
                <div class="storage-text">${usageMB} MB / ${quotaMB} MB used</div>
            `;
            
            if (usagePercent > 90) {
                indicator.classList.add('storage-warning');
            } else {
                indicator.classList.remove('storage-warning');
            }
        }
    }

    async checkStorageQuota() {
        if (this.storageUsage > this.storageQuota * 0.9) {
            this.showStorageWarning();
        }
    }

    showStorageWarning() {
        const warning = document.createElement('div');
        warning.className = 'storage-warning-modal';
        warning.innerHTML = `
            <div class="modal-content">
                <h3>Storage Nearly Full</h3>
                <p>You're using ${Math.round((this.storageUsage / this.storageQuota) * 100)}% of your storage quota.</p>
                <p>Consider deleting old files or upgrading your plan.</p>
                <div class="modal-actions">
                    <button type="button" class="btn btn-primary" onclick="this.openFileManager()">Manage Files</button>
                    <button type="button" class="btn btn-secondary" onclick="this.closeModal(this.parentElement.parentElement)">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(warning);
    }

    async cleanupOldFiles(daysOld = 30) {
        try {
            const response = await fetch('/api/files.php?action=cleanup_old', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    days_old: daysOld
                })
            });

            const result = await response.json();
            if (result.success) {
                this.updateStorageUsage();
                this.showToast(`Cleaned up ${result.files_deleted} old files`, 'success');
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }

    async archiveOldFiles(daysOld = 90) {
        try {
            const response = await fetch('/api/files.php?action=archive_old', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    days_old: daysOld
                })
            });

            const result = await response.json();
            if (result.success) {
                this.showToast(`Archived ${result.files_archived} old files`, 'success');
            }
        } catch (error) {
            console.error('Archive failed:', error);
        }
    }

    // Main file processing method
    async processFile(file, userId) {
        const category = this.getFileCategory(file.name);
        const fileName = this.generateFileName(file.name, userId);
        
        // Check for duplicates
        const duplicate = await this.checkDuplicateFile(file, userId);
        if (duplicate) {
            return {
                success: true,
                duplicate: true,
                file: duplicate
            };
        }

        let processedFile = file;
        let thumbnail = null;
        let preview = null;
        let metadata = {};

        try {
            switch (category) {
                case 'image':
                    processedFile = await this.processImage(file);
                    thumbnail = await this.generateImageThumbnail(file);
                    break;
                    
                case 'video':
                    thumbnail = await this.generateVideoThumbnail(file);
                    break;
                    
                case 'audio':
                    preview = await this.generateAudioWaveform(file);
                    break;
                    
                case 'document':
                    preview = await this.generateDocumentPreview(file);
                    break;
            }
        } catch (error) {
            console.error('File processing error:', error);
            // Continue with original file if processing fails
        }

        return {
            success: true,
            duplicate: false,
            processedFile: processedFile,
            thumbnail: thumbnail,
            preview: preview,
            metadata: metadata,
            fileName: fileName,
            category: category
        };
    }

    // Utility methods
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

// Initialize file management system
document.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManagementSystem();
});

// Export for external use
window.FileManagementSystem = FileManagementSystem;
