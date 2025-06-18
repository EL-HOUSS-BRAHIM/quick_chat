/**
 * Enhanced Service Worker
 * Provides offline functionality, caching, and background sync
 */
const CACHE_NAME = 'quick-chat-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Files to cache immediately
const PRECACHE_URLS = [
    '/',
    '/offline.html',
    '/dashboard.php',
    '/chat.php',
    '/assets/css/styles.css',
    '/assets/css/chat-modern.css',
    '/assets/css/modern-dashboard.css',
    '/assets/js/app.js',
    '/assets/js/chat.js',
    '/assets/js/utils.js',
    '/assets/js/modern-dashboard.js',
    '/assets/images/icon-192.png',
    '/assets/images/icon-512.png',
    '/manifest.json'
];

// Files to cache on runtime
const RUNTIME_CACHE_URLS = [
    '/api/',
    '/uploads/',
    '/assets/'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Precaching static resources');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Precaching failed:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // Take control of all pages
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    // Return offline page for navigation requests when offline
                    return caches.match(OFFLINE_URL);
                })
        );
        return;
    }

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }

    // Handle static assets
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/')) {
        event.respondWith(handleStaticAssets(request));
        return;
    }

    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(request);
            })
    );
});

async function handleAPIRequest(request) {
    try {
        // Try to fetch from network first
        const response = await fetch(request);
        
        // Cache successful GET requests
        if (request.method === 'GET' && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        // If network fails, try cache for GET requests
        if (request.method === 'GET') {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // For POST requests (like sending messages), store for background sync
        if (request.method === 'POST') {
            await storeFailedRequest(request);
            
            // Return a custom response indicating the request was queued
            return new Response(
                JSON.stringify({
                    success: false,
                    queued: true,
                    message: 'Request queued for background sync'
                }),
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        throw error;
    }
}

async function handleStaticAssets(request) {
    const cache = await caches.open(CACHE_NAME);
    
    // Try cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        // Try network
        const response = await fetch(request);
        
        // Cache successful responses
        if (response.ok) {
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        // Return placeholder for images if both cache and network fail
        if (request.destination === 'image') {
            return generatePlaceholderImage();
        }
        
        throw error;
    }
}

async function storeFailedRequest(request) {
    try {
        const requestData = {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers.entries()),
            body: await request.text(),
            timestamp: Date.now()
        };
        
        // Store in IndexedDB for background sync
        const db = await openDB();
        const tx = db.transaction(['failedRequests'], 'readwrite');
        const store = tx.objectStore('failedRequests');
        await store.add(requestData);
        
        console.log('Failed request stored for background sync');
    } catch (error) {
        console.error('Failed to store request for background sync:', error);
    }
}

function generatePlaceholderImage() {
    // Generate a simple SVG placeholder
    const svg = `
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="#f0f0f0"/>
            <text x="100" y="100" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="#666">
                Image not available
            </text>
        </svg>
    `;
    
    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'no-cache'
        }
    });
}

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'send-messages') {
        event.waitUntil(syncFailedRequests());
    }
});

async function syncFailedRequests() {
    try {
        const db = await openDB();
        const tx = db.transaction(['failedRequests'], 'readonly');
        const store = tx.objectStore('failedRequests');
        const requests = await store.getAll();
        
        console.log(`Syncing ${requests.length} failed requests`);
        
        for (const requestData of requests) {
            try {
                const response = await fetch(requestData.url, {
                    method: requestData.method,
                    headers: requestData.headers,
                    body: requestData.body
                });
                
                if (response.ok) {
                    // Remove successfully synced request
                    const deleteTx = db.transaction(['failedRequests'], 'readwrite');
                    const deleteStore = deleteTx.objectStore('failedRequests');
                    await deleteStore.delete(requestData.id);
                    
                    console.log('Request synced successfully');
                }
            } catch (error) {
                console.error('Failed to sync request:', error);
            }
        }
        
        // Notify clients about sync completion
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'BACKGROUND_SYNC',
                    payload: { tag: 'send-messages', completed: true }
                });
            });
        });
        
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    if (!event.data) {
        return;
    }
    
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: data.icon || '/assets/images/icon-192.png',
        badge: '/assets/images/icon-96.png',
        image: data.image,
        tag: data.tag || 'default',
        data: data.data || {},
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification.tag);
    
    event.notification.close();
    
    // Handle notification click
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            // Check if app is already open
            for (const client of clients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    
                    // Send message to client about notification click
                    client.postMessage({
                        type: 'NOTIFICATION_CLICK',
                        payload: event.notification.data
                    });
                    
                    return;
                }
            }
            
            // Open new window if app is not open
            if (self.clients.openWindow) {
                const url = event.notification.data.url || '/';
                return self.clients.openWindow(url);
            }
        })
    );
});

// Message handling
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_VERSION':
            event.ports[0].postMessage({ version: CACHE_NAME });
            break;
            
        case 'CACHE_URLS':
            event.waitUntil(cacheUrls(payload.urls));
            break;
    }
});

async function cacheUrls(urls) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urls);
        
        // Notify clients about cache update
        self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'CACHE_UPDATED',
                    payload: { urls: urls }
                });
            });
        });
        
        console.log('URLs cached successfully');
    } catch (error) {
        console.error('Failed to cache URLs:', error);
    }
}

// IndexedDB helper functions
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuickChatDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('failedRequests')) {
                const store = db.createObjectStore('failedRequests', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('timestamp', 'timestamp');
            }
            
            if (!db.objectStoreNames.contains('offlineData')) {
                const store = db.createObjectStore('offlineData', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('type', 'type');
                store.createIndex('timestamp', 'timestamp');
            }
        };
    });
}

// Periodic cleanup
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'cleanup') {
        event.waitUntil(cleanupOldData());
    }
});

async function cleanupOldData() {
    try {
        const db = await openDB();
        const tx = db.transaction(['failedRequests', 'offlineData'], 'readwrite');
        
        const failedStore = tx.objectStore('failedRequests');
        const offlineStore = tx.objectStore('offlineData');
        
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        
        // Clean up old failed requests
        const failedCursor = await failedStore.index('timestamp').openCursor(
            IDBKeyRange.upperBound(cutoffTime)
        );
        
        while (failedCursor) {
            await failedCursor.delete();
            failedCursor = await failedCursor.continue();
        }
        
        // Clean up old offline data
        const offlineCursor = await offlineStore.index('timestamp').openCursor(
            IDBKeyRange.upperBound(cutoffTime)
        );
        
        while (offlineCursor) {
            await offlineCursor.delete();
            offlineCursor = await offlineCursor.continue();
        }
        
        console.log('Old data cleaned up');
    } catch (error) {
        console.error('Cleanup failed:', error);
    }
}

console.log('Service Worker loaded');
