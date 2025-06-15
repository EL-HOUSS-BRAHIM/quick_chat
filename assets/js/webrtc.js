/**
 * WebRTC Support for Quick Chat
 * Version: 1.0.0
 * 
 * This module adds support for real-time features:
 * - Peer-to-peer video/audio calls
 * - Screen sharing
 * - Live typing indicators
 * - Read receipts
 */

class WebRTCManager {
    constructor(options = {}) {
        // Default options
        this.options = {
            signalingServer: 'wss://signaling.quickchat.example/ws',
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            mediaConstraints: {
                audio: true,
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            },
            ...options
        };

        // State
        this.state = {
            connection: null,
            localStream: null,
            remoteStreams: new Map(),
            activeCalls: new Map(),
            incomingCalls: new Map(),
            outgoingCalls: new Map(),
            userId: null,
            isConnected: false,
            mediaDevices: {
                audioInput: [],
                audioOutput: [],
                videoInput: []
            }
        };

        // Event handlers
        this.events = {
            onCallReceived: null,
            onCallConnected: null,
            onCallEnded: null,
            onError: null,
            onConnectionStateChange: null
        };

        // Bind methods to maintain context
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.startCall = this.startCall.bind(this);
        this.answerCall = this.answerCall.bind(this);
        this.endCall = this.endCall.bind(this);
        this.handleSignalingMessage = this.handleSignalingMessage.bind(this);
        this.toggleMute = this.toggleMute.bind(this);
        this.toggleVideo = this.toggleVideo.bind(this);
        this.shareScreen = this.shareScreen.bind(this);
    }

    /**
     * Initialize WebRTC functionality
     * @param {string} userId - Current user ID
     * @returns {Promise<boolean>} Success status
     */
    async initialize(userId) {
        if (!this.isWebRTCSupported()) {
            this.triggerEvent('error', { message: 'WebRTC is not supported in this browser' });
            return false;
        }

        try {
            // Store user ID
            this.state.userId = userId;

            // Get available media devices
            await this.enumerateDevices();

            // Success
            this.triggerEvent('initialized', { userId, devices: this.state.mediaDevices });
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to initialize WebRTC', error });
            return false;
        }
    }

