/**
 * Dashboard Page Entry Point
 * Initializes the main dashboard interface
 */

import { QuickChatApp } from '../index.js';

// Initialize dashboard-specific features when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the main application
    const app = new QuickChatApp();
    await app.init();
    
    console.log('Dashboard page initialized');
    
  } catch (error) {
    console.error('Failed to initialize dashboard page:', error);
  }
});
