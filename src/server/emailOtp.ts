import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { db, getSetting, setSetting } from '../db/database.ts';

const ROYALS_LOGO_DISK_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/file_00000000679071f5a5e7d2bf243a4828__1__fe221d87.png'
);

const OTP_BYPASS_EMAILS = new Set(['jsubodh06@gmail.com']);

function buildExistingRegistrationCheck(email: string) {
  const existingRecord = db.prepare(`
    SELECT * FROM family_registrations 
    WHERE LOWER(husband_email) = ? OR LOWER(wife_email) = ?
    ORDER BY id DESC LIMIT 1
  `).get(email, email) as any;

  if (!existingRecord) {
    return {
      isAlreadyRegistered: false,
      alreadyRegistered: false,
      filedBySpouse: false,
      spouseName: '',
      spouseRole: 'husband' as 'husband' | 'wife',
      message: 'Email address verified successfully!',
      registration: undefined as any,
    };
  }

  const isHusbandEmail = existingRecord.husband_email.toLowerCase() === email;
  const isWifeEmail = existingRecord.wife_email.toLowerCase() === email;
  const submittedByRole = existingRecord.submitted_by_role;

  let filedBySpouse = false;
  let spouseName = '';
  let spouseRole: 'husband' | 'wife' = 'husband';
  let message = '';

  const dateFormatted = new Date(existingRecord.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (isWifeEmail && submittedByRole === 'husband') {
    filedBySpouse = true;
    spouseName = existingRecord.husband_name;
    spouseRole = 'husband';
    message = `✨ Your husband, ${existingRecord.husband_name}, has already registered your royal household on ${dateFormatted}!`;
  } else if (isHusbandEmail && submittedByRole === 'wife') {
    filedBySpouse = true;
    spouseName = existingRecord.wife_name;
    spouseRole = 'wife';
    message = `✨ Your wife, ${existingRecord.wife_name}, has already registered your royal household on ${dateFormatted}!`;
  } else {
    filedBySpouse = false;
    spouseName = submittedByRole === 'husband' ? existingRecord.wife_name : existingRecord.husband_name;
    spouseRole = submittedByRole === 'husband' ? 'wife' : 'husband';
    message = `✨ Your royal family dossier was already recorded on ${dateFormatted}.`;
  }

  let parsedChildren = [];
  try {
    parsedChildren = existingRecord.children_json ? JSON.parse(existingRecord.children_json) : [];
  } catch (e) {
    parsedChildren = [];
  }

  return {
    isAlreadyRegistered: true,
    alreadyRegistered: true,
    filedBySpouse,
    spouseName,
    spouseRole,
    message,
    registration: {
      ...existingRecord,
      children: parsedChildren
    }
  };
}

function generateRoyalEmailText(otp: string): string {
  return [
    'JSG Royals Chapter 2 - Member Portal',
    '',
    'Hello,',
    '',
    `Your verification code is: ${otp}`,
    '',
    'This code is valid for 10 minutes.',
    'Enter this code in the JSG Royals portal to verify your email address and continue your registration.',
    '',
    'If you did not request this verification code, please ignore this email.',
    '',
    'Warm regards,',
    'JSG Royals Directory Team'
  ].join('\n');
}

// Helper to generate clean transactional HTML email template (no external .run.app URLs to avoid spam flags)
function generateRoyalEmailHtml(otp: string, useCidLogo = false) {
  const logoHtml = useCidLogo
    ? `<img src="cid:royals-logo" alt="The Royals Logo" width="72" height="72" style="width: 72px; height: 72px; border-radius: 14px; border: 1.5px solid #D4AF37; display: block; margin: 0 auto 12px; background: #122619; object-fit: contain;" />`
    : `<div style="width: 56px; height: 56px; line-height: 56px; margin: 0 auto 10px; border-radius: 14px; border: 1.5px solid #D4AF37; background: #122619; color: #D4AF37; font-size: 24px; font-weight: bold; text-align: center;">R</div>`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Georgia, serif; max-width: 540px; margin: 0 auto; background: #FAF6EF; border: 1px solid #C5A869; border-radius: 16px; overflow: hidden;">
      <div style="background: #122619; padding: 24px; text-align: center; border-bottom: 2px solid #D4AF37;">
        ${logoHtml}
        <h1 style="color: #FAF7F2; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">JSG Royals Chapter 2</h1>
        <p style="color: #C5A869; margin: 4px 0 0; font-size: 12px;">Member Portal Verification</p>
      </div>
      <div style="padding: 28px 24px; text-align: center; color: #1C1917; background: #FFFFFF;">
        <p style="font-size: 15px; color: #44403C; margin-top: 0; line-height: 1.6;">
          Hello,<br />
          Use the following 6-digit verification code to verify your email address for the JSG Royals Member Portal:
        </p>

        <div style="background: #FAF6EF; border: 1px solid #D4AF37; border-radius: 12px; padding: 16px 24px; margin: 20px auto; display: inline-block;">
          <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1C1917;">${otp}</span>
        </div>

        <p style="font-size: 13px; color: #57534E; margin-bottom: 8px;">
          This code expires in <strong>10 minutes</strong>.
        </p>
        <p style="font-size: 12px; color: #78716C; margin-top: 0;">
          If you did not request this verification code, you can safely ignore this email.
        </p>
      </div>
      <div style="background: #F5EFE6; padding: 14px; text-align: center; font-size: 12px; color: #78716C; border-top: 1px solid #E7DDCE;">
        JSG Royals Directory &amp; Family Registry
      </div>
    </div>
  `;
}

// 1. Resend API Dispatcher (Uses HTTPS Port 443 — 100% reliable on Cloud Run)
async function sendViaResend(apiKey: string, toEmail: string, otp: string, _baseUrl?: string): Promise<boolean> {
  try {
    const fromAddress = process.env.RESEND_FROM || 'JSG Royals <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: 'Your JSG Royals verification code',
        text: generateRoyalEmailText(otp),
        html: generateRoyalEmailHtml(otp, false)
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Resend Delivery Failed]', errText);
      return false;
    }

    const data = (await res.json()) as any;
    console.log(`[Resend Success] Email dispatched to ${toEmail} (Id: ${data?.id})`);
    return true;
  } catch (err: any) {
    console.warn('[Resend Exception]', err?.message || err);
    return false;
  }
}

// 2. Brevo API Dispatcher (Uses HTTPS Port 443)
async function sendViaBrevo(apiKey: string, toEmail: string, otp: string, _baseUrl?: string): Promise<boolean> {
  try {
    const senderEmail = process.env.BREVO_FROM || 'no-reply@jsgroyals.org';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'JSG Royals', email: senderEmail },
        to: [{ email: toEmail }],
        subject: 'Your JSG Royals verification code',
        textContent: generateRoyalEmailText(otp),
        htmlContent: generateRoyalEmailHtml(otp, false)
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Brevo Delivery Failed]', errText);
      return false;
    }

    console.log(`[Brevo Success] Email dispatched to ${toEmail}`);
    return true;
  } catch (err: any) {
    console.warn('[Brevo Exception]', err?.message || err);
    return false;
  }
}

// 3. Configure Transporter for Gmail / SMTP
function createTransporter() {
  const host = (getSetting('smtp_host') || process.env.SMTP_HOST || '').trim();
  const user = (getSetting('gmail_user') || getSetting('smtp_user') || process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = (getSetting('gmail_pass') || getSetting('smtp_pass') || process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '').trim();
  const port = parseInt(getSetting('smtp_port') || process.env.SMTP_PORT || '587', 10);

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }

  // Gmail configuration via 16-character App Password
  if (user && pass && user.toLowerCase().includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: user.toLowerCase(), pass: pass.replace(/\s+/g, '') }
    });
  }

  return null;
}

// Get active email service configuration status
export function getEmailConfigStatus() {
  const dbResendKey = getSetting('resend_api_key');
  const envResendKey = process.env.RESEND_API_KEY;
  const resendKey = dbResendKey || envResendKey;

  const dbBrevoKey = getSetting('brevo_api_key');
  const envBrevoKey = process.env.BREVO_API_KEY;
  const brevoKey = dbBrevoKey || envBrevoKey;

  const dbGmailUser = getSetting('gmail_user');
  const envGmailUser = process.env.GMAIL_USER;
  const gmailUser = dbGmailUser || envGmailUser;

  const dbGmailPass = getSetting('gmail_pass');
  const envGmailPass = process.env.GMAIL_APP_PASS;
  const gmailPass = (dbGmailPass || envGmailPass || '').replace(/\s+/g, '');

  const smtpHost = getSetting('smtp_host') || process.env.SMTP_HOST;
  const smtpUser = getSetting('smtp_user') || process.env.SMTP_USER;

  let activeProvider: 'resend' | 'brevo' | 'gmail' | 'smtp' | 'demo' = 'demo';
  let senderEmail = '';
  let maskedPass: string | null = null;
  let source: 'env' | 'db' | null = null;

  if (resendKey) {
    activeProvider = 'resend';
    senderEmail = 'Resend API (Cloud HTTPS)';
    maskedPass = `re_••••${resendKey.slice(-4)}`;
    source = dbResendKey ? 'db' : 'env';
  } else if (brevoKey) {
    activeProvider = 'brevo';
    senderEmail = 'Brevo Transactional API';
    maskedPass = `••••${brevoKey.slice(-4)}`;
    source = dbBrevoKey ? 'db' : 'env';
  } else if (gmailUser && gmailPass) {
    activeProvider = 'gmail';
    senderEmail = gmailUser;
    maskedPass = `•••• •••• •••• ${gmailPass.slice(-4)}`;
    source = dbGmailPass ? 'db' : 'env';
  } else if (smtpHost && smtpUser) {
    activeProvider = 'smtp';
    senderEmail = `${smtpUser}@${smtpHost}`;
    source = getSetting('smtp_host') ? 'db' : 'env';
  }

  return {
    isConfigured: activeProvider !== 'demo',
    activeProvider,
    senderEmail,
    maskedPass,
    source,
    mode: activeProvider !== 'demo' ? 'live' : 'demo'
  };
}

let cachedVerifyState: {
  fingerprint: string;
  checkedAt: number;
  connectionOk: boolean;
  connectionError: string | null;
} | null = null;

function getConfigFingerprint(): string {
  const resendKey = getSetting('resend_api_key') || process.env.RESEND_API_KEY || '';
  const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY || '';
  const gmailUser = (getSetting('gmail_user') || process.env.GMAIL_USER || '').trim().toLowerCase();
  const gmailPass = (getSetting('gmail_pass') || process.env.GMAIL_APP_PASS || '').replace(/\s+/g, '');
  const smtpHost = getSetting('smtp_host') || process.env.SMTP_HOST || '';
  const smtpUser = getSetting('smtp_user') || process.env.SMTP_USER || '';
  const smtpPass = getSetting('smtp_pass') || process.env.SMTP_PASS || '';
  return `${resendKey.slice(-6)}|${brevoKey.slice(-6)}|${gmailUser}|${gmailPass.slice(-6)}|${gmailPass.length}|${smtpHost}|${smtpUser}|${smtpPass.slice(-4)}`;
}

export async function getVerifiedEmailConfigStatus(forceCheck = false) {
  const base = getEmailConfigStatus();
  if (!base.isConfigured) {
    cachedVerifyState = null;
    return { ...base, connectionOk: null as boolean | null, connectionError: null as string | null };
  }

  const fingerprint = getConfigFingerprint();
  const now = Date.now();
  if (
    !forceCheck &&
    cachedVerifyState &&
    cachedVerifyState.fingerprint === fingerprint &&
    now - cachedVerifyState.checkedAt < 60_000
  ) {
    return {
      ...base,
      connectionOk: cachedVerifyState.connectionOk,
      connectionError: cachedVerifyState.connectionError
    };
  }

  let connectionOk = true;
  let connectionError: string | null = null;

  if (base.activeProvider === 'gmail' || base.activeProvider === 'smtp') {
    const transporter = createTransporter();
    if (!transporter) {
      connectionOk = false;
      connectionError = 'Missing SMTP credentials.';
    } else {
      try {
        await transporter.verify();
        connectionOk = true;
      } catch (err: any) {
        connectionOk = false;
        const msg = err?.message || '';
        if (msg.includes('535') || msg.includes('Username and Password not accepted') || msg.includes('BadCredentials')) {
          connectionError =
            'Gmail rejected the stored credentials (535-5.7.8 Username and Password not accepted). The active App Password is expired, revoked, or invalid.';
        } else {
          connectionError = `SMTP connection check failed: ${msg}`;
        }
      }
    }
  } else if (base.activeProvider === 'resend') {
    const key = (getSetting('resend_api_key') || process.env.RESEND_API_KEY || '').trim();
    try {
      const r = await fetch('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${key}` }
      });
      if (r.status === 401 || r.status === 403) {
        connectionOk = false;
        connectionError = 'Resend API key was rejected (401/403 Unauthorized).';
      }
    } catch (err: any) {
      connectionOk = false;
      connectionError = `Resend connectivity check failed: ${err?.message || 'Network error'}`;
    }
  }

  cachedVerifyState = {
    fingerprint,
    checkedAt: now,
    connectionOk,
    connectionError
  };

  return { ...base, connectionOk, connectionError };
}

