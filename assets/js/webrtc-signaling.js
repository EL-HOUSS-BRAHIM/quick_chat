/**
 * WebRTC Signaling Server (Node.js/Socket.io implementation)
 * This provides real-time communication for voice/video calls
 */

// For PHP environments, this would be implemented as a separate service
// Here's a basic implementation structure

class WebRTCSignaling {
    constructor() {
        this.rooms = new Map();
        this.users = new Map();
        this.calls = new Map();
    }
    
    /**
     * Initialize WebRTC signaling for a user
     */
    initialize(userId, socket) {
        this.users.set(userId, {
            id: userId,
            socket: socket,
            currentRoom: null,
            isInCall: false
        });
        
        this.setupSocketHandlers(userId, socket);
    }
    
    /**
     * Setup socket event handlers
     */
    setupSocketHandlers(userId, socket) {
        // Join a call room
        socket.on('join-call', (data) => {
            this.handleJoinCall(userId, data);
        });
        
        // Leave a call room
        socket.on('leave-call', (data) => {
            this.handleLeaveCall(userId, data);
        });
        
        // Send offer
        socket.on('offer', (data) => {
            this.handleOffer(userId, data);
        });
        
        // Send answer
        socket.on('answer', (data) => {
            this.handleAnswer(userId, data);
        });
        
        // Send ICE candidate
        socket.on('ice-candidate', (data) => {
            this.handleIceCandidate(userId, data);
        });
        
        // Call initiation
        socket.on('initiate-call', (data) => {
            this.handleInitiateCall(userId, data);
        });
        
        // Call response (accept/reject)
        socket.on('call-response', (data) => {
            this.handleCallResponse(userId, data);
        });
        
        // End call
        socket.on('end-call', (data) => {
            this.handleEndCall(userId, data);
        });
        
        // Disconnect handling
        socket.on('disconnect', () => {
            this.handleDisconnect(userId);
        });
    }
    
