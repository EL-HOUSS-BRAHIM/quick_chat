/**
 * WebRTC Connection Monitor
 * Monitors connection quality for WebRTC calls
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
      ...options
    };
    
    this.monitors = new Map(); // userId -> monitor data
    this.qualityHistory = new Map(); // userId -> quality history
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
          timestamp: 0
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
    try {
      const pc = monitor.peerConnection;
      
      if (!pc || pc.connectionState !== 'connected') {
        return;
      }
      
      // Get stats report
      const stats = await pc.getStats();
      
      // Process stats report
      this.processStats(userId, monitor, stats);
      
    } catch (error) {
      console.error('Error collecting WebRTC stats:', error);
    }
  }
  
  /**
   * Process WebRTC stats
   */
  processStats(userId, monitor, stats) {
    const now = Date.now();
    let audioInbound = null;
    let videoInbound = null;
    let candidatePair = null;
    
    // Find relevant stats
    stats.forEach(stat => {
      // Inbound RTP audio
      if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
        audioInbound = stat;
      }
      
      // Inbound RTP video
      if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
        videoInbound = stat;
      }
      
      // Active candidate pair
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        candidatePair = stat;
      }
    });
    
    // Calculate audio stats
    if (audioInbound) {
      const lastAudioStats = monitor.stats.lastStats ? 
                           monitor.stats.lastStats.get(audioInbound.id) : null;
      
      if (lastAudioStats) {
        const timeDiff = audioInbound.timestamp - lastAudioStats.timestamp;
        const bytesDiff = audioInbound.bytesReceived - lastAudioStats.bytesReceived;
        
        if (timeDiff > 0) {
          // Calculate bitrate (bits per second)
          const bitrate = (bytesDiff * 8) / (timeDiff / 1000);
          
          // Calculate packet loss
          let packetLoss = 0;
          if (audioInbound.packetsLost !== undefined && 
              lastAudioStats.packetsLost !== undefined) {
            const packetsLostDiff = audioInbound.packetsLost - lastAudioStats.packetsLost;
            const packetsReceivedDiff = 
              (audioInbound.packetsReceived - lastAudioStats.packetsReceived) + packetsLostDiff;
              
            if (packetsReceivedDiff > 0) {
              packetLoss = packetsLostDiff / packetsReceivedDiff;
            }
          }
          
          // Update audio stats
          monitor.stats.audio = {
            bitrate,
            packetLoss,
            jitter: audioInbound.jitter * 1000, // Convert to ms
            timestamp: now
          };
        }
      }
    }
    
    // Calculate video stats
    if (videoInbound) {
      const lastVideoStats = monitor.stats.lastStats ? 
                           monitor.stats.lastStats.get(videoInbound.id) : null;
      
      if (lastVideoStats) {
        const timeDiff = videoInbound.timestamp - lastVideoStats.timestamp;
        const bytesDiff = videoInbound.bytesReceived - lastVideoStats.bytesReceived;
        
        if (timeDiff > 0) {
          // Calculate bitrate (bits per second)
          const bitrate = (bytesDiff * 8) / (timeDiff / 1000);
          
          // Calculate packet loss
          let packetLoss = 0;
          if (videoInbound.packetsLost !== undefined && 
              lastVideoStats.packetsLost !== undefined) {
            const packetsLostDiff = videoInbound.packetsLost - lastVideoStats.packetsLost;
            const packetsReceivedDiff = 
              (videoInbound.packetsReceived - lastVideoStats.packetsReceived) + packetsLostDiff;
              
            if (packetsReceivedDiff > 0) {
              packetLoss = packetsLostDiff / packetsReceivedDiff;
            }
          }
          
          // Calculate framerate
          let framerate = 0;
          if (videoInbound.framesDecoded !== undefined && 
              lastVideoStats.framesDecoded !== undefined) {
            const framesDiff = videoInbound.framesDecoded - lastVideoStats.framesDecoded;
            framerate = framesDiff / (timeDiff / 1000);
          }
          
          // Update video stats
          monitor.stats.video = {
            bitrate,
            packetLoss,
            framerate,
            timestamp: now
          };
        }
      }
    }
    
    // Calculate connection stats
    if (candidatePair) {
      // Round-trip time
      if (candidatePair.currentRoundTripTime !== undefined) {
        monitor.stats.connection = {
          rtt: candidatePair.currentRoundTripTime * 1000, // Convert to ms
          timestamp: now
        };
      }
    }
    
    // Store stats for next comparison
    monitor.stats.lastStats = stats;
    
    // Evaluate connection quality
    this.evaluateConnectionQuality(userId, monitor.stats);
  }
  
  /**
   * Evaluate connection quality based on stats
   */
  evaluateConnectionQuality(userId, stats) {
    // Evaluate audio quality
    const audioQuality = this.evaluateAudioQuality(stats.audio);
    
    // Evaluate video quality
    const videoQuality = this.evaluateVideoQuality(stats.video);
    
    // Calculate overall quality
    const overallQuality = this.calculateOverallQuality(audioQuality, videoQuality, stats.connection);
    
    // Store in quality history
    const history = this.qualityHistory.get(userId);
    
    if (history) {
      // Add to history (keep limited size)
      history.overall.push(overallQuality);
      history.audio.push(audioQuality);
      history.video.push(videoQuality);
      
      // Limit history size
      if (history.overall.length > this.config.statsHistorySize) {
        history.overall.shift();
        history.audio.shift();
        history.video.shift();
      }
    }
    
    // Emit quality event
    eventBus.emit('webrtc:quality', {
      userId,
      quality: {
        overall: overallQuality,
        audio: audioQuality,
        video: videoQuality
      },
      stats
    });
    
    // Update state
    state.set(`webrtc.quality.${userId}`, {
      overall: overallQuality,
      audio: audioQuality,
      video: videoQuality,
      stats
    });
  }
  
  /**
   * Evaluate audio quality
   */
  evaluateAudioQuality(audioStats) {
    if (!audioStats || audioStats.timestamp === 0) {
      return { score: 0, level: 'unknown', issues: [] };
    }
    
    const issues = [];
    let score = 10; // Start with perfect score
    
    // Check bitrate
    const audioBitrate = audioStats.bitrate;
    const thresholds = this.config.bitrateThresholds.audio;
    
    if (audioBitrate < thresholds.low) {
      score -= 3;
      issues.push('low-audio-bitrate');
    } else if (audioBitrate < thresholds.medium) {
      score -= 1;
      issues.push('medium-audio-bitrate');
    }
    
    // Check packet loss
    const packetLoss = audioStats.packetLoss;
    
    if (packetLoss > this.config.packetLossThresholds.poor) {
      score -= 4;
      issues.push('high-audio-packet-loss');
    } else if (packetLoss > this.config.packetLossThresholds.medium) {
      score -= 2;
      issues.push('medium-audio-packet-loss');
    } else if (packetLoss > this.config.packetLossThresholds.good) {
      score -= 1;
      issues.push('low-audio-packet-loss');
    }
    
    // Check jitter
    const jitter = audioStats.jitter;
    
    if (jitter > 50) { // 50ms is high jitter
      score -= 2;
      issues.push('high-audio-jitter');
    } else if (jitter > 20) { // 20ms is medium jitter
      score -= 1;
      issues.push('medium-audio-jitter');
    }
    
    // Ensure score is within bounds
    score = Math.max(1, Math.min(10, score));
    
    // Determine quality level
    let level = 'excellent';
    
    if (score <= 3) {
      level = 'poor';
    } else if (score <= 6) {
      level = 'fair';
    } else if (score <= 8) {
      level = 'good';
    }
    
    return { score, level, issues };
  }
  
  /**
   * Evaluate video quality
   */
  evaluateVideoQuality(videoStats) {
    if (!videoStats || videoStats.timestamp === 0) {
      return { score: 0, level: 'unknown', issues: [] };
    }
    
    const issues = [];
    let score = 10; // Start with perfect score
    
    // Check bitrate
    const videoBitrate = videoStats.bitrate;
    const thresholds = this.config.bitrateThresholds.video;
    
    if (videoBitrate < thresholds.low) {
      score -= 4;
      issues.push('low-video-bitrate');
    } else if (videoBitrate < thresholds.medium) {
      score -= 2;
      issues.push('medium-video-bitrate');
    } else if (videoBitrate < thresholds.high) {
      score -= 1;
      issues.push('reduced-video-bitrate');
    }
    
    // Check packet loss
    const packetLoss = videoStats.packetLoss;
    
    if (packetLoss > this.config.packetLossThresholds.poor) {
      score -= 3;
      issues.push('high-video-packet-loss');
    } else if (packetLoss > this.config.packetLossThresholds.medium) {
      score -= 2;
      issues.push('medium-video-packet-loss');
    } else if (packetLoss > this.config.packetLossThresholds.good) {
      score -= 1;
      issues.push('low-video-packet-loss');
    }
    
    // Check framerate
    const framerate = videoStats.framerate;
    
    if (framerate < 10) {
      score -= 3;
      issues.push('low-framerate');
    } else if (framerate < 20) {
      score -= 1;
      issues.push('medium-framerate');
    }
    
    // Ensure score is within bounds
    score = Math.max(1, Math.min(10, score));
    
    // Determine quality level
    let level = 'excellent';
    
    if (score <= 3) {
      level = 'poor';
    } else if (score <= 6) {
      level = 'fair';
    } else if (score <= 8) {
      level = 'good';
    }
    
    return { score, level, issues };
  }
  
  /**
   * Calculate overall connection quality
   */
  calculateOverallQuality(audioQuality, videoQuality, connectionStats) {
    const issues = [...audioQuality.issues, ...videoQuality.issues];
    
    // Start with weighted average of audio and video scores
    // Audio is weighted more heavily since it's more important for communication
    let score = 0;
    let validScores = 0;
    
    if (audioQuality.score > 0) {
      score += audioQuality.score * 0.6; // 60% weight for audio
      validScores++;
    }
    
    if (videoQuality.score > 0) {
      score += videoQuality.score * 0.4; // 40% weight for video
      validScores++;
    }
    
    // If we have no valid scores, return unknown
    if (validScores === 0) {
      return { score: 0, level: 'unknown', issues };
    }
    
    // Normalize score
    score = score / validScores;
    
    // Adjust score based on RTT
    if (connectionStats && connectionStats.rtt > 0) {
      const rtt = connectionStats.rtt;
      
      if (rtt > 300) { // 300ms is very high RTT
        score -= 2;
        issues.push('high-latency');
      } else if (rtt > 150) { // 150ms is high RTT
        score -= 1;
        issues.push('medium-latency');
      }
    }
    
    // Ensure score is within bounds
    score = Math.max(1, Math.min(10, score));
    
    // Determine quality level
    let level = 'excellent';
    
    if (score <= 3) {
      level = 'poor';
    } else if (score <= 6) {
      level = 'fair';
    } else if (score <= 8) {
      level = 'good';
    }
    
    return { score, level, issues };
  }
  
  /**
   * Track ICE connection state changes
   */
  trackIceConnectionState(userId, state) {
    console.log(`ICE connection state for ${userId}: ${state}`);
    
    // Emit ICE connection state event
    eventBus.emit('webrtc:iceConnectionState', {
      userId,
      state
    });
  }
  
  /**
   * Get current connection quality for a user
   */
  getConnectionQuality(userId) {
    const history = this.qualityHistory.get(userId);
    
    if (!history || history.overall.length === 0) {
      return { score: 0, level: 'unknown', issues: [] };
    }
    
    // Return the most recent quality measurement
    return history.overall[history.overall.length - 1];
  }
  
  /**
   * Get quality history for a user
   */
  getQualityHistory(userId) {
    return this.qualityHistory.get(userId) || {
      overall: [],
      audio: [],
      video: []
    };
  }
}

export default ConnectionMonitor;
