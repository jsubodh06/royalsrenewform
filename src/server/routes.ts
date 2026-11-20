import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import {
  db,
  logAdminAudit,
  seed3FictionalTestMembers,
  validateAndImportYear1Members,
  getMembersImportStatus,
  setSetting,
  getSetting,
} from '../db/database.ts';
import {
  requestOtp,
  verifyOtp,
  verifyFirebaseSession,
  verifyAnniversaryOrDob,
  signAdminToken,
  requireMember,
  requireAdmin,
  AuthenticatedRequest,
} from './auth.ts';
import {
  isFast2SmsConfigured,
  getFast2SmsApiKey,
  checkFast2SmsWallet,
} from './sms.ts';
import { requestEmailOtp, verifyEmailOtp, getEmailConfigStatus, getVerifiedEmailConfigStatus, saveEmailConfig, resetEmailConfig, sendTestEmail } from './emailOtp.ts';
import {
  buildRegistrationMatchSummary,
  collectHouseholdEmails,
  computeVaultIdForEmail,
  decryptVaultForEmail,
  encryptRegistrationForVaults,
  rehydrateLocalRegistrationCache,
  verifyFamilyLookupToken,
} from './memberVault.ts';

export const apiRouter = Router();

// Private Photo Storage Setup
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const photosBaseDir = isVercel
  ? path.resolve('/tmp', 'data', 'year2-photos')
  : path.resolve(process.cwd(), 'data', 'year2-photos');
if (!fs.existsSync(photosBaseDir)) {
  fs.mkdirSync(photosBaseDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB maximum
  },
});

function handlePhotoUploadMiddleware(req: any, res: any, next: any) {
  upload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File too large')) {
        return res.status(400).json({ error: 'Photo exceeds maximum allowed size of 25 MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    next();
  });
}

function validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string; ext?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }

  if (buffer.length < 12) {
    return { valid: false, error: 'File is corrupted or too small to be a valid image.' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedMime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, detectedMime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, detectedMime: 'image/webp', ext: 'webp' };
  }

  return {
    valid: false,
    error: 'Unsupported or corrupted file format. Only genuine JPG, PNG, and WebP images are accepted.'
  };
}

// ==========================================
// 1. PUBLIC AUTHENTICATION ENDPOINTS
// ==========================================

// Request OTP for registered mobile
apiRouter.post('/auth/request-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }
    const result = await requestOtp(mobile);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to process OTP request.' });
  }
});

// Verify OTP and generate session
apiRouter.post('/auth/verify-otp', (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ error: 'Mobile number and OTP are required.' });
    }
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const result = verifyOtp(mobile, otp, clientIp);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'OTP verification failed.' });
  }
});

// Verify Firebase Phone Auth and generate session
apiRouter.post('/auth/firebase-verify-session', (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'Verified mobile number is required.' });
    }
    const result = verifyFirebaseSession(mobile);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Firebase phone verification failed.' });
  }
});

// Challenge-Response verification via Marriage Anniversary / Birthday (Zero SMS / No Credit Card required)
apiRouter.post('/auth/verify-secret', (req, res) => {
  try {
    const { mobile, dateInput } = req.body;
    if (!mobile || !dateInput) {
      return res.status(400).json({ error: 'Registered mobile number and Anniversary / Birthday date are required.' });
    }
    const result = verifyAnniversaryOrDob(mobile, dateInput);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Verification failed.' });
  }
});

// Admin Login
apiRouter.post('/auth/admin-login', (req, res) => {
  try {
    const { email } = req.body;
    const password = req.body.password || req.body.pin;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password/PIN are required.' });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email.trim().toLowerCase()) as any;
    if (!admin) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    // Verify password/PIN
    if (admin.password_hash !== password.trim()) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const token = signAdminToken({ email: admin.email, role: admin.role as 'super_admin' | 'admin' });
    logAdminAudit(admin.email, 'Admin login', undefined, `Logged in successfully as ${admin.role}`);

    res.json({
      token,
      admin: {
        email: admin.email,
        role: admin.role,
      },
      user: {
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error during admin login.' });
  }
});

// Cache for Google Firebase SecureToken x509 public keys
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to retrieve Google public keys for Firebase verification.');
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cc = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  cachedGoogleCerts = { certs, expiresAt: now + Math.max(60_000, ttlMs) };
  return certs;
}

// Admin Google (Firebase ID Token) Login
apiRouter.post('/auth/admin-firebase-login', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required.' });
    }

    const decodedComplete = jwt.decode(idToken, { complete: true }) as any;
    const kid = decodedComplete?.header?.kid;
    if (!kid) {
      return res.status(401).json({ error: 'Invalid Firebase ID token header.' });
    }

    const certs = await getFirebasePublicCerts();
    const cert = certs[kid];
    if (!cert) {
      return res.status(401).json({ error: 'Unrecognized Firebase signing key.' });
    }

    const firebaseProjectId = 'jsgroyals-cb75f';
    const verified = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: firebaseProjectId,
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
    }) as any;

    const tokenEmail = String(verified?.email || '').trim().toLowerCase();
    if (!verified?.email_verified || !tokenEmail) {
      return res.status(403).json({ error: 'Verified Google email address is required.' });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE LOWER(email) = ?').get(tokenEmail) as any;
    const isBootstrappedAdmin = tokenEmail === 'subodhjain2007777@gmail.com';
    if (!admin && !isBootstrappedAdmin) {
      return res.status(403).json({
        error: `Google account (${tokenEmail}) is not authorized as Committee Admin. Please sign in with subodhjain2007777@gmail.com.`,
      });
    }

    const role = (admin?.role || 'super_admin') as 'super_admin' | 'admin';
    const adminEmail = admin?.email || tokenEmail;
    const token = signAdminToken({ email: adminEmail, role });
    logAdminAudit(adminEmail, 'Admin Google login', undefined, `Verified via Google Firebase Auth as ${role}`);

    res.json({
      token,
      admin: {
        email: adminEmail,
        role,
      },
      user: {
        email: adminEmail,
        role,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Google authentication verification failed.' });
  }
});

// Dev/Test helper: returns sample couple credentials for testing (ONLY 3 fictional test members in Step 2)
apiRouter.get('/test/sample-accounts', (req, res) => {
  try {
    const samples = db.prepare(`
      SELECT 
        couple_id, husband_name, wife_name, 
        husband_registered_mobile, wife_registered_mobile, 
        marriage_anniversary
      FROM members 
      WHERE couple_id IN ('JR001', 'JR002', 'JR003')
      ORDER BY couple_id ASC
    `).all();

    res.json({
      testMode: true,
      fixedTestOtp: '123456',
      adminDefaultEmail: 'subodhjain2007777@gmail.com',
      adminDefaultPin: 'rroyals2027',
      samples
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve test samples.' });
  }
});

// Dev/Test helper: Reset test drafts and submissions
apiRouter.post('/test/reset-database', (req, res) => {
  try {
    const memberCount = (db.prepare('SELECT COUNT(*) as count FROM members').get() as any).count;
    if (memberCount === 110) {
      db.exec(`
        DELETE FROM year2_profiles;
        DELETE FROM year2_preferences;
        DELETE FROM submissions;
        DELETE FROM correction_requests;
        DELETE FROM photos;
        DELETE FROM otp_codes;
      `);
      res.json({
        success: true,
        message: 'Test activity (drafts, submissions, photos) reset successfully while preserving 110 real Year-1 members.'
      });
    } else {
      seed3FictionalTestMembers(true);
      res.json({
        success: true,
        message: 'Test database reset successfully.'
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset test database.' });
  }
});

// ==========================================
// 2. MEMBER PROTECTED ENDPOINTS
// ==========================================

// Fetch current verified member profile (Year 1 read-only, Year 2 draft/submission)
apiRouter.get('/member/me', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;

    // Year-1 Member record (STRICT Step 2 schema: NO Aadhaar or government IDs)
    const member = db.prepare(`
      SELECT 
        couple_id, husband_name, wife_name,
        husband_registered_mobile, wife_registered_mobile,
        husband_dob, wife_dob, marriage_anniversary,
        kids, year1_status,
        year1_profile_data,
        active_status, created_at, updated_at
      FROM members 
      WHERE couple_id = ?
    `).get(coupleId) as any;

    if (!member) {
      return res.status(404).json({ error: 'Member profile not found.' });
    }

    // Parse Year-1 profile data (fictional children, city, business)
    let parsedYear1Data: any = {};
    try {
      parsedYear1Data = member.year1_profile_data ? JSON.parse(member.year1_profile_data) : {};
    } catch (e) {
      parsedYear1Data = {};
    }

    // Check submission status
    const submission = db.prepare('SELECT * FROM submissions WHERE couple_id = ?').get(coupleId) as any;

    // Fetch existing Year 2 profile
    const year2Profile = db.prepare('SELECT * FROM year2_profiles WHERE couple_id = ?').get(coupleId) as any;

    // Fetch existing Year 2 preferences
    const year2Preferences = db.prepare('SELECT * FROM year2_preferences WHERE couple_id = ?').get(coupleId) as any;

    // Fetch correction requests for THIS couple only
    const corrections = db.prepare(`
      SELECT id, couple_id, requested_correction, member_message, status, admin_notes, created_at, resolved_at 
      FROM correction_requests 
      WHERE couple_id = ? 
      ORDER BY id DESC
    `).all(coupleId);

    // Parse preferences
    let parsedWishlist: string[] = [];
    try {
      parsedWishlist = year2Preferences?.wishlist ? JSON.parse(year2Preferences.wishlist) : [];
    } catch (e) {
      parsedWishlist = [];
    }

    let parsedContributions: string[] = [];
    try {
      parsedContributions = year2Preferences?.contribution_areas ? JSON.parse(year2Preferences.contribution_areas) : [];
    } catch (e) {
      parsedContributions = [];
    }

    let parsedIdentityKnownFor: string[] = [];
    try {
      parsedIdentityKnownFor = year2Preferences?.identity_known_for ? JSON.parse(year2Preferences.identity_known_for) : [];
    } catch (e) {
      parsedIdentityKnownFor = [];
    }

    // Check if couple has an uploaded photo
    const currentPhoto = db.prepare('SELECT id, filename, mime_type, size_bytes, storage_path FROM photos WHERE couple_id = ? ORDER BY created_at DESC LIMIT 1').get(coupleId) as any;
    const hasPhoto = !!currentPhoto;

    // Determine if incomplete draft exists
    const hasEnteredData = !!(
      (year2Profile && (year2Profile.current_city || year2Profile.residential_address || year2Profile.occupation_status || year2Profile.family_status || year2Profile.photo_id)) ||
      (year2Preferences && (parsedWishlist.length > 0 || parsedContributions.length > 0 || year2Preferences.royal_idea)) ||
      hasPhoto
    );
    const hasDraft = !submission && hasEnteredData;

    res.json({
      session: {
        ...req.member,
        husbandName: member.husband_name || '',
        wifeName: member.wife_name || '',
      },
      year1: {
        ...member,
        children_info: member.kids || parsedYear1Data.kids || parsedYear1Data.children || 'Recorded in Registry',
        year1_city: parsedYear1Data.city || 'Indore',
        year1_business: parsedYear1Data.business || 'Recorded in Ledger',
        parsedData: parsedYear1Data,
      },
      isSubmitted: !!submission,
      hasDraft,
      submission: submission || null,
      year2Profile: year2Profile ? {
        ...year2Profile,
        city: year2Profile.current_city || member.year1_city || 'Indore',
        current_city: year2Profile.current_city || member.year1_city || 'Indore',
        last_step: year2Profile.last_step || 1
      } : null,
      year2Preferences: year2Preferences ? {
        ...year2Preferences,
        wishlist: parsedWishlist,
        contribution_areas: parsedContributions,
        identity_known_for: parsedIdentityKnownFor
      } : null,
      photo: currentPhoto ? {
        id: currentPhoto.id,
        filename: currentPhoto.filename,
        mimeType: currentPhoto.mime_type,
        sizeBytes: currentPhoto.size_bytes,
        url: `/api/member/photo/${currentPhoto.id}`
      } : null,
      corrections: corrections || [],
      year1Confirmed: !!year2Profile
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load member profile.' });
  }
});

// Confirm Year-1 Profile ("YES, EVERYTHING IS CORRECT")
apiRouter.post('/member/confirm-year1', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;
    const now = new Date().toISOString();

    // Record review in year2_profiles placeholder
    const existing = db.prepare('SELECT id FROM year2_profiles WHERE couple_id = ?').get(coupleId);
    if (!existing) {
      db.prepare(`
        INSERT INTO year2_profiles (couple_id, created_at, updated_at)
        VALUES (?, ?, ?)
      `).run(coupleId, now, now);
    } else {
      db.prepare('UPDATE year2_profiles SET updated_at = ? WHERE couple_id = ?').run(now, coupleId);
    }

    res.json({
      success: true,
      message: 'Year-1 information confirmed and recorded as reviewed.',
      confirmedAt: now
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record Year-1 confirmation.' });
  }
});

// Guard against direct API modification of protected identity fields
apiRouter.post('/member/update-identity', requireMember, (req: AuthenticatedRequest, res) => {
  return res.status(403).json({
    error: 'Protected Year-1 identity fields cannot be modified directly. Please submit a correction request instead.'
  });
});
apiRouter.put('/member/profile', requireMember, (req: AuthenticatedRequest, res) => {
  return res.status(403).json({
    error: 'Protected Year-1 identity fields cannot be modified directly. Please submit a correction request instead.'
  });
});

// Member correction requests (Member can ONLY access their own)
apiRouter.get('/member/corrections', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const sessionCoupleId = req.member!.coupleId;
    const requestedCoupleId = (req.query.couple_id as string) || sessionCoupleId;

    // Security Test 9: Member cannot access another couple's correction requests
    if (requestedCoupleId !== sessionCoupleId) {
      return res.status(403).json({
        error: 'Forbidden: You cannot access correction requests for another couple.'
      });
    }

    const corrections = db.prepare(`
      SELECT id, couple_id, requested_correction, member_message, status, admin_notes, created_at, resolved_at 
      FROM correction_requests 
      WHERE couple_id = ? 
      ORDER BY id DESC
    `).all(sessionCoupleId);

    res.json({ corrections });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch correction requests.' });
  }
});

// Save Incomplete Progress / Draft Updates
apiRouter.post('/member/save-draft', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;

    // Check if already submitted
    const existingSubmission = db.prepare('SELECT id FROM submissions WHERE couple_id = ?').get(coupleId);
    if (existingSubmission) {
      return res.status(403).json({ error: 'Your Chapter-2 membership update has already been submitted and is locked.' });
    }

    const { profile, preferences } = req.body;
    const now = new Date().toISOString();

    const updateTx = db.transaction(() => {
      // 1. Upsert Year 2 Profile
      if (profile) {
        const existingProfile = db.prepare('SELECT id FROM year2_profiles WHERE couple_id = ?').get(coupleId);
        const cityVal = profile.current_city || profile.city || null;
        const resAddressVal = profile.residential_address || null;
        const occStatusVal = profile.occupation_status || null;
        const occDetailsVal = profile.occupation_details || null;
        const occUpdateVal = profile.occupation_update || (occStatusVal ? `${occStatusVal}${occDetailsVal ? ': ' + occDetailsVal : ''}` : profile.occupation_business_update || null);
        const orgVal = profile.organization_update || profile.organization_firm_name || null;
        const famStatusVal = profile.family_status || null;
        const famDetailsVal = profile.family_details || null;
        const famUpdateVal = profile.family_update || (famStatusVal ? `${famStatusVal}${famDetailsVal ? ': ' + famDetailsVal : ''}` : profile.family_children_updates || null);
        const photoUrlVal = profile.family_photo_url || null;
        const lastStepVal = profile.last_step ? Number(profile.last_step) : 1;

        if (existingProfile) {
          db.prepare(`
            UPDATE year2_profiles SET
              current_city = ?,
              residential_address = ?,
              occupation_status = ?,
              occupation_details = ?,
              occupation_update = ?,
              organization_update = ?,
              family_status = ?,
              family_details = ?,
              family_update = ?,
              family_photo_url = ?,
              last_step = ?,
              updated_at = ?
            WHERE couple_id = ?
          `).run(
            cityVal,
            resAddressVal,
            occStatusVal,
            occDetailsVal,
            occUpdateVal,
            orgVal,
            famStatusVal,
            famDetailsVal,
            famUpdateVal,
            photoUrlVal,
            lastStepVal,
            now,
            coupleId
          );
        } else {
          db.prepare(`
            INSERT INTO year2_profiles (
              couple_id, current_city, residential_address,
              occupation_status, occupation_details, occupation_update, organization_update,
              family_status, family_details, family_update, family_photo_url,
              last_step, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            coupleId,
            cityVal,
            resAddressVal,
            occStatusVal,
            occDetailsVal,
            occUpdateVal,
            orgVal,
            famStatusVal,
            famDetailsVal,
            famUpdateVal,
            photoUrlVal,
            lastStepVal,
            now,
            now
          );
        }
      }

      // 2. Upsert Year 2 Preferences
      if (preferences) {
        const existingPref = db.prepare('SELECT id FROM year2_preferences WHERE couple_id = ?').get(coupleId);
        const wishlistJson = preferences.wishlist ? JSON.stringify(preferences.wishlist) : JSON.stringify([]);
        const wishlistOther = preferences.wishlist_other || null;
        const dreamExp = preferences.dream_experience || null;
        const contributionJson = preferences.contribution_areas ? JSON.stringify(preferences.contribution_areas) : JSON.stringify([]);
        const contribOther = preferences.contribution_other || null;
        const contribHelp = preferences.contribution_help_text || null;
        const royalIdea = preferences.royal_idea || null;
        const identityKnownForJson = preferences.identity_known_for ? JSON.stringify(preferences.identity_known_for) : null;
        const identityStmt = preferences.identity_statement || preferences.jsg_royals_identity || null;
        const jsgShouldBeKnown = identityStmt || (identityKnownForJson ? identityKnownForJson : preferences.jsg_should_be_known_for || null);

        if (existingPref) {
          db.prepare(`
            UPDATE year2_preferences SET
              wishlist = ?,
              wishlist_other = ?,
              dream_experience = ?,
              contribution_areas = ?,
              contribution_other = ?,
              contribution_help_text = ?,
              royal_idea = ?,
              identity_known_for = ?,
              identity_statement = ?,
              jsg_should_be_known_for = ?,
              updated_at = ?
            WHERE couple_id = ?
          `).run(
            wishlistJson,
            wishlistOther,
            dreamExp,
            contributionJson,
            contribOther,
            contribHelp,
            royalIdea,
            identityKnownForJson,
            identityStmt,
            jsgShouldBeKnown,
            now,
            coupleId
          );
        } else {
          db.prepare(`
            INSERT INTO year2_preferences (
              couple_id, wishlist, wishlist_other, dream_experience,
              contribution_areas, contribution_other, contribution_help_text,
              royal_idea, identity_known_for, identity_statement, jsg_should_be_known_for,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            coupleId,
            wishlistJson,
            wishlistOther,
            dreamExp,
            contributionJson,
            contribOther,
            contribHelp,
            royalIdea,
            identityKnownForJson,
            identityStmt,
            jsgShouldBeKnown,
            now,
            now
          );
        }
      }
    });

    updateTx();
    res.json({ success: true, message: 'Draft saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save draft progress.' });
  }
});

// Reset / Start Over Year-2 Draft
apiRouter.post('/member/reset-draft', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;

    const existingSubmission = db.prepare('SELECT id FROM submissions WHERE couple_id = ?').get(coupleId);
    if (existingSubmission) {
      return res.status(403).json({ error: 'Your Chapter-2 update has already been submitted and cannot be reset.' });
    }

    // Clean up photo on disk if present
    const coupleDir = path.resolve(photosBaseDir, coupleId);
    const existingPhotos = db.prepare('SELECT id, storage_path FROM photos WHERE couple_id = ?').all(coupleId) as any[];
    for (const p of existingPhotos) {
      if (p.storage_path) {
        const filePath = path.resolve(process.cwd(), p.storage_path);
        if (filePath.startsWith(coupleDir) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // ignore
          }
        }
      }
    }
    db.prepare('DELETE FROM photos WHERE couple_id = ?').run(coupleId);

    db.prepare('DELETE FROM year2_profiles WHERE couple_id = ?').run(coupleId);
    db.prepare('DELETE FROM year2_preferences WHERE couple_id = ?').run(coupleId);

    res.json({ success: true, message: 'Draft cleared successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset draft.' });
  }
});

