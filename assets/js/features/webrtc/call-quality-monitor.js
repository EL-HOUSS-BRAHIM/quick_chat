/**
 * Enhanced Call Quality Monitor
 * Monitors call quality metrics and provides adaptive quality adjustments
 * Progress: 65% complete (improving call quality monitoring)
 */

class CallQualityMonitor {
  constructor(peerConnection, config = {}) {
    this.peerConnection = peerConnection;
    this.config = {
      reportInterval: config.reportInterval || 5000,
      thresholds: config.thresholds || {
        rtt: 300,
        packetLoss: 0.05,
        jitter: 50,
        bandwidthMin: 50000,
        audioLevel: -50
      },
      adaptiveQuality: config.adaptiveQuality !== undefined ? config.adaptiveQuality : true,
      networkAdaptation: config.networkAdaptation !== undefined ? config.networkAdaptation : true
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.previousStats = null;
    this.qualityHistory = [];
    this.currentQuality = 'good';
    this.adaptationLevel = 0; // 0 = no adaptation, higher = more aggressive
    
    // Quality metrics
    this.metrics = {
      rtt: 0,
      packetLoss: 0,
      jitter: 0,
      bandwidth: 0,
      audioLevel: 0,
      videoFrameRate: 0,
      videoResolution: { width: 0, height: 0 },
      bitrate: { audio: 0, video: 0 },
      networkType: 'unknown'
    };
    
    // Adaptation strategies
    this.adaptationStrategies = {
      'excellent': { videoBitrate: 1000000, audioCodec: 'opus', videoCodec: 'vp9' },
      'good': { videoBitrate: 500000, audioCodec: 'opus', videoCodec: 'vp8' },
      'fair': { videoBitrate: 200000, audioCodec: 'opus', videoCodec: 'vp8' },
      'poor': { videoBitrate: 100000, audioCodec: 'pcmu', videoCodec: 'vp8' },
      'very_poor': { videoBitrate: 50000, audioCodec: 'pcmu', videoCodec: 'vp8', disableVideo: true }
    };
    
    // Bind methods
    this.collectStats = this.collectStats.bind(this);
    this.analyzeQuality = this.analyzeQuality.bind(this);
    this.adaptQuality = this.adaptQuality.bind(this);
  }

  /**
   * Start monitoring call quality
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    console.log('Starting call quality monitoring');
    this.isMonitoring = true;
    
    // Collect initial stats
    this.collectStats();
    
    // Set up periodic monitoring
    this.monitoringInterval = setInterval(this.collectStats, this.config.reportInterval);
    
    // Monitor network changes
    this.setupNetworkMonitoring();
    
    // Dispatch monitoring start event
    document.dispatchEvent(new CustomEvent('quickchat:callquality:started'));
  }

  /**
   * Stop monitoring call quality
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    console.log('Stopping call quality monitoring');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Dispatch monitoring stop event
    document.dispatchEvent(new CustomEvent('quickchat:callquality:stopped'));
  }

  /**
   * Collect WebRTC statistics
   */
  async collectStats() {
    if (!this.peerConnection) return;
    
    try {
      const stats = await this.peerConnection.getStats();
      const currentStats = this.parseStats(stats);
      
      // Calculate metrics
      this.calculateMetrics(currentStats);
      
      // Analyze quality
      const qualityScore = this.analyzeQuality();
      
      // Adapt quality if needed
      if (this.config.adaptiveQuality) {
        this.adaptQuality(qualityScore);
      }
      
      // Store previous stats for next calculation
      this.previousStats = currentStats;
      
      // Dispatch stats event
      document.dispatchEvent(new CustomEvent('quickchat:callquality:stats', {
        detail: {
          metrics: this.metrics,
          quality: this.currentQuality,
          qualityScore: qualityScore
        }
      }));
      
    } catch (error) {
      console.error('Error collecting WebRTC stats:', error);
    }
  }

  /**
   * Parse WebRTC statistics
   */
  parseStats(stats) {
    const parsedStats = {
      audio: { inbound: null, outbound: null },
      video: { inbound: null, outbound: null },
      connection: null,
      transport: null
    };
    
    stats.forEach(stat => {
      switch (stat.type) {
        case 'inbound-rtp':
          if (stat.mediaType === 'audio') {
            parsedStats.audio.inbound = stat;
          } else if (stat.mediaType === 'video') {
            parsedStats.video.inbound = stat;
          }
          break;
          
        case 'outbound-rtp':
          if (stat.mediaType === 'audio') {
            parsedStats.audio.outbound = stat;
          } else if (stat.mediaType === 'video') {
            parsedStats.video.outbound = stat;
          }
          break;
          
        case 'candidate-pair':
          if (stat.state === 'succeeded') {
            parsedStats.connection = stat;
          }
          break;
          
        case 'transport':
          parsedStats.transport = stat;
          break;
      }
    });
    
    return parsedStats;
  }

  /**
   * Calculate quality metrics
   */
  calculateMetrics(currentStats) {
    if (!this.previousStats) return;
    
    // Calculate RTT (Round Trip Time)
    if (currentStats.connection && currentStats.connection.currentRoundTripTime) {
      this.metrics.rtt = currentStats.connection.currentRoundTripTime * 1000; // Convert to ms
    }
    
    // Calculate packet loss
    this.calculatePacketLoss(currentStats);
    
    // Calculate jitter
    this.calculateJitter(currentStats);
    
    // Calculate bandwidth
    this.calculateBandwidth(currentStats);
    
    // Calculate audio level
    this.calculateAudioLevel(currentStats);
    
    // Calculate video metrics
    this.calculateVideoMetrics(currentStats);
    
    // Detect network type
    this.detectNetworkType();
  }

  /**
   * Calculate packet loss percentage
   */
  calculatePacketLoss(currentStats) {
    const audioInbound = currentStats.audio.inbound;
    const videoInbound = currentStats.video.inbound;
    const prevAudioInbound = this.previousStats.audio.inbound;
    const prevVideoInbound = this.previousStats.video.inbound;
    
    let totalPacketsLost = 0;
    let totalPacketsReceived = 0;
    
    if (audioInbound && prevAudioInbound) {
      const packetsLostDiff = (audioInbound.packetsLost || 0) - (prevAudioInbound.packetsLost || 0);
      const packetsReceivedDiff = (audioInbound.packetsReceived || 0) - (prevAudioInbound.packetsReceived || 0);
      totalPacketsLost += packetsLostDiff;
      totalPacketsReceived += packetsReceivedDiff;
    }
    
    if (videoInbound && prevVideoInbound) {
      const packetsLostDiff = (videoInbound.packetsLost || 0) - (prevVideoInbound.packetsLost || 0);
      const packetsReceivedDiff = (videoInbound.packetsReceived || 0) - (prevVideoInbound.packetsReceived || 0);
      totalPacketsLost += packetsLostDiff;
      totalPacketsReceived += packetsReceivedDiff;
    }
    
    if (totalPacketsReceived > 0) {
      this.metrics.packetLoss = totalPacketsLost / (totalPacketsLost + totalPacketsReceived);
    }
  }

  /**
   * Calculate jitter
   */
  calculateJitter(currentStats) {
    const audioInbound = currentStats.audio.inbound;
    if (audioInbound && audioInbound.jitter) {
      this.metrics.jitter = audioInbound.jitter * 1000; // Convert to ms
    }
  }

  /**
   * Calculate bandwidth
   */
  calculateBandwidth(currentStats) {
    const timeDiff = Date.now() - (this.previousStats.timestamp || Date.now());
    if (timeDiff === 0) return;
    
    let totalBytesReceived = 0;
    let totalBytesSent = 0;
    
    // Audio bandwidth
    if (currentStats.audio.inbound && this.previousStats.audio.inbound) {
      const bytesDiff = (currentStats.audio.inbound.bytesReceived || 0) - 
                       (this.previousStats.audio.inbound.bytesReceived || 0);
      totalBytesReceived += bytesDiff;
      this.metrics.bitrate.audio = (bytesDiff * 8) / (timeDiff / 1000); // bps
    }
    
    // Video bandwidth
    if (currentStats.video.inbound && this.previousStats.video.inbound) {
      const bytesDiff = (currentStats.video.inbound.bytesReceived || 0) - 
                       (this.previousStats.video.inbound.bytesReceived || 0);
      totalBytesReceived += bytesDiff;
      this.metrics.bitrate.video = (bytesDiff * 8) / (timeDiff / 1000); // bps
    }
    
    this.metrics.bandwidth = (totalBytesReceived * 8) / (timeDiff / 1000); // bps
  }

  /**
   * Calculate audio level
   */
  calculateAudioLevel(currentStats) {
    const audioInbound = currentStats.audio.inbound;
    if (audioInbound && audioInbound.audioLevel) {
      this.metrics.audioLevel = 20 * Math.log10(audioInbound.audioLevel); // Convert to dB
    }
  }

  /**
   * Calculate video metrics
   */
  calculateVideoMetrics(currentStats) {
    const videoInbound = currentStats.video.inbound;
    if (videoInbound) {
      if (videoInbound.framesPerSecond) {
        this.metrics.videoFrameRate = videoInbound.framesPerSecond;
      }
      
      if (videoInbound.frameWidth && videoInbound.frameHeight) {
        this.metrics.videoResolution = {
          width: videoInbound.frameWidth,
          height: videoInbound.frameHeight
        };
      }
    }
  }

  /**
   * Detect network type
   */
  detectNetworkType() {
    if ('connection' in navigator && navigator.connection) {
      this.metrics.networkType = navigator.connection.effectiveType || 'unknown';
    }
  }

  /**
   * Analyze overall call quality
   */
  analyzeQuality() {
    let score = 100; // Start with perfect score
    
    // RTT impact
    if (this.metrics.rtt > this.config.thresholds.rtt) {
      score -= Math.min(30, (this.metrics.rtt - this.config.thresholds.rtt) / 10);
    }
    
    // Packet loss impact
    if (this.metrics.packetLoss > this.config.thresholds.packetLoss) {
      score -= Math.min(40, (this.metrics.packetLoss - this.config.thresholds.packetLoss) * 800);
    }
    
    // Jitter impact
    if (this.metrics.jitter > this.config.thresholds.jitter) {
      score -= Math.min(20, (this.metrics.jitter - this.config.thresholds.jitter) / 5);
    }
    
    // Bandwidth impact
    if (this.metrics.bandwidth < this.config.thresholds.bandwidthMin) {
      score -= Math.min(25, (this.config.thresholds.bandwidthMin - this.metrics.bandwidth) / 2000);
    }
    
    // Audio level impact
    if (this.metrics.audioLevel < this.config.thresholds.audioLevel) {
      score -= Math.min(15, Math.abs(this.metrics.audioLevel - this.config.thresholds.audioLevel) / 2);
    }
    
    // Determine quality level
    if (score >= 90) {
      this.currentQuality = 'excellent';
    } else if (score >= 75) {
      this.currentQuality = 'good';
    } else if (score >= 50) {
      this.currentQuality = 'fair';
    } else if (score >= 25) {
      this.currentQuality = 'poor';
    } else {
      this.currentQuality = 'very_poor';
    }
    
    // Store in history
    this.qualityHistory.push({
      timestamp: Date.now(),
      score: score,
      quality: this.currentQuality,
      metrics: { ...this.metrics }
    });
    
    // Keep only last 10 minutes of history
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    this.qualityHistory = this.qualityHistory.filter(h => h.timestamp > tenMinutesAgo);
    
    return score;
  }

  /**
   * Adapt call quality based on current conditions
   */
  adaptQuality(qualityScore) {
    if (!this.config.networkAdaptation) return;
    
    const strategy = this.adaptationStrategies[this.currentQuality];
    if (!strategy) return;
    
    // Check if adaptation is needed
    const needsAdaptation = this.shouldAdapt(qualityScore);
    if (!needsAdaptation) return;
    
    console.log(`Adapting call quality to ${this.currentQuality} level`);
    
    // Apply video bitrate adaptation
    this.adaptVideoBitrate(strategy.videoBitrate);
    
    // Apply codec preferences
    this.adaptCodecPreferences(strategy);
    
    // Disable video if necessary
    if (strategy.disableVideo) {
      this.disableVideo();
    }
    
    // Update adaptation level
    this.adaptationLevel = Math.min(5, this.adaptationLevel + 1);
    
    // Dispatch adaptation event
    document.dispatchEvent(new CustomEvent('quickchat:callquality:adapted', {
      detail: {
        quality: this.currentQuality,
        strategy: strategy,
        adaptationLevel: this.adaptationLevel
      }
    }));
  }

  /**
   * Check if quality adaptation is needed
   */
  shouldAdapt(qualityScore) {
    // Don't adapt too frequently
    const lastAdaptation = this.qualityHistory
      .slice(-3)
      .find(h => h.adapted);
    
    if (lastAdaptation && (Date.now() - lastAdaptation.timestamp) < 30000) {
      return false; // Wait at least 30 seconds between adaptations
    }
    
    // Check if quality has been consistently poor
    const recentHistory = this.qualityHistory.slice(-3);
    if (recentHistory.length < 3) return false;
    
    const averageScore = recentHistory.reduce((sum, h) => sum + h.score, 0) / recentHistory.length;
    return averageScore < 60; // Adapt if average score is below 60
  }

  /**
   * Adapt video bitrate
   */
  adaptVideoBitrate(targetBitrate) {
    const sender = this.findVideoSender();
    if (!sender) return;
    
    const params = sender.getParameters();
    if (params.encodings && params.encodings.length > 0) {
      params.encodings[0].maxBitrate = targetBitrate;
      sender.setParameters(params);
    }
  }

  /**
   * Find video sender
   */
  findVideoSender() {
    const senders = this.peerConnection.getSenders();
    return senders.find(sender => 
      sender.track && sender.track.kind === 'video'
    );
  }

  /**
   * Adapt codec preferences
   */
  adaptCodecPreferences(strategy) {
    // This would require renegotiation in most cases
    // For now, we'll just log the preference
    console.log('Preferred codecs:', strategy.audioCodec, strategy.videoCodec);
  }

  /**
   * Disable video track
   */
  disableVideo() {
    const sender = this.findVideoSender();
    if (sender && sender.track) {
      sender.track.enabled = false;
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    if ('connection' in navigator && navigator.connection) {
      navigator.connection.addEventListener('change', () => {
        console.log('Network connection changed:', navigator.connection.effectiveType);
        this.collectStats(); // Collect stats immediately on network change
      });
    }
  }

  /**
   * Get quality report
   */
  getQualityReport() {
    return {
      currentQuality: this.currentQuality,
      metrics: this.metrics,
      history: this.qualityHistory.slice(-10), // Last 10 measurements
      adaptationLevel: this.adaptationLevel,
      recommendations: this.getRecommendations()
    };
  }

  /**
   * Get quality improvement recommendations
   */
  getRecommendations() {
    const recommendations = [];
    
    if (this.metrics.rtt > this.config.thresholds.rtt) {
      recommendations.push('High latency detected. Consider switching to a closer server.');
    }
    
    if (this.metrics.packetLoss > this.config.thresholds.packetLoss) {
      recommendations.push('Packet loss detected. Check your network connection.');
    }
    
    if (this.metrics.bandwidth < this.config.thresholds.bandwidthMin) {
      recommendations.push('Low bandwidth detected. Consider reducing video quality.');
    }
    
    if (this.metrics.audioLevel < this.config.thresholds.audioLevel) {
      recommendations.push('Low audio level detected. Check your microphone settings.');
    }
    
    return recommendations;
  }

  /**
   * Cleanup method
   */
  destroy() {
    this.stopMonitoring();
    this.qualityHistory = [];
    this.previousStats = null;
  }
}

export default CallQualityMonitor;
