/**
 * Browser Compatibility Manager
 * Handles feature detection, polyfills, and progressive enhancement
 */
class BrowserCompatibility {
    constructor() {
        this.supportedFeatures = new Map();
        this.polyfillsLoaded = new Set();
        this.fallbackMethods = new Map();
        
        this.init();
    }

    async init() {
        this.detectFeatures();
        await this.loadRequiredPolyfills();
        this.setupFallbacks();
        this.configureProgressiveEnhancement();
    }

    detectFeatures() {
        // WebRTC Support
        this.supportedFeatures.set('webrtc', this.checkWebRTCSupport());
        
        // Modern JavaScript Features
        this.supportedFeatures.set('es6', this.checkES6Support());
        this.supportedFeatures.set('modules', this.checkModuleSupport());
        this.supportedFeatures.set('asyncAwait', this.checkAsyncAwaitSupport());
        
        // Web APIs
        this.supportedFeatures.set('serviceWorker', 'serviceWorker' in navigator);
        this.supportedFeatures.set('pushNotifications', 'PushManager' in window);
        this.supportedFeatures.set('intersectionObserver', 'IntersectionObserver' in window);
        this.supportedFeatures.set('resizeObserver', 'ResizeObserver' in window);
        this.supportedFeatures.set('webWorkers', 'Worker' in window);
        this.supportedFeatures.set('indexedDB', 'indexedDB' in window);
        this.supportedFeatures.set('localStorage', this.checkLocalStorageSupport());
        
        // Media APIs
        this.supportedFeatures.set('mediaDevices', navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        this.supportedFeatures.set('mediaRecorder', 'MediaRecorder' in window);
        this.supportedFeatures.set('webAudio', 'AudioContext' in window || 'webkitAudioContext' in window);
        
        // File APIs
        this.supportedFeatures.set('fileAPI', 'File' in window && 'FileReader' in window);
        this.supportedFeatures.set('dragDrop', 'draggable' in document.createElement('div'));
        
        // CSS Features
        this.supportedFeatures.set('cssGrid', CSS.supports('display', 'grid'));
        this.supportedFeatures.set('cssFlexbox', CSS.supports('display', 'flex'));
        this.supportedFeatures.set('cssCustomProperties', CSS.supports('--test', 'value'));
        
        console.log('Feature detection complete:', Object.fromEntries(this.supportedFeatures));
    }

    checkWebRTCSupport() {
        return !!(
            window.RTCPeerConnection ||
            window.webkitRTCPeerConnection ||
            window.mozRTCPeerConnection
        );
    }

    checkES6Support() {
        try {
            eval('const test = () => {}; class Test {}');
            return true;
        } catch (e) {
            return false;
        }
    }

    checkModuleSupport() {
        const script = document.createElement('script');
        return 'noModule' in script;
    }

    checkAsyncAwaitSupport() {
        try {
            eval('async function test() { await Promise.resolve(); }');
            return true;
        } catch (e) {
            return false;
        }
    }

    checkLocalStorageSupport() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    async loadRequiredPolyfills() {
        const polyfillsToLoad = [];

        // WebRTC Polyfill
        if (!this.supportedFeatures.get('webrtc')) {
            polyfillsToLoad.push(this.loadWebRTCPolyfill());
        }

        // Intersection Observer Polyfill
        if (!this.supportedFeatures.get('intersectionObserver')) {
            polyfillsToLoad.push(this.loadIntersectionObserverPolyfill());
        }

        // Resize Observer Polyfill
        if (!this.supportedFeatures.get('resizeObserver')) {
            polyfillsToLoad.push(this.loadResizeObserverPolyfill());
        }

        // ES6 Polyfills
        if (!this.supportedFeatures.get('es6')) {
            polyfillsToLoad.push(this.loadES6Polyfills());
        }

        // Fetch Polyfill
        if (!('fetch' in window)) {
            polyfillsToLoad.push(this.loadFetchPolyfill());
        }

        // Promise Polyfill
        if (!('Promise' in window)) {
            polyfillsToLoad.push(this.loadPromisePolyfill());
        }

        // Load all polyfills
        await Promise.all(polyfillsToLoad);
    }

    async loadWebRTCPolyfill() {
        if (this.polyfillsLoaded.has('webrtc')) return;
        
        try {
            await this.loadScript('https://webrtc.github.io/adapter/adapter-latest.js');
            this.polyfillsLoaded.add('webrtc');
            this.supportedFeatures.set('webrtc', true);
            console.log('WebRTC polyfill loaded');
        } catch (error) {
            console.warn('Failed to load WebRTC polyfill:', error);
            this.setupWebRTCFallback();
        }
    }

    async loadIntersectionObserverPolyfill() {
        if (this.polyfillsLoaded.has('intersectionObserver')) return;
        
        try {
            await this.loadScript('https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
            this.polyfillsLoaded.add('intersectionObserver');
            this.supportedFeatures.set('intersectionObserver', true);
            console.log('IntersectionObserver polyfill loaded');
        } catch (error) {
            console.warn('Failed to load IntersectionObserver polyfill:', error);
            this.setupIntersectionObserverFallback();
        }
    }

    async loadResizeObserverPolyfill() {
        if (this.polyfillsLoaded.has('resizeObserver')) return;
        
        try {
            await this.loadScript('https://polyfill.io/v3/polyfill.min.js?features=ResizeObserver');
            this.polyfillsLoaded.add('resizeObserver');
            this.supportedFeatures.set('resizeObserver', true);
            console.log('ResizeObserver polyfill loaded');
        } catch (error) {
            console.warn('Failed to load ResizeObserver polyfill:', error);
        }
    }

    async loadES6Polyfills() {
        if (this.polyfillsLoaded.has('es6')) return;
        
        try {
            await this.loadScript('https://polyfill.io/v3/polyfill.min.js?features=es6');
            this.polyfillsLoaded.add('es6');
            this.supportedFeatures.set('es6', true);
            console.log('ES6 polyfills loaded');
        } catch (error) {
            console.warn('Failed to load ES6 polyfills:', error);
        }
    }

    async loadFetchPolyfill() {
        if (this.polyfillsLoaded.has('fetch')) return;
        
        try {
            await this.loadScript('https://polyfill.io/v3/polyfill.min.js?features=fetch');
            this.polyfillsLoaded.add('fetch');
            console.log('Fetch polyfill loaded');
        } catch (error) {
            console.warn('Failed to load Fetch polyfill:', error);
            this.setupFetchFallback();
        }
    }

    async loadPromisePolyfill() {
        if (this.polyfillsLoaded.has('promise')) return;
        
        try {
            await this.loadScript('https://polyfill.io/v3/polyfill.min.js?features=Promise');
            this.polyfillsLoaded.add('promise');
            console.log('Promise polyfill loaded');
        } catch (error) {
            console.warn('Failed to load Promise polyfill:', error);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupFallbacks() {
        this.setupWebRTCFallback();
        this.setupIntersectionObserverFallback();
        this.setupFetchFallback();
        this.setupLocalStorageFallback();
        this.setupServiceWorkerFallback();
    }

    setupWebRTCFallback() {
        if (this.supportedFeatures.get('webrtc')) return;

        // Provide text-based communication alternative
        this.fallbackMethods.set('webrtc', {
            startCall: () => {
                this.showFallbackMessage('Voice/video calls are not supported in your browser. Please use text messaging instead.');
                return false;
            },
            shareScreen: () => {
                this.showFallbackMessage('Screen sharing is not supported in your browser.');
                return false;
            }
        });

        // Disable call buttons
        document.querySelectorAll('.call-btn, .video-btn').forEach(btn => {
            btn.style.display = 'none';
        });

        console.log('WebRTC fallback configured');
    }

    setupIntersectionObserverFallback() {
        if (this.supportedFeatures.get('intersectionObserver')) return;

        // Fallback using scroll events
        window.IntersectionObserver = class IntersectionObserverFallback {
            constructor(callback, options = {}) {
                this.callback = callback;
                this.options = options;
                this.elements = new Set();
                this.scrollHandler = this.handleScroll.bind(this);
            }

            observe(element) {
                this.elements.add(element);
                if (this.elements.size === 1) {
                    window.addEventListener('scroll', this.scrollHandler, { passive: true });
                    window.addEventListener('resize', this.scrollHandler, { passive: true });
                }
            }

            unobserve(element) {
                this.elements.delete(element);
                if (this.elements.size === 0) {
                    window.removeEventListener('scroll', this.scrollHandler);
                    window.removeEventListener('resize', this.scrollHandler);
                }
            }

            disconnect() {
                this.elements.clear();
                window.removeEventListener('scroll', this.scrollHandler);
                window.removeEventListener('resize', this.scrollHandler);
            }

            handleScroll() {
                const entries = [];
                this.elements.forEach(element => {
                    const rect = element.getBoundingClientRect();
                    const isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
                    
                    entries.push({
                        target: element,
                        isIntersecting: isIntersecting,
                        intersectionRatio: isIntersecting ? 1 : 0
                    });
                });

                if (entries.length > 0) {
                    this.callback(entries);
                }
            }
        };

        console.log('IntersectionObserver fallback configured');
    }

    setupFetchFallback() {
        if ('fetch' in window) return;

        // XMLHttpRequest-based fetch polyfill
        window.fetch = function(url, options = {}) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const method = options.method || 'GET';
                
                xhr.open(method, url);
                
                // Set headers
                if (options.headers) {
                    Object.entries(options.headers).forEach(([key, value]) => {
                        xhr.setRequestHeader(key, value);
                    });
                }
                
                xhr.onload = () => {
                    const response = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        json: () => Promise.resolve(JSON.parse(xhr.responseText)),
                        text: () => Promise.resolve(xhr.responseText),
                        headers: new Map()
                    };
                    resolve(response);
                };
                
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(options.body);
            });
        };

        console.log('Fetch fallback configured');
    }

