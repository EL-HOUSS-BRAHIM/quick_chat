/**
 * WebSocket Connection Manager
 * Efficient WebSocket connection handling with reconnection, heartbeat, and connection pooling
 */

import eventBus from './event-bus.js';
import { state } from './state.js';
import errorHandler from './error-handler.js';

class WebSocketManager {
  constructor(options = {}) {
    this.config = {
      wsUrl: null,
      reconnectDelay: 2000, // Base delay for reconnections (ms)
      maxReconnectDelay: 30000, // Maximum reconnection delay (ms)
      reconnectBackoffFactor: 1.5, // Exponential backoff factor
      maxReconnectAttempts: 10, // Maximum number of reconnection attempts
      heartbeatInterval: 30000, // Interval for sending heartbeats (ms)
      heartbeatTimeout: 10000, // Time to wait for heartbeat response (ms)
      connectionTimeout: 10000, // Time to wait for connection to establish (ms)
      debug: false, // Enable debug logging
      subscriptions: [], // List of default channel subscriptions
      batchingEnabled: true, // Enable message batching
      batchInterval: 50, // Milliseconds to batch messages
      ...options
    };
    
    this.socket = null;
    this.state = {
      status: 'disconnected', // disconnected, connecting, connected, reconnecting, error
      reconnectAttempts: 0,
      lastMessageTime: 0,
      lastHeartbeatTime: 0,
      lastHeartbeatResponseTime: 0,
      isHeartbeatPending: false,
      connectionStartTime: 0,
      authToken: null,
      subscriptions: new Set(),
      userId: null,
      messageQueue: [],
      batchTimeout: null,
      connectionId: null
    };
    
    this.timers = {
      heartbeat: null,
      reconnect: null,
      connectionTimeout: null,
      heartbeatTimeout: null
    };
    
    // Message handlers
    this.handlers = new Map();
  }
  
  /**
   * Initialize and connect to the WebSocket server
   */
  async init(wsUrl, authToken = null, userId = null) {
    this.config.wsUrl = wsUrl || this.config.wsUrl;
    this.state.authToken = authToken;
    this.state.userId = userId;
    
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL is required');
    }
    
    // Set up default subscriptions
    this.config.subscriptions.forEach(subscription => {
      this.state.subscriptions.add(subscription);
    });
    
