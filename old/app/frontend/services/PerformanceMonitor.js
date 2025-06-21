/**
 * Performance Monitor Service
 * Advanced performance monitoring and optimization for Quick Chat
 * Implementation of TODO: Performance monitoring and optimization
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class PerformanceMonitor extends EventBus {
  constructor() {
    super();
    
    this.config = {
      enableMetrics: true,
      enableRealTimeMonitoring: true,
      metricsInterval: 5000, // 5 seconds
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      fpsThreshold: 30,
      loadTimeThreshold: 3000, // 3 seconds
      bundleSizeThreshold: 1024 * 1024, // 1MB
      enableDebugMode: false
    };

    this.metrics = {
      memory: {
        used: 0,
        total: 0,
        peak: 0,
        history: []
      },
      performance: {
        fps: 0,
        renderTime: 0,
        loadTime: 0,
        bundleSize: 0
      },
      network: {
        requests: 0,
        totalSize: 0,
        avgResponseTime: 0,
        errors: 0
      },
      user: {
        interactions: 0,
        clicks: 0,
        scrolls: 0,
        keystrokes: 0
      }
    };

    this.observers = new Map();
    this.startTime = performance.now();
    this.isMonitoring = false;
    
    this.init();
  }

  /**
   * Initialize performance monitoring
   */
  async init() {
    try {
      this.setupPerformanceObservers();
      this.startMemoryMonitoring();
      this.setupUserInteractionTracking();
      this.startRealTimeMonitoring();
      
      this.isMonitoring = true;
      logger.debug('Performance monitor initialized');
    } catch (error) {
      logger.error('Failed to initialize performance monitor:', error);
    }
  }

  /**
   * Setup Performance API observers
   */
  setupPerformanceObservers() {
    // Navigation timing
    if ('PerformanceObserver' in window) {
      // Long tasks observer
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.recordLongTask(entry);
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (error) {
        logger.warn('Long task observer not supported:', error);
      }

      // Layout shifts observer
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.recordLayoutShift(entry);
          });
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (error) {
        logger.warn('Layout shift observer not supported:', error);
      }

      // Largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordLCP(lastEntry);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (error) {
        logger.warn('LCP observer not supported:', error);
      }

      // First input delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.recordFID(entry);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);
      } catch (error) {
        logger.warn('FID observer not supported:', error);
      }
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    if (!('memory' in performance)) {
      logger.warn('Memory API not supported');
      return;
    }

    setInterval(() => {
      this.collectMemoryMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect memory metrics
   */
  collectMemoryMetrics() {
    if (!('memory' in performance)) return;

    const memory = performance.memory;
    const used = memory.usedJSHeapSize;
    const total = memory.totalJSHeapSize;
    const limit = memory.jsHeapSizeLimit;

    this.metrics.memory.used = used;
    this.metrics.memory.total = total;
    this.metrics.memory.peak = Math.max(this.metrics.memory.peak, used);

    // Keep history for trends
    this.metrics.memory.history.push({
      timestamp: Date.now(),
      used,
      total
    });

    // Keep only last 100 entries
    if (this.metrics.memory.history.length > 100) {
      this.metrics.memory.history.shift();
    }

    // Check for memory leaks
    if (used > this.config.memoryThreshold) {
      this.emit('memory:threshold-exceeded', {
        used,
        threshold: this.config.memoryThreshold
      });
    }

    // Detect potential memory leaks
    if (this.metrics.memory.history.length >= 10) {
      const trend = this.calculateMemoryTrend();
      if (trend > 0.1) { // 10% increase per measurement
        this.emit('memory:leak-detected', { trend, used });
      }
    }
  }

  /**
   * Calculate memory usage trend
   */
  calculateMemoryTrend() {
    const history = this.metrics.memory.history;
    if (history.length < 2) return 0;

    const recent = history.slice(-10);
    const first = recent[0].used;
    const last = recent[recent.length - 1].used;

    return (last - first) / first;
  }

  /**
   * Start FPS monitoring
   */
  startFPSMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        this.metrics.performance.fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;

        if (this.metrics.performance.fps < this.config.fpsThreshold) {
          this.emit('performance:low-fps', {
            fps: this.metrics.performance.fps,
            threshold: this.config.fpsThreshold
          });
        }
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Setup user interaction tracking
   */
  setupUserInteractionTracking() {
    // Track clicks
    document.addEventListener('click', () => {
      this.metrics.user.clicks++;
      this.metrics.user.interactions++;
    });

    // Track scrolls
    let scrollTimer;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        this.metrics.user.scrolls++;
        this.metrics.user.interactions++;
      }, 100);
    });

    // Track keystrokes
    document.addEventListener('keydown', () => {
      this.metrics.user.keystrokes++;
      this.metrics.user.interactions++;
    });
  }

  /**
   * Start real-time monitoring
   */
  startRealTimeMonitoring() {
    if (!this.config.enableRealTimeMonitoring) return;

    setInterval(() => {
      this.emitMetricsUpdate();
    }, this.config.metricsInterval);

    this.startFPSMonitoring();
  }

  /**
   * Record long task
   */
  recordLongTask(entry) {
    const duration = entry.duration;
    
    this.emit('performance:long-task', {
      duration,
      startTime: entry.startTime,
      name: entry.name
    });

    logger.warn(`Long task detected: ${duration}ms`);
  }

  /**
   * Record layout shift
   */
  recordLayoutShift(entry) {
    const value = entry.value;
    
    this.emit('performance:layout-shift', {
      value,
      startTime: entry.startTime,
      sources: entry.sources
    });

    if (value > 0.1) { // CLS threshold
      logger.warn(`Significant layout shift: ${value}`);
    }
  }

  /**
   * Record Largest Contentful Paint
   */
  recordLCP(entry) {
    const value = entry.startTime;
    
    this.emit('performance:lcp', {
      value,
      element: entry.element
    });

    if (value > 2500) { // LCP threshold
      logger.warn(`Poor LCP: ${value}ms`);
    }
  }

  /**
   * Record First Input Delay
   */
  recordFID(entry) {
    const value = entry.processingStart - entry.startTime;
    
    this.emit('performance:fid', {
      value,
      startTime: entry.startTime
    });

    if (value > 100) { // FID threshold
      logger.warn(`Poor FID: ${value}ms`);
    }
  }

  /**
   * Measure function performance
   */
  measureFunction(fn, name = 'anonymous') {
    return async (...args) => {
      const startTime = performance.now();
      
      try {
        const result = await fn(...args);
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.emit('performance:function-measured', {
          name,
          duration,
          success: true
        });

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.emit('performance:function-measured', {
          name,
          duration,
          success: false,
          error: error.message
        });

        throw error;
      }
    };
  }

  /**
   * Measure component render time
   */
  measureComponentRender(component, name) {
    const startTime = performance.now();
    
    // Wrap the render method
    const originalRender = component.render;
    component.render = (...args) => {
      const renderStart = performance.now();
      const result = originalRender.apply(component, args);
      const renderEnd = performance.now();
      
      this.emit('performance:component-render', {
        component: name,
        duration: renderEnd - renderStart
      });

      return result;
    };
  }

  /**
   * Track network performance
   */
  trackNetworkRequest(url, method = 'GET') {
    const startTime = performance.now();
    
    return {
      complete: (success = true, size = 0) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.metrics.network.requests++;
        this.metrics.network.totalSize += size;
        this.metrics.network.avgResponseTime = 
          (this.metrics.network.avgResponseTime + duration) / 2;

        if (!success) {
          this.metrics.network.errors++;
        }

        this.emit('performance:network-request', {
          url,
          method,
          duration,
          success,
          size
        });
      }
    };
  }

  /**
   * Get performance snapshot
   */
  getPerformanceSnapshot() {
    return {
      timestamp: Date.now(),
      memory: { ...this.metrics.memory },
      performance: { ...this.metrics.performance },
      network: { ...this.metrics.network },
      user: { ...this.metrics.user },
      uptime: performance.now() - this.startTime
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const snapshot = this.getPerformanceSnapshot();
    
    return {
      summary: {
        overallScore: this.calculateOverallScore(snapshot),
        memoryUsage: this.formatBytes(snapshot.memory.used),
        fps: snapshot.performance.fps,
        networkRequests: snapshot.network.requests,
        userInteractions: snapshot.user.interactions
      },
      details: snapshot,
      recommendations: this.generateRecommendations(snapshot)
    };
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore(snapshot) {
    let score = 100;

    // Memory score (30%)
    const memoryScore = Math.max(0, 100 - (snapshot.memory.used / this.config.memoryThreshold) * 100);
    score = score * 0.3 + memoryScore * 0.3;

    // FPS score (25%)
    const fpsScore = Math.min(100, (snapshot.performance.fps / 60) * 100);
    score += fpsScore * 0.25;

    // Network score (25%)
    const networkScore = Math.max(0, 100 - (snapshot.network.avgResponseTime / 1000) * 100);
    score += networkScore * 0.25;

    // Error score (20%)
    const errorRate = snapshot.network.errors / Math.max(1, snapshot.network.requests);
    const errorScore = Math.max(0, 100 - errorRate * 100);
    score += errorScore * 0.2;

    return Math.round(score);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(snapshot) {
    const recommendations = [];

    // Memory recommendations
    if (snapshot.memory.used > this.config.memoryThreshold * 0.8) {
      recommendations.push({
        category: 'memory',
        priority: 'high',
        message: 'Memory usage is high. Consider optimizing component lifecycle and removing unused objects.'
      });
    }

    // FPS recommendations
    if (snapshot.performance.fps < this.config.fpsThreshold) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        message: 'Frame rate is below optimal. Consider reducing DOM manipulations and using requestAnimationFrame.'
      });
    }

    // Network recommendations
    if (snapshot.network.avgResponseTime > 1000) {
      recommendations.push({
        category: 'network',
        priority: 'medium',
        message: 'Network response times are slow. Consider implementing caching and optimizing API calls.'
      });
    }

    return recommendations;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Emit metrics update
   */
  emitMetricsUpdate() {
    this.emit('metrics:update', this.getPerformanceSnapshot());
  }

  /**
   * Clear metrics history
   */
  clearMetrics() {
    this.metrics.memory.history = [];
    this.metrics.network = {
      requests: 0,
      totalSize: 0,
      avgResponseTime: 0,
      errors: 0
    };
    this.metrics.user = {
      interactions: 0,
      clicks: 0,
      scrolls: 0,
      keystrokes: 0
    };
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.isMonitoring = false;
  }

  /**
   * Destroy performance monitor
   */
  destroy() {
    this.stop();
    this.clearMetrics();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;