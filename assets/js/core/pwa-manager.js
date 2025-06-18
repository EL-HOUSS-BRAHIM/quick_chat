/**
 * PWA Manager
 * Handles Progressive Web App functionality
 */

import eventBus from '../event-bus.js';

class PWAManager {
  constructor() {
    this.isInstalled = false;
    this.deferredPrompt = null;
    this.installButton = null;
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      this.isInstalled = true;
    }
    
    // Bind methods
    this.handleBeforeInstallPrompt = this.handleBeforeInstallPrompt.bind(this);
    this.handleAppInstalled = this.handleAppInstalled.bind(this);
    this.showInstallPrompt = this.showInstallPrompt.bind(this);
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize PWA Manager
   */
  init() {
    // Register service worker if supported
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            console.log('ServiceWorker registration successful with scope:', registration.scope);
            this.handleServiceWorkerRegistration(registration);
          })
          .catch(error => {
            console.error('ServiceWorker registration failed:', error);
          });
      });
    }
    
    // Set up install event listeners
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.handleAppInstalled);
    
    // Find install button
    this.installButton = document.getElementById('pwaInstallButton');
    if (this.installButton) {
      this.installButton.addEventListener('click', this.showInstallPrompt);
      
      // Hide button if already installed
      if (this.isInstalled) {
        this.installButton.style.display = 'none';
      } else {
        this.installButton.style.display = 'none'; // Hide by default until prompt is available
      }
    }
    
    // Check for updates periodically
    this.setupUpdateCheck();
  }
  
  /**
   * Handle service worker registration
   * @param {ServiceWorkerRegistration} registration 
   */
  handleServiceWorkerRegistration(registration) {
    // Setup update flow
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          this.showUpdateNotification();
        }
      });
    });
  }
  
  /**
   * Show update notification
   */
  showUpdateNotification() {
    // Publish event for UI components to handle
    eventBus.publish('pwa:update:available', {});
    
    // Create notification if needed
    const updateNotification = document.createElement('div');
    updateNotification.className = 'pwa-update-notification';
    updateNotification.innerHTML = `
      <div class="update-content">
        <p>A new version is available!</p>
        <button class="update-button">Update Now</button>
      </div>
    `;
    
    // Add to DOM if not already exists
    if (!document.querySelector('.pwa-update-notification')) {
      document.body.appendChild(updateNotification);
      
      // Add event listener for update button
      const updateButton = updateNotification.querySelector('.update-button');
      if (updateButton) {
        updateButton.addEventListener('click', () => {
          this.performUpdate();
          updateNotification.remove();
        });
      }
    }
  }
  
  /**
   * Perform app update
   */
  performUpdate() {
    // Skip waiting and reload the page
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Reload once the new service worker takes over
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
        }
      });
    }
  }
  
  /**
   * Setup periodic update check
   */
  setupUpdateCheck() {
    // Check for updates every hour
    const checkInterval = 60 * 60 * 1000; // 1 hour
    
    setInterval(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
          if (registration) {
            registration.update();
          }
        });
      }
    }, checkInterval);
  }
  
  /**
   * Handle beforeinstallprompt event
   * @param {BeforeInstallPromptEvent} event 
   */
  handleBeforeInstallPrompt(event) {
    // Prevent Chrome from automatically showing the prompt
    event.preventDefault();
    
    // Stash the event so it can be triggered later
    this.deferredPrompt = event;
    
    // Show install button if available
    if (this.installButton) {
      this.installButton.style.display = 'block';
    }
    
    // Publish event
    eventBus.publish('pwa:installable', {});
  }
  
  /**
   * Handle app installed event
   */
  handleAppInstalled() {
    // App was installed
    this.isInstalled = true;
    
    // Hide install button
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
    
    // Clear the deferredPrompt
    this.deferredPrompt = null;
    
    // Publish event
    eventBus.publish('pwa:installed', {});
    
    // Analytics
    this.trackAppInstalled();
  }
  
  /**
   * Show install prompt
   */
  async showInstallPrompt() {
    if (!this.deferredPrompt) {
      console.log('Install prompt not available');
      return;
    }
    
    // Show the prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await this.deferredPrompt.userChoice;
    
    // Clear the deferredPrompt
    this.deferredPrompt = null;
    
    // Track outcome
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      eventBus.publish('pwa:install:accepted', {});
    } else {
      console.log('User dismissed the install prompt');
      eventBus.publish('pwa:install:dismissed', {});
    }
  }
  
  /**
   * Track app installed for analytics
   */
  trackAppInstalled() {
    // Send analytics event
    if (typeof gtag === 'function') {
      gtag('event', 'app_installed', {
        'event_category': 'pwa',
        'event_label': 'App Installed'
      });
    }
  }
  
  /**
   * Check if offline
   * @returns {boolean} True if offline
   */
  isOffline() {
    return !navigator.onLine;
  }
  
  /**
   * Setup offline detection
   * @param {Function} onOffline Callback when going offline
   * @param {Function} onOnline Callback when coming back online
   */
  setupOfflineDetection(onOffline, onOnline) {
    window.addEventListener('online', () => {
      eventBus.publish('network:online', {});
      if (onOnline && typeof onOnline === 'function') {
        onOnline();
      }
    });
    
    window.addEventListener('offline', () => {
      eventBus.publish('network:offline', {});
      if (onOffline && typeof onOffline === 'function') {
        onOffline();
      }
    });
  }
}

export default PWAManager;
