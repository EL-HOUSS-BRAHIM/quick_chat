/**
 * Event Bus for application-wide messaging
 * Enables decoupled communication between components
 */

class EventBus {
  constructor() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event and unsubscribe after first trigger
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    if (!this.onceEvents[event]) {
      this.onceEvents[event] = [];
    }
    
    this.onceEvents[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      if (this.onceEvents[event]) {
        this.onceEvents[event] = this.onceEvents[event].filter(cb => cb !== callback);
      }
    };
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
    
    if (this.onceEvents[event]) {
      this.onceEvents[event] = this.onceEvents[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Data to pass to subscribers
   */
  emit(event, data) {
    // Regular subscribers
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
    
    // One-time subscribers
    if (this.onceEvents[event]) {
      const callbacks = [...this.onceEvents[event]];
      this.onceEvents[event] = [];
      
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in one-time event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if event has subscribers
   * @param {string} event - Event name
   * @returns {boolean} True if has subscribers
   */
  hasListeners(event) {
    return (
      (this.events[event] && this.events[event].length > 0) || 
      (this.onceEvents[event] && this.onceEvents[event].length > 0)
    );
  }

  /**
   * Get subscriber count for an event
   * @param {string} event - Event name
   * @returns {number} Count of subscribers
   */
  listenerCount(event) {
    let count = 0;
    
    if (this.events[event]) {
      count += this.events[event].length;
    }
    
    if (this.onceEvents[event]) {
      count += this.onceEvents[event].length;
    }
    
    return count;
  }

  /**
   * Remove all subscribers
   */
  clear() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * Get all event names with subscribers
   * @returns {string[]} Event names
   */
  eventNames() {
    return Array.from(new Set([
      ...Object.keys(this.events),
      ...Object.keys(this.onceEvents)
    ]));
  }
}

// Create singleton instance
const eventBus = new EventBus();

export default eventBus;
