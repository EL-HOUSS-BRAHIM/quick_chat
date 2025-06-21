/**
 * WebRTC Connection Monitor
 * Monitors connection quality for WebRTC calls
 * Enhanced with dynamic media adaptation for different network conditions
 */

import eventBus from '../../core/event-bus.js';
import { state } from '../../core/state.js';

class ConnectionMonitor {
  constructor(options = {}) {
    this.config = {
      monitorInterval: 2000, // 2 seconds
      statsHistorySize: 10,
      bitrateThresholds: {
        audio: {
          low: 10000,   // 10 kbps
          medium: 30000  // 30 kbps
        },
        video: {
          low: 100000,   // 100 kbps
          medium: 500000, // 500 kbps
          high: 1500000   // 1.5 Mbps
        }
      },
      packetLossThresholds: {
        good: 0.02,     // 2%
        medium: 0.05,   // 5%
        poor: 0.10      // 10%
      },
      adaptiveSettings: {
        enabled: true,
        probeInterval: 15000, // 15 seconds between network probes
        recoveryInterval: 30000, // 30 seconds before trying to restore quality
        maxDowngrades: 3 // Maximum number of quality downgrade steps
      },
      ...options
    };
    
    this.monitors = new Map(); // userId -> monitor data
    this.qualityHistory = new Map(); // userId -> quality history
    this.mediaAdaptationState = new Map(); // userId -> adaptation state
    this.networkTrends = new Map(); // userId -> network trend analysis
  }
  
  /**
   * Start monitoring connection quality for a peer
   */
  startMonitoring(userId, peerConnection) {
    if (this.monitors.has(userId)) {
      this.stopMonitoring(userId);
    }
    
    const monitor = {
      peerConnection,
      intervalId: null,
      stats: {
        audio: {
          bitrate: 0,
          packetLoss: 0,
          jitter: 0,
          timestamp: 0
        },
        video: {
          bitrate: 0,
          packetLoss: 0,
          framerate: 0,
          timestamp: 0
        },
        connection: {
          rtt: 0,
          timestamp: 0,
          networkType: null,
          effectiveBandwidth: 0
        },
        lastStats: null
      }
    };
    
    // Initialize quality history
    this.qualityHistory.set(userId, {
      overall: [],
      audio: [],
      video: []
    });
    
    // Initialize media adaptation state
    this.mediaAdaptationState.set(userId, {
      currentVideoQuality: 'high',
      currentAudioQuality: 'high',
      downgradeCount: 0,
      lastAdaptationTime: Date.now(),
      lastUpgradeAttempt: Date.now(),
      adaptationLocked: false
    });
    
    // Initialize network trends
    this.networkTrends.set(userId, {
      samples: [],
      trendDirection: 'stable',
      lastProbeTime: Date.now()
    });
    
    // Start monitoring interval
    monitor.intervalId = setInterval(() => {
      this.collectStats(userId, monitor);
    }, this.config.monitorInterval);
    
    // Collect initial stats
    this.collectStats(userId, monitor);
    
    // Store monitor
    this.monitors.set(userId, monitor);
    
    console.log('Started monitoring connection with', userId);
  }
  
  /**
   * Stop monitoring connection quality for a peer
   */
  stopMonitoring(userId) {
    const monitor = this.monitors.get(userId);
    
    if (!monitor) {
      return;
    }
    
    // Clear interval
    if (monitor.intervalId) {
      clearInterval(monitor.intervalId);
    }
    
    // Remove monitor
    this.monitors.delete(userId);
    
    console.log('Stopped monitoring connection with', userId);
  }
  
  /**
   * Collect WebRTC stats
   */
  async collectStats(userId, monitor) {
    if (!monitor.peerConnection || monitor.peerConnection.connectionState === 'closed') {
      this.stopMonitoring(userId);
      return;
    }

    try {
      const stats = await monitor.peerConnection.getStats();
      const parsed = this.parseStats(stats);
      
      // Update monitor stats
      if (parsed.audio) {
        monitor.stats.audio = { ...parsed.audio };
      }
      
      if (parsed.video) {
        monitor.stats.video = { ...parsed.video };
      }
      
      if (parsed.connection) {
        monitor.stats.connection = { ...parsed.connection };
      }
      
      // Store previous stats
      monitor.stats.lastStats = stats;
      
      // Update quality history
      this.updateQualityHistory(userId, parsed);
      
      // Analyze connection quality
      const quality = this.analyzeConnectionQuality(userId);
      
      // Apply adaptive media settings if enabled
      if (this.config.adaptiveSettings.enabled) {
        this.adaptMediaQuality(userId, quality);
      }
      
      // Emit quality update event
      eventBus.emit('webrtc:quality', {
        userId,
        quality
      });
    } catch (error) {
      console.error('Error collecting WebRTC stats:', error);
    }
  }
  
