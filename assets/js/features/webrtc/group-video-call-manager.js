/**
 * Group Video Call Manager
 * Handles multi-participant video calls with advanced features
 */

import SignalingService from './signaling.js';
import DeviceManager from './device-manager.js';
import CallRecorder from './call-recorder.js';
import ScreenSharingManager from './screen-sharing-manager.js';
import ConnectionMonitor from './connection-monitor.js';

class GroupVideoCallManager {
  constructor(config = {}) {
    this.config = {
      maxParticipants: config.maxParticipants || 8,
      enableScreenSharing: config.enableScreenSharing !== false,
      enableRecording: config.enableRecording !== false,
      adaptiveQuality: config.adaptiveQuality !== false,
      simulcast: config.simulcast !== false,
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      ...config
    };

    // Core components
    this.signalingService = new SignalingService(this.config);
    this.deviceManager = new DeviceManager();
    this.callRecorder = new CallRecorder();
    this.screenSharingManager = new ScreenSharingManager();
    this.connectionMonitor = new ConnectionMonitor();

    // Call state
    this.currentCall = null;
    this.participants = new Map();
    this.peerConnections = new Map();
    this.localStream = null;
    this.screenShareStream = null;
    this.isHost = false;
    this.callId = null;
    this.groupId = null;

    // UI state
    this.layoutMode = 'grid'; // 'grid', 'spotlight', 'sidebar'
    this.dominantSpeaker = null;
    this.pinnedParticipant = null;
    this.isRecording = false;
    this.isSharingScreen = false;

    // Event handlers
    this.eventHandlers = new Map();

    // Initialize
    this.init();
  }

  /**
   * Initialize group video call manager
   */
  async init() {
    console.log('Initializing group video call manager...');

    // Initialize components
    await this.deviceManager.init();
    await this.signalingService.connect();

    // Set up signaling event handlers
    this.setupSignalingHandlers();

    // Set up UI event handlers
    this.setupUIHandlers();

    console.log('Group video call manager initialized');
  }

  /**
   * Set up signaling event handlers
   */
  setupSignalingHandlers() {
    this.signalingService.on('call-invitation', this.handleCallInvitation.bind(this));
    this.signalingService.on('participant-joined', this.handleParticipantJoined.bind(this));
    this.signalingService.on('participant-left', this.handleParticipantLeft.bind(this));
    this.signalingService.on('offer', this.handleOffer.bind(this));
    this.signalingService.on('answer', this.handleAnswer.bind(this));
    this.signalingService.on('ice-candidate', this.handleIceCandidate.bind(this));
    this.signalingService.on('call-ended', this.handleCallEnded.bind(this));
    this.signalingService.on('participant-muted', this.handleParticipantMuted.bind(this));
    this.signalingService.on('participant-video-disabled', this.handleParticipantVideoDisabled.bind(this));
    this.signalingService.on('screen-share-started', this.handleScreenShareStarted.bind(this));
    this.signalingService.on('screen-share-stopped', this.handleScreenShareStopped.bind(this));
    this.signalingService.on('dominant-speaker-changed', this.handleDominantSpeakerChanged.bind(this));
  }

  /**
   * Set up UI event handlers
   */
  setupUIHandlers() {
    // Camera and microphone controls
    document.addEventListener('click', (event) => {
      if (event.target.matches('.toggle-camera')) {
        this.toggleCamera();
      } else if (event.target.matches('.toggle-microphone')) {
        this.toggleMicrophone();
      } else if (event.target.matches('.share-screen')) {
        this.toggleScreenShare();
      } else if (event.target.matches('.record-call')) {
        this.toggleRecording();
      } else if (event.target.matches('.end-call')) {
        this.endCall();
      } else if (event.target.matches('.change-layout')) {
        this.cycleLayout();
      }
    });

    // Layout change handlers
    document.addEventListener('participantDoubleClick', (event) => {
      this.toggleSpotlight(event.detail.participantId);
    });

    // Keyboard shortcuts for accessibility
    document.addEventListener('keydown', (event) => {
      if (!this.currentCall) return;

      switch (event.code) {
        case 'KeyM':
          if (event.ctrlKey) {
            event.preventDefault();
            this.toggleMicrophone();
          }
          break;
        case 'KeyV':
          if (event.ctrlKey) {
            event.preventDefault();
            this.toggleCamera();
          }
          break;
        case 'KeyS':
          if (event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            this.toggleScreenShare();
          }
          break;
        case 'KeyR':
          if (event.ctrlKey && event.shiftKey) {
            event.preventDefault();
            this.toggleRecording();
          }
          break;
        case 'KeyL':
          if (event.ctrlKey) {
            event.preventDefault();
            this.cycleLayout();
          }
          break;
      }
    });
  }

