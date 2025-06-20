/**
 * Profile Page Entry Point
 * 
 * Initializes the profile page with user profile management
 */

import { Profile } from '../components/Profile.js';
import { logger } from '../utils/logger.js';

// Initialize profile page
document.addEventListener('DOMContentLoaded', async () => {
  try {
    logger.info('Initializing profile page');
    
    // Find the profile container
    const container = document.querySelector('.profile-container') || document.body;
    
    // Create and initialize the profile component
    const profile = new Profile(container, {
      editable: true,
      showAvatar: true,
      showStats: true
    });
    
    await profile.init();
    
    logger.info('Profile page initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize profile page:', error);
  }
});
