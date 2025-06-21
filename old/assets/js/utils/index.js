/**
 * Utils Index
 * 
 * This file exports all utility functions in a centralized way.
 * Import this file to access all utility functions at once.
 */

// Import all utility files
import * as dateFormatter from './date-formatter.js';
import * as fileHelpers from './file-helpers.js';
import * as stringHelpers from './string-helpers.js';

// Re-export all utilities
export {
  dateFormatter,
  fileHelpers,
  stringHelpers
};

// Default export for backward compatibility
export default {
  date: dateFormatter,
  file: fileHelpers,
  string: stringHelpers
};
