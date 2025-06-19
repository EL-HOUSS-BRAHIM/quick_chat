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
  
  // Debug mode
  debug: false
};

// Check if ES modules are supported
if ('noModule' in HTMLScriptElement.prototype) {
  // Modern browser with ES module support
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
  // Fallback for older browsers - load bundled version if available
  logMessage('ES modules not supported, loading legacy scripts');
  loadLegacyScript();
}

// Helper function to load legacy script
function loadLegacyScript() {
  // If we have a bundled version, load it
  if (typeof window.quickChatConfig !== 'undefined') {
    const scriptEl = document.createElement('script');
    scriptEl.src = config.legacyBundle;
    document.body.appendChild(scriptEl);
  } else {
    logMessage('No legacy bundle available. Application may not function correctly.');
  }
}

// Helper function for logging
function logMessage(message) {
  if (config.debug || window.location.search.includes('debug=true')) {
    console.log(`[ModuleLoader] ${message}`);
  }
}
