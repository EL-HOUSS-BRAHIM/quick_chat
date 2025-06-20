/**
 * WebRTC Module
 * Consolidated implementation for voice and video calls
 * Enhanced with dynamic adaptation for different network conditions and browser compatibility
 */

import app from '../../core/app.js';
import eventBus from '../../core/event-bus.js';
import apiClient from '../../api/api-client.js';
import errorHandler from '../../core/error-handler.js';
import { state } from '../../core/state.js';
import utils from '../../core/utils.js';
import SignalingService from './signaling.js';
import DeviceManager from './device-manager.js';
import CallUI from './ui.js';
import CallRecorder from './call-recorder.js';
import ConnectionMonitor from './connection-monitor.js';
import ConnectionPool from './connection-pool.js';
import WebRTCCompatibilityManager from './browser-compatibility.js';

class WebRTCModule {
  constructor(options = {}) {
    // Initialize browser compatibility manager
    this.compatibilityManager = new WebRTCCompatibilityManager();
    
    // Configuration
    this.config = {
      signalingServer: options.signalingServer || 
                       (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
                       window.location.host + '/ws',
      stunServers: options.stunServers || [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ],
      turnServers: options.turnServers || [],
      iceTransportPolicy: options.iceTransportPolicy || 'all',
      mediaConstraints: options.mediaConstraints || {
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      },
      reconnectAttempts: options.reconnectAttempts || 3,
      reconnectDelay: options.reconnectDelay || 2000, // 2 seconds
      callTimeout: options.callTimeout || 60000, // 1 minute
      autoGainControl: options.autoGainControl !== undefined ? options.autoGainControl : true,
      echoCancellation: options.echoCancellation !== undefined ? options.echoCancellation : true,
      noiseSuppression: options.noiseSuppression !== undefined ? options.noiseSuppression : true,
      
      // Enhanced call quality monitoring settings
      callQualityMonitoring: {
        enabled: true,
        reportInterval: 5000, // Report every 5 seconds
        thresholds: {
          rtt: 300, // Round trip time threshold in ms
          packetLoss: 0.05, // 5% packet loss threshold
          jitter: 50, // Jitter threshold in ms
          bandwidthMin: 50000, // Minimum bandwidth in bps
          audioLevel: -50 // Minimum audio level in dB
        },
        adaptiveQuality: true, // Enable adaptive quality adjustments
        networkAdaptation: true // Enable network-based quality adaptation
      },
      
      // Screen sharing configuration
      screenSharing: {
        enabled: true,
        maxResolution: { width: 1920, height: 1080 },
        frameRate: 15,
        quality: 'high', // 'low', 'medium', 'high'
        cursor: 'always', // 'never', 'always', 'motion'
        audio: true, // Include system audio
        fallbackToVideo: true // Fallback to camera if screen sharing fails
      },
      
      // Group video call settings
      groupCall: {
        maxParticipants: 8,
        layoutOptions: ['grid', 'speaker', 'gallery'],
        defaultLayout: 'grid',
        enableSpatialAudio: false,
        bandwidthOptimization: true
      },
      
      container: document.getElementById('call-container') || document.body,
      userId: null,
      ...options
    };
    
    // State
    this.state = {
      currentUserId: null,
      localStream: null,
      screenShareStream: null,
      peerConnections: new Map(), // userId -> RTCPeerConnection
      calls: new Map(), // callId -> call object
      activeCall: null,
      incomingCall: null,
      isInitialized: false,
      deviceList: {
        audioInput: [],
        audioOutput: [],
        videoInput: []
      },
      selectedDevices: {
        audioInput: null,
        audioOutput: null,
        videoInput: null
      },
      isMuted: false,
      isVideoEnabled: true,
      isScreenSharing: false,
      isRecording: false
    };
    
    // Sub-modules
    this.signaling = new SignalingService(this.config);
    this.deviceManager = new DeviceManager(this.config);
    this.ui = new CallUI(this.config);
    this.recorder = new CallRecorder(this.config);
    this.connectionMonitor = new ConnectionMonitor(this.config);
    
    // Initialize WebRTC module
    this.init();
  }
  
  /**
   * Initialize the WebRTC module
   */
  async init() {
    try {
      // Get current user ID
      this.config.userId = app.getCurrentUserId();
      this.state.currentUserId = this.config.userId;
      
      // Check WebRTC compatibility
      const compatSummary = this.compatibilityManager.getCompatibilitySummary();
      console.log('WebRTC Compatibility:', compatSummary);
      
      // Emit compatibility status for UI to handle
      eventBus.emit('webrtc:compatibility-status', compatSummary);
      
      // Update configuration based on browser capabilities
      this.applyCompatibilitySettings();
      
      // Initialize signaling
      await this.signaling.connect();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Fetch TURN servers if needed
      await this.fetchTurnCredentials();
      
      // Initialize device manager
      await this.deviceManager.initialize();
      
      // Update device lists
      this.state.deviceList = this.deviceManager.getDeviceList();
      this.state.selectedDevices = this.deviceManager.getSelectedDevices();
      
      // Update UI
      this.ui.updateDeviceSelectors(this.state.deviceList, this.state.selectedDevices);
      
      this.state.isInitialized = true;
      console.log('WebRTC module initialized successfully');
      
      // Emit ready event
      eventBus.emit('webrtc:ready');
      
      return true;
    } catch (error) {
      errorHandler.handleError('Failed to initialize WebRTC module', error);
      
      // Check if we can use any fallbacks
      if (this.compatibilityManager.hasFallbackFor('webRTC')) {
        console.warn('Using fallback communication method');
        this.useFallbackCommunication();
      } else {
        // Emit error event
        eventBus.emit('webrtc:error', {
          type: 'initialization',
          message: 'Failed to initialize WebRTC. Video and voice calls will not be available.',
          error: error
        });
      }
      
      return false;
    }
  }
  
  /**
   * Apply browser compatibility settings
   */
  applyCompatibilitySettings() {
    // Get peer connection config with browser-specific settings
    const peerConfig = this.compatibilityManager.getPeerConnectionConfig({
      iceServers: [
        { urls: this.config.stunServers },
        ...this.config.turnServers
      ],
      iceTransportPolicy: this.config.iceTransportPolicy
    });
    
    // Update config with browser-specific settings
    this.config.peerConnectionConfig = peerConfig;
    
    // Apply media constraints with browser compatibility
    this.config.mediaConstraints = this.compatibilityManager.applyConstraints(this.config.mediaConstraints);
    
    // Update codec preferences if SDP munging is needed
    if (this.compatibilityManager.fallbackOptions.useSdpMunging) {
      this.config.applySdpTransform = true;
    }
    
    // Enable background blur only if supported
    this.config.backgroundBlurAvailable = this.compatibilityManager.capabilities.backgroundBlur;
    
    // Apply any other necessary adjustments
    if (this.compatibilityManager.fallbackOptions.forceTurn) {
      this.config.iceTransportPolicy = 'relay';
    }
  }
  
  /**
   * Fall back to alternative communication method if WebRTC isn't supported
   */
  useFallbackCommunication() {
    // Set up iframe-based communication or other fallback
    console.log('Setting up fallback communication method');
    
    // Create fallback messaging transport
    this.fallbackTransport = this.compatibilityManager.createMessageTransport(this.config.userId);
    
    if (this.fallbackTransport) {
      this.fallbackTransport.startListening();
      
      // Emit fallback ready event
      eventBus.emit('webrtc:fallback-ready');
    }
  }
  
  /**
   * Get TURN server credentials
   */
  async getTurnCredentials() {
    try {
      const response = await apiClient.get('/api/webrtc/turn-credentials.php');
      return response.data;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to get TURN credentials');
      return [];
    }
  }
  
  /**
   * Create RTCPeerConnection with appropriate configuration
   */
  async createPeerConnection(userId) {
    try {
      // Get TURN credentials if needed
      let iceServers = [
        { urls: this.config.stunServers }
      ];
      
      if (this.config.turnServers.length === 0) {
        const turnCredentials = await this.getTurnCredentials();
        if (turnCredentials && turnCredentials.length > 0) {
          iceServers = iceServers.concat(turnCredentials);
        }
      } else {
        iceServers = iceServers.concat(this.config.turnServers);
      }
      
      // Create RTCPeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: this.config.iceTransportPolicy,
        bundlePolicy: 'max-bundle',
        sdpSemantics: 'unified-plan'
      });
      
      // Add local streams
      if (this.state.localStream) {
        this.state.localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, this.state.localStream);
        });
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.signaling.sendIceCandidate(userId, event.candidate);
        }
      };
      
      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        switch(peerConnection.connectionState) {
          case 'connected':
            console.log('WebRTC connection established with', userId);
            eventBus.emit('webrtc:connected', { userId });
            break;
          case 'disconnected':
            console.log('WebRTC connection disconnected from', userId);
            eventBus.emit('webrtc:disconnected', { userId });
            break;
          case 'failed':
            console.error('WebRTC connection failed with', userId);
            this.handleConnectionFailure(userId);
            break;
          case 'closed':
            console.log('WebRTC connection closed with', userId);
            break;
        }
      };
      
      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        this.connectionMonitor.trackIceConnectionState(userId, peerConnection.iceConnectionState);
      };
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track from', userId);
        this.handleRemoteTrack(userId, event.streams[0]);
      };
      
      // Store peer connection
      this.state.peerConnections.set(userId, peerConnection);
      
      return peerConnection;
    } catch (error) {
      errorHandler.handleError(error, `Failed to create peer connection with ${userId}`);
      throw error;
    }
  }
  
  /**
   * Initialize media stream
   */
  async initializeLocalStream() {
    try {
      // Release existing stream if present
      if (this.state.localStream) {
        this.releaseMediaStream(this.state.localStream);
      }
      
      // Apply selected devices to constraints
      const constraints = { ...this.config.mediaConstraints };
      
      const selectedAudioInput = this.state.selectedDevices.audioInput;
      if (selectedAudioInput) {
        constraints.audio = {
          deviceId: { exact: selectedAudioInput },
          autoGainControl: this.config.autoGainControl,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression
        };
      }
      
      const selectedVideoInput = this.state.selectedDevices.videoInput;
      if (selectedVideoInput) {
        constraints.video = {
          ...constraints.video,
          deviceId: { exact: selectedVideoInput }
        };
      }
      
      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Store local stream
      this.state.localStream = stream;
      
      // Apply mute state if needed
      if (this.state.isMuted) {
        this.muteAudio();
      }
      
      if (!this.state.isVideoEnabled) {
        this.disableVideo();
      }
      
      // Display local stream in UI
      this.ui.displayLocalStream(stream);
      
      // Emit event
      eventBus.emit('webrtc:localStream', { stream });
      
      return stream;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initialize local media stream');
      
      // Fallback to audio only if video fails
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.warn('Video device not found, falling back to audio only');
        const audioOnlyConstraints = {
          audio: true,
          video: false
        };
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia(audioOnlyConstraints);
          this.state.localStream = audioOnlyStream;
          this.state.isVideoEnabled = false;
          this.ui.displayLocalStream(audioOnlyStream);
          eventBus.emit('webrtc:localStream', { stream: audioOnlyStream, audioOnly: true });
          return audioOnlyStream;
        } catch (audioError) {
          errorHandler.handleError(audioError, 'Failed to initialize audio stream');
          throw audioError;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Initiate a call to another user
   */
  async initiateCall(data) {
    try {
      const { userId, callType = 'video' } = data;
      
      // Check if already in a call
      if (this.state.activeCall) {
        throw new Error('Already in an active call');
      }
      
      // Initialize local stream if not already initialized
      if (!this.state.localStream) {
        // Adjust media constraints based on call type
        if (callType === 'audio') {
          this.config.mediaConstraints.video = false;
        }
        await this.initializeLocalStream();
      }
      
      // Create call object
      const callId = utils.generateUUID();
      const call = {
        id: callId,
        type: callType,
        initiator: this.state.currentUserId,
        receiver: userId,
        startTime: Date.now(),
        status: 'outgoing'
      };
      
      // Store call
      this.state.calls.set(callId, call);
      this.state.activeCall = callId;
      
      // Create peer connection
      const peerConnection = await this.createPeerConnection(userId);
      
      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      
      // Set local description
      await peerConnection.setLocalDescription(offer);
      
      // Send offer through signaling
      this.signaling.sendOffer(userId, {
        callId,
        type: callType,
        sdp: offer.sdp
      });
      
      // Update UI
      this.ui.showOutgoingCall(call);
      
      // Set call timeout
      setTimeout(() => {
        if (this.state.activeCall === callId && 
            this.state.calls.get(callId)?.status === 'outgoing') {
          this.handleCallTimeout(callId);
        }
      }, this.config.callTimeout);
      
      // Emit event
      eventBus.emit('call:initiated', { callId, userId, callType });
      
      return callId;
    } catch (error) {
      errorHandler.handleError(error, 'Failed to initiate call');
      this.ui.showCallError('Failed to initiate call', error.message);
      throw error;
    }
  }
  
  /**
   * Handle incoming call offer
   */
  async handleIncomingOffer(data) {
    try {
      const { from, offer } = data;
      const { callId, type, sdp } = offer;
      
      console.log('Received call offer from', from, 'callId:', callId);
      
      // Create call object
      const call = {
        id: callId,
        type,
        initiator: from,
        receiver: this.state.currentUserId,
        startTime: Date.now(),
        status: 'incoming'
      };
      
      // Store call
      this.state.calls.set(callId, call);
      this.state.incomingCall = callId;
      
      // Get caller info
      let callerInfo = { name: `User ${from}` };
      try {
        const response = await apiClient.get(`/api/users.php?id=${from}`);
        callerInfo = response.data;
      } catch (error) {
        console.warn('Could not fetch caller info:', error);
      }
      
      // Update UI with incoming call
      this.ui.showIncomingCall(call, callerInfo);
      
      // Create peer connection
      const peerConnection = await this.createPeerConnection(from);
      
      // Set remote description
      const remoteDesc = new RTCSessionDescription({ type: 'offer', sdp });
      await peerConnection.setRemoteDescription(remoteDesc);
      
      // Emit event
      eventBus.emit('call:incoming', { callId, userId: from, callType: type });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle incoming call offer');
      this.rejectCall({ callId: data.offer.callId });
    }
  }
  
  /**
   * Accept incoming call
   */
  async acceptCall(data) {
    try {
      const { callId = this.state.incomingCall } = data;
      
      if (!callId) {
        throw new Error('No incoming call to accept');
      }
      
      const call = this.state.calls.get(callId);
      if (!call) {
        throw new Error('Call not found');
      }
      
      // Initialize local stream if not already initialized
      if (!this.state.localStream) {
        // Adjust media constraints based on call type
        if (call.type === 'audio') {
          this.config.mediaConstraints.video = false;
        }
        await this.initializeLocalStream();
      }
      
      // Set as active call
      this.state.activeCall = callId;
      this.state.incomingCall = null;
      
      // Update call status
      call.status = 'active';
      call.connectTime = Date.now();
      
      // Get peer connection
      const peerConnection = this.state.peerConnections.get(call.initiator);
      
      // Create answer
      const answer = await peerConnection.createAnswer();
      
      // Set local description
      await peerConnection.setLocalDescription(answer);
      
      // Send answer through signaling
      this.signaling.sendAnswer(call.initiator, {
        callId,
        sdp: answer.sdp
      });
      
      // Update UI
      this.ui.showActiveCall(call);
      
      // Start monitoring connection quality
      this.connectionMonitor.startMonitoring(call.initiator, peerConnection);
      
      // Emit event
      eventBus.emit('call:accepted', { callId, userId: call.initiator });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to accept call');
      this.ui.showCallError('Failed to accept call', error.message);
    }
  }
  
  /**
   * Reject incoming call
   */
  rejectCall(data) {
    try {
      const { callId = this.state.incomingCall } = data;
      
      if (!callId) {
        return;
      }
      
      const call = this.state.calls.get(callId);
      if (!call) {
        return;
      }
      
      // Send hangup through signaling
      this.signaling.sendHangup(call.initiator, { callId });
      
      // Update call status
      call.status = 'rejected';
      call.endTime = Date.now();
      
      // Clear incoming call
      this.state.incomingCall = null;
      
      // Clean up UI
      this.ui.hideIncomingCall();
      
      // Emit event
      eventBus.emit('call:rejected', { callId, userId: call.initiator });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to reject call');
    }
  }
  
  /**
   * Handle incoming answer to our offer
   */
  async handleIncomingAnswer(data) {
    try {
      const { from, answer } = data;
      const { callId, sdp } = answer;
      
      console.log('Received call answer from', from, 'callId:', callId);
      
      // Check if call exists
      if (!this.state.calls.has(callId)) {
        console.warn('Received answer for non-existent call:', callId);
        return;
      }
      
      // Get call and update status
      const call = this.state.calls.get(callId);
      call.status = 'active';
      call.connectTime = Date.now();
      
      // Get peer connection
      const peerConnection = this.state.peerConnections.get(from);
      if (!peerConnection) {
        console.warn('No peer connection for user:', from);
        return;
      }
      
      // Set remote description
      const remoteDesc = new RTCSessionDescription({ type: 'answer', sdp });
      await peerConnection.setRemoteDescription(remoteDesc);
      
      // Update UI
      this.ui.showActiveCall(call);
      
      // Start monitoring connection quality
      this.connectionMonitor.startMonitoring(from, peerConnection);
      
      // Emit event
      eventBus.emit('call:connected', { callId, userId: from });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle incoming answer');
    }
  }
  
  /**
   * Handle ICE candidate from remote peer
   */
  async handleIceCandidate(data) {
    try {
      const { from, candidate } = data;
      
      // Get peer connection
      const peerConnection = this.state.peerConnections.get(from);
      if (!peerConnection) {
        console.warn('No peer connection for user:', from);
        return;
      }
      
      // Add ICE candidate
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle ICE candidate');
    }
  }
  
  /**
   * Handle remote hangup
   */
  handleRemoteHangup(data) {
    try {
      const { from, hangup } = data;
      const { callId } = hangup;
      
      console.log('Received hangup from', from, 'callId:', callId);
      
      // Check if call exists
      if (!this.state.calls.has(callId)) {
        console.warn('Received hangup for non-existent call:', callId);
        return;
      }
      
      // Get call and update status
      const call = this.state.calls.get(callId);
      call.status = 'ended';
      call.endTime = Date.now();
      
      // Clean up resources
      this.cleanupCall(callId);
      
      // Show call ended UI
      this.ui.showCallEnded(call);
      
      // Emit event
      eventBus.emit('call:ended', { 
        callId, 
        userId: from, 
        duration: call.endTime - (call.connectTime || call.startTime) 
      });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle remote hangup');
    }
  }
  
  /**
   * Handle connection failure
   */
  handleConnectionFailure(userId) {
    try {
      console.error('Connection failed with', userId);
      
      // Find the call associated with this user
      let failedCallId = null;
      for (const [callId, call] of this.state.calls.entries()) {
        if ((call.initiator === userId || call.receiver === userId) && 
            call.status === 'active') {
          failedCallId = callId;
          break;
        }
      }
      
      if (!failedCallId) {
        return;
      }
      
      // Get call and update status
      const call = this.state.calls.get(failedCallId);
      call.status = 'failed';
      call.endTime = Date.now();
      
      // Clean up resources
      this.cleanupCall(failedCallId);
      
      // Show connection failed UI
      this.ui.showCallError('Call Disconnected', 'The connection with the remote peer was lost.');
      
      // Emit event
      eventBus.emit('call:failed', { 
        callId: failedCallId, 
        userId,
        reason: 'connection_failed'
      });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle connection failure');
    }
  }
  
  /**
   * Handle call timeout (no answer)
   */
  handleCallTimeout(callId) {
    try {
      // Check if call exists and is still outgoing
      if (!this.state.calls.has(callId)) {
        return;
      }
      
      const call = this.state.calls.get(callId);
      if (call.status !== 'outgoing') {
        return;
      }
      
      // Update call status
      call.status = 'no_answer';
      call.endTime = Date.now();
      
      // Send hangup to receiver
      this.signaling.sendHangup(call.receiver, { callId });
      
      // Clean up resources
      this.cleanupCall(callId);
      
      // Show no answer UI
      this.ui.showCallEnded(call, 'No Answer');
      
      // Emit event
      eventBus.emit('call:no_answer', { 
        callId,
        userId: call.receiver
      });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to handle call timeout');
    }
  }
  
  /**
   * Handle signaling open event
   */
  handleSignalingOpen() {
    console.log('Signaling connection established');
    eventBus.emit('webrtc:signaling:connected');
  }
  
  /**
   * Handle signaling error
   */
  handleSignalingError(error) {
    errorHandler.handleError(error, 'Signaling error');
    eventBus.emit('webrtc:signaling:error', { error });
  }
  
  /**
   * Handle remote media track
   */
  handleRemoteTrack(userId, stream) {
    // Find call associated with this user
    let callId = null;
    for (const [id, call] of this.state.calls.entries()) {
      if ((call.initiator === userId || call.receiver === userId) && 
          call.status === 'active') {
        callId = id;
        break;
      }
    }
    
    if (!callId) {
      console.warn('Received track for unknown call from user:', userId);
      return;
    }
    
    // Display remote stream in UI
    this.ui.displayRemoteStream(userId, stream);
    
    // Emit event
    eventBus.emit('webrtc:remoteStream', { 
      userId,
      callId,
      stream
    });
  }
  
  /**
   * End active call (hangup)
   */
  async hangup() {
    try {
      if (!this.state.activeCall) {
        return;
      }
      
      const callId = this.state.activeCall;
      const call = this.state.calls.get(callId);
      
      if (!call) {
        return;
      }
      
      // Determine remote user
      const remoteUser = call.initiator === this.state.currentUserId ? 
                         call.receiver : call.initiator;
      
      // Send hangup through signaling
      this.signaling.sendHangup(remoteUser, { callId });
      
      // Update call status
      call.status = 'ended';
      call.endTime = Date.now();
      
      // Stop recording if active
      if (this.state.isRecording) {
        await this.stopRecording();
      }
      
      // Clean up resources
      this.cleanupCall(callId);
      
      // Show call ended UI
      this.ui.showCallEnded(call);
      
      // Emit event
      eventBus.emit('call:ended', { 
        callId,
        userId: remoteUser,
        duration: call.endTime - (call.connectTime || call.startTime),
        initiatedByUser: true
      });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to hangup call');
    }
  }
  
  /**
   * Clean up resources for a call
   */
  cleanupCall(callId) {
    try {
      // Clear active call if it matches
      if (this.state.activeCall === callId) {
        this.state.activeCall = null;
      }
      
      // Clear incoming call if it matches
      if (this.state.incomingCall === callId) {
        this.state.incomingCall = null;
      }
      
      // Get call details
      const call = this.state.calls.get(callId);
      if (!call) return;
      
      // Get remote user
      const remoteUser = call.initiator === this.state.currentUserId ? 
                         call.receiver : call.initiator;
      
      // Close and remove peer connection
      const peerConnection = this.state.peerConnections.get(remoteUser);
      if (peerConnection) {
        this.connectionMonitor.stopMonitoring(remoteUser);
        peerConnection.close();
        this.state.peerConnections.delete(remoteUser);
      }
      
      // Stop screen sharing if active
      if (this.state.isScreenSharing) {
        this.stopScreenSharing();
      }
      
    } catch (error) {
      errorHandler.handleError(error, 'Error during call cleanup');
    }
  }
  
  /**
   * Toggle audio mute state
   */
  toggleMute() {
    if (this.state.isMuted) {
      this.unmuteAudio();
    } else {
      this.muteAudio();
    }
    return this.state.isMuted;
  }
  
  /**
   * Mute audio
   */
  muteAudio() {
    if (!this.state.localStream) return;
    
    const audioTracks = this.state.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = false;
    });
    
    this.state.isMuted = true;
    this.ui.updateMuteState(true);
    
    eventBus.emit('webrtc:muted');
  }
  
  /**
   * Unmute audio
   */
  unmuteAudio() {
    if (!this.state.localStream) return;
    
    const audioTracks = this.state.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = true;
    });
    
    this.state.isMuted = false;
    this.ui.updateMuteState(false);
    
    eventBus.emit('webrtc:unmuted');
  }
  
  /**
   * Toggle video enabled state
   */
  toggleVideo() {
    if (this.state.isVideoEnabled) {
      this.disableVideo();
    } else {
      this.enableVideo();
    }
    return this.state.isVideoEnabled;
  }
  
  /**
   * Disable video
   */
  disableVideo() {
    if (!this.state.localStream) return;
    
    const videoTracks = this.state.localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = false;
    });
    
    this.state.isVideoEnabled = false;
    this.ui.updateVideoState(false);
    
    eventBus.emit('webrtc:videoDisabled');
  }
  
  /**
   * Enable video
   */
  async enableVideo() {
    if (!this.state.localStream) return;
    
    // Check if we have video tracks
    const videoTracks = this.state.localStream.getVideoTracks();
    
    if (videoTracks.length === 0) {
      // No video tracks, try to add video
      try {
        // Get video stream
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: this.config.mediaConstraints.video 
        });
        
        // Add video tracks to existing stream
        videoStream.getVideoTracks().forEach(track => {
          this.state.localStream.addTrack(track);
          
          // Add to all peer connections
          for (const [userId, pc] of this.state.peerConnections.entries()) {
            pc.addTrack(track, this.state.localStream);
          }
        });
        
      } catch (error) {
        errorHandler.handleError(error, 'Failed to enable video');
        return;
      }
    } else {
      // Enable existing video tracks
      videoTracks.forEach(track => {
        track.enabled = true;
      });
    }
    
    this.state.isVideoEnabled = true;
    this.ui.updateVideoState(true);
    
    eventBus.emit('webrtc:videoEnabled');
  }
  
  /**
   * Toggle screen sharing
   */
  async toggleScreenShare() {
    if (this.state.isScreenSharing) {
      await this.stopScreenSharing();
    } else {
      await this.startScreenSharing();
    }
    return this.state.isScreenSharing;
  }
  
  /**
   * Start screen sharing
   */
  async startScreenSharing() {
    try {
      if (!this.state.activeCall) {
        throw new Error('No active call for screen sharing');
      }
      
      // Get screen share stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          cursor: 'always' 
        },
        audio: false
      });
      
      // Store screen share stream
      this.state.screenShareStream = screenStream;
      
      // Add screen track to all peer connections
      const screenTrack = screenStream.getVideoTracks()[0];
      
      for (const [userId, pc] of this.state.peerConnections.entries()) {
        // Find and replace the video sender
        const senders = pc.getSenders();
        const videoSender = senders.find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, screenStream);
        }
      }
      
      // Handle when user stops sharing screen
      screenTrack.onended = () => {
        this.stopScreenSharing();
      };
      
      // Update state and UI
      this.state.isScreenSharing = true;
      this.ui.updateScreenShareState(true);
      
      // Also display screen share in local view
      this.ui.displayLocalStream(screenStream, true);
      
      // Emit event
      eventBus.emit('webrtc:screenShareStarted');
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to start screen sharing');
      
      // User probably canceled the screen share dialog
      if (error.name === 'NotAllowedError') {
        console.log('User cancelled screen sharing');
      } else {
        this.ui.showCallError('Screen Sharing Failed', error.message);
      }
    }
  }
  
  /**
   * Stop screen sharing
   */
  async stopScreenSharing() {
    try {
      if (!this.state.screenShareStream) {
        return;
      }
      
      // Stop all tracks
      this.state.screenShareStream.getTracks().forEach(track => {
        track.stop();
      });
      
      // Replace screen track with video track from local stream
      if (this.state.localStream) {
        const videoTrack = this.state.localStream.getVideoTracks()[0];
        
        if (videoTrack) {
          for (const [userId, pc] of this.state.peerConnections.entries()) {
            // Find and replace the video sender
            const senders = pc.getSenders();
            const videoSender = senders.find(sender => 
              sender.track && sender.track.kind === 'video'
            );
            
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            }
          }
          
          // Display local stream again
          this.ui.displayLocalStream(this.state.localStream);
        }
      }
      
      // Update state and UI
      this.state.isScreenSharing = false;
      this.state.screenShareStream = null;
      this.ui.updateScreenShareState(false);
      
      // Emit event
      eventBus.emit('webrtc:screenShareStopped');
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to stop screen sharing');
    }
  }
  
  /**
   * Switch audio/video device
   */
  async switchDevice(data) {
    try {
      const { deviceType, deviceId } = data;
      
      if (!['audioInput', 'audioOutput', 'videoInput'].includes(deviceType)) {
        throw new Error('Invalid device type');
      }
      
      // Store selected device
      this.state.selectedDevices[deviceType] = deviceId;
      this.deviceManager.setSelectedDevice(deviceType, deviceId);
      
      // For audio output, just set the sink ID on the audio elements
      if (deviceType === 'audioOutput') {
        this.ui.setAudioOutputDevice(deviceId);
        return;
      }
      
      // For input devices, need to get new media stream
      if (!this.state.activeCall) {
        // If no active call, just update the selected device for future use
        return;
      }
      
      // Stop existing tracks of the corresponding type
      if (this.state.localStream) {
        const trackType = deviceType === 'audioInput' ? 'audio' : 'video';
        const tracks = this.state.localStream.getTracks().filter(track => track.kind === trackType);
        
        tracks.forEach(track => {
          track.stop();
        });
      }
      
      // Get new stream with the selected device
      const constraints = {};
      
      if (deviceType === 'audioInput') {
        constraints.audio = {
          deviceId: { exact: deviceId },
          autoGainControl: this.config.autoGainControl,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression
        };
      } else if (deviceType === 'videoInput') {
        constraints.video = {
          ...this.config.mediaConstraints.video,
          deviceId: { exact: deviceId }
        };
      }
      
      // Get new track
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add new tracks to local stream
      newStream.getTracks().forEach(track => {
        // Remove old track of same type from local stream
        const oldTracks = this.state.localStream.getTracks().filter(t => t.kind === track.kind);
        oldTracks.forEach(oldTrack => {
          this.state.localStream.removeTrack(oldTrack);
        });
        
        // Add new track to local stream
        this.state.localStream.addTrack(track);
        
        // Replace track in all peer connections
        for (const [userId, pc] of this.state.peerConnections.entries()) {
          const senders = pc.getSenders();
          const sender = senders.find(s => s.track && s.track.kind === track.kind);
          
          if (sender) {
            sender.replaceTrack(track);
          }
        }
      });
      
      // Apply mute/video disabled state if needed
      if (deviceType === 'audioInput' && this.state.isMuted) {
        this.muteAudio();
      } else if (deviceType === 'videoInput' && !this.state.isVideoEnabled) {
        this.disableVideo();
      }
      
      // Update UI
      this.ui.displayLocalStream(this.state.localStream);
      
      // Emit event
      eventBus.emit('webrtc:deviceSwitched', { deviceType, deviceId });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to switch device');
      this.ui.showCallError('Device Switch Failed', error.message);
    }
  }
  
  /**
   * Toggle call recording
   */
  async toggleRecording() {
    if (this.state.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
    return this.state.isRecording;
  }
  
  /**
   * Start call recording
   */
  async startRecording() {
    try {
      if (!this.state.activeCall) {
        throw new Error('No active call to record');
      }
      
      const callId = this.state.activeCall;
      const call = this.state.calls.get(callId);
      
      if (!call) {
        throw new Error('Call not found');
      }
      
      // Determine remote user
      const remoteUser = call.initiator === this.state.currentUserId ? 
                        call.receiver : call.initiator;
      
      // Get streams to record
      const streams = [];
      
      // Add local stream
      if (this.state.localStream) {
        streams.push(this.state.localStream);
      }
      
      // Add remote stream
      const peerConnection = this.state.peerConnections.get(remoteUser);
      if (peerConnection) {
        const receivers = peerConnection.getReceivers();
        const remoteStreams = receivers.map(receiver => receiver.track);
        if (remoteStreams.length > 0) {
          // Create a MediaStream from the remote tracks
          const remoteStream = new MediaStream(remoteStreams);
          streams.push(remoteStream);
        }
      }
      
      // Start recording
      await this.recorder.start(streams, callId);
      
      // Update state and UI
      this.state.isRecording = true;
      this.ui.updateRecordingState(true);
      
      // Emit event
      eventBus.emit('call:recordingStarted', { callId });
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to start recording');
      this.ui.showCallError('Recording Failed', error.message);
    }
  }
  
  /**
   * Stop call recording
   */
  async stopRecording() {
    try {
      if (!this.state.isRecording) {
        return;
      }
      
      // Stop recording
      const recordingResult = await this.recorder.stop();
      
      // Update state and UI
      this.state.isRecording = false;
      this.ui.updateRecordingState(false);
      
      // Emit event
      eventBus.emit('call:recordingStopped', { 
        callId: this.state.activeCall,
        recording: recordingResult
      });
      
      return recordingResult;
      
    } catch (error) {
      errorHandler.handleError(error, 'Failed to stop recording');
      this.ui.showCallError('Recording Stop Failed', error.message);
    }
  }
  
  /**
   * Release media stream and stop all tracks
   */
  releaseMediaStream(stream) {
    if (!stream) return;
    
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // End any active call
    if (this.state.activeCall) {
      this.hangup();
    }
    
    // Close all peer connections
    for (const [userId, pc] of this.state.peerConnections.entries()) {
      this.connectionMonitor.stopMonitoring(userId);
      pc.close();
    }
    this.state.peerConnections.clear();
    
    // Release media streams
    if (this.state.localStream) {
      this.releaseMediaStream(this.state.localStream);
      this.state.localStream = null;
    }
    
    if (this.state.screenShareStream) {
      this.releaseMediaStream(this.state.screenShareStream);
      this.state.screenShareStream = null;
    }
    
    // Close signaling connection
    this.signaling.disconnect();
    
    // Remove event listeners
    eventBus.off('call:request', this.initiateCall);
    
    // Cleanup UI
    this.ui.cleanup();
    
    console.log('WebRTC module destroyed');
  }
}

// Export singleton instance
export default WebRTCModule;

// For backwards compatibility with legacy code
if (typeof window !== 'undefined') {
  window.WebRTCModule = WebRTCModule;
}