  /**
   * Stop monitoring connection quality for a peer
   */
  stopMonitoring(userId) {
    const monitor = this.monitors.get(userId);
    if (monitor && monitor.intervalId) {
      clearInterval(monitor.intervalId);
      this.monitors.delete(userId);
      this.qualityHistory.delete(userId);
      this.mediaAdaptationState.delete(userId);
      this.networkTrends.delete(userId);
      
      console.log('Stopped monitoring connection with', userId);
    }
  }
  
  /**
   * Parse raw WebRTC stats data
   */
  parseStats(stats) {
    const result = {
      audio: {
        bitrate: 0,
        packetLoss: 0,
        jitter: 0,
        timestamp: Date.now()
      },
      video: {
        bitrate: 0,
        packetLoss: 0,
        framerate: 0,
        timestamp: Date.now()
      },
      connection: {
        rtt: 0,
        timestamp: Date.now(),
        networkType: this.detectNetworkType(),
        effectiveBandwidth: 0
      }
    };
    
    let audioBytesSent = 0;
    let videoByteSent = 0;
    let audioBytesReceived = 0;
    let videoBytesReceived = 0;
    let lastAudioTimestamp = 0;
    let lastVideoTimestamp = 0;
    
    stats.forEach(stat => {
      // Handle outbound RTP stats
      if (stat.type === 'outbound-rtp') {
        if (stat.mediaType === 'audio') {
          const lastStats = this.getLastOutboundStats('audio');
          
          if (lastStats && lastStats.bytesSent) {
            const timeDiff = stat.timestamp - lastStats.timestamp;
            if (timeDiff > 0) {
              const bytesDiff = stat.bytesSent - lastStats.bytesSent;
              result.audio.bitrate = (bytesDiff * 8 * 1000) / timeDiff;
            }
          }
          
          audioBytesSent = stat.bytesSent;
          lastAudioTimestamp = stat.timestamp;
        } else if (stat.mediaType === 'video') {
          const lastStats = this.getLastOutboundStats('video');
          
          if (lastStats && lastStats.bytesSent) {
            const timeDiff = stat.timestamp - lastStats.timestamp;
            if (timeDiff > 0) {
              const bytesDiff = stat.bytesSent - lastStats.bytesSent;
              result.video.bitrate = (bytesDiff * 8 * 1000) / timeDiff;
              
              if (stat.framesPerSecond) {
                result.video.framerate = stat.framesPerSecond;
              } else if (stat.framesSent && lastStats.framesSent) {
                const framesDiff = stat.framesSent - lastStats.framesSent;
                result.video.framerate = (framesDiff * 1000) / timeDiff;
              }
            }
          }
          
          videoByteSent = stat.bytesSent;
          lastVideoTimestamp = stat.timestamp;
        }
      }
      
      // Handle inbound RTP stats
      if (stat.type === 'inbound-rtp') {
        if (stat.mediaType === 'audio') {
          if (stat.jitter) {
            result.audio.jitter = stat.jitter * 1000; // Convert to ms
          }
          
          if (stat.packetsLost !== undefined && stat.packetsReceived) {
            const totalPackets = stat.packetsLost + stat.packetsReceived;
            if (totalPackets > 0) {
              result.audio.packetLoss = stat.packetsLost / totalPackets;
            }
          }
          
          audioBytesReceived = stat.bytesReceived;
        } else if (stat.mediaType === 'video') {
          if (stat.jitter) {
            result.video.jitter = stat.jitter * 1000; // Convert to ms
          }
          
          if (stat.packetsLost !== undefined && stat.packetsReceived) {
            const totalPackets = stat.packetsLost + stat.packetsReceived;
            if (totalPackets > 0) {
              result.video.packetLoss = stat.packetsLost / totalPackets;
            }
          }
          
          videoBytesReceived = stat.bytesReceived;
        }
      }
      
      // Handle remote inbound RTP stats (RTT)
      if (stat.type === 'remote-inbound-rtp') {
        if (stat.roundTripTime) {
          result.connection.rtt = stat.roundTripTime * 1000; // Convert to ms
        }
      }
      
      // Calculate effective bandwidth based on send and receive rates
      const totalBytesSent = audioBytesSent + videoByteSent;
      const totalBytesReceived = audioBytesReceived + videoBytesReceived;
      const totalBytes = totalBytesSent + totalBytesReceived;
      const timeDiff = Math.max(lastAudioTimestamp, lastVideoTimestamp) - Math.min(lastAudioTimestamp, lastVideoTimestamp);
      
      if (timeDiff > 0 && totalBytes > 0) {
        result.connection.effectiveBandwidth = (totalBytes * 8 * 1000) / timeDiff;
      }
    });
    
    return result;
  }
  
