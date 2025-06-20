/**
 * WebRTC Manager Service
 * 
 * Manages WebRTC connections for voice and video calling
 */

import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class WebRTCManager {
  constructor() {
    this.eventBus = new EventBus();
    this.initialized = false;
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.isCallActive = false;
    this.isVideoEnabled = false;
    this.isAudioEnabled = false;
    this.currentCall = null;
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  /**
   * Initialize WebRTC manager
   */
  async init() {
    if (this.initialized) return;

    try {
      // Check WebRTC support
      if (!this.isWebRTCSupported()) {
        throw new Error('WebRTC is not supported in this browser');
      }

      this.setupEventListeners();
      this.initialized = true;
      
      logger.debug('WebRTC manager initialized');
    } catch (error) {
      logger.error('Failed to initialize WebRTC manager:', error);
      throw error;
    }
  }

  /**
   * Check if WebRTC is supported
   */
  isWebRTCSupported() {
    return !!(
      window.RTCPeerConnection &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.eventBus.on('call:start', (data) => {
      this.startCall(data.userId, data.options);
    });

    this.eventBus.on('call:accept', (data) => {
      this.acceptCall(data.callId);
    });

    this.eventBus.on('call:reject', (data) => {
      this.rejectCall(data.callId);
    });

    this.eventBus.on('call:end', () => {
      this.endCall();
    });

    this.eventBus.on('call:toggleVideo', () => {
      this.toggleVideo();
    });

    this.eventBus.on('call:toggleAudio', () => {
      this.toggleAudio();
    });
  }

  /**
   * Get user media
   */
  async getUserMedia(constraints = { audio: true, video: false }) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      
      this.eventBus.emit('media:localStream', { stream });
      return stream;
    } catch (error) {
      logger.error('Failed to get user media:', error);
      throw error;
    }
  }

  /**
   * Create peer connection
   */
  createPeerConnection() {
    try {
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Add local stream tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, this.localStream);
        });
      }

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.eventBus.emit('media:remoteStream', { stream: this.remoteStream });
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.eventBus.emit('signaling:iceCandidate', {
            candidate: event.candidate,
            callId: this.currentCall?.id
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        logger.debug('WebRTC connection state:', state);
        
        this.eventBus.emit('call:connectionState', { state });
        
        if (state === 'connected') {
          this.eventBus.emit('call:connected');
        } else if (state === 'disconnected' || state === 'failed') {
          this.endCall();
        }
      };

      return this.peerConnection;
    } catch (error) {
      logger.error('Failed to create peer connection:', error);
      throw error;
    }
  }

  /**
   * Start a call
   */
  async startCall(userId, options = {}) {
    try {
      if (this.isCallActive) {
        throw new Error('A call is already active');
      }

      const constraints = {
        audio: true,
        video: options.video || false
      };

      // Get user media
      await this.getUserMedia(constraints);
      
      // Create peer connection
      this.createPeerConnection();
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Store call info
      this.currentCall = {
        id: this.generateCallId(),
        userId,
        isOutgoing: true,
        startTime: Date.now()
      };

      this.isCallActive = true;
      this.isVideoEnabled = constraints.video;
      this.isAudioEnabled = constraints.audio;

      // Send offer through signaling
      this.eventBus.emit('signaling:offer', {
        offer,
        userId,
        callId: this.currentCall.id
      });

      this.eventBus.emit('call:started', {
        callId: this.currentCall.id,
        userId,
        isOutgoing: true
      });

      logger.debug('Call started:', this.currentCall.id);
    } catch (error) {
      logger.error('Failed to start call:', error);
      this.cleanupCall();
      throw error;
    }
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId) {
    try {
      if (this.isCallActive) {
        throw new Error('A call is already active');
      }

      // Get user media
      await this.getUserMedia({ audio: true, video: false });
      
      // Create peer connection
      this.createPeerConnection();

      this.currentCall = {
        id: callId,
        isOutgoing: false,
        startTime: Date.now()
      };

      this.isCallActive = true;
      this.isAudioEnabled = true;

      this.eventBus.emit('call:accepted', { callId });
      
      logger.debug('Call accepted:', callId);
    } catch (error) {
      logger.error('Failed to accept call:', error);
      this.cleanupCall();
      throw error;
    }
  }

  /**
   * Reject an incoming call
   */
  rejectCall(callId) {
    this.eventBus.emit('call:rejected', { callId });
    logger.debug('Call rejected:', callId);
  }

  /**
   * End the current call
   */
  endCall() {
    try {
      if (this.currentCall) {
        this.eventBus.emit('call:ended', {
          callId: this.currentCall.id,
          duration: Date.now() - this.currentCall.startTime
        });
      }

      this.cleanupCall();
      logger.debug('Call ended');
    } catch (error) {
      logger.error('Failed to end call:', error);
    }
  }

  /**
   * Toggle video
   */
  toggleVideo() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.isVideoEnabled = !this.isVideoEnabled;
      videoTrack.enabled = this.isVideoEnabled;
      
      this.eventBus.emit('call:videoToggled', {
        enabled: this.isVideoEnabled
      });
    }
  }

  /**
   * Toggle audio
   */
  toggleAudio() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isAudioEnabled = !this.isAudioEnabled;
      audioTrack.enabled = this.isAudioEnabled;
      
      this.eventBus.emit('call:audioToggled', {
        enabled: this.isAudioEnabled
      });
    }
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(offer, callId) {
    try {
      if (!this.peerConnection) {
        this.createPeerConnection();
      }

      await this.peerConnection.setRemoteDescription(offer);
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.eventBus.emit('signaling:answer', {
        answer,
        callId
      });
    } catch (error) {
      logger.error('Failed to handle offer:', error);
      throw error;
    }
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      logger.error('Failed to handle answer:', error);
      throw error;
    }
  }

  /**
   * Handle ICE candidate
   */
  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      logger.error('Failed to handle ICE candidate:', error);
    }
  }

  /**
   * Cleanup call resources
   */
  cleanupCall() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.isCallActive = false;
    this.isVideoEnabled = false;
    this.isAudioEnabled = false;
    this.currentCall = null;
    this.remoteStream = null;
  }

  /**
   * Generate unique call ID
   */
  generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get call status
   */
  getCallStatus() {
    return {
      isActive: this.isCallActive,
      isVideoEnabled: this.isVideoEnabled,
      isAudioEnabled: this.isAudioEnabled,
      currentCall: this.currentCall,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream
    };
  }

  /**
   * Get available devices
   */
  async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        audioOutputs: devices.filter(device => device.kind === 'audiooutput'),
        videoInputs: devices.filter(device => device.kind === 'videoinput')
      };
    } catch (error) {
      logger.error('Failed to get available devices:', error);
      return { audioInputs: [], audioOutputs: [], videoInputs: [] };
    }
  }

  /**
   * Change audio/video input device
   */
  async changeDevice(deviceId, type = 'audio') {
    try {
      const constraints = {
        audio: type === 'audio' ? { deviceId } : this.isAudioEnabled,
        video: type === 'video' ? { deviceId } : this.isVideoEnabled
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace tracks in peer connection
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === type
        );
        
        if (sender) {
          const track = newStream.getTracks().find(t => t.kind === type);
          await sender.replaceTrack(track);
        }
      }

      // Stop old tracks and update stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (track.kind === type) {
            track.stop();
          }
        });
      }

      this.localStream = newStream;
      this.eventBus.emit('media:deviceChanged', { type, deviceId });
      
    } catch (error) {
      logger.error('Failed to change device:', error);
      throw error;
    }
  }

  /**
   * Destroy WebRTC manager
   */
  destroy() {
    this.endCall();
    this.initialized = false;
  }
}

// Create singleton instance
export const webRTCManager = new WebRTCManager();
export default webRTCManager;
