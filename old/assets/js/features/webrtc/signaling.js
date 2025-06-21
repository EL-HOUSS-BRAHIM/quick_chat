/**
 * WebRTC Signaling Service
 * Handles communication with the signaling server
 */

import errorHandler from '../../core/error-handler.js';
import utils from '../../core/utils.js';

class SignalingService {
  constructor(options = {}) {
    this.config = {
      signalingServer: options.signalingServer || 
                       (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
                       window.location.host + '/ws',
      reconnectAttempts: options.reconnectAttempts || 3,
      reconnectDelay: options.reconnectDelay || 2000, // 2 seconds
      ...options
    };
    
    this.socket = null;
    this.userId = null;
    this.eventHandlers = {
      open: [],
      close: [],
      error: [],
      offer: [],
      answer: [],
      iceCandidate: [],
      hangup: []
    };
    this.reconnectAttempt = 0;
    this.isConnecting = false;
  }
  
  /**
   * Connect to signaling server
   */
  async connect(userId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('Signaling already connected');
      return;
    }
    
    if (this.isConnecting) {
      console.log('Signaling connection already in progress');
      return;
    }
    
    this.isConnecting = true;
    this.userId = userId;
    
    try {
      // Create WebSocket connection
      this.socket = new WebSocket(this.config.signalingServer);
      
      // Setup event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      
      // Wait for connection to open
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 seconds timeout
        
        this.once('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        this.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }
  
  /**
   * Disconnect from signaling server
   */
  disconnect() {
    if (this.socket) {
      // Remove event handlers
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Close connection
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      
      this.socket = null;
    }
    
    this.isConnecting = false;
    this.reconnectAttempt = 0;
  }
  
  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    console.log('Signaling connection established');
    this.isConnecting = false;
    this.reconnectAttempt = 0;
    
    // Send authentication message
    this.sendJson({
      type: 'auth',
      userId: this.userId
    });
    
    // Trigger open event
    this.triggerEvent('open');
  }
  
  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    console.log('Signaling connection closed:', event.code, event.reason);
    this.isConnecting = false;
    
    // Try to reconnect if not a normal closure
    if (event.code !== 1000 && event.code !== 1001) {
      this.attemptReconnect();
    }
    
    // Trigger close event
    this.triggerEvent('close', event);
  }
  
  /**
   * Handle WebSocket error event
   */
  handleError(error) {
    console.error('Signaling error:', error);
    this.isConnecting = false;
    
    // Trigger error event
    this.triggerEvent('error', error);
  }
  
  /**
   * Handle WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Handle different message types
      switch (message.type) {
        case 'offer':
          this.triggerEvent('offer', {
            from: message.from,
            offer: message.offer
          });
          break;
          
        case 'answer':
          this.triggerEvent('answer', {
            from: message.from,
            answer: message.answer
          });
          break;
          
        case 'iceCandidate':
          this.triggerEvent('iceCandidate', {
            from: message.from,
            candidate: message.candidate
          });
          break;
          
        case 'hangup':
          this.triggerEvent('hangup', {
            from: message.from,
            hangup: message.hangup
          });
          break;
          
        default:
          console.log('Unhandled signaling message:', message);
      }
    } catch (error) {
      console.error('Error parsing signaling message:', error);
    }
  }
  
  /**
   * Attempt to reconnect to the signaling server
   */
  attemptReconnect() {
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempt++;
    console.log(`Reconnecting to signaling server (attempt ${this.reconnectAttempt}/${this.config.reconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect(this.userId).catch(error => {
        console.error('Reconnect failed:', error);
      });
    }, this.config.reconnectDelay);
  }
  
  /**
   * Send JSON message to signaling server
   */
  sendJson(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Signaling connection not open');
    }
    
    const message = JSON.stringify(data);
    this.socket.send(message);
  }
  
  /**
   * Send offer to a user
   */
  sendOffer(to, offer) {
    this.sendJson({
      type: 'offer',
      from: this.userId,
      to,
      offer
    });
  }
  
  /**
   * Send answer to a user
   */
  sendAnswer(to, answer) {
    this.sendJson({
      type: 'answer',
      from: this.userId,
      to,
      answer
    });
  }
  
  /**
   * Send ICE candidate to a user
   */
  sendIceCandidate(to, candidate) {
    this.sendJson({
      type: 'iceCandidate',
      from: this.userId,
      to,
      candidate
    });
  }
  
  /**
   * Send hangup to a user
   */
  sendHangup(to, hangup) {
    this.sendJson({
      type: 'hangup',
      from: this.userId,
      to,
      hangup
    });
  }
  
  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    
    this.eventHandlers[event].push(handler);
  }
  
  /**
   * Register one-time event handler
   */
  once(event, handler) {
    const onceHandler = (...args) => {
      this.off(event, onceHandler);
      handler(...args);
    };
    
    this.on(event, onceHandler);
  }
  
  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.eventHandlers[event]) {
      return;
    }
    
    if (!handler) {
      // Remove all handlers for this event
      this.eventHandlers[event] = [];
      return;
    }
    
    const index = this.eventHandlers[event].indexOf(handler);
    if (index !== -1) {
      this.eventHandlers[event].splice(index, 1);
    }
  }
  
  /**
   * Trigger event
   */
  triggerEvent(event, ...args) {
    if (!this.eventHandlers[event]) {
      return;
    }
    
    for (const handler of this.eventHandlers[event]) {
      try {
        handler(...args);
      } catch (error) {
        errorHandler.handleError(error, `Error in ${event} event handler`);
      }
    }
  }
}

export default SignalingService;
