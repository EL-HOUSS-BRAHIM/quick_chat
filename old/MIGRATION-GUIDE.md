# Quick Chat JavaScript Migration Guide

This guide provides instructions for migrating legacy JavaScript files to the new modular architecture.

## Directory Structure

The new architecture organizes JavaScript files into the following structure:

- `assets/js/core/` - Core application functionality
- `assets/js/features/` - Feature-specific modules
  - `admin/` - Admin panel features
  - `chat/` - Chat-related features
  - `profile/` - User profile features
  - `webrtc/` - Video/audio call features
- `assets/js/ui/` - UI components and utilities
- `assets/js/utils/` - Utility functions and helpers

## Main Entry Point

The main entry point for the application is `assets/js/main.js`, which imports and initializes all necessary modules.

## Migration Status

The following files have already been migrated:

### Core
- `app.js` → `core/app.js`
- `config.js` → `core/config.js`
- `security.js` → `core/security.js`

### UI
- `virtual-scroll-messaging.js` → `ui/virtual-scroll.js`
- `file-upload-progress.js` → `ui/upload-progress.js`
- `accessibility.js` → `ui/accessibility.js`

### Features
- `admin-config.js` → `features/admin/config-manager.js`
- `call-interface.js` → `features/webrtc/ui.js`
- `file-management.js` → `features/chat/file-uploader.js`
- `file-optimization.js` → `features/chat/file-uploader.js`
- `group-chat.js` → `features/chat/group-info.js`
- `message-reactions.js` → `features/chat/reactions.js`
- `private-chat.js` → `features/chat/private-chat.js`
- `user-mentions.js` → `features/chat/mentions.js`
- `user-preferences.js` → `features/profile/preferences.js`

### Utilities
- `pwa-manager.js` → `utils/pwa-manager.js`
- `realtime-features.js` → `utils/realtime-features.js`

## Files to Migrate

The following files still need to be migrated:

- `emoji.js` → `features/chat/emoji-picker.js`
- `message-search.js` → `features/chat/search.js`

## Migration Process

1. Create a new file in the appropriate directory
2. Copy the functionality from the legacy file
3. Refactor as needed to use ES modules and follow new architecture patterns
4. Add a compatibility layer to the legacy file that imports from the new file
5. Update imports in other files to use the new file

## Using the Migration Loader

The `module-loader.js` file helps load ES modules for modern browsers while maintaining compatibility with legacy code.

## Testing After Migration

After migrating a file:

1. Test the functionality in modern browsers with ES modules
2. Test in compatibility mode to ensure backward compatibility
3. Update any imports in other files to use the new module path