// Reset / Clear email configuration
export function resetEmailConfig() {
  db.prepare(`
    DELETE FROM app_settings 
    WHERE key IN ('gmail_user', 'gmail_pass', 'resend_api_key', 'brevo_api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass')
  `).run();
  cachedVerifyState = null;
  return getEmailConfigStatus();
}

// Save email configuration with live credential pre-check
export async function saveEmailConfig(config: {
  provider: 'resend' | 'gmail' | 'brevo' | 'smtp' | 'reset';
  resendApiKey?: string;
  brevoApiKey?: string;
  gmailUser?: string;
  gmailPass?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
}) {
  if (config.provider === 'reset') {
    return resetEmailConfig();
  }

  if (config.provider === 'gmail') {
    const user = (config.gmailUser || '').trim().toLowerCase();
    const pass = (config.gmailPass || '').trim().replace(/\s+/g, '');

    if (!user || !user.includes('@')) {
      throw new Error('Please enter a valid Gmail address.');
    }
    if (!pass) {
      throw new Error('Please enter your 16-character Google App Password.');
    }

    // Pre-flight verify credentials with Gmail SMTP
    const testTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    try {
      await testTransporter.verify();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('535') || msg.includes('Username and Password not accepted') || msg.includes('BadCredentials')) {
        throw new Error(
          'Gmail rejected the login (Error 535-5.7.8). You must use a 16-character Google App Password (not your personal Gmail account password). Visit myaccount.google.com/apppasswords to create one, or use Resend.'
        );
      }
      throw new Error(`Gmail authentication failed: ${err.message}`);
    }

    setSetting('gmail_user', user);
    setSetting('gmail_pass', pass);
  } else if (config.provider === 'resend') {
    const key = (config.resendApiKey || '').trim();
    if (!key) {
      throw new Error('Please enter your Resend API Key (starts with re_).');
    }

    // Pre-flight verify Resend Key
    try {
      const res = await fetch('https://api.resend.com/api-keys', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (!res.ok && res.status === 401) {
        throw new Error('Invalid Resend API Key. Please verify at resend.com.');
      }
    } catch (e: any) {
      if (e.message.includes('Invalid Resend')) throw e;
    }

    setSetting('resend_api_key', key);
  } else if (config.provider === 'brevo' && config.brevoApiKey) {
    setSetting('brevo_api_key', config.brevoApiKey.trim());
  } else if (config.provider === 'smtp') {
    if (config.smtpHost) setSetting('smtp_host', config.smtpHost.trim());
    if (config.smtpPort) setSetting('smtp_port', config.smtpPort.trim());
    if (config.smtpUser) setSetting('smtp_user', config.smtpUser.trim());
    if (config.smtpPass) setSetting('smtp_pass', config.smtpPass.trim());
  }

  const status = getEmailConfigStatus();
  cachedVerifyState = {
    fingerprint: getConfigFingerprint(),
    checkedAt: Date.now(),
    connectionOk: true,
    connectionError: null
  };
  return { ...status, connectionOk: true, connectionError: null };
}

