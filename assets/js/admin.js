/**
 * Admin Module
 * 
 * This is the main entry point for the admin functionality.
 * It loads the admin module and initializes it.
 */

// Import the admin module
import AdminModule from './features/admin/index.js';

// Initialize the admin module when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
  const adminModule = new AdminModule();
  adminModule.init();
});