// Upload Family/Couple Photo (Private Storage - Supports Multipart & Base64)
const uploadPhotoHandler = (req: AuthenticatedRequest, res: Response) => {
  try {
    const coupleId = req.member!.coupleId;

    // Validate coupleId format
    if (!coupleId || !/^JR\d{3}$/.test(coupleId)) {
      return res.status(400).json({ error: 'Invalid couple ID format.' });
    }

    // Check if already submitted
    const existingSubmission = db.prepare('SELECT id FROM submissions WHERE couple_id = ?').get(coupleId);
    if (existingSubmission) {
      return res.status(403).json({ error: 'Your submission is already final.' });
    }

    let buffer: Buffer | null = null;
    let originalFilename = 'family_photo.jpg';

    if (req.file) {
      buffer = req.file.buffer;
      originalFilename = req.file.originalname || 'family_photo.jpg';
    } else if (req.body && req.body.base64Data) {
      const cleanBase64 = req.body.base64Data.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
      originalFilename = req.body.filename || 'family_photo.jpg';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'No photo uploaded or file is empty (0 bytes).' });
    }

    // Maximum file size: 10 MB
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Photo exceeds maximum allowed size of 10 MB.' });
    }

    // Backend magic-byte validation
    const magicResult = validateImageMagicBytes(buffer);
    if (!magicResult.valid) {
      return res.status(400).json({ error: magicResult.error });
    }

    const detectedMime = magicResult.detectedMime!;
    const ext = magicResult.ext!;

    // Resolve private storage directory for this couple
    const coupleDir = path.resolve(photosBaseDir, coupleId);
    if (!coupleDir.startsWith(photosBaseDir)) {
      return res.status(403).json({ error: 'Invalid storage directory path.' });
    }
    if (!fs.existsSync(coupleDir)) {
      fs.mkdirSync(coupleDir, { recursive: true });
    }

    // Clean up previous draft photo from disk and database for this couple
    const prevPhotos = db.prepare('SELECT id, storage_path FROM photos WHERE couple_id = ?').all(coupleId) as any[];
    for (const p of prevPhotos) {
      if (p.storage_path) {
        const prevFile = path.resolve(process.cwd(), p.storage_path);
        if (prevFile.startsWith(coupleDir) && fs.existsSync(prevFile)) {
          try {
            fs.unlinkSync(prevFile);
          } catch (e) {
            // ignore
          }
        }
      }
    }
    db.prepare('DELETE FROM photos WHERE couple_id = ?').run(coupleId);

    // Generate secure randomized filename
    const photoUuid = crypto.randomUUID();
    const secureFileName = `${photoUuid}.${ext}`;
    const destinationPath = path.resolve(coupleDir, secureFileName);

    if (!destinationPath.startsWith(coupleDir)) {
      return res.status(403).json({ error: 'Directory traversal detected.' });
    }

    // Save binary strictly to private disk location (not inside DB)
    fs.writeFileSync(destinationPath, buffer);

    const relativeStoragePath = path.relative(process.cwd(), destinationPath);
    const photoId = `photo_${coupleId}_${photoUuid.substring(0, 8)}`;
    const now = new Date().toISOString();
    const sanitizedOriginalName = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');

    // Store metadata only in photos table
    db.prepare(`
      INSERT INTO photos (id, couple_id, filename, storage_path, mime_type, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      photoId,
      coupleId,
      sanitizedOriginalName,
      relativeStoragePath,
      detectedMime,
      buffer.length,
      now
    );

    // Update reference in year2_profiles
    const existingProfile = db.prepare('SELECT id FROM year2_profiles WHERE couple_id = ?').get(coupleId);
    if (existingProfile) {
      db.prepare(`
        UPDATE year2_profiles SET 
          photo_id = ?, 
          photo_filename = ?, 
          photo_mime = ?, 
          photo_size = ?,
          family_photo_path = ?,
          family_photo_url = ?,
          updated_at = ?
        WHERE couple_id = ?
      `).run(
        photoId,
        sanitizedOriginalName,
        detectedMime,
        buffer.length,
        relativeStoragePath,
        `/api/member/photo/${photoId}`,
        now,
        coupleId
      );
    } else {
      db.prepare(`
        INSERT INTO year2_profiles (
          couple_id, photo_id, photo_filename, photo_mime, photo_size, family_photo_path, family_photo_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        coupleId,
        photoId,
        sanitizedOriginalName,
        detectedMime,
        buffer.length,
        relativeStoragePath,
        `/api/member/photo/${photoId}`,
        now,
        now
      );
    }

    res.json({
      success: true,
      photoId,
      filename: sanitizedOriginalName,
      mimeType: detectedMime,
      sizeBytes: buffer.length,
      url: `/api/member/photo/${photoId}`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
};

apiRouter.post('/member/upload-photo', requireMember, handlePhotoUploadMiddleware, uploadPhotoHandler);
apiRouter.post('/member/photo/upload', requireMember, handlePhotoUploadMiddleware, uploadPhotoHandler);

// Delete Member Photo
apiRouter.delete('/member/photo', requireMember, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coupleId = req.member!.coupleId;

    const existingSubmission = db.prepare('SELECT id FROM submissions WHERE couple_id = ?').get(coupleId);
    if (existingSubmission) {
      return res.status(403).json({ error: 'Your submission is already final and cannot be modified.' });
    }

    const coupleDir = path.resolve(photosBaseDir, coupleId);
    const existingPhotos = db.prepare('SELECT id, storage_path FROM photos WHERE couple_id = ?').all(coupleId) as any[];
    for (const p of existingPhotos) {
      if (p.storage_path) {
        const filePath = path.resolve(process.cwd(), p.storage_path);
        if (filePath.startsWith(coupleDir) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // ignore
          }
        }
      }
    }

    db.prepare('DELETE FROM photos WHERE couple_id = ?').run(coupleId);

    db.prepare(`
      UPDATE year2_profiles SET
        photo_id = NULL,
        photo_filename = NULL,
        photo_mime = NULL,
        photo_size = NULL,
        family_photo_path = NULL,
        family_photo_url = NULL,
        updated_at = ?
      WHERE couple_id = ?
    `).run(new Date().toISOString(), coupleId);

    res.json({ success: true, message: 'Photo removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove photo.' });
  }
});

// Secure Photo Retrieval (Access control check: Member owns photo OR is Admin)
apiRouter.get(['/member/photo', '/member/photo/:photoId'], (req: AuthenticatedRequest, res: Response) => {
  try {
    const photoId = req.params.photoId;
    const queryPath = (req.query.path as string) || '';

    // Security Test 9: Block path traversal attempts
    if (
      (photoId && (photoId.includes('..') || photoId.includes('/') || photoId.includes('\\'))) ||
      (queryPath && (queryPath.includes('..') || queryPath.includes('/') || queryPath.includes('\\')))
    ) {
      return res.status(400).json({ error: 'Directory traversal attempt detected.' });
    }

    const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : '');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required to view private photos.' });
    }

    const token = authHeader.split(' ')[1];
    let decoded: any = null;
    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'jsg_royals_secure_jwt_secret_2027';
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    const isAdmin = decoded.role === 'admin' || decoded.role === 'super_admin';
    const sessionCoupleId = decoded.coupleId;

    let photo: any = null;
    if (photoId) {
      photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(photoId) as any;
    } else if (sessionCoupleId) {
      photo = db.prepare('SELECT * FROM photos WHERE couple_id = ? ORDER BY created_at DESC LIMIT 1').get(sessionCoupleId) as any;
    }

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    // Security Test 8: JR001 attempts to access JR002 photo -> Blocked (HTTP 403)
    if (!isAdmin && photo.couple_id !== sessionCoupleId) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to access another couple\'s private photo.' });
    }

    let fullFilePath = path.resolve(process.cwd(), photo.storage_path);
    if (!fs.existsSync(fullFilePath)) {
      fullFilePath = path.resolve(photosBaseDir, photo.couple_id, path.basename(photo.storage_path));
    }
    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({ error: 'Photo file not found on disk.' });
    }

    res.setHeader('Content-Type', photo.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${photo.filename || 'photo.jpg'}"`);
    fs.createReadStream(fullFilePath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: 'Error retrieving photo.' });
  }
});

