/**
 * Emoji Feature Module
 * 
 * Main entry point for emoji-related functionality.
 * Exports all emoji components and utilities.
 */

import EmojiPicker, { emojiPickerInstance } from './emoji-picker.js';

// Export named components
export {
  EmojiPicker,
  emojiPickerInstance
};

// Initialize singleton instance
emojiPickerInstance.init();

// Default export for backward compatibility
export default {
  picker: emojiPickerInstance
};
