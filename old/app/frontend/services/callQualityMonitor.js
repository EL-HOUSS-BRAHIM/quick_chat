/**
 * Call Quality Monitor - Advanced WebRTC Quality Monitoring
 * Monitors call quality metrics, connection status, and provides
 * real-time feedback and automatic optimization suggestions
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';
import { configManager } from '../utils/configManager.js';

class CallQualityMonitor {
  constructor() {
    this.eventBus = new EventBus();
    this.isMonitoring = false;
    this.connections = new Map();
    this.qualityHistory = new Map();
    this.alerts = new Map();
    
    this.thresholds = {
      excellent: { score: 4.5, rating: 'excellent' },
      good: { score: 3.5, rating: 'good' },
      fair: { score: 2.5, rating: 'fair' },
      poor: { score: 1.5, rating: 'poor' },
      bad: { score: 0, rating: 'bad' }
    };

    this.metrics = {
      video: {
        resolution: { width: 0, height: 0 },
        frameRate: 0,
        bitrate: 0,
        packetsLost: 0,
        packetsSent: 0,
        packetsReceived: 0,
        jitter: 0,
        roundTripTime: 0,
        codecName: '',
        qualityLimitationReason: ''
      },
      audio: {
        bitrate: 0,
        packetsLost: 0,
        packetsSent: 0,
        packetsReceived: 0,
        jitter: 0,
        roundTripTime: 0,
        codecName: '',
        audioLevel: 0,
        echoReturnLoss: 0
      },
      connection: {
        state: 'new',
        type: 'unknown',
        localCandidate: null,
        remoteCandidate: null,
        availableOutgoingBitrate: 0,
        availableIncomingBitrate: 0,
        currentRoundTripTime: 0
      }
    };

    this.monitoringInterval = null;
    this.reportingInterval = null;

    this.init();
  }

  /**
   * Initialize call quality monitor
   */
  async init() {
    try {
      logger.info('Initializing Call Quality Monitor...');

      // Load configuration
      this.loadConfiguration();

      // Setup event listeners
      this.setupEventListeners();

      logger.info('Call Quality Monitor initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Call Quality Monitor:', error);
      throw error;
    }
  }

  /**
   * Start monitoring a WebRTC connection
   */
  startMonitoring(connectionId, peerConnection) {
    try {
      if (this.connections.has(connectionId)) {
        this.stopMonitoring(connectionId);
      }

      logger.info(`Starting quality monitoring for connection: ${connectionId}`);

      // Store connection reference
      this.connections.set(connectionId, {
        id: connectionId,
        peerConnection,
        startTime: Date.now(),
        lastStatsTime: 0,
        previousStats: new Map(),
        qualityScore: 0,
        issues: [],
        status: 'monitoring'
      });

      // Initialize quality history
      this.qualityHistory.set(connectionId, {
        scores: [],
        videoMetrics: [],
        audioMetrics: [],
        connectionMetrics: [],
        alerts: []
      });

      // Start monitoring if not already started
      if (!this.isMonitoring) {
        this.startPeriodicMonitoring();
      }

      this.eventBus.emit('quality:monitoring-started', { connectionId });

    } catch (error) {
      logger.error('Failed to start quality monitoring:', error);
    }
  }

  /**
   * Stop monitoring a connection
   */
  stopMonitoring(connectionId) {
    try {
      if (!this.connections.has(connectionId)) {
        return;
      }

      logger.info(`Stopping quality monitoring for connection: ${connectionId}`);

      // Remove connection
      this.connections.delete(connectionId);

      // Generate final report
      this.generateQualityReport(connectionId);

      // Stop periodic monitoring if no more connections
      if (this.connections.size === 0) {
        this.stopPeriodicMonitoring();
      }

      this.eventBus.emit('quality:monitoring-stopped', { connectionId });

    } catch (error) {
      logger.error('Failed to stop quality monitoring:', error);
    }
  }

  /**
   * Start periodic monitoring for all connections
   */
  startPeriodicMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Monitor every 2 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitorAllConnections();
    }, 2000);

    // Generate reports every 30 seconds
    this.reportingInterval = setInterval(() => {
      this.generatePeriodicReports();
    }, 30000);

    logger.info('Periodic quality monitoring started');
  }

  /**
   * Stop periodic monitoring
   */
  stopPeriodicMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    logger.info('Periodic quality monitoring stopped');
  }

  /**
   * Monitor all active connections
   */
  async monitorAllConnections() {
    const promises = Array.from(this.connections.keys()).map(connectionId => 
      this.monitorConnection(connectionId)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Monitor a specific connection
   */
  async monitorConnection(connectionId) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.peerConnection) {
        return;
      }

      // Get current stats
      const stats = await connection.peerConnection.getStats();
      const currentTime = Date.now();

      // Process stats
      const processedStats = this.processStats(stats, connection.previousStats, currentTime - connection.lastStatsTime);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(processedStats);

      // Update connection data
      connection.lastStatsTime = currentTime;
      connection.previousStats = stats;
      connection.qualityScore = qualityScore.overall;

      // Update quality history
      this.updateQualityHistory(connectionId, processedStats, qualityScore);

      // Check for quality issues
      const issues = this.detectQualityIssues(processedStats, qualityScore);
      connection.issues = issues;

      // Handle alerts
      this.handleQualityAlerts(connectionId, qualityScore, issues);

      // Emit quality update
      this.eventBus.emit('quality:updated', {
        connectionId,
        quality: qualityScore,
        metrics: processedStats,
        issues
      });

    } catch (error) {
      logger.error(`Failed to monitor connection ${connectionId}:`, error);
    }
  }

  /**
   * Process WebRTC stats
   */
  processStats(stats, previousStats, timeDelta) {
    const processed = {
      video: { ...this.metrics.video },
      audio: { ...this.metrics.audio },
      connection: { ...this.metrics.connection },
      timestamp: Date.now()
    };

    stats.forEach((report) => {
      switch (report.type) {
        case 'outbound-rtp':
          if (report.kind === 'video') {
            this.processVideoOutboundStats(report, processed.video, previousStats, timeDelta);
          } else if (report.kind === 'audio') {
            this.processAudioOutboundStats(report, processed.audio, previousStats, timeDelta);
          }
          break;

        case 'inbound-rtp':
          if (report.kind === 'video') {
            this.processVideoInboundStats(report, processed.video, previousStats, timeDelta);
          } else if (report.kind === 'audio') {
            this.processAudioInboundStats(report, processed.audio, previousStats, timeDelta);
          }
          break;

        case 'candidate-pair':
          if (report.state === 'succeeded') {
            this.processConnectionStats(report, processed.connection);
          }
          break;

        case 'media-source':
          if (report.kind === 'video') {
            processed.video.frameRate = report.framesPerSecond || 0;
            processed.video.resolution.width = report.width || 0;
            processed.video.resolution.height = report.height || 0;
          } else if (report.kind === 'audio') {
            processed.audio.audioLevel = report.audioLevel || 0;
          }
          break;
      }
    });

    return processed;
  }

  /**
   * Process video outbound stats
   */
  processVideoOutboundStats(report, videoMetrics, previousStats, timeDelta) {
    videoMetrics.packetsSent = report.packetsSent || 0;
    videoMetrics.codecName = report.codecId || '';
    videoMetrics.qualityLimitationReason = report.qualityLimitationReason || '';

    // Calculate bitrate
    if (previousStats && timeDelta > 0) {
      const prevReport = Array.from(previousStats.values()).find(r => 
        r.type === 'outbound-rtp' && r.kind === 'video' && r.ssrc === report.ssrc
      );
      
      if (prevReport) {
        const bytesSentDelta = (report.bytesSent || 0) - (prevReport.bytesSent || 0);
        videoMetrics.bitrate = Math.round((bytesSentDelta * 8) / (timeDelta / 1000));
      }
    }
  }

  /**
   * Process video inbound stats
   */
  processVideoInboundStats(report, videoMetrics, previousStats, timeDelta) {
    videoMetrics.packetsReceived = report.packetsReceived || 0;
    videoMetrics.packetsLost = report.packetsLost || 0;
    videoMetrics.jitter = report.jitter || 0;
    videoMetrics.frameRate = report.framesPerSecond || 0;

    // Calculate packet loss percentage
    if (videoMetrics.packetsReceived > 0) {
      videoMetrics.packetLossPercentage = 
        (videoMetrics.packetsLost / (videoMetrics.packetsReceived + videoMetrics.packetsLost)) * 100;
    }
  }

  /**
   * Process audio outbound stats
   */
  processAudioOutboundStats(report, audioMetrics, previousStats, timeDelta) {
    audioMetrics.packetsSent = report.packetsSent || 0;
    audioMetrics.codecName = report.codecId || '';

    // Calculate bitrate
    if (previousStats && timeDelta > 0) {
      const prevReport = Array.from(previousStats.values()).find(r => 
        r.type === 'outbound-rtp' && r.kind === 'audio' && r.ssrc === report.ssrc
      );
      
      if (prevReport) {
        const bytesSentDelta = (report.bytesSent || 0) - (prevReport.bytesSent || 0);
        audioMetrics.bitrate = Math.round((bytesSentDelta * 8) / (timeDelta / 1000));
      }
    }
  }

  /**
   * Process audio inbound stats
   */
  processAudioInboundStats(report, audioMetrics, previousStats, timeDelta) {
    audioMetrics.packetsReceived = report.packetsReceived || 0;
    audioMetrics.packetsLost = report.packetsLost || 0;
    audioMetrics.jitter = report.jitter || 0;

    // Calculate packet loss percentage
    if (audioMetrics.packetsReceived > 0) {
      audioMetrics.packetLossPercentage = 
        (audioMetrics.packetsLost / (audioMetrics.packetsReceived + audioMetrics.packetsLost)) * 100;
    }
  }

  /**
   * Process connection stats
   */
  processConnectionStats(report, connectionMetrics) {
    connectionMetrics.state = report.state || 'unknown';
    connectionMetrics.currentRoundTripTime = report.currentRoundTripTime * 1000 || 0; // Convert to ms
    connectionMetrics.availableOutgoingBitrate = report.availableOutgoingBitrate || 0;
    connectionMetrics.availableIncomingBitrate = report.availableIncomingBitrate || 0;
  }

  /**
   * Calculate overall quality score
   */
  calculateQualityScore(metrics) {
    const scores = {
      video: this.calculateVideoQualityScore(metrics.video),
      audio: this.calculateAudioQualityScore(metrics.audio),
      connection: this.calculateConnectionQualityScore(metrics.connection)
    };

    // Weighted average (video: 40%, audio: 40%, connection: 20%)
    const overall = (scores.video * 0.4) + (scores.audio * 0.4) + (scores.connection * 0.2);

    return {
      overall: Math.round(overall * 100) / 100,
      video: scores.video,
      audio: scores.audio,
      connection: scores.connection,
      rating: this.getQualityRating(overall)
    };
  }

  /**
   * Calculate video quality score
   */
  calculateVideoQualityScore(videoMetrics) {
    let score = 5.0;

    // Packet loss impact
    const packetLoss = videoMetrics.packetLossPercentage || 0;
    if (packetLoss > 0) {
      score -= Math.min(packetLoss * 0.1, 2.0);
    }

    // Frame rate impact
    if (videoMetrics.frameRate < 15) {
      score -= 1.0;
    } else if (videoMetrics.frameRate < 24) {
      score -= 0.5;
    }

    // Resolution impact
    const pixelCount = videoMetrics.resolution.width * videoMetrics.resolution.height;
    if (pixelCount < 480 * 360) {
      score -= 1.0;
    } else if (pixelCount < 720 * 480) {
      score -= 0.5;
    }

    // Quality limitation impact
    if (videoMetrics.qualityLimitationReason === 'bandwidth') {
      score -= 0.5;
    } else if (videoMetrics.qualityLimitationReason === 'cpu') {
      score -= 0.3;
    }

    return Math.max(0, Math.min(5, score));
  }

  /**
   * Calculate audio quality score
   */
  calculateAudioQualityScore(audioMetrics) {
    let score = 5.0;

    // Packet loss impact
    const packetLoss = audioMetrics.packetLossPercentage || 0;
    if (packetLoss > 0) {
      score -= Math.min(packetLoss * 0.15, 2.5);
    }

    // Jitter impact
    if (audioMetrics.jitter > 0.1) {
      score -= 1.0;
    } else if (audioMetrics.jitter > 0.05) {
      score -= 0.5;
    }

    // Bitrate impact
    if (audioMetrics.bitrate < 32000) {
      score -= 0.5;
    }

    return Math.max(0, Math.min(5, score));
  }

  /**
   * Calculate connection quality score
   */
  calculateConnectionQualityScore(connectionMetrics) {
    let score = 5.0;

    // Round trip time impact
    const rtt = connectionMetrics.currentRoundTripTime;
    if (rtt > 300) {
      score -= 2.0;
    } else if (rtt > 150) {
      score -= 1.0;
    } else if (rtt > 100) {
      score -= 0.5;
    }

    // Available bandwidth impact
    const outgoingBw = connectionMetrics.availableOutgoingBitrate;
    if (outgoingBw > 0 && outgoingBw < 500000) { // Less than 500kbps
      score -= 1.0;
    }

    return Math.max(0, Math.min(5, score));
  }

  /**
   * Get quality rating from score
   */
  getQualityRating(score) {
    if (score >= this.thresholds.excellent.score) return 'excellent';
    if (score >= this.thresholds.good.score) return 'good';
    if (score >= this.thresholds.fair.score) return 'fair';
    if (score >= this.thresholds.poor.score) return 'poor';
    return 'bad';
  }

  /**
   * Update quality history
   */
  updateQualityHistory(connectionId, metrics, qualityScore) {
    const history = this.qualityHistory.get(connectionId);
    if (!history) return;

    const timestamp = Date.now();

    // Add to history arrays
    history.scores.push({
      timestamp,
      ...qualityScore
    });

    history.videoMetrics.push({
      timestamp,
      ...metrics.video
    });

    history.audioMetrics.push({
      timestamp,
      ...metrics.audio
    });

    history.connectionMetrics.push({
      timestamp,
      ...metrics.connection
    });

    // Keep only last 100 entries
    const maxEntries = 100;
    if (history.scores.length > maxEntries) {
      history.scores = history.scores.slice(-maxEntries);
      history.videoMetrics = history.videoMetrics.slice(-maxEntries);
      history.audioMetrics = history.audioMetrics.slice(-maxEntries);
      history.connectionMetrics = history.connectionMetrics.slice(-maxEntries);
    }
  }

  /**
   * Detect quality issues
   */
  detectQualityIssues(metrics, qualityScore) {
    const issues = [];

    // High packet loss
    if (metrics.video.packetLossPercentage > 5) {
      issues.push({
        type: 'packet-loss',
        severity: 'high',
        message: 'High video packet loss detected',
        value: metrics.video.packetLossPercentage,
        suggestion: 'Check network connection or reduce video quality'
      });
    }

    if (metrics.audio.packetLossPercentage > 3) {
      issues.push({
        type: 'packet-loss',
        severity: 'high',
        message: 'High audio packet loss detected',
        value: metrics.audio.packetLossPercentage,
        suggestion: 'Check network connection'
      });
    }

    // High latency
    if (metrics.connection.currentRoundTripTime > 200) {
      issues.push({
        type: 'latency',
        severity: 'medium',
        message: 'High latency detected',
        value: metrics.connection.currentRoundTripTime,
        suggestion: 'Use a server closer to your location'
      });
    }

    // Low frame rate
    if (metrics.video.frameRate < 15) {
      issues.push({
        type: 'framerate',
        severity: 'medium',
        message: 'Low frame rate detected',
        value: metrics.video.frameRate,
        suggestion: 'Close other applications or reduce video quality'
      });
    }

    // Bandwidth limitations
    if (metrics.video.qualityLimitationReason === 'bandwidth') {
      issues.push({
        type: 'bandwidth',
        severity: 'medium',
        message: 'Video quality limited by bandwidth',
        suggestion: 'Close other network-intensive applications'
      });
    }

    return issues;
  }

  /**
   * Handle quality alerts
   */
  handleQualityAlerts(connectionId, qualityScore, issues) {
    const alertId = `${connectionId}-quality`;
    
    // Check if we should create an alert
    if (qualityScore.rating === 'poor' || qualityScore.rating === 'bad') {
      if (!this.alerts.has(alertId)) {
        const alert = {
          id: alertId,
          connectionId,
          type: 'quality-degraded',
          severity: qualityScore.rating === 'bad' ? 'high' : 'medium',
          message: `Call quality is ${qualityScore.rating}`,
          timestamp: Date.now(),
          issues
        };

        this.alerts.set(alertId, alert);
        this.eventBus.emit('quality:alert', alert);
      }
    } else {
      // Remove alert if quality improved
      if (this.alerts.has(alertId)) {
        this.alerts.delete(alertId);
        this.eventBus.emit('quality:alert-resolved', { id: alertId });
      }
    }
  }

  /**
   * Generate periodic reports
   */
  generatePeriodicReports() {
    this.connections.forEach((connection, connectionId) => {
      this.generateQualityReport(connectionId);
    });
  }

  /**
   * Generate quality report
   */
  generateQualityReport(connectionId) {
    const history = this.qualityHistory.get(connectionId);
    if (!history || history.scores.length === 0) {
      return null;
    }

    const scores = history.scores;
    const report = {
      connectionId,
      timestamp: Date.now(),
      duration: scores.length > 0 ? scores[scores.length - 1].timestamp - scores[0].timestamp : 0,
      averageQuality: this.calculateAverageQuality(scores),
      qualityTrend: this.calculateQualityTrend(scores),
      issues: this.summarizeIssues(history),
      recommendations: this.generateRecommendations(history)
    };

    this.eventBus.emit('quality:report', report);
    return report;
  }

  /**
   * Calculate average quality from scores
   */
  calculateAverageQuality(scores) {
    if (scores.length === 0) return 0;

    const sum = scores.reduce((total, score) => total + score.overall, 0);
    return sum / scores.length;
  }

  /**
   * Calculate quality trend
   */
  calculateQualityTrend(scores) {
    if (scores.length < 2) return 'stable';

    const recent = scores.slice(-10); // Last 10 measurements
    const early = scores.slice(0, 10); // First 10 measurements

    const recentAvg = recent.reduce((sum, s) => sum + s.overall, 0) / recent.length;
    const earlyAvg = early.reduce((sum, s) => sum + s.overall, 0) / early.length;

    const diff = recentAvg - earlyAvg;
    
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'degrading';
    return 'stable';
  }

  /**
   * Summarize issues from history
   */
  summarizeIssues(history) {
    const issueCounts = {};
    
    // Count issues from alerts
    history.alerts.forEach(alert => {
      alert.issues.forEach(issue => {
        if (!issueCounts[issue.type]) {
          issueCounts[issue.type] = 0;
        }
        issueCounts[issue.type]++;
      });
    });

    return issueCounts;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(history) {
    const recommendations = [];
    const latestMetrics = history.videoMetrics[history.videoMetrics.length - 1];
    const latestAudio = history.audioMetrics[history.audioMetrics.length - 1];
    
    if (!latestMetrics || !latestAudio) return recommendations;

    // Video recommendations
    if (latestMetrics.packetLossPercentage > 3) {
      recommendations.push({
        type: 'network',
        message: 'Consider switching to a wired connection for better stability'
      });
    }

    if (latestMetrics.frameRate < 20) {
      recommendations.push({
        type: 'performance',
        message: 'Close other applications to improve video performance'
      });
    }

    // Audio recommendations
    if (latestAudio.packetLossPercentage > 2) {
      recommendations.push({
        type: 'audio',
        message: 'Check your microphone and audio settings'
      });
    }

    return recommendations;
  }

  /**
   * Load configuration
   */
  loadConfiguration() {
    const config = configManager.get('callQuality', {});
    
    if (config.thresholds) {
      this.thresholds = { ...this.thresholds, ...config.thresholds };
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for configuration changes
    configManager.eventBus.on('config:updated', (changes) => {
      if (changes.callQuality) {
        this.loadConfiguration();
      }
    });
  }

  /**
   * Get current quality data
   */
  getQualityData(connectionId) {
    if (connectionId) {
      return {
        connection: this.connections.get(connectionId),
        history: this.qualityHistory.get(connectionId),
        alerts: Array.from(this.alerts.values()).filter(alert => 
          alert.connectionId === connectionId
        )
      };
    }

    return {
      connections: Object.fromEntries(this.connections),
      history: Object.fromEntries(this.qualityHistory),
      alerts: Array.from(this.alerts.values()),
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Clear quality data
   */
  clearData(connectionId = null) {
    if (connectionId) {
      this.qualityHistory.delete(connectionId);
      
      // Remove alerts for this connection
      const alertsToRemove = [];
      this.alerts.forEach((alert, id) => {
        if (alert.connectionId === connectionId) {
          alertsToRemove.push(id);
        }
      });
      alertsToRemove.forEach(id => this.alerts.delete(id));
      
    } else {
      this.qualityHistory.clear();
      this.alerts.clear();
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    logger.info('Destroying Call Quality Monitor...');

    this.stopPeriodicMonitoring();
    this.connections.clear();
    this.qualityHistory.clear();
    this.alerts.clear();

    this.eventBus.emit('quality:destroyed');
  }
}

// Create and export singleton instance
export const callQualityMonitor = new CallQualityMonitor();
export default callQualityMonitor;
