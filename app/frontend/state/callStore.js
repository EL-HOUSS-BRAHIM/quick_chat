/**
 * Call Store - WebRTC Call State Management
 * 
 * Manages state for voice and video calls, including active calls,
 * call history, and call-related UI state.
 */

import { EventBus } from '../services/EventBus.js';

class CallStore {
  constructor() {
    this.eventBus = new EventBus();
    this.state = {
      // Active call information
      activeCall: null,
      isInCall: false,
      callType: null, // 'audio', 'video', 'group-video'
      callStatus: 'idle', // 'idle', 'connecting', 'ringing', 'connected', 'ended'
      
      // Call participants
      participants: new Map(),
      localStream: null,
      remoteStreams: new Map(),
      
      // Call settings
      isMuted: false,
      isVideoEnabled: true,
      isSpeakerOn: false,
      
      // Group call specific
      isScreenSharing: false,
      screenShareStream: null,
      activeSpeaker: null,
      
      // Call history
      callHistory: [],
      
      // Recording
      isRecording: false,
      recordingData: null,
      
      // UI state
      showCallUI: false,
      callWindowMinimized: false,
      selectedCamera: null,
      selectedMicrophone: null,
      selectedSpeaker: null,
      
      // Statistics
      connectionStats: new Map(),
      callQuality: 'good', // 'poor', 'fair', 'good', 'excellent'
      
      // Errors and notifications
      callError: null,
      lastCallEndReason: null
    };
    
    this.listeners = new Set();
    this.initializeEventListeners();
  }
  
  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Listen for call-related events
    this.eventBus.on('call:incoming', this.handleIncomingCall.bind(this));
    this.eventBus.on('call:accepted', this.handleCallAccepted.bind(this));
    this.eventBus.on('call:rejected', this.handleCallRejected.bind(this));
    this.eventBus.on('call:ended', this.handleCallEnded.bind(this));
    this.eventBus.on('call:error', this.handleCallError.bind(this));
    
    // Media events
    this.eventBus.on('media:muted', this.handleMediaMuted.bind(this));
    this.eventBus.on('media:unmuted', this.handleMediaUnmuted.bind(this));
    this.eventBus.on('media:video-enabled', this.handleVideoEnabled.bind(this));
    this.eventBus.on('media:video-disabled', this.handleVideoDisabled.bind(this));
    
    // Screen sharing events
    this.eventBus.on('screen:share-started', this.handleScreenShareStarted.bind(this));
    this.eventBus.on('screen:share-stopped', this.handleScreenShareStopped.bind(this));
    
