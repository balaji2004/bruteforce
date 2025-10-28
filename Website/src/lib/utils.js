// src/lib/utils.js
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
export const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Never';
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
};

/**
 * Format timestamp to readable date
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
  } catch {
    return 'Invalid date';
  }
};

/**
 * Determine node status based on last update time
 * Accepts either a timestamp (milliseconds) or Unix timestamp string (seconds)
 */
export const getNodeStatus = (lastUpdate) => {
  if (!lastUpdate) return 'offline';
  
  // Convert Unix timestamp (string in seconds) to milliseconds if needed
  let lastUpdateMs;
  if (typeof lastUpdate === 'string') {
    lastUpdateMs = parseInt(lastUpdate) * 1000;
  } else {
    lastUpdateMs = lastUpdate;
  }
  
  const now = Date.now();
  const diff = now - lastUpdateMs;
  
  // Online if seen in last 5 minutes
  if (diff < 5 * 60 * 1000) return 'online';
  
  // Offline if not seen in last 5 minutes
  return 'offline';
};

/**
 * Get status color for display
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'offline':
      return 'bg-red-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'critical':
      return 'bg-red-600';
    default:
      return 'bg-gray-500';
  }
};

/**
 * Get alert status color
 */
export const getAlertColor = (alertStatus) => {
  switch (alertStatus) {
    case 'normal':
      return 'text-green-600';
    case 'warning':
      return 'text-yellow-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

/**
 * Validate latitude
 */
export const isValidLatitude = (lat) => {
  const num = parseFloat(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
};

/**
 * Validate longitude
 */
export const isValidLongitude = (lng) => {
  const num = parseFloat(lng);
  return !isNaN(num) && num >= -180 && num <= 180;
};

/**
 * Validate phone number (Indian format)
 */
export const isValidPhoneNumber = (phone) => {
  // Basic validation for Indian phone numbers
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('91'));
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  return phone;
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

/**
 * Check if sensor value is valid
 */
export const isValidSensorValue = (value) => {
  return value !== null && value !== undefined && !isNaN(value);
};

/**
 * Get sensor display value
 */
export const getSensorDisplay = (value, unit = '', decimals = 1) => {
  if (!isValidSensorValue(value)) return 'N/A';
  return `${parseFloat(value).toFixed(decimals)}${unit}`;
};

/**
 * Generate unique ID
 */
export const generateId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};