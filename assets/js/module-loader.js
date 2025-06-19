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
  
  // Legacy fallback
  legacyBundle: '/assets/js/bundle.js',
  
  // Core bundles
  coreBundles: [
    '/assets/js/dist/vendors.bundle.js',
    '/assets/js/dist/common.bundle.js',
    '/assets/js/dist/app.bundle.js'
  ],
  
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
    scriptEl.onerror = () => {
      logMessage('Error loading ES module, falling back to legacy script');
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
  
  // Load polyfills first, then bundles
  if (polyfills.length > 0) {
    loadScriptsSequentially(polyfills, () => {
      loadBundles();
    });
  } else {
    loadBundles();
  }
}

// Load bundled scripts
function loadBundles() {
  const pageType = getCurrentPageType();
  const bundles = [...config.coreBundles];
  
  // Add page-specific bundles
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
  
  function loadNext() {
    if (index >= scripts.length) {
      if (typeof callback === 'function') {
        callback();
      }
      return;
    }
    
    const script = scripts[index];
    const scriptEl = document.createElement('script');
    scriptEl.src = script;
    
    scriptEl.onload = () => {
      index++;
      loadNext();
    };
    
    scriptEl.onerror = () => {
      logMessage(`Error loading script: ${script}`);
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
}

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
  // Enable debug mode in development environments
  if (window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('dev.')) {
    config.debug = true;
  }
  
  // Run feature detection
  detectFeatures();
  
  // Load appropriate scripts
  loadScripts();
}

// Start the module loader
init();
