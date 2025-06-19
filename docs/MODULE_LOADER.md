# Quick Chat Module Loader Architecture

This document explains the architecture and functionality of the Quick Chat module loading system, which consists of two main components:

1. `module-loader.js` - Feature detection and script loading system
2. `main.js` - ES Module entry point for modern browsers

## Overview

The module loading system is designed with a progressive enhancement approach:

- Modern browsers with ES Module support load the modular JavaScript architecture
- Legacy browsers fall back to bundled scripts with polyfills as needed
- Page-specific code is dynamically loaded based on the current page type

## Module Loader (module-loader.js)

### Core Functionality

- Performs feature detection for critical browser capabilities:
  - ES Modules support
  - Dynamic import support
  - Async/await support
  - Promise.finally support
- Loads appropriate scripts based on detected capabilities
- Provides fallback mechanisms for older browsers
- Handles script loading errors gracefully
- Includes debugging and logging capabilities

### Configuration

```javascript
const config = {
  mainModule: '/assets/js/main.js',
  requiredMainVersion: '2.5.x',
  legacyBundle: '/assets/js/bundle.js',
  coreBundles: [
    '/assets/js/dist/vendors.bundle.js',
    '/assets/js/dist/common.bundle.js',
    '/assets/js/dist/app.bundle.js'
  ],
  pageBundles: {
    'chat': [...],
    'dashboard': [...],
    'profile': [...],
    'admin': [...]
  },
  features: {
    esModules: false,
    dynamicImport: false,
    async: false,
    promiseFinally: false
  },
  debug: false
};
```

### Loading Process

1. Feature detection determines browser capabilities
2. For modern browsers:
   - Loads main.js as an ES module
   - Sets a timeout to fall back to legacy script if loading fails
3. For legacy browsers:
   - Loads necessary polyfills first
   - Loads core bundles and page-specific bundles

## Main Module (main.js)

### Core Functionality

- Entry point for the modular JavaScript architecture
- Exposes runtime information for compatibility tracking
- Dynamically imports page-specific modules based on current page
- Provides consistent initialization patterns for all pages
- Reports errors back to the module loader

### Module Organization

The application code is organized into the following module types:

- Core modules (app, state, event-bus, etc.)
- UI components (accessibility, virtual-scroll, etc.)
- Feature modules (chat, dashboard, profile, admin)
- API client modules

### Initialization Process

1. Sets up runtime tracking information
2. Initializes core modules
3. Determines current page type
4. Dynamically imports and initializes page-specific modules
5. Reports initialization status via events

## Event Communication

The module loader and main.js communicate via custom events:

- `quickchat:moduleloaded` - Fired when ES modules are loaded
- `quickchat:legacymode` - Fired when falling back to legacy mode
- `quickchat:ready` - Fired when the application is fully initialized
- `quickchat:error` - Fired when a critical error occurs
- `quickchat:bundlesloaded` - Fired when all bundles are loaded

## Troubleshooting

For debugging purposes:

- Enable debug mode by setting `window.quickChatConfig.moduleLoader.debug = true`
- Use the `window.getQuickChatLoaderLogs()` function to retrieve loader logs
- Include `module-loader-test.js` to run a comprehensive test of the loading system

## Version Compatibility

The module-loader.js and main.js files must have matching versions to ensure compatibility. The current version is 2.5.0.

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge): Full ES Module support
- Legacy browsers: Fallback to bundled scripts with polyfills
