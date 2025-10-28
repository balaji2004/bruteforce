/**
 * Utility functions for formatting timestamps
 */

/**
 * Convert timestamp to relative time string (e.g., "2 minutes ago")
 * 
 * @param {number|Date} timestamp - Unix timestamp (ms) or Date object
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  if (seconds < 2592000) {
    const weeks = Math.floor(seconds / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (seconds < 31536000) {
    const months = Math.floor(seconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.floor(seconds / 31536000);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/**
 * Format timestamp to absolute date string
 * 
 * @param {number|Date} timestamp - Unix timestamp (ms) or Date object
 * @param {boolean} includeTime - Include time in output
 * @returns {string} Formatted date string
 */
export function formatAbsoluteTime(timestamp, includeTime = true) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  const options = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format timestamp with both relative and absolute time
 * 
 * @param {number|Date} timestamp - Unix timestamp (ms) or Date object
 * @returns {string} Combined format string
 */
export function formatBothTime(timestamp) {
  const relative = formatRelativeTime(timestamp);
  const absolute = formatAbsoluteTime(timestamp);
  return `${relative} (${absolute})`;
}

/**
 * Get exact ISO timestamp for tooltips
 * 
 * @param {number|Date} timestamp - Unix timestamp (ms) or Date object
 * @returns {string} ISO string
 */
export function formatExactTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toISOString();
}

