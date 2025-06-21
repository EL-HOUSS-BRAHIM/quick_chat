/**
 * Test Module Loader
 * 
 * This script tests the module-loader.js functionality.
 * Run this in the browser console to verify everything works.
 */

(function() {
  console.log('Testing Quick Chat Module Loader...');
  
  // Mock browser features for testing
  function testWithFeatures(esModules, dynamicImport, async, promiseFinally) {
    console.log(`\nTesting with features: esModules=${esModules}, dynamicImport=${dynamicImport}, async=${async}, promiseFinally=${promiseFinally}`);
    
    // Create a test environment
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Configure the iframe document
    const iframeDoc = iframe.contentDocument;
    iframeDoc.open();
    iframeDoc.write('<html><body data-page-type="chat"></body></html>');
    iframeDoc.close();
    
    // Create a test window object
    const testWindow = iframe.contentWindow;
    
    // Mock feature detection
    const originalFunction = testWindow.Function;
    testWindow.Function = function(code) {
      if (code.includes('return import') && !dynamicImport) {
        throw new Error('Dynamic import not supported');
      }
      if (code.includes('async') && !async) {
        throw new Error('Async not supported');
      }
      return originalFunction.apply(this, arguments);
    };
    
    // Mock HTMLScriptElement
    const originalDescriptor = Object.getOwnPropertyDescriptor(testWindow.HTMLScriptElement.prototype, 'noModule');
    Object.defineProperty(testWindow.HTMLScriptElement.prototype, 'noModule', {
      get: function() {
        return esModules ? true : undefined;
      },
      configurable: true
    });
    
    // Mock Promise
    if (!promiseFinally && testWindow.Promise) {
      const originalFinally = testWindow.Promise.prototype.finally;
      delete testWindow.Promise.prototype.finally;
    }
    
    // Create a container for logs
    const logs = [];
    testWindow.console = {
      log: function(msg) {
        logs.push(msg);
        console.log(`[Test] ${msg}`);
      },
      error: function(msg) {
        logs.push(`ERROR: ${msg}`);
        console.error(`[Test ERROR] ${msg}`);
      },
      warn: function(msg) {
        logs.push(`WARN: ${msg}`);
        console.warn(`[Test WARN] ${msg}`);
      }
    };
    
    // Mock document.body.appendChild to track script loading
    const originalAppendChild = testWindow.document.body.appendChild;
    const loadedScripts = [];
    testWindow.document.body.appendChild = function(el) {
      if (el.tagName === 'SCRIPT') {
        loadedScripts.push(el.src);
        
        // Simulate script loading
        setTimeout(() => {
          if (el.onload) el.onload();
        }, 100);
      }
      return originalAppendChild.call(this, el);
    };
    
    // Load the module loader
    const script = document.createElement('script');
    script.textContent = `
      ${document.querySelector('script[src*="module-loader.js"]').textContent}
    `;
    testWindow.document.body.appendChild(script);
    
    // Return test results after a delay to allow async operations
    return new Promise(resolve => {
      setTimeout(() => {
        // Clean up
        if (originalDescriptor) {
          Object.defineProperty(testWindow.HTMLScriptElement.prototype, 'noModule', originalDescriptor);
        }
        testWindow.Function = originalFunction;
        
        // Collect results
        const results = {
          logs: logs,
          loadedScripts: loadedScripts
        };
        
        // Remove iframe
        document.body.removeChild(iframe);
        
        resolve(results);
      }, 1000);
    });
  }
  
  // Run tests for different feature combinations
  async function runTests() {
    try {
      // Test 1: Modern browser with all features
      const modernResults = await testWithFeatures(true, true, true, true);
      console.log('Modern browser test complete');
      console.log('Scripts loaded:', modernResults.loadedScripts);
      
      // Test 2: Legacy browser with no modern features
      const legacyResults = await testWithFeatures(false, false, false, false);
      console.log('Legacy browser test complete');
      console.log('Scripts loaded:', legacyResults.loadedScripts);
      
      // Test 3: Partial support (ES modules but no dynamic import)
      const partialResults = await testWithFeatures(true, false, true, true);
      console.log('Partial support browser test complete');
      console.log('Scripts loaded:', partialResults.loadedScripts);
      
      console.log('\nAll tests completed!');
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  // Run all tests
  runTests();
})();
