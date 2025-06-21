/**
 * Browser Compatibility Manager
 * Handles feature detection, polyfills, and progressive enhancement
 */

class BrowserCompatibility {
  constructor() {
    this.supportedFeatures = new Map();
    this.polyfillsLoaded = new Set();
    this.fallbackMethods = new Map();
        
    this.init();
  }

  async init() {
    this.detectFeatures();
    await this.loadRequiredPolyfills();
    this.setupFallbacks();
    this.configureProgressiveEnhancement();
  }

  detectFeatures() {
    // WebRTC Support
    this.supportedFeatures.set('webrtc', this.checkWebRTCSupport());
        
    // Modern JavaScript Features
    this.supportedFeatures.set('es6', this.checkES6Support());
    this.supportedFeatures.set('modules', this.checkModuleSupport());
    this.supportedFeatures.set('asyncAwait', this.checkAsyncAwaitSupport());
        
    // Web APIs
    this.supportedFeatures.set('serviceWorker', 'serviceWorker' in navigator);
    this.supportedFeatures.set('pushNotifications', 'PushManager' in window);
    this.supportedFeatures.set('intersectionObserver', 'IntersectionObserver' in window);
    this.supportedFeatures.set('resizeObserver', 'ResizeObserver' in window);
    this.supportedFeatures.set('webWorkers', 'Worker' in window);
    this.supportedFeatures.set('indexedDB', 'indexedDB' in window);
    this.supportedFeatures.set('localStorage', this.checkLocalStorageSupport());
        
    // Media APIs
    this.supportedFeatures.set('mediaDevices', navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    this.supportedFeatures.set('mediaRecorder', 'MediaRecorder' in window);
    this.supportedFeatures.set('webAudio', 'AudioContext' in window || 'webkitAudioContext' in window);
        
    // File APIs
    this.supportedFeatures.set('fileAPI', 'File' in window && 'FileReader' in window);
    this.supportedFeatures.set('dragDrop', 'draggable' in document.createElement('div'));
        
    // CSS Features
    this.supportedFeatures.set('cssGrid', CSS.supports('display', 'grid'));
    this.supportedFeatures.set('cssFlexbox', CSS.supports('display', 'flex'));
    this.supportedFeatures.set('cssVariables', CSS.supports('--test', '0'));
  }
    
  checkWebRTCSupport() {
    return !!(
      navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            window.RTCPeerConnection
    );
  }
    
  checkES6Support() {
    try {
      // Test arrow functions, const, template literals, default params
      eval('const test = (param = 1) => `test ${param}`');
      return true;
    } catch (e) {
      return false;
    }
  }
    
  checkModuleSupport() {
    try {
      // Test dynamic import support
      eval('import("data:text/javascript;base64,Cg==")');
      return true;
    } catch (e) {
      return false;
    }
  }
    
  checkAsyncAwaitSupport() {
    try {
      eval('async function test() { await Promise.resolve(); }');
      return true;
    } catch (e) {
      return false;
    }
  }
    
  checkLocalStorageSupport() {
    try {
      const testKey = '__test_localStorage__';
      localStorage.setItem(testKey, testKey);
      const result = localStorage.getItem(testKey) === testKey;
      localStorage.removeItem(testKey);
      return result;
    } catch (e) {
      return false;
    }
  }
    
  async loadRequiredPolyfills() {
    const polyfillsNeeded = [];
        
    // Check for major features that need polyfills
    if (!this.supportedFeatures.get('intersectionObserver')) {
      polyfillsNeeded.push('intersection-observer');
    }
        
    if (!this.supportedFeatures.get('resizeObserver')) {
      polyfillsNeeded.push('resize-observer');
    }
        
    if (!this.supportedFeatures.get('webrtc')) {
      polyfillsNeeded.push('webrtc-adapter');
    }
        
    // Load required polyfills dynamically
    await Promise.all(polyfillsNeeded.map(polyfill => this.loadPolyfill(polyfill)));
  }
    
  async loadPolyfill(name) {
    if (this.polyfillsLoaded.has(name)) return;
        
    const polyfillUrls = {
      'intersection-observer': '/assets/js/vendor/polyfills/intersection-observer.js',
      'resize-observer': '/assets/js/vendor/polyfills/resize-observer.js',
      'webrtc-adapter': '/assets/js/vendor/polyfills/webrtc-adapter.js',
      'promise': '/assets/js/vendor/polyfills/promise.js',
      'fetch': '/assets/js/vendor/polyfills/fetch.js'
    };
        
    if (!polyfillUrls[name]) {
      console.warn(`No polyfill URL configured for ${name}`);
      return;
    }
        
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = polyfillUrls[name];
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
            
      this.polyfillsLoaded.add(name);
      console.log(`Polyfill loaded: ${name}`);
    } catch (error) {
      console.error(`Failed to load ${name} polyfill:`, error);
    }
  }
    
