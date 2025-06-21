/**
 * Mobile Experience Manager
 * Enhanced mobile experience with optimized image loading and offline capabilities
 * Implementation of TODO: Mobile Experience Improvements (Added June 20, 2025)
 */

import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';
import errorHandler from '../../core/error-handler.js';

class MobileExperienceManager {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isTablet = this.detectTablet();
    this.connection = null;
    this.networkSpeed = 'fast';
    this.offlineMode = false;
    this.swipeGestures = new Map();
    this.touchStartPos = null;
    this.touchThreshold = 50;
    this.imageCache = new Map();
    this.compressionWorker = null;
    this.serviceWorker = null;
    
    // Mobile-specific settings
    this.settings = {
      swipeGestures: true,
      pullToRefresh: true,
      hapticFeedback: true,
      adaptiveUI: true,
      offlineMode: true,
      imageOptimization: true,
      lazyLoading: true,
      compressionQuality: 0.8,
      maxImageWidth: 1200,
      maxImageHeight: 800,
      pushNotifications: true,
      gestureNavigation: true
    };

    // Initialize state
    state.register('mobile', {
      isMobile: this.isMobile,
      isTablet: this.isTablet,
      networkSpeed: this.networkSpeed,
      offlineMode: this.offlineMode,
      settings: this.settings
    });
  }

  /**
   * Initialize mobile experience manager
   */
  async init() {
    if (!this.isMobile && !this.isTablet) return;

    console.log('Initializing mobile experience manager...');

    try {
      // Set up network monitoring
      await this.initializeNetworkMonitoring();

      // Set up swipe gestures
      this.initializeSwipeGestures();

      // Set up pull-to-refresh
      this.initializePullToRefresh();

      // Set up adaptive UI (TODO: Add mobile-specific UI optimizations)
      this.initializeAdaptiveUI();

      // Set up image optimization (TODO: Optimize image loading for mobile networks - 75% complete)
      await this.initializeImageOptimization();

      // Set up offline capabilities (TODO: Improve offline capabilities for mobile users - 50% complete)
      await this.initializeOfflineCapabilities();

      // Set up push notifications (TODO: Implement push notifications for mobile browsers)
      await this.initializePushNotifications();

      // Set up gesture navigation (TODO: Implement gesture-based navigation for mobile)
      this.initializeGestureNavigation();

      // Set up haptic feedback
      this.initializeHapticFeedback();

      // Register event listeners
      this.registerEventListeners();

      console.log('Mobile experience manager initialized successfully');
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize mobile experience manager');
    }
  }

  /**
   * Detect if device is mobile
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  /**
   * Detect if device is tablet
   */
  detectTablet() {
    return /iPad|Android/i.test(navigator.userAgent) && 
           window.innerWidth > 768 && window.innerWidth <= 1024;
  }

  /**
   * Initialize network monitoring for adaptive loading
   */
  async initializeNetworkMonitoring() {
    // Check for Network Information API
    if ('connection' in navigator) {
      this.connection = navigator.connection;
      this.updateNetworkSpeed();

      // Listen for network changes
      this.connection.addEventListener('change', () => {
        this.updateNetworkSpeed();
        this.adaptToNetworkConditions();
      });
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.offlineMode = false;
      this.showNotification('Back online', 'success');
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.offlineMode = true;
      this.showNotification('You are offline', 'warning');
    });
  }

  /**
   * Update network speed classification
   */
  updateNetworkSpeed() {
    if (!this.connection) return;

    const effectiveType = this.connection.effectiveType;
    const downlink = this.connection.downlink;

    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5) {
      this.networkSpeed = 'slow';
    } else if (effectiveType === '3g' || downlink < 2) {
      this.networkSpeed = 'medium';
    } else {
      this.networkSpeed = 'fast';
    }

    console.log(`Network speed: ${this.networkSpeed} (${effectiveType}, ${downlink}Mbps)`);
  }

  /**
   * Adapt UI and loading behavior to network conditions
   */
  adaptToNetworkConditions() {
    const body = document.body;

    // Remove existing network classes
    body.classList.remove('network-slow', 'network-medium', 'network-fast');
    
    // Add current network class
    body.classList.add(`network-${this.networkSpeed}`);

    // Adjust image loading strategy
    this.adjustImageLoadingStrategy();

    // Adjust message loading
    this.adjustMessageLoading();
  }

  /**
   * Initialize swipe gestures for mobile navigation
   */
  initializeSwipeGestures() {
    if (!this.settings.swipeGestures) return;

    // Register common swipe gestures
    this.registerSwipeGesture('message', (element, direction) => {
      if (direction === 'left') {
        this.showMessageActions(element);
      } else if (direction === 'right') {
        this.replyToMessage(element);
      }
    });

    this.registerSwipeGesture('chat-item', (element, direction) => {
      if (direction === 'left') {
        this.showChatActions(element);
      } else if (direction === 'right') {
        this.markChatAsRead(element);
      }
    });

    // Set up touch event listeners
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
  }

  /**
   * Register swipe gesture handler
   */
  registerSwipeGesture(selector, handler) {
    this.swipeGestures.set(selector, handler);
  }

  /**
   * Handle touch start events
   */
  handleTouchStart(event) {
    if (event.touches.length !== 1) return;

    this.touchStartPos = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: Date.now(),
      target: event.target
    };
  }

  /**
   * Handle touch move events
   */
  handleTouchMove(event) {
    if (!this.touchStartPos || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartPos.x;
    const deltaY = touch.clientY - this.touchStartPos.y;

    // Check if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.touchThreshold) {
      // Find swipeable element
      const swipeableElement = this.findSwipeableElement(this.touchStartPos.target);
      if (swipeableElement) {
        event.preventDefault(); // Prevent scrolling
        this.showSwipeIndicator(swipeableElement, deltaX);
      }
    }
  }

  /**
   * Handle touch end events
   */
  handleTouchEnd(event) {
    if (!this.touchStartPos) return;

    const touchEndPos = event.changedTouches[0];
    const deltaX = touchEndPos.clientX - this.touchStartPos.x;
    const deltaY = touchEndPos.clientY - this.touchStartPos.y;
    const deltaTime = Date.now() - this.touchStartPos.time;

    // Check for swipe gesture
    if (
      Math.abs(deltaX) > this.touchThreshold &&
      Math.abs(deltaX) > Math.abs(deltaY) &&
      deltaTime < 500
    ) {
      const direction = deltaX > 0 ? 'right' : 'left';
      const swipeableElement = this.findSwipeableElement(this.touchStartPos.target);
      
      if (swipeableElement) {
        this.executeSwipeGesture(swipeableElement, direction);
        this.triggerHapticFeedback();
      }
    }

    // Clean up
    this.hideSwipeIndicators();
    this.touchStartPos = null;
  }

  /**
   * Find swipeable element from touch target
   */
  findSwipeableElement(target) {
    for (const [selector] of this.swipeGestures) {
      const element = target.closest(`.${selector}`);
      if (element) return element;
    }
    return null;
  }

  /**
   * Execute swipe gesture
   */
  executeSwipeGesture(element, direction) {
    for (const [selector, handler] of this.swipeGestures) {
      if (element.classList.contains(selector)) {
        handler(element, direction);
        break;
      }
    }
  }

  /**
   * Initialize pull-to-refresh functionality
   */
  initializePullToRefresh() {
    if (!this.settings.pullToRefresh) return;

    let pullStartY = 0;
    let pullDistance = 0;
    let isPulling = false;
    const pullThreshold = 80;

    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;

    messagesContainer.addEventListener('touchstart', (event) => {
      if (messagesContainer.scrollTop === 0) {
        pullStartY = event.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    messagesContainer.addEventListener('touchmove', (event) => {
      if (!isPulling) return;

      pullDistance = event.touches[0].clientY - pullStartY;
      
      if (pullDistance > 0) {
        event.preventDefault();
        this.showPullToRefreshIndicator(Math.min(pullDistance / pullThreshold, 1));
      }
    }, { passive: false });

    messagesContainer.addEventListener('touchend', () => {
      if (isPulling && pullDistance > pullThreshold) {
        this.triggerRefresh();
        this.triggerHapticFeedback();
      }
      
      this.hidePullToRefreshIndicator();
      isPulling = false;
      pullDistance = 0;
    }, { passive: true });
  }

  /**
   * Initialize image optimization for mobile
   */
  async initializeImageOptimization() {
    if (!this.settings.imageOptimization) return;

    // Create compression worker for background processing
    try {
      this.compressionWorker = new Worker('/assets/js/workers/image-compression-worker.js');
      
      this.compressionWorker.onmessage = (event) => {
        const { id, compressedBlob, error } = event.data;
        
        if (error) {
          console.error('Image compression error:', error);
          eventBus.emit('image-compression-error', { id, error });
        } else {
          this.imageCache.set(id, compressedBlob);
          eventBus.emit('image-compressed', { id, compressedBlob });
        }
      };
    } catch (error) {
      console.warn('Image compression worker not available, using fallback');
      this.compressionWorker = null;
    }

    // Set up lazy loading for images
    this.initializeLazyLoading();

    // Set up automatic image compression for uploads
    this.initializeUploadCompression();
  }

  /**
   * Initialize lazy loading for images
   */
  initializeLazyLoading() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, skipping lazy loading');
      return;
    }

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          
          if (src) {
            // Load optimized version based on network speed
            const optimizedSrc = this.getOptimizedImageUrl(src);
            img.src = optimizedSrc;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });

    // Also observe dynamically added images
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const images = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
              images.forEach(img => imageObserver.observe(img));
            }
          });
        }
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Initialize upload compression
   */
  initializeUploadCompression() {
    // Listen for file upload events
    eventBus.on('file-upload-start', async (data) => {
      const { file, uploadId } = data;
      
      if (this.isImage(file) && file.size > 1024 * 1024) { // Compress files > 1MB
        try {
          const compressedFile = await this.compressImage(file);
          eventBus.emit('file-compressed', { uploadId, originalFile: file, compressedFile });
        } catch (error) {
          console.error('File compression failed:', error);
          // Continue with original file
          eventBus.emit('file-compression-skipped', { uploadId, file });
        }
      }
    });
  }

  /**
   * Compress image file
   */
  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = this.calculateOptimalDimensions(
          img.width, 
          img.height, 
          this.settings.maxImageWidth, 
          this.settings.maxImageHeight
        );

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Create new file with compressed data
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Canvas to blob conversion failed'));
          }
        }, file.type, this.settings.compressionQuality);
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate optimal dimensions for image compression
   */
  calculateOptimalDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    let width = originalWidth;
    let height = originalHeight;

    // Scale down if too large
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { 
      width: Math.round(width), 
      height: Math.round(height) 
    };
  }

  /**
   * Get optimized image URL based on network conditions
   */
  getOptimizedImageUrl(originalUrl) {
    const params = new URLSearchParams();
    
    // Adjust quality based on network speed
    switch (this.networkSpeed) {
      case 'slow':
        params.set('quality', '60');
        params.set('width', '600');
        break;
      case 'medium':
        params.set('quality', '75');
        params.set('width', '800');
        break;
      case 'fast':
      default:
        params.set('quality', '85');
        params.set('width', '1200');
        break;
    }

    // Add WebP support check
    if (this.supportsWebP()) {
      params.set('format', 'webp');
    }

    return `${originalUrl}?${params.toString()}`;
  }

  /**
   * Check if browser supports WebP
   */
  supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  /**
   * Check if file is an image
   */
  isImage(file) {
    return file && file.type && file.type.startsWith('image/');
  }

  /**
   * Initialize offline mode capabilities
   */
  async initializeOfflineCapabilities() {
    if (!this.settings.offlineMode) return;

    // Set up service worker for offline caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('Service worker registration failed:', error);
      });
    }

    // Set up offline data storage
    this.setupOfflineStorage();
  }

  /**
   * Set up offline data storage
   */
  setupOfflineStorage() {
    // This would integrate with IndexedDB for offline message storage
    console.log('Offline storage initialized');
  }

  /**
   * Initialize adaptive UI for mobile
   */
  initializeAdaptiveUI() {
    if (!this.settings.adaptiveUI) return;

    // Adjust UI based on screen size and orientation
    this.adjustUIForOrientation();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.adjustUIForOrientation(), 100);
    });

    // Listen for resize events
    window.addEventListener('resize', this.debounce(() => {
      this.adjustUIForScreenSize();
    }, 250));
  }

  /**
   * Adjust UI for device orientation
   */
  adjustUIForOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    document.body.classList.toggle('landscape', isLandscape);
    document.body.classList.toggle('portrait', !isLandscape);
  }

  /**
   * Setup viewport for mobile optimization
   */
  setupViewport() {
    // Prevent zoom on input focus
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
      );
    }
  }

  /**
   * Setup touch optimizations
   */
  setupTouchOptimizations() {
    // Improve touch targets
    document.body.classList.add('touch-optimized');
    
    // Add touch feedback
    document.addEventListener('touchstart', (event) => {
      const target = event.target.closest('button, .clickable, [role="button"]');
      if (target) {
        target.classList.add('touch-active');
      }
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
      const target = event.target.closest('button, .clickable, [role="button"]');
      if (target) {
        setTimeout(() => target.classList.remove('touch-active'), 150);
      }
    }, { passive: true });
  }

  /**
   * Trigger haptic feedback if supported
   */
  triggerHapticFeedback(intensity = 'light') {
    if (!this.settings.hapticFeedback || !navigator.vibrate) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };

    navigator.vibrate(patterns[intensity] || patterns.light);
  }

  /**
   * Show notification optimized for mobile
   */
  showNotification(message, type = 'info') {
    // Create mobile-optimized notification
    const notification = document.createElement('div');
    notification.className = `mobile-notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after delay
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Utility function for debouncing
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Additional mobile-specific methods would be implemented here...
  
  // Placeholder methods for gesture handlers
  showMessageActions(element) { console.log('Show message actions for:', element); }
  replyToMessage(element) { console.log('Reply to message:', element); }
  showChatActions(element) { console.log('Show chat actions for:', element); }
  markChatAsRead(element) { console.log('Mark chat as read:', element); }
  showSwipeIndicator(element, distance) { console.log('Show swipe indicator:', element, distance); }
  hideSwipeIndicators() { console.log('Hide swipe indicators'); }
  showPullToRefreshIndicator(progress) { console.log('Show pull to refresh:', progress); }
  hidePullToRefreshIndicator() { console.log('Hide pull to refresh'); }
  triggerRefresh() { console.log('Trigger refresh'); }
  syncOfflineData() { console.log('Sync offline data'); }
  adjustImageLoadingStrategy() { console.log('Adjust image loading strategy'); }
  adjustMessageLoading() { console.log('Adjust message loading'); }
  adjustUIForScreenSize() { console.log('Adjust UI for screen size'); }
}

// Create singleton instance
const mobileExperienceManager = new MobileExperienceManager();

export default mobileExperienceManager;
