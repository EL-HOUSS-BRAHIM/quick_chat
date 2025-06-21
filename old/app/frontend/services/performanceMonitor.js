/**
 * Performance Monitor Service
 * Advanced performance monitoring with real-time metrics, resource usage tracking,
 * and automated optimization suggestions
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class PerformanceMonitorService {
  constructor() {
    this.eventBus = new EventBus();
    this.metrics = new Map();
    this.observers = new Map();
    this.thresholds = {
      // Performance thresholds
      fcp: 2000,      // First Contentful Paint
      lcp: 2500,      // Largest Contentful Paint
      fid: 100,       // First Input Delay
      cls: 0.1,       // Cumulative Layout Shift
      ttfb: 600,      // Time to First Byte
      memory: 0.8,    // Memory usage (80% of available)
      cpu: 0.7        // CPU usage estimation
    };
    
    this.isMonitoring = false;
    this.performanceData = {
      navigation: {},
      resources: [],
      userTiming: [],
      vitals: {},
      memory: {},
      network: {}
    };

    this.init();
  }

  /**
   * Initialize performance monitoring
   */
  async init() {
    try {
      logger.info('Initializing Performance Monitor...');

      // Setup performance observers
      await this.setupPerformanceObservers();

      // Setup memory monitoring
      this.setupMemoryMonitoring();

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Setup automatic reporting
      this.setupAutomaticReporting();

      // Start monitoring
      this.startMonitoring();

      logger.info('Performance Monitor initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Performance Monitor:', error);
    }
  }

  /**
   * Setup performance observers for Core Web Vitals
   */
  async setupPerformanceObservers() {
    try {
      // Largest Contentful Paint (LCP)
      if ('PerformanceObserver' in window) {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          this.recordMetric('lcp', {
            value: lastEntry.startTime,
            rating: this.getRating('lcp', lastEntry.startTime),
            timestamp: Date.now()
          });
        });

        try {
          lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          this.observers.set('lcp', lcpObserver);
        } catch (e) {
          logger.debug('LCP observer not supported');
        }

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.recordMetric('fid', {
              value: entry.processingStart - entry.startTime,
              rating: this.getRating('fid', entry.processingStart - entry.startTime),
              timestamp: Date.now()
            });
          });
        });

        try {
          fidObserver.observe({ entryTypes: ['first-input'] });
          this.observers.set('fid', fidObserver);
        } catch (e) {
          logger.debug('FID observer not supported');
        }

        // Cumulative Layout Shift (CLS)
        const clsObserver = new PerformanceObserver((entryList) => {
          let clsValue = 0;
          const entries = entryList.getEntries();
          
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });

          this.recordMetric('cls', {
            value: clsValue,
            rating: this.getRating('cls', clsValue),
            timestamp: Date.now()
          });
        });

        try {
          clsObserver.observe({ entryTypes: ['layout-shift'] });
          this.observers.set('cls', clsObserver);
        } catch (e) {
          logger.debug('CLS observer not supported');
        }

        // Resource timing
        const resourceObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.recordResourceTiming(entry);
          });
        });

        try {
          resourceObserver.observe({ entryTypes: ['resource'] });
          this.observers.set('resource', resourceObserver);
        } catch (e) {
          logger.debug('Resource timing observer not supported');
        }

        // Navigation timing
        const navigationObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.recordNavigationTiming(entry);
          });
        });

        try {
          navigationObserver.observe({ entryTypes: ['navigation'] });
          this.observers.set('navigation', navigationObserver);
        } catch (e) {
          logger.debug('Navigation timing observer not supported');
        }
      }

      // First Contentful Paint (FCP)
      if (performance.getEntriesByType) {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          this.recordMetric('fcp', {
            value: fcpEntry.startTime,
            rating: this.getRating('fcp', fcpEntry.startTime),
            timestamp: Date.now()
          });
        }
      }

    } catch (error) {
      logger.error('Failed to setup performance observers:', error);
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if ('memory' in performance) {
      const checkMemory = () => {
        const memInfo = performance.memory;
        const memoryData = {
          used: memInfo.usedJSHeapSize,
          total: memInfo.totalJSHeapSize,
          limit: memInfo.jsHeapSizeLimit,
          usage: memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit,
          timestamp: Date.now()
        };

        this.performanceData.memory = memoryData;
        
        // Check for memory warnings
        if (memoryData.usage > this.thresholds.memory) {
          this.eventBus.emit('performance:memory-warning', memoryData);
        }

        this.recordMetric('memory', memoryData);
      };

      // Check memory every 30 seconds
      setInterval(checkMemory, 30000);
      checkMemory(); // Initial check
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    if ('connection' in navigator) {
      const updateNetworkInfo = () => {
        const connection = navigator.connection;
        const networkData = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
          timestamp: Date.now()
        };

        this.performanceData.network = networkData;
        this.recordMetric('network', networkData);

        // Emit network change event
        this.eventBus.emit('performance:network-changed', networkData);
      };

      navigator.connection.addEventListener('change', updateNetworkInfo);
      updateNetworkInfo(); // Initial check
    }
  }

  /**
   * Setup automatic performance reporting
   */
  setupAutomaticReporting() {
    // Report performance data every 5 minutes
    setInterval(() => {
      if (this.isMonitoring) {
        this.generatePerformanceReport();
      }
    }, 300000);

    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.generatePerformanceReport(true);
    });

    // Report on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.generatePerformanceReport();
      }
    });
  }

  /**
   * Record a performance metric
   */
  recordMetric(name, data) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricData = {
      ...data,
      timestamp: data.timestamp || Date.now()
    };

    this.metrics.get(name).push(metricData);

    // Keep only last 100 entries per metric
    const entries = this.metrics.get(name);
    if (entries.length > 100) {
      entries.splice(0, entries.length - 100);
    }

    // Emit metric update
    this.eventBus.emit('performance:metric-updated', { name, data: metricData });
  }

  /**
   * Record resource timing data
   */
  recordResourceTiming(entry) {
    const resourceData = {
      name: entry.name,
      type: this.getResourceType(entry.name),
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
      timestamp: Date.now()
    };

    this.performanceData.resources.push(resourceData);

    // Keep only last 50 resource entries
    if (this.performanceData.resources.length > 50) {
      this.performanceData.resources.shift();
    }
  }

  /**
   * Record navigation timing data
   */
  recordNavigationTiming(entry) {
    this.performanceData.navigation = {
      domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
      load: entry.loadEventEnd - entry.loadEventStart,
      domInteractive: entry.domInteractive - entry.navigationStart,
      ttfb: entry.responseStart - entry.navigationStart,
      timestamp: Date.now()
    };

    // Record TTFB metric
    this.recordMetric('ttfb', {
      value: this.performanceData.navigation.ttfb,
      rating: this.getRating('ttfb', this.performanceData.navigation.ttfb),
      timestamp: Date.now()
    });
  }

  /**
   * Get performance rating (good, needs-improvement, poor)
   */
  getRating(metric, value) {
    const thresholds = {
      fcp: { good: 1800, poor: 3000 },
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      ttfb: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get resource type from URL
   */
  getResourceType(url) {
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    this.isMonitoring = true;
    this.eventBus.emit('performance:monitoring-started');
    logger.info('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    // Disconnect all observers
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();

    this.eventBus.emit('performance:monitoring-stopped');
    logger.info('Performance monitoring stopped');
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(isBeforeUnload = false) {
    try {
      const report = {
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics: this.getMetricsSummary(),
        vitals: this.getWebVitalsSummary(),
        resources: this.getResourcesSummary(),
        memory: this.performanceData.memory,
        network: this.performanceData.network,
        navigation: this.performanceData.navigation,
        recommendations: this.generateRecommendations()
      };

      // Emit report event
      this.eventBus.emit('performance:report-generated', report);

      // Send to analytics if configured
      if (configManager.get('analytics.enabled', false)) {
        this.sendReportToAnalytics(report, isBeforeUnload);
      }

      return report;

    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      return null;
    }
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    const summary = {};
    
    this.metrics.forEach((entries, name) => {
      if (entries.length > 0) {
        const values = entries.map(entry => entry.value).filter(v => typeof v === 'number');
        
        if (values.length > 0) {
          summary[name] = {
            count: values.length,
            latest: values[values.length - 1],
            average: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      }
    });

    return summary;
  }

  /**
   * Get Core Web Vitals summary
   */
  getWebVitalsSummary() {
    const vitals = {};
    
    ['fcp', 'lcp', 'fid', 'cls', 'ttfb'].forEach(metric => {
      const entries = this.metrics.get(metric);
      if (entries && entries.length > 0) {
        const latest = entries[entries.length - 1];
        vitals[metric] = {
          value: latest.value,
          rating: latest.rating,
          timestamp: latest.timestamp
        };
      }
    });

    return vitals;
  }

  /**
   * Get resources summary
   */
  getResourcesSummary() {
    const resources = this.performanceData.resources;
    const summary = {
      total: resources.length,
      byType: {},
      totalSize: 0,
      cached: 0
    };

    resources.forEach(resource => {
      // Count by type
      if (!summary.byType[resource.type]) {
        summary.byType[resource.type] = { count: 0, size: 0 };
      }
      summary.byType[resource.type].count++;
      summary.byType[resource.type].size += resource.size;

      // Total size
      summary.totalSize += resource.size;

      // Cached resources
      if (resource.cached) {
        summary.cached++;
      }
    });

    return summary;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const vitals = this.getWebVitalsSummary();

    // Check Core Web Vitals
    if (vitals.lcp && vitals.lcp.rating === 'poor') {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Largest Contentful Paint is slow. Consider optimizing images and reducing server response times.',
        metric: 'lcp',
        value: vitals.lcp.value
      });
    }

    if (vitals.fid && vitals.fid.rating === 'poor') {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'First Input Delay is high. Consider reducing JavaScript execution time.',
        metric: 'fid',
        value: vitals.fid.value
      });
    }

    if (vitals.cls && vitals.cls.rating === 'poor') {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Cumulative Layout Shift is high. Ensure proper sizing for images and ads.',
        metric: 'cls',
        value: vitals.cls.value
      });
    }

    // Check memory usage
    if (this.performanceData.memory && this.performanceData.memory.usage > 0.8) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'High memory usage detected. Consider optimizing data structures and cleaning up unused objects.',
        value: this.performanceData.memory.usage
      });
    }

    // Check network conditions
    if (this.performanceData.network && this.performanceData.network.effectiveType === 'slow-2g') {
      recommendations.push({
        type: 'network',
        priority: 'medium',
        message: 'Slow network detected. Consider enabling data-saving features.',
        value: this.performanceData.network.effectiveType
      });
    }

    return recommendations;
  }

  /**
   * Send report to analytics service
   */
  async sendReportToAnalytics(report, isBeforeUnload = false) {
    try {
      const endpoint = '/api/analytics/performance';
      const method = isBeforeUnload ? 'sendBeacon' : 'fetch';

      if (method === 'sendBeacon' && 'sendBeacon' in navigator) {
        navigator.sendBeacon(endpoint, JSON.stringify(report));
      } else {
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(report)
        });
      }

    } catch (error) {
      logger.error('Failed to send performance report to analytics:', error);
    }
  }

  /**
   * Get current performance data
   */
  getCurrentData() {
    return {
      metrics: Object.fromEntries(this.metrics),
      performance: { ...this.performanceData },
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Clear performance data
   */
  clearData() {
    this.metrics.clear();
    this.performanceData = {
      navigation: {},
      resources: [],
      userTiming: [],
      vitals: {},
      memory: {},
      network: {}
    };

    this.eventBus.emit('performance:data-cleared');
  }
}

// Create and export singleton instance
export const performanceMonitor = new PerformanceMonitorService();
export default performanceMonitor;
