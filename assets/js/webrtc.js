/**
 * WebRTC Support for Quick Chat - Complete Implementation
 * Version: 2.0.0
 * 
 * This module provides complete WebRTC functionality:
 * - Peer-to-peer video/audio calls with error handling
 * - Screen sharing with device switching
 * - Call recording capabilities
 * - Device management and switching
 * - Connection quality monitoring
 * - Group calls support
 */

class WebRTCManager {
    constructor(options = {}) {
        // Default options with enhanced configuration
        this.options = {
            signalingServer: options.signalingServer || 
                            (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
                            window.location.host + '/ws',
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                // TURN servers with authentication
                ...(options.turnServers || this.getAuthenticatedTURNServers())
            ],
            mediaConstraints: {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                }
            },
            screenShareConstraints: {
                video: {
                    mediaSource: 'screen',
                    width: { max: 1920 },
                    height: { max: 1080 }
                },
                audio: true
            },
            connectionTimeout: 30000, // 30 seconds
            reconnectAttempts: 3,
            reconnectDelay: 2000,
            ...options
        };

        // Enhanced state management
        this.state = {
            connection: null,
            localStream: null,
            screenStream: null,
            remoteStreams: new Map(),
            activeCalls: new Map(),
            incomingCalls: new Map(),
            outgoingCalls: new Map(),
            groupCalls: new Map(),
            userId: null,
            isConnected: false,
            isReconnecting: false,
            reconnectAttempts: 0,
            connectionQuality: new Map(),
            mediaDevices: {
                audioInput: [],
                audioOutput: [],
                videoInput: []
            },
            currentDevices: {
                audioInput: null,
                audioOutput: null,
                videoInput: null
            },
            callStates: new Map(), // Track individual call states
            recordings: new Map() // Track active recordings
        };

        // Enhanced event handlers
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

    /**
     * Enhanced device switching functionality
     */
    async switchAudioDevice(deviceId) {
        try {
            if (!this.state.localStream) {
                throw new Error('No active stream to switch devices');
            }

            const constraints = {
                audio: { deviceId: { exact: deviceId } },
                video: this.state.localStream.getVideoTracks().length > 0
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Replace audio track in active calls
            for (const [callId, peerConnection] of this.state.activeCalls) {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'audio'
                );
                if (sender) {
                    await sender.replaceTrack(newStream.getAudioTracks()[0]);
                }
            }

            // Stop old audio track
            this.state.localStream.getAudioTracks().forEach(track => track.stop());
            
            // Update stream
            this.state.localStream = newStream;
            this.state.currentDevices.audioInput = deviceId;
            
            this.triggerEvent('deviceSwitched', { type: 'audio', deviceId });
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to switch audio device', error });
            return false;
        }
    }

    async switchVideoDevice(deviceId) {
        try {
            if (!this.state.localStream) {
                throw new Error('No active stream to switch devices');
            }

            const constraints = {
                audio: this.state.localStream.getAudioTracks().length > 0,
                video: { deviceId: { exact: deviceId } }
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Replace video track in active calls
            for (const [callId, peerConnection] of this.state.activeCalls) {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    await sender.replaceTrack(newStream.getVideoTracks()[0]);
                }
            }

            // Stop old video track
            this.state.localStream.getVideoTracks().forEach(track => track.stop());
            
            // Update stream with new video track
            const audioTracks = this.state.localStream.getAudioTracks();
            const videoTracks = newStream.getVideoTracks();
            
            this.state.localStream = new MediaStream([...audioTracks, ...videoTracks]);
            this.state.currentDevices.videoInput = deviceId;
            
            this.triggerEvent('deviceSwitched', { type: 'video', deviceId });
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to switch video device', error });
            return false;
        }
    }

    /**
     * Enhanced screen sharing with error handling
     */
    async startScreenShare() {
        try {
            if (!navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Screen sharing is not supported');
            }

            const screenStream = await navigator.mediaDevices.getDisplayMedia(
                this.options.screenShareConstraints
            );

            this.state.screenStream = screenStream;

            // Handle screen share ending
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopScreenShare();
            });

