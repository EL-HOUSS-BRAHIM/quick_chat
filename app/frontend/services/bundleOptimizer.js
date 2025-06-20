/**
 * Bundle Optimization Service
 * Implements lazy loading and code splitting for better performance
 */

export class BundleOptimizer {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
    this.config = {
      enablePreloading: true,
      preloadDelay: 2000, // 2 seconds
      cacheStrategy: 'memory', // 'memory', 'localStorage', 'indexedDB'
      maxCacheSize: 50 * 1024 * 1024 // 50MB
    };
  }

  /**
   * Lazy load a module with caching
   */
  async loadModule(modulePath, preload = false) {
    // Check if already loaded
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath);
    }

    // Check if currently loading
    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath);
    }

    // Start loading
    const loadPromise = this.importModule(modulePath, preload);
    this.loadingPromises.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(modulePath, module);
      this.loadingPromises.delete(modulePath);
      return module;
    } catch (error) {
      this.loadingPromises.delete(modulePath);
      throw error;
    }
  }

  /**
   * Import module with error handling
   */
  async importModule(modulePath, preload = false) {
    try {
      let module;
      
      switch (modulePath) {
        // UI Components - Load on demand
        case 'dataTable':
          module = await import('../components/ui/DataTable.js');
          break;
        case 'modal':
          module = await import('../components/ui/Modal.js');
          break;
        case 'card':
          module = await import('../components/ui/Card.js');
          break;
        case 'button':
          module = await import('../components/ui/Button.js');
          break;
        case 'input':
          module = await import('../components/ui/Input.js');
          break;
        case 'dropdown':
          module = await import('../components/ui/Dropdown.js');
          break;

        // Advanced Features - Lazy load
        case 'webrtc':
          module = await import('../services/WebRTCManager.js');
          break;
        case 'groupVideo':
          module = await import('../services/GroupVideoCallManager.js');
          break;
        case 'screenSharing':
          module = await import('../services/screenSharingManager.js');
          break;
        case 'callRecording':
          module = await import('../services/CallRecordingManager.js');
          break;
        case 'e2eEncryption':
          module = await import('../services/E2EEncryptionService.js');
          break;

        // Page modules
        case 'adminPage':
          module = await import('../pages/admin.js');
          break;
        case 'chatPage':
          module = await import('../pages/chat.js');
          break;
        case 'profilePage':
          module = await import('../pages/profile.js');
          break;

        default:
          throw new Error(`Unknown module: ${modulePath}`);
      }

      if (preload) {
        console.log(`✅ Preloaded module: ${modulePath}`);
      }

      return module;
    } catch (error) {
      console.error(`Failed to load module ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Preload critical modules
   */
  async preloadCriticalModules() {
    if (!this.config.enablePreloading) return;

    const criticalModules = [
      'card',
      'button', 
      'input',
      'modal'
    ];

    // Delay preloading to not interfere with initial page load
    setTimeout(() => {
      criticalModules.forEach(module => {
        this.loadModule(module, true).catch(console.error);
      });
    }, this.config.preloadDelay);
  }

  /**
   * Preload modules based on user behavior
   */
  setupIntelligentPreloading() {
    // Preload chat features when user hovers over chat elements
    document.addEventListener('mouseenter', (e) => {
      if (e.target.closest('[data-preload="chat"]')) {
        this.loadModule('webrtc', true);
        this.loadModule('groupVideo', true);
      }
      
      if (e.target.closest('[data-preload="admin"]')) {
        this.loadModule('adminPage', true);
      }
    }, true);

    // Preload on route changes
    window.addEventListener('popstate', () => {
      const path = window.location.pathname;
      if (path.includes('admin')) {
        this.loadModule('adminPage', true);
      } else if (path.includes('chat')) {
        this.loadModule('webrtc', true);
      }
    });
  }

  /**
   * Get module loading stats
   */
  getStats() {
    return {
      loadedModules: this.loadedModules.size,
      loadingModules: this.loadingPromises.size,
      cacheSize: this.getCacheSize()
    };
  }

  /**
   * Calculate cache size
   */
  getCacheSize() {
    let size = 0;
    // Rough estimation - in a real app, you'd measure actual memory usage
    size += this.loadedModules.size * 10000; // ~10KB per module estimate
    return size;
  }

  /**
   * Clear module cache
   */
  clearCache() {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }
}

// Webpack optimization helpers
export const webpackOptimizations = {
  /**
   * Dynamic import wrapper with error handling
   */
  async dynamicImport(moduleFactory) {
    try {
      const module = await moduleFactory();
      return module.default || module;
    } catch (error) {
      console.error('Dynamic import failed:', error);
      throw error;
    }
  },

  /**
   * Progressive component loading
   */
  async loadComponentProgressively(componentName, fallback = null) {
    const bundleOptimizer = new BundleOptimizer();
    
    try {
      const module = await bundleOptimizer.loadModule(componentName);
      return module.default || module;
    } catch (error) {
      console.warn(`Failed to load ${componentName}, using fallback`);
      return fallback;
    }
  },

  /**
   * Route-based code splitting
   */
  createRouteLoader(routes) {
    return {
      loadRoute: async (routeName) => {
        const route = routes[routeName];
        if (!route) {
          throw new Error(`Route ${routeName} not found`);
        }

        const bundleOptimizer = new BundleOptimizer();
        const modules = await Promise.all(
          route.modules.map(module => bundleOptimizer.loadModule(module))
        );

        return {
          modules,
          route
        };
      }
    };
  }
};

// Create singleton instance
export const bundleOptimizer = new BundleOptimizer();
export default bundleOptimizer;
