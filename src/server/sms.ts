import { getSetting } from '../db/database.ts';

export function getFast2SmsApiKey(): string | null {
  if (process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY.trim()) {
    return process.env.FAST2SMS_API_KEY.trim();
  }
  return getSetting('fast2sms_api_key');
}

export function isFast2SmsConfigured(): boolean {
  const key = getFast2SmsApiKey();
  return Boolean(key && key.length > 5);
}

export async function sendFast2SmsOtp(
  mobile: string,
  otp: string
): Promise<{ success: boolean; message: string; fast2smsCalled: boolean; status_code?: number; data?: any }> {
  const apiKey = getFast2SmsApiKey();
  const cleanMobile = mobile.replace(/\D/g, '').slice(-10);

  if (!apiKey) {
    console.warn(`[Fast2SMS] FAST2SMS_API_KEY not configured. OTP generated for +91${cleanMobile} (awaiting Fast2SMS key).`);
    return {
      success: false,
      fast2smsCalled: false,
      message: 'Fast2SMS API Key is not configured yet. Please configure it in settings.',
    };
  }

  console.log(`[Fast2SMS] Initiating outbound API call to Fast2SMS (https://www.fast2sms.com/dev/bulkV2) for +91${cleanMobile}...`);

  try {
    // 1. Attempt Fast2SMS Bulk V2 OTP Route
    const otpPayload = {
      route: 'otp',
      variables_values: otp,
      numbers: cleanMobile,
    };

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(otpPayload),
    });

    const data = await response.json().catch(() => ({}));
    console.log(`[Fast2SMS] OTP route response for +91${cleanMobile}:`, data);

    if (data.return === true) {
      return {
        success: true,
        fast2smsCalled: true,
        message: 'Official SMS verification code dispatched via Fast2SMS.',
        data,
      };
    }

    const statusCode = data.status_code || (data.return === false ? 400 : 0);
    const errMsg = Array.isArray(data.message)
      ? data.message.join(', ')
      : (data.message || 'Fast2SMS dispatch failed');

    console.warn(`[Fast2SMS] OTP route rejected (status ${statusCode}) for +91${cleanMobile}: ${errMsg}`);

    // 2. Fallback: If OTP route requires website verification or KYC, try Quick SMS ('q' route)
    let quickErrMsg: string | null = null;
    let quickStatusCode: number | null = null;

    if (
      statusCode === 996 ||
      errMsg.toLowerCase().includes('website verification') ||
      errMsg.toLowerCase().includes('otp message') ||
      errMsg.toLowerCase().includes('kyc')
    ) {
      console.log(`[Fast2SMS] Attempting Quick SMS fallback ('q' route) for +91${cleanMobile}...`);
      try {
        const quickPayload = {
          route: 'q',
          message: `Your JSG Royals verification OTP code is ${otp}. Valid for 3 minutes.`,
          language: 'english',
          flash: 0,
          numbers: cleanMobile,
        };

        const quickRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(quickPayload),
        });

        const quickData = await quickRes.json().catch(() => ({}));
        console.log(`[Fast2SMS] Quick route response for +91${cleanMobile}:`, quickData);

        if (quickData.return === true) {
          return {
            success: true,
            fast2smsCalled: true,
            message: 'Official SMS verification code dispatched via Fast2SMS Quick route.',
            data: quickData,
          };
        }

        quickStatusCode = quickData.status_code || null;
        quickErrMsg = Array.isArray(quickData.message)
          ? quickData.message.join(', ')
          : (quickData.message || 'Quick route rejected');
        console.warn(`[Fast2SMS] Quick route also failed (status ${quickStatusCode}): ${quickErrMsg}`);
      } catch (quickErr) {
        console.error('[Fast2SMS] Quick route exception:', quickErr);
      }
    }

    // 3. Construct detailed, actionable message explaining Fast2SMS requirements
    let friendlyInstruction = errMsg;
    if (quickStatusCode === 999 || (quickErrMsg && quickErrMsg.includes('100 INR'))) {
      friendlyInstruction = 'Fast2SMS Activation Required (Error 999): Fast2SMS requires completing one minimum transaction of ₹100 INR before API routes can send live carrier SMS. (Your account currently has ₹50 trial balance). Please recharge ₹100 in your Fast2SMS wallet.';
    } else if (statusCode === 996 || errMsg.toLowerCase().includes('website verification')) {
      friendlyInstruction = 'Fast2SMS Website Verification Required (Error 996): Log in to fast2sms.com -> Dev API -> OTP Message -> Website Verification, and submit your website domain (e.g. royalsrenewform.vercel.app). Also ensure KYC is submitted.';
    }

    return {
      success: false,
      fast2smsCalled: true,
      status_code: quickStatusCode || statusCode,
      message: friendlyInstruction,
      data,
    };
  } catch (err: any) {
    console.error('[Fast2SMS Exception]:', err);
    return {
      success: false,
      fast2smsCalled: false,
      message: err.message || 'Network error reaching Fast2SMS gateway.',
    };
  }
}

export async function checkFast2SmsWallet(): Promise<{ success: boolean; wallet?: string; message?: string }> {
  const apiKey = getFast2SmsApiKey();
  if (!apiKey) {
    return { success: false, message: 'Fast2SMS API Key not configured.' };
  }

  try {
    const res = await fetch('https://www.fast2sms.com/dev/wallet', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (data.return === true) {
      return { success: true, wallet: data.wallet };
    }
    return { success: false, message: data.message || 'Could not fetch Fast2SMS wallet balance.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to connect to Fast2SMS.' };
  }
}
