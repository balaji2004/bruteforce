// src/lib/notifications.js
/**
 * Notification System
 * Handles SMS, Email, and In-App notifications
 */

import { database, ref, set, get } from './firebase';
import { generateId } from './utils';

/**
 * Send SMS notification (requires Twilio setup)
 * @param {Object} options - Notification options
 * @param {string[]} options.recipients - Array of phone numbers
 * @param {string} options.message - Message to send
 * @param {string} options.alertId - Alert ID for tracking
 * @param {string} options.severity - Alert severity
 * @returns {Promise<Object>} Result object
 */
export async function sendSMSNotification({ recipients, message, alertId, severity }) {
  const notificationId = generateId('notification');
  const timestamp = Date.now();
  
  console.log('📱 SMS Notification Request:', {
    notificationId,
    recipients: recipients.length,
    alertId,
    severity
  });

  try {
    // Call the SMS API endpoint
    console.log('🚀 Calling SMS API...');

    const response = await fetch('/api/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients,
        message,
        alertId,
        severity
      })
    });

    const result = await response.json();

    // If Twilio is not configured, log the notification
    if (!result.configured) {
      console.log('⚠️ Twilio not configured - logging notification instead');

      // Log the notification attempt
      const notificationData = {
        id: notificationId,
        type: 'sms',
        status: 'pending',
        alertId,
        severity,
        message,
        recipients,
        timestamp,
        method: 'twilio',
        deliveryStatus: 'not_configured',
        note: 'SMS service not configured. Would send to: ' + recipients.join(', ')
      };

      // Save to Firebase notifications log
      await set(ref(database, `notifications/${notificationId}`), notificationData);

      // Log to system logs
      const logId = generateId('log');
      await set(ref(database, `logs/${logId}`), {
        id: logId,
        type: 'sms_pending',
        message: `SMS notification logged (not sent - Twilio not configured). Recipients: ${recipients.length}`,
        timestamp,
        metadata: { notificationId, alertId, recipients: recipients.length }
      });

      console.log('✅ Notification logged:', notificationId);

      return {
        success: false,
        configured: false,
        notificationId,
        recipients: recipients.length,
        message: result.message || 'SMS service not configured. Notification logged for future delivery.',
        details: notificationData
      };
    }

    // Process the API response
    const deliveryResults = result.deliveryResults || [];

    // Save notification record
    const notificationData = {
      id: notificationId,
      type: 'sms',
      status: result.success ? 'sent' : result.partialSuccess ? 'partial' : 'failed',
      alertId,
      severity,
      message,
      recipients,
      timestamp,
      method: 'twilio',
      deliveryStatus: result.success ? 'delivered' : result.partialSuccess ? 'partial' : 'failed',
      deliveryResults,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors
    };

    await set(ref(database, `notifications/${notificationId}`), notificationData);

    // Log the result
    const logId = generateId('log');
    const logType = result.success ? 'sms_sent' : result.partialSuccess ? 'sms_partial' : 'sms_failed';
    await set(ref(database, `logs/${logId}`), {
      id: logId,
      type: logType,
      message: result.message,
      timestamp,
      metadata: {
        notificationId,
        alertId,
        recipients: recipients.length,
        successCount: result.successCount,
        failureCount: result.failureCount
      }
    });

    console.log(result.success ? '✅ SMS sent successfully:' : '⚠️ SMS send completed with issues:', notificationId);

    return {
      success: result.success,
      configured: true,
      notificationId,
      recipients: recipients.length,
      message: result.message,
      details: notificationData,
      partialSuccess: result.partialSuccess,
      errors: result.errors
    };
    
  } catch (error) {
    console.error('❌ SMS notification failed:', error);

    // Log the error
    const logId = generateId('log');
    await set(ref(database, `logs/${logId}`), {
      id: logId,
      type: 'sms_failed',
      message: `SMS notification failed: ${error.message}`,
      timestamp,
      metadata: { alertId, recipients: recipients.length, error: error.message }
    });

    return {
      success: false,
      configured: false,
      error: error.message,
      message: 'Failed to send SMS notification'
    };
  }
}

/**
 * Send in-app notification
 * Creates a notification that appears in the app
 * @param {Object} options - Notification options
 * @returns {Promise<Object>} Result object
 */
export async function sendInAppNotification({ alertId, message, severity, affectedNodes }) {
  const notificationId = generateId('notification');
  const timestamp = Date.now();
  
  console.log('🔔 Creating in-app notification...');
  
  try {
    const notificationData = {
      id: notificationId,
      type: 'in_app',
      status: 'unread',
      alertId,
      severity,
      message,
      affectedNodes,
      timestamp,
      expiresAt: timestamp + (7 * 24 * 60 * 60 * 1000), // 7 days
      readBy: []
    };
    
    await set(ref(database, `notifications/${notificationId}`), notificationData);
    
    console.log('✅ In-app notification created:', notificationId);
    
    return {
      success: true,
      notificationId,
      message: 'In-app notification created'
    };
  } catch (error) {
    console.error('❌ In-app notification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get notification history for an alert
 * @param {string} alertId - Alert ID
 * @returns {Promise<Array>} Array of notifications
 */
export async function getAlertNotifications(alertId) {
  try {
    const notificationsRef = ref(database, 'notifications');
    const snapshot = await get(notificationsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const notifications = snapshot.val();
    return Object.values(notifications)
      .filter(n => n.alertId === alertId)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

/**
 * Check if SMS service is configured
 * @returns {boolean} True if Twilio is configured
 */
export function isSMSConfigured() {
  return process.env.NEXT_PUBLIC_TWILIO_ENABLED === 'true';
}

/**
 * Get SMS configuration status
 * @returns {Promise<Object>} Configuration details
 */
export async function getSMSStatus() {
  try {
    const response = await fetch('/api/sms');
    const status = await response.json();
    return status;
  } catch (error) {
    console.error('Error fetching SMS status:', error);
    // Fallback to client-side check
    const twilioEnabled = process.env.NEXT_PUBLIC_TWILIO_ENABLED === 'true';
    const hasAccountSid = !!process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID;
    const hasPhoneNumber = !!process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

    return {
      enabled: twilioEnabled,
      configured: false,
      accountSid: hasAccountSid ? 'Set' : 'Missing',
      authToken: 'Unknown',
      phoneNumber: hasPhoneNumber ? 'Set' : 'Missing',
      sdkInstalled: 'Unknown',
      status: 'Unable to check (API unavailable)'
    };
  }
}