// Submit Year-2 Membership Update (STRICT DATABASE-LEVEL PREVENT DUPLICATES & VALIDATION)
apiRouter.post(['/member/submit', '/member/submit-year2'], requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;

    // 1. Check if submission already exists (DATABASE UNIQUE CHECK)
    const existing = db.prepare('SELECT * FROM submissions WHERE couple_id = ?').get(coupleId) as any;
    if (existing) {
      return res.status(409).json({
        error: 'Your Chapter-2 membership update has already been submitted.',
        submittedAt: existing.submitted_at
      });
    }

    // 2. If client passed final payload directly with submit, save it first
    const { profile: bodyProfile, preferences: bodyPreferences } = req.body || {};
    const now = new Date().toISOString();

    if (bodyProfile || bodyPreferences) {
      const updateTx = db.transaction(() => {
        if (bodyProfile) {
          const existingProfile = db.prepare('SELECT id FROM year2_profiles WHERE couple_id = ?').get(coupleId);
          const cityVal = bodyProfile.current_city || bodyProfile.city || null;
          const resAddressVal = bodyProfile.residential_address || null;
          const occStatusVal = bodyProfile.occupation_status || null;
          const occDetailsVal = bodyProfile.occupation_details || null;
          const occUpdateVal = bodyProfile.occupation_update || (occStatusVal ? `${occStatusVal}${occDetailsVal ? ': ' + occDetailsVal : ''}` : null);
          const orgVal = bodyProfile.organization_update || bodyProfile.organization_firm_name || null;
          const famStatusVal = bodyProfile.family_status || null;
          const famDetailsVal = bodyProfile.family_details || null;
          const famUpdateVal = bodyProfile.family_update || (famStatusVal ? `${famStatusVal}${famDetailsVal ? ': ' + famDetailsVal : ''}` : null);

          if (existingProfile) {
            db.prepare(`
              UPDATE year2_profiles SET
                current_city = COALESCE(?, current_city),
                residential_address = COALESCE(?, residential_address),
                occupation_status = COALESCE(?, occupation_status),
                occupation_details = COALESCE(?, occupation_details),
                occupation_update = COALESCE(?, occupation_update),
                organization_update = COALESCE(?, organization_update),
                family_status = COALESCE(?, family_status),
                family_details = COALESCE(?, family_details),
                family_update = COALESCE(?, family_update),
                updated_at = ?
              WHERE couple_id = ?
            `).run(cityVal, resAddressVal, occStatusVal, occDetailsVal, occUpdateVal, orgVal, famStatusVal, famDetailsVal, famUpdateVal, now, coupleId);
          } else {
            db.prepare(`
              INSERT INTO year2_profiles (
                couple_id, current_city, residential_address,
                occupation_status, occupation_details, occupation_update, organization_update,
                family_status, family_details, family_update,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(coupleId, cityVal, resAddressVal, occStatusVal, occDetailsVal, occUpdateVal, orgVal, famStatusVal, famDetailsVal, famUpdateVal, now, now);
          }
        }

        if (bodyPreferences) {
          const existingPref = db.prepare('SELECT id FROM year2_preferences WHERE couple_id = ?').get(coupleId);
          const wishlistJson = bodyPreferences.wishlist ? JSON.stringify(bodyPreferences.wishlist) : null;
          const wishlistOther = bodyPreferences.wishlist_other || null;
          const dreamExp = bodyPreferences.dream_experience || null;
          const contributionJson = bodyPreferences.contribution_areas ? JSON.stringify(bodyPreferences.contribution_areas) : null;
          const contribOther = bodyPreferences.contribution_other || null;
          const contribHelp = bodyPreferences.contribution_help_text || null;
          const royalIdea = bodyPreferences.royal_idea || null;
          const identityKnownForJson = bodyPreferences.identity_known_for ? JSON.stringify(bodyPreferences.identity_known_for) : null;
          const identityStmt = bodyPreferences.identity_statement || bodyPreferences.jsg_royals_identity || null;
          const jsgShouldBeKnown = identityStmt || (identityKnownForJson ? identityKnownForJson : null);

          if (existingPref) {
            db.prepare(`
              UPDATE year2_preferences SET
                wishlist = COALESCE(?, wishlist),
                wishlist_other = COALESCE(?, wishlist_other),
                dream_experience = COALESCE(?, dream_experience),
                contribution_areas = COALESCE(?, contribution_areas),
                contribution_other = COALESCE(?, contribution_other),
                contribution_help_text = COALESCE(?, contribution_help_text),
                royal_idea = COALESCE(?, royal_idea),
                identity_known_for = COALESCE(?, identity_known_for),
                identity_statement = COALESCE(?, identity_statement),
                jsg_should_be_known_for = COALESCE(?, jsg_should_be_known_for),
                updated_at = ?
              WHERE couple_id = ?
            `).run(wishlistJson, wishlistOther, dreamExp, contributionJson, contribOther, contribHelp, royalIdea, identityKnownForJson, identityStmt, jsgShouldBeKnown, now, coupleId);
          } else {
            db.prepare(`
              INSERT INTO year2_preferences (
                couple_id, wishlist, wishlist_other, dream_experience,
                contribution_areas, contribution_other, contribution_help_text,
                royal_idea, identity_known_for, identity_statement, jsg_should_be_known_for,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(coupleId, wishlistJson || JSON.stringify([]), wishlistOther, dreamExp, contributionJson || JSON.stringify([]), contribOther, contribHelp, royalIdea, identityKnownForJson, identityStmt, jsgShouldBeKnown, now, now);
          }
        }
      });
      updateTx();
    }

    // 3. Strict Required Fields Validation
    const profile = db.prepare('SELECT * FROM year2_profiles WHERE couple_id = ?').get(coupleId) as any;
    const prefs = db.prepare('SELECT * FROM year2_preferences WHERE couple_id = ?').get(coupleId) as any;

    const city = (profile?.current_city || profile?.city)?.trim();
    const familyStatus = (profile?.family_status || profile?.family_update)?.trim();

    let wishlistArr: string[] = [];
    try {
      wishlistArr = prefs?.wishlist ? JSON.parse(prefs.wishlist) : [];
    } catch (e) {
      wishlistArr = [];
    }

    let contributionArr: string[] = [];
    try {
      contributionArr = prefs?.contribution_areas ? JSON.parse(prefs.contribution_areas) : [];
    } catch (e) {
      contributionArr = [];
    }

    const missingFields: string[] = [];
    if (!city) missingFields.push('Current city is required');
    if (!familyStatus) missingFields.push('Family update selection is required');
    if (!Array.isArray(wishlistArr) || wishlistArr.length === 0) missingFields.push('At least one Wishlist selection is required');
    if (!Array.isArray(contributionArr) || contributionArr.length === 0) missingFields.push('At least one Contribution selection is required');

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Validation failed: ${missingFields.join('; ')}.`,
        missingFields
      });
    }

    // 4. Perform atomic insert into submissions table
    const submitTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO submissions (couple_id, status, submitted_at, created_at, updated_at)
        VALUES (?, 'submitted', ?, ?, ?)
      `).run(coupleId, now, now, now);
    });

    submitTx();

    res.json({
      success: true,
      message: 'Chapter-2 membership update successfully submitted.',
      coupleId,
      submittedAt: now
    });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Your Chapter-2 membership update has already been submitted.'
      });
    }
    res.status(500).json({ error: 'Failed to record submission. Please try again.' });
  }
});

// Submit Year-1 Information Correction Request
apiRouter.post('/member/request-correction', requireMember, (req: AuthenticatedRequest, res) => {
  try {
    const coupleId = req.member!.coupleId;
    const mobile = req.member!.mobile;
    const { requested_correction, member_message } = req.body;

    if (!requested_correction || !member_message) {
      return res.status(400).json({ error: 'Please specify the correction area and description.' });
    }

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO correction_requests (
        couple_id, requested_correction,
        member_message, status, created_at
      ) VALUES (?, ?, ?, 'pending', ?)
    `).run(
      coupleId,
      requested_correction ? requested_correction.trim() : 'Year-1 Profile Correction',
      member_message.trim(),
      now
    );

    res.json({
      success: true,
      requestId: result.lastInsertRowid,
      status: 'pending',
      message: "Thanks — we've received your correction request. Our JSG Royals team will review it."
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit correction request.' });
  }
});

// ==========================================
// ==========================================
// 3. ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Validate Admin Session & Fetch Profile
apiRouter.get('/admin/me', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    admin: {
      email: req.admin!.email,
      role: req.admin!.role
    }
  });
});

// Overview Statistics (Dynamic Database-derived metrics)
apiRouter.get('/admin/overview', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalMembers = (db.prepare('SELECT COUNT(*) as count FROM members WHERE active_status = 1').get() as any).count;
    const verifiedCount = (db.prepare("SELECT COUNT(DISTINCT couple_id) as count FROM verification WHERE verification_status = 'verified'").get() as any).count;
    const notVerifiedCount = Math.max(0, totalMembers - verifiedCount);
    const submittedCount = (db.prepare('SELECT COUNT(*) as count FROM submissions').get() as any).count;
    
    // Started = has profile or preference row but not submitted
    const startedCount = (db.prepare(`
      SELECT COUNT(DISTINCT m.couple_id) as count 
      FROM members m
      LEFT JOIN year2_profiles p ON m.couple_id = p.couple_id
      LEFT JOIN year2_preferences pref ON m.couple_id = pref.couple_id
      LEFT JOIN submissions s ON m.couple_id = s.couple_id
      WHERE (p.id IS NOT NULL OR pref.id IS NOT NULL) AND s.id IS NULL AND m.active_status = 1
    `).get() as any).count;

    const incompleteCount = startedCount;
    const pendingCorrectionsCount = (db.prepare("SELECT COUNT(*) as count FROM correction_requests WHERE status = 'pending'").get() as any).count;
    const freshFamilyRow = (db.prepare('SELECT COUNT(*) as count FROM family_registrations').get() as any);
    const freshFamilyCount = freshFamilyRow ? freshFamilyRow.count : 0;

    res.json({
      totalMembers,
      verifiedCount,
      notVerifiedCount,
      startedCount,
      incompleteCount,
      submittedCount,
      pendingCorrectionsCount,
      freshFamilyCount
    });
  } catch (err: any) {
    console.error('/api/admin/overview error:', err);
    res.status(500).json({ error: 'Failed to fetch admin overview.' });
  }
});

// Member List with server-side search, combinable filters, and pagination
apiRouter.get('/admin/members', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const verificationFilter = (req.query.verification as string) || 'all'; // 'all', 'verified', 'not_verified'
    const year2Filter = (req.query.year2 as string) || (req.query.status as string) || 'all'; // 'all', 'not_started', 'draft', 'submitted'
    const correctionFilter = (req.query.corrections as string) || 'all'; // 'all', 'no_correction', 'pending', 'under_review', 'resolved', 'rejected'
    
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(5, Math.min(110, parseInt((req.query.limit as string) || '20', 10)));
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT 
        m.couple_id,
        m.husband_name,
        m.wife_name,
        m.husband_registered_mobile,
        m.wife_registered_mobile,
        m.marriage_anniversary,
        v.verified_at,
        v.verified_mobile,
        CASE WHEN v.verified_at IS NOT NULL THEN 1 ELSE 0 END as is_verified,
        s.submitted_at,
        s.status as submission_status,
        CASE 
          WHEN s.id IS NOT NULL THEN 'SUBMITTED'
          WHEN (p.id IS NOT NULL OR pref.id IS NOT NULL) THEN 'DRAFT'
          ELSE 'NOT STARTED'
        END as year2_status,
        p.photo_id,
        p.family_photo_url,
        (SELECT status FROM correction_requests cr WHERE cr.couple_id = m.couple_id ORDER BY id DESC LIMIT 1) as latest_correction_status,
        (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id AND cr.status = 'pending') as pending_corrections_count,
        COALESCE(s.submitted_at, p.updated_at, v.verified_at, m.updated_at) as last_activity
      FROM members m
      LEFT JOIN (
        SELECT couple_id, MAX(verified_at) as verified_at, verified_mobile 
        FROM verification 
        GROUP BY couple_id
      ) v ON m.couple_id = v.couple_id
      LEFT JOIN submissions s ON m.couple_id = s.couple_id
      LEFT JOIN year2_profiles p ON m.couple_id = p.couple_id
      LEFT JOIN year2_preferences pref ON m.couple_id = pref.couple_id
      WHERE m.active_status = 1
    `;

    const params: any[] = [];

    // Server-side Search across Couple ID, Husband name, Wife name, Mobiles
    if (search) {
      baseQuery += `
        AND (
          LOWER(m.couple_id) LIKE ? OR
          LOWER(m.husband_name) LIKE ? OR
          LOWER(m.wife_name) LIKE ? OR
          m.husband_registered_mobile LIKE ? OR
          m.wife_registered_mobile LIKE ?
        )
      `;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // Filter 1: Verification
    if (verificationFilter === 'verified') {
      baseQuery += ' AND v.verified_at IS NOT NULL';
    } else if (verificationFilter === 'not_verified') {
      baseQuery += ' AND v.verified_at IS NULL';
    }

    // Filter 2: Year-2 Status
    if (year2Filter === 'submitted') {
      baseQuery += ' AND s.id IS NOT NULL';
    } else if (year2Filter === 'draft' || year2Filter === 'incomplete') {
      baseQuery += ' AND (p.id IS NOT NULL OR pref.id IS NOT NULL) AND s.id IS NULL';
    } else if (year2Filter === 'not_started') {
      baseQuery += ' AND p.id IS NULL AND pref.id IS NULL AND s.id IS NULL';
    }

    // Filter 3: Correction Requests
    if (correctionFilter === 'pending') {
      baseQuery += ` AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id AND cr.status = 'pending') > 0`;
    } else if (correctionFilter === 'under_review') {
      baseQuery += ` AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id AND cr.status = 'under_review') > 0`;
    } else if (correctionFilter === 'resolved') {
      baseQuery += ` AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id AND cr.status = 'resolved') > 0`;
    } else if (correctionFilter === 'rejected') {
      baseQuery += ` AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id AND cr.status = 'rejected') > 0`;
    } else if (correctionFilter === 'no_correction') {
      baseQuery += ` AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id) = 0`;
    }

    // Total matching count
    const countQuery = `SELECT COUNT(*) as count FROM (${baseQuery})`;
    const totalFiltered = (db.prepare(countQuery).get(...params) as any).count;

    // Order by Couple ID and apply pagination
    baseQuery += ` ORDER BY m.couple_id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rawMembers = db.prepare(baseQuery).all(...params) as any[];

    const members = rawMembers.map((m) => {
      let derivedCorrection = 'NO CORRECTION';
      if (m.latest_correction_status) {
        derivedCorrection = m.latest_correction_status.toUpperCase();
      }
      return {
        ...m,
        correction_status: derivedCorrection,
        verification_status: m.is_verified ? 'VERIFIED' : 'NOT VERIFIED',
      };
    });

    res.json({
      members,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit)
      }
    });
  } catch (err: any) {
    console.error('/api/admin/members error:', err);
    res.status(500).json({ error: 'Failed to query members.' });
  }
});

// Single Member Full Detail
apiRouter.get('/admin/member/:coupleId', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coupleId = req.params.coupleId;
    const member = db.prepare('SELECT * FROM members WHERE couple_id = ?').get(coupleId) as any;
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Log profile inspection in audit trail
    logAdminAudit(req.admin!.email, 'Member profile viewed', coupleId, `Viewed detailed profile for ${coupleId}`);

    const year2Profile = db.prepare('SELECT * FROM year2_profiles WHERE couple_id = ?').get(coupleId) as any;
    const year2Preferences = db.prepare('SELECT * FROM year2_preferences WHERE couple_id = ?').get(coupleId) as any;
    const submission = db.prepare('SELECT * FROM submissions WHERE couple_id = ?').get(coupleId) as any;
    const verifications = db.prepare('SELECT * FROM verification WHERE couple_id = ? ORDER BY id DESC').all(coupleId);
    const corrections = db.prepare('SELECT * FROM correction_requests WHERE couple_id = ? ORDER BY id DESC').all(coupleId);
    const notes = db.prepare('SELECT * FROM member_admin_notes WHERE couple_id = ? ORDER BY id DESC').all(coupleId);
    const photo = db.prepare('SELECT id, filename, mime_type, size_bytes, created_at FROM photos WHERE couple_id = ? ORDER BY created_at DESC LIMIT 1').get(coupleId) as any;

    let parsedWishlist: string[] = [];
    try {
      parsedWishlist = year2Preferences?.wishlist ? JSON.parse(year2Preferences.wishlist) : [];
    } catch (e) {}

    let parsedContributions: string[] = [];
    try {
      parsedContributions = year2Preferences?.contribution_areas ? JSON.parse(year2Preferences.contribution_areas) : [];
    } catch (e) {}

    let parsedIdentity: string[] = [];
    try {
      parsedIdentity = year2Preferences?.identity_known_for ? JSON.parse(year2Preferences.identity_known_for) : [];
    } catch (e) {}

    res.json({
      member: {
        ...member,
        protectedFields: [
          'couple_id',
          'husband_name',
          'wife_name',
          'husband_registered_mobile',
          'wife_registered_mobile',
          'husband_dob',
          'wife_dob',
          'marriage_anniversary'
        ]
      },
      year2Profile: year2Profile ? {
        ...year2Profile,
        current_city: year2Profile.current_city || member.year1_city || 'Indore',
      } : null,
      year2Preferences: year2Preferences ? {
        ...year2Preferences,
        wishlist: parsedWishlist,
        contribution_areas: parsedContributions,
        identity_known_for: parsedIdentity,
      } : null,
      photo: photo ? {
        ...photo,
        url: `/api/member/photo/${photo.id}?token=${req.headers.authorization?.split(' ')[1]}`
      } : null,
      submission,
      verifications,
      corrections,
      notes
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch member details.' });
  }
});

// Admin Notes Management (Private to Admin)
apiRouter.post('/admin/notes', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { coupleId, note } = req.body;
    if (!coupleId || !note || !note.trim()) {
      return res.status(400).json({ error: 'Couple ID and note content are required.' });
    }

    const member = db.prepare('SELECT couple_id FROM members WHERE couple_id = ?').get(coupleId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const adminEmail = req.admin!.email;
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO member_admin_notes (couple_id, admin_email, note, created_at)
      VALUES (?, ?, ?, ?)
    `).run(coupleId, adminEmail, note.trim(), now);

    logAdminAudit(adminEmail, 'Admin note added', coupleId, note.trim().substring(0, 100));

    res.json({
      success: true,
      note: {
        id: insert.lastInsertRowid,
        couple_id: coupleId,
        admin_email: adminEmail,
        note: note.trim(),
        created_at: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add admin note.' });
  }
});

apiRouter.get('/admin/notes/:coupleId', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const coupleId = req.params.coupleId;
    const notes = db.prepare('SELECT * FROM member_admin_notes WHERE couple_id = ? ORDER BY id DESC').all(coupleId);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch admin notes.' });
  }
});

// Correction Requests Management
apiRouter.get('/admin/corrections', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const corrections = db.prepare(`
      SELECT 
        cr.*, 
        m.husband_name, 
        m.wife_name, 
        m.husband_registered_mobile, 
        m.wife_registered_mobile
      FROM correction_requests cr
      JOIN members m ON cr.couple_id = m.couple_id
      ORDER BY cr.id DESC
    `).all();

    res.json({ corrections });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch corrections.' });
  }
});