            // Replace video track in active calls
            for (const [callId, peerConnection] of this.state.activeCalls) {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    await sender.replaceTrack(screenStream.getVideoTracks()[0]);
                }
            }

            this.triggerEvent('screenShareStarted', { stream: screenStream });
            return screenStream;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to start screen sharing', error });
            throw error;
        }
    }

    async stopScreenShare() {
        try {
            if (!this.state.screenStream) return;

            // Stop screen stream
            this.state.screenStream.getTracks().forEach(track => track.stop());
            this.state.screenStream = null;

            // Revert to camera if available
            if (this.state.localStream && this.state.localStream.getVideoTracks().length > 0) {
                const videoTrack = this.state.localStream.getVideoTracks()[0];
                
                // Replace screen track with camera track in active calls
                for (const [callId, peerConnection] of this.state.activeCalls) {
                    const sender = peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'video'
                    );
                    if (sender) {
                        await sender.replaceTrack(videoTrack);
                    }
                }
            }

            this.triggerEvent('screenShareStopped');
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to stop screen sharing', error });
        }
    }

    /**
     * Call recording functionality
     */
    startRecording(callId) {
        try {
            const peerConnection = this.state.activeCalls.get(callId);
            if (!peerConnection) {
                throw new Error('No active call found');
            }

            // Create media recorder for local stream
            const recordedChunks = [];
            const mediaRecorder = new MediaRecorder(this.state.localStream, {
                mimeType: 'video/webm; codecs=vp9'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                this.triggerEvent('recordingComplete', { 
                    callId, 
                    blob, 
                    url: URL.createObjectURL(blob) 
                });
            };

            mediaRecorder.start();
            this.state.recordings.set(callId, mediaRecorder);
            
            this.triggerEvent('recordingStarted', { callId });
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to start recording', error });
            return false;
        }
    }

    stopRecording(callId) {
        try {
            const mediaRecorder = this.state.recordings.get(callId);
            if (!mediaRecorder) {
                throw new Error('No active recording found');
            }

            mediaRecorder.stop();
            this.state.recordings.delete(callId);
            
            this.triggerEvent('recordingStopped', { callId });
            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to stop recording', error });
            return false;
        }
    }

    /**
     * Connection quality monitoring
     */
    async monitorConnectionQuality(callId) {
        const peerConnection = this.state.activeCalls.get(callId);
        if (!peerConnection) return;

        try {
            const stats = await peerConnection.getStats();
            const quality = this.analyzeStats(stats);
            
            this.state.connectionQuality.set(callId, quality);
            this.triggerEvent('qualityUpdate', { callId, quality });
            
            return quality;
        } catch (error) {
            console.warn('Failed to get connection stats:', error);
            return null;
        }
    }

    analyzeStats(stats) {
        const quality = {
            bitrate: 0,
            packetLoss: 0,
            jitter: 0,
            roundTripTime: 0,
            rating: 'unknown' // poor, fair, good, excellent
        };

        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                quality.bitrate = report.bytesReceived || 0;
                quality.packetLoss = report.packetsLost || 0;
                quality.jitter = report.jitter || 0;
            }
            
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                quality.roundTripTime = report.currentRoundTripTime || 0;
            }
        });

        // Calculate overall quality rating
        if (quality.roundTripTime < 100 && quality.packetLoss < 1) {
            quality.rating = 'excellent';
        } else if (quality.roundTripTime < 200 && quality.packetLoss < 3) {
            quality.rating = 'good';
        } else if (quality.roundTripTime < 300 && quality.packetLoss < 5) {
            quality.rating = 'fair';
        } else {
            quality.rating = 'poor';
        }

        return quality;
    }

    /**
     * Enhanced error handling with reconnection logic
     */
    async handleConnectionError(error, callId = null) {
        console.error('WebRTC Connection Error:', error);
        
        const errorInfo = {
            message: error.message || 'Unknown connection error',
            code: error.code || 'UNKNOWN_ERROR',
            callId: callId,
            timestamp: new Date().toISOString()
        };

        // Attempt reconnection for certain error types
        if (this.shouldAttemptReconnection(error) && !this.state.isReconnecting) {
            await this.attemptReconnection(callId);
        }

        this.triggerEvent('connectionError', errorInfo);
    }

    shouldAttemptReconnection(error) {
        const reconnectableErrors = [
            'ice-connection-failed',
            'ice-connection-disconnected',
            'connection-timeout'
        ];
        
        return reconnectableErrors.some(type => 
            error.message.includes(type) || error.code === type
        );
    }

    async attemptReconnection(callId) {
        if (this.state.reconnectAttempts >= this.options.reconnectAttempts) {
            this.triggerEvent('reconnectionFailed', { callId });
            return false;
        }

        this.state.isReconnecting = true;
        this.state.reconnectAttempts++;

        this.triggerEvent('reconnectionAttempt', { 
            attempt: this.state.reconnectAttempts,
            maxAttempts: this.options.reconnectAttempts,
            callId 
        });

        try {
            // Wait before reconnection attempt
            await new Promise(resolve => 
                setTimeout(resolve, this.options.reconnectDelay)
            );

            // Attempt to restart the call
            if (callId && this.state.activeCalls.has(callId)) {
                await this.restartCall(callId);
                this.state.isReconnecting = false;
                this.state.reconnectAttempts = 0;
                this.triggerEvent('reconnectionSuccess', { callId });
                return true;
            }
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
        }

        this.state.isReconnecting = false;
        
        // Try again if we haven't reached max attempts
        if (this.state.reconnectAttempts < this.options.reconnectAttempts) {
            setTimeout(() => this.attemptReconnection(callId), this.options.reconnectDelay);
        } else {
            this.triggerEvent('reconnectionFailed', { callId });
        }

        return false;
    }

    async restartCall(callId) {
        // Implementation for restarting a failed call
        const peerConnection = this.state.activeCalls.get(callId);
        if (!peerConnection) return;

        // Create new ICE candidates
        await peerConnection.restartIce();
        
        // Re-establish connection
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        
        // Send restart offer through signaling
        this.sendSignalingMessage(callId, {
            type: 'restart-offer',
            offer: offer
        });
    }

    /**
     * Group call functionality
     */
    async startGroupCall(userIds) {
        try {
            const groupCallId = this.generateCallId();
            const participants = new Map();

            // Create peer connections for each participant
            for (const userId of userIds) {
                const peerConnection = await this.createPeerConnection(userId);
                participants.set(userId, peerConnection);
            }

            this.state.groupCalls.set(groupCallId, {
                id: groupCallId,
                participants: participants,
                creator: this.state.userId,
                startTime: Date.now()
            });

            // Start calls with each participant
            for (const [userId, peerConnection] of participants) {
                await this.initiateCall(userId, peerConnection, true);
            }

            this.triggerEvent('groupCallStarted', { 
                callId: groupCallId, 
                participants: Array.from(participants.keys()) 
            });

            return groupCallId;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to start group call', error });
            throw error;
        }
    }

    async joinGroupCall(groupCallId, participants) {
        try {
            const participantConnections = new Map();

            // Create peer connections for existing participants
            for (const userId of participants) {
                const peerConnection = await this.createPeerConnection(userId);
                participantConnections.set(userId, peerConnection);
            }

            this.state.groupCalls.set(groupCallId, {
                id: groupCallId,
                participants: participantConnections,
                creator: null,
                joinTime: Date.now()
            });

            this.triggerEvent('groupCallJoined', { 
                callId: groupCallId, 
                participants: Array.from(participantConnections.keys()) 
            });

            return true;
        } catch (error) {
            this.triggerEvent('error', { message: 'Failed to join group call', error });
            return false;
        }
    }

    /**
     * Get authenticated TURN servers with temporary credentials
     */
    async getAuthenticatedTURNServers() {
        try {
            const response = await fetch('/api/webrtc/turn-credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    userId: this.state.userId
                })
            });

            if (response.ok) {
                const data = await response.json();
                return [
                    {
                        urls: data.turnUrls,
                        username: data.username,
                        credential: data.credential,
                        credentialType: 'password'
                    }
                ];
            }
        } catch (error) {
            console.warn('Failed to get TURN credentials:', error);
        }

        // Fallback to public STUN servers
        return [];
    }

    /**
     * Verify call encryption status
     */
    async verifyCallEncryption(callId) {
        if (!this.securityOptions.callEncryptionVerification) return true;

        const call = this.findCallById(callId);
        if (!call || !call.peerConnection) return false;

        try {
            const stats = await call.peerConnection.getStats();
            let isEncrypted = false;
            let encryptionSuite = null;

            stats.forEach(report => {
                if (report.type === 'transport' && report.dtlsState === 'connected') {
                    isEncrypted = true;
                    encryptionSuite = report.selectedCandidatePairId;
                }
            });

            // Update call state with encryption info
            call.encryption = {
                isEncrypted: isEncrypted,
                suite: encryptionSuite,
                verified: true,
                timestamp: Date.now()
            };

            this.triggerEvent('encryptionVerified', {
                callId: callId,
                isEncrypted: isEncrypted,
                encryptionSuite: encryptionSuite
            });

            return isEncrypted;
        } catch (error) {
            console.error('Failed to verify encryption:', error);
            this.triggerEvent('encryptionVerificationFailed', { callId, error });
            return false;
        }
    }

    /**
     * Validate screen sharing permissions
     */
    async validateScreenSharePermission(callId) {
        if (!this.securityOptions.validateScreenShare) return true;

        try {
            // Check if user has explicit permission to share screen
            const permission = await navigator.permissions.query({ name: 'display-capture' });
            
            if (permission.state === 'denied') {
                throw new Error('Screen sharing permission denied');
            }

            // Log screen share request for audit
            await this.logSecurityEvent('screen_share_requested', {
                callId: callId,
                userId: this.state.userId,
                timestamp: Date.now(),
                permissionState: permission.state
            });

            // Request explicit user consent
            const consent = await this.requestScreenShareConsent(callId);
            if (!consent) {
                throw new Error('User declined screen sharing consent');
            }

            return true;
        } catch (error) {
            this.triggerEvent('screenSharePermissionDenied', { callId, error: error.message });
            return false;
        }
    }

    /**
     * Request screen sharing consent from user
     */
    async requestScreenShareConsent(callId) {
        return new Promise((resolve) => {
            // Create consent modal
            const modal = document.createElement('div');
            modal.className = 'consent-modal';
            modal.innerHTML = `
                <div class="consent-modal-content">
                    <h3>Screen Sharing Permission</h3>
                    <p>Do you want to share your screen with other participants in this call?</p>
                    <p><small>Your screen content will be visible to all call participants.</small></p>
                    <div class="consent-buttons">
                        <button class="btn-consent-deny">Cancel</button>
                        <button class="btn-consent-allow">Allow Screen Sharing</button>
                    </div>
                </div>
            `;

            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const content = modal.querySelector('.consent-modal-content');
            content.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;

            // Handle consent response
            modal.querySelector('.btn-consent-allow').onclick = () => {
                document.body.removeChild(modal);
                this.logSecurityEvent('screen_share_consent_granted', { callId });
                resolve(true);
            };

            modal.querySelector('.btn-consent-deny').onclick = () => {
                document.body.removeChild(modal);
                this.logSecurityEvent('screen_share_consent_denied', { callId });
                resolve(false);
            };

            document.body.appendChild(modal);
            
            // Auto-deny after 30 seconds
            setTimeout(() => {
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            }, 30000);
        });
    }

    /**
     * Manage recording consent for calls
     */
    async requestRecordingConsent(callId, participants) {
        if (!this.securityOptions.requireRecordingConsent) return true;

        try {
            // Send consent request to all participants
            const consentResponses = await Promise.all(
                participants.map(userId => this.sendConsentRequest(callId, userId, 'recording'))
            );

            // All participants must consent
            const allConsented = consentResponses.every(response => response.consented);

            if (allConsented) {
                await this.logSecurityEvent('recording_consent_granted', {
                    callId: callId,
                    participants: participants,
                    timestamp: Date.now()
                });
            } else {
                await this.logSecurityEvent('recording_consent_denied', {
                    callId: callId,
                    participants: participants,
                    deniedBy: consentResponses.filter(r => !r.consented).map(r => r.userId)
                });
            }

            return allConsented;
        } catch (error) {
            console.error('Failed to get recording consent:', error);
            return false;
        }
    }

    /**
     * Send consent request to participant
     */
    async sendConsentRequest(callId, userId, consentType) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve({ userId, consented: false, timeout: true });
            }, 30000);

            // Send consent request through signaling
            this.sendSignalingMessage({
                type: 'consent-request',
                callId: callId,
                targetUserId: userId,
                fromUserId: this.state.userId,
                consentType: consentType,
                requestId: `${callId}_${userId}_${Date.now()}`
            });

            // Listen for consent response
            this.consentListeners = this.consentListeners || new Map();
            this.consentListeners.set(`${callId}_${userId}`, (response) => {
                clearTimeout(timeoutId);
                resolve({ userId, consented: response.granted });
            });
        });
    }

    /**
     * Log security events for audit trail
     */
    async logSecurityEvent(eventType, eventData) {
        try {
            await fetch('/api/security/log-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCSRFToken()
                },
                body: JSON.stringify({
                    eventType: eventType,
                    eventData: eventData,
                    userId: this.state.userId,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    ipAddress: await this.getClientIP()
                })
            });
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }

    /**
     * Get client IP address for security logging
     */
    async getClientIP() {
        try {
            const response = await fetch('/api/security/client-ip');
            if (response.ok) {
                const data = await response.json();
                return data.ip;
            }
        } catch (error) {
            console.warn('Failed to get client IP:', error);
        }
        return 'unknown';
    }

    /**
     * Get CSRF token for requests
     */
    getCSRFToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }
}

// Make available globally
window.webRTCManager = new WebRTCManager();
