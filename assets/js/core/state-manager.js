/**
 * Enhanced State Management
 * More efficient state update patterns with optimized rendering
 */

class StateManager {
  constructor(initialState = {}) {
    this._state = initialState;
    this._previousState = { ...initialState };
    this._subscribers = new Map();
    this._batchUpdate = false;
    this._pendingChanges = new Set();
    this._computedProperties = new Map();
    this._derivedState = {};
    this._persisted = new Set();
    this._throttled = new Map();
    this._debounced = new Map();
    this._transactionInProgress = false;
    this._transactionChanges = new Set();
    this._nestedSubscriptions = new Map();
    this._updateQueue = [];
    this._processing = false;
    this._objectGraph = new Map();
  }

  /**
   * Get the current state
   * @param {string} [path] - Optional dot-notation path to get a specific state slice
   * @returns {*} Current state or state slice
   */
  getState(path) {
    if (!path) return this._state;
    
    return this._getNestedProperty(this._state, path);
  }

  /**
   * Subscribe to state changes
   * @param {string|Array|function} path - Path to state slice or callback function
   * @param {function} [callback] - Callback to execute when state changes
   * @param {Object} [options] - Subscription options
   * @returns {function} Unsubscribe function
   */
  subscribe(path, callback, options = {}) {
    // Handle case where first param is the callback (subscribe to all changes)
    if (typeof path === 'function') {
      options = callback || {};
      callback = path;
      path = '*';
    }

    // Handle array of paths
    if (Array.isArray(path)) {
      const unsubscribers = path.map(p => this.subscribe(p, callback, options));
      return () => unsubscribers.forEach(unsubscribe => unsubscribe());
    }

    // Generate unique ID for this subscription
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store subscription
    this._subscribers.set(id, {
      path,
      callback,
      options: {
        deep: options.deep !== false,
        immediate: !!options.immediate,
        once: !!options.once,
        throttle: options.throttle || 0,
        debounce: options.debounce || 0,
        equalityFn: options.equalityFn || ((a, b) => a === b),
        ...options
      }
    });

    // Add to nested subscriptions map for faster lookups
    if (path !== '*') {
      if (!this._nestedSubscriptions.has(path)) {
        this._nestedSubscriptions.set(path, new Set());
      }
      this._nestedSubscriptions.get(path).add(id);
      
      // Register parent path subscriptions for nested path updates
      const pathParts = path.split('.');
      if (pathParts.length > 1) {
        for (let i = 1; i < pathParts.length; i++) {
          const parentPath = pathParts.slice(0, -i).join('.');
          if (!this._nestedSubscriptions.has(parentPath)) {
            this._nestedSubscriptions.set(parentPath, new Set());
          }
        }
      }
    }

    // Set up throttling if needed
    if (options.throttle > 0) {
      this._throttled.set(id, {
        lastFired: 0,
        timer: null,
        pending: false
      });
    }

    // Set up debouncing if needed
    if (options.debounce > 0) {
      this._debounced.set(id, {
        timer: null
      });
    }

    // Call immediately if requested
    const subscription = this._subscribers.get(id);
    if (subscription.options.immediate) {
      const currentValue = path === '*' ? this._state : this._getNestedProperty(this._state, path);
      this._callSubscriber(id, subscription, currentValue, currentValue);
    }

    // Return unsubscribe function
    return () => {
      // Clean up throttled or debounced timers
      if (this._throttled.has(id)) {
        const throttleData = this._throttled.get(id);
        if (throttleData.timer) {
          clearTimeout(throttleData.timer);
        }
        this._throttled.delete(id);
      }

      if (this._debounced.has(id)) {
        const debounceData = this._debounced.get(id);
        if (debounceData.timer) {
          clearTimeout(debounceData.timer);
        }
        this._debounced.delete(id);
      }

      // Remove from nested subscriptions
      if (path !== '*' && this._nestedSubscriptions.has(path)) {
        this._nestedSubscriptions.get(path).delete(id);
        if (this._nestedSubscriptions.get(path).size === 0) {
          this._nestedSubscriptions.delete(path);
        }
      }

      // Remove subscription
      this._subscribers.delete(id);
    };
  }