  /**
   * Get last outbound stats for a specific media type
   */
  getLastOutboundStats(mediaType) {
    // Implementation depends on how you store the previous stats
    return null; // Replace with actual implementation
  }
  
  /**
   * Update quality history for a peer
   */
  updateQualityHistory(userId, stats) {
    const history = this.qualityHistory.get(userId);
    if (!history) return;
    
    // Add new quality measurements
    history.audio.push({
      bitrate: stats.audio.bitrate,
      packetLoss: stats.audio.packetLoss,
      jitter: stats.audio.jitter,
      timestamp: stats.audio.timestamp
    });
    
    history.video.push({
      bitrate: stats.video.bitrate,
      packetLoss: stats.video.packetLoss,
      framerate: stats.video.framerate,
      timestamp: stats.video.timestamp
    });
    
    history.overall.push({
      rtt: stats.connection.rtt,
      networkType: stats.connection.networkType,
      effectiveBandwidth: stats.connection.effectiveBandwidth,
      timestamp: stats.connection.timestamp
    });
    
    // Limit history size
    if (history.audio.length > this.config.statsHistorySize) {
      history.audio.shift();
    }
    
    if (history.video.length > this.config.statsHistorySize) {
      history.video.shift();
    }
    
    if (history.overall.length > this.config.statsHistorySize) {
      history.overall.shift();
    }
  }
  
  /**
   * Analyze connection quality based on collected stats
   */
  analyzeConnectionQuality(userId) {
    const history = this.qualityHistory.get(userId);
    if (!history || history.overall.length === 0) {
      return { score: 5, label: 'unknown' }; // Middle score as default
    }
    
    // Calculate average values
    const audioStats = this.calculateAverageStats(history.audio);
    const videoStats = this.calculateAverageStats(history.video);
    const overallStats = this.calculateAverageStats(history.overall);
    
    // Calculate quality scores (0-10 scale, 10 being best)
    const audioScore = this.calculateAudioScore(audioStats);
    const videoScore = this.calculateVideoScore(videoStats);
    const connectionScore = this.calculateConnectionScore(overallStats);
    
    // Calculate overall score with weighted average
    const overallScore = (audioScore * 0.3) + (videoScore * 0.4) + (connectionScore * 0.3);
    
    // Map score to label
    let label;
    if (overallScore >= 8) {
      label = 'excellent';
    } else if (overallScore >= 6) {
      label = 'good';
    } else if (overallScore >= 4) {
      label = 'fair';
    } else if (overallScore >= 2) {
      label = 'poor';
    } else {
      label = 'critical';
    }
    
    // Update network trend analysis
    this.updateNetworkTrend(userId, overallScore);
    
    return {
      overall: {
        score: overallScore,
        label
      },
      audio: {
        score: audioScore,
        stats: audioStats
      },
      video: {
        score: videoScore,
        stats: videoStats
      },
      connection: {
        score: connectionScore,
        stats: overallStats
      },
      trend: this.networkTrends.get(userId).trendDirection
    };
  }
  
  /**
   * Calculate average stats from history
   */
  calculateAverageStats(statsHistory) {
    if (statsHistory.length === 0) return {};
    
    const result = {};
    const keys = Object.keys(statsHistory[0]).filter(key => key !== 'timestamp');
    
    for (const key of keys) {
      const sum = statsHistory.reduce((acc, stat) => acc + (stat[key] || 0), 0);
      result[key] = sum / statsHistory.length;
    }
    
    return result;
  }
  
