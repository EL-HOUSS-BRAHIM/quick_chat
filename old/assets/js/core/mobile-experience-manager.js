/**
 * Mobile Experience Manager
 * Handles mobile-specific UI enhancements and touch interactions
 * Part of Phase 2: Mobile Experience Improvements
 */

class MobileExperienceManager {
  constructor() {
    this.isMobile = false;
    this.isTablet = false;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.initialized = false;
    this.swipeThreshold = 50;
    this.tapThreshold = 10;
    this.doubleTapDelay = 300;
    this.lastTap = 0;
    this.networkStatus = 'online';
    
    // Image optimization features (NEW - from TODO)
    this.imageOptimization = {
      maxWidth: 800,
      maxHeight: 600,
      quality: 0.8,
      lazyLoading: true
    };
    this.imageObserver = null;
    
    // Offline capabilities (NEW - from TODO)
    this.offlineDB = null;
    this.syncQueue = [];
    this.dataMode = 'normal'; // 'normal', 'lite', 'offline'
    this.connectionSpeed = 'unknown';
    
    // Bind methods
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleOrientationChange = this.handleOrientationChange.bind(this);
    this.handleNetworkChange = this.handleNetworkChange.bind(this);
  }

  /**
   * Initialize mobile experience enhancements
   */
  init() {
    if (this.initialized) return;
    
    console.log('Initializing Mobile Experience Manager');
    
    // Detect device type
    this.detectDevice();
    
    if (this.isMobile || this.isTablet) {
      // Setup mobile-specific features
      this.setupTouchInteractions();
      this.setupResponsiveUI();
      this.setupMobileNavigation();
      this.setupSwipeGestures();
      this.setupTouchFriendlyElements();
      this.setupMobileOptimizations();
      this.setupNetworkMonitoring();
      this.setupOfflineCapabilities();
      this.setupImageOptimization();
      
      // Add mobile CSS class
      document.body.classList.add('mobile-device');
      if (this.isTablet) {
        document.body.classList.add('tablet-device');
      }
    }
    
    // Setup resize and orientation handlers
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleOrientationChange);
    
    this.initialized = true;
    
