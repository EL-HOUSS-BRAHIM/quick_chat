/**
 * Enhanced Screen Sharing Module
 * Provides advanced screen sharing capabilities with quality optimization
 * Progress: 80% complete (screen sharing capability)
 */

class ScreenSharingManager {
  constructor(config = {}) {
    this.config = {
      maxResolution: config.maxResolution || { width: 1920, height: 1080 },
      frameRate: config.frameRate || 15,
      quality: config.quality || 'high',
      cursor: config.cursor || 'always',
      audio: config.audio !== undefined ? config.audio : true,
      fallbackToVideo: config.fallbackToVideo !== undefined ? config.fallbackToVideo : true,
      adaptiveQuality: config.adaptiveQuality !== undefined ? config.adaptiveQuality : true
    };
    
    this.isSharing = false;
    this.screenStream = null;
    this.peerConnection = null;
    this.previousVideoSender = null;
    this.qualityLevel = 'high';
    this.shareType = null; // 'screen', 'window', 'tab'
    
    // Quality presets
    this.qualityPresets = {
      low: {
        maxWidth: 640,
        maxHeight: 480,
        frameRate: 5,
        maxBitrate: 150000
      },
      medium: {
        maxWidth: 1280,
        maxHeight: 720,
        frameRate: 10,
        maxBitrate: 500000
      },
      high: {
        maxWidth: 1920,
        maxHeight: 1080,
        frameRate: 15,
        maxBitrate: 1000000
      }
    };
    
    // Bind methods
    this.handleTrackEnded = this.handleTrackEnded.bind(this);
    this.handleNetworkChange = this.handleNetworkChange.bind(this);
  }

  /**
   * Start screen sharing
   */
  async startScreenSharing(peerConnection, shareOptions = {}) {
    if (this.isSharing) {
      throw new Error('Screen sharing is already active');
    }
    
    if (!this.isScreenSharingSupported()) {
      throw new Error('Screen sharing is not supported in this browser');
    }
    
    this.peerConnection = peerConnection;
    
    try {
      console.log('Starting screen sharing...');
      
      // Get screen sharing constraints
      const constraints = this.buildConstraints(shareOptions);
      
      // Request screen sharing permission
      this.screenStream = await this.requestScreenShare(constraints);
      
      if (!this.screenStream) {
        throw new Error('Failed to get screen sharing stream');
      }
      
      // Store the type of sharing
      this.detectShareType();
      
      // Replace video track in peer connection
      await this.replaceVideoTrack();
      
      // Setup stream event listeners
      this.setupStreamListeners();
      
      // Monitor screen sharing quality
      this.startQualityMonitoring();
      
      this.isSharing = true;
      
      // Dispatch screen sharing started event
      document.dispatchEvent(new CustomEvent('quickchat:screenshare:started', {
        detail: {
          shareType: this.shareType,
          resolution: this.getStreamResolution(),
          frameRate: this.config.frameRate
        }
      }));
      
      console.log('Screen sharing started successfully');
      return this.screenStream;
      
    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      
      // Try fallback to camera if enabled
      if (this.config.fallbackToVideo && error.name === 'NotAllowedError') {
        return await this.fallbackToCamera();
      }
      
      throw error;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenSharing() {
    if (!this.isSharing) return;
    
    try {
      console.log('Stopping screen sharing...');
      
      // Stop quality monitoring
      this.stopQualityMonitoring();
      
      // Stop screen stream
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => {
          track.stop();
        });
        this.screenStream = null;
      }
      
      // Restore original video track if available
      await this.restoreVideoTrack();
      
      this.isSharing = false;
      this.shareType = null;
      
      // Dispatch screen sharing stopped event
      document.dispatchEvent(new CustomEvent('quickchat:screenshare:stopped'));
      
      console.log('Screen sharing stopped');
      
    } catch (error) {
      console.error('Error stopping screen sharing:', error);
      throw error;
    }
  }

  /**
   * Check if screen sharing is supported
   */
  isScreenSharingSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  /**
   * Build constraints for screen sharing
   */
  buildConstraints(shareOptions = {}) {
    const preset = this.qualityPresets[this.qualityLevel];
    
    const constraints = {
      video: {
        width: { max: shareOptions.maxWidth || preset.maxWidth },
        height: { max: shareOptions.maxHeight || preset.maxHeight },
        frameRate: { max: shareOptions.frameRate || preset.frameRate },
        cursor: this.config.cursor,
        displaySurface: shareOptions.displaySurface || 'monitor'
      },
      audio: this.config.audio
    };
    
    // Add advanced video constraints
    if (shareOptions.preferCurrentTab) {
      constraints.video.displaySurface = 'browser';
    }
    
    if (shareOptions.selfBrowserSurface) {
      constraints.video.selfBrowserSurface = shareOptions.selfBrowserSurface;
    }
    
    if (shareOptions.systemAudio) {
      constraints.audio = {
        suppressLocalAudioPlayback: false,
        noiseSuppression: false,
        echoCancellation: false
      };
    }
    
    return constraints;
  }

