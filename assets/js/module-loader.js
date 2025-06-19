/**
 * ES Module Loader
 * 
 * This script dynamically loads the ES modules for the new architecture
 * while maintaining compatibility with the legacy code.
 */

// Configuration
const config = {
  // Main entry point
  mainModule: '/assets/js/main.js',
  
  // Required version of main.js to be compatible with this loader
  requiredMainVersion: '2.4.x',
  
  // Legacy fallback
  legacyBundle: '/assets/js/bundle.js',
  
  // Core bundles
  coreBundles: [
    '/assets/js/dist/vendors.bundle.js',
    '/assets/js/dist/common.bundle.js',
    '/assets/js/dist/app.bundle.js'
  ],
  
  // Page-specific bundles mapping
  pageBundles: {
    'chat': [
      '/assets/js/dist/chat-features.bundle.js',
      '/assets/js/dist/ui-components.bundle.js'
    ],
    'dashboard': [
      '/assets/js/dist/dashboard-features.bundle.js'
    ],
    'profile': [
      '/assets/js/dist/profile-features.bundle.js'
    ],
    'admin': [
      '/assets/js/dist/admin-features.bundle.js'
    ]
  },
  
  // Feature detection flags
  features: {
    esModules: false,
    dynamicImport: false,
    async: false,
    promiseFinally: false
  },
  
  // Debug mode
  debug: false
};

// Detect browser capabilities
function detectFeatures() {
  // Check for ES modules support
  config.features.esModules = 'noModule' in HTMLScriptElement.prototype;
  
  // Check for dynamic import support
  try {
    new Function('return import("")');
    config.features.dynamicImport = true;
  } catch (err) {
    config.features.dynamicImport = false;
  }
  
  // Check for async/await
  try {
    new Function('async () => {}');
    config.features.async = true;
  } catch (err) {
    config.features.async = false;
  }
  
  // Check for Promise.finally
  config.features.promiseFinally = typeof Promise !== 'undefined' && 
                                  typeof Promise.prototype.finally === 'function';
  
  // Log detected features
  logMessage('Feature detection complete:');
  logMessage(`- ES Modules: ${config.features.esModules}`);
  logMessage(`- Dynamic Import: ${config.features.dynamicImport}`);
  logMessage(`- Async/Await: ${config.features.async}`);
  logMessage(`- Promise.finally: ${config.features.promiseFinally}`);
}

// Determine the current page type from data attribute
function getCurrentPageType() {
  const body = document.body;
  return body.dataset.pageType || '';
}

// Load appropriate scripts based on browser capabilities
function loadScripts() {
  if (config.features.esModules && config.features.dynamicImport && config.features.async) {
    // Modern browser with all required features - load as ES modules
    logMessage('Loading ES modules');
    
    // Create a script element for the main module
    const scriptEl = document.createElement('script');
    scriptEl.src = config.mainModule;
    scriptEl.type = 'module';
    
    // Add integrity check if available in config
    if (window.quickChatConfig && window.quickChatConfig.integrity && 
        window.quickChatConfig.integrity[config.mainModule]) {
      scriptEl.integrity = window.quickChatConfig.integrity[config.mainModule];
      scriptEl.crossOrigin = 'anonymous';
      logMessage('Using subresource integrity for main module');
    }
    
    // Add error event listener to catch module loading errors
    window.addEventListener('error', function(event) {
      // Only handle ES module errors
      if (event.filename && event.filename.includes('/assets/js/')) {
        logMessage(`ES module error: ${event.message} in ${event.filename}:${event.lineno}`);
      }
    }, false);
    
    // Listen for error events from main.js
    document.addEventListener('quickchat:error', function(event) {
      logMessage(`Application error from main.js: ${event.detail.error}`);
      // Fall back to legacy script if main.js reports critical error
      if (event.detail.moduleType === 'esmodule') {
        loadLegacyScript();
      }
    }, false);
    
    // Set a timeout for module loading
    const moduleLoadTimeout = setTimeout(() => {
      logMessage('ES module load timeout, falling back to legacy script');
      loadLegacyScript();
    }, 5000);
    
    scriptEl.onload = () => {
      clearTimeout(moduleLoadTimeout);
      logMessage('ES module loaded successfully');
      
      // Dispatch event for analytics and monitoring
      if (document.dispatchEvent) {
        document.dispatchEvent(new CustomEvent('quickchat:moduleloaded', {
          detail: { moduleType: 'es-module' }
        }));
      }
    };
    
    scriptEl.onerror = (error) => {
      clearTimeout(moduleLoadTimeout);
      logMessage('Error loading ES module, falling back to legacy script');
      logMessage(`Error details: ${error.message || 'Unknown error'}`);
      loadLegacyScript();
    };
    
    document.body.appendChild(scriptEl);
  } else {
    // Fallback for older browsers - load bundled version
    logMessage('Modern JS features not fully supported, loading bundled scripts');
    loadLegacyScript();
  }
}

