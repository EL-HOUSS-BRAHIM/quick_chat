/**
 * Admin Page Entry Point
 * 
 * Initializes the admin panel with management functionality
 */

import { AdminPanel } from '../components/AdminPanel.js';
import { logger } from '../utils/logger.js';

// Initialize admin page
document.addEventListener('DOMContentLoaded', async () => {
  try {
    logger.info('Initializing admin page');
    
    // Find the admin container
    const container = document.querySelector('.admin-container') || document.body;
    
    // Create and initialize the admin panel component
    const adminPanel = new AdminPanel(container);
    
    await adminPanel.init();
    
    logger.info('Admin page initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize admin page:', error);
  }
});try Point
 * Initializes the admin panel interface
 */

import { QuickChatApp } from '../index.js';

// Initialize admin-specific features when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the main application
    const app = new QuickChatApp();
    await app.init();
    
    console.log('Admin page initialized');
    
  } catch (error) {
    console.error('Failed to initialize admin page:', error);
  }
});