    setupLocalStorageFallback() {
        if (this.supportedFeatures.get('localStorage')) return;

        // In-memory storage fallback
        const memoryStorage = new Map();
        
        window.localStorage = {
            getItem: (key) => memoryStorage.get(key) || null,
            setItem: (key, value) => memoryStorage.set(key, String(value)),
            removeItem: (key) => memoryStorage.delete(key),
            clear: () => memoryStorage.clear(),
            get length() { return memoryStorage.size; },
            key: (index) => Array.from(memoryStorage.keys())[index] || null
        };

        console.log('localStorage fallback configured');
    }

    setupServiceWorkerFallback() {
        if (this.supportedFeatures.get('serviceWorker')) return;

        // Basic offline detection without service worker
        let isOnline = navigator.onLine;
        
        window.addEventListener('online', () => {
            isOnline = true;
            this.triggerEvent('online');
        });
        
        window.addEventListener('offline', () => {
            isOnline = false;
            this.triggerEvent('offline');
        });

        // Simple cache using localStorage
        const offlineCache = {
            set: (key, data) => {
                try {
                    if (localStorage) {
                        localStorage.setItem(`cache_${key}`, JSON.stringify({
                            data: data,
                            timestamp: Date.now()
                        }));
                    }
                } catch (e) {
                    console.warn('Failed to cache data:', e);
                }
            },
            get: (key, maxAge = 3600000) => { // 1 hour default
                try {
                    if (localStorage) {
                        const cached = localStorage.getItem(`cache_${key}`);
                        if (cached) {
                            const parsed = JSON.parse(cached);
                            if (Date.now() - parsed.timestamp < maxAge) {
                                return parsed.data;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Failed to retrieve cached data:', e);
                }
                return null;
            }
        };

        window.offlineCache = offlineCache;
        console.log('Service Worker fallback configured');
    }

    configureProgressiveEnhancement() {
        // Add CSS classes based on feature support
        const html = document.documentElement;
        
        this.supportedFeatures.forEach((supported, feature) => {
            html.classList.add(supported ? `supports-${feature}` : `no-${feature}`);
        });

        // Configure feature flags
        window.featureFlags = {
            useWebRTC: this.supportedFeatures.get('webrtc'),
            useServiceWorker: this.supportedFeatures.get('serviceWorker'),
            useIntersectionObserver: this.supportedFeatures.get('intersectionObserver'),
            useModernJS: this.supportedFeatures.get('es6'),
            enableOfflineMode: this.supportedFeatures.get('serviceWorker') || this.supportedFeatures.get('localStorage')
        };

        console.log('Progressive enhancement configured:', window.featureFlags);
    }

    showFallbackMessage(message) {
        const notification = document.createElement('div');
        notification.className = 'fallback-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">⚠️</span>
                <span class="notification-message">${message}</span>
                <button type="button" class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);

        // Manual close
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    triggerEvent(eventName, data = {}) {
        const event = new CustomEvent(eventName, { detail: data });
        window.dispatchEvent(event);
    }

    // Public API methods
    isSupported(feature) {
        return this.supportedFeatures.get(feature) || false;
    }

    getFallback(feature) {
        return this.fallbackMethods.get(feature);
    }

    executeWithFallback(feature, primaryFunction, fallbackFunction) {
        if (this.isSupported(feature)) {
            return primaryFunction();
        } else {
            return fallbackFunction ? fallbackFunction() : this.getFallback(feature);
        }
    }

    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';

        if (ua.includes('Chrome')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edge')) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
        }

        return {
            browser: browser,
            version: version,
            userAgent: ua,
            platform: navigator.platform,
            supportedFeatures: Object.fromEntries(this.supportedFeatures)
        };
    }
}

// Initialize browser compatibility manager
document.addEventListener('DOMContentLoaded', () => {
    window.browserCompatibility = new BrowserCompatibility();
});

// Export for external use
window.BrowserCompatibility = BrowserCompatibility;
