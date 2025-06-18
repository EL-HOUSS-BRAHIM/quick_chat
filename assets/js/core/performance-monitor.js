/**
 * Performance Monitoring Module
 * Tracks key user interactions and application performance metrics
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            interactions: {},
            api: {},
            rendering: {},
            navigation: {},
            resources: {}
        };
        
        this.config = {
            sampleRate: 1.0, // Percentage of interactions to track (1.0 = 100%)
            bufferSize: 100, // Maximum number of events to store before sending
            flushInterval: 60000, // Flush interval in ms (1 minute)
            apiEndpoint: '/api/metrics',
            localStorage: true, // Store metrics in localStorage when offline
            debug: false
        };
        
        this.buffer = [];
        this.flushTimer = null;
        
        // Initialize 
        this.init();
    }
    
    init() {
        // Start flush timer
        this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
        
        // Track page performance metrics
        this.trackPageMetrics();
        
        // Track API performance
        this.monitorApiCalls();
        
        // Track render performance
        this.monitorRenderPerformance();
        
        // Restore metrics from localStorage if available
        this.restoreOfflineMetrics();
        
        this.log('Performance monitoring initialized');
    }
    
    /**
     * Track a user interaction with timing
     * @param {string} category - Category of interaction (e.g., 'message', 'navigation')
     * @param {string} action - Action being performed (e.g., 'send', 'click')
     * @param {string} label - Optional label for the interaction
     * @param {Object} data - Optional additional data
     * @returns {Function} - Call this function when the interaction completes
     */
    trackInteraction(category, action, label = '', data = {}) {
        // Check sample rate to determine if we should track this interaction
        if (Math.random() > this.config.sampleRate) {
            return () => {}; // Return empty function if not tracking
        }
        
        const startTime = performance.now();
        const interactionId = `${category}:${action}:${Date.now()}`;
        
        // Return function to call when interaction completes
        return (success = true, additionalData = {}) => {
            const duration = performance.now() - startTime;
            
            this.recordMetric({
                type: 'interaction',
                category,
                action,
                label,
                duration,
                timestamp: new Date().toISOString(),
                success,
                data: { ...data, ...additionalData }
            });
            
            // Update aggregated metrics
            const key = `${category}.${action}`;
            if (!this.metrics.interactions[key]) {
                this.metrics.interactions[key] = {
                    count: 0,
                    totalDuration: 0,
                    successCount: 0,
                    failCount: 0,
                    min: Infinity,
                    max: 0
                };
            }
            
            const metric = this.metrics.interactions[key];
            metric.count++;
            metric.totalDuration += duration;
            metric.min = Math.min(metric.min, duration);
            metric.max = Math.max(metric.max, duration);
            
            if (success) {
                metric.successCount++;
            } else {
                metric.failCount++;
            }
            
            return duration;
        };
    }
    
    /**
     * Track API call performance
     * @param {string} endpoint - API endpoint being called
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @returns {Function} - Call this function when the API call completes
     */
    trackApiCall(endpoint, method) {
        const startTime = performance.now();
        
        return (status, responseSize = 0) => {
            const duration = performance.now() - startTime;
            
            this.recordMetric({
                type: 'api',
                endpoint,
                method,
                status,
                duration,
                responseSize,
                timestamp: new Date().toISOString()
            });
            
            // Update aggregated metrics
            const key = `${method}.${endpoint}`;
            if (!this.metrics.api[key]) {
                this.metrics.api[key] = {
                    count: 0,
                    totalDuration: 0,
                    successCount: 0,
                    failCount: 0,
                    totalSize: 0,
                    min: Infinity,
                    max: 0
                };
            }
            
            const metric = this.metrics.api[key];
            metric.count++;
            metric.totalDuration += duration;
            metric.min = Math.min(metric.min, duration);
            metric.max = Math.max(metric.max, duration);
            metric.totalSize += responseSize;
            
            if (status >= 200 && status < 300) {
                metric.successCount++;
            } else {
                metric.failCount++;
            }
            
            return duration;
        };
    }
    
    /**
     * Record a metric to the buffer
     * @param {Object} metric - Metric to record
     */
    recordMetric(metric) {
        this.buffer.push({
            ...metric,
            userId: window.currentUserId || 'anonymous',
            sessionId: this.getSessionId(),
            userAgent: navigator.userAgent,
            url: window.location.pathname
        });
        
        this.log('Recorded metric:', metric);
        
        // Flush if buffer is full
        if (this.buffer.length >= this.config.bufferSize) {
            this.flush();
        }
    }
    
    /**
     * Flush metrics to server
     */
    async flush() {
        if (this.buffer.length === 0) return;
        
        const metricsToSend = [...this.buffer];
        this.buffer = [];
        
        try {
            if (!navigator.onLine) {
                this.storeOfflineMetrics(metricsToSend);
                return;
            }
            
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ metrics: metricsToSend })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            this.log(`Flushed ${metricsToSend.length} metrics`);
        } catch (error) {
            this.log('Error flushing metrics:', error);
            // Store metrics for later sending
            this.storeOfflineMetrics(metricsToSend);
        }
    }
    
    /**
     * Store metrics for sending when back online
     * @param {Array} metrics - Metrics to store
     */
    storeOfflineMetrics(metrics) {
        if (!this.config.localStorage) return;
        
        try {
            const existingMetrics = JSON.parse(localStorage.getItem('offline_metrics') || '[]');
            const updatedMetrics = [...existingMetrics, ...metrics];
            
            localStorage.setItem('offline_metrics', JSON.stringify(updatedMetrics));
            this.log(`Stored ${metrics.length} metrics for offline use`);
        } catch (error) {
            this.log('Error storing offline metrics:', error);
        }
    }
    
    /**
     * Restore and send metrics stored while offline
     */
    restoreOfflineMetrics() {
        if (!this.config.localStorage || !navigator.onLine) return;
        
        try {
            const offlineMetrics = JSON.parse(localStorage.getItem('offline_metrics') || '[]');
            
            if (offlineMetrics.length > 0) {
                this.buffer.push(...offlineMetrics);
                localStorage.removeItem('offline_metrics');
                this.log(`Restored ${offlineMetrics.length} offline metrics`);
                
                // Flush immediately if there are restored metrics
                this.flush();
            }
        } catch (error) {
            this.log('Error restoring offline metrics:', error);
        }
    }
    
    /**
     * Track page load and navigation metrics
     */
    trackPageMetrics() {
        // Only run in browser environment with the Performance API
        if (typeof window === 'undefined' || !window.performance || !window.performance.timing) {
            return;
        }
        
        // Wait for the page to finish loading
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                
                const metrics = {
                    type: 'navigation',
                    pageLoad: timing.loadEventEnd - timing.navigationStart,
                    domReady: timing.domComplete - timing.domLoading,
                    networkLatency: timing.responseEnd - timing.fetchStart,
                    processingTime: timing.domComplete - timing.responseEnd,
                    timestamp: new Date().toISOString()
                };
                
                this.recordMetric(metrics);
                
                // Track resource timing if available
                this.trackResourceTiming();
            }, 0);
        });
        
        // Track page changes for SPAs
        if (typeof window.history !== 'undefined' && typeof window.history.pushState === 'function') {
            const originalPushState = window.history.pushState;
            window.history.pushState = (...args) => {
                originalPushState.apply(window.history, args);
                this.trackSpaNavigation();
            };
            
            window.addEventListener('popstate', () => {
                this.trackSpaNavigation();
            });
        }
    }
    
    /**
     * Track Single Page App navigation
     */
    trackSpaNavigation() {
        const startTime = performance.now();
        
        // Use requestAnimationFrame to detect when the page has rendered
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const duration = performance.now() - startTime;
                
                this.recordMetric({
                    type: 'navigation',
                    action: 'spa_navigation',
                    path: window.location.pathname,
                    duration,
                    timestamp: new Date().toISOString()
                });
            });
        });
    }
    
    /**
     * Track resource timing
     */
    trackResourceTiming() {
        // Only run in browser environment with the Performance API
        if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
            return;
        }
        
        const resources = performance.getEntriesByType('resource');
        
        // Group resources by type
        const resourcesByType = resources.reduce((acc, resource) => {
            const url = resource.name;
            let type = 'other';
            
            if (url.match(/\.js(\?|$)/)) type = 'js';
            else if (url.match(/\.css(\?|$)/)) type = 'css';
            else if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/)) type = 'image';
            else if (url.match(/\.(woff|woff2|ttf|eot)(\?|$)/)) type = 'font';
            else if (url.match(/\/api\//)) type = 'api';
            
            if (!acc[type]) acc[type] = [];
            acc[type].push(resource);
            
            return acc;
        }, {});
        
        // Record metrics for each resource type
        Object.entries(resourcesByType).forEach(([type, resources]) => {
            const totalDuration = resources.reduce((sum, resource) => sum + resource.duration, 0);
            const totalSize = resources.reduce((sum, resource) => {
                // encodedBodySize might not be available in all browsers
                return sum + (resource.encodedBodySize || 0);
            }, 0);
            
            this.metrics.resources[type] = {
                count: resources.length,
                totalDuration,
                averageDuration: totalDuration / resources.length,
                totalSize,
                averageSize: totalSize / resources.length
            };
        });
    }
    
    /**
     * Monitor API calls by intercepting fetch and XMLHttpRequest
     */
    monitorApiCalls() {
        // Only run in browser environment
        if (typeof window === 'undefined') return;
        
        // Intercept fetch
        if (typeof window.fetch === 'function') {
            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = args[0]?.url || args[0];
                const options = args[1] || {};
                const method = options.method || 'GET';
                
                // Only track API calls
                if (typeof url === 'string' && url.includes('/api/')) {
                    const endTracker = this.trackApiCall(url.replace(/^.*\/api\//, '/api/'), method);
                    
                    try {
                        const response = await originalFetch(...args);
                        const clone = response.clone();
                        const text = await clone.text();
                        endTracker(response.status, text.length);
                        return response;
                    } catch (error) {
                        endTracker(0, 0);
                        throw error;
                    }
                }
                
                return originalFetch(...args);
            };
        }
        
        // Intercept XMLHttpRequest
        if (typeof window.XMLHttpRequest === 'function') {
            const originalXHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const originalOpen = xhr.open;
                let method;
                let url;
                let endTracker;
                
                xhr.open = function(...args) {
                    [method, url] = args;
                    originalOpen.apply(xhr, args);
                };
                
                xhr.addEventListener('loadstart', function() {
                    if (typeof url === 'string' && url.includes('/api/')) {
                        endTracker = this.trackApiCall(url.replace(/^.*\/api\//, '/api/'), method);
                    }
                });
                
                xhr.addEventListener('loadend', function() {
                    if (endTracker) {
                        endTracker(xhr.status, xhr.responseText?.length || 0);
                    }
                });
                
                return xhr;
            };
        }
    }
    
    /**
     * Monitor render performance using PerformanceObserver
     */
    monitorRenderPerformance() {
        // Only run in browser environment with PerformanceObserver
        if (typeof window === 'undefined' || typeof PerformanceObserver !== 'function') {
            return;
        }
        
        try {
            // Create a performance observer for long tasks
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.recordMetric({
                        type: 'rendering',
                        category: 'longTask',
                        duration: entry.duration,
                        timestamp: new Date().toISOString(),
                        attribution: entry.attribution.map(attr => attr.name)
                    });
                });
            });
            
            // Start observing long task notifications
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            
            // Create a performance observer for layout shifts
            if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
                const layoutShiftObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        // Ignore layout shifts with a value of 0
                        if (entry.value > 0) {
                            this.recordMetric({
                                type: 'rendering',
                                category: 'layoutShift',
                                value: entry.value,
                                timestamp: new Date().toISOString()
                            });
                        }
                    });
                });
                
                layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
            }
            
            // Create a performance observer for first paint and first contentful paint
            if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('paint')) {
                const paintObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        this.recordMetric({
                            type: 'rendering',
                            category: entry.name,
                            duration: entry.startTime,
                            timestamp: new Date().toISOString()
                        });
                    });
                });
                
                paintObserver.observe({ entryTypes: ['paint'] });
            }
        } catch (e) {
            this.log('Error setting up PerformanceObserver:', e);
        }
    }
    
    /**
     * Get or create a session ID
     * @returns {string} Session ID
     */
    getSessionId() {
        if (!this._sessionId) {
            this._sessionId = localStorage.getItem('metrics_session_id');
            
            if (!this._sessionId) {
                this._sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                localStorage.setItem('metrics_session_id', this._sessionId);
            }
        }
        
        return this._sessionId;
    }
    
    /**
     * Log a message if debug is enabled
     * @param  {...any} args - Arguments to log
     */
    log(...args) {
        if (this.config.debug) {
            console.log('[PerformanceMonitor]', ...args);
        }
    }
    
    /**
     * Get aggregated metrics
     * @returns {Object} Aggregated metrics
     */
    getMetrics() {
        return this.metrics;
    }
    
    /**
     * Destroy the performance monitor
     */
    destroy() {
        clearInterval(this.flushTimer);
        
        // Flush any remaining metrics
        this.flush();
    }
}

// Export as a singleton
const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