  /**
   * Start a group video call
   */
  async startGroupCall(groupId, participants = []) {
    try {
      console.log('Starting group call for group:', groupId);

      this.groupId = groupId;
      this.isHost = true;
      this.callId = this.generateCallId();

      // Get user media
      this.localStream = await this.deviceManager.getUserMedia({
        video: true,
        audio: true
      });

      // Create call UI
      this.createCallUI();

      // Add local stream to UI
      this.addParticipantToUI('local', this.localStream, { isLocal: true });

      // Invite participants
      for (const participantId of participants) {
        await this.inviteParticipant(participantId);
      }

      // Set call state
      this.currentCall = {
        id: this.callId,
        groupId,
        participants: new Set(['local', ...participants]),
        startTime: Date.now(),
        isGroup: true
      };

      // Start connection monitoring
      this.connectionMonitor.startMonitoring();

      this.emit('call-started', {
        callId: this.callId,
        groupId,
        participants
      });

      console.log('Group call started successfully');
    } catch (error) {
      console.error('Failed to start group call:', error);
      this.emit('call-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Join an existing group call
   */
  async joinGroupCall(callId, groupId) {
    try {
      console.log('Joining group call:', callId);

      this.callId = callId;
      this.groupId = groupId;
      this.isHost = false;

      // Get user media
      this.localStream = await this.deviceManager.getUserMedia({
        video: true,
        audio: true
      });

      // Create call UI
      this.createCallUI();

      // Add local stream to UI
      this.addParticipantToUI('local', this.localStream, { isLocal: true });

      // Join call via signaling
      await this.signalingService.joinCall(callId);

      // Set call state
      this.currentCall = {
        id: callId,
        groupId,
        participants: new Set(['local']),
        startTime: Date.now(),
        isGroup: true
      };

      this.emit('call-joined', {
        callId,
        groupId
      });

      console.log('Joined group call successfully');
    } catch (error) {
      console.error('Failed to join group call:', error);
      this.emit('call-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Invite participant to the call
   */
  async inviteParticipant(participantId) {
    if (this.participants.size >= this.config.maxParticipants) {
      throw new Error('Maximum participants limit reached');
    }

    await this.signalingService.inviteToCall(this.callId, participantId);
  }

  /**
   * Handle call invitation
   */
  async handleCallInvitation(data) {
    const { callId, groupId, inviterId } = data;

    this.emit('call-invitation', {
      callId,
      groupId,
      inviterId,
      accept: () => this.joinGroupCall(callId, groupId),
      decline: () => this.declineCall(callId)
    });
  }

  /**
   * Handle participant joined
   */
  async handleParticipantJoined(data) {
    const { participantId, participantInfo } = data;

    console.log('Participant joined:', participantId);

    // Create peer connection for new participant
    const peerConnection = await this.createPeerConnection(participantId);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    // If we're the host, create offer
    if (this.isHost) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await this.signalingService.sendOffer(this.callId, participantId, offer);
    }

    // Add participant to UI
    this.addParticipantToUI(participantId, null, participantInfo);

    this.emit('participant-joined', { participantId, participantInfo });
  }

  /**
   * Handle participant left
   */
  handleParticipantLeft(data) {
    const { participantId } = data;

    console.log('Participant left:', participantId);

    // Close peer connection
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(participantId);
    }

    // Remove from participants
    this.participants.delete(participantId);

    // Remove from UI
    this.removeParticipantFromUI(participantId);

    this.emit('participant-left', { participantId });
  }

  /**
   * Create peer connection for participant
   */
  async createPeerConnection(participantId) {
    const peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: 10
    });

    // Handle ice candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingService.sendIceCandidate(
          this.callId,
          participantId,
          event.candidate
        );
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream from:', participantId);
      const [remoteStream] = event.streams;
      this.addParticipantStream(participantId, remoteStream);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(participantId);
      }
    };

    // Store peer connection
    this.peerConnections.set(participantId, peerConnection);