// 1. Request 6-digit Email OTP
export async function requestEmailOtp(rawEmail: string, role: 'husband' | 'wife' = 'husband', baseUrl?: string) {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  // Bypass OTP verification completely for allowlisted email
  if (OTP_BYPASS_EMAILS.has(email)) {
    const existingInfo = buildExistingRegistrationCheck(email);
    return {
      success: true,
      bypassOtp: true,
      verified: true,
      email,
      role,
      expiresInSeconds: 0,
      cooldownSeconds: 0,
      emailSentReal: false,
      providerUsed: 'bypass',
      isAlreadyRegistered: existingInfo.isAlreadyRegistered,
      alreadyRegistered: existingInfo.alreadyRegistered,
      spouseName: existingInfo.spouseName,
      spouseRole: existingInfo.spouseRole,
      filedBySpouse: existingInfo.filedBySpouse,
      message: existingInfo.alreadyRegistered ? existingInfo.message : 'Verification bypassed — access granted.',
      registration: existingInfo.registration,
    };
  }

  const now = Date.now();
  const cooldownMs = 30 * 1000; // 30 seconds cooldown

  // Cooldown check
  const lastOtp = db.prepare(`
    SELECT * FROM email_otp_codes 
    WHERE email = ? 
    ORDER BY id DESC LIMIT 1
  `).get(email) as any;

  if (lastOtp && (now - lastOtp.created_at) < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - (now - lastOtp.created_at)) / 1000);
    throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new verification code.`);
  }

  // Generate 6-digit numeric OTP
  const otp = String(crypto.randomInt(100000, 999999));
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.createHash('sha256').update(otp + salt).digest('hex');
  const expiresAt = now + (10 * 60 * 1000); // 10 minutes

  // Insert into database
  db.prepare(`
    INSERT INTO email_otp_codes (email, role, otp_hash, salt, expires_at, attempts, verified, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
  `).run(email, role, otpHash, salt, expiresAt, now);

  // Check if email or spouse is already registered
  const existingRecord = db.prepare(`
    SELECT * FROM family_registrations 
    WHERE LOWER(husband_email) = ? OR LOWER(wife_email) = ?
    ORDER BY id DESC LIMIT 1
  `).get(email, email) as any;

  let isAlreadyRegistered = false;
  let spouseName = '';
  let spouseRole: 'husband' | 'wife' = 'husband';
  let filedBySpouse = false;

  if (existingRecord) {
    isAlreadyRegistered = true;
    const isHusbandEmail = existingRecord.husband_email.toLowerCase() === email;
    const isWifeEmail = existingRecord.wife_email.toLowerCase() === email;
    const submittedByRole = existingRecord.submitted_by_role;

    if (isWifeEmail && submittedByRole === 'husband') {
      filedBySpouse = true;
      spouseName = existingRecord.husband_name;
      spouseRole = 'husband';
    } else if (isHusbandEmail && submittedByRole === 'wife') {
      filedBySpouse = true;
      spouseName = existingRecord.wife_name;
      spouseRole = 'wife';
    } else {
      filedBySpouse = false;
      spouseName = submittedByRole === 'husband' ? existingRecord.wife_name : existingRecord.husband_name;
    }
  }

  // Attempt real email dispatch
  let emailSentReal = false;
  let providerUsed = '';
  let deliveryWarning = '';

  // 1. Try Resend
  const resendKey = getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  if (resendKey) {
    emailSentReal = await sendViaResend(resendKey, email, otp, baseUrl);
    if (emailSentReal) providerUsed = 'Resend';
  }

  // 2. Try Brevo
  if (!emailSentReal) {
    const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY;
    if (brevoKey) {
      emailSentReal = await sendViaBrevo(brevoKey, email, otp, baseUrl);
      if (emailSentReal) providerUsed = 'Brevo';
    }
  }

  // 3. Try Nodemailer / Gmail SMTP
  if (!emailSentReal) {
    const transporter = createTransporter();
    if (transporter) {
      try {
        const fromUser = (getSetting('gmail_user') || getSetting('smtp_user') || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@jsgroyals.org').trim().toLowerCase();
        const hasLocalLogo = fs.existsSync(ROYALS_LOGO_DISK_PATH);
        const info = await transporter.sendMail({
          from: `"JSG Royals" <${fromUser}>`,
          replyTo: fromUser,
          to: email,
          subject: 'Your JSG Royals verification code',
          text: generateRoyalEmailText(otp),
          html: generateRoyalEmailHtml(otp, hasLocalLogo),
          headers: {
            'X-Auto-Response-Suppress': 'All'
          },
          attachments: hasLocalLogo
            ? [
                {
                  filename: 'royals-logo.png',
                  path: ROYALS_LOGO_DISK_PATH,
                  cid: 'royals-logo',
                  contentDisposition: 'inline'
                }
              ]
            : undefined
        });
        emailSentReal = true;
        providerUsed = 'Gmail/SMTP';
        console.log(`[Email OTP] Sent via SMTP to ${email} (MessageId: ${info.messageId})`);
      } catch (mailErr: any) {
        const errMsg = mailErr?.message || '';
        if (errMsg.includes('535') || errMsg.includes('Username and Password not accepted') || errMsg.includes('BadCredentials')) {
          deliveryWarning = 'Gmail rejected login (535-5.7.8): You must use a 16-character App Password (not your standard Gmail password).';
        } else {
          deliveryWarning = `SMTP Error: ${errMsg}`;
        }
        console.warn(`[Email OTP] SMTP dispatch warning:`, deliveryWarning);
      }
    }
  }

  if (!emailSentReal) {
    const errorDetail = deliveryWarning
      ? deliveryWarning
      : 'Email gateway is not configured on the server. Please configure your 16-character Google App Password or Resend API key in the Admin Dashboard to dispatch verification emails.';
    throw new Error(errorDetail);
  }

  return {
    success: true,
    email,
    role,
    expiresInSeconds: 600,
    cooldownSeconds: 30,
    emailSentReal: true,
    providerUsed,
    isAlreadyRegistered,
    spouseName,
    spouseRole,
    filedBySpouse,
    message: `A 6-digit verification code has been dispatched to your email inbox at ${email}. Please check your inbox or spam folder.`
  };
}

// 2. Verify 6-digit Email OTP
export function verifyEmailOtp(rawEmail: string, rawOtp: string, role: 'husband' | 'wife' = 'husband') {
  const email = (rawEmail || '').trim().toLowerCase();
  const otp = (rawOtp || '').trim();

  if (!email) {
    throw new Error('Email address is required.');
  }

  if (OTP_BYPASS_EMAILS.has(email)) {
    const existingInfo = buildExistingRegistrationCheck(email);
    return {
      verified: true,
      email,
      role,
      alreadyRegistered: existingInfo.alreadyRegistered,
      filedBySpouse: existingInfo.filedBySpouse,
      spouseName: existingInfo.spouseName,
      spouseRole: existingInfo.spouseRole,
      message: existingInfo.message,
      registration: existingInfo.registration,
    };
  }

  if (!otp) {
    throw new Error('Email address and 6-digit verification code are required.');
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error('Verification code must be exactly 6 numeric digits.');
  }

  const now = Date.now();

  // Find latest active OTP record
  const record = db.prepare(`
    SELECT * FROM email_otp_codes 
    WHERE email = ? AND verified = 0 
    ORDER BY id DESC LIMIT 1
  `).get(email) as any;

  if (!record) {
    throw new Error('No active verification code found for this email. Please request a new code.');
  }

  if (record.attempts >= 5) {
    throw new Error('Too many incorrect attempts. Please request a new verification code.');
  }

  if (now > record.expires_at) {
    throw new Error('This verification code has expired. Please request a new code.');
  }

  // Hash submitted OTP with stored salt
  const computedHash = crypto.createHash('sha256').update(otp + record.salt).digest('hex');

  if (computedHash !== record.otp_hash) {
    db.prepare('UPDATE email_otp_codes SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    const attemptsLeft = 5 - (record.attempts + 1);
    throw new Error(`Incorrect verification code. ${attemptsLeft} attempts remaining.`);
  }

  // Mark as verified
  db.prepare('UPDATE email_otp_codes SET verified = 1 WHERE id = ?').run(record.id);

  const existingInfo = buildExistingRegistrationCheck(email);
  return {
    verified: true,
    email,
    role: record.role,
    alreadyRegistered: existingInfo.alreadyRegistered,
    filedBySpouse: existingInfo.filedBySpouse,
    spouseName: existingInfo.spouseName,
    spouseRole: existingInfo.spouseRole,
    message: existingInfo.message,
    registration: existingInfo.registration,
  };
}

// 3. Send live test verification email from Admin Dashboard
export async function sendTestEmail(toEmail: string, baseUrl?: string) {
  const email = (toEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const otp = String(crypto.randomInt(100000, 999999));

  // 1. Try Resend
  const resendKey = getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  if (resendKey) {
    const ok = await sendViaResend(resendKey, email, otp, baseUrl);
    if (ok) return { success: true, provider: 'Resend', message: `Live test email successfully dispatched to ${email} via Resend!` };
  }

  // 2. Try Brevo
  const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY;
  if (brevoKey) {
    const ok = await sendViaBrevo(brevoKey, email, otp, baseUrl);
    if (ok) return { success: true, provider: 'Brevo', message: `Live test email successfully dispatched to ${email} via Brevo!` };
  }

  // 3. Try Gmail / SMTP
  const transporter = createTransporter();
  if (transporter) {
    try {
      const fromUser = (getSetting('gmail_user') || getSetting('smtp_user') || process.env.GMAIL_USER || process.env.SMTP_USER || 'no-reply@jsgroyals.org').trim().toLowerCase();
      const hasLocalLogo = fs.existsSync(ROYALS_LOGO_DISK_PATH);
      const info = await transporter.sendMail({
        from: `"JSG Royals" <${fromUser}>`,
        replyTo: fromUser,
        to: email,
        subject: 'JSG Royals email delivery test',
        text: generateRoyalEmailText(otp),
        html: generateRoyalEmailHtml(otp, hasLocalLogo),
        headers: {
          'X-Auto-Response-Suppress': 'All'
        },
        attachments: hasLocalLogo
          ? [
              {
                filename: 'royals-logo.png',
                path: ROYALS_LOGO_DISK_PATH,
                cid: 'royals-logo',
                contentDisposition: 'inline'
              }
            ]
          : undefined
      });
      return { success: true, provider: 'Gmail/SMTP', message: `Live test email successfully dispatched to ${email}! (Message ID: ${info.messageId})` };
    } catch (mailErr: any) {
      const errMsg = mailErr?.message || '';
      if (errMsg.includes('535') || errMsg.includes('Username and Password not accepted') || errMsg.includes('BadCredentials')) {
        throw new Error('Gmail rejected login (535-5.7.8): You must use a 16-character Google App Password (myaccount.google.com/apppasswords), not your personal account password.');
      }
      throw new Error(`SMTP Error: ${errMsg}`);
    }
  }

  throw new Error('Email gateway is not configured on the server. Please enter your 16-character Google App Password or Resend API key.');
}
