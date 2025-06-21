/**
 * WebRTC Browser Compatibility Manager
 * Provides fallback mechanisms for different browsers and detects capabilities
 */

import eventBus from '../../core/event-bus.js';

class WebRTCCompatibilityManager {
  constructor() {
    this.browserInfo = this.detectBrowser();
    this.capabilities = this.detectCapabilities();
    this.fallbackOptions = this.configureFallbacks();
  }
  
  /**
   * Detect browser type and version
   */
  detectBrowser() {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    let version = 'unknown';
    
    // Detect Chrome
    if (/Chrome/.test(userAgent) && !/Chromium|Edge|Edg|OPR|Opera/.test(userAgent)) {
      browser = 'chrome';
      version = userAgent.match(/Chrome\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Firefox
    else if (/Firefox/.test(userAgent)) {
      browser = 'firefox';
      version = userAgent.match(/Firefox\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Safari
    else if (/Safari/.test(userAgent) && !/Chrome|Chromium|Edge|Edg|OPR|Opera/.test(userAgent)) {
      browser = 'safari';
      version = userAgent.match(/Version\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Edge
    else if (/Edg/.test(userAgent)) {
      browser = 'edge';
      version = userAgent.match(/Edg\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    // Detect Opera
    else if (/OPR|Opera/.test(userAgent)) {
      browser = 'opera';
      version = userAgent.match(/(?:OPR|Opera)\/(\d+\.\d+)/)?.[1] || 'unknown';
    }
    
    return {
      name: browser,
      version: version,
      versionNumber: parseFloat(version) || 0,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      isIOS: /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream
    };
  }
  
  /**
   * Detect WebRTC capabilities of the current browser
   */
  detectCapabilities() {
    const capabilities = {
      webRTC: false,
      mediaDevices: false,
      mediaRecorder: false,
      screenSharing: false,
      h264: false,
      vp8: false,
      vp9: false,
      opus: false,
      dataChannel: false,
      insertableStreams: false, // For E2E encryption
      backgroundBlur: false
    };
    
    // Check for basic WebRTC support
    capabilities.webRTC = !!window.RTCPeerConnection;
    
    // Check for media devices API
    capabilities.mediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    // Check for MediaRecorder API
    capabilities.mediaRecorder = !!window.MediaRecorder;
    
    // Check for screen sharing
    capabilities.screenSharing = !!(navigator.mediaDevices && 
      (navigator.mediaDevices.getDisplayMedia || 
      navigator.mediaDevices.getUserMedia));
    
    // Check for data channel support
    if (window.RTCPeerConnection) {
      try {
        const pc = new RTCPeerConnection();
        capabilities.dataChannel = !!pc.createDataChannel;
        pc.close();
      } catch (e) {
        console.error('Error checking data channel capability:', e);
      }
    }
    
    // Check for insertable streams (needed for E2E encryption)
    capabilities.insertableStreams = !!(window.RTCRtpSender && 
      RTCRtpSender.prototype.createEncodedStreams);
    
    // Detect codec support
    if (window.RTCRtpSender && RTCRtpSender.getCapabilities) {
      try {
        const capabilities = RTCRtpSender.getCapabilities('video');
        if (capabilities && capabilities.codecs) {
          capabilities.h264 = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/h264');
          capabilities.vp8 = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/vp8');
          capabilities.vp9 = capabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'video/vp9');
        }
        
        const audioCapabilities = RTCRtpSender.getCapabilities('audio');
        if (audioCapabilities && audioCapabilities.codecs) {
          capabilities.opus = audioCapabilities.codecs.some(codec => 
            codec.mimeType.toLowerCase() === 'audio/opus');
        }
      } catch (e) {
        console.error('Error checking codec capabilities:', e);
      }
    }
    
    // Background blur capability check (estimate based on browser)
    if (this.browserInfo.name === 'chrome' && this.browserInfo.versionNumber >= 92) {
      capabilities.backgroundBlur = true;
    } else if (this.browserInfo.name === 'edge' && this.browserInfo.versionNumber >= 92) {
      capabilities.backgroundBlur = true;
    } else if (this.browserInfo.name === 'firefox' && this.browserInfo.versionNumber >= 90) {
      capabilities.backgroundBlur = true;
    }
    
    return capabilities;
  }
  
  /**
   * Configure fallback options based on browser capabilities
   */
  configureFallbacks() {
    const fallbacks = {
      preferredVideoCodec: 'vp8', // Default fallback
      useSdpMunging: false,
      forceTurn: false,
      useDataChannelForMessages: false,
      adaptiveBitrate: true,
      forceLowResolution: false,
      disableVideo: false,
      disableScreenSharing: false,
      alternateScreenCapture: false,
      simulcast: false
    };
    
    // Set preferred video codec based on support
    if (this.capabilities.h264) {
      fallbacks.preferredVideoCodec = 'h264'; // Prefer H.264 for hardware acceleration if available
    } else if (this.capabilities.vp9) {
      fallbacks.preferredVideoCodec = 'vp9'; // VP9 is more efficient but not as widely supported
    } else if (this.capabilities.vp8) {
      fallbacks.preferredVideoCodec = 'vp8'; // VP8 is the most compatible
    }
    
    // Safari-specific fallbacks
    if (this.browserInfo.name === 'safari') {
      fallbacks.useSdpMunging = true; // Safari may need SDP munging for compatibility
      fallbacks.simulcast = false; // Disable simulcast on Safari
      
      // On older Safari versions, force TURN for reliable connectivity
      if (this.browserInfo.versionNumber < 14) {
        fallbacks.forceTurn = true;
      }
      
      // iOS Safari has more limitations
      if (this.browserInfo.isIOS) {
        fallbacks.adaptiveBitrate = false; // Can be less reliable on iOS
        fallbacks.alternateScreenCapture = true; // iOS Safari needs alternative screen capture
      }
    }
    
    // Firefox-specific fallbacks
    if (this.browserInfo.name === 'firefox') {
      fallbacks.simulcast = this.browserInfo.versionNumber >= 84; // Only for newer Firefox
    }
    
    // Mobile-specific fallbacks
    if (this.browserInfo.isMobile) {
      fallbacks.forceLowResolution = true; // Start with low resolution on mobile
      
      // Detect if device is likely low-end
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
        fallbacks.disableVideo = true; // Default to audio-only on low-end devices
      }
    }
    
    // Older browser fallbacks
    if ((this.browserInfo.name === 'chrome' && this.browserInfo.versionNumber < 72) ||
        (this.browserInfo.name === 'firefox' && this.browserInfo.versionNumber < 67) ||
        (this.browserInfo.name === 'safari' && this.browserInfo.versionNumber < 12.1)) {
      fallbacks.useDataChannelForMessages = true; // Use data channel as fallback
      fallbacks.disableScreenSharing = true; // Disable screen sharing on older browsers
    }
    
    return fallbacks;
  }
  
  /**
   * Apply browser-specific RTC constraints
   */
  applyConstraints(constraints) {
    const adaptedConstraints = { ...constraints };
    
    // Apply browser-specific adjustments
    if (this.browserInfo.name === 'firefox') {
      // Firefox-specific constraints
      if (adaptedConstraints.video) {
        // Firefox prefers exact values rather than min/max/ideal
        const videoConstraints = adaptedConstraints.video;
        if (videoConstraints.width && videoConstraints.width.ideal) {
          videoConstraints.width = videoConstraints.width.ideal;
        }
        if (videoConstraints.height && videoConstraints.height.ideal) {
          videoConstraints.height = videoConstraints.height.ideal;
        }
        if (videoConstraints.frameRate && videoConstraints.frameRate.ideal) {
          videoConstraints.frameRate = videoConstraints.frameRate.ideal;
        }
      }
    } 
    else if (this.browserInfo.name === 'safari') {
      // Safari-specific constraints
      if (adaptedConstraints.video) {
        // Safari sometimes has issues with complex video constraints
        const videoConstraints = adaptedConstraints.video;
        
        // Simplify video constraints
        if (typeof videoConstraints !== 'boolean') {
          // Use simple constraints for Safari
          adaptedConstraints.video = {
            width: videoConstraints.width?.ideal || 640,
            height: videoConstraints.height?.ideal || 480
          };
        }
      }
    }
    
    // Apply fallback options
    if (this.fallbackOptions.forceLowResolution && adaptedConstraints.video && typeof adaptedConstraints.video !== 'boolean') {
      adaptedConstraints.video.width = { max: 640 };
      adaptedConstraints.video.height = { max: 480 };
      adaptedConstraints.video.frameRate = { max: 20 };
    }
    
    // Disable video if required
    if (this.fallbackOptions.disableVideo) {
      adaptedConstraints.video = false;
    }
    
    return adaptedConstraints;
  }
  
  /**
   * Apply browser-specific RTCPeerConnection options
   */
  getPeerConnectionConfig(config = {}) {
    const peerConfig = { ...config };
    
    // Set ICE transport policy to relay if forceTurn is enabled
    if (this.fallbackOptions.forceTurn) {
      peerConfig.iceTransportPolicy = 'relay';
    }
    
    // Safari may need trickling disabled in some versions
    if (this.browserInfo.name === 'safari' && this.browserInfo.versionNumber < 14) {
      peerConfig.iceCandidatePoolSize = 0;
    }
    
    return peerConfig;
  }
  
  /**
   * Apply codec preferences to SDP
   */
  applyCodecPreferences(sdp) {
    // Skip if browser doesn't need SDP munging
    if (!this.fallbackOptions.useSdpMunging) return sdp;
    
    // Define the codec preferences based on our configuration
    const preferredVideoCodec = this.fallbackOptions.preferredVideoCodec;
    
    // This is a simplified SDP munging example
    // In production, you'd want more robust SDP parsing
    
    // Split the SDP into lines
    const lines = sdp.split('\r\n');
    const mLineIndex = lines.findIndex(line => line.startsWith('m=video'));
    
    if (mLineIndex === -1) return sdp; // No video line found
    
    // Find the video codec PT (payload type) numbers
    const codecMap = {
      'h264': [],
      'vp8': [],
      'vp9': []
    };
    
    // Find all PT numbers for each codec
    for (let i = mLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      
      // If we hit another m= line, we've gone too far
      if (line.startsWith('m=')) break;
      
      // Look for codec definitions
      if (line.startsWith('a=rtpmap:')) {
        const ptMatch = line.match(/a=rtpmap:(\d+) ([^/]+)/);
        if (ptMatch) {
          const pt = ptMatch[1];
          const codec = ptMatch[2].toLowerCase();
          
          if (codec === 'h264') codecMap.h264.push(pt);
          else if (codec === 'vp8') codecMap.vp8.push(pt);
          else if (codec === 'vp9') codecMap.vp9.push(pt);
        }
      }
    }
    
    // Get all payload types for the preferred codec
    const preferredPts = codecMap[preferredVideoCodec];
    if (!preferredPts || preferredPts.length === 0) {
      return sdp; // Preferred codec not found, don't modify SDP
    }
    
    // Find and modify the m=video line to prioritize our codec
    const mLine = lines[mLineIndex];
    const parts = mLine.split(' ');
    
    // The first three parts are "m=video [port] [proto]", followed by payload types
    const header = parts.slice(0, 3);
    let payloadTypes = parts.slice(3);
    
    // Remove preferred PTs from the payload list
    preferredPts.forEach(pt => {
      const index = payloadTypes.indexOf(pt);
      if (index !== -1) {
        payloadTypes.splice(index, 1);
      }
    });
    
    // Add preferred PTs to the front
    payloadTypes = [...preferredPts, ...payloadTypes];
    
    // Reconstruct the m= line
    lines[mLineIndex] = [...header, ...payloadTypes].join(' ');
    
    // Join the SDP back together
    return lines.join('\r\n');
  }
  
  /**
   * Get alternative screen capture method if native is not supported
   */
  getAlternativeScreenCapture() {
    if (!this.fallbackOptions.alternateScreenCapture) {
      return Promise.reject(new Error('Screen capture not supported and no fallback available'));
    }
    
    // Show a UI to the user explaining how to share their screen using screenshots
    return new Promise((resolve, reject) => {
      // Create UI elements for manual screen sharing
      const fallbackUI = document.createElement('div');
      fallbackUI.className = 'screen-share-fallback';
      fallbackUI.innerHTML = `
        <div class="fallback-inner">
          <h3>Screen Sharing Not Supported</h3>
          <p>Your browser doesn't fully support screen sharing. You can:</p>
          <ol>
            <li>Use a different browser (Chrome or Edge recommended)</li>
            <li>Share a screenshot instead (click button below)</li>
          </ol>
          <button id="captureScreenshot">Share Screenshot</button>
          <button id="cancelScreenshare">Cancel</button>
        </div>
      `;
      
      document.body.appendChild(fallbackUI);
      
      // Handle screenshot button
      document.getElementById('captureScreenshot').addEventListener('click', () => {
        // Create a canvas for the user to select part of screen
        fallbackUI.remove();
        
        // In a real implementation, you'd provide a way for users to
        // upload or select part of their screen
        // This is a placeholder for that functionality
        
        // For demo, we'll create a simple canvas that the user can draw on
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        canvas.style.backgroundColor = '#f0f0f0';
        canvas.style.position = 'fixed';
        canvas.style.top = '50%';
        canvas.style.left = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        canvas.style.zIndex = '9999';
        
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000000';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText('Draw or type here to share content', canvas.width / 2, canvas.height / 2);
        
        const controls = document.createElement('div');
        controls.style.position = 'fixed';
        controls.style.bottom = '20px';
        controls.style.left = '50%';
        controls.style.transform = 'translateX(-50%)';
        controls.style.zIndex = '10000';
        controls.innerHTML = `
          <button id="shareCanvas">Share This</button>
          <button id="cancelCanvas">Cancel</button>
        `;
        
        document.body.appendChild(canvas);
        document.body.appendChild(controls);
        
        document.getElementById('shareCanvas').addEventListener('click', () => {
          // Create a stream from the canvas
          const stream = canvas.captureStream(30); // 30 FPS
          canvas.remove();
          controls.remove();
          resolve(stream);
        });
        
        document.getElementById('cancelCanvas').addEventListener('click', () => {
          canvas.remove();
          controls.remove();
          reject(new Error('Screen sharing cancelled'));
        });
      });
      
      document.getElementById('cancelScreenshare').addEventListener('click', () => {
        fallbackUI.remove();
        reject(new Error('Screen sharing cancelled'));
      });
    });
  }
  
  /**
   * Create fallback message transport when data channels aren't available
   */
  createMessageTransport(userId) {
    if (!this.fallbackOptions.useDataChannelForMessages) {
      return null; // No fallback needed
    }
    
    // Create a fallback using regular AJAX or WebSockets
    return {
      send: (message) => {
        // Send message via AJAX
        fetch('/api/webrtc/message-relay.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: userId,
            message: message
          })
        }).catch(err => {
          console.error('Error sending fallback message:', err);
        });
      },
      
      startListening: () => {
        // Poll for messages using long-polling technique
        const poll = () => {
          fetch(`/api/webrtc/message-relay.php?userId=${userId}`, {
            method: 'GET'
          }).then(response => response.json())
            .then(messages => {
              if (messages && messages.length > 0) {
                messages.forEach(message => {
                  eventBus.emit('webrtc:message', {
                    userId: message.from,
                    data: message.data
                  });
                });
              }
              
              // Continue polling
              setTimeout(poll, 1000);
            })
            .catch(err => {
              console.error('Error polling for messages:', err);
              setTimeout(poll, 5000); // Retry after error with longer delay
            });
        };
        
        // Start polling
        poll();
      }
    };
  }
  
  /**
   * Check if a specific feature is supported and log appropriate warnings
   */
  checkFeatureSupport(feature) {
    if (!this.capabilities[feature]) {
      console.warn(`${feature} is not supported in this browser. Using fallback if available.`);
      
      // Emit event for UI to show appropriate warnings
      eventBus.emit('webrtc:compatibility', {
        feature: feature,
        supported: false,
        fallbackAvailable: this.hasFallbackFor(feature)
      });
      
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if there's a fallback available for a specific feature
   */
  hasFallbackFor(feature) {
    switch (feature) {
      case 'screenSharing':
        return this.fallbackOptions.alternateScreenCapture;
      case 'dataChannel':
        return this.fallbackOptions.useDataChannelForMessages;
      case 'webRTC':
        return false; // No fallback for basic WebRTC support
      default:
        return false;
    }
  }
  
  /**
   * Get browser compatibility summary
   */
  getCompatibilitySummary() {
    return {
      browser: this.browserInfo,
      capabilities: this.capabilities,
      fallbacks: this.fallbackOptions,
      overallCompatibility: this.getOverallCompatibilityRating()
    };
  }
  
  /**
   * Get overall browser compatibility rating (0-100)
   */
  getOverallCompatibilityRating() {
    let score = 0;
    const features = Object.keys(this.capabilities);
    
    // Calculate score based on supported features
    features.forEach(feature => {
      if (this.capabilities[feature]) {
        score += (100 / features.length);
      } else if (this.hasFallbackFor(feature)) {
        score += (50 / features.length); // Half points for fallback
      }
    });
    
    // Adjust score based on browser known issues
    if (this.browserInfo.name === 'safari' && this.browserInfo.versionNumber < 14) {
      score *= 0.9; // 10% penalty for older Safari
    }
    
    if (this.browserInfo.isMobile) {
      score *= 0.95; // 5% penalty for mobile browsers (generally less stable for WebRTC)
    }
    
    return Math.round(score);
  }
}

export default WebRTCCompatibilityManager;
