/**
 * Call Interface Components
 * Handles incoming call notifications, call controls, and call UI
 */

class CallInterfaceManager {
    constructor() {
        this.activeCall = null;
        this.incomingCall = null;
        this.callInterface = null;
        this.ringtone = null;
        this.callStartTime = null;
        this.callTimer = null;
        
        this.init();
    }

    init() {
        this.createCallInterface();
        this.loadRingtone();
        this.bindEvents();
    }

    createCallInterface() {
        // Create incoming call notification modal
        const incomingCallModal = document.createElement('div');
        incomingCallModal.id = 'incoming-call-modal';
        incomingCallModal.className = 'call-modal incoming-call';
        incomingCallModal.innerHTML = `
            <div class="call-modal-content">
                <div class="caller-info">
                    <div class="caller-avatar">
                        <img id="caller-avatar" src="" alt="Caller">
                    </div>
                    <div class="caller-details">
                        <h3 id="caller-name">Unknown Caller</h3>
                        <p id="call-type">Voice Call</p>
                    </div>
                </div>
                <div class="call-actions">
                    <button class="call-btn decline-btn" onclick="callInterface.declineCall()">
                        <i class="fas fa-phone-slash"></i>
                        <span>Decline</span>
                    </button>
                    <button class="call-btn accept-btn" onclick="callInterface.acceptCall()">
                        <i class="fas fa-phone"></i>
                        <span>Accept</span>
                    </button>
                </div>
                <div class="call-animation">
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring"></div>
                </div>
            </div>
        `;

        // Create active call interface
        const activeCallInterface = document.createElement('div');
        activeCallInterface.id = 'active-call-interface';
        activeCallInterface.className = 'call-interface active-call';
        activeCallInterface.innerHTML = `
            <div class="call-header">
                <div class="call-info">
                    <div class="participant-info">
                        <h3 id="active-call-name">Unknown</h3>
                        <p id="call-duration">00:00</p>
                        <p id="call-status">Connecting...</p>
                    </div>
                    <div class="call-quality">
                        <div class="quality-indicator" id="quality-indicator">
                            <div class="signal-bars">
                                <div class="bar"></div>
                                <div class="bar"></div>
                                <div class="bar"></div>
                                <div class="bar"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <button class="minimize-btn" onclick="callInterface.minimizeCall()">
                    <i class="fas fa-minus"></i>
                </button>
            </div>

            <div class="video-container">
                <video id="local-video" autoplay muted playsinline></video>
                <video id="remote-video" autoplay playsinline></video>
                <div class="video-controls">
                    <button class="video-control-btn" onclick="callInterface.togglePictureInPicture()">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="video-control-btn" onclick="callInterface.toggleFullscreen()">
                        <i class="fas fa-expand"></i>
                    </button>
                </div>
            </div>

            <div class="participants-list" id="participants-list">
                <!-- Group call participants will be added here -->
            </div>

            <div class="call-controls">
                <button class="control-btn mute-btn" id="mute-btn" onclick="callInterface.toggleMute()">
                    <i class="fas fa-microphone"></i>
                    <span>Mute</span>
                </button>
                
                <button class="control-btn video-btn" id="video-btn" onclick="callInterface.toggleVideo()">
                    <i class="fas fa-video"></i>
                    <span>Video</span>
                </button>
                
                <button class="control-btn screen-btn" id="screen-btn" onclick="callInterface.toggleScreenShare()">
                    <i class="fas fa-desktop"></i>
                    <span>Share</span>
                </button>
                
                <button class="control-btn record-btn" id="record-btn" onclick="callInterface.toggleRecording()">
                    <i class="fas fa-record-vinyl"></i>
                    <span>Record</span>
                </button>
                
                <button class="control-btn settings-btn" onclick="callInterface.showSettings()">
                    <i class="fas fa-cog"></i>
                    <span>Settings</span>
                </button>
                
                <button class="control-btn end-btn" onclick="callInterface.endCall()">
                    <i class="fas fa-phone-slash"></i>
                    <span>End Call</span>
                </button>
            </div>

            <div class="call-settings" id="call-settings">
                <h4>Call Settings</h4>
                <div class="settings-group">
                    <label>Microphone:</label>
                    <select id="audio-input-select"></select>
                </div>
                <div class="settings-group">
                    <label>Speaker:</label>
                    <select id="audio-output-select"></select>
                </div>
                <div class="settings-group">
                    <label>Camera:</label>
                    <select id="video-input-select"></select>
                </div>
                <div class="settings-actions">
                    <button onclick="callInterface.hideSettings()">Close</button>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(incomingCallModal);
        document.body.appendChild(activeCallInterface);

        // Store references
        this.incomingCallModal = incomingCallModal;
        this.activeCallInterface = activeCallInterface;
    }

    loadRingtone() {
        // Create ringtone audio element
        this.ringtone = new Audio();
        this.ringtone.src = 'assets/sounds/ringtone.mp3';
        this.ringtone.loop = true;
        this.ringtone.volume = 0.5;

        // Fallback to default browser beep if file not found
        this.ringtone.onerror = () => {
            console.warn('Ringtone file not found, using default notification');
        };
    }

    bindEvents() {
        // Listen for WebRTC events
        document.addEventListener('callReceived', (event) => {
            this.showIncomingCall(event.detail);
        });

        document.addEventListener('callConnected', (event) => {
            this.showActiveCall(event.detail);
        });

        document.addEventListener('callEnded', (event) => {
            this.hideCallInterface();
        });

        document.addEventListener('qualityUpdate', (event) => {
            this.updateCallQuality(event.detail.quality);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (this.activeCall) {
                this.handleKeyboardShortcuts(event);
            }
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.adjustVideoLayout();
        });
    }

    showIncomingCall(callData) {
        this.incomingCall = callData;
        
        // Update caller information
        document.getElementById('caller-name').textContent = callData.callerName || 'Unknown Caller';
        document.getElementById('call-type').textContent = callData.hasVideo ? 'Video Call' : 'Voice Call';
        
        const callerAvatar = document.getElementById('caller-avatar');
        callerAvatar.src = callData.callerAvatar || 'assets/images/default-avatar.png';
        
        // Show modal
        this.incomingCallModal.style.display = 'flex';
        this.incomingCallModal.classList.add('show');
        
        // Play ringtone
        this.playRingtone();
        
        // Auto-decline after 30 seconds
        this.autoDeclineTimer = setTimeout(() => {
            this.declineCall();
        }, 30000);
    }

    showActiveCall(callData) {
        this.activeCall = callData;
        this.callStartTime = Date.now();
        
        // Hide incoming call modal
        this.hideIncomingCall();
        
        // Update call information
        document.getElementById('active-call-name').textContent = callData.participantName || 'Unknown';
        document.getElementById('call-status').textContent = 'Connected';
        
        // Show active call interface
        this.activeCallInterface.style.display = 'flex';
        this.activeCallInterface.classList.add('show');
        
        // Start call timer
        this.startCallTimer();
        
        // Setup video streams
        this.setupVideoStreams(callData);
        
        // Update device selectors
        this.updateDeviceSelectors();
    }

    hideCallInterface() {
        // Hide all call interfaces
        this.hideIncomingCall();
        this.hideActiveCall();
        
        // Clean up
        this.activeCall = null;
        this.incomingCall = null;
        this.stopCallTimer();
    }

    hideIncomingCall() {
        if (this.incomingCallModal) {
            this.incomingCallModal.classList.remove('show');
            setTimeout(() => {
                this.incomingCallModal.style.display = 'none';
            }, 300);
        }
        
        this.stopRingtone();
        
        if (this.autoDeclineTimer) {
            clearTimeout(this.autoDeclineTimer);
            this.autoDeclineTimer = null;
        }
    }

    hideActiveCall() {
        if (this.activeCallInterface) {
            this.activeCallInterface.classList.remove('show');
            setTimeout(() => {
                this.activeCallInterface.style.display = 'none';
            }, 300);
        }
    }

    acceptCall() {
        if (!this.incomingCall) return;
        
        // Trigger WebRTC to accept the call
        if (window.webrtcManager) {
            window.webrtcManager.answerCall(this.incomingCall.callId);
        }
        
        this.hideIncomingCall();
    }

    declineCall() {
        if (!this.incomingCall) return;
        
        // Trigger WebRTC to decline the call
        if (window.webrtcManager) {
            window.webrtcManager.declineCall(this.incomingCall.callId);
        }
        
        this.hideIncomingCall();
    }

    endCall() {
        if (!this.activeCall) return;
        
        // Trigger WebRTC to end the call
        if (window.webrtcManager) {
            window.webrtcManager.endCall(this.activeCall.callId);
        }
        
        this.hideCallInterface();
    }

    toggleMute() {
        if (!this.activeCall) return;
        
        const muteBtn = document.getElementById('mute-btn');
        const icon = muteBtn.querySelector('i');
        const text = muteBtn.querySelector('span');
        
        if (window.webrtcManager) {
            const isMuted = window.webrtcManager.toggleMute(this.activeCall.callId);
            
            if (isMuted) {
                icon.className = 'fas fa-microphone-slash';
                text.textContent = 'Unmute';
                muteBtn.classList.add('active');
            } else {
                icon.className = 'fas fa-microphone';
                text.textContent = 'Mute';
                muteBtn.classList.remove('active');
            }
        }
    }

    toggleVideo() {
        if (!this.activeCall) return;
        
        const videoBtn = document.getElementById('video-btn');
        const icon = videoBtn.querySelector('i');
        const text = videoBtn.querySelector('span');
        
        if (window.webrtcManager) {
            const isVideoEnabled = window.webrtcManager.toggleVideo(this.activeCall.callId);
            
            if (isVideoEnabled) {
                icon.className = 'fas fa-video';
                text.textContent = 'Video';
                videoBtn.classList.remove('active');
                document.getElementById('local-video').style.display = 'block';
            } else {
                icon.className = 'fas fa-video-slash';
                text.textContent = 'Enable Video';
                videoBtn.classList.add('active');
                document.getElementById('local-video').style.display = 'none';
            }
        }
    }

    toggleScreenShare() {
        if (!this.activeCall) return;
        
        const screenBtn = document.getElementById('screen-btn');
        const icon = screenBtn.querySelector('i');
        const text = screenBtn.querySelector('span');
        
        if (window.webrtcManager) {
            const isSharing = screenBtn.classList.contains('active');
            
            if (isSharing) {
                window.webrtcManager.stopScreenShare();
                icon.className = 'fas fa-desktop';
                text.textContent = 'Share';
                screenBtn.classList.remove('active');
            } else {
                window.webrtcManager.startScreenShare()
                    .then(() => {
                        icon.className = 'fas fa-stop';
                        text.textContent = 'Stop Share';
                        screenBtn.classList.add('active');
                    })
                    .catch(error => {
                        console.error('Failed to start screen share:', error);
                    });
            }
        }
    }

    toggleRecording() {
        if (!this.activeCall) return;
        
        const recordBtn = document.getElementById('record-btn');
        const icon = recordBtn.querySelector('i');
        const text = recordBtn.querySelector('span');
        
        if (window.webrtcManager) {
            const isRecording = recordBtn.classList.contains('active');
            
            if (isRecording) {
                window.webrtcManager.stopRecording(this.activeCall.callId);
                icon.className = 'fas fa-record-vinyl';
                text.textContent = 'Record';
                recordBtn.classList.remove('active');
            } else {
                const started = window.webrtcManager.startRecording(this.activeCall.callId);
                if (started) {
                    icon.className = 'fas fa-stop';
                    text.textContent = 'Stop Recording';
                    recordBtn.classList.add('active');
                }
            }
        }
    }

    minimizeCall() {
        if (this.activeCallInterface) {
            this.activeCallInterface.classList.add('minimized');
        }
    }

    maximizeCall() {
        if (this.activeCallInterface) {
            this.activeCallInterface.classList.remove('minimized');
        }
    }

    togglePictureInPicture() {
        const remoteVideo = document.getElementById('remote-video');
        
        if (remoteVideo && document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                remoteVideo.requestPictureInPicture()
                    .catch(error => {
                        console.error('Failed to enter picture-in-picture:', error);
                    });
            }
        }
    }

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.activeCallInterface.requestFullscreen()
                .catch(error => {
                    console.error('Failed to enter fullscreen:', error);
                });
        }
    }

    showSettings() {
        const settings = document.getElementById('call-settings');
        settings.style.display = 'block';
    }

    hideSettings() {
        const settings = document.getElementById('call-settings');
        settings.style.display = 'none';
    }

    updateDeviceSelectors() {
        if (!window.webrtcManager) return;
        
        const devices = window.webrtcManager.state.mediaDevices;
        
        // Update audio input selector
        const audioInputSelect = document.getElementById('audio-input-select');
        audioInputSelect.innerHTML = '';
        devices.audioInput.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${device.deviceId.substr(0, 8)}`;
            audioInputSelect.appendChild(option);
        });
        
        // Update audio output selector
        const audioOutputSelect = document.getElementById('audio-output-select');
        audioOutputSelect.innerHTML = '';
        devices.audioOutput.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Speaker ${device.deviceId.substr(0, 8)}`;
            audioOutputSelect.appendChild(option);
        });
        
        // Update video input selector
        const videoInputSelect = document.getElementById('video-input-select');
        videoInputSelect.innerHTML = '';
        devices.videoInput.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${device.deviceId.substr(0, 8)}`;
            videoInputSelect.appendChild(option);
        });

        // Add change event listeners
        audioInputSelect.addEventListener('change', (e) => {
            window.webrtcManager.switchAudioDevice(e.target.value);
        });
        
        videoInputSelect.addEventListener('change', (e) => {
            window.webrtcManager.switchVideoDevice(e.target.value);
        });
    }

    setupVideoStreams(callData) {
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        
        // Set local stream
        if (callData.localStream) {
            localVideo.srcObject = callData.localStream;
        }
        
        // Set remote stream
        if (callData.remoteStream) {
            remoteVideo.srcObject = callData.remoteStream;
        }
    }

    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const elapsed = Date.now() - this.callStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                document.getElementById('call-duration').textContent = timeString;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    playRingtone() {
        if (this.ringtone) {
            this.ringtone.play().catch(error => {
                console.warn('Could not play ringtone:', error);
            });
        }
    }

    stopRingtone() {
        if (this.ringtone) {
            this.ringtone.pause();
            this.ringtone.currentTime = 0;
        }
    }

    updateCallQuality(quality) {
        const indicator = document.getElementById('quality-indicator');
        const bars = indicator.querySelectorAll('.bar');
        
        // Update signal bars based on quality
        bars.forEach((bar, index) => {
            bar.classList.remove('excellent', 'good', 'fair', 'poor');
            
            if (quality.rating === 'excellent' && index < 4) {
                bar.classList.add('excellent');
            } else if (quality.rating === 'good' && index < 3) {
                bar.classList.add('good');
            } else if (quality.rating === 'fair' && index < 2) {
                bar.classList.add('fair');
            } else if (quality.rating === 'poor' && index < 1) {
                bar.classList.add('poor');
            }
        });
        
        // Update tooltip
        indicator.title = `Connection Quality: ${quality.rating.toUpperCase()}\n` +
                         `Round Trip Time: ${quality.roundTripTime}ms\n` +
                         `Packet Loss: ${quality.packetLoss}%`;
    }

    adjustVideoLayout() {
        // Adjust video layout based on window size
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer) return;
        
        const windowAspectRatio = window.innerWidth / window.innerHeight;
        
        if (windowAspectRatio > 1.5) {
            videoContainer.classList.add('wide-layout');
        } else {
            videoContainer.classList.remove('wide-layout');
        }
    }

    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'm':
                    event.preventDefault();
                    this.toggleMute();
                    break;
                case 'e':
                    event.preventDefault();
                    this.endCall();
                    break;
                case 'v':
                    event.preventDefault();
                    this.toggleVideo();
                    break;
                case 's':
                    event.preventDefault();
                    this.toggleScreenShare();
                    break;
            }
        }
        
        if (event.key === 'Escape') {
            if (document.getElementById('call-settings').style.display === 'block') {
                this.hideSettings();
            }
        }
    }

    // Public API
    addParticipant(participant) {
        const participantsList = document.getElementById('participants-list');
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant';
        participantDiv.id = `participant-${participant.id}`;
        participantDiv.innerHTML = `
            <div class="participant-video">
                <video autoplay playsinline></video>
                <div class="participant-info">
                    <span class="participant-name">${participant.name}</span>
                    <div class="participant-status">
                        <i class="fas fa-microphone" data-status="unmuted"></i>
                        <i class="fas fa-video" data-status="enabled"></i>
                    </div>
                </div>
            </div>
        `;
        
        participantsList.appendChild(participantDiv);
        
        // Set video stream if available
        if (participant.stream) {
            const video = participantDiv.querySelector('video');
            video.srcObject = participant.stream;
        }
    }

    removeParticipant(participantId) {
        const participantDiv = document.getElementById(`participant-${participantId}`);
        if (participantDiv) {
            participantDiv.remove();
        }
    }

    updateParticipantStatus(participantId, status) {
        const participantDiv = document.getElementById(`participant-${participantId}`);
        if (!participantDiv) return;
        
        const muteIcon = participantDiv.querySelector('[data-status="unmuted"], [data-status="muted"]');
        const videoIcon = participantDiv.querySelector('[data-status="enabled"], [data-status="disabled"]');
        
        if (status.muted !== undefined) {
            muteIcon.className = status.muted ? 'fas fa-microphone-slash' : 'fas fa-microphone';
            muteIcon.setAttribute('data-status', status.muted ? 'muted' : 'unmuted');
        }
        
        if (status.videoEnabled !== undefined) {
            videoIcon.className = status.videoEnabled ? 'fas fa-video' : 'fas fa-video-slash';
            videoIcon.setAttribute('data-status', status.videoEnabled ? 'enabled' : 'disabled');
        }
    }
}

// Initialize call interface
window.callInterface = new CallInterfaceManager();
