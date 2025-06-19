/**
 * @file Date formatting utilities
 * @description Provides functions for formatting and manipulating dates in the chat application
 * @module utils/date-formatter
 */

/**
 * Formats a date to display in messages
 * @param {Date|string|number} date - The date to format
 * @param {boolean} [includeTime=true] - Whether to include the time in the formatted string
 * @returns {string} The formatted date string
 */
export function formatMessageDate(date, includeTime = true) {
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Check if date is today
  if (dateObj.setHours(0, 0, 0, 0) === now.setHours(0, 0, 0, 0)) {
    return includeTime ? `Today at ${formatTime(dateObj)}` : 'Today';
  }
  
  // Check if date is yesterday
  if (dateObj.setHours(0, 0, 0, 0) === yesterday.setHours(0, 0, 0, 0)) {
    return includeTime ? `Yesterday at ${formatTime(dateObj)}` : 'Yesterday';
  }
  
  // Otherwise, use full date format
  return formatFullDate(dateObj, includeTime);
}

/**
 * Formats a time string in 12-hour format with AM/PM
 * @param {Date} date - The date object to format
 * @returns {string} The formatted time string
 */
export function formatTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

/**
 * Formats a date in a full format including day, month, and year
 * @param {Date} date - The date to format
 * @param {boolean} [includeTime=true] - Whether to include the time
 * @returns {string} The formatted date string
 */
export function formatFullDate(date, includeTime = true) {
  const options = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  };
  
  let formattedDate = date.toLocaleDateString('en-US', options);
  
  if (includeTime) {
    formattedDate += ` at ${formatTime(date)}`;
  }
  
  return formattedDate;
}

/**
 * Returns a relative time string (e.g., "2 minutes ago", "in 3 hours")
 * @param {Date|string|number} date - The date to format
 * @returns {string} The relative time string
 */
export function getRelativeTimeString(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (diffInSeconds < 60) {
    return diffInSeconds <= 0 ? 'just now' : `${diffInSeconds} seconds ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }
  
  return formatFullDate(dateObj);
}

/**
 * Format a timestamp for a chat message
 * @param {Date|string|number} timestamp - The timestamp to format
 * @returns {string} Formatted timestamp string
 */
export function formatChatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  
  // If it's today, just show the time
  if (date.toDateString() === now.toDateString()) {
    return formatTime(date);
  }
  
  // If it's within the last week, show the day name and time
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  
  if (date > weekAgo) {
    const options = { weekday: 'short' };
    return `${date.toLocaleDateString('en-US', options)} ${formatTime(date)}`;
  }
  
  // Otherwise show the full date
  return formatFullDate(date);
}

export default {
  formatMessageDate,
  formatTime,
  formatFullDate,
  getRelativeTimeString,
  formatChatTimestamp
};