// Resolve/Update Correction Request
const handleResolveCorrection = (req: AuthenticatedRequest, res: Response) => {
  try {
    const correctionId = req.params.id ? Number(req.params.id) : (req.body.correctionId ? Number(req.body.correctionId) : null);
    const status = req.body.status;
    const adminNotes = req.body.adminNotes || req.body.admin_notes;

    if (!correctionId || !status) {
      return res.status(400).json({ error: 'Correction ID and status are required.' });
    }

    const allowedStatuses = ['pending', 'under_review', 'resolved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid correction status.' });
    }

    const existing = db.prepare('SELECT * FROM correction_requests WHERE id = ?').get(correctionId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Correction request not found.' });
    }

    const now = new Date().toISOString();
    const resolvedAt = (status === 'resolved' || status === 'rejected') ? now : null;

    db.prepare(`
      UPDATE correction_requests 
      SET status = ?, admin_notes = ?, resolved_at = ?
      WHERE id = ?
    `).run(status, adminNotes || existing.admin_notes || null, resolvedAt, correctionId);

    logAdminAudit(
      req.admin!.email,
      'Correction status changed',
      existing.couple_id,
      `Request #${correctionId} status changed from ${existing.status} to ${status}. Admin notes: ${adminNotes || 'none'}`
    );

    res.json({ success: true, message: `Correction request #${correctionId} marked as ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update correction request.' });
  }
};

apiRouter.post('/admin/resolve-correction', requireAdmin, handleResolveCorrection);
apiRouter.patch('/admin/correction-requests/:id', requireAdmin, handleResolveCorrection);
apiRouter.post('/admin/correction-requests/:id', requireAdmin, handleResolveCorrection);

// Export Year-2 Submissions for Excel / Backup (Supports filter and CSV / JSON output)
apiRouter.get('/admin/export', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = (req.query.filter as string) || 'all';
    const format = (req.query.format as string) || (req.headers.accept?.includes('text/csv') ? 'csv' : 'json');

    let query = `
      SELECT 
        m.couple_id,
        m.husband_name,
        m.wife_name,
        m.husband_registered_mobile,
        m.wife_registered_mobile,
        m.marriage_anniversary,
        p.current_city as updated_city,
        p.residential_address as updated_address,
        p.occupation_update,
        p.organization_update,
        p.family_update,
        p.photo_id,
        pref.wishlist,
        pref.contribution_areas,
        pref.royal_idea,
        pref.jsg_should_be_known_for,
        v.verified_at,
        v.verified_mobile,
        s.submitted_at,
        s.status as submission_status,
        (SELECT status FROM correction_requests cr WHERE cr.couple_id = m.couple_id ORDER BY id DESC LIMIT 1) as correction_status
      FROM members m
      LEFT JOIN (
        SELECT couple_id, MAX(verified_at) as verified_at, verified_mobile 
        FROM verification 
        GROUP BY couple_id
      ) v ON m.couple_id = v.couple_id
      LEFT JOIN year2_profiles p ON m.couple_id = p.couple_id
      LEFT JOIN year2_preferences pref ON m.couple_id = pref.couple_id
      LEFT JOIN submissions s ON m.couple_id = s.couple_id
      WHERE m.active_status = 1
    `;

    if (filter === 'submitted') {
      query += ' AND s.id IS NOT NULL';
    } else if (filter === 'not_submitted') {
      query += ' AND s.id IS NULL';
    } else if (filter === 'verified') {
      query += ' AND v.verified_at IS NOT NULL';
    } else if (filter === 'corrections') {
      query += ' AND (SELECT COUNT(*) FROM correction_requests cr WHERE cr.couple_id = m.couple_id) > 0';
    }

    query += ' ORDER BY m.couple_id ASC';

    const rows = db.prepare(query).all() as any[];

    logAdminAudit(req.admin!.email, 'Export generated', undefined, `Exported ${rows.length} rows with filter '${filter}' as ${format}`);

    if (format === 'csv' || req.headers.accept?.includes('text/csv')) {
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        let str = String(val);
        try {
          if (str.startsWith('[') && str.endsWith(']')) {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) str = parsed.join(', ');
          }
        } catch (e) {}
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        'Couple ID',
        'Husband Name',
        'Wife Name',
        'Husband Registered Mobile',
        'Wife Registered Mobile',
        'Marriage Anniversary',
        'Current City',
        'Residential Address',
        'Professional Update',
        'Organization / Business',
        'Family Update',
        'Wishlist',
        'Contribution Areas',
        'Royal Idea for 2027',
        'JSG Royals Identity',
        'Photo ID',
        'Verification Status',
        'Verification Date',
        'Submission Status',
        'Submission Date',
        'Correction Status'
      ];

      const csvLines = [headers.join(',')];
      for (const r of rows) {
        csvLines.push([
          escapeCsv(r.couple_id),
          escapeCsv(r.husband_name),
          escapeCsv(r.wife_name),
          escapeCsv(r.husband_registered_mobile),
          escapeCsv(r.wife_registered_mobile),
          escapeCsv(r.marriage_anniversary),
          escapeCsv(r.updated_city || 'Indore'),
          escapeCsv(r.updated_address || ''),
          escapeCsv(r.occupation_update || ''),
          escapeCsv(r.organization_update || ''),
          escapeCsv(r.family_update || ''),
          escapeCsv(r.wishlist || ''),
          escapeCsv(r.contribution_areas || ''),
          escapeCsv(r.royal_idea || ''),
          escapeCsv(r.jsg_should_be_known_for || ''),
          escapeCsv(r.photo_id || 'None'),
          escapeCsv(r.verified_at ? 'Verified' : 'Not Verified'),
          escapeCsv(r.verified_at || ''),
          escapeCsv(r.submitted_at ? 'Submitted' : (r.updated_city ? 'Draft' : 'Not Started')),
          escapeCsv(r.submitted_at || ''),
          escapeCsv(r.correction_status ? r.correction_status.toUpperCase() : 'No Correction')
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="jsg_royals_year2_export.csv"');
      return res.send(csvLines.join('\r\n'));
    }

    res.json({
      exportedAt: new Date().toISOString(),
      filter,
      count: rows.length,
      data: rows
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export submissions.' });
  }
});

// Audit Trail endpoint (Admin only)
apiRouter.get('/admin/audit-logs', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.max(5, Math.min(100, parseInt((req.query.limit as string) || '50', 10)));
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any).count;
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// STEP 9: Get Members Import & Validation Status
apiRouter.get('/admin/members-import-status', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = getMembersImportStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve import validation status.' });
  }
});

// STEP 9: Import 110 Real Year-1 Members (Super Admin only or Admin)
apiRouter.post('/admin/import-members', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { members: memberRecords, csvText } = req.body;
    let recordsToImport: any[] = [];

    if (Array.isArray(memberRecords)) {
      recordsToImport = memberRecords;
    } else if (typeof csvText === 'string' && csvText.trim()) {
      // Parse CSV Text
      const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV must contain headers and at least one data row.' });
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase().replace(/[\s_-]+/g, '_'));
      
      for (let i = 1; i < lines.length; i++) {
        const rowValues: string[] = [];
        let inQuotes = false;
        let curVal = '';
        const line = lines[i];

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            rowValues.push(curVal.trim().replace(/^["']|["']$/g, ''));
            curVal = '';
          } else {
            curVal += char;
          }
        }
        rowValues.push(curVal.trim().replace(/^["']|["']$/g, ''));

        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = rowValues[idx] || null;
        });

        // Normalize Couple ID
        if (!rowObj.couple_id && rowObj.id && String(rowObj.id).startsWith('JR')) {
          rowObj.couple_id = rowObj.id;
        }
        if (!rowObj.couple_id && rowObj.sr_no && String(rowObj.sr_no).startsWith('JR')) {
          rowObj.couple_id = rowObj.sr_no;
        }

        recordsToImport.push(rowObj);
      }
    } else {
      return res.status(400).json({ error: 'Please provide either a "members" JSON array or "csvText" string.' });
    }

    const validationResult = validateAndImportYear1Members(recordsToImport, req.admin!.email);
    res.json({
      success: true,
      message: `Successfully processed and imported ${recordsToImport.length} Year-1 member records.`,
      status: validationResult
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Import failed.' });
  }
});

// ==========================================
// FAST2SMS CONFIGURATION & STATUS
// ==========================================

// Get Fast2SMS status & wallet balance
apiRouter.get('/admin/sms-config', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isConfigured = isFast2SmsConfigured();
    const apiKey = getFast2SmsApiKey();
    const maskedKey = apiKey ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}` : null;
    let walletInfo = null;
    if (isConfigured) {
      walletInfo = await checkFast2SmsWallet();
    }
    res.json({
      configured: isConfigured,
      gateway: 'Fast2SMS (bulkV2 OTP route)',
      maskedKey,
      wallet: walletInfo?.wallet || null,
      walletError: walletInfo && !walletInfo.success ? walletInfo.message : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check SMS configuration.' });
  }
});

// Update Fast2SMS API Key
apiRouter.post('/admin/sms-config', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a valid Fast2SMS API Key.' });
    }
    setSetting('fast2sms_api_key', apiKey.trim());
    logAdminAudit(req.admin!.email, 'UPDATE_FAST2SMS_KEY', undefined, 'Updated Fast2SMS API Key');

    const walletCheck = await checkFast2SmsWallet();
    res.json({
      success: true,
      message: 'Fast2SMS API Key updated successfully.',
      walletCheck,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update SMS configuration.' });
  }
});

// Run live diagnostic test on Fast2SMS API with current credentials
apiRouter.post('/admin/test-fast2sms', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const apiKey = getFast2SmsApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'Fast2SMS API Key is not configured yet.' });
    }

    const testMobile = (req.body?.mobile || '9977933333').replace(/\D/g, '').slice(-10);

    // 1. Test Wallet
    let walletResult: any = null;
    try {
      const wRes = await fetch('https://www.fast2sms.com/dev/wallet', {
        method: 'POST',
        headers: { 'authorization': apiKey },
      });
      walletResult = await wRes.json().catch(() => ({}));
    } catch (e: any) {
      walletResult = { error: e.message };
    }

    // 2. Test OTP Route
    let otpRouteResult: any = null;
    try {
      const oRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: '123456',
          numbers: testMobile,
        }),
      });
      otpRouteResult = await oRes.json().catch(() => ({}));
    } catch (e: any) {
      otpRouteResult = { error: e.message };
    }

    // 3. Test Quick Route (q)
    let quickRouteResult: any = null;
    try {
      const qRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: 'JSG Royals Fast2SMS API connection diagnostic test.',
          language: 'english',
          flash: 0,
          numbers: testMobile,
        }),
      });
      quickRouteResult = await qRes.json().catch(() => ({}));
    } catch (e: any) {
      quickRouteResult = { error: e.message };
    }

    const maskedKey = `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`;

    let statusSummary = 'Credentials valid.';
    if (quickRouteResult?.status_code === 999) {
      statusSummary = 'Credentials valid, but Fast2SMS requires ₹100 INR recharge before API route can deliver live SMS.';
    } else if (otpRouteResult?.status_code === 996) {
      statusSummary = 'Credentials valid, but Fast2SMS requires 1-time Website Verification under Dev API -> OTP Message menu.';
    }

    res.json({
      success: true,
      maskedKey,
      testMobile,
      walletResult,
      otpRouteResult,
      quickRouteResult,
      statusSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Diagnostic test failed.' });
  }
});

// View recent OTP attempts
apiRouter.get('/admin/recent-otps', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = db.prepare(`
      SELECT o.id, o.mobile, o.couple_id, o.created_at, o.expires_at, o.attempts, o.verified,
             m.husband_name, m.wife_name
      FROM otp_codes o
      LEFT JOIN members m ON m.couple_id = o.couple_id
      ORDER BY o.id DESC LIMIT 15
    `).all();
    res.json({ success: true, records });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve recent OTP activity.' });
  }
});

// =========================================================================
// FRESH EMAIL-BASED FAMILY REGISTRATION & SPOUSE DETECTION ENDPOINTS
// =========================================================================

// Helper: Evaluate Renewal Fee Collection Window in IST (Asia/Kolkata)
function getRenewalWindowInfo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const month = Number(parts.find((p) => p.type === 'month')?.value || now.getMonth() + 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value || now.getDate());
  const isAfterDec6 = month === 12 && day > 6;
  const isLateWindow = month === 12 && day >= 1 && day <= 6;
  const isRegularWindow = month === 11 && day >= 20 && day <= 30;
  return {
    month,
    day,
    isAfterDec6,
    isLateWindow,
    isRegularWindow,
    renewalFee: isLateWindow ? 70000 : 60000,
    lateFeeApplied: isLateWindow,
  };
}

// Request 6-digit Email OTP
apiRouter.post('/family/request-email-otp', async (req: Request, res: Response) => {
  try {
    const windowInfo = getRenewalWindowInfo();
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const membershipType = req.body?.membershipType === 'new' ? 'new' : 'existing';
    if (membershipType === 'existing' && windowInfo.isAfterDec6) {
      const existing = rawEmail
        ? db.prepare('SELECT id FROM family_registrations WHERE LOWER(husband_email) = ? OR LOWER(wife_email) = ? LIMIT 1').get(rawEmail, rawEmail)
        : null;
      if (!existing) {
        return res.status(403).json({
          error: 'After 6 Dec 2026, existing member renewals are closed and existing members are considered as a New Entry. Please apply under New Member Application.'
        });
      }
    }
    const email = req.body?.email;
    const role = req.body?.role || 'husband';
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = host ? `${proto}://${host}` : undefined;
    const result = await requestEmailOtp(email, role, baseUrl);
    if (result.registration) {
      result.registration = normalizeFamilyRecordPhotos(result.registration, result.registration.children || [], req);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to send email verification code.' });
  }
});

// Get Email Delivery Configuration Status
apiRouter.get('/family/email-config', async (req: Request, res: Response) => {
  if (req.query.verify === '1' || req.query.verify === 'true') {
    const force = req.query.force === '1' || req.query.force === 'true';
    const verifiedStatus = await getVerifiedEmailConfigStatus(force);
    return res.json(verifiedStatus);
  }
  res.json(getEmailConfigStatus());
});

// Update Email Delivery Configuration (Resend, Gmail, Brevo, or SMTP)
apiRouter.post('/family/email-config', async (req: Request, res: Response) => {
  try {
    const status = await saveEmailConfig(req.body);
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to save email configuration.' });
  }
});

// Admin Live Test Email Dispatcher
apiRouter.post('/admin/test-email', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetEmail = req.body?.email || req.admin?.email;
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = host ? `${proto}://${host}` : undefined;
    const result = await sendTestEmail(targetEmail, baseUrl);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to dispatch test email.' });
  }
});

