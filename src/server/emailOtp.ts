import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db, getSetting, setSetting } from '../db/database.ts';

// Helper to generate luxury royal HTML email template
function generateRoyalEmailHtml(otp: string) {
  return `
    <div style="font-family: 'Georgia', serif; max-width: 580px; margin: 0 auto; background: #FAF6EF; border: 2px solid #C5A869; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #1C1917 0%, #2A2623 100%); padding: 28px; text-align: center; border-bottom: 2px solid #D4AF37;">
        <div style="font-size: 32px; color: #D4AF37; margin-bottom: 6px;">👑</div>
        <h1 style="color: #FAF7F2; margin: 0; font-size: 22px; letter-spacing: 1.5px; text-transform: uppercase;">JSG Royals Year 2</h1>
        <p style="color: #C5A869; margin: 6px 0 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Unified Royal Family Registry</p>
      </div>
      <div style="padding: 32px 28px; text-align: center; color: #1C1917;">
        <p style="font-size: 15px; color: #57534E; margin-top: 0; line-height: 1.6;">Welcome to the official JSG Royals Member Portal.<br/>Please use the following 6-digit verification code to confirm your email:</p>
        
        <div style="background: #FFFFFF; border: 2px dashed #C5A869; border-radius: 16px; padding: 20px 28px; margin: 24px auto; display: inline-block; box-shadow: 0 4px 12px rgba(197, 168, 105, 0.15);">
          <span style="font-family: 'Courier New', monospace; font-size: 40px; font-weight: bold; letter-spacing: 10px; color: #8C6D2B;">${otp}</span>
        </div>
        
        <p style="font-size: 13px; color: #78716C; margin-bottom: 6px;">This royal verification code is valid for <strong>10 minutes</strong>.</p>
        <p style="font-size: 11px; color: #A8A29E; margin-top: 0;">If you did not request this code, you can safely ignore this message.</p>
      </div>
      <div style="background: #F1ECE1; padding: 16px; text-align: center; font-size: 11px; color: #78716C; border-top: 1px solid #E2D5BE;">
        JSG Royals • Official Directory &amp; Heritage Dossier • Confidential
      </div>
    </div>
  `;
}

// 1. Resend API Dispatcher (Uses HTTPS Port 443 — 100% reliable on Cloud Run)
async function sendViaResend(apiKey: string, toEmail: string, otp: string): Promise<boolean> {
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
        subject: `👑 JSG Royals Verification Code: ${otp}`,
        html: generateRoyalEmailHtml(otp)
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
async function sendViaBrevo(apiKey: string, toEmail: string, otp: string): Promise<boolean> {
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
        subject: `👑 JSG Royals Verification Code: ${otp}`,
        htmlContent: generateRoyalEmailHtml(otp)
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
  const host = getSetting('smtp_host') || process.env.SMTP_HOST;
  const user = getSetting('gmail_user') || getSetting('smtp_user') || process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = getSetting('gmail_pass') || getSetting('smtp_pass') || process.env.GMAIL_APP_PASS || process.env.SMTP_PASS;
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
  if (user && pass && user.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: pass.replace(/\s+/g, '') }
    });
  }

  return null;
}

// Get active email service configuration status
export function getEmailConfigStatus() {
  const resendKey = getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY;
  const gmailUser = getSetting('gmail_user') || process.env.GMAIL_USER;
  const gmailPass = getSetting('gmail_pass') || process.env.GMAIL_APP_PASS;
  const smtpHost = getSetting('smtp_host') || process.env.SMTP_HOST;
  const smtpUser = getSetting('smtp_user') || process.env.SMTP_USER;

  let activeProvider: 'resend' | 'brevo' | 'gmail' | 'smtp' | 'demo' = 'demo';
  let senderEmail = '';

  if (resendKey) {
    activeProvider = 'resend';
    senderEmail = 'Resend API (Cloud HTTPS)';
  } else if (brevoKey) {
    activeProvider = 'brevo';
    senderEmail = 'Brevo Transactional API';
  } else if (gmailUser && gmailPass) {
    activeProvider = 'gmail';
    senderEmail = gmailUser;
  } else if (smtpHost && smtpUser) {
    activeProvider = 'smtp';
    senderEmail = `${smtpUser}@${smtpHost}`;
  }

  return {
    isConfigured: activeProvider !== 'demo',
    activeProvider,
    senderEmail,
    mode: activeProvider !== 'demo' ? 'live' : 'demo'
  };
}

