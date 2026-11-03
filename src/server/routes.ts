import { Router, Response } from 'express';
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
  getMembersImportStatus
} from '../db/database.ts';
import {
  requestOtp,
  verifyOtp,
  verifyFirebaseSession,
  signAdminToken,
  requireMember,
  requireAdmin,
  AuthenticatedRequest,
} from './auth.ts';

export const apiRouter = Router();

// Private Photo Storage Setup
const photosBaseDir = path.resolve(process.cwd(), 'data', 'year2-photos');
if (!fs.existsSync(photosBaseDir)) {
  fs.mkdirSync(photosBaseDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB maximum
  },
});

function handlePhotoUploadMiddleware(req: any, res: any, next: any) {
  upload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File too large')) {
        return res.status(400).json({ error: 'Photo exceeds maximum allowed size of 10 MB.' });
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
apiRouter.post('/auth/request-otp', (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }
    const result = requestOtp(mobile);
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
      adminDefaultPin: 'royals2027',
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
      return res.status(403).json({ error: 'Your Year-2 membership update has already been submitted and is locked.' });
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
      return res.status(403).json({ error: 'Your Year-2 update has already been submitted and cannot be reset.' });
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

    const fullFilePath = path.resolve(process.cwd(), photo.storage_path);
    if (!fullFilePath.startsWith(photosBaseDir) || !fs.existsSync(fullFilePath)) {
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
        error: 'Your Year-2 membership update has already been submitted.',
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
      message: 'Year-2 membership update successfully submitted.',
      coupleId,
      submittedAt: now
    });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        error: 'Your Year-2 membership update has already been submitted.'
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

    res.json({
      totalMembers,
      verifiedCount,
      notVerifiedCount,
      startedCount,
      incompleteCount,
      submittedCount,
      pendingCorrectionsCount
    });
  } catch (err: any) {
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