    // Recording events
    this.eventBus.on('recording:started', this.handleRecordingStarted.bind(this));
    this.eventBus.on('recording:stopped', this.handleRecordingStopped.bind(this));
  }
  
  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Update state
   */
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify listeners of state change
    this.notifyListeners(oldState, this.state);
    
    // Emit specific events for important state changes
    if (oldState.isInCall !== this.state.isInCall) {
      this.eventBus.emit('call:state-changed', { 
        isInCall: this.state.isInCall,
        callType: this.state.callType 
      });
    }
    
    if (oldState.callStatus !== this.state.callStatus) {
      this.eventBus.emit('call:status-changed', { 
        status: this.state.callStatus,
        previousStatus: oldState.callStatus 
      });
    }
  }
  
  /**
   * Start a new call
   */
  startCall(callData) {
    this.setState({
      activeCall: callData,
      isInCall: true,
      callType: callData.type,
      callStatus: 'connecting',
      showCallUI: true,
      participants: new Map([[callData.targetUserId, { 
        id: callData.targetUserId, 
        status: 'connecting' 
      }]])
    });
    
    this.eventBus.emit('call:started', callData);
  }
  
  /**
   * Accept an incoming call
   */
  acceptCall(callData) {
    this.setState({
      activeCall: callData,
      isInCall: true,
      callType: callData.type,
      callStatus: 'connected',
      showCallUI: true
    });
    
    this.eventBus.emit('call:accepted', callData);
  }
  
  /**
   * End the current call
   */
  endCall(reason = 'user-ended') {
    const callData = this.state.activeCall;
    
    // Add to call history
    if (callData) {
      this.addToCallHistory({
        ...callData,
        endTime: new Date(),
        duration: Date.now() - (callData.startTime?.getTime() || Date.now()),
        endReason: reason
      });
    }
    
    this.setState({
      activeCall: null,
      isInCall: false,
      callType: null,
      callStatus: 'idle',
      participants: new Map(),
      localStream: null,
      remoteStreams: new Map(),
      isScreenSharing: false,
      screenShareStream: null,
      isRecording: false,
      showCallUI: false,
      lastCallEndReason: reason
    });
    
    this.eventBus.emit('call:ended', { call: callData, reason });
  }
  
  /**
   * Add participant to call
   */
  addParticipant(participant) {
    const participants = new Map(this.state.participants);
    participants.set(participant.id, participant);
    
    this.setState({ participants });
    this.eventBus.emit('call:participant-added', participant);
  }
  
  /**
   * Remove participant from call
   */
  removeParticipant(participantId) {
    const participants = new Map(this.state.participants);
    const participant = participants.get(participantId);
    participants.delete(participantId);
    
    const remoteStreams = new Map(this.state.remoteStreams);
    remoteStreams.delete(participantId);
    
    this.setState({ participants, remoteStreams });
    this.eventBus.emit('call:participant-removed', { 
      participantId, 
      participant 
    });
  }
  
  /**
   * Update connection statistics
   */
  updateConnectionStats(participantId, stats) {
    const connectionStats = new Map(this.state.connectionStats);
    connectionStats.set(participantId, {
      ...connectionStats.get(participantId),
      ...stats,
      timestamp: Date.now()
    });
    
    // Calculate overall call quality
    const quality = this.calculateCallQuality(connectionStats);
    
    this.setState({ connectionStats, callQuality: quality });
  }
  
  /**
   * Calculate call quality based on connection stats
   */
  calculateCallQuality(stats) {
    let totalScore = 0;
    let count = 0;
    
    for (const [participantId, stat] of stats) {
      if (stat.packetsLost !== undefined && stat.packetsReceived !== undefined) {
        const lossRate = stat.packetsLost / (stat.packetsReceived + stat.packetsLost);
        const score = Math.max(0, 100 - (lossRate * 100));
        totalScore += score;
        count++;
      }
    }
    
    if (count === 0) return 'good';
    
    const averageScore = totalScore / count;
    if (averageScore >= 80) return 'excellent';
    if (averageScore >= 60) return 'good';
    if (averageScore >= 40) return 'fair';
    return 'poor';
  }
  
  /**
   * Add call to history
   */
  addToCallHistory(call) {
    const history = [...this.state.callHistory];
    history.unshift(call);
    
    // Keep only last 50 calls
    if (history.length > 50) {
      history.splice(50);
    }
    
    this.setState({ callHistory: history });
  }
  
  /**
   * Event handlers
   */
  handleIncomingCall(callData) {
    this.setState({
      activeCall: callData,
      callStatus: 'ringing',
      showCallUI: true,
      callType: callData.type
    });
  }
  
  handleCallAccepted(callData) {
    this.setState({
      callStatus: 'connected',
      isInCall: true
    });
  }
  
  handleCallRejected(callData) {
    this.setState({
      activeCall: null,
      callStatus: 'idle',
      showCallUI: false,
      lastCallEndReason: 'rejected'
    });
  }
  
  handleCallEnded(data) {
    this.endCall(data.reason || 'remote-ended');
  }
  
  handleCallError(error) {
    this.setState({
      callError: error,
      callStatus: 'error'
    });
  }
  
  handleMediaMuted() {
    this.setState({ isMuted: true });
  }
  
  handleMediaUnmuted() {
    this.setState({ isMuted: false });
  }
  
  handleVideoEnabled() {
    this.setState({ isVideoEnabled: true });
  }
  
  handleVideoDisabled() {
    this.setState({ isVideoEnabled: false });
  }
  
  handleScreenShareStarted(stream) {
    this.setState({
      isScreenSharing: true,
      screenShareStream: stream
    });
  }
  
  handleScreenShareStopped() {
    this.setState({
      isScreenSharing: false,
      screenShareStream: null
    });
  }
  
  handleRecordingStarted(data) {
    this.setState({
      isRecording: true,
      recordingData: data
    });
  }
  
  handleRecordingStopped(data) {
    this.setState({
      isRecording: false,
      recordingData: null
    });
    
    // Add to call history
    if (data && this.state.activeCall) {
      this.addToCallHistory({
        ...this.state.activeCall,
        recordingUrl: data.url,
        recordingDuration: data.duration
      });
    }
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of state change
   */
  notifyListeners(oldState, newState) {
    this.listeners.forEach(listener => {
      try {
        listener(newState, oldState);
      } catch (error) {
        console.error('Error in call store listener:', error);
      }
    });
  }
  
  /**
   * Clear all state
   */
  clear() {
    this.setState({
      activeCall: null,
      isInCall: false,
      callType: null,
      callStatus: 'idle',
      participants: new Map(),
      localStream: null,
      remoteStreams: new Map(),
      isMuted: false,
      isVideoEnabled: true,
      isSpeakerOn: false,
      isScreenSharing: false,
      screenShareStream: null,
      activeSpeaker: null,
      isRecording: false,
      recordingData: null,
      showCallUI: false,
      callWindowMinimized: false,
      connectionStats: new Map(),
      callQuality: 'good',
      callError: null
    });
  }
  
  /**
   * Get call statistics
   */
  getCallStats() {
    return {
      totalCalls: this.state.callHistory.length,
      avgCallDuration: this.calculateAverageCallDuration(),
      callQuality: this.state.callQuality,
      connectionStats: Object.fromEntries(this.state.connectionStats)
    };
  }
  
  /**
   * Calculate average call duration from history
   */
  calculateAverageCallDuration() {
    if (this.state.callHistory.length === 0) return 0;
    
    const totalDuration = this.state.callHistory.reduce((sum, call) => {
      return sum + (call.duration || 0);
    }, 0);
    
    return totalDuration / this.state.callHistory.length;
  }
}

// Create singleton instance
export const callStore = new CallStore();

// Export the class for testing
export { CallStore };
