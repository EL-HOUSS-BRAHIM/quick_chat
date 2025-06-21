/**
 * Network Manager - Organized Architecture
 * 
 * Handles network connectivity monitoring and optimization:
 * - Connection status monitoring
 * - Network quality detection
 * - Bandwidth estimation
 * - Offline/online state management
 * - Network-aware optimizations
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class NetworkManager {
  constructor() {
    this.eventBus = new EventBus();
    this.isOnline = navigator.onLine;
    this.connection = null;
    this.quality = 'unknown';
    this.lastSpeedTest = null;
    this.pingInterval = null;
    this.speedTestInterval = null;
    this.retryQueue = [];
    this.initialized = false;
  }

  /**
   * Initialize network manager
   */
  async init() {
    try {
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
      // Setup network quality monitoring
      this.setupQualityMonitoring();
      
      // Start periodic checks
      this.startPeriodicChecks();
      
      // Initial network assessment
      await this.assessNetworkQuality();
      
      this.initialized = true;
      logger.info('Network Manager initialized');
      
    } catch (error) {
      logger.error('Failed to initialize Network Manager:', error);
    }
  }

  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    // Online/offline events
    window.addEventListener('online', () => {
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });

    // Network Information API if available
    if ('connection' in navigator) {
      this.connection = navigator.connection;
      
      // Initial connection info
      this.updateConnectionInfo();
      
      // Listen for connection changes
      this.connection.addEventListener('change', () => {
        this.updateConnectionInfo();
      });
    }
  }

  /**
   * Setup network quality monitoring
   */
  setupQualityMonitoring() {
    // Monitor page load performance
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.analyzeNavigationPerformance(entry);
            } else if (entry.entryType === 'resource') {
              this.analyzeResourcePerformance(entry);
            }
          }
        });

        observer.observe({ entryTypes: ['navigation', 'resource'] });
      } catch (error) {
        logger.warn('PerformanceObserver not fully supported:', error);
      }
    }
  }

  /**
   * Start periodic network checks
   */
  startPeriodicChecks() {
    // Ping test every 30 seconds
    this.pingInterval = setInterval(() => {
      this.pingTest();
    }, 30000);

    // Speed test every 5 minutes when active
    this.speedTestInterval = setInterval(() => {
      if (!document.hidden && this.shouldRunSpeedTest()) {
        this.speedTest();
      }
    }, 300000);
  }

  /**
   * Handle online event
   */
  handleOnline() {
    this.isOnline = true;
    logger.info('Network: Online');
    
    // Process retry queue
    this.processRetryQueue();
    
    // Emit online event
    this.eventBus.emit('network:online', {
      timestamp: Date.now()
    });
    
    // Re-assess network quality
    setTimeout(() => {
      this.assessNetworkQuality();
    }, 1000);
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    this.isOnline = false;
    this.quality = 'offline';
    
    logger.info('Network: Offline');
    
    // Emit offline event
    this.eventBus.emit('network:offline', {
      timestamp: Date.now()
    });
  }

  /**
   * Update connection information
   */
  updateConnectionInfo() {
    if (!this.connection) return;

    const connectionInfo = {
      effectiveType: this.connection.effectiveType,
      downlink: this.connection.downlink,
      rtt: this.connection.rtt,
      saveData: this.connection.saveData,
      type: this.connection.type
    };

    // Update quality based on connection info
    this.updateQualityFromConnection(connectionInfo);
    
    // Emit connection change event
    this.eventBus.emit('network:connection:changed', connectionInfo);
    
    logger.info('Network connection updated:', connectionInfo);
  }

  /**
   * Update quality from connection information
   */
  updateQualityFromConnection(info) {
    let newQuality = 'unknown';
    
    if (info.effectiveType) {
      switch (info.effectiveType) {
        case 'slow-2g':
          newQuality = 'poor';
          break;
        case '2g':
          newQuality = 'slow';
          break;
        case '3g':
          newQuality = 'moderate';
          break;
        case '4g':
          newQuality = 'good';
          break;
        default:
          newQuality = 'unknown';
      }
    }

    // Use RTT and downlink for more precise assessment
    if (info.rtt && info.downlink) {
      if (info.rtt > 2000 || info.downlink < 0.15) {
        newQuality = 'poor';
      } else if (info.rtt > 1000 || info.downlink < 0.5) {
        newQuality = 'slow';
      } else if (info.rtt > 500 || info.downlink < 1.5) {
        newQuality = 'moderate';
      } else {
        newQuality = 'good';
      }
    }

    if (newQuality !== this.quality) {
      const previousQuality = this.quality;
      this.quality = newQuality;
      
      this.eventBus.emit('network:quality:changed', {
        quality: newQuality,
        previousQuality,
        connectionInfo: info
      });
    }
  }

  /**
   * Analyze navigation performance
   */
  analyzeNavigationPerformance(entry) {
    const timing = {
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      connect: entry.connectEnd - entry.connectStart,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      total: entry.loadEventEnd - entry.navigationStart
    };

    // Assess quality based on timing
    if (timing.total > 10000) {
      this.updateQualityAssessment('poor');
    } else if (timing.total > 5000) {
      this.updateQualityAssessment('slow');
    } else if (timing.total > 2000) {
      this.updateQualityAssessment('moderate');
    } else {
      this.updateQualityAssessment('good');
    }

    this.eventBus.emit('network:performance:navigation', timing);
  }

  /**
   * Analyze resource performance
   */
  analyzeResourcePerformance(entry) {
    if (entry.transferSize && entry.duration) {
      const speed = (entry.transferSize * 8) / (entry.duration / 1000); // bits per second
      const speedMbps = speed / (1024 * 1024);

      this.eventBus.emit('network:performance:resource', {
        name: entry.name,
        size: entry.transferSize,
        duration: entry.duration,
        speed: speedMbps
      });
    }
  }

  /**
   * Update quality assessment
   */
  updateQualityAssessment(assessment) {
    // Use weighted approach to avoid rapid quality changes
    const qualities = ['poor', 'slow', 'moderate', 'good'];
    const currentIndex = qualities.indexOf(this.quality);
    const newIndex = qualities.indexOf(assessment);
    
    if (currentIndex === -1 || Math.abs(currentIndex - newIndex) > 1) {
      this.quality = assessment;
      this.eventBus.emit('network:quality:assessed', {
        quality: assessment,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Perform ping test
   */
  async pingTest() {
    if (!this.isOnline) return;

    try {
      const startTime = performance.now();
      const response = await fetch('/api/v1/ping', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      const endTime = performance.now();
      
      if (response.ok) {
        const latency = endTime - startTime;
        
        this.eventBus.emit('network:ping', {
          latency,
          timestamp: Date.now()
        });
        
        // Update quality based on latency
        if (latency > 1000) {
          this.updateQualityAssessment('poor');
        } else if (latency > 500) {
          this.updateQualityAssessment('slow');
        } else if (latency > 200) {
          this.updateQualityAssessment('moderate');
        } else {
          this.updateQualityAssessment('good');
        }
      }
    } catch (error) {
      logger.warn('Ping test failed:', error);
      if (this.isOnline) {
        this.updateQualityAssessment('poor');
      }
    }
  }

  /**
   * Perform speed test
   */
  async speedTest() {
    if (!this.isOnline || this.quality === 'poor') return;

    try {
      // Download test with a small file
      const startTime = performance.now();
      const response = await fetch('/assets/test/speed-test.json?' + Date.now(), {
        cache: 'no-cache'
      });
      const endTime = performance.now();
      
      if (response.ok) {
        const data = await response.arrayBuffer();
        const duration = endTime - startTime;
        const size = data.byteLength;
        const speedBps = (size * 8) / (duration / 1000);
        const speedMbps = speedBps / (1024 * 1024);
        
        this.lastSpeedTest = {
          timestamp: Date.now(),
          duration,
          size,
          speed: speedMbps
        };
        
        this.eventBus.emit('network:speed:test', this.lastSpeedTest);
        
        // Update quality based on speed
        if (speedMbps < 0.15) {
          this.updateQualityAssessment('poor');
        } else if (speedMbps < 0.5) {
          this.updateQualityAssessment('slow');
        } else if (speedMbps < 1.5) {
          this.updateQualityAssessment('moderate');
        } else {
          this.updateQualityAssessment('good');
        }
      }
    } catch (error) {
      logger.warn('Speed test failed:', error);
    }
  }

  /**
   * Check if speed test should run
   */
  shouldRunSpeedTest() {
    if (!this.lastSpeedTest) return true;
    
    const timeSinceLastTest = Date.now() - this.lastSpeedTest.timestamp;
    return timeSinceLastTest > 300000; // 5 minutes
  }

  /**
   * Assess overall network quality
   */
  async assessNetworkQuality() {
    if (!this.isOnline) {
      this.quality = 'offline';
      return;
    }

    // Run ping test for immediate assessment
    await this.pingTest();
    
    // Schedule speed test if needed
    if (this.shouldRunSpeedTest()) {
      setTimeout(() => this.speedTest(), 2000);
    }
  }

  /**
   * Add request to retry queue
   */
  addToRetryQueue(request) {
    this.retryQueue.push({
      ...request,
      timestamp: Date.now(),
      attempts: 0
    });
  }

  /**
   * Process retry queue when back online
   */
  async processRetryQueue() {
    if (!this.isOnline || this.retryQueue.length === 0) return;

    logger.info(`Processing ${this.retryQueue.length} queued requests`);
    
    const queue = [...this.retryQueue];
    this.retryQueue = [];
    
    for (const request of queue) {
      try {
        if (request.handler) {
          await request.handler();
        }
      } catch (error) {
        logger.error('Failed to retry request:', error);
        
        // Re-queue if under retry limit
        if (request.attempts < 3) {
          request.attempts++;
          this.retryQueue.push(request);
        }
      }
    }
  }

  /**
   * Get network recommendations for optimization
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    
    switch (this.quality) {
      case 'poor':
        recommendations.push(
          'Reduce image quality',
          'Disable auto-play videos',
          'Minimize background sync',
          'Use text-only mode if available'
        );
        break;
      case 'slow':
        recommendations.push(
          'Compress images',
          'Limit concurrent downloads',
          'Reduce video quality'
        );
        break;
      case 'moderate':
        recommendations.push(
          'Standard quality for media',
          'Normal sync frequency'
        );
        break;
      case 'good':
        recommendations.push(
          'High quality media enabled',
          'Real-time features available',
          'Background sync enabled'
        );
        break;
    }
    
    if (this.connection?.saveData) {
      recommendations.push('Data saver mode detected - optimize accordingly');
    }
    
    return recommendations;
  }

  /**
   * Get current network status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      quality: this.quality,
      connection: this.connection ? {
        effectiveType: this.connection.effectiveType,
        downlink: this.connection.downlink,
        rtt: this.connection.rtt,
        saveData: this.connection.saveData,
        type: this.connection.type
      } : null,
      lastSpeedTest: this.lastSpeedTest,
      retryQueueLength: this.retryQueue.length,
      recommendations: this.getOptimizationRecommendations()
    };
  }

  /**
   * Subscribe to network events
   */
  on(event, callback) {
    this.eventBus.on(event, callback);
  }

  /**
   * Unsubscribe from network events
   */
  off(event, callback) {
    this.eventBus.off(event, callback);
  }

  /**
   * Check if feature should be enabled based on network quality
   */
  shouldEnableFeature(feature) {
    const featureRequirements = {
      'high-quality-video': ['good'],
      'auto-play-video': ['good', 'moderate'],
      'background-sync': ['good', 'moderate', 'slow'],
      'real-time-features': ['good', 'moderate'],
      'file-upload': ['good', 'moderate', 'slow'],
      'voice-calls': ['good', 'moderate'],
      'video-calls': ['good']
    };
    
    const requirements = featureRequirements[feature];
    return requirements ? requirements.includes(this.quality) : true;
  }

  /**
   * Get recommended settings for current network
   */
  getRecommendedSettings() {
    const settings = {
      imageQuality: 'medium',
      videoQuality: 'medium',
      autoPlayVideo: false,
      backgroundSync: true,
      realTimeUpdates: true,
      preloadContent: false
    };
    
    switch (this.quality) {
      case 'good':
        settings.imageQuality = 'high';
        settings.videoQuality = 'high';
        settings.autoPlayVideo = true;
        settings.preloadContent = true;
        break;
      case 'moderate':
        settings.imageQuality = 'medium';
        settings.videoQuality = 'medium';
        settings.autoPlayVideo = true;
        break;
      case 'slow':
        settings.imageQuality = 'low';
        settings.videoQuality = 'low';
        settings.realTimeUpdates = false;
        break;
      case 'poor':
        settings.imageQuality = 'low';
        settings.videoQuality = 'low';
        settings.backgroundSync = false;
        settings.realTimeUpdates = false;
        break;
    }
    
    return settings;
  }

  /**
   * Destroy network manager
   */
  destroy() {
    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.speedTestInterval) {
      clearInterval(this.speedTestInterval);
    }
    
    // Clear retry queue
    this.retryQueue = [];
    
    // Remove event listeners
    this.eventBus.removeAllListeners();
    
    this.initialized = false;
  }
}

// Create and export singleton instance
export const networkManager = new NetworkManager();

// Export class for testing
export { NetworkManager };
