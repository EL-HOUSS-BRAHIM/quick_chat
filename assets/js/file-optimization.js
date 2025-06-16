/**
 * Advanced File Handling and Optimization System
 * Provides image compression, lazy loading, thumbnail generation, and CDN optimization
 */

class FileOptimizer {
    constructor() {
        this.config = {
            imageCompression: {
                quality: 0.8,
                maxWidth: 1920,
                maxHeight: 1080,
                formats: ['jpeg', 'webp', 'png']
            },
            lazyLoading: {
                enabled: true,
                threshold: '50px',
                placeholderColor: '#f0f0f0'
            },
            thumbnails: {
                sizes: [150, 300, 600],
                quality: 0.7,
                format: 'webp'
            },
            cdn: {
                enabled: false,
                baseUrl: '',
                headers: {
                    'Cache-Control': 'public, max-age=31536000',
                    'Expires': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
                }
            }
        };
        
        this.compressionWorker = null;
        this.lazyObserver = null;
        this.thumbnailCache = new Map();
        
        this.initializeServices();
    }

    /**
     * Initialize file optimization services
     */
    initializeServices() {
        this.initializeImageCompression();
        this.initializeLazyLoading();
        this.initializeThumbnailGeneration();
        this.initializeCDNOptimization();
        
        console.log('File optimization services initialized');
    }

    /**
     * Initialize image compression with Web Workers
     */
    initializeImageCompression() {
        // Create Web Worker for image compression to avoid blocking UI
        const workerScript = `
            self.onmessage = function(e) {
                const { imageData, options } = e.data;
                
                // Create canvas for compression
                const canvas = new OffscreenCanvas(options.maxWidth, options.maxHeight);
                const ctx = canvas.getContext('2d');
                
                // Create image bitmap from data
                createImageBitmap(imageData).then(bitmap => {
                    // Calculate new dimensions
                    let { width, height } = bitmap;
                    const aspectRatio = width / height;
                    
                    if (width > options.maxWidth) {
                        width = options.maxWidth;
                        height = width / aspectRatio;
                    }
                    
                    if (height > options.maxHeight) {
                        height = options.maxHeight;
                        width = height * aspectRatio;
                    }
                    
                    // Resize canvas
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw and compress image
                    ctx.drawImage(bitmap, 0, 0, width, height);
                    
                    // Convert to blob
                    canvas.convertToBlob({
                        type: 'image/jpeg',
                        quality: options.quality
                    }).then(blob => {
                        self.postMessage({
                            success: true,
                            blob: blob,
                            originalSize: imageData.size,
                            compressedSize: blob.size,
                            compressionRatio: ((imageData.size - blob.size) / imageData.size * 100).toFixed(2)
                        });
                    });
                }).catch(error => {
                    self.postMessage({
                        success: false,
                        error: error.message
                    });
                });
            };
        `;

        try {
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            this.compressionWorker = new Worker(URL.createObjectURL(blob));
        } catch (error) {
            console.warn('Web Worker not supported, using fallback compression');
        }
    }

    /**
     * Compress image before upload
     */
    async compressImage(file, options = {}) {
        const config = { ...this.config.imageCompression, ...options };
        
        return new Promise((resolve, reject) => {
            if (this.compressionWorker) {
                // Use Web Worker for compression
                this.compressionWorker.onmessage = (e) => {
                    const { success, blob, error, originalSize, compressedSize, compressionRatio } = e.data;
                    
                    if (success) {
                        resolve({
                            file: new File([blob], file.name, { type: blob.type }),
                            originalSize,
                            compressedSize,
                            compressionRatio: parseFloat(compressionRatio),
                            savings: originalSize - compressedSize
                        });
                    } else {
                        reject(new Error(error));
                    }
                };
                
                this.compressionWorker.postMessage({
                    imageData: file,
                    options: config
                });
            } else {
                // Fallback compression using canvas
                this.compressImageFallback(file, config).then(resolve).catch(reject);
            }
        });
    }

    /**
     * Fallback image compression without Web Workers
     */
    async compressImageFallback(file, config) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                const aspectRatio = width / height;
                
                if (width > config.maxWidth) {
                    width = config.maxWidth;
                    height = width / aspectRatio;
                }
                
                if (height > config.maxHeight) {
                    height = config.maxHeight;
                    width = height * aspectRatio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw compressed image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve({
                            file: new File([blob], file.name, { type: blob.type }),
                            originalSize: file.size,
                            compressedSize: blob.size,
                            compressionRatio: ((file.size - blob.size) / file.size * 100).toFixed(2),
                            savings: file.size - blob.size
                        });
                    } else {
                        reject(new Error('Failed to compress image'));
                    }
                }, 'image/jpeg', config.quality);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Initialize lazy loading with Intersection Observer
     */
    initializeLazyLoading() {
        if (!this.config.lazyLoading.enabled || !('IntersectionObserver' in window)) {
            return;
        }

        const options = {
            root: null,
            rootMargin: this.config.lazyLoading.threshold,
            threshold: 0.1
        };

        this.lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadLazyImage(entry.target);
                    this.lazyObserver.unobserve(entry.target);
                }
            });
        }, options);

        // Observe existing lazy images
        this.observeLazyImages();
    }

    /**
     * Observe all lazy loading images
     */
    observeLazyImages() {
        const lazyImages = document.querySelectorAll('img[data-src], img[data-lazy]');
        lazyImages.forEach(img => {
            this.lazyObserver.observe(img);
            this.addImagePlaceholder(img);
        });
    }

    /**
     * Add placeholder to lazy image
     */
    addImagePlaceholder(img) {
        if (!img.src) {
            // Create placeholder canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.dataset.width || 300;
            canvas.height = img.dataset.height || 200;
            
            // Fill with placeholder color
            ctx.fillStyle = this.config.lazyLoading.placeholderColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add loading text
            ctx.fillStyle = '#999';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
            
            img.src = canvas.toDataURL();
            img.classList.add('lazy-placeholder');
        }
    }

    /**
     * Load lazy image
     */
    loadLazyImage(img) {
        const actualSrc = img.dataset.src || img.dataset.lazy;
        
        if (actualSrc) {
            // Preload image
            const imageLoader = new Image();
            
            imageLoader.onload = () => {
                img.src = actualSrc;
                img.classList.remove('lazy-placeholder');
                img.classList.add('lazy-loaded');
                
                // Remove data attributes
                delete img.dataset.src;
                delete img.dataset.lazy;
                
                // Trigger custom event
                img.dispatchEvent(new CustomEvent('lazyloaded', {
                    detail: { src: actualSrc }
                }));
            };
            
            imageLoader.onerror = () => {
                img.classList.add('lazy-error');
                console.error('Failed to load lazy image:', actualSrc);
            };
            
            imageLoader.src = actualSrc;
        }
    }

    /**
     * Add image to lazy loading queue
     */
    addLazyImage(imgElement, src, options = {}) {
        imgElement.dataset.src = src;
        
        if (options.width) imgElement.dataset.width = options.width;
        if (options.height) imgElement.dataset.height = options.height;
        
        this.addImagePlaceholder(imgElement);
        
        if (this.lazyObserver) {
            this.lazyObserver.observe(imgElement);
        }
    }

    /**
     * Initialize thumbnail generation
     */
    initializeThumbnailGeneration() {
        // Set up canvas for thumbnail generation
        this.thumbnailCanvas = document.createElement('canvas');
        this.thumbnailCtx = this.thumbnailCanvas.getContext('2d');
    }

    /**
     * Generate thumbnails for images
     */
    async generateThumbnails(file, sizes = null) {
        const thumbnailSizes = sizes || this.config.thumbnails.sizes;
        const thumbnails = {};
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = async () => {
                try {
                    for (const size of thumbnailSizes) {
                        const thumbnail = await this.createThumbnail(img, size);
                        thumbnails[`${size}px`] = thumbnail;
                    }
                    
                    resolve(thumbnails);
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image for thumbnails'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Create individual thumbnail
     */
    async createThumbnail(img, size) {
        const canvas = this.thumbnailCanvas;
        const ctx = this.thumbnailCtx;
        
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        let width, height;
        
        if (aspectRatio > 1) {
            width = size;
            height = size / aspectRatio;
        } else {
            height = size;
            width = size * aspectRatio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Clear canvas and draw thumbnail
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({
                    blob,
                    size: `${size}px`,
                    width: Math.round(width),
                    height: Math.round(height),
                    fileSize: blob.size,
                    dataUrl: canvas.toDataURL('image/webp', this.config.thumbnails.quality)
                });
            }, `image/${this.config.thumbnails.format}`, this.config.thumbnails.quality);
        });
    }

    /**
     * Generate video thumbnails
     */
    async generateVideoThumbnail(file, timeInSeconds = 1) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                video.currentTime = Math.min(timeInSeconds, video.duration / 2);
            };
            
            video.onseeked = () => {
                ctx.drawImage(video, 0, 0);
                
                canvas.toBlob((blob) => {
                    resolve({
                        blob,
                        width: canvas.width,
                        height: canvas.height,
                        dataUrl: canvas.toDataURL('image/jpeg', 0.8)
                    });
                }, 'image/jpeg', 0.8);
                
                // Cleanup
                URL.revokeObjectURL(video.src);
            };
            
            video.onerror = () => reject(new Error('Failed to load video'));
            
            video.src = URL.createObjectURL(file);
            video.load();
        });
    }

    /**
     * Initialize CDN optimization
     */
    initializeCDNOptimization() {
        if (!this.config.cdn.enabled) {
            return;
        }

        // Override fetch for file requests to use CDN
        this.originalFetch = window.fetch;
        window.fetch = this.createCDNFetch();
        
        // Add CDN headers to existing images
        this.optimizeExistingImages();
    }

    /**
     * Create CDN-optimized fetch wrapper
     */
    createCDNFetch() {
        return (url, options = {}) => {
            // Check if URL is for file assets
            if (this.isFileAsset(url)) {
                url = this.getCDNUrl(url);
                
                // Add CDN-specific headers
                options.headers = {
                    ...options.headers,
                    ...this.config.cdn.headers
                };
            }
            
            return this.originalFetch(url, options);
        };
    }

    /**
     * Check if URL is a file asset
     */
    isFileAsset(url) {
        const fileExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.mp3', '.wav'];
        return fileExtensions.some(ext => url.toLowerCase().includes(ext));
    }

    /**
     * Get CDN URL for asset
     */
    getCDNUrl(originalUrl) {
        if (originalUrl.startsWith('http')) {
            return originalUrl; // Already absolute URL
        }
        
        const baseUrl = this.config.cdn.baseUrl.replace(/\/$/, '');
        const cleanUrl = originalUrl.replace(/^\/+/, '');
        
        return `${baseUrl}/${cleanUrl}`;
    }

    /**
     * Optimize existing images on page
     */
    optimizeExistingImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            if (this.isFileAsset(img.src)) {
                const optimizedSrc = this.getCDNUrl(img.src);
                
                if (optimizedSrc !== img.src) {
                    img.src = optimizedSrc;
                }
            }
        });
    }

    /**
     * Progressive image loading with multiple quality levels
     */
    async implementProgressiveLoading(container, imageSrc, options = {}) {
        const {
            lowQualityFirst = true,
            qualities = [0.1, 0.3, 0.7, 1.0],
            transitionDuration = 300
        } = options;
        
        const img = document.createElement('img');
        img.style.transition = `opacity ${transitionDuration}ms ease-in-out`;
        img.style.opacity = '0';
        
        container.appendChild(img);
        
        if (lowQualityFirst) {
            // Load low quality first
            const lowQualityUrl = await this.generateLowQualityImage(imageSrc, qualities[0]);
            img.src = lowQualityUrl;
            img.style.opacity = '1';
            img.style.filter = 'blur(5px)';
        }
        
        // Load progressively higher qualities
        for (let i = 1; i < qualities.length; i++) {
            await this.loadProgressiveQuality(img, imageSrc, qualities[i], transitionDuration);
        }
        
        // Remove blur filter on final load
        img.style.filter = 'none';
        
        return img;
    }

    /**
     * Generate low quality image placeholder
     */
    async generateLowQualityImage(src, quality) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = Math.max(img.width * quality, 50);
                canvas.height = Math.max(img.height * quality, 50);
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            
            img.src = src;
        });
    }

    /**
     * Load progressive quality level
     */
    async loadProgressiveQuality(imgElement, src, quality, transitionDuration) {
        return new Promise((resolve) => {
            const tempImg = new Image();
            
            tempImg.onload = () => {
                setTimeout(() => {
                    imgElement.style.opacity = '0';
                    
                    setTimeout(() => {
                        if (quality === 1.0) {
                            imgElement.src = src; // Original quality
                        } else {
                            // Generate intermediate quality (simplified)
                            imgElement.src = tempImg.src;
                        }
                        imgElement.style.opacity = '1';
                        resolve();
                    }, transitionDuration / 2);
                }, 100);
            };
            
            if (quality === 1.0) {
                tempImg.src = src;
            } else {
                // For demo purposes, using original - in real implementation,
                // you'd have server-side quality variants
                tempImg.src = src;
            }
        });
    }

    /**
     * Batch process multiple files
     */
    async processFilesBatch(files, options = {}) {
        const {
            compress = true,
            generateThumbnails = true,
            maxConcurrent = 3
        } = options;
        
        const results = [];
        const batches = this.createBatches(files, maxConcurrent);
        
        for (const batch of batches) {
            const batchPromises = batch.map(async (file) => {
                const result = { originalFile: file, success: false };
                
                try {
                    if (file.type.startsWith('image/')) {
                        if (compress) {
                            const compressed = await this.compressImage(file);
                            result.compressed = compressed;
                        }
                        
                        if (generateThumbnails) {
                            const thumbnails = await this.generateThumbnails(file);
                            result.thumbnails = thumbnails;
                        }
                    } else if (file.type.startsWith('video/')) {
                        const thumbnail = await this.generateVideoThumbnail(file);
                        result.videoThumbnail = thumbnail;
                    }
                    
                    result.success = true;
                } catch (error) {
                    result.error = error.message;
                }
                
                return result;
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        return results;
    }

    /**
     * Create batches for concurrent processing
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.compressionWorker) {
            this.compressionWorker.terminate();
        }
        
        if (this.lazyObserver) {
            this.lazyObserver.disconnect();
        }
        
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
        
        this.thumbnailCache.clear();
        
        console.log('File optimizer destroyed');
    }

    /**
     * Get optimization statistics
     */
    getStats() {
        return {
            compressionEnabled: !!this.compressionWorker,
            lazyLoadingEnabled: !!this.lazyObserver,
            cdnEnabled: this.config.cdn.enabled,
            thumbnailCacheSize: this.thumbnailCache.size,
            config: this.config
        };
    }
}

// Initialize file optimizer
const fileOptimizer = new FileOptimizer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileOptimizer;
}

// For browser use
if (typeof window !== 'undefined') {
    window.FileOptimizer = FileOptimizer;
    window.fileOptimizer = fileOptimizer;
}

// Usage examples and helper functions
const FileOptimizationHelpers = {
    /**
     * Optimize image upload
     */
    async optimizeImageUpload(fileInput, options = {}) {
        const files = Array.from(fileInput.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            return { success: false, error: 'No image files found' };
        }
        
        try {
            const results = await fileOptimizer.processFilesBatch(imageFiles, {
                compress: true,
                generateThumbnails: true,
                ...options
            });
            
            return { success: true, results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Setup lazy loading for a container
     */
    setupLazyLoading(container) {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => {
            fileOptimizer.addLazyImage(img, img.dataset.src);
        });
    },

    /**
     * Create responsive image with multiple sizes
     */
    createResponsiveImage(src, alt, sizes = []) {
        const picture = document.createElement('picture');
        
        // Add source elements for different sizes
        sizes.forEach(size => {
            const source = document.createElement('source');
            source.media = `(max-width: ${size}px)`;
            source.srcset = fileOptimizer.getCDNUrl(`${src}?w=${size}`);
            picture.appendChild(source);
        });
        
        // Add default img element
        const img = document.createElement('img');
        img.src = fileOptimizer.getCDNUrl(src);
        img.alt = alt;
        img.loading = 'lazy';
        picture.appendChild(img);
        
        return picture;
    }
};

// Export helpers
if (typeof window !== 'undefined') {
    window.FileOptimizationHelpers = FileOptimizationHelpers;
}

console.log('Advanced file handling and optimization system loaded');
