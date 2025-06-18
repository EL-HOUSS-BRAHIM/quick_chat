/**
 * Chat Compatibility Layer
 * 
 * This file provides backward compatibility between the old ModernChatApp/QuickChatApp
 * classes and the new modular implementation. This allows for a gradual migration
 * without breaking existing functionality.
 * 
 * Import this file after the main chat module to patch the global classes with
 * methods that redirect to the new modular implementation.
 */

import { default as chatModule } from './features/chat/index.js';
import eventBus from './core/event-bus.js';

// Function to initialize compatibility layer
export function initChatCompatibility() {
  console.log('Initializing chat compatibility layer');
  
  // Ensure the chat module is initialized
  if (!window.chatModule) {
    window.chatModule = chatModule;
  }
  
  // Add compatibility for ModernChatApp
  if (typeof window.ModernChatApp !== 'undefined') {
    patchModernChatApp();
  }
  
  // Add compatibility for QuickChatApp
  if (typeof window.QuickChatApp !== 'undefined') {
    patchQuickChatApp();
  }
  
  // Define global access methods
  window.toggleGroupInfo = function() {
    eventBus.publish('group:info:toggle');
  };
  
  window.replyToMessage = function(messageId) {
    eventBus.publish('message:reply', { messageId });
  };
  
  window.cancelReply = function() {
    eventBus.publish('message:reply:cancel');
  };
  
  window.showReactionPicker = function(messageId, event) {
    eventBus.publish('message:reaction:show', { messageId, event });
  };
  
  window.addReaction = function(emoji) {
    // The reactions module handles this via its event listeners
    const reactionPicker = document.getElementById('reactionPicker');
    if (reactionPicker && reactionPicker.dataset.messageId) {
      eventBus.publish('message:reaction:add', { 
        messageId: reactionPicker.dataset.messageId, 
        emoji 
      });
    }
  };
  
  window.editMessage = function(messageId) {
    eventBus.publish('message:edit', { messageId });
  };
  
  window.toggleEmojiPicker = function() {
    eventBus.publish('emoji:picker:toggle');
  };
  
  window.toggleRecording = function() {
    eventBus.publish('voice:record:toggle');
  };
  
  window.showSettings = function() {
    eventBus.publish('settings:show');
  };
  
  console.log('Chat compatibility layer initialized');
}

// Patch ModernChatApp with modern implementations
function patchModernChatApp() {
  // Only patch if ModernChatApp exists
  if (typeof ModernChatApp !== 'function') return;
  
  console.log('Patching ModernChatApp for compatibility');
  
  // Group info functions
  ModernChatApp.prototype.toggleGroupInfo = function() {
    eventBus.publish('group:info:toggle');
  };
  
  ModernChatApp.prototype.loadGroupMembers = function(groupId) {
    eventBus.publish('group:members:load', { groupId });
  };
  
  // Reply functions
  ModernChatApp.prototype.replyToMessage = function(messageId) {
    eventBus.publish('message:reply', { messageId });
  };
  
  ModernChatApp.prototype.cancelReply = function() {
    eventBus.publish('message:reply:cancel');
  };
  
  // Reaction functions
  ModernChatApp.prototype.showReactionPicker = function(messageId, event) {
    eventBus.publish('message:reaction:show', { messageId, event });
  };
  
  ModernChatApp.prototype.addReaction = function(emoji) {
    const reactionPicker = document.getElementById('reactionPicker');
    if (reactionPicker && reactionPicker.dataset.messageId) {
      eventBus.publish('message:reaction:add', { 
        messageId: reactionPicker.dataset.messageId, 
        emoji 
      });
    }
  };
  
  ModernChatApp.prototype.sendReaction = function(messageId, emoji) {
    eventBus.publish('message:reaction:add', { messageId, emoji });
  };
  
  ModernChatApp.prototype.removeReaction = function(messageId, emoji) {
    eventBus.publish('message:reaction:remove', { messageId, emoji });
  };
  
  // Edit message functions
  ModernChatApp.prototype.editMessage = function(messageId) {
    eventBus.publish('message:edit', { messageId });
  };
  
  ModernChatApp.prototype.cancelEdit = function() {
    eventBus.publish('message:edit:cancel');
  };
  
  ModernChatApp.prototype.saveEdit = function(content) {
    eventBus.publish('message:edit:save', { content });
  };
  
  // Make sure render functions use the new renderer if possible
  if (!ModernChatApp.prototype.renderMessage || typeof ModernChatApp.prototype.renderMessage !== 'function') {
    ModernChatApp.prototype.renderMessage = function(message) {
      // Create a temporary element
      const tempContainer = document.createElement('div');
      
      // Publish render event and let the new module handle it
      eventBus.publish('message:render', { 
        message, 
        container: tempContainer,
        isLegacyMode: true
      });
      
      // Return the rendered HTML
      return tempContainer.innerHTML;
    };
  }
}

// Patch QuickChatApp with modern implementations
function patchQuickChatApp() {
  // Only patch if QuickChatApp exists
  if (typeof QuickChatApp !== 'function') return;
  
  console.log('Patching QuickChatApp for compatibility');
  
  // Emoji picker functions
  QuickChatApp.prototype.toggleEmojiPicker = function() {
    eventBus.publish('emoji:picker:toggle');
  };
  
  QuickChatApp.prototype.insertEmoji = function(emoji) {
    eventBus.publish('emoji:insert', { emoji });
  };
  
  // Recording functions
  QuickChatApp.prototype.toggleRecording = function() {
    eventBus.publish('voice:record:toggle');
  };
  
  QuickChatApp.prototype.startRecording = function() {
    eventBus.publish('voice:record:start');
  };
  
  QuickChatApp.prototype.stopRecording = function() {
    eventBus.publish('voice:record:stop');
  };
  
  // Settings functions
  QuickChatApp.prototype.showSettings = function() {
    eventBus.publish('settings:show');
  };
  
  QuickChatApp.prototype.loadUserSettings = function() {
    eventBus.publish('settings:load');
  };
}

// Initialize the compatibility layer automatically
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initChatCompatibility, 1);
  } else {
    document.addEventListener('DOMContentLoaded', initChatCompatibility);
  }
}

export default {
  initChatCompatibility
};
