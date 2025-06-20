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
   * Setup offline capabilities
   */
  setupOfflineCapabilities() {
    // Cache important resources
    this.cacheEssentialResources();
    
    // Setup offline message queue
    this.setupOfflineMessageQueue();
    
    // Setup offline UI
    this.setupOfflineUI();
  }

  /**
   * Handle resize events
   */
  handleResize() {
    // Re-detect device type on resize
    this.detectDevice();
    
    // Adjust UI for new size
    this.adjustUIForSize();
    
    // Dispatch resize event
    document.dispatchEvent(new CustomEvent('quickchat:mobile:resize', {
      detail: { 
        width: window.innerWidth, 
        height: window.innerHeight 
      }
    }));
  }

  /**
   * Handle orientation change
   */
  handleOrientationChange() {
    // Add orientation class
    const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    document.body.classList.remove('portrait', 'landscape');
    document.body.classList.add(orientation);
    
    // Adjust UI for orientation
    setTimeout(() => {
      this.adjustUIForOrientation(orientation);
    }, 100); // Small delay to ensure new dimensions are available
  }

  /**
   * Adjust UI for orientation
   */
  adjustUIForOrientation(orientation) {
    if (orientation === 'landscape' && this.isMobile) {
      // Hide bottom navigation in landscape mode to save space
      const bottomNav = document.querySelector('.bottom-navigation');
      if (bottomNav) {
        bottomNav.style.display = 'none';
      }
      
      // Adjust chat input position
      const chatInput = document.querySelector('.message-input-container');
      if (chatInput) {
        chatInput.classList.add('landscape-mode');
      }
    } else {
      // Show bottom navigation in portrait mode
      const bottomNav = document.querySelector('.bottom-navigation');
      if (bottomNav) {
        bottomNav.style.display = 'flex';
      }
      
      // Remove landscape adjustments
      const chatInput = document.querySelector('.message-input-container');
      if (chatInput) {
        chatInput.classList.remove('landscape-mode');
      }
    }
  }

  /**
   * Public methods
   */
  isMobileDevice() {
    return this.isMobile;
  }

  isTabletDevice() {
    return this.isTablet;
  }

  getNetworkStatus() {
    return this.networkStatus;
  }

  // Placeholder methods for features to be implemented
  replyToMessage(messageId) {
    console.log('Reply to message:', messageId);
  }

  showReactionPicker(messageId) {
    console.log('Show reaction picker for message:', messageId);
  }

  shareMessage(messageId) {
    console.log('Share message:', messageId);
  }

  setupCollapsibleSections() {
    // Implementation for collapsible UI sections
  }

  optimizeScrolling() {
    // Implementation for smooth scrolling optimizations
  }

  setupMobileBreadcrumbs() {
    // Implementation for mobile breadcrumb navigation
  }

  setupSidebarSwipe() {
    // Implementation for sidebar swipe gestures
  }

  setupTabSwipe() {
    // Implementation for tab swipe navigation
  }

  adjustUIForSize() {
    // Implementation for dynamic UI adjustments
  }

  cacheEssentialResources() {
    // Implementation for offline resource caching
  }

  setupOfflineMessageQueue() {
    // Implementation for offline message queueing
  }

  setupOfflineUI() {
    // Implementation for offline UI indicators
  }

  updateUIForConnection(connection) {
    // Implementation for connection-aware UI updates
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