// Helper function to load legacy script
function loadLegacyScript() {
  // Add polyfills if needed
  const polyfills = [];
  
  if (!config.features.promiseFinally) {
    polyfills.push('/assets/js/vendor/polyfills/promise-finally.js');
  }
  
  // Check for other needed polyfills based on feature detection
  if (!window.fetch) {
    polyfills.push('/assets/js/vendor/polyfills/fetch.js');
  }
  
  if (!window.IntersectionObserver) {
    polyfills.push('/assets/js/vendor/polyfills/intersection-observer.js');
  }
  
  // Add polyfill for ResizeObserver if needed
  if (!window.ResizeObserver) {
    polyfills.push('/assets/js/vendor/polyfills/resize-observer.js');
  }
  
  // Add polyfill for CustomEvent if needed for older IE
  if (typeof window.CustomEvent !== 'function') {
    polyfills.push('/assets/js/vendor/polyfills/custom-event.js');
  }
  
  // Record legacy mode for analytics
  if (window.quickChatConfig && window.quickChatConfig.analytics) {
    // Record that we're using legacy mode, if analytics are available
    logMessage('Recording legacy mode usage in analytics');
  }
  
  // Dispatch event for monitoring
  if (document.dispatchEvent) {
    document.dispatchEvent(new CustomEvent('quickchat:legacymode', {
      detail: { 
        features: config.features,
        polyfills: polyfills
      }
    }));
  }
  
  // Load polyfills first, then bundles
  if (polyfills.length > 0) {
    logMessage(`Loading ${polyfills.length} polyfills before bundles`);
    loadScriptsSequentially(polyfills, (success) => {
      if (success) {
        loadBundles();
      } else {
        logMessage('Polyfill loading had errors, but continuing with bundles');
        loadBundles();
      }
    });
  } else {
    loadBundles();
  }
}

// Load bundled scripts
function loadBundles() {
  const pageType = getCurrentPageType();
  const bundles = [...config.coreBundles];
  
  // Add page-specific bundles from configuration
  if (config.pageBundles && config.pageBundles[pageType]) {
    bundles.push(...config.pageBundles[pageType]);
  } else if (pageType) { // Only run fallback if pageType is not empty
    // Fallback to switch statement for backward compatibility
    switch (pageType) {
      case 'chat':
        bundles.push('/assets/js/dist/chat-features.bundle.js');
        bundles.push('/assets/js/dist/ui-components.bundle.js');
        break;
      case 'dashboard':
        bundles.push('/assets/js/dist/dashboard-features.bundle.js');
        break;
      case 'profile':
        bundles.push('/assets/js/dist/profile-features.bundle.js');
        break;
      case 'admin':
        bundles.push('/assets/js/dist/admin-features.bundle.js');
        break;
      case 'group-chat':
        bundles.push('/assets/js/dist/group-features.bundle.js');
        bundles.push('/assets/js/dist/ui-components.bundle.js');
        break;
      default:
        logMessage(`Unknown page type: ${pageType}, loading only core bundles`);
        break;
    }
  }
  
  // If we have bundle files, load them
  if (bundles.length > 0) {
    loadScriptsSequentially(bundles);
  } else {
    logMessage('No bundles available for this page type.');
  }
}

