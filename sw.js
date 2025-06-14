// Service Worker for offline functionality and caching
const CACHE_NAME = 'quick-chat-v2';
const urlsToCache = [
    './',
    './index.php',
    './assets/css/styles.css',
    './assets/js/config.js',
    './assets/js/utils.js',
    './assets/js/security.js',
    './assets/js/emoji.js',
    './assets/js/chat.js',
    './assets/js/app.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install service worker and cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch resources from cache when offline
self.addEventListener('fetch', (event) => {
    // Don't cache API requests
    if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached resource if available
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request);
            })
    );
});

// Update service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
