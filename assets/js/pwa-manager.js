/**
 * Progressive Web App (PWA) Manager
 * Handles service worker registration, offline functionality, and app installation
 */
import { Workbox } from 'workbox-window';

class PWAManager {
    constructor() {
        this.workbox = null;
        this.isOnline = navigator.onLine;
        this.installPrompt = null;
        this.offlineQueue = [];
        this.cacheVersion = 'v3.0.0';
        
        this.init();
    }

    async init() {
        this.setupServiceWorker();
        this.setupInstallPrompt();
        this.setupOfflineHandling();
        this.setupNetworkStatusMonitoring();
        this.setupBackgroundSync();
    }

    async setupServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return;
        }

        try {
            // Use workbox-window for better service worker management
            this.workbox = new Workbox('/sw.js', { scope: '/' });
            
            // Listen for new updates
            this.workbox.addEventListener('waiting', (event) => {
                console.log('A new service worker has installed, but it cannot activate until all tabs running the current version have been closed.');
                this.showUpdateAvailable();
            });
            
            // Listen for service worker controlling the page
            this.workbox.addEventListener('controlling', (event) => {
                console.log('A new service worker has taken control of the page.');
                window.location.reload();
            });
            
            // Listen for service worker activation
            this.workbox.addEventListener('activated', (event) => {
                console.log('Service worker activated successfully');
                
                // If there were offline resources to cache, claim clients and cache them
                if (event.isUpdate) {
                    console.log('Service worker updated');
                } else {
                    this.cacheEssentialResources();
                }
            });
            
            // Listen for service worker installation errors
            this.workbox.addEventListener('redundant', (event) => {
                console.error('Service worker installation failed');
            });
            
            // Register the service worker
            const registration = await this.workbox.register();
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });

            console.log('Service Worker registered successfully');
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    handleServiceWorkerMessage(message) {
        switch (message.type) {
            case 'CACHE_UPDATED':
                console.log('Cache updated:', message.payload);
                break;
            case 'BACKGROUND_SYNC':
                this.handleBackgroundSync(message.payload);
                break;
            case 'PUSH_NOTIFICATION':
                this.handlePushNotification(message.payload);
                break;
        }
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            this.showInstallOption();
        });

        // Listen for app installation
        window.addEventListener('appinstalled', () => {
            this.installPrompt = null;
            this.hideInstallOption();
            this.showToast('App installed successfully!', 'success');
        });
    }

    showInstallOption() {
        let installBanner = document.getElementById('installBanner');
        
        if (!installBanner) {
            installBanner = document.createElement('div');
            installBanner.id = 'installBanner';
            installBanner.className = 'install-banner';
            installBanner.innerHTML = `
                <div class="install-banner-content">
                    <div class="install-banner-text">
                        <h3>Install Quick Chat</h3>
                        <p>Get the full app experience with offline access</p>
                    </div>
                    <div class="install-banner-actions">
                        <button type="button" class="btn btn-primary install-app-btn">Install</button>
                        <button type="button" class="btn btn-secondary dismiss-install-btn">Dismiss</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(installBanner);
        }

        // Show banner
        installBanner.style.display = 'block';

        // Setup event listeners
        installBanner.querySelector('.install-app-btn').addEventListener('click', () => {
            this.installApp();
        });

        installBanner.querySelector('.dismiss-install-btn').addEventListener('click', () => {
            this.hideInstallOption();
        });
    }

    hideInstallOption() {
        const installBanner = document.getElementById('installBanner');
        if (installBanner) {
            installBanner.style.display = 'none';
        }
    }

    async installApp() {
        if (!this.installPrompt) return;

        try {
            const result = await this.installPrompt.prompt();
            console.log('Install prompt result:', result);
            
            if (result.outcome === 'accepted') {
                this.hideInstallOption();
            }
        } catch (error) {
            console.error('Install prompt failed:', error);
        }
    }

    setupOfflineHandling() {
        // Cache critical resources
        this.cacheEssentialResources();

        // Setup offline page
        this.setupOfflinePage();
    }

    async cacheEssentialResources() {
        if (!('caches' in window)) return;

        try {
            const cache = await caches.open(this.cacheVersion);
            
            const essentialResources = [
                '/',
                '/assets/css/styles.css',
                '/assets/js/app.js',
                '/assets/js/chat.js',
                '/offline.html',
                '/manifest.json'
            ];

            await cache.addAll(essentialResources);
            console.log('Essential resources cached');
        } catch (error) {
            console.error('Failed to cache essential resources:', error);
        }
    }

    setupOfflinePage() {
        // Create offline page if it doesn't exist
        if (!document.getElementById('offlinePage')) {
            const offlinePage = document.createElement('div');
            offlinePage.id = 'offlinePage';
            offlinePage.className = 'offline-page hidden';
            offlinePage.innerHTML = `
                <div class="offline-content">
                    <div class="offline-icon">📡</div>
                    <h2>You're Offline</h2>
                    <p>Check your internet connection and try again.</p>
                    <p>Your messages will be sent when you're back online.</p>
                    <button type="button" class="btn btn-primary retry-connection-btn">Retry Connection</button>
                </div>
            `;
            
            document.body.appendChild(offlinePage);

            // Setup retry button
            offlinePage.querySelector('.retry-connection-btn').addEventListener('click', () => {
                this.checkConnection();
            });
        }
    }

    setupNetworkStatusMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.handleOffline();
        });

        // Periodic connection check
        setInterval(() => {
            this.checkConnection();
        }, 30000); // Check every 30 seconds
    }

    handleOnline() {
        console.log('Connection restored');
        this.hideOfflinePage();
        this.showToast('Connection restored', 'success');
        this.processOfflineQueue();
        this.syncOfflineData();
    }

    handleOffline() {
        console.log('Connection lost');
        this.showOfflinePage();
        this.showToast('You are now offline', 'warning');
    }

    showOfflinePage() {
        const offlinePage = document.getElementById('offlinePage');
        if (offlinePage) {
            offlinePage.classList.remove('hidden');
        }
    }

    hideOfflinePage() {
        const offlinePage = document.getElementById('offlinePage');
        if (offlinePage) {
            offlinePage.classList.add('hidden');
        }
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/ping.php', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                if (!this.isOnline) {
                    this.isOnline = true;
                    this.handleOnline();
                }
            } else {
                throw new Error('Server not responding');
            }
        } catch (error) {
            if (this.isOnline) {
                this.isOnline = false;
                this.handleOffline();
            }
        }
    }

    setupBackgroundSync() {
        if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
            console.warn('Background Sync not supported');
            return;
        }

        // Register background sync for message sending
        navigator.serviceWorker.ready.then((registration) => {
            return registration.sync.register('send-messages');
        }).catch((error) => {
            console.error('Background sync registration failed:', error);
        });
    }

    handleBackgroundSync(data) {
        console.log('Background sync triggered:', data);
        
        switch (data.tag) {
            case 'send-messages':
                this.processOfflineQueue();
                break;
            case 'upload-files':
                this.processOfflineUploads();
                break;
        }
    }

    // Offline queue management
    queueForOffline(request) {
        this.offlineQueue.push({
            id: Date.now() + '_' + Math.random(),
            request: request,
            timestamp: Date.now(),
            retryCount: 0
        });

        this.saveOfflineQueue();
        this.showToast('Message queued for sending', 'info');
    }

    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;

        console.log(`Processing ${this.offlineQueue.length} offline requests`);

        const queue = [...this.offlineQueue];
        this.offlineQueue = [];

        for (const item of queue) {
            try {
                await this.retryRequest(item.request);
                console.log('Offline request processed successfully');
            } catch (error) {
                console.error('Failed to process offline request:', error);
                
                // Re-queue if retry count is low
                if (item.retryCount < 3) {
                    item.retryCount++;
                    this.offlineQueue.push(item);
                }
            }
        }

        this.saveOfflineQueue();

        if (this.offlineQueue.length === 0) {
            this.showToast('All messages sent successfully', 'success');
        }
    }

    async retryRequest(requestData) {
        const { url, method, body, headers } = requestData;
        
        const response = await fetch(url, {
            method: method,
            body: body,
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    }

    saveOfflineQueue() {
        try {
            localStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
        }
    }

    loadOfflineQueue() {
        try {
            const saved = localStorage.getItem('offlineQueue');
            if (saved) {
                this.offlineQueue = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load offline queue:', error);
            this.offlineQueue = [];
        }
    }

    // Push notification handling
    async setupPushNotifications() {
        if (!('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                console.log('Push notification permission denied');
                return false;
            }

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.getVapidKey()
            });

            // Send subscription to server
            await this.sendSubscriptionToServer(subscription);
            
            console.log('Push notifications enabled');
            return true;
        } catch (error) {
            console.error('Failed to setup push notifications:', error);
            return false;
        }
    }

    getVapidKey() {
        // This should be your VAPID public key
        return 'your-vapid-public-key-here';
    }

    async sendSubscriptionToServer(subscription) {
        try {
            await fetch('/api/push-subscription.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify(subscription)
            });
        } catch (error) {
            console.error('Failed to send subscription to server:', error);
        }
    }

    handlePushNotification(payload) {
        console.log('Push notification received:', payload);
        
        // Show notification if app is not in focus
        if (document.hidden) {
            this.showNotification(payload.title, {
                body: payload.body,
                icon: payload.icon || '/assets/images/icon-192.png',
                tag: payload.tag,
                data: payload.data
            });
        }
    }

    showNotification(title, options) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, options);
            
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // Handle notification click based on data
                if (options.data && options.data.url) {
                    window.location.href = options.data.url;
                }
            };
        }
    }

    async syncOfflineData() {
        // Sync any offline data with server
        try {
            const offlineData = this.getOfflineData();
            
            if (offlineData.length > 0) {
                await fetch('/api/sync-offline-data.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCSRFToken()
                    },
                    body: JSON.stringify(offlineData)
                });
                
                this.clearOfflineData();
                console.log('Offline data synced');
            }
        } catch (error) {
            console.error('Failed to sync offline data:', error);
        }
    }

    getOfflineData() {
        try {
            const data = localStorage.getItem('offlineData');
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get offline data:', error);
            return [];
        }
    }

    clearOfflineData() {
        try {
            localStorage.removeItem('offlineData');
        } catch (error) {
            console.error('Failed to clear offline data:', error);
        }
    }

    showUpdateAvailable() {
        const updateBanner = document.createElement('div');
        updateBanner.className = 'update-banner';
        updateBanner.innerHTML = `
            <div class="update-banner-content">
                <span>A new version is available!</span>
                <button type="button" class="btn btn-primary update-app-btn">Update Now</button>
                <button type="button" class="btn btn-secondary dismiss-update-btn">Later</button>
            </div>
        `;
        
        document.body.appendChild(updateBanner);

        updateBanner.querySelector('.update-app-btn').addEventListener('click', () => {
            this.updateApp();
        });

        updateBanner.querySelector('.dismiss-update-btn').addEventListener('click', () => {
            updateBanner.remove();
        });
    }

    async updateApp() {
        try {
            if (this.workbox) {
                // Send message to service worker to skip waiting
                this.workbox.messageSkipWaiting();
            } else {
                const registration = await navigator.serviceWorker.ready;
                await registration.update();
                
                // Force reload to use new version
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to update app:', error);
        }
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

    // Public API
    isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    getAppInfo() {
        return {
            isInstalled: this.isAppInstalled(),
            isOnline: this.isOnline,
            serviceWorkerSupported: 'serviceWorker' in navigator,
            pushNotificationsSupported: 'PushManager' in window,
            offlineQueueLength: this.offlineQueue.length
        };
    }
}

// Initialize PWA manager
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Export for external use
window.PWAManager = PWAManager;