    /**
     * Handle user joining a call room
     */
    handleJoinCall(userId, data) {
        const { roomId, callType } = data;
        const user = this.users.get(userId);
        
        if (!user) return;
        
        // Create room if it doesn't exist
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                participants: new Set(),
                callType: callType,
                createdAt: new Date()
            });
        }
        
        const room = this.rooms.get(roomId);
        room.participants.add(userId);
        user.currentRoom = roomId;
        user.isInCall = true;
        
        // Notify other participants
        this.broadcastToRoom(roomId, 'user-joined', {
            userId: userId,
            participants: Array.from(room.participants)
        }, userId);
        
        // Send current participants to new user
        user.socket.emit('room-joined', {
            roomId: roomId,
            participants: Array.from(room.participants)
        });
    }
    
    /**
     * Handle user leaving a call room
     */
    handleLeaveCall(userId, data) {
        const user = this.users.get(userId);
        if (!user || !user.currentRoom) return;
        
        const room = this.rooms.get(user.currentRoom);
        if (room) {
            room.participants.delete(userId);
            
            // Notify other participants
            this.broadcastToRoom(user.currentRoom, 'user-left', {
                userId: userId,
                participants: Array.from(room.participants)
            }, userId);
            
            // Clean up empty room
            if (room.participants.size === 0) {
                this.rooms.delete(user.currentRoom);
            }
        }
        
        user.currentRoom = null;
        user.isInCall = false;
    }
    
    /**
     * Handle WebRTC offer
     */
    handleOffer(userId, data) {
        const { targetUserId, offer } = data;
        const targetUser = this.users.get(targetUserId);
        
        if (targetUser) {
            targetUser.socket.emit('offer', {
                fromUserId: userId,
                offer: offer
            });
        }
    }
    
    /**
     * Handle WebRTC answer
     */
    handleAnswer(userId, data) {
        const { targetUserId, answer } = data;
        const targetUser = this.users.get(targetUserId);
        
        if (targetUser) {
            targetUser.socket.emit('answer', {
                fromUserId: userId,
                answer: answer
            });
        }
    }
    
    /**
     * Handle ICE candidate
     */
    handleIceCandidate(userId, data) {
        const { targetUserId, candidate } = data;
        const targetUser = this.users.get(targetUserId);
        
        if (targetUser) {
            targetUser.socket.emit('ice-candidate', {
                fromUserId: userId,
                candidate: candidate
            });
        }
    }
    
    /**
     * Handle call initiation
     */
    handleInitiateCall(userId, data) {
        const { targetUserId, callType } = data;
        const targetUser = this.users.get(targetUserId);
        const caller = this.users.get(userId);
        
        if (targetUser && !targetUser.isInCall) {
            const callId = this.generateCallId();
            
            // Store call information
            this.calls.set(callId, {
                id: callId,
                callerId: userId,
                calleeId: targetUserId,
                callType: callType,
                status: 'ringing',
                startedAt: new Date()
            });
            
            // Send call invitation to target user
            targetUser.socket.emit('incoming-call', {
                callId: callId,
                fromUserId: userId,
                callType: callType,
                callerInfo: {
                    // You would get this from user database
                    id: userId,
                    name: 'User ' + userId
                }
            });
            
            // Notify caller that call is ringing
            caller.socket.emit('call-ringing', {
                callId: callId,
                targetUserId: targetUserId
            });
        } else {
            // User is busy or not available
            caller.socket.emit('call-failed', {
                reason: targetUser ? 'busy' : 'user-not-found'
            });
        }
    }
    
    /**
     * Handle call response (accept/reject)
     */
    handleCallResponse(userId, data) {
        const { callId, accepted } = data;
        const call = this.calls.get(callId);
        
        if (!call || call.calleeId !== userId) return;
        
        const caller = this.users.get(call.callerId);
        const callee = this.users.get(call.calleeId);
        
        if (accepted) {
            // Update call status
            call.status = 'accepted';
            call.acceptedAt = new Date();
            
            // Create call room
            const roomId = `call_${callId}`;
            
            // Notify both users to join the call room
            caller.socket.emit('call-accepted', {
                callId: callId,
                roomId: roomId,
                callType: call.callType
            });
            
            callee.socket.emit('call-accepted', {
                callId: callId,
                roomId: roomId,
                callType: call.callType
            });
        } else {
            // Call rejected
            call.status = 'rejected';
            call.rejectedAt = new Date();
            
            caller.socket.emit('call-rejected', {
                callId: callId
            });
            
            // Remove call from active calls
            this.calls.delete(callId);
        }
    }
    
    /**
     * Handle call end
     */
    handleEndCall(userId, data) {
        const { callId } = data;
        const call = this.calls.get(callId);
        
        if (!call) return;
        
        // Update call status
        call.status = 'ended';
        call.endedAt = new Date();
        call.duration = call.endedAt - (call.acceptedAt || call.startedAt);
        
        // Notify both participants
        const participants = [call.callerId, call.calleeId];
        participants.forEach(participantId => {
            const participant = this.users.get(participantId);
            if (participant) {
                participant.socket.emit('call-ended', {
                    callId: callId,
                    duration: call.duration
                });
                participant.isInCall = false;
            }
        });
        
        // Clean up call room if exists
        const roomId = `call_${callId}`;
        if (this.rooms.has(roomId)) {
            this.rooms.delete(roomId);
        }
        
        // Store call history (would typically save to database)
        this.storeCallHistory(call);
        
        // Remove from active calls
        this.calls.delete(callId);
    }
    
    /**
     * Handle user disconnect
     */
    handleDisconnect(userId) {
        const user = this.users.get(userId);
        if (!user) return;
        
        // Leave any current room
        if (user.currentRoom) {
            this.handleLeaveCall(userId, { roomId: user.currentRoom });
        }
        
        // End any active calls
        for (const [callId, call] of this.calls.entries()) {
            if (call.callerId === userId || call.calleeId === userId) {
                this.handleEndCall(userId, { callId: callId });
            }
        }
        
        // Remove user
        this.users.delete(userId);
    }
    
    /**
     * Broadcast message to all users in a room except sender
     */
    broadcastToRoom(roomId, event, data, excludeUserId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        
        room.participants.forEach(participantId => {
            if (participantId !== excludeUserId) {
                const participant = this.users.get(participantId);
                if (participant) {
                    participant.socket.emit(event, data);
                }
            }
        });
    }
    
    /**
     * Generate unique call ID
     */
    generateCallId() {
        return 'call_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    /**
     * Store call history (placeholder for database integration)
     */
    storeCallHistory(call) {
        console.log('Storing call history:', call);
        // In a real implementation, this would save to database
        // using the call_history table we created earlier
    }
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebRTCSignaling;
}

// For browser environments, attach to window
if (typeof window !== 'undefined') {
    window.WebRTCSignaling = WebRTCSignaling;
}
