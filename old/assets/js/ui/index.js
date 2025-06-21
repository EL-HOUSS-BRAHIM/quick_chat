/**
 * UI Components Index
 * 
 * This file exports all UI components in a centralized way.
 * Import this file to access all UI components at once.
 */

// Import UI components
import AccessibilityManager from './accessibility.js';
import NotificationManager from './notification-manager.js';
import UploadProgressManager from './upload-progress.js';
import { VirtualScroll } from './virtual-scroll.js';

// Create instances for singleton components
const accessibilityManager = new AccessibilityManager();
const notificationManager = new NotificationManager();
const uploadProgressManager = new UploadProgressManager();

// Export components and instances
export {
  AccessibilityManager,
  NotificationManager,
  UploadProgressManager,
  VirtualScroll,
  
  // Instances
  accessibilityManager,
  notificationManager,
  uploadProgressManager
};

// Default export of component instances
export default {
  accessibility: accessibilityManager,
  notifications: notificationManager,
  uploadProgress: uploadProgressManager,
  VirtualScroll: VirtualScroll
};