  /**
   * Update state
   * @param {string|Object} pathOrObject - Path to state slice or object with updates
   * @param {*} [value] - New value (if path is provided)
   * @returns {boolean} Whether the update was successful
   */
  setState(pathOrObject, value) {
    if (this._transactionInProgress) {
      // Queue updates during transaction
      if (typeof pathOrObject === 'string') {
        this._transactionChanges.add(pathOrObject);
        this._updateNestedProperty(this._state, pathOrObject, value);
      } else {
        Object.keys(pathOrObject).forEach(path => {
          this._transactionChanges.add(path);
          this._updateNestedProperty(this._state, path, pathOrObject[path]);
        });
      }
      return true;
    }

    // Start batched update if not already in one
    const wasBatching = this._batchUpdate;
    if (!wasBatching) {
      this._startBatchedUpdate();
    }

    let success = true;

    try {
      // Handle object update
      if (typeof pathOrObject === 'object' && pathOrObject !== null) {
        Object.entries(pathOrObject).forEach(([path, val]) => {
          success = this._updateNestedProperty(this._state, path, val) && success;
          if (success) {
            this._pendingChanges.add(path);
          }
        });
      } 
      // Handle path and value update
      else if (typeof pathOrObject === 'string') {
        success = this._updateNestedProperty(this._state, pathOrObject, value);
        if (success) {
          this._pendingChanges.add(pathOrObject);
        }
      }
    } catch (err) {
      console.error('Error updating state:', err);
      success = false;
    }

    // End batched update if we started one
    if (!wasBatching) {
      this._endBatchedUpdate();
    }

    return success;
  }

  /**
   * Start a batch update to group multiple changes into a single notification
   */
  batch(callback) {
    this._startBatchedUpdate();
    
    try {
      callback();
    } catch (err) {
      console.error('Error in batch update:', err);
    }
    
    this._endBatchedUpdate();
  }

  /**
   * Start a state transaction that can be committed or rolled back
   */
  beginTransaction() {
    if (this._transactionInProgress) {
      throw new Error('Transaction already in progress');
    }
    
    // Save current state
    this._transactionSnapshot = JSON.parse(JSON.stringify(this._state));
    this._transactionInProgress = true;
    this._transactionChanges = new Set();
    
    return {
      commit: () => this._commitTransaction(),
      rollback: () => this._rollbackTransaction()
    };
  }

  /**
   * Define a computed property that derives from state
   * @param {string} key - Name of the computed property
   * @param {Function} computeFn - Function to compute the value
   * @param {Array} deps - Array of state paths this computed property depends on
   */
  computed(key, computeFn, deps) {
    // Store computed property definition
    this._computedProperties.set(key, { 
      computeFn, 
      deps,
      value: undefined
    });
    
    // Initial computation
    this._updateComputed(key);
    
    // Subscribe to dependencies to update computed value when they change
    deps.forEach(dep => {
      this.subscribe(dep, () => {
        this._updateComputed(key);
      });
    });
  }

  /**
   * Make certain state keys persist to storage
   * @param {Array} keys - Array of state keys to persist
   * @param {Object} options - Storage options (localStorage, sessionStorage, custom)
   */
  persist(keys, options = {}) {
    const storage = options.storage || localStorage;
    const prefix = options.prefix || 'app_state_';
    
    // Load persisted values
    keys.forEach(key => {
      const storedValue = storage.getItem(`${prefix}${key}`);
      if (storedValue !== null) {
        try {
          const value = JSON.parse(storedValue);
          this._updateNestedProperty(this._state, key, value);
        } catch (e) {
          console.error(`Error parsing stored value for ${key}:`, e);
        }
      }
      
      // Mark as persisted
      this._persisted.add(key);
      
      // Subscribe to changes to persist updates
      this.subscribe(key, (value) => {
        try {
          storage.setItem(`${prefix}${key}`, JSON.stringify(value));
        } catch (e) {
          console.error(`Error persisting value for ${key}:`, e);
        }
      });
    });
  }