// Helper function to load scripts sequentially
function loadScriptsSequentially(scripts, callback) {
  let index = 0;
  let failedScripts = [];
  let loadedScripts = [];
  
  function loadNext() {
    if (index >= scripts.length) {
      if (failedScripts.length > 0) {
        logMessage(`Warning: ${failedScripts.length} scripts failed to load: ${failedScripts.join(', ')}`);
      }
      
      if (typeof callback === 'function') {
        callback(failedScripts.length === 0);
      }
      
      // Dispatch event when all scripts are loaded
      if (document.dispatchEvent && failedScripts.length === 0) {
        document.dispatchEvent(new CustomEvent('quickchat:bundlesloaded', {
          detail: { 
            loaded: loadedScripts,
            failed: failedScripts
          }
        }));
      }
      return;
    }
    
    const script = scripts[index];
    const scriptEl = document.createElement('script');
    scriptEl.src = script;
    
    // Set timeout to catch hanging script loads
    const timeoutId = setTimeout(() => {
      logMessage(`Script load timeout: ${script}`);
      failedScripts.push(script);
      index++;
      loadNext();
    }, 10000); // 10 second timeout
    
    scriptEl.onload = () => {
      clearTimeout(timeoutId);
      logMessage(`Successfully loaded: ${script}`);
      loadedScripts.push(script);
      index++;
      loadNext();
    };
    
    scriptEl.onerror = () => {
      clearTimeout(timeoutId);
      logMessage(`Error loading script: ${script}`);
      failedScripts.push(script);
      index++;
      loadNext();
    };
    
    document.body.appendChild(scriptEl);
  }
  
  loadNext();
}

// Helper function for logging
function logMessage(message) {
  if (config.debug && console && typeof console.log === 'function') {
    console.log(`[ModuleLoader] ${message}`);
  }
  
  // Store logs in memory for potential troubleshooting
  if (!window._quickChatLoaderLogs) {
    window._quickChatLoaderLogs = [];
  }
  window._quickChatLoaderLogs.push({
    timestamp: new Date().toISOString(),
    message: message
  });
}

// Add method to retrieve logs for troubleshooting
window.getQuickChatLoaderLogs = function() {
  return window._quickChatLoaderLogs || [];
};

// Create a global error handler for script loading
window.addEventListener('error', function(event) {
  if (event.target && event.target.tagName === 'SCRIPT') {
    logMessage(`Script error: ${event.target.src}`);
    
    // Record the error for analytics
    if (window.quickChatConfig && window.quickChatConfig.errorReporting) {
      // Send error to analytics if configured
    }
  }
}, true); // Use capture phase to catch all script errors

// Initialize
function init() {
  // Record initialization time for performance monitoring
  const initStartTime = performance && performance.now ? performance.now() : 0;
  
  // Add version information for debugging
  const version = '2.4.0'; // Should match package.json version
  logMessage(`Quick Chat Module Loader v${version} initializing`);
  
  // Enable debug mode in development environments
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev.') ||
      window.location.search.includes('debug=true')) {
    config.debug = true;
    logMessage('Debug mode enabled for development environment or via URL parameter');
  }
  
  // Check if configuration is overridden by the page
  if (window.quickChatConfig && window.quickChatConfig.moduleLoader) {
    const userConfig = window.quickChatConfig.moduleLoader;
    
    // Merge configurations
    if (userConfig.mainModule) config.mainModule = userConfig.mainModule;
    if (userConfig.legacyBundle) config.legacyBundle = userConfig.legacyBundle;
    if (userConfig.debug !== undefined) config.debug = !!userConfig.debug;
    if (userConfig.coreBundles) config.coreBundles = userConfig.coreBundles;
    if (userConfig.pageBundles) {
      // Deep merge of page bundles
      config.pageBundles = {
        ...config.pageBundles,
        ...userConfig.pageBundles
      };
    }
    
    logMessage('Using custom module loader configuration from page');
  }
  
  // Run feature detection
  detectFeatures();
  
  // Record browser capabilities for analytics
  if (window.quickChatConfig && window.quickChatConfig.telemetry) {
    // Could send browser capabilities to server for analytics
  }
  
  // Load appropriate scripts
  loadScripts();
  
  // Record initialization completion time
  if (performance && performance.now) {
    const initTime = performance.now() - initStartTime;
    logMessage(`Module loader initialization completed in ${initTime.toFixed(2)}ms`);
  }
}

// Ensure the module loader is initialized only once
if (!window.__quickChatModuleLoaderInitialized) {
  window.__quickChatModuleLoaderInitialized = true;
  
  // Start the module loader when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Document already loaded, initialize immediately
    init();
  }
} else {
  console.warn('[ModuleLoader] Module loader already initialized. Ignoring duplicate initialization.');
}
