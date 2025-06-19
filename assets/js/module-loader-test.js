/**
 * Quick Chat Module Loader Test Script
 * 
 * This file tests the module-loader.js and main.js integration
 * to ensure everything is working correctly.
 * 
 * To use: Include this script in a test page after the module-loader.js 
 * and before any other scripts. It will validate the setup and log results.
 */

(function() {
  // Test configuration
  const tests = {
    moduleLoaderPresent: false,
    quickChatConfigPresent: false,
    runtimeInfoPresent: false,
    eventsWorking: false,
    correctVersion: false,
    pageTypeDetection: false,
    featureModulesPresent: false
  };
  
  // Log function for test results
  function logTest(testName, result, details = '') {
    const status = result ? 'PASS' : 'FAIL';
    console.log(`[ModuleLoaderTest] ${testName}: ${status} ${details}`);
    tests[testName] = result;
  }
  
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[ModuleLoaderTest] Running module loader and main.js tests...');
    
    // Test 1: Check if module loader initialized
    logTest('moduleLoaderPresent', 
            typeof window.__quickChatModuleLoaderInitialized === 'boolean' && 
            window.__quickChatModuleLoaderInitialized === true,
            'Module loader should be initialized');
    
    // Test 2: Check if quickChatConfig is available
    if (!window.quickChatConfig) {
      console.warn('[ModuleLoaderTest] quickChatConfig not found, creating default for testing');
      window.quickChatConfig = {
        moduleLoader: {
          debug: true
        }
      };
    }
    logTest('quickChatConfigPresent', !!window.quickChatConfig, 'Configuration object should exist');
    
    // Test 3: Check for runtime information (set by main.js)
    // This may be delayed, so we'll check again in 3 seconds
    setTimeout(function() {
      logTest('runtimeInfoPresent', 
              !!window.quickChatRuntime, 
              'Runtime info from main.js should be present');
      
      // Only run version check if runtime info exists
      if (window.quickChatRuntime) {
        // Test 4: Check if versions match
        const moduleLoaderVersion = '2.5.0'; // Should match version in module-loader.js
        logTest('correctVersion', 
                window.quickChatRuntime.version === moduleLoaderVersion,
                `Runtime version ${window.quickChatRuntime.version} should match module loader version ${moduleLoaderVersion}`);
                
        // Test 5: Check if page type was detected
        logTest('pageTypeDetection', 
                !!window.quickChatRuntime.pageType,
                `Detected page type: ${window.quickChatRuntime.pageType || 'none'}`);
                
        // Test 7: Check if feature modules are registered
        logTest('featureModulesPresent',
                Object.keys(window.quickChatRuntime.features).length > 0,
                `Feature modules registered: ${Object.keys(window.quickChatRuntime.features).join(', ')}`);
      }
      
      // Output overall test results
      const passedTests = Object.values(tests).filter(Boolean).length;
      const totalTests = Object.keys(tests).length;
      console.log(`[ModuleLoaderTest] Results: ${passedTests}/${totalTests} tests passed`);
      
      // Output detailed test results
      console.table(tests);
      
      // Check for any logs from module loader
      if (typeof window.getQuickChatLoaderLogs === 'function') {
        const logs = window.getQuickChatLoaderLogs();
        console.log(`[ModuleLoaderTest] Module loader logs (${logs.length}):`);
        if (logs.length > 0) {
          logs.forEach(log => {
            console.log(`${log.timestamp}: ${log.message}`);
          });
        }
      }
    }, 3000);
  });
  
  // Test 6: Check if events are working by listening for quickchat:ready event
  document.addEventListener('quickchat:ready', function(event) {
    logTest('eventsWorking', true, `Event system working, received: ${JSON.stringify(event.detail)}`);
  });
  
  // Report if no events received within 5 seconds
  setTimeout(function() {
    if (!tests.eventsWorking) {
      logTest('eventsWorking', false, 'No events received from main.js');
    }
  }, 5000);
  
  console.log('[ModuleLoaderTest] Test script initialized');
})();