  /**
   * Calculate audio quality score
   */
  calculateAudioScore(stats) {
    let score = 10;
    
    // Penalize for high packet loss
    if (stats.packetLoss > this.config.packetLossThresholds.poor) {
      score -= 4;
    } else if (stats.packetLoss > this.config.packetLossThresholds.medium) {
      score -= 2;
    } else if (stats.packetLoss > this.config.packetLossThresholds.good) {
      score -= 1;
    }
    
    // Penalize for high jitter
    if (stats.jitter > 50) { // 50ms is high jitter
      score -= 3;
    } else if (stats.jitter > 30) {
      score -= 2;
    } else if (stats.jitter > 15) {
      score -= 1;
    }
    
    // Penalize for low bitrate
    if (stats.bitrate < this.config.bitrateThresholds.audio.low) {
      score -= 3;
    } else if (stats.bitrate < this.config.bitrateThresholds.audio.medium) {
      score -= 1;
    }
    
    return Math.max(0, Math.min(10, score));
  }
  
  /**
   * Calculate video quality score
   */
  calculateVideoScore(stats) {
    let score = 10;
    
    // Penalize for high packet loss
    if (stats.packetLoss > this.config.packetLossThresholds.poor) {
      score -= 4;
    } else if (stats.packetLoss > this.config.packetLossThresholds.medium) {
      score -= 2;
    } else if (stats.packetLoss > this.config.packetLossThresholds.good) {
      score -= 1;
    }
    
    // Penalize for low framerate
    if (stats.framerate < 10) {
      score -= 4;
    } else if (stats.framerate < 15) {
      score -= 3;
    } else if (stats.framerate < 24) {
      score -= 1;
    }
    
    // Penalize for low bitrate
    if (stats.bitrate < this.config.bitrateThresholds.video.low) {
      score -= 4;
    } else if (stats.bitrate < this.config.bitrateThresholds.video.medium) {
      score -= 2;
    } else if (stats.bitrate < this.config.bitrateThresholds.video.high) {
      score -= 1;
    }
    
    return Math.max(0, Math.min(10, score));
  }
  
  /**
   * Calculate connection quality score
   */
  calculateConnectionScore(stats) {
    let score = 10;
    
    // Penalize for high RTT
    if (stats.rtt > 300) { // 300ms is very high latency
      score -= 4;
    } else if (stats.rtt > 200) {
      score -= 3;
    } else if (stats.rtt > 100) {
      score -= 2;
    } else if (stats.rtt > 50) {
      score -= 1;
    }
    
    // Penalize for low bandwidth
    if (stats.effectiveBandwidth < 500000) { // 500 kbps
      score -= 4;
    } else if (stats.effectiveBandwidth < 1000000) { // 1 Mbps
      score -= 3;
    } else if (stats.effectiveBandwidth < 2000000) { // 2 Mbps
      score -= 2;
    } else if (stats.effectiveBandwidth < 5000000) { // 5 Mbps
      score -= 1;
    }
    
    return Math.max(0, Math.min(10, score));
  }
  
  /**
   * Update network trend analysis
   */
  updateNetworkTrend(userId, currentScore) {
    const trend = this.networkTrends.get(userId);
    if (!trend) return;
    
    // Add sample to trend analysis
    trend.samples.push({
      score: currentScore,
      timestamp: Date.now()
    });
    
    // Keep only recent samples (last minute)
    const now = Date.now();
    trend.samples = trend.samples.filter(sample => (now - sample.timestamp) < 60000);
    
    // Need at least 3 samples to determine trend
    if (trend.samples.length < 3) return;
    
    // Calculate trend direction
    const recentSamples = trend.samples.slice(-3);
    let improving = 0;
    let degrading = 0;
    
    for (let i = 1; i < recentSamples.length; i++) {
      const diff = recentSamples[i].score - recentSamples[i-1].score;
      if (diff > 0.5) improving++;
      else if (diff < -0.5) degrading++;
    }
    
    if (improving > degrading) {
      trend.trendDirection = 'improving';
    } else if (degrading > improving) {
      trend.trendDirection = 'degrading';
    } else {
      trend.trendDirection = 'stable';
    }
  }
  