// Verify 6-digit Email OTP
apiRouter.post('/family/verify-email-otp', (req: Request, res: Response) => {
  try {
    const { email, otp, role } = req.body;
    const result = verifyEmailOtp(email, otp, role === 'wife' ? 'wife' : 'husband');
    if (result.registration) {
      result.registration = normalizeFamilyRecordPhotos(result.registration, result.registration.children || [], req);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Verification failed.' });
  }
});

// Decrypt an OTP-verified member's encrypted Firestore vault blob and rehydrate local cache
apiRouter.post('/family/decrypt-vault', (req: Request, res: Response) => {
  try {
    const token = String(req.body?.lookupToken || '').trim();
    const verified = verifyFamilyLookupToken(token);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid or expired email verification token.' });
    }

    const vaultDoc = req.body?.vault;
    const decrypted = decryptVaultForEmail(verified.email, vaultDoc);
    if (!decrypted || isFamilyRegistrationTombstoned(decrypted)) {
      return res.json({ alreadyRegistered: false });
    }

    rehydrateLocalRegistrationCache(decrypted);
    const summary = buildRegistrationMatchSummary(verified.email, decrypted, verified.role);
    summary.registration = normalizeFamilyRecordPhotos(summary.registration, summary.registration.children || [], req);
    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to verify cloud registration record.' });
  }
});

// Sync a cloud registration (read directly by verified owner/admin) to local cache & generate encrypted vault entries
apiRouter.post('/family/sync-from-cloud', (req: Request, res: Response) => {
  try {
    const token = String(req.body?.lookupToken || '').trim();
    const verified = verifyFamilyLookupToken(token);
    if (!verified) {
      return res.status(401).json({ error: 'Invalid or expired email verification token.' });
    }

    const registration = req.body?.registration;
    if (!registration || typeof registration !== 'object' || !registration.reg_id) {
      return res.json({ alreadyRegistered: false, vaultEntries: [] });
    }

    const householdEmails = collectHouseholdEmails(registration);
    if (!householdEmails.includes(verified.email) || isFamilyRegistrationTombstoned(registration)) {
      return res.json({ alreadyRegistered: false, vaultEntries: [] });
    }

    rehydrateLocalRegistrationCache(registration);
    const summary = buildRegistrationMatchSummary(verified.email, registration, verified.role);
    summary.registration = normalizeFamilyRecordPhotos(summary.registration, summary.registration.children || [], req);
    const vaultEntries = encryptRegistrationForVaults(summary.registration);

    res.json({
      ...summary,
      vaultEntries,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to sync cloud registration.' });
  }
});

const PUBLIC_APP_URL_FALLBACK =
  'https://ais-pre-t5c2x6fk3je4yhythikayj-923279058412.asia-southeast1.run.app';

function isPrivateDevUrl(url: string): boolean {
  return !url || url.includes('localhost') || url.includes('127.0.0.1') || url.includes('ais-dev-');
}

function resolvePublicAppOrigin(req: Request): string {
  const envUrl = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && !isPrivateDevUrl(envUrl)) {
    return envUrl;
  }
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host') || '';
  const candidate = host ? `${proto}://${host}` : '';
  if (!isPrivateDevUrl(candidate)) {
    return candidate;
  }
  return PUBLIC_APP_URL_FALLBACK;
}

function toPublicPhotoUrl(url: string | null | undefined, req: Request): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;

  const marker = '/api/family/photo/';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const isKnownOriginOrRelative =
      trimmed.startsWith('/') ||
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('ais-dev-') ||
      trimmed.includes('ais-pre-') ||
      trimmed.includes('royalsrenewform.vercel.app');
    if (isKnownOriginOrRelative) {
      const filenamePart = trimmed.slice(idx + marker.length).split('?')[0].split('#')[0];
      return `${resolvePublicAppOrigin(req)}${marker}${filenamePart}`;
    }
  }
  return trimmed;
}

function normalizeFamilyRecordPhotos(record: any, childrenList: any[], req: Request) {
  const normalizedChildren = (Array.isArray(childrenList) ? childrenList : []).map((c: any) => ({
    ...c,
    photo_url: toPublicPhotoUrl(c?.photo_url, req)
  }));
  return {
    ...record,
    husband_photo_url: toPublicPhotoUrl(record.husband_photo_url, req),
    wife_photo_url: toPublicPhotoUrl(record.wife_photo_url, req),
    couple_photo_url: toPublicPhotoUrl(record.couple_photo_url, req),
    family_photo_url: toPublicPhotoUrl(record.family_photo_url, req),
    children: normalizedChildren
  };
}

function isFamilyRegistrationTombstoned(row: any): boolean {
  if (!row) return false;
  const tombstones = db
    .prepare('SELECT record_id, email, deleted_at FROM deleted_tombstones WHERE record_type = ?')
    .all('family') as Array<{ record_id: string; email: string | null; deleted_at: string }>;
  if (tombstones.length === 0) return false;

  const regTime = new Date(row.updated_at || row.created_at || 0).getTime() || 0;
  const regIdUpper = String(row.reg_id || '').trim().toUpperCase();
  const emails = [row.submitter_email, row.husband_email, row.wife_email]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter((e) => e.includes('@'));

  return tombstones.some((t) => {
    const delTime = new Date(t.deleted_at || 0).getTime() || 0;
    const idMatch = t.record_id && regIdUpper && String(t.record_id).trim().toUpperCase() === regIdUpper;
    const emailMatch = t.email && emails.includes(String(t.email).trim().toLowerCase());
    return (idMatch || emailMatch) && regTime <= delTime;
  });
}

