/**
 * Services Index
 * 
 * This file exports all service instances in a centralized way.
 * Import this file to access all services at once.
 */

// Import service instances
import apiClient from './api-client.js';
import storageService from './storage-service.js';
import analyticsService from './analytics-service.js';

// Re-export services
export {
  apiClient,
  storageService,
  analyticsService
};

// Default export for backward compatibility
export default {
  api: apiClient,
  storage: storageService,
  analytics: analyticsService
};