  setupFallbacks() {
    // Set up fallbacks for critical features
    if (!this.supportedFeatures.get('webrtc')) {
      this.setupWebRTCFallback();
    }
        
    if (!this.supportedFeatures.get('mediaRecorder')) {
      this.setupMediaRecorderFallback();
    }
        
    if (!this.supportedFeatures.get('localStorage')) {
      this.setupLocalStorageFallback();
    }
  }
    
  setupWebRTCFallback() {
    // Implement a message system for browsers without WebRTC
    this.fallbackMethods.set('startVideoCall', this.fallbackVideoCall.bind(this));
    this.fallbackMethods.set('startAudioCall', this.fallbackAudioCall.bind(this));
  }
    
  fallbackVideoCall() {
    this.showFeatureUnsupportedMessage('Video calls', 'Your browser does not support video calls. Please try a modern browser like Chrome, Firefox, or Safari.');
    return false;
  }
    
  fallbackAudioCall() {
    this.showFeatureUnsupportedMessage('Audio calls', 'Your browser does not support audio calls. Please try a modern browser like Chrome, Firefox, or Safari.');
    return false;
  }
    
  setupMediaRecorderFallback() {
    this.fallbackMethods.set('recordMedia', this.fallbackRecordMedia.bind(this));
  }
    
  fallbackRecordMedia() {
    this.showFeatureUnsupportedMessage('Media recording', 'Your browser does not support media recording. Please try a modern browser like Chrome, Firefox, or Safari.');
    return false;
  }
    
  setupLocalStorageFallback() {
    // Create in-memory storage
    const memoryStorage = new Map();
        
    this.fallbackMethods.set('getItem', (key) => memoryStorage.get(key));
    this.fallbackMethods.set('setItem', (key, value) => memoryStorage.set(key, value));
    this.fallbackMethods.set('removeItem', (key) => memoryStorage.delete(key));
    this.fallbackMethods.set('clear', () => memoryStorage.clear());
  }
    
  showFeatureUnsupportedMessage(featureName, message) {
    const event = new CustomEvent('feature:unsupported', {
      detail: { feature: featureName, message }
    });
        
    document.dispatchEvent(event);
        
    // Also log to console
    console.warn(`${featureName} is not supported in this browser: ${message}`);
  }
    
  configureProgressiveEnhancement() {
    // Add body classes for feature detection in CSS
    document.body.classList.toggle('webrtc-supported', this.supportedFeatures.get('webrtc'));
    document.body.classList.toggle('grid-supported', this.supportedFeatures.get('cssGrid'));
    document.body.classList.toggle('flexbox-supported', this.supportedFeatures.get('cssFlexbox'));
    document.body.classList.toggle('css-vars-supported', this.supportedFeatures.get('cssVariables'));
        
    // Configure UI based on supported features
    this.configureUI();
  }
    
  configureUI() {
    // Hide video call buttons if not supported
    if (!this.supportedFeatures.get('webrtc')) {
      document.querySelectorAll('.video-call-button').forEach(btn => {
        btn.style.display = 'none';
      });
    }
        
    // Hide media recording buttons if not supported
    if (!this.supportedFeatures.get('mediaRecorder')) {
      document.querySelectorAll('.record-media-button').forEach(btn => {
        btn.style.display = 'none';
      });
    }
  }
    
  /**
     * Check if a feature is supported
     * @param {string} featureName - Name of the feature to check
     * @returns {boolean} Whether the feature is supported
     */
  isSupported(featureName) {
    return this.supportedFeatures.get(featureName) || false;
  }
    
  /**
     * Get a fallback method for an unsupported feature
     * @param {string} methodName - Name of the method to get fallback for
     * @returns {Function|null} Fallback method or null if not available
     */
  getFallback(methodName) {
    return this.fallbackMethods.get(methodName) || null;
  }
}

// Create singleton instance
const browserCompatibility = new BrowserCompatibility();

// Export as ES module
export default browserCompatibility;