  /**
   * Reset state to initial values
   * @param {String|Array} [paths] - Specific paths to reset, or all if not provided
   */
  reset(paths = null) {
    if (paths === null) {
      // Reset entire state
      this._startBatchedUpdate();
      this._state = JSON.parse(JSON.stringify(this._previousState));
      this._pendingChanges.add('*');
      this._endBatchedUpdate();
    } else {
      // Reset specific paths
      const pathsToReset = Array.isArray(paths) ? paths : [paths];
      
      this._startBatchedUpdate();
      
      pathsToReset.forEach(path => {
        const originalValue = this._getNestedProperty(this._previousState, path);
        this._updateNestedProperty(this._state, path, JSON.parse(JSON.stringify(originalValue)));
        this._pendingChanges.add(path);
      });
      
      this._endBatchedUpdate();
    }
  }

  /**
   * Start batched update mode
   */
  _startBatchedUpdate() {
    this._batchUpdate = true;
    this._pendingChanges = new Set();
  }

  /**
   * End batched update and notify subscribers
   */
  _endBatchedUpdate() {
    // Schedule notification
    this._queueUpdate(() => {
      // Calculate derived state
      this._updateAllComputed();
      
      // Freeze state for subscribers to prevent direct mutation
      const frozenState = Object.freeze(JSON.parse(JSON.stringify(this._state)));
      
      // Notify subscribers
      this._notifySubscribers(frozenState, this._pendingChanges);
      
      // Reset batch state
      this._batchUpdate = false;
      this._pendingChanges = new Set();
    });
  }

  /**
   * Queue an update to be processed asynchronously
   */
  _queueUpdate(callback) {
    this._updateQueue.push(callback);
    
    if (!this._processing) {
      this._processing = true;
      
      // Use microtask to process queue
      queueMicrotask(() => {
        const callbacks = [...this._updateQueue];
        this._updateQueue = [];
        
        callbacks.forEach(cb => cb());
        this._processing = false;
        
        // If more updates were queued during processing, process them
        if (this._updateQueue.length > 0) {
          this._queueUpdate(() => {});
        }
      });
    }
  }

  /**
   * Commit a transaction
   */
  _commitTransaction() {
    if (!this._transactionInProgress) {
      throw new Error('No transaction in progress');
    }
    
    // Start batch update for efficient notification
    this._startBatchedUpdate();
    
    // Add all transaction changes to pending changes
    this._transactionChanges.forEach(path => {
      this._pendingChanges.add(path);
    });
    
    // End transaction
    this._transactionInProgress = false;
    this._transactionChanges = null;
    this._transactionSnapshot = null;
    
    // End batch update and notify
    this._endBatchedUpdate();
  }

  /**
   * Rollback a transaction
   */
  _rollbackTransaction() {
    if (!this._transactionInProgress) {
      throw new Error('No transaction in progress');
    }
    
    // Restore state from snapshot
    this._state = this._transactionSnapshot;
    
    // End transaction
    this._transactionInProgress = false;
    this._transactionChanges = null;
    this._transactionSnapshot = null;
  }

  /**
   * Update a computed property
   */
  _updateComputed(key) {
    const computed = this._computedProperties.get(key);
    if (!computed) return;
    
    // Get dependencies values
    const depValues = computed.deps.map(dep => this._getNestedProperty(this._state, dep));
    
    // Compute new value
    try {
      const newValue = computed.computeFn(...depValues);
      
      // Only update if value changed
      if (JSON.stringify(computed.value) !== JSON.stringify(newValue)) {
        computed.value = newValue;
        this._derivedState[key] = newValue;
        
        // Notify subscribers
        if (!this._batchUpdate && !this._transactionInProgress) {
          this._notifyComputedSubscribers(key);
        }
      }
    } catch (err) {
      console.error(`Error computing value for ${key}:`, err);
    }
  }

