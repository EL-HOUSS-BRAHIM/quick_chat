/**
 * WebRTC Connection Pool
 * Manages and reuses WebRTC connections for better performance
 */

import errorHandler from '../../core/error-handler.js';
import eventBus from '../../core/event-bus.js';

class ConnectionPool {
  /**
   * Creates a new connection pool for WebRTC connections
   * @param {Object} options - Configuration options
   * @param {number} options.maxPoolSize - Maximum number of connections to keep in the pool
   * @param {number} options.cleanupInterval - Interval in ms to check for unused connections
   * @param {Object} options.rtcConfig - RTCPeerConnection configuration
   */
  constructor(options = {}) {
    this.maxPoolSize = options.maxPoolSize || 5;
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.rtcConfig = options.rtcConfig || {};
    
    // Connection pools - separate pools for different connection types
    this.availableConnections = {
      audio: [],
      video: [],
      screen: []
    };
    
    this.activeConnections = new Map();
    this.connectionMetadata = new WeakMap();
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    // Log initialization
    console.log(`WebRTC Connection Pool initialized with max size of ${this.maxPoolSize}`);
  }

  /**
   * Get a connection from the pool or create a new one
   * @param {string} type - Connection type ('audio', 'video', 'screen')
   * @param {string} peerId - ID of the peer to connect to
   * @param {Object} metadata - Additional metadata for the connection
   * @returns {RTCPeerConnection} The peer connection
   */
  getConnection(type, peerId, metadata = {}) {
    // Validate type
    if (!['audio', 'video', 'screen'].includes(type)) {
      throw new Error(`Invalid connection type: ${type}`);
    }
    
    // Check if we already have an active connection to this peer
    const connectionKey = `${peerId}-${type}`;
    if (this.activeConnections.has(connectionKey)) {
      console.log(`Returning existing active connection for ${connectionKey}`);
      return this.activeConnections.get(connectionKey);
    }
    
    // Try to get an available connection from the pool
    let connection;
    if (this.availableConnections[type].length > 0) {
      connection = this.availableConnections[type].pop();
      console.log(`Reusing pooled ${type} connection`);
    } else {
      // Create a new connection
      connection = this.createNewConnection();
      console.log(`Created new ${type} connection`);
    }
    
    // Set up connection metadata
    this.connectionMetadata.set(connection, {
      type,
      peerId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      ...metadata
    });
    
    // Add to active connections
    this.activeConnections.set(connectionKey, connection);
    
    // Return the connection
    return connection;
  }

  /**
   * Create a new RTCPeerConnection
   * @returns {RTCPeerConnection} The new peer connection
   */
  createNewConnection() {
    try {
      const connection = new RTCPeerConnection(this.rtcConfig);
      
      // Set up event listeners
      connection.addEventListener('iceconnectionstatechange', () => {
        this.handleConnectionStateChange(connection);
      });
      
      return connection;
    } catch (error) {
      errorHandler.captureError('Failed to create RTCPeerConnection', error);
      throw error;
    }
  }

  /**
   * Handle connection state changes
   * @param {RTCPeerConnection} connection - The connection with changed state
   */
  handleConnectionStateChange(connection) {
    const state = connection.iceConnectionState;
    const metadata = this.connectionMetadata.get(connection) || {};
    
    // Update last used timestamp
    if (metadata) {
      metadata.lastUsed = Date.now();
      this.connectionMetadata.set(connection, metadata);
    }
    
    // Log state change
    console.log(`Connection state changed to ${state} for peer ${metadata.peerId}`);
    
    // If connection failed or closed, remove from active connections
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      this.releaseConnection(connection);
    }
    
    // Emit event for connection state change
    eventBus.emit('webrtc:connectionStateChange', {
      connection,
      state,
      metadata
    });
  }

  /**
   * Release a connection back to the pool or close it
   * @param {RTCPeerConnection} connection - The connection to release
   */
  releaseConnection(connection) {
    const metadata = this.connectionMetadata.get(connection);
    if (!metadata) return;
    
    const { type, peerId } = metadata;
    const connectionKey = `${peerId}-${type}`;
    
    // Remove from active connections
    this.activeConnections.delete(connectionKey);
    
    // Check if connection is still usable
    if (connection.iceConnectionState !== 'closed' && 
        connection.iceConnectionState !== 'failed') {
      
      // Clean up the connection for reuse
      this.cleanupConnectionForReuse(connection);
      
      // Check if we can add it back to the pool
      if (this.availableConnections[type].length < this.maxPoolSize) {
        // Update metadata
        metadata.lastUsed = Date.now();
        this.connectionMetadata.set(connection, metadata);
        
        // Add back to pool
        this.availableConnections[type].push(connection);
        console.log(`Released ${type} connection back to pool`);
      } else {
        // Pool is full, close the connection
        this.closeConnection(connection);
      }
    } else {
      // Connection not usable, close it
      this.closeConnection(connection);
    }
  }

  /**
   * Clean up a connection for reuse
   * @param {RTCPeerConnection} connection - The connection to clean up
   */
  cleanupConnectionForReuse(connection) {
    // Remove all tracks from sender
    const senders = connection.getSenders();
    senders.forEach(sender => {
      connection.removeTrack(sender);
    });
    
    // Close all data channels
    connection.getDataChannels?.()?.forEach(channel => {
      channel.close();
    });
    
    // Reset ICE gathering state
    try {
      connection.restartIce?.();
    } catch (e) {
      // Older browsers might not support this
      console.warn('Failed to restart ICE:', e);
    }
  }

  /**
   * Close a connection completely
   * @param {RTCPeerConnection} connection - The connection to close
   */
  closeConnection(connection) {
    try {
      connection.close();
      this.connectionMetadata.delete(connection);
      console.log('Connection closed and removed from pool');
    } catch (error) {
      errorHandler.captureError('Error closing RTCPeerConnection', error);
    }
  }

  /**
   * Start cleanup interval to remove unused connections
   */
  startCleanupInterval() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupUnusedConnections();
    }, this.cleanupInterval);
  }

  /**
   * Clean up unused connections from the pool
   */
  cleanupUnusedConnections() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Check each pool
    Object.keys(this.availableConnections).forEach(type => {
      const pool = this.availableConnections[type];
      
      // Filter out old connections
      const newPool = pool.filter(connection => {
        const metadata = this.connectionMetadata.get(connection);
        if (!metadata) return false;
        
        const age = now - metadata.lastUsed;
        if (age > maxAge) {
          // Connection too old, close it
          this.closeConnection(connection);
          return false;
        }
        
        return true;
      });
      
      // Update pool
      this.availableConnections[type] = newPool;
    });
    
    console.log('Cleaned up unused connections from pool');
  }

  /**
   * Get statistics about the connection pool
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    return {
      active: this.activeConnections.size,
      available: {
        audio: this.availableConnections.audio.length,
        video: this.availableConnections.video.length,
        screen: this.availableConnections.screen.length
      },
      total: this.activeConnections.size + 
             this.availableConnections.audio.length + 
             this.availableConnections.video.length + 
             this.availableConnections.screen.length
    };
  }

  /**
   * Clean up and destroy the connection pool
   */
  destroy() {
    // Clear cleanup interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Close all connections
    this.activeConnections.forEach(connection => {
      this.closeConnection(connection);
    });
    
    Object.values(this.availableConnections).forEach(pool => {
      pool.forEach(connection => {
        this.closeConnection(connection);
      });
    });
    
    // Clear maps
    this.activeConnections.clear();
    this.availableConnections = { audio: [], video: [], screen: [] };
    
    console.log('Connection pool destroyed');
  }
}

export default ConnectionPool;