    return peerConnection;
  }

  /**
   * Handle WebRTC offer
   */
  async handleOffer(data) {
    const { participantId, offer } = data;
    
    const peerConnection = this.peerConnections.get(participantId) ||
                          await this.createPeerConnection(participantId);

    await peerConnection.setRemoteDescription(offer);

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream);
      });
    }

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await this.signalingService.sendAnswer(this.callId, participantId, answer);
  }

  /**
   * Handle WebRTC answer
   */
  async handleAnswer(data) {
    const { participantId, answer } = data;
    
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
    }
  }

  /**
   * Handle ICE candidate
   */
  async handleIceCandidate(data) {
    const { participantId, candidate } = data;
    
    const peerConnection = this.peerConnections.get(participantId);
    if (peerConnection) {
      await peerConnection.addIceCandidate(candidate);
    }
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this.updateLocalVideo(videoTrack.enabled);
      this.signalingService.notifyVideoToggle(this.callId, videoTrack.enabled);
    }
  }

  /**
   * Toggle microphone on/off
   */
  toggleMicrophone() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      this.updateLocalAudio(audioTrack.enabled);
      this.signalingService.notifyAudioToggle(this.callId, audioTrack.enabled);
    }
  }

  /**
   * Toggle screen sharing
   */
  async toggleScreenShare() {
    if (this.isSharingScreen) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare() {
    try {
      this.screenShareStream = await this.screenSharingManager.startScreenShare();
      
      // Replace video track in peer connections
      const videoTrack = this.screenShareStream.getVideoTracks()[0];
      for (const [participantId, peerConnection] of this.peerConnections) {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      this.isSharingScreen = true;
      this.updateScreenShareUI(true);
      this.signalingService.notifyScreenShare(this.callId, true);

      // Handle screen sharing end
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

    } catch (error) {
      console.error('Failed to start screen sharing:', error);
      this.emit('screen-share-error', { error: error.message });
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare() {
    if (!this.isSharingScreen) return;

    try {
      // Stop screen sharing
      this.screenSharingManager.stopScreenShare();

      // Replace with camera stream
      const videoTrack = this.localStream?.getVideoTracks()[0];
      if (videoTrack) {
        for (const [participantId, peerConnection] of this.peerConnections) {
          const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
      }

      this.isSharingScreen = false;
      this.screenShareStream = null;
      this.updateScreenShareUI(false);
      this.signalingService.notifyScreenShare(this.callId, false);

    } catch (error) {
      console.error('Failed to stop screen sharing:', error);
    }
  }

  /**
   * Toggle call recording
   */
  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * Start call recording
   */
  async startRecording() {
    if (!this.config.enableRecording) return;

    try {
      // Collect all streams
      const streams = [this.localStream];
      for (const participant of this.participants.values()) {
        if (participant.stream) {
          streams.push(participant.stream);
        }
      }

      await this.callRecorder.start(streams, this.callId);
      this.isRecording = true;
      this.updateRecordingUI(true);

      this.emit('recording-started', { callId: this.callId });

    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emit('recording-error', { error: error.message });
    }
  }

  /**
   * Stop call recording
   */
  async stopRecording() {
    if (!this.isRecording) return;

    try {
      const recordingData = await this.callRecorder.stop();
      this.isRecording = false;
      this.updateRecordingUI(false);

      this.emit('recording-stopped', { 
        callId: this.callId, 
        recordingData 
      });

    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }

  /**
   * Change layout mode
   */
  cycleLayout() {
    const layouts = ['grid', 'spotlight', 'sidebar'];
    const currentIndex = layouts.indexOf(this.layoutMode);
    this.layoutMode = layouts[(currentIndex + 1) % layouts.length];
    
    this.updateLayoutUI(this.layoutMode);
    this.emit('layout-changed', { layout: this.layoutMode });
  }

  /**
   * End the call
   */
  async endCall() {
    if (!this.currentCall) return;

    console.log('Ending group call:', this.callId);

    // Stop all streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.screenShareStream) {
      this.screenShareStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    for (const peerConnection of this.peerConnections.values()) {
      peerConnection.close();
    }

    // Stop recording if active
    if (this.isRecording) {
      await this.stopRecording();
    }

    // Notify signaling server
    await this.signalingService.endCall(this.callId);

    // Clean up state
    this.cleanup();

    this.emit('call-ended', { callId: this.callId });
  }

  /**
   * Clean up call state
   */
  cleanup() {
    this.currentCall = null;
    this.participants.clear();
    this.peerConnections.clear();
    this.localStream = null;
    this.screenShareStream = null;
    this.isHost = false;
    this.callId = null;
    this.groupId = null;
    this.isSharingScreen = false;
    this.isRecording = false;

    // Remove call UI
    this.removeCallUI();

    // Stop monitoring
    this.connectionMonitor.stopMonitoring();
  }

  /**
   * Generate unique call ID
   */
  generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event emitter functionality
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Event handler error:', error);
        }
      });
    }
  }

  // UI management methods (simplified placeholders)
  createCallUI() { console.log('Create call UI'); }
  removeCallUI() { console.log('Remove call UI'); }
  addParticipantToUI(id, stream, info) { console.log('Add participant to UI:', id); }
  removeParticipantFromUI(id) { console.log('Remove participant from UI:', id); }
  addParticipantStream(id, stream) { console.log('Add participant stream:', id); }
  updateLocalVideo(enabled) { console.log('Update local video:', enabled); }
  updateLocalAudio(enabled) { console.log('Update local audio:', enabled); }
  updateScreenShareUI(enabled) { console.log('Update screen share UI:', enabled); }
  updateRecordingUI(enabled) { console.log('Update recording UI:', enabled); }
  updateLayoutUI(layout) { console.log('Update layout UI:', layout); }
  handleConnectionFailure(participantId) { console.log('Handle connection failure:', participantId); }
  handleDominantSpeakerChanged(data) { console.log('Dominant speaker changed:', data); }
  handleParticipantMuted(data) { console.log('Participant muted:', data); }
  handleParticipantVideoDisabled(data) { console.log('Participant video disabled:', data); }
  handleScreenShareStarted(data) { console.log('Screen share started:', data); }
  handleScreenShareStopped(data) { console.log('Screen share stopped:', data); }
  handleCallEnded(data) { console.log('Call ended:', data); }
  declineCall(callId) { console.log('Decline call:', callId); }
  toggleSpotlight(participantId) { console.log('Toggle spotlight:', participantId); }
}

export default GroupVideoCallManager;
