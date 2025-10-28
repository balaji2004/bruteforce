// src/app/api/sms/route.js
/**
 * SMS API Route
 * Handles SMS sending via Twilio
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { recipients, message, alertId, severity } = await request.json();

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recipients array is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if Twilio is configured
    const twilioEnabled = process.env.NEXT_PUBLIC_TWILIO_ENABLED === 'true';
    const accountSid = process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

    if (!twilioEnabled || !accountSid || !authToken || !fromNumber) {
      console.log('⚠️ Twilio not fully configured');
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'SMS service not configured. Please set up Twilio credentials.',
        recipients: recipients.length
      });
    }

    // Import Twilio SDK
    let twilio;
    try {
      twilio = (await import('twilio')).default;
    } catch (importError) {
      console.error('❌ Twilio SDK not installed:', importError);
      return NextResponse.json({
        success: false,
        configured: true,
        error: 'Twilio SDK not installed. Run: npm install twilio',
        message: 'SMS service configuration incomplete'
      }, { status: 500 });
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Send SMS to all recipients
    const deliveryResults = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        console.log(`📱 Sending SMS to ${recipient}...`);

        const result = await client.messages.create({
          body: message,
          from: fromNumber,
          to: recipient
        });

        deliveryResults.push({
          to: recipient,
          status: result.status,
          sid: result.sid,
          success: true
        });

        console.log(`✅ SMS sent to ${recipient}: ${result.sid}`);
      } catch (smsError) {
        console.error(`❌ Failed to send SMS to ${recipient}:`, smsError.message);
        errors.push({
          to: recipient,
          error: smsError.message,
          code: smsError.code
        });

        deliveryResults.push({
          to: recipient,
          status: 'failed',
          error: smsError.message,
          success: false
        });
      }
    }

    // Determine overall success
    const successCount = deliveryResults.filter(r => r.success).length;
    const allSuccess = errors.length === 0;
    const partialSuccess = successCount > 0 && errors.length > 0;

    return NextResponse.json({
      success: allSuccess,
      partialSuccess,
      configured: true,
      recipients: recipients.length,
      successCount,
      failureCount: errors.length,
      message: allSuccess
        ? `SMS sent successfully to ${successCount} recipient(s)`
        : partialSuccess
        ? `SMS sent to ${successCount} recipient(s), failed for ${errors.length}`
        : `Failed to send SMS to all ${recipients.length} recipient(s)`,
      deliveryResults,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ SMS API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Internal server error while sending SMS'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check SMS service status
export async function GET() {
  const twilioEnabled = process.env.NEXT_PUBLIC_TWILIO_ENABLED === 'true';
  const hasAccountSid = !!process.env.NEXT_PUBLIC_TWILIO_ACCOUNT_SID;
  const hasAuthToken = !!process.env.TWILIO_AUTH_TOKEN;
  const hasPhoneNumber = !!process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

  // Check if Twilio SDK is installed
  let sdkInstalled = false;
  try {
    await import('twilio');
    sdkInstalled = true;
  } catch {
    sdkInstalled = false;
  }

  return NextResponse.json({
    enabled: twilioEnabled,
    configured: twilioEnabled && hasAccountSid && hasAuthToken && hasPhoneNumber && sdkInstalled,
    accountSid: hasAccountSid ? 'Set' : 'Missing',
    authToken: hasAuthToken ? 'Set' : 'Missing',
    phoneNumber: hasPhoneNumber ? 'Set' : 'Missing',
    sdkInstalled,
    status: twilioEnabled && hasAccountSid && hasAuthToken && hasPhoneNumber && sdkInstalled
      ? 'Ready'
      : twilioEnabled
      ? 'Incomplete Configuration'
      : 'Disabled (Using Notification Log)'
  });
}
