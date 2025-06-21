/**
 * WebSocket Manager Service - Organized Architecture
 * 
 * Manages WebSocket connections for real-time features
 * Handles reconnection, message queuing, and connection health
 * Migrated and enhanced from assets/js/core/websocket-manager.js
 */

import { logger } from '../utils/logger.js';
import { EventBus } from './EventBus.js';

class WebSocketManager {
  constructor(options = {}) {
    this.options = {
      reconnectDelay: options.reconnectDelay || 2000,
      heartbeatInterval: options.heartbeatInterval || 30000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      batchingEnabled: options.batchingEnabled || true,
      debug: options.debug || false,
      ...options
    };

    this.ws = null;
    this.eventBus = new EventBus();
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.heartbeatInterval = null;
    this.messageQueue = [];
    this.batchQueue = [];
    this.batchTimeout = null;
    this.initialized = false;

    // Message handlers
    this.messageHandlers = new Map();
    this.subscriptions = new Set();
  }

  /**
   * Initialize WebSocket manager
   */
  async init() {
    try {
      // Get WebSocket URL from config or construct it
      this.wsUrl = this.getWebSocketUrl();
      
      // Start connection
      await this.connect();
      
      this.initialized = true;
      logger.info('WebSocket Manager initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize WebSocket Manager:', error);
      throw error;
    }
  }

  /**
   * Get WebSocket URL
   */
  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    
    try {
      logger.info('Connecting to WebSocket server:', this.wsUrl);
      
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => this.handleOpen();
      this.ws.onclose = (event) => this.handleClose(event);
      this.ws.onerror = (error) => this.handleError(error);
      this.ws.onmessage = (event) => this.handleMessage(event);
      
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    logger.info('WebSocket connected successfully');
    
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Send queued messages
    this.sendQueuedMessages();
    
    // Emit connection event
    this.eventBus.emit('websocket:connected');
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    logger.info('WebSocket connection closed:', event.code, event.reason);
    
    this.isConnected = false;
    this.isConnecting = false;
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Emit disconnection event
    this.eventBus.emit('websocket:disconnected', { code: event.code, reason: event.reason });
    
    // Schedule reconnect if not intentional close
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    logger.error('WebSocket error:', error);
    this.eventBus.emit('websocket:error', { error });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      if (this.options.debug) {
        logger.debug('Received WebSocket message:', data);
      }
      
      // Handle different message types
      switch (data.type) {
        case 'pong':
          // Heartbeat response
          break;
          
        case 'message':
          this.eventBus.emit('websocket:message', data);
          break;
          
        case 'typing':
          this.eventBus.emit('websocket:typing', data);
          break;
          
        case 'user_status':
          this.eventBus.emit('websocket:user_status', data);
          break;
          
        case 'notification':
          this.eventBus.emit('websocket:notification', data);
          break;
          
        default:
          // Emit generic message event
          this.eventBus.emit(`websocket:${data.type}`, data);
          break;
      }
      
      // Call registered handlers
      if (this.messageHandlers.has(data.type)) {
        const handlers = this.messageHandlers.get(data.type);
        handlers.forEach(handler => {
          try {
            handler(data);
          } catch (error) {
            logger.error('Error in message handler:', error);
          }
        });
      }
      
    } catch (error) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    if (!this.isConnected) {
      // Queue message for later sending
      this.messageQueue.push(data);
      return;
    }

    try {
      const message = JSON.stringify(data);
      
      if (this.options.debug) {
        logger.debug('Sending WebSocket message:', data);
      }
      
      this.ws.send(message);
      
    } catch (error) {
      logger.error('Failed to send WebSocket message:', error);
      // Queue message for retry
      this.messageQueue.push(data);
    }
  }

  /**
   * Send batched message (with optional delay)
   */
  sendBatched(data) {
    if (!this.options.batchingEnabled) {
      this.send(data);
      return;
    }

    this.batchQueue.push(data);
    
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Set new timeout for batch sending
    this.batchTimeout = setTimeout(() => {
      if (this.batchQueue.length > 0) {
        this.send({
          type: 'batch',
          messages: [...this.batchQueue]
        });
        this.batchQueue = [];
      }
    }, 100); // 100ms batch delay
  }

  /**
   * Subscribe to message type
   */
  subscribe(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    
    this.messageHandlers.get(messageType).push(handler);
    this.subscriptions.add({ messageType, handler });
    
    return () => this.unsubscribe(messageType, handler);
  }

  /**
   * Unsubscribe from message type
   */
  unsubscribe(messageType, handler) {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send queued messages
   */
  sendQueuedMessages() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.eventBus.emit('websocket:max_reconnect_attempts');
      return;
    }

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
    
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length
    };
  }
}

// Create singleton instance
export const websocketManager = new WebSocketManager();
export default websocketManager;