// Reset / Clear email configuration
export function resetEmailConfig() {
  db.prepare(`
    DELETE FROM app_settings 
    WHERE key IN ('gmail_user', 'gmail_pass', 'resend_api_key', 'brevo_api_key', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass')
  `).run();
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

  return getEmailConfigStatus();
}

// 1. Request 6-digit Email OTP
export async function requestEmailOtp(rawEmail: string, role: 'husband' | 'wife' = 'husband') {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
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
    emailSentReal = await sendViaResend(resendKey, email, otp);
    if (emailSentReal) providerUsed = 'Resend';
  }

  // 2. Try Brevo
  if (!emailSentReal) {
    const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY;
    if (brevoKey) {
      emailSentReal = await sendViaBrevo(brevoKey, email, otp);
      if (emailSentReal) providerUsed = 'Brevo';
    }
  }

  // 3. Try Nodemailer / Gmail SMTP
  if (!emailSentReal) {
    const transporter = createTransporter();
    if (transporter) {
      try {
        const fromUser = getSetting('gmail_user') || process.env.GMAIL_USER || 'no-reply@jsgroyals.org';
        const info = await transporter.sendMail({
          from: `"JSG Royals" <${fromUser}>`,
          to: email,
          subject: `👑 JSG Royals Verification Code: ${otp}`,
          html: generateRoyalEmailHtml(otp)
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
export function verifyEmailOtp(rawEmail: string, rawOtp: string) {
  const email = (rawEmail || '').trim().toLowerCase();
  const otp = (rawOtp || '').trim();

  if (!email || !otp) {
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

  // Check if family dossier is already registered
  const existingRecord = db.prepare(`
    SELECT * FROM family_registrations 
    WHERE LOWER(husband_email) = ? OR LOWER(wife_email) = ?
    ORDER BY id DESC LIMIT 1
  `).get(email, email) as any;

  if (existingRecord) {
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
      verified: true,
      email,
      role: record.role,
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

  return {
    verified: true,
    email,
    role: record.role,
    alreadyRegistered: false,
    message: 'Email address verified successfully!'
  };
}

// 3. Send live test verification email from Admin Dashboard
export async function sendTestEmail(toEmail: string) {
  const email = (toEmail || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const otp = String(crypto.randomInt(100000, 999999));

  // 1. Try Resend
  const resendKey = getSetting('resend_api_key') || process.env.RESEND_API_KEY;
  if (resendKey) {
    const ok = await sendViaResend(resendKey, email, otp);
    if (ok) return { success: true, provider: 'Resend', message: `Live test email successfully dispatched to ${email} via Resend!` };
  }

  // 2. Try Brevo
  const brevoKey = getSetting('brevo_api_key') || process.env.BREVO_API_KEY;
  if (brevoKey) {
    const ok = await sendViaBrevo(brevoKey, email, otp);
    if (ok) return { success: true, provider: 'Brevo', message: `Live test email successfully dispatched to ${email} via Brevo!` };
  }

  // 3. Try Gmail / SMTP
  const transporter = createTransporter();
  if (transporter) {
    try {
      const fromUser = getSetting('gmail_user') || process.env.GMAIL_USER || 'no-reply@jsgroyals.org';
      const info = await transporter.sendMail({
        from: `"JSG Royals" <${fromUser}>`,
        to: email,
        subject: `👑 JSG Royals Live Gateway Test: ${otp}`,
        html: generateRoyalEmailHtml(otp)
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