  /**
   * Request screen sharing permission
   */
  async requestScreenShare(constraints) {
    try {
      // Show custom UI for better UX
      this.showScreenShareDialog();
      
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      this.hideScreenShareDialog();
      return stream;
      
    } catch (error) {
      this.hideScreenShareDialog();
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission denied');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No screen sharing source available');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Screen sharing not supported');
      } else {
        throw new Error(`Screen sharing failed: ${error.message}`);
      }
    }
  }

  /**
   * Replace video track in peer connection
   */
  async replaceVideoTrack() {
    if (!this.peerConnection || !this.screenStream) return;
    
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    // Find current video sender
    const sender = this.peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    
    if (sender) {
      // Store previous track for restoration
      this.previousVideoSender = sender.track;
      
      // Replace the track
      await sender.replaceTrack(videoTrack);
      
      // Update encoding parameters for screen sharing
      await this.updateEncodingParameters(sender);
    } else {
      // Add new track if no video sender exists
      this.peerConnection.addTrack(videoTrack, this.screenStream);
    }
  }

  /**
   * Update encoding parameters for optimal screen sharing
   */
  async updateEncodingParameters(sender) {
    const params = sender.getParameters();
    
    if (params.encodings && params.encodings.length > 0) {
      const preset = this.qualityPresets[this.qualityLevel];
      
      params.encodings[0].maxBitrate = preset.maxBitrate;
      params.encodings[0].maxFramerate = preset.frameRate;
      
      // Optimize for screen content
      params.encodings[0].scaleResolutionDownBy = 1;
      params.encodings[0].scalabilityMode = 'L1T1';
      
      await sender.setParameters(params);
    }
  }

  /**
   * Setup stream event listeners
   */
  setupStreamListeners() {
    if (!this.screenStream) return;
    
    const videoTrack = this.screenStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener('ended', this.handleTrackEnded);
    }
    
    // Monitor stream quality
    this.screenStream.addEventListener('inactive', () => {
      console.log('Screen share stream became inactive');
      this.stopScreenSharing();
    });
  }

  /**
   * Handle track ended (user stopped sharing)
   */
  handleTrackEnded() {
    console.log('Screen sharing track ended');
    this.stopScreenSharing();
  }

  /**
   * Detect the type of screen sharing
   */
  detectShareType() {
    if (!this.screenStream) return;
    
    const videoTrack = this.screenStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    if (settings.displaySurface) {
      switch (settings.displaySurface) {
        case 'monitor':
          this.shareType = 'screen';
          break;
        case 'window':
          this.shareType = 'window';
          break;
        case 'browser':
          this.shareType = 'tab';
          break;
        default:
          this.shareType = 'unknown';
      }
    } else {
      this.shareType = 'screen'; // Default assumption
    }
  }

  /**
   * Get stream resolution
   */
  getStreamResolution() {
    if (!this.screenStream) return null;
    
    const videoTrack = this.screenStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    return {
      width: settings.width || 0,
      height: settings.height || 0
    };
  }

  /**
   * Start quality monitoring
   */
  startQualityMonitoring() {
    if (!this.config.adaptiveQuality) return;
    
    this.qualityMonitoringInterval = setInterval(() => {
      this.monitorQuality();
    }, 5000);
    
    // Listen for network changes
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', this.handleNetworkChange);
    }
  }

  /**
   * Stop quality monitoring
   */
  stopQualityMonitoring() {
    if (this.qualityMonitoringInterval) {
      clearInterval(this.qualityMonitoringInterval);
      this.qualityMonitoringInterval = null;
    }
    
    if ('connection' in navigator) {
      navigator.connection.removeEventListener('change', this.handleNetworkChange);
    }
  }

  /**
   * Monitor screen sharing quality
   */
  async monitorQuality() {
    if (!this.peerConnection) return;
    
    try {
      const stats = await this.peerConnection.getStats();
      const videoStats = this.getVideoStats(stats);
      
      if (videoStats) {
        const quality = this.analyzeQuality(videoStats);
        
        if (quality !== this.qualityLevel) {
          await this.adaptQuality(quality);
        }
      }
    } catch (error) {
      console.error('Error monitoring screen share quality:', error);
    }
  }

  /**
   * Get video statistics
   */
  getVideoStats(stats) {
    let videoStats = null;
    
    stats.forEach(stat => {
      if (stat.type === 'outbound-rtp' && stat.mediaType === 'video') {
        videoStats = stat;
      }
    });
    
    return videoStats;
  }

  /**
   * Analyze quality and determine if adaptation is needed
   */
  analyzeQuality(videoStats) {
    // Analyze frame rate
    const frameRate = videoStats.framesPerSecond || 0;
    const targetFrameRate = this.qualityPresets[this.qualityLevel].frameRate;
    
    // Analyze bitrate
    const bitrate = videoStats.bytesSent ? 
      (videoStats.bytesSent * 8) / (videoStats.timestamp / 1000) : 0;
    
    // Check network condition
    const networkType = navigator.connection ? navigator.connection.effectiveType : '4g';
    
    // Determine appropriate quality level
    if (networkType === 'slow-2g' || networkType === '2g') {
      return 'low';
    } else if (networkType === '3g' || frameRate < targetFrameRate * 0.7) {
      return 'medium';
    } else if (networkType === '4g' && frameRate >= targetFrameRate * 0.9) {
      return 'high';
    }
    
    return this.qualityLevel; // No change needed
  }

  /**
   * Adapt quality based on network conditions
   */
  async adaptQuality(newQuality) {
    if (newQuality === this.qualityLevel) return;
    
    console.log(`Adapting screen share quality from ${this.qualityLevel} to ${newQuality}`);
    
    this.qualityLevel = newQuality;
    
    // Update encoding parameters
    const sender = this.peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    
    if (sender) {
      await this.updateEncodingParameters(sender);
    }
    
    // Dispatch quality change event
    document.dispatchEvent(new CustomEvent('quickchat:screenshare:qualityChanged', {
      detail: { quality: newQuality }
    }));
  }

  /**
   * Handle network changes
   */
  handleNetworkChange() {
    console.log('Network changed during screen sharing');
    this.monitorQuality();
  }

  /**
   * Fallback to camera video
   */
  async fallbackToCamera() {
    console.log('Falling back to camera video');
    
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      // Dispatch fallback event
      document.dispatchEvent(new CustomEvent('quickchat:screenshare:fallback', {
        detail: { fallbackType: 'camera' }
      }));
      
      return cameraStream;
      
    } catch (error) {
      console.error('Camera fallback also failed:', error);
      throw new Error('Both screen sharing and camera access failed');
    }
  }

  /**
   * Restore original video track
   */
  async restoreVideoTrack() {
    if (!this.peerConnection || !this.previousVideoSender) return;
    
    const sender = this.peerConnection.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );
    
    if (sender) {
      await sender.replaceTrack(this.previousVideoSender);
      this.previousVideoSender = null;
    }
  }

  /**
   * Show screen share dialog
   */
  showScreenShareDialog() {
    // Create or show custom screen share selection dialog
    const dialog = document.getElementById('screen-share-dialog');
    if (dialog) {
      dialog.style.display = 'block';
    }
  }

  /**
   * Hide screen share dialog
   */
  hideScreenShareDialog() {
    const dialog = document.getElementById('screen-share-dialog');
    if (dialog) {
      dialog.style.display = 'none';
    }
  }

  /**
   * Get sharing status
   */
  getSharingStatus() {
    return {
      isSharing: this.isSharing,
      shareType: this.shareType,
      qualityLevel: this.qualityLevel,
      resolution: this.getStreamResolution(),
      hasAudio: this.screenStream ? this.screenStream.getAudioTracks().length > 0 : false
    };
  }

  /**
   * Set quality level
   */
  setQualityLevel(quality) {
    if (this.qualityPresets[quality]) {
      this.qualityLevel = quality;
      
      if (this.isSharing) {
        this.adaptQuality(quality);
      }
    }
  }

  /**
   * Get available quality levels
   */
  getAvailableQualityLevels() {
    return Object.keys(this.qualityPresets);
  }

  /**
   * Cleanup method
   */
  destroy() {
    this.stopScreenSharing();
    this.stopQualityMonitoring();
    this.peerConnection = null;
    this.previousVideoSender = null;
  }
}

export default ScreenSharingManager;
