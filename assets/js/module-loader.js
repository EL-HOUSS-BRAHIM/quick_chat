/**
 * ES Module Loader
 * 
 * This script dynamically loads the ES modules for the new architecture
 * while maintaining compatibility with the legacy code.
 */

// Check if ES modules are supported
if ('noModule' in HTMLScriptElement.prototype) {
  // Modern browser with ES module support
  console.log('Loading ES modules');
  
  // Create a script element for the main module
  const scriptEl = document.createElement('script');
  scriptEl.src = '/assets/js/main.js';
  scriptEl.type = 'module';
  document.body.appendChild(scriptEl);
} else {
  // Fallback for older browsers - load bundled version if available
  console.log('ES modules not supported, loading legacy scripts');
  
  // If we have a bundled version, load it
  if (typeof window.quickChatConfig !== 'undefined') {
    const scriptEl = document.createElement('script');
    scriptEl.src = '/assets/js/bundle.js';
    document.body.appendChild(scriptEl);
  }
}
