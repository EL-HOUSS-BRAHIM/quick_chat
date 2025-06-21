/**
 * Performance Monitor - Organized Architecture
 * 
 * Monitors application performance metrics including:
 * - Component render times
 * - API response times
 * - Memory usage
 * - Network performance
 * - User interactions
 */

import { logger } from './logger.js';
import { configManager } from './configManager.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.thresholds = {
      renderTime: 16, // 60fps = 16.67ms per frame
      apiResponseTime: 2000, // 2 seconds
      memoryUsage: 50, // 50MB
      interactionTime: 100 // 100ms for interactions
    };
    this.enabled = false;
  }

  /**
   * Initialize performance monitoring
   */
  async init() {
    try {
      this.enabled = configManager.get('performance.monitoring', false);
      
      if (!this.enabled) {
        return;
      }

      // Initialize Performance Observer for various metrics
      this.initPerformanceObservers();
      
      // Start memory monitoring
      this.startMemoryMonitoring();
      
      // Monitor network performance
      this.initNetworkMonitoring();
      
      logger.info('Performance Monitor initialized');
      
    } catch (error) {
      logger.error('Failed to initialize Performance Monitor:', error);
    }
  }

  /**
   * Initialize Performance Observers
   */
  initPerformanceObservers() {
    try {
      // Measure navigation timing
      if ('PerformanceObserver' in window) {
        // Navigation timing
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('navigation', {
              type: entry.type,
              duration: entry.duration,
              startTime: entry.startTime,
              loadEventEnd: entry.loadEventEnd,
              domContentLoadedEventEnd: entry.domContentLoadedEventEnd
            });
          }
        });
        navObserver.observe({ type: 'navigation', buffered: true });
        this.observers.set('navigation', navObserver);

        // Resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('resource', {
              name: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize
            });
          }
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
        this.observers.set('resource', resourceObserver);

        // Measure timing
        const measureObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('measure', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
        measureObserver.observe({ type: 'measure', buffered: true });
        this.observers.set('measure', measureObserver);

        // Layout shift
        if ('LayoutShift' in window) {
          const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            this.recordMetric('cls', { value: clsValue });
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          this.observers.set('cls', clsObserver);
        }

        // First Input Delay
        if ('PerformanceEventTiming' in window) {
          const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.processingStart && entry.startTime) {
                const fid = entry.processingStart - entry.startTime;
                this.recordMetric('fid', { value: fid });
              }
            }
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
          this.observers.set('fid', fidObserver);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Performance Observers:', error);
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        this.recordMetric('memory', {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          timestamp: Date.now()
        });

        // Check for memory leaks
        if (memory.usedJSHeapSize > this.thresholds.memoryUsage * 1024 * 1024) {
          logger.warn('High memory usage detected:', memory.usedJSHeapSize);
        }
      }, 5000); // Check every 5 seconds
    }
  }

  /**
   * Initialize network monitoring
   */
  initNetworkMonitoring() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      this.recordMetric('network', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      });

      // Monitor connection changes
      connection.addEventListener('change', () => {
        this.recordMetric('network_change', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          timestamp: Date.now()
        });
      });
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(type, data) {
    if (!this.enabled) return;

    const timestamp = Date.now();
    const metric = {
      type,
      data,
      timestamp
    };

    // Store metric
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    this.metrics.get(type).push(metric);

    // Keep only last 100 entries per type
    const typeMetrics = this.metrics.get(type);
    if (typeMetrics.length > 100) {
      typeMetrics.splice(0, typeMetrics.length - 100);
    }

    // Check thresholds and warn
    this.checkThresholds(type, data);
  }

  /**
   * Check performance thresholds
   */
  checkThresholds(type, data) {
    switch (type) {
      case 'component_render':
        if (data.duration > this.thresholds.renderTime) {
          logger.warn(`Slow component render: ${data.component} took ${data.duration}ms`);
        }
        break;
      case 'api_response':
        if (data.duration > this.thresholds.apiResponseTime) {
          logger.warn(`Slow API response: ${data.endpoint} took ${data.duration}ms`);
        }
        break;
      case 'interaction':
        if (data.duration > this.thresholds.interactionTime) {
          logger.warn(`Slow interaction: ${data.type} took ${data.duration}ms`);
        }
        break;
    }
  }

  /**
   * Start measuring component render time
   */
  startComponentMeasure(componentName) {
    if (!this.enabled) return null;
    
    const markName = `component-${componentName}-start`;
    performance.mark(markName);
    return markName;
  }

  /**
   * End measuring component render time
   */
  endComponentMeasure(componentName, startMark) {
    if (!this.enabled || !startMark) return;

    const endMark = `component-${componentName}-end`;
    const measureName = `component-${componentName}-duration`;
    
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    
    const measure = performance.getEntriesByName(measureName)[0];
    if (measure) {
      this.recordMetric('component_render', {
        component: componentName,
        duration: measure.duration
      });
    }

    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }

  /**
   * Measure API response time
   */
  measureApiResponse(endpoint, startTime, endTime) {
    if (!this.enabled) return;

    const duration = endTime - startTime;
    this.recordMetric('api_response', {
      endpoint,
      duration,
      startTime,
      endTime
    });
  }

  /**
   * Measure user interaction
   */
  measureInteraction(type, duration, details = {}) {
    if (!this.enabled) return;

    this.recordMetric('interaction', {
      type,
      duration,
      details,
      timestamp: Date.now()
    });
  }

  /**
   * Get metrics by type
   */
  getMetrics(type = null) {
    if (type) {
      return this.metrics.get(type) || [];
    }
    
    const allMetrics = {};
    for (const [metricType, data] of this.metrics.entries()) {
      allMetrics[metricType] = data;
    }
    return allMetrics;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary() {
    const summary = {
      timestamp: Date.now(),
      navigation: this.getNavigationSummary(),
      resources: this.getResourceSummary(),
      memory: this.getMemorySummary(),
      network: this.getNetworkSummary(),
      components: this.getComponentSummary()
    };

    return summary;
  }

  /**
   * Get navigation performance summary
   */
  getNavigationSummary() {
    const navMetrics = this.metrics.get('navigation') || [];
    if (navMetrics.length === 0) return null;

    const latest = navMetrics[navMetrics.length - 1];
    return {
      loadTime: latest.data.loadEventEnd,
      domContentLoaded: latest.data.domContentLoadedEventEnd,
      duration: latest.data.duration
    };
  }

  /**
   * Get resource performance summary
   */
  getResourceSummary() {
    const resourceMetrics = this.metrics.get('resource') || [];
    if (resourceMetrics.length === 0) return null;

    const totalSize = resourceMetrics.reduce((sum, metric) => sum + (metric.data.transferSize || 0), 0);
    const avgDuration = resourceMetrics.reduce((sum, metric) => sum + metric.data.duration, 0) / resourceMetrics.length;

    return {
      totalResources: resourceMetrics.length,
      totalSize,
      avgLoadTime: avgDuration
    };
  }

  /**
   * Get memory usage summary
   */
  getMemorySummary() {
    const memoryMetrics = this.metrics.get('memory') || [];
    if (memoryMetrics.length === 0) return null;

    const latest = memoryMetrics[memoryMetrics.length - 1];
    return {
      current: latest.data.used,
      total: latest.data.total,
      limit: latest.data.limit,
      percentage: (latest.data.used / latest.data.total) * 100
    };
  }

  /**
   * Get network summary
   */
  getNetworkSummary() {
    const networkMetrics = this.metrics.get('network') || [];
    if (networkMetrics.length === 0) return null;

    const latest = networkMetrics[networkMetrics.length - 1];
    return latest.data;
  }

  /**
   * Get component performance summary
   */
  getComponentSummary() {
    const componentMetrics = this.metrics.get('component_render') || [];
    if (componentMetrics.length === 0) return null;

    const componentStats = new Map();
    
    componentMetrics.forEach(metric => {
      const component = metric.data.component;
      if (!componentStats.has(component)) {
        componentStats.set(component, {
          count: 0,
          totalDuration: 0,
          maxDuration: 0,
          minDuration: Infinity
        });
      }
      
      const stats = componentStats.get(component);
      stats.count++;
      stats.totalDuration += metric.data.duration;
      stats.maxDuration = Math.max(stats.maxDuration, metric.data.duration);
      stats.minDuration = Math.min(stats.minDuration, metric.data.duration);
    });

    const summary = {};
    for (const [component, stats] of componentStats.entries()) {
      summary[component] = {
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
        maxDuration: stats.maxDuration,
        minDuration: stats.minDuration === Infinity ? 0 : stats.minDuration
      };
    }

    return summary;
  }

  /**
   * Export performance data
   */
  exportData() {
    return {
      summary: this.getPerformanceSummary(),
      metrics: this.getMetrics(),
      thresholds: this.thresholds,
      timestamp: Date.now()
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }

  /**
   * Destroy performance monitor
   */
  destroy() {
    // Disconnect all observers
    for (const [name, observer] of this.observers.entries()) {
      try {
        observer.disconnect();
      } catch (error) {
        logger.error(`Failed to disconnect ${name} observer:`, error);
      }
    }
    
    this.observers.clear();
    this.clearMetrics();
    this.enabled = false;
  }
}

// Create and export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };
