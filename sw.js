// Service Worker for offline functionality and caching
const CACHE_NAME = 'quick-chat-v4';
const APP_ASSETS = [
    './',
    './index.php',
    './chat-modern.php',
    './dashboard-modern.php',
    './assets/css/styles.css',
    './assets/css/enhanced-chat.css',
    './assets/css/chat-modern.css',
    './assets/css/dashboard-modern.css',
    './assets/js/config.js',
    './assets/js/utils.js',
    './assets/js/security.js',
    './assets/js/emoji.js',
    './assets/js/chat.js',
    './assets/js/chat-modern.js',
    './assets/js/dashboard-modern.js',
    './assets/js/app.js',
    './assets/js/integration.js',
    './assets/images/default-avatar.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app assets');
                return cache.addAll(APP_ASSETS);
            })
            .then(() => {
                return self.skipWaiting();
            })
    );
});

// Clean up old caches when service worker activates
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming clients');
            return self.clients.claim();
        })
    );
});

// Fetch resources from cache when offline
self.addEventListener('fetch', (event) => {
    // Don't cache or interfere with:
    // 1. API requests
    // 2. Authentication actions
    // 3. Form submissions (POST/PUT/DELETE)
    // 4. Beacon API calls
    if (event.request.url.includes('/api/') || 
        event.request.url.includes('auth') ||
        event.request.url.includes('login') ||
        event.request.url.includes('logout') ||
        event.request.method !== 'GET' ||
        event.request.url.includes('sendBeacon')) {
        return;
    }
    
    // Cache-first strategy for static assets
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached resource if available
                if (response) {
                    // In the background, try to update the cache
                    fetch(event.request).then(freshResponse => {
                        if (freshResponse && freshResponse.ok) {
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, freshResponse.clone());
                            });
                        }
                    }).catch(() => {
                        // Silently fail - we already have a cached response
                    });
                    
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Cache successful responses
                        if (networkResponse && networkResponse.ok) {
                            let responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[Service Worker] Fetch failed:', error);
                        
                        // For HTML requests, show an offline page
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./offline.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Handle push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        
        // Show notification
        const options = {
            body: data.body || 'New message received',
            icon: data.icon || './assets/icons/icon-192x192.png',
            badge: './assets/icons/badge-72x72.png',
            data: {
                url: data.url || './'
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'Quick Chat', options)
        );
    } catch (error) {
        console.error('[Service Worker] Push notification error:', error);
    }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({type: 'window'})
            .then(windowClients => {
                const url = event.notification.data.url || './';
                
                // If a window is already open, focus it
                for (const client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});