    /**
     * Check if WebRTC is supported in the browser
     * @returns {boolean} Support status
     */
    isWebRTCSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getUserMedia && 
                 window.RTCPeerConnection);
    }

    /**
     * Enumerate available media devices
     */
    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Reset device lists
            this.state.mediaDevices = {
                audioInput: [],
                audioOutput: [],
                videoInput: []
            };

            // Categorize devices
            devices.forEach(device => {
                const info = {
                    deviceId: device.deviceId,
                    groupId: device.groupId,
                    label: device.label || `${device.kind} (${device.deviceId.substr(0, 8)}...)`
                };

                switch (device.kind) {
                    case 'audioinput':
                        this.state.mediaDevices.audioInput.push(info);
                        break;
                    case 'audiooutput':
                        this.state.mediaDevices.audioOutput.push(info);
                        break;
                    case 'videoinput':
                        this.state.mediaDevices.videoInput.push(info);
                        break;
                }
            });

            return this.state.mediaDevices;
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            this.triggerEvent('error', { message: 'Failed to access media devices', error });
            return null;
        }
    }

    /**
     * Connect to signaling server
     * @returns {Promise<boolean>} Connection status
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Create WebSocket connection to signaling server
                const ws = new WebSocket(this.options.signalingServer);
                
                // Connection opened
                ws.addEventListener('open', () => {
                    this.state.connection = ws;
                    this.state.isConnected = true;
                    
                    // Send authentication message
                    this.sendSignalingMessage({
                        type: 'auth',
                        userId: this.state.userId
                    });
                    
                    this.triggerEvent('connected', { userId: this.state.userId });
                    resolve(true);
                });
                
                // Listen for messages
                ws.addEventListener('message', (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleSignalingMessage(message);
                    } catch (err) {
                        console.error('Failed to parse signaling message:', err);
                    }
                });
                
                // Connection closed
                ws.addEventListener('close', () => {
                    this.state.isConnected = false;
                    this.state.connection = null;
                    this.triggerEvent('disconnected', { reason: 'Connection closed' });
                });
                
                // Connection error
                ws.addEventListener('error', (error) => {
                    this.triggerEvent('error', { message: 'Signaling server connection error', error });
                    reject(error);
                });
            } catch (error) {
                this.triggerEvent('error', { message: 'Failed to connect to signaling server', error });
                reject(error);
            }
        });
    }

    /**
     * Disconnect from signaling server
     */
    disconnect() {
        if (this.state.connection) {
            // End all active calls
            this.state.activeCalls.forEach((call, callId) => {
                this.endCall(callId);
            });
            
            // Close connection
            this.state.connection.close();
            this.state.connection = null;
            this.state.isConnected = false;
        }
    }

    /**
     * Handle incoming signaling message
     * @param {Object} message - Signaling message
     */
    handleSignalingMessage(message) {
        if (!message || !message.type) return;
        
        switch (message.type) {
            case 'offer':
                this.handleIncomingCall(message);
                break;
                
            case 'answer':
                this.handleCallAnswer(message);
                break;
                
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
                
            case 'call-end':
                this.handleRemoteCallEnd(message);
                break;
                
            case 'error':
                this.triggerEvent('error', { message: message.message, code: message.code });
                break;
        }
    }

    /**
     * Send message to signaling server
     * @param {Object} message - Message to send
     */
    sendSignalingMessage(message) {
        if (!this.state.connection || !this.state.isConnected) {
            console.error('Cannot send message: not connected to signaling server');
            return false;
        }
        
        try {
            this.state.connection.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Failed to send signaling message:', error);
            return false;
        }
    }

    /**
     * Start a call with another user
     * @param {string} targetUserId - User ID to call
     * @param {Object} options - Call options
     * @returns {Promise<string>} Call ID if successful
     */
    async startCall(targetUserId, options = {}) {
        if (!this.state.isConnected) {
            throw new Error('Not connected to signaling server');
        }
        
        try {
            // Generate call ID
            const callId = this.generateCallId();
            
            // Get media stream
            const mediaOptions = options.mediaConstraints || this.options.mediaConstraints;
            const localStream = await navigator.mediaDevices.getUserMedia(mediaOptions);
            
            // Create peer connection
            const peerConnection = this.createPeerConnection(callId);
            
            // Add local stream tracks to peer connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Store local stream
            this.state.localStream = localStream;
            
            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Send offer to signaling server
            this.sendSignalingMessage({
                type: 'offer',
                callId: callId,
                targetUserId: targetUserId,
                fromUserId: this.state.userId,
                sdp: peerConnection.localDescription
            });
            
            // Store call information
            this.state.outgoingCalls.set(callId, {
                id: callId,
                targetUserId: targetUserId,
                peerConnection: peerConnection,
                localStream: localStream,
                remoteStream: null,
                state: 'calling',
                startTime: Date.now(),
                options: options
            });
            
            // Trigger event
            this.triggerEvent('callStarted', {
                callId: callId,
                targetUserId: targetUserId,
                localStream: localStream
            });
            
            return callId;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to start call', error });
            throw error;
        }
    }

    /**
     * Handle incoming call
     * @param {Object} message - Call offer message
     */
    handleIncomingCall(message) {
        const { callId, fromUserId, sdp } = message;
        
        // Create peer connection
        const peerConnection = this.createPeerConnection(callId);
        
        // Store call information
        this.state.incomingCalls.set(callId, {
            id: callId,
            fromUserId: fromUserId,
            peerConnection: peerConnection,
            localStream: null,
            remoteStream: null,
            state: 'incoming',
            startTime: Date.now(),
            remoteDescription: sdp
        });
        
        // Trigger event
        this.triggerEvent('callReceived', {
            callId: callId,
            fromUserId: fromUserId
        });
    }

    /**
     * Answer an incoming call
     * @param {string} callId - Call ID to answer
     * @param {Object} options - Answer options
     * @returns {Promise<boolean>} Success status
     */
    async answerCall(callId, options = {}) {
        const call = this.state.incomingCalls.get(callId);
        if (!call) {
            throw new Error(`Call not found: ${callId}`);
        }
        
        try {
            // Get media stream
            const mediaOptions = options.mediaConstraints || this.options.mediaConstraints;
            const localStream = await navigator.mediaDevices.getUserMedia(mediaOptions);
            
            // Set remote description (from the offer)
            await call.peerConnection.setRemoteDescription(new RTCSessionDescription(call.remoteDescription));
            
            // Add local stream tracks to peer connection
            localStream.getTracks().forEach(track => {
                call.peerConnection.addTrack(track, localStream);
            });
            
            // Store local stream
            this.state.localStream = localStream;
            call.localStream = localStream;
            
            // Create and send answer
            const answer = await call.peerConnection.createAnswer();
            await call.peerConnection.setLocalDescription(answer);
            
            // Send answer to signaling server
            this.sendSignalingMessage({
                type: 'answer',
                callId: callId,
                targetUserId: call.fromUserId,
                fromUserId: this.state.userId,
                sdp: call.peerConnection.localDescription
            });
            
            // Update call state
            call.state = 'connecting';
            
            // Move call from incoming to active
            this.state.activeCalls.set(callId, call);
            this.state.incomingCalls.delete(callId);
            
            // Trigger event
            this.triggerEvent('callAnswered', {
                callId: callId,
                targetUserId: call.fromUserId,
                localStream: localStream
            });
            
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to answer call', error });
            
            // Clean up on error
            this.rejectCall(callId);
            throw error;
        }
    }

    /**
     * Reject an incoming call
     * @param {string} callId - Call ID to reject
     */
    rejectCall(callId) {
        const call = this.state.incomingCalls.get(callId);
        if (!call) return;
        
        // Send rejection message
        this.sendSignalingMessage({
            type: 'call-rejected',
            callId: callId,
            targetUserId: call.fromUserId,
            fromUserId: this.state.userId
        });
        
        // Clean up call resources
        if (call.peerConnection) {
            call.peerConnection.close();
        }
        
        // Remove call
        this.state.incomingCalls.delete(callId);
        
        // Trigger event
        this.triggerEvent('callRejected', {
            callId: callId,
            targetUserId: call.fromUserId
        });
    }

    /**
     * Handle call answer
     * @param {Object} message - Call answer message
     */
    handleCallAnswer(message) {
        const { callId, fromUserId, sdp } = message;
        
        const call = this.state.outgoingCalls.get(callId);
        if (!call) return;
        
        // Set remote description (from the answer)
        call.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => {
                // Update call state
                call.state = 'connected';
                
                // Move call from outgoing to active
                this.state.activeCalls.set(callId, call);
                this.state.outgoingCalls.delete(callId);
                
                // Trigger event
                this.triggerEvent('callConnected', {
                    callId: callId,
                    targetUserId: call.targetUserId
                });
            })
            .catch(error => {
                this.triggerEvent('error', { message: 'Failed to process call answer', error });
                this.endCall(callId);
            });
    }

    /**
     * Handle ICE candidate
     * @param {Object} message - ICE candidate message
     */
    handleIceCandidate(message) {
        const { callId, candidate } = message;
        
        // Find the call
        const call = this.state.activeCalls.get(callId) || 
                     this.state.outgoingCalls.get(callId) || 
                     this.state.incomingCalls.get(callId);
        
        if (!call || !call.peerConnection) return;
        
        // Add ICE candidate to peer connection
        call.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => {
                console.error('Failed to add ICE candidate:', error);
            });
    }

    /**
     * End an active call
     * @param {string} callId - Call ID to end
     */
    endCall(callId) {
        // Find the call in any state
        const call = this.state.activeCalls.get(callId) || 
                     this.state.outgoingCalls.get(callId) || 
                     this.state.incomingCalls.get(callId);
        
        if (!call) return;
        
        // Send call end message
        this.sendSignalingMessage({
            type: 'call-end',
            callId: callId,
            targetUserId: call.targetUserId || call.fromUserId,
            fromUserId: this.state.userId
        });
        
        // Clean up call resources
        this.cleanupCall(call);
        
        // Remove call from appropriate collection
        this.state.activeCalls.delete(callId);
        this.state.outgoingCalls.delete(callId);
        this.state.incomingCalls.delete(callId);
        
        // Trigger event
        this.triggerEvent('callEnded', {
            callId: callId,
            targetUserId: call.targetUserId || call.fromUserId,
            duration: call.state === 'connected' ? Date.now() - call.startTime : 0
        });
    }

    /**
     * Handle remote call end
     * @param {Object} message - Call end message
     */
    handleRemoteCallEnd(message) {
        const { callId } = message;
        
        // Find the call in any state
        const call = this.state.activeCalls.get(callId) || 
                     this.state.outgoingCalls.get(callId) || 
                     this.state.incomingCalls.get(callId);
        
        if (!call) return;
        
        // Clean up call resources
        this.cleanupCall(call);
        
        // Remove call from appropriate collection
        this.state.activeCalls.delete(callId);
        this.state.outgoingCalls.delete(callId);
        this.state.incomingCalls.delete(callId);
        
        // Trigger event
        this.triggerEvent('callEnded', {
            callId: callId,
            targetUserId: call.targetUserId || call.fromUserId,
            duration: call.state === 'connected' ? Date.now() - call.startTime : 0,
            endedByRemote: true
        });
    }

    /**
     * Clean up call resources
     * @param {Object} call - Call to clean up
     */
    cleanupCall(call) {
        if (!call) return;
        
        // Close peer connection
        if (call.peerConnection) {
            call.peerConnection.close();
        }
        
        // Stop local tracks
        if (call.localStream) {
            call.localStream.getTracks().forEach(track => track.stop());
        }
    }

    /**
     * Create a new peer connection
     * @param {string} callId - Call ID
     * @returns {RTCPeerConnection} Peer connection
     */
    createPeerConnection(callId) {
        const peerConnection = new RTCPeerConnection({
            iceServers: this.options.iceServers
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    callId: callId,
                    targetUserId: this.getCallTarget(callId),
                    fromUserId: this.state.userId,
                    candidate: event.candidate
                });
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const call = this.findCallById(callId);
            if (!call) return;
            
            switch (peerConnection.connectionState) {
                case 'connected':
                    // Update call state
                    call.state = 'connected';
                    break;
                    
                case 'disconnected':
                case 'failed':
                case 'closed':
                    // Handle call disconnection
                    this.endCall(callId);
                    break;
            }
        };
        
        // Handle remote streams
        peerConnection.ontrack = (event) => {
            const call = this.findCallById(callId);
            if (!call) return;
            
            // Get remote stream
            const remoteStream = event.streams[0];
            call.remoteStream = remoteStream;
            
            // Store remote stream
            this.state.remoteStreams.set(callId, remoteStream);
            
            // Trigger event
            this.triggerEvent('remoteStreamAdded', {
                callId: callId,
                stream: remoteStream,
                targetUserId: call.targetUserId || call.fromUserId
            });
        };
        
        return peerConnection;
    }

    /**
     * Get call target user ID
     * @param {string} callId - Call ID
     * @returns {string|null} Target user ID
     */
    getCallTarget(callId) {
        const outgoingCall = this.state.outgoingCalls.get(callId);
        if (outgoingCall) return outgoingCall.targetUserId;
        
        const incomingCall = this.state.incomingCalls.get(callId);
        if (incomingCall) return incomingCall.fromUserId;
        
        const activeCall = this.state.activeCalls.get(callId);
        if (activeCall) return activeCall.targetUserId || activeCall.fromUserId;
        
        return null;
    }

    /**
     * Find call by ID in any state
     * @param {string} callId - Call ID
     * @returns {Object|null} Call object
     */
    findCallById(callId) {
        return this.state.activeCalls.get(callId) || 
               this.state.outgoingCalls.get(callId) || 
               this.state.incomingCalls.get(callId) || null;
    }

    /**
     * Toggle audio mute
     * @param {string} callId - Call ID
     * @returns {boolean} New mute state
     */
    toggleMute(callId) {
        const call = this.findCallById(callId);
        if (!call || !call.localStream) return false;
        
        const audioTracks = call.localStream.getAudioTracks();
        if (audioTracks.length === 0) return false;
        
        const newState = !audioTracks[0].enabled;
        audioTracks.forEach(track => {
            track.enabled = newState;
        });
        
        this.triggerEvent('muteChanged', {
            callId: callId,
            muted: !newState
        });
        
        return !newState; // Return true if muted
    }

    /**
     * Toggle video
     * @param {string} callId - Call ID
     * @returns {boolean} New video state
     */
    toggleVideo(callId) {
        const call = this.findCallById(callId);
        if (!call || !call.localStream) return false;
        
        const videoTracks = call.localStream.getVideoTracks();
        if (videoTracks.length === 0) return false;
        
        const newState = !videoTracks[0].enabled;
        videoTracks.forEach(track => {
            track.enabled = newState;
        });
        
        this.triggerEvent('videoChanged', {
            callId: callId,
            videoEnabled: newState
        });
        
        return newState;
    }

    /**
     * Share screen
     * @param {string} callId - Call ID
     * @returns {Promise<boolean>} Success status
     */
    async shareScreen(callId) {
        if (!navigator.mediaDevices.getDisplayMedia) {
            throw new Error('Screen sharing not supported');
        }
        
        const call = this.findCallById(callId);
        if (!call || !call.peerConnection) {
            throw new Error('Call not found');
        }
        
        try {
            // Get screen sharing stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            // Get current video sender
            const videoSender = call.peerConnection.getSenders().find(sender => 
                sender.track && sender.track.kind === 'video'
            );
            
            if (videoSender) {
                // Replace video track with screen track
                const screenTrack = screenStream.getVideoTracks()[0];
                await videoSender.replaceTrack(screenTrack);
                
                // Handle screen sharing end
                screenTrack.onended = async () => {
                    // Revert to camera
                    try {
                        const cameraStream = await navigator.mediaDevices.getUserMedia({
                            video: true
                        });
                        const cameraTrack = cameraStream.getVideoTracks()[0];
                        await videoSender.replaceTrack(cameraTrack);
                        
                        this.triggerEvent('screenSharingEnded', {
                            callId: callId,
                            revertedToCamera: true
                        });
                    } catch (error) {
                        console.error('Failed to revert to camera:', error);
                        
                        this.triggerEvent('screenSharingEnded', {
                            callId: callId,
                            revertedToCamera: false,
                            error: error
                        });
                    }
                };
                
                this.triggerEvent('screenSharingStarted', {
                    callId: callId
                });
                
                return true;
            } else {
                throw new Error('No video sender found');
            }
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to share screen', error });
            throw error;
        }
    }

    /**
     * Generate a unique call ID
     * @returns {string} Unique call ID
     */
    generateCallId() {
        return `call_${this.state.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Set event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    on(event, handler) {
        if (typeof handler !== 'function') return;
        
        this.events[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = handler;
    }

    /**
     * Trigger event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    triggerEvent(event, data) {
        const handlerName = `on${event.charAt(0).toUpperCase() + event.slice(1)}`;
        
        if (typeof this.events[handlerName] === 'function') {
            this.events[handlerName](data);
        }
    }
}

// Make available globally
window.webRTCManager = new WebRTCManager();
