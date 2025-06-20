/**
 * Event Bus Service
 * Provides centralized event management for the application
 */

import { logger } from '../utils/logger.js';

export class EventBus {
  constructor() {
    this.events = new Map();
    this.maxListeners = 50;
    this.debug = false;
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @param {Object} options - Listener options
   */
  on(event, callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Event callback must be a function');
    }

    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    const listeners = this.events.get(event);
    
    // Check max listeners limit
    if (listeners.length >= this.maxListeners) {
      logger.warn(`Maximum listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }

    const listener = {
      callback,
      once: options.once || false,
      priority: options.priority || 0,
      id: this.generateListenerId()
    };

    // Insert listener based on priority (higher priority first)
    const insertIndex = listeners.findIndex(l => l.priority < listener.priority);
    if (insertIndex === -1) {
      listeners.push(listener);
    } else {
      listeners.splice(insertIndex, 0, listener);
    }

    if (this.debug) {
      logger.debug(`Event listener added: ${event} (${listener.id})`);
    }

    return listener.id;
  }

  /**
   * Add one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @param {Object} options - Listener options
   */
  once(event, callback, options = {}) {
    return this.on(event, callback, { ...options, once: true });
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {string|Function} callbackOrId - Callback function or listener ID
   */
  off(event, callbackOrId) {
    if (!this.events.has(event)) {
      return false;
    }

    const listeners = this.events.get(event);
    const initialLength = listeners.length;

    if (typeof callbackOrId === 'string') {
      // Remove by ID
      const index = listeners.findIndex(l => l.id === callbackOrId);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    } else if (typeof callbackOrId === 'function') {
      // Remove by callback function
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].callback === callbackOrId) {
          listeners.splice(i, 1);
        }
      }
    }

    // Clean up empty event arrays
    if (listeners.length === 0) {
      this.events.delete(event);
    }

    const removed = initialLength - listeners.length;
    
    if (this.debug && removed > 0) {
      logger.debug(`Event listener(s) removed: ${event} (${removed} listeners)`);
    }

    return removed > 0;
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @param {Object} options - Emit options
   */
  emit(event, data = null, options = {}) {
    if (!this.events.has(event)) {
      if (this.debug) {
        logger.debug(`No listeners for event: ${event}`);
      }
      return false;
    }

    const listeners = this.events.get(event).slice(); // Create copy to avoid issues with modifications during iteration
    const eventObject = {
      type: event,
      data,
      timestamp: Date.now(),
      preventDefault: false,
      stopPropagation: false
    };

    if (this.debug) {
      logger.debug(`Emitting event: ${event}`, data);
    }

    let listenersExecuted = 0;

    for (const listener of listeners) {
      if (eventObject.stopPropagation) {
        break;
      }

      try {
        // Execute callback with proper context
        if (options.async) {
          // Execute async
          listener.callback(eventObject).catch(error => {
            logger.error(`Async event listener error for ${event}:`, error);
          });
        } else {
          // Execute sync
          listener.callback(eventObject);
        }

        listenersExecuted++;

        // Remove one-time listeners
        if (listener.once) {
          this.off(event, listener.id);
        }

      } catch (error) {
        logger.error(`Event listener error for ${event}:`, error);
      }
    }

    if (this.debug) {
      logger.debug(`Event ${event} executed ${listenersExecuted} listeners`);
    }

    return listenersExecuted > 0;
  }

  /**
   * Emit event asynchronously
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  async emitAsync(event, data = null) {
    return this.emit(event, data, { async: true });
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name
   */
  removeAllListeners(event) {
    if (event) {
      const count = this.events.has(event) ? this.events.get(event).length : 0;
      this.events.delete(event);
      
      if (this.debug) {
        logger.debug(`Removed all listeners for event: ${event} (${count} listeners)`);
      }
      
      return count;
    } else {
      // Remove all listeners for all events
      const totalCount = Array.from(this.events.values()).reduce((sum, listeners) => sum + listeners.length, 0);
      this.events.clear();
      
      if (this.debug) {
        logger.debug(`Removed all event listeners (${totalCount} total)`);
      }
      
      return totalCount;
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   */
  listenerCount(event) {
    return this.events.has(event) ? this.events.get(event).length : 0;
  }

  /**
   * Get all event names
   */
  eventNames() {
    return Array.from(this.events.keys());
  }

  /**
   * Set maximum listeners per event
   * @param {number} max - Maximum number of listeners
   */
  setMaxListeners(max) {
    this.maxListeners = Math.max(0, max);
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Debug enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Generate unique listener ID
   */
  generateListenerId() {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create event namespace
   * @param {string} namespace - Namespace prefix
   */
  namespace(namespace) {
    return {
      on: (event, callback, options) => this.on(`${namespace}:${event}`, callback, options),
      once: (event, callback, options) => this.once(`${namespace}:${event}`, callback, options),
      off: (event, callbackOrId) => this.off(`${namespace}:${event}`, callbackOrId),
      emit: (event, data, options) => this.emit(`${namespace}:${event}`, data, options),
      emitAsync: (event, data) => this.emitAsync(`${namespace}:${event}`, data)
    };
  }

  /**
   * Wait for event to be emitted
   * @param {string} event - Event name
   * @param {number} timeout - Timeout in milliseconds
   */
  waitFor(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, listener);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const listener = this.once(event, (eventObject) => {
        clearTimeout(timer);
        resolve(eventObject);
      });
    });
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    const info = {
      totalEvents: this.events.size,
      totalListeners: 0,
      events: {}
    };

    for (const [event, listeners] of this.events) {
      info.totalListeners += listeners.length;
      info.events[event] = {
        listenerCount: listeners.length,
        listeners: listeners.map(l => ({
          id: l.id,
          once: l.once,
          priority: l.priority
        }))
      };
    }

    return info;
  }
}

// Create singleton instance
export const eventBus = new EventBus();