  /**
   * Update all computed properties
   */
  _updateAllComputed() {
    for (const key of this._computedProperties.keys()) {
      this._updateComputed(key);
    }
  }

  /**
   * Notify subscribers of changes to computed properties
   */
  _notifyComputedSubscribers(key) {
    const computed = this._computedProperties.get(key);
    if (!computed) return;
    
    // Create a set of changes
    const changes = new Set([key]);
    
    // Freeze computed value
    const frozenValue = Object.freeze(JSON.parse(JSON.stringify(computed.value)));
    
    // Find subscribers for this computed property
    for (const [id, subscription] of this._subscribers.entries()) {
      if (subscription.path === key || subscription.path === '*') {
        this._callSubscriber(id, subscription, frozenValue, frozenValue);
      }
    }
  }

  /**
   * Update a nested property in an object
   */
  _updateNestedProperty(obj, path, value) {
    // Handle root update
    if (path === '*') {
      Object.keys(value).forEach(key => {
        obj[key] = value[key];
      });
      return true;
    }
    
    const parts = path.split('.');
    let current = obj;
    
    // Navigate to the parent of the property to update
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      // Create path if it doesn't exist
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      } else if (typeof current[part] !== 'object') {
        // Can't navigate further if not an object
        return false;
      }
      
      current = current[part];
    }
    
    // Update the property
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
    
    return true;
  }

  /**
   * Get a nested property from an object
   */
  _getNestedProperty(obj, path) {
    // Handle root access
    if (!path || path === '*') {
      return obj;
    }
    
    // Handle computed properties
    if (this._computedProperties.has(path)) {
      return this._derivedState[path];
    }
    
    const parts = path.split('.');
    let current = obj;
    
    // Navigate the path
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }

  /**
   * Notify subscribers of state changes
   */
  _notifySubscribers(state, changedPaths) {
    // Return early if no subscribers or no changes
    if (this._subscribers.size === 0 || changedPaths.size === 0) {
      return;
    }
    
    // Track which subscribers we've already notified to avoid duplicates
    const notifiedSubscribers = new Set();
    
    // Check each changed path
    for (const path of changedPaths) {
      // Global subscribers always get notified
      this._notifyPathSubscribers('*', state, notifiedSubscribers);
      
      // Exact path match subscribers
      this._notifyPathSubscribers(path, this._getNestedProperty(state, path), notifiedSubscribers);
      
      // For nested paths, notify parent path subscribers too
      const parts = path.split('.');
      for (let i = 1; i < parts.length; i++) {
        const parentPath = parts.slice(0, -i).join('.');
        this._notifyPathSubscribers(parentPath, this._getNestedProperty(state, parentPath), notifiedSubscribers);
      }
      
      // For parent paths, notify child path subscribers if the parent was completely replaced
      for (const [subPath, subIds] of this._nestedSubscriptions.entries()) {
        if (subPath.startsWith(path + '.')) {
          this._notifyPathSubscribers(subPath, this._getNestedProperty(state, subPath), notifiedSubscribers);
        }
      }
    }
  }

  /**
   * Notify subscribers of a specific path
   */
  _notifyPathSubscribers(path, value, notifiedSubscribers) {
    // Check for direct path subscribers
    if (!this._nestedSubscriptions.has(path)) {
      return;
    }
    
    const subscriberIds = this._nestedSubscriptions.get(path);
    
    for (const id of subscriberIds) {
      // Skip if already notified
      if (notifiedSubscribers.has(id)) {
        continue;
      }
      
      const subscription = this._subscribers.get(id);
      if (!subscription) continue; // Might have been removed during iteration
      
      // Mark as notified
      notifiedSubscribers.add(id);
      
      // Get previous value (or current if not available)
      const previousValue = this._getNestedProperty(this._previousState, subscription.path) || value;
      
      // Call subscriber
      this._callSubscriber(id, subscription, value, previousValue);
    }
  }

  /**
   * Call a subscriber with appropriate throttling/debouncing
   */
  _callSubscriber(id, subscription, newValue, oldValue) {
    const { path, callback, options } = subscription;
    
    // Skip if values are equal according to equality function
    if (options.equalityFn(newValue, oldValue)) {
      return;
    }
    
    // Handle throttled subscriptions
    if (options.throttle > 0) {
      this._handleThrottledSubscription(id, newValue, oldValue);
      return;
    }
    
    // Handle debounced subscriptions
    if (options.debounce > 0) {
      this._handleDebouncedSubscription(id, newValue, oldValue);
      return;
    }
    
    // Execute callback
    try {
      callback(newValue, oldValue);
      
      // Remove if it's a one-time subscription
      if (options.once) {
        this._subscribers.delete(id);
      }
    } catch (err) {
      console.error(`Error in state subscription callback for path "${path}":`, err);
    }
  }

  /**
   * Handle throttled subscription
   */
  _handleThrottledSubscription(id, newValue, oldValue) {
    const subscription = this._subscribers.get(id);
    if (!subscription) return;
    
    const throttleData = this._throttled.get(id);
    if (!throttleData) return;
    
    const now = Date.now();
    const { lastFired, timer } = throttleData;
    const { throttle } = subscription.options;
    
    // If enough time has passed since last fire, execute immediately
    if (now - lastFired >= throttle) {
      throttleData.lastFired = now;
      throttleData.pending = false;
      
      if (timer) {
        clearTimeout(timer);
        throttleData.timer = null;
      }
      
      try {
        subscription.callback(newValue, oldValue);
        
        // Remove if it's a one-time subscription
        if (subscription.options.once) {
          this._subscribers.delete(id);
          this._throttled.delete(id);
        }
      } catch (err) {
        console.error(`Error in throttled state subscription callback for path "${subscription.path}":`, err);
      }
    } 
    // Otherwise, schedule for later if not already pending
    else if (!throttleData.pending) {
      throttleData.pending = true;
      
      if (timer) {
        clearTimeout(timer);
      }
      
      throttleData.timer = setTimeout(() => {
        throttleData.lastFired = Date.now();
        throttleData.pending = false;
        throttleData.timer = null;
        
        try {
          subscription.callback(newValue, oldValue);
          
          // Remove if it's a one-time subscription
          if (subscription.options.once) {
            this._subscribers.delete(id);
            this._throttled.delete(id);
          }
        } catch (err) {
          console.error(`Error in throttled state subscription callback for path "${subscription.path}":`, err);
        }
      }, throttle - (now - lastFired));
    }
  }

  /**
   * Handle debounced subscription
   */
  _handleDebouncedSubscription(id, newValue, oldValue) {
    const subscription = this._subscribers.get(id);
    if (!subscription) return;
    
    const debounceData = this._debounced.get(id);
    if (!debounceData) return;
    
    const { debounce } = subscription.options;
    
    // Clear existing timer
    if (debounceData.timer) {
      clearTimeout(debounceData.timer);
    }
    
    // Set new timer
    debounceData.timer = setTimeout(() => {
      debounceData.timer = null;
      
      try {
        subscription.callback(newValue, oldValue);
        
        // Remove if it's a one-time subscription
        if (subscription.options.once) {
          this._subscribers.delete(id);
          this._debounced.delete(id);
        }
      } catch (err) {
        console.error(`Error in debounced state subscription callback for path "${subscription.path}":`, err);
      }
    }, debounce);
  }
}

export default StateManager;