    // Connect
    return this.connect();
  }
  
  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.log('WebSocket already connected');
      return true;
    }
    
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      this.log('WebSocket already connecting');
      return new Promise((resolve, reject) => {
        const onOpen = () => {
          this.socket.removeEventListener('open', onOpen);
          this.socket.removeEventListener('error', onError);
          resolve(true);
        };
        
        const onError = (error) => {
          this.socket.removeEventListener('open', onOpen);
          this.socket.removeEventListener('error', onError);
          reject(error);
        };
        
        this.socket.addEventListener('open', onOpen);
        this.socket.addEventListener('error', onError);
      });
    }
    
    // Clean up any existing connection
    this.cleanupConnection();
    
    // Set connection state
    this.state.status = 'connecting';
    this.state.connectionStartTime = Date.now();
    this.state.connectionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Emit status change event
    eventBus.emit('websocket:status-change', { status: 'connecting' });
    
    // Set connection timeout
    this.timers.connectionTimeout = setTimeout(() => {
      if (this.state.status === 'connecting') {
        this.log('Connection timeout');
        this.handleConnectionTimeout();
      }
    }, this.config.connectionTimeout);
    
    return new Promise((resolve, reject) => {
      try {
        // Create new WebSocket connection
        this.socket = new WebSocket(this.config.wsUrl);
        
        // Set up event handlers
        this.socket.onopen = (event) => this.handleOpen(event, resolve);
        this.socket.onclose = (event) => this.handleClose(event);
        this.socket.onerror = (event) => this.handleError(event, reject);
        this.socket.onmessage = (event) => this.handleMessage(event);
      } catch (error) {
        this.cleanupConnection();
        this.state.status = 'error';
        eventBus.emit('websocket:status-change', { 
          status: 'error', 
          error: error 
        });
        reject(error);
      }
    });
  }
  
  /**
   * Handle successful WebSocket connection
   */
  handleOpen(event, resolvePromise) {
    clearTimeout(this.timers.connectionTimeout);
    
    this.state.status = 'connected';
    this.state.reconnectAttempts = 0;
    this.state.lastMessageTime = Date.now();
    
    this.log('WebSocket connected');
    
    // Emit connected event
    eventBus.emit('websocket:status-change', { status: 'connected' });
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Send authentication if we have a token
    if (this.state.authToken) {
      this.sendAuthToken();
    }
    
    // Send queued messages
    this.flushQueue();
    
    // Send subscriptions
    this.resubscribe();
    
    // Resolve the connection promise
    if (resolvePromise) {
      resolvePromise(true);
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    const wasConnected = this.state.status === 'connected';
    
    this.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
    
    // Clean up resources
    this.cleanupConnection();
    
    // Check if should reconnect
    if (!event.wasClean && state.getState('isOnline')) {
      this.state.status = 'reconnecting';
      eventBus.emit('websocket:status-change', { status: 'reconnecting' });
      
      // Attempt to reconnect with exponential backoff
      this.reconnect();
    } else {
      this.state.status = 'disconnected';
      eventBus.emit('websocket:status-change', { status: 'disconnected' });
    }
    
    // Emit close event
    eventBus.emit('websocket:close', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      wasConnected: wasConnected
    });
  }
  
  /**
   * Handle WebSocket error
   */
  handleError(event, rejectPromise) {
    this.log('WebSocket error', event);
    
    this.state.status = 'error';
    
    // Emit error event
    eventBus.emit('websocket:error', { error: event });
    eventBus.emit('websocket:status-change', { status: 'error', error: event });
    
    // Reject connection promise if provided
    if (rejectPromise) {
      rejectPromise(event);
    }
  }
  
  /**
   * Handle connection timeout
   */
  handleConnectionTimeout() {
    this.log('Connection timed out');
    
    // Clean up the connection
    this.cleanupConnection();
    
    // Update state
    this.state.status = 'error';
    
    // Emit timeout event
    eventBus.emit('websocket:timeout');
    eventBus.emit('websocket:status-change', { 
      status: 'error', 
      error: new Error('Connection timeout') 
    });
    
    // Attempt to reconnect
    this.reconnect();
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    this.state.lastMessageTime = Date.now();
    
    try {
      const data = JSON.parse(event.data);
      
      // Handle heartbeat response
      if (data.type === 'pong') {
        this.handleHeartbeatResponse(data);
        return;
      }
      
      // Handle connection ID message
      if (data.type === 'connection_id') {
        this.state.connectionId = data.connection_id;
        return;
      }
      
      // Emit message event for specific message type
      eventBus.emit(`websocket:message:${data.type}`, data);
      
      // Also emit general message event
      eventBus.emit('websocket:message', data);
      
      // Call registered handler for this message type if exists
      const handler = this.handlers.get(data.type);
      if (handler) {
        handler(data);
      }
    } catch (error) {
      errorHandler.handleError('Error processing WebSocket message', error);
      eventBus.emit('websocket:message-error', { error, rawData: event.data });
    }
  }
  
  /**
   * Handle heartbeat response
   */
  handleHeartbeatResponse(data) {
    clearTimeout(this.timers.heartbeatTimeout);
    
    this.state.isHeartbeatPending = false;
    this.state.lastHeartbeatResponseTime = Date.now();
    
    // Calculate latency
    const latency = this.state.lastHeartbeatResponseTime - this.state.lastHeartbeatTime;
    
    // Emit heartbeat event
    eventBus.emit('websocket:heartbeat', { 
      latency,
      serverTime: data.server_time || null
    });
  }
  
  /**
   * Reconnect to WebSocket server with exponential backoff
   */
  reconnect() {
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Maximum reconnect attempts reached');
      this.state.status = 'disconnected';
      eventBus.emit('websocket:reconnect-failed');
      eventBus.emit('websocket:status-change', { 
        status: 'disconnected', 
        reason: 'max-attempts' 
      });
      return;
    }
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.reconnectBackoffFactor, this.state.reconnectAttempts),
      this.config.maxReconnectDelay
    );
    
    this.state.reconnectAttempts++;
    
    this.log(`Reconnecting in ${delay}ms (attempt ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
    
    // Emit reconnecting event
    eventBus.emit('websocket:reconnecting', { 
      attempt: this.state.reconnectAttempts, 
      maxAttempts: this.config.maxReconnectAttempts,
      delay
    });
    
    // Schedule reconnection
    this.timers.reconnect = setTimeout(() => {
      if (state.getState('isOnline')) {
        this.connect().catch(error => {
          this.log('Reconnection failed', error);
          // Will trigger reconnect again from handleClose
        });
      } else {
        this.log('Reconnection delayed - device is offline');
        // Will attempt reconnection when online status changes
      }
    }, delay);
  }
  
  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.timers.heartbeat = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Skip if a heartbeat is already pending
        if (this.state.isHeartbeatPending) {
          this.log('Previous heartbeat still pending - possible connection issue');
          return;
        }
        
        this.state.isHeartbeatPending = true;
        this.state.lastHeartbeatTime = Date.now();
        
        // Send heartbeat
        this.send({ type: 'ping', timestamp: this.state.lastHeartbeatTime });
        
        // Set timeout for heartbeat response
        this.timers.heartbeatTimeout = setTimeout(() => {
          if (this.state.isHeartbeatPending) {
            this.log('Heartbeat timeout - reconnecting');
            this.state.isHeartbeatPending = false;
            
            // Close connection and reconnect
            if (this.socket) {
              this.socket.close();
              // Will trigger reconnect from handleClose
            }
          }
        }, this.config.heartbeatTimeout);
      }
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.timers.heartbeat) {
      clearInterval(this.timers.heartbeat);
      this.timers.heartbeat = null;
    }
    
    if (this.timers.heartbeatTimeout) {
      clearTimeout(this.timers.heartbeatTimeout);
      this.timers.heartbeatTimeout = null;
    }
    
    this.state.isHeartbeatPending = false;
  }
  
  /**
   * Send authentication token
   */
  sendAuthToken() {
    this.send({
      type: 'auth',
      token: this.state.authToken,
      user_id: this.state.userId
    });
  }
  
  /**
   * Send message to WebSocket server
   */
  send(data) {
    // Convert to string if it's an object
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    
    // If we're connected, send immediately
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      if (this.config.batchingEnabled && typeof data === 'object' && 
          data.type !== 'ping' && data.type !== 'auth') {
        // Add to batch queue for non-critical messages
        this.queueMessage(message);
      } else {
        // Send immediately for critical messages
        this.socket.send(message);
      }
      return true;
    } else {
      // Queue message for later
      this.queueMessage(message);
      
      // Try to connect if disconnected
      if (this.state.status === 'disconnected') {
        this.connect().catch(error => {
          this.log('Failed to connect when sending message', error);
        });
      }
      
      return false;
    }
  }
  
  /**
   * Queue a message for later sending
   */
  queueMessage(message) {
    this.state.messageQueue.push({
      message,
      timestamp: Date.now()
    });
    
    // Start batch timer if enabled and not already running
    if (this.config.batchingEnabled && !this.state.batchTimeout) {
      this.state.batchTimeout = setTimeout(() => {
        this.flushQueue();
      }, this.config.batchInterval);
    }
  }
  
  /**
   * Send all queued messages
   */
  flushQueue() {
    if (this.state.batchTimeout) {
      clearTimeout(this.state.batchTimeout);
      this.state.batchTimeout = null;
    }
    
    if (this.state.messageQueue.length === 0) return;
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const now = Date.now();
      
      // Group messages by time threshold (to avoid sending very old messages)
      const recentMessages = this.state.messageQueue.filter(
        item => (now - item.timestamp) < 60000 // Only send messages less than 1 minute old
      );
      
      if (recentMessages.length > 0) {
        if (this.config.batchingEnabled && recentMessages.length > 1) {
          // Send as batch
          const batch = {
            type: 'batch',
            messages: recentMessages.map(item => {
              try {
                return JSON.parse(item.message);
              } catch (e) {
                return item.message;
              }
            }),
            count: recentMessages.length
          };
          
          this.socket.send(JSON.stringify(batch));
          this.log(`Sent batch of ${recentMessages.length} messages`);
        } else {
          // Send individually
          recentMessages.forEach(item => {
            this.socket.send(item.message);
          });
        }
      }
      
      // Clear queue
      this.state.messageQueue = [];
    }
  }
  
  /**
   * Subscribe to a channel/topic
   */
  subscribe(channel, data = {}) {
    const subscriptionKey = this.getSubscriptionKey(channel, data);
    
    if (this.state.subscriptions.has(subscriptionKey)) {
      return; // Already subscribed
    }
    
    // Add to subscriptions set
    this.state.subscriptions.add(subscriptionKey);
    
    // Send subscription if connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        channel,
        ...data
      });
    }
  }
  
  /**
   * Unsubscribe from a channel/topic
   */
  unsubscribe(channel, data = {}) {
    const subscriptionKey = this.getSubscriptionKey(channel, data);
    
    if (!this.state.subscriptions.has(subscriptionKey)) {
      return; // Not subscribed
    }
    
    // Remove from subscriptions set
    this.state.subscriptions.delete(subscriptionKey);
    
    // Send unsubscription if connected
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        channel,
        ...data
      });
    }
  }
  
  /**
   * Get unique key for a subscription
   */
  getSubscriptionKey(channel, data) {
    return `${channel}:${JSON.stringify(data)}`;
  }
  
  /**
   * Resubscribe to all channels after reconnection
   */
  resubscribe() {
    if (this.state.subscriptions.size === 0) return;
    
    this.log(`Resubscribing to ${this.state.subscriptions.size} channels`);
    
    // Send all subscriptions
    for (const subscription of this.state.subscriptions) {
      try {
        const [channel, dataJson] = subscription.split(':', 2);
        const data = dataJson ? JSON.parse(dataJson) : {};
        
        this.send({
          type: 'subscribe',
          channel,
          ...data
        });
      } catch (error) {
        this.log('Error resubscribing', error);
      }
    }
  }
  
  /**
   * Register a message handler
   */
  registerHandler(messageType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.handlers.set(messageType, handler);
    return () => this.handlers.delete(messageType); // Return unregister function
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.log('Manually disconnecting');
    
    // Send unsubscribe message for all subscriptions
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe_all'
      });
    }
    
    // Clean up
    this.cleanupConnection();
    
    // Update state
    this.state.status = 'disconnected';
    eventBus.emit('websocket:status-change', { status: 'disconnected', reason: 'manual' });
  }
  
  /**
   * Clean up WebSocket connection and related resources
   */
  cleanupConnection() {
    // Stop timers
    this.stopHeartbeat();
    
    if (this.timers.reconnect) {
      clearTimeout(this.timers.reconnect);
      this.timers.reconnect = null;
    }
    
    if (this.timers.connectionTimeout) {
      clearTimeout(this.timers.connectionTimeout);
      this.timers.connectionTimeout = null;
    }
    
    if (this.state.batchTimeout) {
      clearTimeout(this.state.batchTimeout);
      this.state.batchTimeout = null;
    }
    
    // Close WebSocket if it exists
    if (this.socket) {
      // Remove event listeners to avoid memory leaks
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Close socket if it's not already closed
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      
      this.socket = null;
    }
  }
  
  /**
   * Get current WebSocket status
   */
  getStatus() {
    return {
      status: this.state.status,
      reconnectAttempts: this.state.reconnectAttempts,
      lastMessageTime: this.state.lastMessageTime,
      latency: this.state.lastHeartbeatResponseTime ? 
        (this.state.lastHeartbeatResponseTime - this.state.lastHeartbeatTime) : null,
      queuedMessages: this.state.messageQueue.length,
      connectionId: this.state.connectionId,
      subscriptions: [...this.state.subscriptions]
    };
  }
  
  /**
   * Debug log helper
   */
  log(...args) {
    if (this.config.debug) {
      console.log('[WebSocketManager]', ...args);
    }
  }
}

export default WebSocketManager;