// 1. Check if email (or spouse's email) has already been submitted
apiRouter.post('/family/check-email', (req: Request, res: Response) => {
  try {
    const rawEmail = (req.body?.email || '').trim().toLowerCase();
    const role = (req.body?.role || '').trim().toLowerCase(); // 'husband' | 'wife'
    if (!rawEmail || !rawEmail.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const candidates = db.prepare(`
      SELECT * FROM family_registrations 
      WHERE LOWER(submitter_email) = ? OR LOWER(husband_email) = ? OR LOWER(wife_email) = ?
      ORDER BY id DESC
    `).all(rawEmail, rawEmail, rawEmail) as any[];

    const record = candidates.find((r) => !isFamilyRegistrationTombstoned(r));

    if (!record) {
      return res.json({ exists: false });
    }

    const isHusbandEmail = record.husband_email.toLowerCase() === rawEmail;
    const isWifeEmail = record.wife_email.toLowerCase() === rawEmail;
    const submittedByRole = record.submitted_by_role;

    let filedBySpouse = false;
    let spouseName = '';
    let spouseRole: 'husband' | 'wife' = 'husband';
    let message = '';

    const dateFormatted = new Date(record.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // Priority 1: Direct match based on who owns the email in the verified record
    if (isWifeEmail && submittedByRole === 'husband') {
      filedBySpouse = true;
      spouseName = record.husband_name;
      spouseRole = 'husband';
      message = `✨ Your husband, ${record.husband_name}, has already registered your royal household on ${dateFormatted}!`;
    } else if (isHusbandEmail && submittedByRole === 'wife') {
      filedBySpouse = true;
      spouseName = record.wife_name;
      spouseRole = 'wife';
      message = `✨ Your wife, ${record.wife_name}, has already registered your royal household on ${dateFormatted}!`;
    } else if (isHusbandEmail && submittedByRole === 'husband') {
      filedBySpouse = false;
      spouseName = record.wife_name;
      spouseRole = 'wife';
      message = `✨ You have already completed the registration for your royal household on ${dateFormatted}.`;
    } else if (isWifeEmail && submittedByRole === 'wife') {
      filedBySpouse = false;
      spouseName = record.husband_name;
      spouseRole = 'husband';
      message = `✨ You have already completed the registration for your royal household on ${dateFormatted}.`;
    } else if (role === 'wife' && submittedByRole === 'husband') {
      filedBySpouse = true;
      spouseName = record.husband_name;
      spouseRole = 'husband';
      message = `✨ Your husband, ${record.husband_name}, has already registered your royal household on ${dateFormatted}!`;
    } else if (role === 'husband' && submittedByRole === 'wife') {
      filedBySpouse = true;
      spouseName = record.wife_name;
      spouseRole = 'wife';
      message = `✨ Your wife, ${record.wife_name}, has already registered your royal household on ${dateFormatted}!`;
    } else {
      filedBySpouse = false;
      spouseName = submittedByRole === 'husband' ? record.wife_name : record.husband_name;
      spouseRole = submittedByRole === 'husband' ? 'wife' : 'husband';
      message = `✨ Your royal family dossier was already recorded on ${dateFormatted}.`;
    }

    let parsedChildren = [];
    try {
      parsedChildren = record.children_json ? JSON.parse(record.children_json) : [];
    } catch (e) {
      parsedChildren = [];
    }

    res.json({
      exists: true,
      filedBySpouse,
      spouseName,
      spouseRole,
      submitterRole: submittedByRole,
      submitterEmail: record.submitter_email,
      submittedAt: record.created_at,
      message,
      registration: normalizeFamilyRecordPhotos(record, parsedChildren, req)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check email registration.' });
  }
});

// 2. Submit unified family dossier (Existing Renewal or New Member Application)
apiRouter.post('/family/register', (req: Request, res: Response) => {
  try {
    const membershipType = req.body?.membership_type === 'new' ? 'new' : 'existing';
    const windowInfo = getRenewalWindowInfo();
    if (membershipType === 'existing' && windowInfo.isAfterDec6) {
      return res.status(403).json({
        error: 'After 6 Dec 2026, existing member renewals are closed and existing members are considered as a New Entry. Please apply under New Member Application.'
      });
    }

    const {
      submitted_by_role,
      submitter_email,
      husband_name,
      husband_mobile,
      husband_email,
      husband_dob,
      husband_qualification,
      husband_occupation,
      husband_organization,
      husband_blood_group,
      husband_instagram,
      wife_name,
      wife_mobile,
      wife_email,
      wife_dob,
      wife_qualification,
      wife_occupation,
      wife_organization,
      wife_blood_group,
      wife_instagram,
      marriage_anniversary,
      current_city,
      residential_address,
      native_place,
      has_children,
      children,
      husband_photo_url,
      wife_photo_url,
      couple_photo_url,
      family_photo_url,
      contribution_areas,
      royal_idea,
      jsg_should_be_known_for,
      president_name,
      president_mobile,
      secretary_name,
      secretary_mobile,
      other_group_member,
      other_group_name,
      other_group_position,
      new_member_contribution,
      reference_name,
      reference_mobile,
      business_description,
      exp_rating,
      exp_favourite_event,
      exp_international_trip,
      exp_trip_month_destination,
      exp_missing
    } = req.body;

    if (!husband_name || !husband_mobile || !husband_email) {
      return res.status(400).json({ error: 'Husband Name, Mobile number, and Email are required.' });
    }
    const cleanHusbandInstagram = String(husband_instagram || '').trim().slice(0, 120);
    if (!cleanHusbandInstagram) {
      return res.status(400).json({ error: 'Husband Instagram Handle is required.' });
    }
    if (!wife_name || !wife_mobile || !wife_email) {
      return res.status(400).json({ error: 'Wife Name, Mobile number, and Email are required.' });
    }
    const cleanWifeInstagram = String(wife_instagram || '').trim().slice(0, 120);
    if (!cleanWifeInstagram) {
      return res.status(400).json({ error: 'Wife Instagram Handle is required.' });
    }

    const cleanHusbandDob = String(husband_dob || '').trim() || null;
    const cleanWifeDob = String(wife_dob || '').trim() || null;
    if (cleanHusbandDob && cleanHusbandDob < '1988-01-01') {
      return res.status(400).json({ error: 'Husband Date of Birth must be on or after 1 Jan 1988 (1987 and earlier not allowed).' });
    }
    if (cleanWifeDob && cleanWifeDob < '1988-01-01') {
      return res.status(400).json({ error: 'Wife Date of Birth must be on or after 1 Jan 1988 (1987 and earlier not allowed).' });
    }

    let parsedChildren: any[] = [];
    if (Array.isArray(children)) {
      parsedChildren = children;
    } else if (typeof children === 'string' && children.trim()) {
      try {
        const parsed = JSON.parse(children);
        if (Array.isArray(parsed)) parsedChildren = parsed;
      } catch {}
    }

    if (has_children) {
      const invalidChildDob = parsedChildren.some((c: any) => {
        const cDob = String(c?.dob || '').trim();
        return Boolean(cDob) && cDob < '1988-01-01';
      });
      if (invalidChildDob) {
        return res.status(400).json({
          error: 'Child Date of Birth must be on or after 1 Jan 1988 (1987 and earlier not allowed).'
        });
      }
    }

    const cleanMarriageAnniversary = String(marriage_anniversary || '').trim();
    const cleanCurrentCity = String(current_city || '').trim();
    const cleanResidentialAddress = String(residential_address || '').trim();
    const cleanNativePlace = String(native_place || '').trim();
    const cleanHusbandQual = String(husband_qualification || '').trim();
    const cleanHusbandOcc = String(husband_occupation || '').trim();
    const cleanHusbandOrg = String(husband_organization || '').trim();
    const cleanHusbandBlood = String(husband_blood_group || '').trim();
    const cleanWifeQual = String(wife_qualification || '').trim();
    const cleanWifeOcc = String(wife_occupation || '').trim();
    const cleanWifeOrg = String(wife_organization || '').trim();
    const cleanWifeBlood = String(wife_blood_group || '').trim();
    const cleanContributionAreas = String(contribution_areas || '').trim();
    const cleanRoyalIdea = String(royal_idea || '').trim();

    const cleanPresName = String(president_name || 'Utkarsh Pooja Surana').trim() || 'Utkarsh Pooja Surana';
    const cleanPresMobile = String(president_mobile || '8770713343').replace(/\D/g, '') || '8770713343';
    const cleanSecName = String(secretary_name || 'Harsh Tanya Kataria').trim() || 'Harsh Tanya Kataria';
    const cleanSecMobile = String(secretary_mobile || '9669618111').replace(/\D/g, '') || '9669618111';

    const subRole = submitted_by_role === 'wife' ? 'wife' : 'husband';
    const primaryOrg = String((subRole === 'wife' ? cleanWifeOrg : cleanHusbandOrg) || cleanHusbandOrg || cleanWifeOrg || '').trim();
    const cleanOtherGroupMember = other_group_member === 'Yes' ? 'Yes' : 'No';
    const cleanOtherGroupName = String(other_group_name || '').trim();
    const cleanOtherGroupPosition =
      cleanOtherGroupMember === 'Yes'
        ? String(other_group_position || '').trim().slice(0, 200) || null
        : null;
    const cleanNewMemberContribution = String(new_member_contribution || '').trim();
    const cleanRefName = String(reference_name || '').trim();
    const cleanRefMobile = String(reference_mobile || '').replace(/\D/g, '');
    const cleanBusinessDesc = String(business_description || '').trim();

    let parsedExpRating: number | null = null;
    if (exp_rating !== null && exp_rating !== undefined && String(exp_rating).trim() !== '') {
      const ratingNum = Number(exp_rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 10) {
        return res.status(400).json({ error: 'Overall experience rating must be a whole number between 1 and 10.' });
      }
      parsedExpRating = ratingNum;
    }
    const cleanExpFavEvent = String(exp_favourite_event || '').trim().slice(0, 1000) || null;
    const cleanExpIntlTrip = String(exp_international_trip || '').trim().slice(0, 500) || null;
    const cleanExpTripDest = String(exp_trip_month_destination || '').trim().slice(0, 300) || null;
    const cleanExpMissing = String(exp_missing || '').trim().slice(0, 2000) || null;

    if (membershipType === 'new') {
      if (!cleanHusbandDob) {
        return res.status(400).json({ error: 'Husband Date of Birth is required for new member applications.' });
      }
      if (!cleanHusbandBlood) {
        return res.status(400).json({ error: 'Husband Blood Group is required for new member applications.' });
      }
      if (!cleanHusbandQual) {
        return res.status(400).json({ error: 'Husband Educational Qualification is required for new member applications.' });
      }
      if (!cleanHusbandOcc) {
        return res.status(400).json({ error: 'Husband Occupation / Profession is required for new member applications.' });
      }
      if (!cleanHusbandOrg) {
        return res.status(400).json({ error: 'Husband Company / Business / Organization is required for new member applications.' });
      }
      if (!String(husband_photo_url || '').trim()) {
        return res.status(400).json({ error: 'Husband Photo is required for new member applications.' });
      }

      if (!cleanWifeDob) {
        return res.status(400).json({ error: 'Wife Date of Birth is required for new member applications.' });
      }
      if (!cleanWifeBlood) {
        return res.status(400).json({ error: 'Wife Blood Group is required for new member applications.' });
      }
      if (!cleanWifeQual) {
        return res.status(400).json({ error: 'Wife Educational Qualification is required for new member applications.' });
      }
      if (!String(wife_photo_url || '').trim()) {
        return res.status(400).json({ error: 'Wife Photo is required for new member applications.' });
      }

      if (!cleanMarriageAnniversary) {
        return res.status(400).json({ error: 'Marriage Anniversary date is required for new member applications.' });
      }
      if (!String(couple_photo_url || '').trim()) {
        return res.status(400).json({ error: 'Couple Photo is required for new member applications.' });
      }
      if (!cleanCurrentCity || !cleanNativePlace || !cleanResidentialAddress) {
        return res.status(400).json({ error: 'Current City, Native Place, and Residential Address are required for new member applications.' });
      }

      if (has_children) {
        if (parsedChildren.length === 0) {
          return res.status(400).json({ error: 'Please add details for at least one child or toggle "Have children?" off.' });
        }
        const incompleteChild = parsedChildren.some((c: any) =>
          !String(c?.name || '').trim() ||
          !String(c?.dob || '').trim() ||
          !String(c?.education || '').trim() ||
          !String(c?.photo_url || '').trim()
        );
        if (incompleteChild) {
          return res.status(400).json({
            error: 'All child fields (Full Name, Date of Birth, School/College/Profession, and Kid Photo with Parents) are required for new member applications.'
          });
        }
      }

      if (!cleanContributionAreas) {
        return res.status(400).json({ error: 'Please select at least one contribution area for new member applications.' });
      }
      if (!cleanRoyalIdea) {
        return res.status(400).json({ error: 'Please share One Grand Idea for JSG Royals Chapter 2 (2027).' });
      }
      if (cleanOtherGroupMember === 'Yes' && !cleanOtherGroupName) {
        return res.status(400).json({ error: 'Please specify the name of the other group you belong to.' });
      }
      if (!cleanBusinessDesc) {
        return res.status(400).json({ error: 'Business/Job details are required for new member applications.' });
      }
      if (!cleanNewMemberContribution) {
        return res.status(400).json({ error: 'Please share how you can contribute to the group.' });
      }
      if (!cleanRefName || cleanRefMobile.length !== 10) {
        return res.status(400).json({ error: 'Referring member name and valid 10-digit mobile number are required.' });
      }
    }

    const hEmail = husband_email.trim().toLowerCase();
    const wEmail = wife_email.trim().toLowerCase();
    const subEmail = (submitter_email || (subRole === 'wife' ? wEmail : hEmail)).trim().toLowerCase();

    // Find any existing household registration matching submitter_email, husband_email, or wife_email
    const existing = db.prepare(`
      SELECT * FROM family_registrations
      WHERE LOWER(submitter_email) IN (?, ?, ?)
         OR LOWER(husband_email) IN (?, ?, ?)
         OR LOWER(wife_email) IN (?, ?, ?)
      ORDER BY id DESC LIMIT 1
    `).get(subEmail, hEmail, wEmail, subEmail, hEmail, wEmail, subEmail, hEmail, wEmail) as any;

    const prefix = membershipType === 'new' ? 'APP' : 'ROYAL';
    const emailHash = crypto.createHash('sha256').update(subEmail).digest('hex').slice(0, 10).toUpperCase();
    const deterministicRegId = `${prefix}-${emailHash}`;
    const requestedRegId = typeof req.body?.reg_id === 'string' ? req.body.reg_id.trim().toUpperCase() : '';
    const regId = existing?.reg_id
      ? String(existing.reg_id)
      : /^(ROYAL|APP)-[A-Z0-9]{4,16}$/.test(requestedRegId)
        ? requestedRegId
        : deterministicRegId;

    const recordStatus = membershipType === 'new' ? 'pending_review' : 'submitted';
    const now = new Date().toISOString();
    const createdAtValue = existing?.created_at || now;
    const isUpdate = Boolean(existing);

    const normalizedHusbandPhoto = toPublicPhotoUrl(husband_photo_url, req);
    const normalizedWifePhoto = toPublicPhotoUrl(wife_photo_url, req);
    const normalizedCouplePhoto = toPublicPhotoUrl(couple_photo_url, req);
    const normalizedFamilyPhoto = toPublicPhotoUrl(family_photo_url, req);

    const normalizedChildrenArray = parsedChildren.map((c: any) => ({
      ...c,
      photo_url: toPublicPhotoUrl(c?.photo_url, req)
    }));

    // When an existing member submits an update omitting fixed or untouched optional fields,
    // preserve the existing database values instead of overwriting them with null/empty strings.
    const preserveExisting = isUpdate && membershipType === 'existing';
    const finalHusbandDob = preserveExisting ? (cleanHusbandDob || existing.husband_dob || null) : cleanHusbandDob;
    const finalHusbandQual = preserveExisting ? (cleanHusbandQual || existing.husband_qualification || null) : (cleanHusbandQual || null);
    const finalHusbandOcc = preserveExisting ? (cleanHusbandOcc || existing.husband_occupation || null) : (cleanHusbandOcc || null);
    const finalHusbandOrg = preserveExisting ? (cleanHusbandOrg || existing.husband_organization || null) : (cleanHusbandOrg || null);
    const finalHusbandBlood = preserveExisting ? (cleanHusbandBlood || existing.husband_blood_group || null) : (cleanHusbandBlood || null);
    const finalWifeDob = preserveExisting ? (cleanWifeDob || existing.wife_dob || null) : cleanWifeDob;
    const finalWifeQual = preserveExisting ? (cleanWifeQual || existing.wife_qualification || null) : (cleanWifeQual || null);
    const finalWifeOcc = preserveExisting ? (cleanWifeOcc || existing.wife_occupation || null) : (cleanWifeOcc || null);
    const finalWifeOrg = preserveExisting ? (cleanWifeOrg || existing.wife_organization || null) : (cleanWifeOrg || null);
    const finalWifeBlood = preserveExisting ? (cleanWifeBlood || existing.wife_blood_group || null) : (cleanWifeBlood || null);
    const finalMarriageAnniversary = preserveExisting ? (cleanMarriageAnniversary || existing.marriage_anniversary || '') : cleanMarriageAnniversary;
    const finalCurrentCity = preserveExisting ? (cleanCurrentCity || existing.current_city || '') : cleanCurrentCity;
    const finalResidentialAddress = preserveExisting ? (cleanResidentialAddress || existing.residential_address || '') : cleanResidentialAddress;
    const finalNativePlace = preserveExisting ? (cleanNativePlace || existing.native_place || null) : (cleanNativePlace || null);
    const finalHusbandPhoto = preserveExisting ? (normalizedHusbandPhoto || existing.husband_photo_url || null) : normalizedHusbandPhoto;
    const finalWifePhoto = preserveExisting ? (normalizedWifePhoto || existing.wife_photo_url || null) : normalizedWifePhoto;
    const finalCouplePhoto = preserveExisting ? (normalizedCouplePhoto || existing.couple_photo_url || null) : normalizedCouplePhoto;
    const finalFamilyPhoto = preserveExisting ? (normalizedFamilyPhoto || existing.family_photo_url || null) : normalizedFamilyPhoto;
    const finalContributionAreas = preserveExisting ? (cleanContributionAreas || existing.contribution_areas || null) : (cleanContributionAreas || null);
    const finalRoyalIdea = preserveExisting ? (cleanRoyalIdea || existing.royal_idea || null) : (cleanRoyalIdea || null);
    const finalExpRating = preserveExisting ? (parsedExpRating ?? existing.exp_rating ?? null) : parsedExpRating;
    const finalExpFavEvent = preserveExisting ? (cleanExpFavEvent || existing.exp_favourite_event || null) : cleanExpFavEvent;
    const finalExpIntlTrip = preserveExisting ? (cleanExpIntlTrip || existing.exp_international_trip || null) : cleanExpIntlTrip;
    const finalExpTripDest = preserveExisting
      ? (cleanExpTripDest || existing.exp_trip_month_destination || null)
      : cleanExpTripDest;
    const finalExpMissing = preserveExisting ? (cleanExpMissing || existing.exp_missing || null) : cleanExpMissing;

    let finalChildrenArray = normalizedChildrenArray;
    if (preserveExisting && has_children && finalChildrenArray.length === 0 && existing.children_json) {
      try {
        const prevKids = JSON.parse(existing.children_json);
        if (Array.isArray(prevKids) && prevKids.length > 0) {
          finalChildrenArray = prevKids;
        }
      } catch {}
    }
    const childrenJson = JSON.stringify(finalChildrenArray);

    const previewRecord = {
      reg_id: regId,
      submitted_by_role: subRole,
      submitter_email: subEmail,
      husband_name: husband_name.trim(),
      husband_mobile: husband_mobile.trim(),
      husband_email: hEmail,
      husband_dob: finalHusbandDob,
      husband_qualification: finalHusbandQual,
      husband_occupation: finalHusbandOcc,
      husband_organization: finalHusbandOrg,
      husband_blood_group: finalHusbandBlood,
      husband_instagram: cleanHusbandInstagram,
      wife_name: wife_name.trim(),
      wife_mobile: wife_mobile.trim(),
      wife_email: wEmail,
      wife_dob: finalWifeDob,
      wife_qualification: finalWifeQual,
      wife_occupation: finalWifeOcc,
      wife_organization: finalWifeOrg,
      wife_blood_group: finalWifeBlood,
      wife_instagram: cleanWifeInstagram,
      marriage_anniversary: finalMarriageAnniversary,
      current_city: finalCurrentCity,
      residential_address: finalResidentialAddress,
      native_place: finalNativePlace,
      has_children: has_children ? 1 : 0,
      children_json: childrenJson,
      husband_photo_url: finalHusbandPhoto,
      wife_photo_url: finalWifePhoto,
      couple_photo_url: finalCouplePhoto,
      family_photo_url: finalFamilyPhoto,
      contribution_areas: finalContributionAreas,
      royal_idea: finalRoyalIdea,
      jsg_should_be_known_for: jsg_should_be_known_for || null,
      president_name: cleanPresName,
      president_mobile: cleanPresMobile || null,
      secretary_name: cleanSecName,
      secretary_mobile: cleanSecMobile || null,
      membership_type: membershipType,
      other_group_member: membershipType === 'new' ? cleanOtherGroupMember : null,
      other_group_name: membershipType === 'new' && cleanOtherGroupMember === 'Yes' ? cleanOtherGroupName : null,
      other_group_position: membershipType === 'new' ? cleanOtherGroupPosition : null,
      new_member_contribution: membershipType === 'new' ? cleanNewMemberContribution : null,
      reference_name: membershipType === 'new' ? cleanRefName : null,
      reference_mobile: membershipType === 'new' ? cleanRefMobile : null,
      business_description: membershipType === 'new' ? cleanBusinessDesc : null,
      exp_rating: finalExpRating,
      exp_favourite_event: finalExpFavEvent,
      exp_international_trip: finalExpIntlTrip,
      exp_trip_month_destination: finalExpTripDest,
      exp_missing: finalExpMissing,
      status: recordStatus,
      created_at: createdAtValue,
      updated_at: now,
    };

    if (req.body?.validate_only === true) {
      const normalizedPreview = normalizeFamilyRecordPhotos(previewRecord, finalChildrenArray, req);
      return res.json({
        success: true,
        validateOnly: true,
        updated: isUpdate,
        regId,
        membershipType,
        registration: normalizedPreview,
        vaultEntries: encryptRegistrationForVaults(normalizedPreview),
      });
    }

    const tx = db.transaction(() => {
      if (isUpdate) {
        db.prepare(`
          UPDATE family_registrations SET
            submitted_by_role = ?,
            submitter_email = ?,
            husband_name = ?,
            husband_mobile = ?,
            husband_email = ?,
            husband_dob = ?,
            husband_qualification = ?,
            husband_occupation = ?,
            husband_organization = ?,
            husband_blood_group = ?,
            husband_instagram = ?,
            wife_name = ?,
            wife_mobile = ?,
            wife_email = ?,
            wife_dob = ?,
            wife_qualification = ?,
            wife_occupation = ?,
            wife_organization = ?,
            wife_blood_group = ?,
            wife_instagram = ?,
            marriage_anniversary = ?,
            current_city = ?,
            residential_address = ?,
            native_place = ?,
            has_children = ?,
            children_json = ?,
            husband_photo_url = ?,
            wife_photo_url = ?,
            couple_photo_url = ?,
            family_photo_url = ?,
            contribution_areas = ?,
            royal_idea = ?,
            jsg_should_be_known_for = ?,
            president_name = ?,
            president_mobile = ?,
            secretary_name = ?,
            secretary_mobile = ?,
            membership_type = ?,
            other_group_member = ?,
            other_group_name = ?,
            other_group_position = ?,
            new_member_contribution = ?,
            reference_name = ?,
            reference_mobile = ?,
            business_description = ?,
            exp_rating = ?,
            exp_favourite_event = ?,
            exp_international_trip = ?,
            exp_trip_month_destination = ?,
            exp_missing = ?,
            status = ?,
            updated_at = ?
          WHERE reg_id = ?
        `).run(
          subRole, subEmail,
          husband_name.trim(), husband_mobile.trim(), hEmail, finalHusbandDob,
          finalHusbandQual, finalHusbandOcc, finalHusbandOrg, finalHusbandBlood, cleanHusbandInstagram,
          wife_name.trim(), wife_mobile.trim(), wEmail, finalWifeDob,
          finalWifeQual, finalWifeOcc, finalWifeOrg, finalWifeBlood, cleanWifeInstagram,
          finalMarriageAnniversary, finalCurrentCity, finalResidentialAddress, finalNativePlace,
          has_children ? 1 : 0, childrenJson,
          finalHusbandPhoto, finalWifePhoto, finalCouplePhoto, finalFamilyPhoto,
          finalContributionAreas, finalRoyalIdea, jsg_should_be_known_for || null,
          cleanPresName, cleanPresMobile || null, cleanSecName, cleanSecMobile || null,
          membershipType,
          membershipType === 'new' ? cleanOtherGroupMember : null,
          membershipType === 'new' && cleanOtherGroupMember === 'Yes' ? cleanOtherGroupName : null,
          membershipType === 'new' ? cleanOtherGroupPosition : null,
          membershipType === 'new' ? cleanNewMemberContribution : null,
          membershipType === 'new' ? cleanRefName : null,
          membershipType === 'new' ? cleanRefMobile : null,
          membershipType === 'new' ? cleanBusinessDesc : null,
          finalExpRating,
          finalExpFavEvent,
          finalExpIntlTrip,
          finalExpTripDest,
          finalExpMissing,
          recordStatus, now, regId
        );
      } else {
        db.prepare(`
          INSERT INTO family_registrations (
            reg_id, submitted_by_role, submitter_email,
            husband_name, husband_mobile, husband_email, husband_dob,
            husband_qualification, husband_occupation, husband_organization, husband_blood_group, husband_instagram,
            wife_name, wife_mobile, wife_email, wife_dob,
            wife_qualification, wife_occupation, wife_organization, wife_blood_group, wife_instagram,
            marriage_anniversary, current_city, residential_address, native_place,
            has_children, children_json,
            husband_photo_url, wife_photo_url, couple_photo_url, family_photo_url,
            contribution_areas, royal_idea, jsg_should_be_known_for,
            president_name, president_mobile, secretary_name, secretary_mobile,
            membership_type, other_group_member, other_group_name, other_group_position,
            new_member_contribution, reference_name, reference_mobile, business_description,
            exp_rating, exp_favourite_event, exp_international_trip, exp_trip_month_destination, exp_missing,
            status, created_at, updated_at
          ) VALUES (
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `).run(
          regId, subRole, subEmail,
          husband_name.trim(), husband_mobile.trim(), hEmail, cleanHusbandDob,
          cleanHusbandQual || null, cleanHusbandOcc || null, cleanHusbandOrg || null, cleanHusbandBlood || null, cleanHusbandInstagram,
          wife_name.trim(), wife_mobile.trim(), wEmail, cleanWifeDob,
          cleanWifeQual || null, cleanWifeOcc || null, cleanWifeOrg || null, cleanWifeBlood || null, cleanWifeInstagram,
          cleanMarriageAnniversary, cleanCurrentCity, cleanResidentialAddress, cleanNativePlace || null,
          has_children ? 1 : 0, childrenJson,
          normalizedHusbandPhoto, normalizedWifePhoto, normalizedCouplePhoto, normalizedFamilyPhoto,
          cleanContributionAreas || null, cleanRoyalIdea || null, jsg_should_be_known_for || null,
          cleanPresName, cleanPresMobile || null, cleanSecName, cleanSecMobile || null,
          membershipType,
          membershipType === 'new' ? cleanOtherGroupMember : null,
          membershipType === 'new' && cleanOtherGroupMember === 'Yes' ? cleanOtherGroupName : null,
          membershipType === 'new' ? cleanOtherGroupPosition : null,
          membershipType === 'new' ? cleanNewMemberContribution : null,
          membershipType === 'new' ? cleanRefName : null,
          membershipType === 'new' ? cleanRefMobile : null,
          membershipType === 'new' ? cleanBusinessDesc : null,
          parsedExpRating, cleanExpFavEvent, cleanExpIntlTrip, cleanExpTripDest, cleanExpMissing,
          recordStatus, createdAtValue, now
        );
      }

      if (membershipType === 'new') {
        const applicantName = subRole === 'wife' ? wife_name.trim() : husband_name.trim();
        const applicantMobile = (subRole === 'wife' ? wife_mobile : husband_mobile).replace(/\D/g, '').slice(-10) || '';
        const existingApp = db.prepare(`
          SELECT app_id FROM new_member_applications
          WHERE app_id = ? OR LOWER(email) IN (?, ?, ?)
          ORDER BY id DESC LIMIT 1
        `).get(regId, subEmail, hEmail, wEmail) as any;

        if (existingApp) {
          db.prepare(`
            UPDATE new_member_applications SET
              applicant_name = ?,
              business_name = ?,
              mobile_number = ?,
              email = ?,
              other_group_member = ?,
              other_group_name = ?,
              other_group_position = ?,
              contribution = ?,
              reference_name = ?,
              reference_mobile = ?,
              business_description = ?,
              president_name = ?,
              president_mobile = ?,
              secretary_name = ?,
              secretary_mobile = ?,
              status = 'pending_review',
              updated_at = ?
            WHERE app_id = ?
          `).run(
            applicantName,
            primaryOrg,
            applicantMobile,
            subEmail,
            cleanOtherGroupMember,
            cleanOtherGroupMember === 'Yes' ? cleanOtherGroupName : null,
            cleanOtherGroupPosition,
            cleanNewMemberContribution,
            cleanRefName,
            cleanRefMobile,
            cleanBusinessDesc,
            cleanPresName,
            cleanPresMobile,
            cleanSecName,
            cleanSecMobile,
            now,
            existingApp.app_id
          );
        } else {
          db.prepare(`
            INSERT INTO new_member_applications (
              app_id, applicant_name, business_name, mobile_number, email,
              other_group_member, other_group_name, other_group_position, contribution,
              reference_name, reference_mobile, business_description,
              president_name, president_mobile, secretary_name, secretary_mobile,
              status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)
          `).run(
            regId,
            applicantName,
            primaryOrg,
            applicantMobile,
            subEmail,
            cleanOtherGroupMember,
            cleanOtherGroupMember === 'Yes' ? cleanOtherGroupName : null,
            cleanOtherGroupPosition,
            cleanNewMemberContribution,
            cleanRefName,
            cleanRefMobile,
            cleanBusinessDesc,
            cleanPresName,
            cleanPresMobile,
            cleanSecName,
            cleanSecMobile,
            createdAtValue,
            now
          );
        }
      }
    });

    tx();

    // Clear any prior admin deletion tombstone when a family genuinely submits/re-registers
    try {
      const clearStmt = db.prepare(
        'DELETE FROM deleted_tombstones WHERE record_type = ? AND (UPPER(record_id) = UPPER(?) OR LOWER(email) = LOWER(?))'
      );
      for (const em of new Set([subEmail, hEmail, wEmail].filter(Boolean))) {
        clearStmt.run('family', regId, em);
        if (membershipType === 'new') {
          clearStmt.run('application', regId, em);
        }
      }
    } catch {}

    const created = db.prepare('SELECT * FROM family_registrations WHERE reg_id = ?').get(regId) as any;
    let parsedCreatedChildren = [];
    try {
      parsedCreatedChildren = created.children_json ? JSON.parse(created.children_json) : [];
    } catch (e) {}

    const normalizedCreated = normalizeFamilyRecordPhotos(created, parsedCreatedChildren, req);
    res.json({
      success: true,
      updated: isUpdate,
      regId,
      membershipType,
      notice:
        membershipType === 'new'
          ? 'This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.'
          : undefined,
      message: isUpdate
        ? (membershipType === 'new'
            ? 'New member application updated successfully!'
            : 'Family dossier updated successfully!')
        : (membershipType === 'new'
            ? 'New member application submitted for review!'
            : 'Family dossier registered successfully!'),
      registration: normalizedCreated,
      vaultEntries: encryptRegistrationForVaults(normalizedCreated),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit family registration.' });
  }
});

// Helper to save validated image buffer to disk + SQLite
function persistUploadedFamilyPhoto(buffer: Buffer, req: Request) {
  const validation = validateImageMagicBytes(buffer);
  if (!validation.valid) {
    return { error: validation.error || 'Invalid image file format.' };
  }

  const ext = validation.ext || 'jpg';
  const mime = validation.detectedMime || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  const filename = `family_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const targetDir = path.resolve(photosBaseDir, 'family');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.resolve(targetDir, filename);
  fs.writeFileSync(filePath, buffer);

  // Also persist in SQLite so images remain accessible across restarts / serverless cold starts
  db.prepare(`
    INSERT OR REPLACE INTO family_photos (filename, mime_type, data, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(filename, mime, buffer, buffer.length, new Date().toISOString());

  const relativeUrl = `/api/family/photo/${filename}`;
  const publicUrl = `${resolvePublicAppOrigin(req)}${relativeUrl}`;

  return {
    success: true,
    filename,
    url: publicUrl,
    relativeUrl
  };
}

// 3. Upload family photo (persists to both disk and SQLite for zero-loss serving)
apiRouter.post('/family/upload-photo', handlePhotoUploadMiddleware, (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please choose an image file to upload.' });
    }

    const result = persistUploadedFamilyPhoto(req.file.buffer, req);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to upload photo.' });
  }
});

// 3a. JSON Base64 fallback upload endpoint (handles proxies/browsers where multipart upload drops)
apiRouter.post('/family/upload-photo-base64', (req: Request, res: Response) => {
  try {
    const rawData = typeof req.body?.data === 'string' ? req.body.data : '';
    if (!rawData) {
      return res.status(400).json({ error: 'No image data received.' });
    }

    const base64Payload = rawData.includes(',') ? rawData.split(',').pop() || '' : rawData;
    const buffer = Buffer.from(base64Payload, 'base64');
    if (buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ error: 'Photo exceeds maximum allowed size of 25 MB.' });
    }

    const result = persistUploadedFamilyPhoto(buffer, req);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to upload photo.' });
  }
});

// 3b. Serve uploaded family/individual photos cleanly — completely open/public (no auth required)
apiRouter.get('/family/photo/:filename', (req: Request, res: Response) => {
  try {
    let rawParam = req.params.filename || '';
    try {
      rawParam = decodeURIComponent(rawParam);
    } catch {}
    const safeFilename = path.basename(rawParam).split('?')[0].split('#')[0].trim();
    if (!safeFilename || safeFilename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const targetDir = path.resolve(photosBaseDir, 'family');
    const filePath = path.resolve(targetDir, safeFilename);
    const ext = path.extname(safeFilename).toLowerCase();
    const fallbackMime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="${safeFilename}"`
    );

    if (filePath.startsWith(targetDir) && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', fallbackMime);
      return res.sendFile(filePath);
    }

    // Fallback to SQLite binary storage
    const row = db
      .prepare('SELECT mime_type, data FROM family_photos WHERE filename = ?')
      .get(safeFilename) as { mime_type: string; data: Buffer } | undefined;

    if (!row || !row.data) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    // Rehydrate disk cache silently
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(filePath, row.data);
    } catch (e) {}

    res.setHeader('Content-Type', row.mime_type || fallbackMime);
    return res.send(row.data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to serve photo.' });
  }
});

// 4. Admin API to view all fresh family registrations
apiRouter.get('/admin/family-registrations', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM family_registrations ORDER BY id DESC').all() as any[];
    const filteredRows = rows.filter((r) => !isFamilyRegistrationTombstoned(r));

    const formatted = filteredRows.map((r) => {
      let children = [];
      try {
        children = r.children_json ? JSON.parse(r.children_json) : [];
      } catch (e) {}
      return normalizeFamilyRecordPhotos(r, children, req);
    });
    res.json({ success: true, count: formatted.length, registrations: formatted });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve family registrations.' });
  }
});

// 5. Submit New Member Application (Prospective Members)
apiRouter.post('/family/new-member-application', (req: Request, res: Response) => {
  try {
    const {
      applicant_name,
      business_name,
      mobile_number,
      email,
      other_group_member,
      other_group_name,
      other_group_position,
      contribution,
      reference_name,
      reference_mobile,
      business_description,
      president_name,
      president_mobile,
      secretary_name,
      secretary_mobile,
    } = req.body || {};

    const cleanName = String(applicant_name || '').trim();
    const cleanBusiness = String(business_name || '').trim();
    const cleanMobile = String(mobile_number || '').replace(/\D/g, '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanOtherMember = other_group_member === 'Yes' ? 'Yes' : 'No';
    const cleanOtherGroupName = String(other_group_name || '').trim();
    const cleanOtherGroupPosition =
      cleanOtherMember === 'Yes'
        ? String(other_group_position || '').trim().slice(0, 200) || null
        : null;
    const cleanContribution = String(contribution || '').trim();
    const cleanRefName = String(reference_name || '').trim();
    const cleanRefMobile = String(reference_mobile || '').replace(/\D/g, '');
    const cleanBusinessDesc = String(business_description || '').trim();
    const cleanPresName = String(president_name || 'Utkarsh Pooja Surana').trim() || 'Utkarsh Pooja Surana';
    const cleanPresMobile = String(president_mobile || '8770713343').replace(/\D/g, '') || '8770713343';
    const cleanSecName = String(secretary_name || 'Harsh Tanya Kataria').trim() || 'Harsh Tanya Kataria';
    const cleanSecMobile = String(secretary_mobile || '9669618111').replace(/\D/g, '') || '9669618111';

    if (!cleanName || !cleanBusiness || !cleanEmail) {
      return res.status(400).json({ error: 'Applicant name, business name, and email are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ error: 'Applicant mobile number must be exactly 10 digits.' });
    }
    if (cleanOtherMember === 'Yes' && !cleanOtherGroupName) {
      return res.status(400).json({ error: 'Please specify the other group name.' });
    }
    if (!cleanContribution) {
      return res.status(400).json({ error: 'Please share how you can contribute to the group.' });
    }
    if (!cleanRefName || cleanRefMobile.length !== 10) {
      return res.status(400).json({ error: 'Referring member name and valid 10-digit mobile number are required.' });
    }
    if (!cleanBusinessDesc) {
      return res.status(400).json({ error: 'Business/Job details are required.' });
    }

    const existingApp = db.prepare('SELECT * FROM new_member_applications WHERE LOWER(email) = ? ORDER BY id DESC LIMIT 1').get(cleanEmail) as any;
    const emailHash = crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 10).toUpperCase();
    const appId = existingApp?.app_id || `APP-${emailHash}`;
    const now = new Date().toISOString();

    if (existingApp) {
      db.prepare(`
        UPDATE new_member_applications SET
          applicant_name = ?,
          business_name = ?,
          mobile_number = ?,
          email = ?,
          other_group_member = ?,
          other_group_name = ?,
          other_group_position = ?,
          contribution = ?,
          reference_name = ?,
          reference_mobile = ?,
          business_description = ?,
          president_name = ?,
          president_mobile = ?,
          secretary_name = ?,
          secretary_mobile = ?,
          status = 'pending_review',
          updated_at = ?
        WHERE app_id = ?
      `).run(
        cleanName,
        cleanBusiness,
        cleanMobile,
        cleanEmail,
        cleanOtherMember,
        cleanOtherMember === 'Yes' ? cleanOtherGroupName : null,
        cleanOtherGroupPosition,
        cleanContribution,
        cleanRefName,
        cleanRefMobile,
        cleanBusinessDesc,
        cleanPresName,
        cleanPresMobile,
        cleanSecName,
        cleanSecMobile,
        now,
        appId
      );
    } else {
      db.prepare(`
        INSERT INTO new_member_applications (
          app_id, applicant_name, business_name, mobile_number, email,
          other_group_member, other_group_name, other_group_position, contribution,
          reference_name, reference_mobile, business_description,
          president_name, president_mobile, secretary_name, secretary_mobile,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?)
      `).run(
        appId,
        cleanName,
        cleanBusiness,
        cleanMobile,
        cleanEmail,
        cleanOtherMember,
        cleanOtherMember === 'Yes' ? cleanOtherGroupName : null,
        cleanOtherGroupPosition,
        cleanContribution,
        cleanRefName,
        cleanRefMobile,
        cleanBusinessDesc,
        cleanPresName,
        cleanPresMobile,
        cleanSecName,
        cleanSecMobile,
        now,
        now
      );
    }

    // Clear any prior admin deletion tombstone when an applicant genuinely re-submits
    try {
      db.prepare('DELETE FROM deleted_tombstones WHERE record_type = ? AND (UPPER(record_id) = UPPER(?) OR LOWER(email) = LOWER(?))').run('application', appId, cleanEmail);
    } catch {}

    const created = db.prepare('SELECT * FROM new_member_applications WHERE app_id = ?').get(appId);

    res.json({
      success: true,
      updated: Boolean(existingApp),
      appId,
      notice: 'This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.',
      application: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit new member application.' });
  }
});

// 6. Admin API to view all New Member Applications
apiRouter.get('/admin/new-member-applications', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM new_member_applications ORDER BY id DESC').all() as any[];
    const tombstones = db
      .prepare('SELECT record_id, email, deleted_at FROM deleted_tombstones WHERE record_type = ?')
      .all('application') as Array<{ record_id: string; email: string | null; deleted_at: string }>;

    const filteredRows = rows.filter((a) => {
      const appTime = new Date(a.updated_at || a.created_at || 0).getTime() || 0;
      const appIdUpper = String(a.app_id || '').toUpperCase();
      const appEmail = String(a.email || '').trim().toLowerCase();
      return !tombstones.some((t) => {
        const delTime = new Date(t.deleted_at || 0).getTime() || 0;
        const idMatch = t.record_id && String(t.record_id).toUpperCase() === appIdUpper;
        const emailMatch = t.email && appEmail && t.email.toLowerCase() === appEmail;
        return (idMatch || emailMatch) && appTime <= delTime;
      });
    });

    res.json({ success: true, count: filteredRows.length, applications: filteredRows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve new member applications.' });
  }
});

function extractFamilyPhotoFilenameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  const marker = '/api/family/photo/';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const filename = path.basename(trimmed.slice(idx + marker.length).split('?')[0].trim());
    if (/^[a-zA-Z0-9_\-.]+$/.test(filename) && filename.length >= 3 && filename.length <= 160) {
      return filename;
    }
  }
  return null;
}

function collectFamilyRegistrationPhotoFilenames(row: any): string[] {
  if (!row) return [];
  const urls: Array<string | null | undefined> = [
    row.husband_photo_url,
    row.wife_photo_url,
    row.couple_photo_url,
    row.family_photo_url,
  ];
  let children: any[] = [];
  if (Array.isArray(row.children)) {
    children = row.children;
  } else if (typeof row.children_json === 'string' && row.children_json.trim()) {
    try {
      const parsed = JSON.parse(row.children_json);
      if (Array.isArray(parsed)) children = parsed;
    } catch {}
  }
  for (const child of children) {
    if (child?.photo_url) urls.push(child.photo_url);
  }
  const names = urls
    .map((u) => extractFamilyPhotoFilenameFromUrl(u))
    .filter((f): f is string => Boolean(f));
  return Array.from(new Set(names));
}

function cleanupUnreferencedFamilyPhotos(candidateFilenames: string[]): string[] {
  if (candidateFilenames.length === 0) return [];
  const remainingRows = db
    .prepare(
      'SELECT husband_photo_url, wife_photo_url, couple_photo_url, family_photo_url, children_json FROM family_registrations'
    )
    .all() as any[];

  const stillReferenced = new Set<string>();
  for (const row of remainingRows) {
    for (const fname of collectFamilyRegistrationPhotoFilenames(row)) {
      stillReferenced.add(fname);
    }
  }

  const deletedPhotoIds: string[] = [];
  const familyPhotoDir = path.resolve(photosBaseDir, 'family');

  for (const filename of candidateFilenames) {
    if (stillReferenced.has(filename)) continue;
    db.prepare('DELETE FROM family_photos WHERE filename = ?').run(filename);
    const filePath = path.resolve(familyPhotoDir, filename);
    if (filePath.startsWith(familyPhotoDir) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    deletedPhotoIds.push(filename);
  }
  return deletedPhotoIds;
}

// 7. Admin DELETE Family Registration (and linked new member application + duplicate email siblings + orphaned photos)
apiRouter.delete('/admin/family-registrations/:regId', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    let regId = String(req.params.regId || '').trim();
    try {
      regId = decodeURIComponent(regId).trim();
    } catch {}
    if (!regId || regId.length > 160 || regId.includes('..')) {
      return res.status(400).json({ error: 'Invalid registration ID.' });
    }

    const queryEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const existingRows = db
      .prepare(
        `SELECT * FROM family_registrations
         WHERE UPPER(reg_id) = UPPER(?)
            OR (? != '' AND (LOWER(submitter_email) = ? OR LOWER(husband_email) = ? OR LOWER(wife_email) = ?))`
      )
      .all(regId, queryEmail, queryEmail, queryEmail, queryEmail) as any[];

    const primaryExisting = existingRows[0] || null;
    const resolvedEmail =
      queryEmail ||
      String(primaryExisting?.submitter_email || '').trim().toLowerCase();

    const allMatchedRows = resolvedEmail
      ? (db
          .prepare(
            `SELECT * FROM family_registrations
             WHERE UPPER(reg_id) = UPPER(?)
                OR LOWER(submitter_email) = ?
                OR LOWER(husband_email) = ?
                OR LOWER(wife_email) = ?`
          )
          .all(regId, resolvedEmail, resolvedEmail, resolvedEmail) as any[])
      : existingRows;

    const allEmails = Array.from(
      new Set(
        [
          queryEmail,
          ...allMatchedRows.flatMap((r) => [r?.submitter_email, r?.husband_email, r?.wife_email]),
        ]
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    );

    const candidatePhotos = Array.from(
      new Set(allMatchedRows.flatMap((row) => collectFamilyRegistrationPhotoFilenames(row)))
    );

    let deletedLocal = false;
    let deletedLinkedApp = false;
    let deletedPhotoIds: string[] = [];
    const nowIso = new Date().toISOString();

    const tx = db.transaction(() => {
      let regChanges = db.prepare('DELETE FROM family_registrations WHERE UPPER(reg_id) = UPPER(?)').run(regId).changes;
      let appChanges = db.prepare('DELETE FROM new_member_applications WHERE UPPER(app_id) = UPPER(?)').run(regId).changes;

      for (const em of allEmails) {
        regChanges += db
          .prepare(
            `DELETE FROM family_registrations
             WHERE LOWER(submitter_email) = ? OR LOWER(husband_email) = ? OR LOWER(wife_email) = ?`
          )
          .run(em, em, em).changes;
        appChanges += db
          .prepare('DELETE FROM new_member_applications WHERE LOWER(email) = ?')
          .run(em).changes;
      }

      deletedLocal = regChanges > 0;
      deletedLinkedApp = appChanges > 0;

      const idsToTombstone = Array.from(
        new Set([regId, ...allMatchedRows.map((r) => String(r.reg_id || '').trim())].filter(Boolean))
      );
      const insertTomb = db.prepare(`
        INSERT OR REPLACE INTO deleted_tombstones (record_type, record_id, email, deleted_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const tid of idsToTombstone) {
        if (allEmails.length === 0) {
          insertTomb.run('family', tid.toUpperCase(), null, nowIso);
          insertTomb.run('application', tid.toUpperCase(), null, nowIso);
        } else {
          for (const em of allEmails) {
            insertTomb.run('family', `${tid.toUpperCase()}:${em}`, em, nowIso);
            insertTomb.run('application', `${tid.toUpperCase()}:${em}`, em, nowIso);
          }
          insertTomb.run('family', tid.toUpperCase(), allEmails[0], nowIso);
          insertTomb.run('application', tid.toUpperCase(), allEmails[0], nowIso);
        }
      }

      deletedPhotoIds = cleanupUnreferencedFamilyPhotos(candidatePhotos);
    });

    tx();

    const label = primaryExisting
      ? `${primaryExisting.husband_name || ''} & ${primaryExisting.wife_name || ''} (${primaryExisting.submitter_email || resolvedEmail || ''})`
      : regId;
    logAdminAudit(
      req.admin!.email,
      'DELETE_FAMILY_REGISTRATION',
      regId,
      `Removed family registration from database: ${label}`
    );

    const deletedVaultIds = Array.from(
      new Set(allEmails.map((em) => computeVaultIdForEmail(em)).filter(Boolean))
    );

    res.json({
      success: true,
      regId,
      deletedLocal,
      deletedLinkedApp,
      deletedPhotoIds,
      deletedVaultIds,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete family registration.' });
  }
});

// 8. Admin DELETE New Member Application (and mirrored family registration + duplicates if same ID/email)
apiRouter.delete('/admin/new-member-applications/:appId', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    let appId = String(req.params.appId || '').trim();
    try {
      appId = decodeURIComponent(appId).trim();
    } catch {}
    if (!appId || appId.length > 160 || appId.includes('..')) {
      return res.status(400).json({ error: 'Invalid application ID.' });
    }

    const queryEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const existingApp = db
      .prepare('SELECT * FROM new_member_applications WHERE UPPER(app_id) = UPPER(?)')
      .get(appId) as any;
    const resolvedEmail =
      queryEmail || String(existingApp?.email || '').trim().toLowerCase();

    const linkedRegs = resolvedEmail
      ? (db
          .prepare(
            `SELECT * FROM family_registrations
             WHERE UPPER(reg_id) = UPPER(?) OR LOWER(submitter_email) = ?`
          )
          .all(appId, resolvedEmail) as any[])
      : (db.prepare('SELECT * FROM family_registrations WHERE UPPER(reg_id) = UPPER(?)').all(appId) as any[]);

    const allEmails = Array.from(
      new Set(
        [
          queryEmail,
          existingApp?.email,
          ...linkedRegs.flatMap((r) => [r?.submitter_email, r?.husband_email, r?.wife_email]),
        ]
          .map((e) => String(e || '').trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    );

    const candidatePhotos = Array.from(
      new Set(linkedRegs.flatMap((row) => collectFamilyRegistrationPhotoFilenames(row)))
    );

    let deletedLocal = false;
    let deletedLinkedReg = false;
    let deletedPhotoIds: string[] = [];
    const nowIso = new Date().toISOString();

    const tx = db.transaction(() => {
      let appChanges = db.prepare('DELETE FROM new_member_applications WHERE UPPER(app_id) = UPPER(?)').run(appId).changes;
      let regChanges = db.prepare('DELETE FROM family_registrations WHERE UPPER(reg_id) = UPPER(?)').run(appId).changes;

      for (const em of allEmails) {
        appChanges += db
          .prepare('DELETE FROM new_member_applications WHERE LOWER(email) = ?')
          .run(em).changes;
        regChanges += db
          .prepare(
            `DELETE FROM family_registrations
             WHERE LOWER(submitter_email) = ? OR LOWER(husband_email) = ? OR LOWER(wife_email) = ?`
          )
          .run(em, em, em).changes;
      }

      deletedLocal = appChanges > 0;
      deletedLinkedReg = regChanges > 0;

      const idsToTombstone = Array.from(
        new Set([appId, ...linkedRegs.map((r) => String(r.reg_id || '').trim())].filter(Boolean))
      );
      const insertTomb = db.prepare(`
        INSERT OR REPLACE INTO deleted_tombstones (record_type, record_id, email, deleted_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const tid of idsToTombstone) {
        if (allEmails.length === 0) {
          insertTomb.run('application', tid.toUpperCase(), null, nowIso);
          insertTomb.run('family', tid.toUpperCase(), null, nowIso);
        } else {
          for (const em of allEmails) {
            insertTomb.run('application', `${tid.toUpperCase()}:${em}`, em, nowIso);
            insertTomb.run('family', `${tid.toUpperCase()}:${em}`, em, nowIso);
          }
          insertTomb.run('application', tid.toUpperCase(), allEmails[0], nowIso);
          insertTomb.run('family', tid.toUpperCase(), allEmails[0], nowIso);
        }
      }

      deletedPhotoIds = cleanupUnreferencedFamilyPhotos(candidatePhotos);
    });

    tx();

    const label = existingApp
      ? `${existingApp.applicant_name || ''} (${existingApp.email || resolvedEmail || ''})`
      : appId;
    logAdminAudit(
      req.admin!.email,
      'DELETE_NEW_MEMBER_APPLICATION',
      appId,
      `Removed new member application from database: ${label}`
    );

    const deletedVaultIds = Array.from(
      new Set(allEmails.map((em) => computeVaultIdForEmail(em)).filter(Boolean))
    );

    res.json({
      success: true,
      appId,
      deletedLocal,
      deletedLinkedReg,
      deletedPhotoIds,
      deletedVaultIds,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete new member application.' });
  }
});

// 9. Admin DELETE Year-1 / Year-2 Roster Member (cascades profile, preferences, submissions, notes, photos)
apiRouter.delete('/admin/member/:coupleId', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    let coupleId = String(req.params.coupleId || '').trim().toUpperCase();
    try {
      coupleId = decodeURIComponent(coupleId).trim().toUpperCase();
    } catch {}
    if (!coupleId || coupleId.length > 64 || coupleId.includes('..')) {
      return res.status(400).json({ error: 'Invalid Couple ID.' });
    }

    const existingMember = db
      .prepare('SELECT * FROM members WHERE UPPER(couple_id) = UPPER(?)')
      .get(coupleId) as any;
    const existingPhotos = db
      .prepare('SELECT storage_path FROM photos WHERE UPPER(couple_id) = UPPER(?)')
      .all(coupleId) as any[];

    let deletedLocal = false;
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM otp_codes WHERE UPPER(couple_id) = UPPER(?)').run(coupleId);
      const resDel = db.prepare('DELETE FROM members WHERE UPPER(couple_id) = UPPER(?)').run(coupleId);
      deletedLocal = resDel.changes > 0;
    });
    tx();

    const coupleDir = path.resolve(photosBaseDir, coupleId);
    for (const p of existingPhotos) {
      if (p?.storage_path) {
        const filePath = path.resolve(process.cwd(), p.storage_path);
        if (filePath.startsWith(coupleDir) && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
      }
    }

    const label = existingMember
      ? `${existingMember.husband_name || ''} & ${existingMember.wife_name || ''}`
      : coupleId;
    logAdminAudit(
      req.admin!.email,
      'DELETE_MEMBER',
      coupleId,
      `Removed roster member and linked records from database: ${label}`
    );

    res.json({
      success: true,
      coupleId,
      deletedLocal,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete member record.' });
  }
});

// 10. Admin Cloud Archive Reconciliation (prunes SQLite records that were deleted in Firebase Firestore)
apiRouter.post('/admin/reconcile-cloud', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const cloudRegIdsProvided = Array.isArray(req.body?.cloudRegIds);
    const cloudAppIdsProvided = Array.isArray(req.body?.cloudAppIds);
    const snapshotTimestampMs =
      typeof req.body?.snapshotTimestampMs === 'number' && Number.isFinite(req.body.snapshotTimestampMs)
        ? req.body.snapshotTimestampMs
        : Date.now();
    // Leave a 15-second grace window so any concurrent live submission is never prematurely pruned
    const cutoffMs = snapshotTimestampMs - 15_000;

    const cloudRegSet = new Set(
      (cloudRegIdsProvided ? req.body.cloudRegIds : []).map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
    );
    const cloudAppSet = new Set(
      (cloudAppIdsProvided ? req.body.cloudAppIds : []).map((id: any) => String(id || '').trim().toUpperCase()).filter(Boolean)
    );

    let prunedRegistrations = 0;
    let prunedApplications = 0;
    let deletedPhotoIds: string[] = [];

    const tx = db.transaction(() => {
      const candidatePhotos: string[] = [];

      if (cloudRegIdsProvided) {
        const localRegs = db.prepare('SELECT * FROM family_registrations').all() as any[];
        for (const row of localRegs) {
          const idUpper = String(row.reg_id || '').trim().toUpperCase();
          const rowTime = new Date(row.updated_at || row.created_at || 0).getTime() || 0;
          if (!cloudRegSet.has(idUpper) && rowTime <= cutoffMs) {
            candidatePhotos.push(...collectFamilyRegistrationPhotoFilenames(row));
            db.prepare('DELETE FROM family_registrations WHERE id = ?').run(row.id);
            prunedRegistrations++;
          }
        }
      }

      if (cloudAppIdsProvided) {
        const localApps = db.prepare('SELECT * FROM new_member_applications').all() as any[];
        for (const row of localApps) {
          const idUpper = String(row.app_id || '').trim().toUpperCase();
          const rowTime = new Date(row.updated_at || row.created_at || 0).getTime() || 0;
          if (!cloudAppSet.has(idUpper) && rowTime <= cutoffMs) {
            db.prepare('DELETE FROM new_member_applications WHERE id = ?').run(row.id);
            prunedApplications++;
          }
        }
      }

      if (candidatePhotos.length > 0) {
        deletedPhotoIds = cleanupUnreferencedFamilyPhotos(Array.from(new Set(candidatePhotos)));
      }
    });

    tx();

    res.json({
      success: true,
      prunedRegistrations,
      prunedApplications,
      deletedPhotoIds,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reconcile SQLite with cloud archive.' });
  }
});

// 11. Admin Encrypted Member Vault Backfill (generates encrypted lookup vaults for existing Firestore dossiers)
apiRouter.post('/admin/encrypt-vaults', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const registrations = Array.isArray(req.body?.registrations) ? req.body.registrations : [];
    const vaultEntries: any[] = [];
    for (const reg of registrations.slice(0, 250)) {
      if (!reg || typeof reg !== 'object' || !reg.reg_id) continue;
      if (isFamilyRegistrationTombstoned(reg)) continue;
      rehydrateLocalRegistrationCache(reg);
      vaultEntries.push(...encryptRegistrationForVaults(reg));
    }
    res.json({
      success: true,
      vaultEntries,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to prepare encrypted lookup vaults.' });
  }
});