    // Dispatch initialization event
    document.dispatchEvent(new CustomEvent('quickchat:mobile:initialized', {
      detail: { 
        isMobile: this.isMobile, 
        isTablet: this.isTablet 
      }
    }));
  }

  /**
   * Detect if device is mobile or tablet
   */
  detectDevice() {
    // Check screen size
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const minDimension = Math.min(screenWidth, screenHeight);
    const maxDimension = Math.max(screenWidth, screenHeight);
    
    // Check user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['mobile', 'android', 'iphone', 'ipod', 'blackberry', 'windows phone'];
    const tabletKeywords = ['tablet', 'ipad', 'android'];
    
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    const isTabletUA = tabletKeywords.some(keyword => userAgent.includes(keyword));
    
    // Determine device type based on multiple factors
    this.isMobile = (minDimension <= 768) || isMobileUA;
    this.isTablet = (minDimension > 768 && minDimension <= 1024) || isTabletUA;
    
    // Check for touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Refine detection
    if (hasTouch && minDimension <= 480) {
      this.isMobile = true;
      this.isTablet = false;
    } else if (hasTouch && minDimension <= 1024) {
      this.isTablet = true;
    }
    
    console.log(`Device detection: Mobile: ${this.isMobile}, Tablet: ${this.isTablet}`);
  }

  /**
   * Setup touch interactions
   */
  setupTouchInteractions() {
    document.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    
    // Prevent zoom on double tap for chat messages
    document.addEventListener('touchend', this.preventZoom, { passive: false });
  }

  /**
   * Handle touch start
   */
  handleTouchStart(event) {
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    
    // Add touch active state
    const target = event.target.closest('button, .clickable, .message');
    if (target) {
      target.classList.add('touch-active');
    }
  }

  /**
   * Handle touch move
   */
  handleTouchMove(event) {
    // Remove active state if user moves finger significantly
    const touch = event.touches[0];
    const moveX = Math.abs(touch.clientX - this.touchStartX);
    const moveY = Math.abs(touch.clientY - this.touchStartY);
    
    if (moveX > this.tapThreshold || moveY > this.tapThreshold) {
      const activeElements = document.querySelectorAll('.touch-active');
      activeElements.forEach(el => el.classList.remove('touch-active'));
    }
  }

  /**
   * Handle touch end
   */
  handleTouchEnd(event) {
    const touch = event.changedTouches[0];
    this.touchEndX = touch.clientX;
    this.touchEndY = touch.clientY;
    
    // Remove active state
    const activeElements = document.querySelectorAll('.touch-active');
    activeElements.forEach(el => el.classList.remove('touch-active'));
    
    // Detect gestures
    this.detectSwipe();
    this.detectDoubleTap(event);
  }

  /**
   * Setup swipe gestures
   */
  setupSwipeGestures() {
    // Chat message swipe actions
    const chatContainer = document.querySelector('.chat-messages');
    if (chatContainer) {
      this.setupMessageSwipeActions(chatContainer);
    }
    
    // Sidebar swipe to open/close
    this.setupSidebarSwipe();
    
    // Tab swipe navigation
    this.setupTabSwipe();
  }

  /**
   * Setup message swipe actions
   */
  setupMessageSwipeActions(container) {
    container.addEventListener('touchstart', (e) => {
      const message = e.target.closest('.message');
      if (message) {
        message.dataset.touchStartX = e.touches[0].clientX;
      }
    });
    
    container.addEventListener('touchmove', (e) => {
      const message = e.target.closest('.message');
      if (message && message.dataset.touchStartX) {
        const currentX = e.touches[0].clientX;
        const startX = parseFloat(message.dataset.touchStartX);
        const deltaX = currentX - startX;
        
        // Show swipe actions if swiped enough
        if (Math.abs(deltaX) > 50) {
          this.showMessageSwipeActions(message, deltaX > 0 ? 'right' : 'left');
        }
      }
    });
    
    container.addEventListener('touchend', (e) => {
      const message = e.target.closest('.message');
      if (message) {
        delete message.dataset.touchStartX;
        // Hide swipe actions after a delay
        setTimeout(() => this.hideMessageSwipeActions(message), 2000);
      }
    });
  }

  /**
   * Show message swipe actions
   */
  showMessageSwipeActions(message, direction) {
    // Remove existing action buttons
    const existing = message.querySelector('.swipe-actions');
    if (existing) existing.remove();
    
    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'swipe-actions';
    actions.innerHTML = `
      <button class="swipe-action-btn reply-btn" data-action="reply">
        <i class="icon-reply"></i> Reply
      </button>
      <button class="swipe-action-btn react-btn" data-action="react">
        <i class="icon-heart"></i> React
      </button>
      <button class="swipe-action-btn share-btn" data-action="share">
        <i class="icon-share"></i> Share
      </button>
    `;
    
    message.appendChild(actions);
    
    // Add event listeners
    actions.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        this.handleMessageAction(message, action.dataset.action);
      }
    });
  }

  /**
   * Hide message swipe actions
   */
  hideMessageSwipeActions(message) {
    const actions = message.querySelector('.swipe-actions');
    if (actions) {
      actions.classList.add('fade-out');
      setTimeout(() => actions.remove(), 300);
    }
  }

  /**
   * Handle message actions
   */
  handleMessageAction(message, action) {
    const messageId = message.dataset.messageId;
    
    switch (action) {
    case 'reply':
      this.replyToMessage(messageId);
      break;
    case 'react':
      this.showReactionPicker(messageId);
      break;
    case 'share':
      this.shareMessage(messageId);
      break;
    }
    
    this.hideMessageSwipeActions(message);
  }

  /**
   * Setup responsive UI adjustments
   */
  setupResponsiveUI() {
    // Adjust font sizes for mobile
    if (this.isMobile) {
      document.documentElement.style.setProperty('--base-font-size', '16px');
      document.documentElement.style.setProperty('--small-font-size', '14px');
    }
    
    // Adjust touch targets
    this.enlargeTouchTargets();
    
    // Setup collapsible sections
    this.setupCollapsibleSections();
    
    // Optimize scrolling
    this.optimizeScrolling();
  }

  /**
   * Enlarge touch targets for better accessibility
   */
  enlargeTouchTargets() {
    const smallButtons = document.querySelectorAll('button, .btn, .clickable');
    smallButtons.forEach(button => {
      const rect = button.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        button.classList.add('touch-target-enlarged');
      }
    });
  }

  /**
   * Setup mobile navigation
   */
  setupMobileNavigation() {
    // Create mobile navigation toggle
    this.createMobileNavToggle();
    
    // Setup bottom navigation for mobile
    this.setupBottomNavigation();
    
    // Setup breadcrumb navigation
    this.setupMobileBreadcrumbs();
  }

  /**
   * Create mobile navigation toggle
   */
  createMobileNavToggle() {
    const existingToggle = document.querySelector('.mobile-nav-toggle');
    if (existingToggle) return;
    
    const toggle = document.createElement('button');
    toggle.className = 'mobile-nav-toggle';
    toggle.innerHTML = `
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    `;
    toggle.setAttribute('aria-label', 'Toggle navigation');
    
    // Insert at beginning of header
    const header = document.querySelector('header, .header');
    if (header) {
      header.insertBefore(toggle, header.firstChild);
    }
    
    // Add event listener
    toggle.addEventListener('click', () => {
      this.toggleMobileNavigation();
    });
  }

  /**
   * Toggle mobile navigation
   */
  toggleMobileNavigation() {
    const nav = document.querySelector('nav, .navigation');
    const toggle = document.querySelector('.mobile-nav-toggle');
    
    if (nav && toggle) {
      const isOpen = nav.classList.contains('mobile-nav-open');
      nav.classList.toggle('mobile-nav-open', !isOpen);
      toggle.classList.toggle('active', !isOpen);
      toggle.setAttribute('aria-expanded', !isOpen);
      
      // Prevent body scroll when nav is open
      document.body.classList.toggle('nav-open', !isOpen);
    }
  }

  /**
   * Setup bottom navigation for mobile
   */
  setupBottomNavigation() {
    if (!this.isMobile) return;
    
    const existingBottomNav = document.querySelector('.bottom-navigation');
    if (existingBottomNav) return;
    
    const bottomNav = document.createElement('nav');
    bottomNav.className = 'bottom-navigation';
    bottomNav.innerHTML = `
      <a href="/dashboard" class="bottom-nav-item">
        <i class="icon-dashboard"></i>
        <span>Dashboard</span>
      </a>
      <a href="/chat" class="bottom-nav-item active">
        <i class="icon-chat"></i>
        <span>Chat</span>
      </a>
      <a href="/profile" class="bottom-nav-item">
        <i class="icon-user"></i>
        <span>Profile</span>
      </a>
    `;
    
    document.body.appendChild(bottomNav);
    
    // Add padding to main content to account for bottom nav
    const main = document.querySelector('main, .main-content');
    if (main) {
      main.style.paddingBottom = '80px';
    }
  }

  /**
   * Detect swipe gesture
   */
  detectSwipe() {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    
    if (Math.abs(deltaX) > this.swipeThreshold || Math.abs(deltaY) > this.swipeThreshold) {
      let direction;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }
      
      // Dispatch swipe event
      document.dispatchEvent(new CustomEvent('quickchat:swipe', {
        detail: { direction, deltaX, deltaY }
      }));
    }
  }

  /**
   * Detect double tap
   */
  detectDoubleTap(event) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - this.lastTap;
    
    if (tapLength < this.doubleTapDelay && tapLength > 0) {
      // Double tap detected
      document.dispatchEvent(new CustomEvent('quickchat:doubletap', {
        detail: { target: event.target }
      }));
      
      // Prevent zoom
      event.preventDefault();
    }
    
    this.lastTap = currentTime;
  }

  /**
   * Prevent zoom on double tap
   */
  preventZoom(event) {
    const target = event.target;
    if (target.closest('.chat-messages, .message')) {
      event.preventDefault();
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', this.handleNetworkChange);
    window.addEventListener('offline', this.handleNetworkChange);
    
    // Monitor connection speed (if supported)
    if ('connection' in navigator) {
      const connection = navigator.connection;
      connection.addEventListener('change', this.handleNetworkChange);
      this.updateUIForConnection(connection);
    }
  }

  /**
   * Handle network status changes
   */
  handleNetworkChange() {
    const isOnline = navigator.onLine;
    this.networkStatus = isOnline ? 'online' : 'offline';
    
    // Update UI
    document.body.classList.toggle('offline', !isOnline);
    
    // Show network status indicator
    this.showNetworkStatus(isOnline);
    
    // Dispatch network event
    document.dispatchEvent(new CustomEvent('quickchat:network:changed', {
      detail: { online: isOnline }
    }));
  }

  /**
   * Show network status indicator
   */
  showNetworkStatus(isOnline) {
    let indicator = document.querySelector('.network-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'network-indicator';
      document.body.appendChild(indicator);
    }
    
    indicator.textContent = isOnline ? 'Back online' : 'No internet connection';
    indicator.className = `network-indicator ${isOnline ? 'online' : 'offline'} show`;
    
    // Auto hide after 3 seconds if online
    if (isOnline) {
      setTimeout(() => {
        indicator.classList.remove('show');
      }, 3000);
    }
  }

  /**
   * Setup image optimization for mobile networks
   * Addresses TODO: Optimize image loading for mobile networks
   */
  setupImageOptimization() {
    // Setup Intersection Observer for lazy loading
    if ('IntersectionObserver' in window && this.imageOptimization.lazyLoading) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadOptimizedImage(entry.target);
            this.imageObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: '50px'
      });
      
      // Process existing images
      this.processExistingImages();
    }
  }

  /**
   * Process all existing images on the page
   */
  processExistingImages() {
    const images = document.querySelectorAll('img[data-src], img:not([data-optimized])');
    images.forEach(img => this.optimizeImageForMobile(img));
  }

  /**
   * Optimize individual image for mobile viewing
   */
  optimizeImageForMobile(img) {
    if (img.dataset.optimized) return;
    
    // Mark as processed
    img.dataset.optimized = 'true';
    
    // Determine optimal image size based on network and device
    const optimalSrc = this.getOptimalImageSrc(img);
    
    if (this.imageObserver && optimalSrc !== img.src) {
      img.dataset.originalSrc = img.src || img.dataset.src;
      img.dataset.optimizedSrc = optimalSrc;
      
      // Use lazy loading
      this.imageObserver.observe(img);
    }
  }

  /**
   * Get optimal image source based on network conditions
   */
  getOptimalImageSrc(img) {
    const originalSrc = img.src || img.dataset.src;
    if (!originalSrc) return '';
    
    let maxWidth = this.imageOptimization.maxWidth;
    let quality = this.imageOptimization.quality;
    
    // Adjust based on data mode
    if (this.dataMode === 'lite') {
      maxWidth = Math.min(maxWidth / 2, 400);
      quality = 0.6;
    } else if (this.dataMode === 'offline') {
      // Return cached version if available
      return this.getCachedImageSrc(originalSrc) || originalSrc;
    }
    
    // For mobile, limit based on screen width
    if (this.isMobile) {
      const screenWidth = window.innerWidth * (window.devicePixelRatio || 1);
      maxWidth = Math.min(screenWidth, maxWidth);
    }
    
    return this.generateOptimizedImageUrl(originalSrc, {
      width: maxWidth,
      height: this.imageOptimization.maxHeight,
      quality: quality
    });
  }

  /**
   * Generate optimized image URL with parameters
   */
  generateOptimizedImageUrl(src, options) {
    // This would integrate with an image optimization service
    const params = new URLSearchParams();
    params.append('w', options.width);
    params.append('h', options.height);
    params.append('q', Math.round(options.quality * 100));
    
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}${params.toString()}`;
  }

  /**
   * Load optimized image with fallback
   */
  loadOptimizedImage(img) {
    const optimizedSrc = img.dataset.optimizedSrc;
    if (!optimizedSrc) return;
    
    const newImg = new Image();
    newImg.onload = () => {
      img.src = optimizedSrc;
      img.classList.add('loaded');
    };
    newImg.onerror = () => {
      // Fallback to original
      const originalSrc = img.dataset.originalSrc;
      if (originalSrc) {
        img.src = originalSrc;
      }
    };
    newImg.src = optimizedSrc;
  }

  /**
   * Setup offline capabilities for mobile users
   * Addresses TODO: Improve offline capabilities for mobile users
   */
  setupOfflineCapabilities() {
    // Initialize IndexedDB for offline storage
    this.initOfflineStorage();
    
    // Setup sync queue
    this.initSyncQueue();
    
    // Monitor network status
    this.monitorNetworkStatus();
    
    // Setup offline UI indicators
    this.setupOfflineUI();
  }

  /**
   * Initialize offline storage using IndexedDB
   */
  initOfflineStorage() {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported for offline storage');
      return;
    }
    
    const request = indexedDB.open('QuickChatMobileOffline', 1);
    
    request.onerror = () => {
      console.error('Failed to open offline database');
    };
    
    request.onsuccess = (event) => {
      this.offlineDB = event.target.result;
      console.log('Mobile offline database ready');
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores for offline data
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('timestamp', 'timestamp');
        messageStore.createIndex('chatId', 'chatId');
      }
      
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'chatId' });
      }
      
      if (!db.objectStoreNames.contains('images')) {
        const imageStore = db.createObjectStore('images', { keyPath: 'url' });
        imageStore.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp');
      }
    };
  }

  /**
   * Initialize sync queue for offline actions
   */
  initSyncQueue() {
    // Process queue when coming back online
    window.addEventListener('online', () => {
      if (this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    });
  }

  /**
   * Add action to sync queue
   */
  addToSyncQueue(action) {
    this.syncQueue.push({
      id: Date.now(),
      action: action,
      timestamp: new Date(),
      retries: 0
    });
    
    // Also store in IndexedDB if available
    if (this.offlineDB) {
      const transaction = this.offlineDB.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      store.add({
        action: action,
        timestamp: Date.now(),
        retries: 0
      });
    }
  }

  /**
   * Process sync queue when back online
   */
  async processSyncQueue() {
    console.log('Processing sync queue...');
    
    for (let i = this.syncQueue.length - 1; i >= 0; i--) {
      const item = this.syncQueue[i];
      
      try {
        await this.processQueuedAction(item.action);
        this.syncQueue.splice(i, 1); // Remove on success
      } catch (error) {
        console.warn('Failed to sync action:', error);
        item.retries++;
        
        // Remove after 3 failed attempts
        if (item.retries >= 3) {
          this.syncQueue.splice(i, 1);
        }
      }
    }
  }

  /**
   * Process individual queued action
   */
  async processQueuedAction(action) {
    switch (action.type) {
    case 'send_message':
      // Send queued message
      return await this.sendQueuedMessage(action.data);
    case 'upload_image':
      // Upload queued image
      return await this.uploadQueuedImage(action.data);
    case 'update_status':
      // Update queued status
      return await this.updateQueuedStatus(action.data);
    default:
      console.warn('Unknown action type:', action.type);
    }
  }

  /**
   * Monitor network status and adjust data mode
   */
  monitorNetworkStatus() {
    // Network Information API
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      this.updateDataMode(connection);
      
      connection.addEventListener('change', () => {
        this.updateDataMode(connection);
      });
    }
    
    // Basic online/offline detection
    window.addEventListener('online', () => {
      this.networkStatus = 'online';
      this.updateDataMode();
      this.showNetworkStatus('back online');
    });
    
    window.addEventListener('offline', () => {
      this.networkStatus = 'offline';
      this.dataMode = 'offline';
      this.showNetworkStatus('offline');
    });
  }

  /**
   * Update data mode based on network conditions
   */
  updateDataMode(connection = null) {
    if (this.networkStatus === 'offline') {
      this.dataMode = 'offline';
    } else if (connection) {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink;
      
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        this.dataMode = 'lite';
      } else if (effectiveType === '3g' && downlink < 1.5) {
        this.dataMode = 'lite';
      } else {
        this.dataMode = 'normal';
      }
      
      this.connectionSpeed = downlink;
    }
    
    // Apply data mode optimizations
    this.applyDataModeOptimizations();
  }

  /**
   * Apply optimizations based on data mode
   */
  applyDataModeOptimizations() {
    const body = document.body;
    
    // Remove existing classes
    body.classList.remove('data-normal', 'data-lite', 'data-offline');
    
    // Add current mode class
    body.classList.add(`data-${this.dataMode}`);
    
    switch (this.dataMode) {
    case 'lite':
      this.imageOptimization.quality = 0.6;
      this.enableDataSavingMode();
      break;
    case 'offline':
      this.enableOfflineMode();
      break;
    default:
      this.imageOptimization.quality = 0.8;
      this.disableDataSavingMode();
    }
  }

  /**
   * Enable data saving mode
   */
  enableDataSavingMode() {
    // Reduce image quality and size
    this.processExistingImages();
    
    // Disable auto-loading of media
    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach(el => {
      el.preload = 'none';
    });
  }

  /**
   * Disable data saving mode
   */
  disableDataSavingMode() {
    // Restore normal image quality
    this.processExistingImages();
  }

  /**
   * Enable offline mode features
   */
  enableOfflineMode() {
    // Show offline indicator
    this.showOfflineIndicator();
    
    // Enable draft auto-save
    this.enableDraftAutoSave();
  }

  /**
   * Show network status notification
   */
  showNetworkStatus(status) {
    // Create or update status indicator
    let indicator = document.querySelector('.network-status-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'network-status-indicator';
      document.body.appendChild(indicator);
    }
    
    indicator.textContent = `You are ${status}`;
    indicator.classList.add('visible');
    
    // Auto-hide after 3 seconds for online status
    if (status === 'back online') {
      setTimeout(() => {
        indicator.classList.remove('visible');
      }, 3000);
    }
  }

  /**
   * Show offline indicator
   */
  showOfflineIndicator() {
    let indicator = document.querySelector('.offline-mode-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'offline-mode-indicator';
      indicator.innerHTML = '<span>📱 Offline Mode</span>';
      document.body.appendChild(indicator);
    }
    indicator.classList.add('visible');
  }

  /**
   * Enable draft auto-save for offline use
   */
  enableDraftAutoSave() {
    const messageInputs = document.querySelectorAll('input[type="text"], textarea');
    
    messageInputs.forEach(input => {
      const chatId = input.dataset.chatId || 'default';
      
      // Load saved draft
      this.loadDraft(chatId).then(draft => {
        if (draft && !input.value) {
          input.value = draft.content;
        }
      });
      
      // Auto-save draft
      input.addEventListener('input', () => {
        this.saveDraft(chatId, input.value);
      });
    });
  }

  /**
   * Save draft to offline storage
   */
  async saveDraft(chatId, content) {
    if (!this.offlineDB || !content.trim()) return;
    
    const transaction = this.offlineDB.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');
    
    store.put({
      chatId: chatId,
      content: content,
      timestamp: Date.now()
    });
  }

  /**
   * Load draft from offline storage
   */
  async loadDraft(chatId) {
    if (!this.offlineDB) return null;
    
    return new Promise((resolve) => {
      const transaction = this.offlineDB.transaction(['drafts'], 'readonly');
      const store = transaction.objectStore('drafts');
      const request = store.get(chatId);
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Get cached image source
   */
  getCachedImageSrc(url) {
    // This would check if image is cached in IndexedDB
    // Return cached version if available
    return null; // Placeholder
  }

  /**
   * Cleanup method
   */
  destroy() {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    window.removeEventListener('online', this.handleNetworkChange);
    window.removeEventListener('offline', this.handleNetworkChange);
    
    this.initialized = false;
  }
}

export default new MobileExperienceManager();