  /**
   * Adapt media quality based on network conditions
   */
  adaptMediaQuality(userId, quality) {
    const adaptState = this.mediaAdaptationState.get(userId);
    if (!adaptState) return;
    
    const now = Date.now();
    
    // If adaptation is locked, check if we can unlock it
    if (adaptState.adaptationLocked) {
      const lockDuration = now - adaptState.lastAdaptationTime;
      if (lockDuration < 5000) { // 5 second lock minimum
        return;
      }
      adaptState.adaptationLocked = false;
    }
    
    // Check if we need to degrade quality
    if (quality.overall.score < 4 && adaptState.downgradeCount < this.config.adaptiveSettings.maxDowngrades) {
      this.degradeMediaQuality(userId, quality);
      adaptState.lastAdaptationTime = now;
      adaptState.adaptationLocked = true;
    }
    // Check if we can try to improve quality
    else if (quality.overall.score > 7 && adaptState.downgradeCount > 0) {
      const timeSinceLastUpgrade = now - adaptState.lastUpgradeAttempt;
      if (timeSinceLastUpgrade > this.config.adaptiveSettings.recoveryInterval) {
        this.upgradeMediaQuality(userId, quality);
        adaptState.lastUpgradeAttempt = now;
        adaptState.adaptationLocked = true;
      }
    }
  }
  
  /**
   * Degrade media quality to adapt to poor network conditions
   */
  degradeMediaQuality(userId, quality) {
    const adaptState = this.mediaAdaptationState.get(userId);
    if (!adaptState) return;
    
    // Increment downgrade count
    adaptState.downgradeCount++;
    
    let videoConstraints;
    
    // Apply different strategies based on current quality level and issues
    if (adaptState.currentVideoQuality === 'high' && quality.video.score < 5) {
      // Downgrade from high to medium
      adaptState.currentVideoQuality = 'medium';
      videoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { max: 24, ideal: 20 }
      };
    } else if (adaptState.currentVideoQuality === 'medium' && quality.video.score < 4) {
      // Downgrade from medium to low
      adaptState.currentVideoQuality = 'low';
      videoConstraints = {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { max: 15, ideal: 12 }
      };
    } else if (adaptState.currentVideoQuality === 'low' && quality.video.score < 3) {
      // Extremely poor conditions - consider turning off video
      eventBus.emit('webrtc:adaptation', {
        userId,
        action: 'disable-video',
        reason: 'Critical network conditions detected'
      });
      return;
    }
    
    if (videoConstraints) {
      // Apply new constraints
      eventBus.emit('webrtc:adaptation', {
        userId,
        action: 'adjust-constraints',
        constraints: {
          video: videoConstraints,
          // We could also adjust audio if needed
          audio: adaptState.currentAudioQuality === 'high' ? 
            { channelCount: 1, autoGainControl: true, echoCancellation: true, noiseSuppression: true } : 
            undefined
        },
        reason: `Network quality is ${quality.overall.label} (score: ${quality.overall.score.toFixed(1)})`
      });
      
      console.log(`Adapted media quality for ${userId}: downgraded to ${adaptState.currentVideoQuality}`);
    }
  }
  
  /**
   * Upgrade media quality when network conditions improve
   */
  upgradeMediaQuality(userId, quality) {
    const adaptState = this.mediaAdaptationState.get(userId);
    if (!adaptState) return;
    
    let videoConstraints;
    
    // Attempt to upgrade based on current level
    if (adaptState.currentVideoQuality === 'low' && quality.overall.score > 6) {
      // Upgrade from low to medium
      adaptState.currentVideoQuality = 'medium';
      videoConstraints = {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { max: 24, ideal: 20 }
      };
      adaptState.downgradeCount--;
    } else if (adaptState.currentVideoQuality === 'medium' && quality.overall.score > 8) {
      // Upgrade from medium to high
      adaptState.currentVideoQuality = 'high';
      videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { max: 30, ideal: 30 }
      };
      adaptState.downgradeCount--;
    }
    
    if (videoConstraints) {
      // Apply new constraints
      eventBus.emit('webrtc:adaptation', {
        userId,
        action: 'adjust-constraints',
        constraints: {
          video: videoConstraints,
          // Also restore audio quality if needed
          audio: adaptState.currentAudioQuality !== 'high' ? 
            { channelCount: 2, autoGainControl: true, echoCancellation: true, noiseSuppression: true } : 
            undefined
        },
        reason: `Network quality improved to ${quality.overall.label} (score: ${quality.overall.score.toFixed(1)})`
      });
      
      console.log(`Adapted media quality for ${userId}: upgraded to ${adaptState.currentVideoQuality}`);
    }
  }
  
  /**
   * Detect current network type
   */
  detectNetworkType() {
    // Use navigator.connection if available (Network Information API)
    if (navigator.connection && navigator.connection.type) {
      return navigator.connection.type;
    }
    
    return 'unknown';
  }
}

export default ConnectionMonitor;
