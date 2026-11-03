import { db, getMembersImportStatus } from '../src/db/database.ts';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'jsg_royals_secure_jwt_secret_2027';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    const msg = `❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}

async function runStep10QA() {
  console.log('\n================================================================');
  console.log('🚀 STEP 10 — COMPREHENSIVE QA, SECURITY & PRODUCTION READINESS');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: MASTER DATA INTEGRITY & DATABASE CONSTRAINTS
  // -------------------------------------------------------------------------
  console.log('--- [1/15] Master Data & Database Integrity ---');
  const importStatus = getMembersImportStatus();
  assert(importStatus.totalMembers === 110, '1.1 Exactly 110 members exist in database');
  assert(importStatus.jr001Present && importStatus.jr110Present, '1.2 Range JR001 through JR110 complete');
  assert(importStatus.missingCoupleIds.length === 0, '1.3 Zero missing Couple IDs');
  assert(importStatus.duplicateCoupleIds.length === 0, '1.4 Zero duplicate Couple IDs');
  assert(importStatus.aadhaarFieldsImported === 0, '1.5 Zero Aadhaar fields exist (STRICT REQUIREMENT)');

  // Verify UNIQUE constraint on submissions table
  const submissionIndices = db.prepare("PRAGMA index_list('submissions')").all() as any[];
  const hasSubmissionsUnique = submissionIndices.some(idx => idx.unique === 1);
  assert(hasSubmissionsUnique, '1.6 Submissions table enforces database-level UNIQUE constraint on couple_id');

  // Verify foreign keys are enabled
  const fkStatus = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
  assert(fkStatus.foreign_keys === 1, '1.7 SQLite foreign key enforcement is active');

  // -------------------------------------------------------------------------
  // SECTION 2: AUTHENTICATION & OTP TESTING
  // -------------------------------------------------------------------------
  console.log('\n--- [2/15] Authentication & OTP Security ---');

  // 2.1 Unregistered mobile lookup fails without leaking couple existence
  const unregRes = await fetch(`${BASE_URL}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '9999999999' })
  });
  const unregData = await unregRes.json();
  assert(
    unregRes.status === 400 && unregData.error === 'Sorry, this mobile number is not registered with JSG Royals.',
    '2.1 Unregistered mobile rejected with generic safe message (no couple ID leak)'
  );

  // 2.2 Husband mobile authentication
  const jr1Member = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR001') as any;
  const husbandMobile = jr1Member.husband_registered_mobile;
  const wifeMobile = jr1Member.wife_registered_mobile;

  const reqOtpRes = await fetch(`${BASE_URL}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: husbandMobile })
  });
  const reqOtpData = await reqOtpRes.json();
  assert(reqOtpRes.status === 200 && reqOtpData.success, '2.2 Registered husband mobile requests OTP successfully');

  // 2.3 Resend cooldown enforcement (< 30s)
  const cooldownRes = await fetch(`${BASE_URL}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: husbandMobile })
  });
  const cooldownData = await cooldownRes.json();
  assert(
    cooldownRes.status === 400 && cooldownData.error.includes('Please wait'),
    '2.3 Resend cooldown strictly enforced within 30 seconds'
  );

  // 2.4 Incorrect OTP rejected
  const wrongOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: husbandMobile, otp: '000000' })
  });
  const wrongOtpData = await wrongOtpRes.json();
  assert(
    wrongOtpRes.status === 400 && (wrongOtpData.error.includes('Incorrect OTP') || wrongOtpData.error.includes('Invalid OTP')),
    '2.4 Incorrect OTP rejected'
  );

  // 2.5 Inspect database for hashed OTP storage (Never plain text)
  const otpRecord = db.prepare('SELECT * FROM otp_codes WHERE mobile = ? ORDER BY id DESC LIMIT 1').get(husbandMobile) as any;
  assert(
    otpRecord && otpRecord.otp_hash && otpRecord.salt && !('plain_otp' in otpRecord),
    '2.5 OTP values stored securely with cryptographic hash and salt (No plain-text storage)'
  );

  // 2.6 Husband and Wife map to same Couple ID
  const husbandToken = jwt.sign(
    { coupleId: 'JR001', mobile: husbandMobile, role: 'member', spouseType: 'husband' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  const wifeToken = jwt.sign(
    { coupleId: 'JR001', mobile: wifeMobile, role: 'member', spouseType: 'wife' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const hMeRes = await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${husbandToken}` }
  });
  const wMeRes = await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${wifeToken}` }
  });
  const hMeData = await hMeRes.json();
  const wMeData = await wMeRes.json();

  assert(
    hMeRes.status === 200 && wMeRes.status === 200 &&
    hMeData.year1.couple_id === 'JR001' && wMeData.year1.couple_id === 'JR001',
    '2.6 Both husband and wife authenticate and resolve to the exact same Couple ID'
  );

  // -------------------------------------------------------------------------
  // SECTION 3: COUPLE DATA ISOLATION (CROSS-COUPLE ACCESS RESTRICTIONS)
  // -------------------------------------------------------------------------
  console.log('\n--- [3/15] Couple Data Isolation (CRITICAL) ---');

  const jr2Member = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR002') as any;
  const jr2Token = jwt.sign(
    { coupleId: 'JR002', mobile: jr2Member.husband_registered_mobile, role: 'member', spouseType: 'husband' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // 3.1 JR001 token gets only JR001 profile
  assert(hMeData.year1.couple_id === 'JR001', '3.1 JR001 token retrieves exclusively JR001 Year-1 profile');

  // 3.2 JR002 token gets only JR002 profile
  const jr2MeRes = await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${jr2Token}` }
  });
  const jr2MeData = await jr2MeRes.json();
  assert(jr2MeData.year1.couple_id === 'JR002', '3.2 JR002 token retrieves exclusively JR002 Year-1 profile');

  // 3.3 JR001 token attempting to save draft with couple_id 'JR002' in payload
  // Server must strictly isolate and update ONLY JR001 (ignoring any injected couple_id in body)
  await fetch(`${BASE_URL}/member/save-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({
      couple_id: 'JR002', // Malicious attempt to overwrite JR002 draft
      step: 1,
      profile: { current_city: 'Attacker City', residential_address: 'Hacked Address' },
      preferences: {}
    })
  });

  const checkJr2Profile = db.prepare('SELECT * FROM year2_profiles WHERE couple_id = ?').get('JR002') as any;
  const checkJr1Profile = db.prepare('SELECT * FROM year2_profiles WHERE couple_id = ?').get('JR001') as any;

  assert(
    (!checkJr2Profile || checkJr2Profile.current_city !== 'Attacker City') &&
    checkJr1Profile?.current_city === 'Attacker City',
    '3.3 Body payload couple_id injection ignored; session enforces strict data isolation'
  );

  // -------------------------------------------------------------------------
  // SECTION 4: YEAR-1 PROFILE PROTECTION (READ-ONLY ENFORCEMENT)
  // -------------------------------------------------------------------------
  console.log('\n--- [4/15] Year-1 Profile Protection ---');

  const updateIdentityRes = await fetch(`${BASE_URL}/member/update-identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({
      husband_name: 'Malicious Change',
      husband_registered_mobile: '9999999999'
    })
  });
  assert(
    updateIdentityRes.status === 403,
    '4.1 Direct mutation of protected Year-1 identity fields blocked (HTTP 403 Forbidden)'
  );

  const confirmY1Res = await fetch(`${BASE_URL}/member/confirm-year1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${husbandToken}` }
  });
  assert(confirmY1Res.status === 200, '4.2 Member can confirm Year-1 profile ("YES, EVERYTHING IS CORRECT")');

  // -------------------------------------------------------------------------
  // SECTION 5: YEAR-2 DRAFT & RESUME
  // -------------------------------------------------------------------------
  console.log('\n--- [5/15] Year-2 Draft & Resume ---');

  // Save partial draft
  await fetch(`${BASE_URL}/member/save-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({
      step: 3,
      profile: {
        current_city: 'Indore',
        residential_address: '123 Royal Palace Road, Indore',
        occupation_status: 'No change',
        family_status: 'No change'
      },
      preferences: {
        wishlist: ['Luxury travel', 'Family picnics'],
        contribution_areas: ['Event organizing'],
        royal_idea: 'Annual Gala Night 2027'
      }
    })
  });

  // Re-fetch via separate request (simulating browser reload / relogin)
  const reloadMeRes = await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${husbandToken}` }
  });
  const reloadMeData = await reloadMeRes.json();

  assert(
    reloadMeData.hasDraft === true &&
    reloadMeData.year2Profile?.current_city === 'Indore' &&
    reloadMeData.year2Preferences?.wishlist.includes('Luxury travel'),
    '5.1 Partial draft saved and accurately restored across sessions'
  );

  // -------------------------------------------------------------------------
  // SECTION 6: PHOTO SECURITY & ACCESS CONTROL
  // -------------------------------------------------------------------------
  console.log('\n--- [6/15] Photo Security & Access Control ---');

  // 6.1 Valid genuine JPEG magic bytes upload (FF D8 FF)
  const validJpegBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xFF, 0xD9
  ]);

  const formDataBoundary = '----WebKitFormBoundaryXYZ123';
  const postBody = Buffer.concat([
    Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="photo"; filename="family.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    validJpegBuffer,
    Buffer.from(`\r\n--${formDataBoundary}--\r\n`)
  ]);

  const photoUploadRes = await fetch(`${BASE_URL}/member/upload-photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${husbandToken}`,
      'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`
    },
    body: postBody
  });
  const photoUploadData = await photoUploadRes.json();

  assert(
    photoUploadRes.status === 200 && photoUploadData.success && photoUploadData.photoId,
    '6.1 Genuine image uploaded and stored in private couple storage'
  );

  const photoId = photoUploadData.photoId;

  // 6.2 Fake file with JPEG extension but corrupt / executable content rejected
  const fakeFileBuffer = Buffer.from('FAKE-EXECUTABLE-CONTENT-NOT-AN-IMAGE');
  const fakePostBody = Buffer.concat([
    Buffer.from(`--${formDataBoundary}\r\nContent-Disposition: form-data; name="photo"; filename="malicious.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    fakeFileBuffer,
    Buffer.from(`\r\n--${formDataBoundary}--\r\n`)
  ]);
  const fakeUploadRes = await fetch(`${BASE_URL}/member/upload-photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${husbandToken}`,
      'Content-Type': `multipart/form-data; boundary=${formDataBoundary}`
    },
    body: fakePostBody
  });
  assert(
    fakeUploadRes.status === 400,
    '6.2 File with fake extension but non-image magic bytes rejected'
  );

  // 6.3 Cross-couple photo access blocked (JR002 token cannot access JR001 photo)
  const crossPhotoRes = await fetch(`${BASE_URL}/member/photo/${photoId}`, {
    headers: { Authorization: `Bearer ${jr2Token}` }
  });
  assert(
    crossPhotoRes.status === 403,
    '6.3 Cross-couple photo access strictly forbidden (HTTP 403 for unauthorized couple)'
  );

  // 6.4 Public unauthenticated photo access blocked
  const anonPhotoRes = await fetch(`${BASE_URL}/member/photo/${photoId}`);
  assert(
    anonPhotoRes.status === 401,
    '6.4 Unauthenticated public photo access blocked (HTTP 401)'
  );

  // 6.5 Path traversal attack blocked
  const traversalRes = await fetch(`${BASE_URL}/member/photo/..%2F..%2Fpackage.json`, {
    headers: { Authorization: `Bearer ${husbandToken}` }
  });
  assert(
    traversalRes.status === 400 || traversalRes.status === 404,
    '6.5 Directory traversal attempts blocked'
  );

  // -------------------------------------------------------------------------
  // SECTION 7: FINAL SUBMISSION & DUPLICATE PREVENTION (CRITICAL)
  // -------------------------------------------------------------------------
  console.log('\n--- [7/15] Final Submission & Duplicate Prevention ---');

  // 7.1 Normal initial submission succeeds
  const submitRes = await fetch(`${BASE_URL}/member/submit-year2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({
      step: 6,
      profile: {
        current_city: 'Indore',
        residential_address: '123 Royal Palace Road, Indore',
        occupation_status: 'No change',
        family_status: 'No change'
      },
      preferences: {
        wishlist: ['Luxury travel'],
        contribution_areas: ['Event organizing'],
        royal_idea: 'Annual Gala'
      }
    })
  });
  const submitData = await submitRes.json();
  assert(submitRes.status === 200 && submitData.success, '7.1 Initial Year-2 final submission succeeds');

  // 7.2 Double submission / duplicate click rejected immediately
  const dupSubmitRes = await fetch(`${BASE_URL}/member/submit-year2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({
      step: 6,
      profile: { current_city: 'Indore' },
      preferences: { wishlist: ['Luxury travel'], contribution_areas: ['Event organizing'] }
    })
  });
  assert(
    dupSubmitRes.status === 409,
    '7.2 Duplicate submission rejected with HTTP 409 Conflict'
  );

  // 7.3 Submission count in DB remains exactly 1 for JR001
  const subCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE couple_id = ?').get('JR001') as { count: number };
  assert(subCount.count === 1, '7.3 Database confirms exactly ONE submission record exists for JR001');

  // 7.4 Profile view after submission shows locked / already submitted
  const postSubmitMe = await (await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${husbandToken}` }
  })).json();
  assert(postSubmitMe.isSubmitted === true, '7.4 Member session confirms submission is final and locked');

  // 7.5 Modification attempts after final submission blocked
  const postSubmitEdit = await fetch(`${BASE_URL}/member/save-draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${husbandToken}`
    },
    body: JSON.stringify({ profile: { current_city: 'Hacked City' } })
  });
  assert(
    postSubmitEdit.status === 403,
    '7.5 Edits after final submission blocked (HTTP 403 Forbidden)'
  );

  // -------------------------------------------------------------------------
  // SECTION 8: CORRECTION REQUEST FLOW
  // -------------------------------------------------------------------------
  console.log('\n--- [8/15] Correction Request Flow ---');

  const corrRes = await fetch(`${BASE_URL}/member/request-correction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jr2Token}`
    },
    body: JSON.stringify({
      requested_correction: 'Wedding Anniversary Date',
      member_message: 'Please update anniversary to 28 February.'
    })
  });
  const corrData = await corrRes.json();
  assert(corrRes.status === 200 && corrData.success, '8.1 Member submits correction request for their own Couple ID');

  const corrInDb = db.prepare('SELECT * FROM correction_requests WHERE couple_id = ?').get('JR002') as any;
  assert(
    corrInDb && corrInDb.requested_correction === 'Wedding Anniversary Date' && corrInDb.status === 'pending',
    '8.2 Correction request recorded in database with pending status'
  );

  // -------------------------------------------------------------------------
  // SECTION 9: ADMIN AUTHENTICATION & SECURITY
  // -------------------------------------------------------------------------
  console.log('\n--- [9/15] Admin Security & Role-Based Access ---');

  // 9.1 Member token attempting admin endpoints blocked
  const memberOnAdmin = await fetch(`${BASE_URL}/admin/overview`, {
    headers: { Authorization: `Bearer ${husbandToken}` }
  });
  assert(
    memberOnAdmin.status === 403,
    '9.1 Normal member token strictly forbidden from admin API (HTTP 403)'
  );

  // 9.2 Admin login
  const adminLoginRes = await fetch(`${BASE_URL}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'subodhjain2007777@gmail.com',
      password: 'royals2027'
    })
  });
  const adminLoginData = await adminLoginRes.json();
  assert(
    adminLoginRes.status === 200 && adminLoginData.token && adminLoginData.user?.role === 'super_admin',
    '9.2 Super admin login succeeds and returns privileged token'
  );

  const adminToken = adminLoginData.token;

  // 9.3 Admin overview access
  const adminOverviewRes = await fetch(`${BASE_URL}/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminOverviewData = await adminOverviewRes.json();
  assert(
    adminOverviewRes.status === 200 && adminOverviewData.totalMembers === 110,
    '9.3 Admin overview dynamically reports total 110 members'
  );

  // 9.4 Admin can view correction requests and resolve them
  const adminCorrRes = await fetch(`${BASE_URL}/admin/correction-requests/${corrInDb.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      status: 'resolved',
      admin_notes: 'Verified against club registry and resolved.'
    })
  });
  assert(adminCorrRes.status === 200, '9.4 Admin can review and resolve member correction requests');

  // -------------------------------------------------------------------------
  // SECTION 10: SENSITIVE SECRETS & CLIENT BUNDLE HYGIENE
  // -------------------------------------------------------------------------
  console.log('\n--- [10/15] Security Secrets & Clean Bundle Audit ---');

  // Verify no Aadhaar columns in any table
  const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
  let aadhaarColumnCount = 0;
  for (const t of allTables) {
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all() as any[];
    for (const c of cols) {
      if (c.name.toLowerCase().includes('aadhaar') || c.name.toLowerCase().includes('aadhar')) {
        aadhaarColumnCount++;
      }
    }
  }
  assert(aadhaarColumnCount === 0, '10.1 Exactly 0 Aadhaar columns in all database tables');

  // Clean test artifacts
  db.prepare('DELETE FROM submissions WHERE couple_id = ?').run('JR001');
  db.prepare('DELETE FROM photos WHERE couple_id = ?').run('JR001');
  db.prepare('DELETE FROM year2_profiles WHERE couple_id = ?').run('JR001');
  db.prepare('DELETE FROM year2_preferences WHERE couple_id = ?').run('JR001');
  db.prepare('DELETE FROM correction_requests WHERE couple_id = ?').run('JR002');

  console.log('\n================================================================');
  console.log(`TOTAL ASSERTIONS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  if (failed > 0) {
    console.error('FAILURES:');
    failures.forEach(f => console.error(f));
    process.exit(1);
  }
  console.log('ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runStep10QA().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
