/**
 * Chat Page Entry Point
 * Initializes the chat interface for private and group chats
 */

import { QuickChatApp } from '../index.js';

// Initialize chat-specific features when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get chat configuration from page
    const chatType = document.body.dataset.chatType || 'private';
    const targetUserId = new URLSearchParams(window.location.search).get('user');
    const groupId = new URLSearchParams(window.location.search).get('group');
    
    // Initialize the main application
    const app = new QuickChatApp();
    await app.init();
    
    console.log(`Chat page initialized for ${chatType} chat`);
    
  } catch (error) {
    console.error('Failed to initialize chat page:', error);
  }
});
