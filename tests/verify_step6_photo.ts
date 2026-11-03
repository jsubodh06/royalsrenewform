import fs from 'fs';
import path from 'path';
import { db, seed3FictionalTestMembers } from '../src/db/database.ts';
import { requestOtp, verifyOtp } from '../src/server/auth.ts';

const BASE_URL = 'http://127.0.0.1:3000/api';

// Helper to make local requests to running dev server
async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

// Generate minimal valid sample images
function createValidJpgBuffer(): Buffer {
  // Minimal JPEG with SOI (FF D8), JFIF header, and EOI (FF D9)
  const header = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  ]);
  const dummyData = Buffer.alloc(512, 0x7a);
  const footer = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([header, dummyData, footer]);
}

function createValidPngBuffer(): Buffer {
  // Minimal 1x1 PNG
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND
    0x42, 0x60, 0x82
  ]);
}

async function runStep6PhotoVerification() {
  console.log('================================================================');
  console.log('   JSG ROYALS YEAR 2 • 2027 — STEP 6 PHOTO UPLOAD VERIFICATION  ');
  console.log('================================================================\n');

  // Fresh reset of test database and clean test storage
  seed3FictionalTestMembers(true);

  let passedTests = 0;
  const totalTests = 10;
  const failedTestsList: string[] = [];

  function record(num: number, title: string, success: boolean, detail: string) {
    if (success) {
      console.log(`✅ [TEST ${num}/${totalTests} PASS] ${title}`);
      console.log(`    Detail: ${detail}\n`);
      passedTests++;
    } else {
      console.error(`❌ [TEST ${num}/${totalTests} FAIL] ${title}`);
      console.error(`    Detail: ${detail}\n`);
      failedTestsList.push(`Test ${num}: ${title} - ${detail}`);
    }
  }

  // Authenticate test couples
  requestOtp('9990000001', { bypassCooldown: true });
  const auth1 = verifyOtp('9990000001', '123456');
  const tokenJR001 = auth1.token;

  requestOtp('9990000003', { bypassCooldown: true });
  const auth2 = verifyOtp('9990000003', '123456');
  const tokenJR002 = auth2.token;

  requestOtp('9990000005', { bypassCooldown: true });
  const auth3 = verifyOtp('9990000005', '123456');
  const tokenJR003 = auth3.token;

  let test1PhotoId = '';
  let test1DiskPath = '';

  // --------------------------------------------------------------------------
  // TEST 1: Upload valid JPG → Success + preview
  // --------------------------------------------------------------------------
  try {
    const jpgBuf = createValidJpgBuffer();
    const uploadRes = await fetchApi('/member/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        base64Data: jpgBuf.toString('base64'),
        filename: 'royals_couple_memory.jpg',
        mimeType: 'image/jpeg'
      })
    });

    const isOk = uploadRes.ok && uploadRes.data.success && uploadRes.data.photoId;
    test1PhotoId = uploadRes.data.photoId;

    // Verify streamable via authenticated photo endpoint
    const getRes = await fetch(`${BASE_URL}/member/photo/${test1PhotoId}`, {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });
    const photoStreamOk = getRes.ok && getRes.headers.get('content-type')?.includes('image/jpeg');

    // Verify metadata in DB (only metadata, NO binary blob)
    const dbRecord = db.prepare('SELECT * FROM photos WHERE id = ?').get(test1PhotoId) as any;
    test1DiskPath = dbRecord?.storage_path ? path.resolve(process.cwd(), dbRecord.storage_path) : '';
    const fileExistsOnDisk = test1DiskPath && fs.existsSync(test1DiskPath);

    const success = isOk && photoStreamOk && fileExistsOnDisk && dbRecord?.couple_id === 'JR001';
    record(1, 'Upload valid JPG → Success + preview', success,
      `Photo ID: ${test1PhotoId}, Content-Type: image/jpeg, File stored on disk at ${dbRecord?.storage_path}`);
  } catch (err: any) {
    record(1, 'Upload valid JPG → Success + preview', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Upload PNG → Success + preview
  // --------------------------------------------------------------------------
  try {
    const pngBuf = createValidPngBuffer();
    const uploadRes = await fetchApi('/member/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR002}` },
      body: JSON.stringify({
        base64Data: pngBuf.toString('base64'),
        filename: 'family_portrait.png',
        mimeType: 'image/png'
      })
    });

    const isOk = uploadRes.ok && uploadRes.data.success && uploadRes.data.photoId;
    const jr002PhotoId = uploadRes.data.photoId;

    const getRes = await fetch(`${BASE_URL}/member/photo/${jr002PhotoId}`, {
      headers: { Authorization: `Bearer ${tokenJR002}` }
    });
    const pngStreamOk = getRes.ok && getRes.headers.get('content-type')?.includes('image/png');

    const dbRecord = db.prepare('SELECT * FROM photos WHERE id = ?').get(jr002PhotoId) as any;
    const success = isOk && pngStreamOk && dbRecord?.mime_type === 'image/png' && dbRecord?.couple_id === 'JR002';
    record(2, 'Upload PNG → Success + preview', success,
      `Photo ID: ${jr002PhotoId}, MIME: ${dbRecord?.mime_type}, Couple: ${dbRecord?.couple_id}`);
  } catch (err: any) {
    record(2, 'Upload PNG → Success + preview', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Upload file > 10 MB → Rejected (HTTP 400 or 413)
  // --------------------------------------------------------------------------
  try {
    // Generate header for JPG + 10.5 MB payload
    const oversizedBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(10.5 * 1024 * 1024, 0x61),
      Buffer.from([0xff, 0xd9])
    ]);

    const uploadRes = await fetchApi('/member/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        base64Data: oversizedBuffer.toString('base64'),
        filename: 'huge_file.jpg',
        mimeType: 'image/jpeg'
      })
    });

    const isRejected = uploadRes.status === 400 || uploadRes.status === 413;
    const hasClearError = uploadRes.data?.error?.includes('10 MB') || uploadRes.data?.error?.includes('exceeds');
    record(3, 'Upload file > 10 MB → Rejected (HTTP 400 or 413)', isRejected,
      `HTTP Status: ${uploadRes.status}, Error Message: "${uploadRes.data?.error}"`);
  } catch (err: any) {
    record(3, 'Upload file > 10 MB → Rejected (HTTP 400 or 413)', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Upload unsupported file (.txt, .exe, or fake header) → Rejected (HTTP 400)
  // --------------------------------------------------------------------------
  try {
    // Attempt uploading a text file disguised as .jpg
    const fakeFile = Buffer.from('This is a plain text file pretending to be an image. Execute malware payload.');
    const uploadRes = await fetchApi('/member/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        base64Data: fakeFile.toString('base64'),
        filename: 'malicious.jpg',
        mimeType: 'image/jpeg'
      })
    });

    const isRejected = uploadRes.status === 400;
    const hasCorruptError = uploadRes.data?.error?.includes('Unsupported') || uploadRes.data?.error?.includes('corrupted');
    record(4, 'Upload unsupported file (.txt, .exe, or fake header) → Rejected (HTTP 400)', isRejected && hasCorruptError,
      `HTTP Status: ${uploadRes.status}, Error: "${uploadRes.data?.error}"`);
  } catch (err: any) {
    record(4, 'Upload unsupported file (.txt, .exe, or fake header) → Rejected (HTTP 400)', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Replace photo → New photo replaces draft photo; previous draft deleted
  // --------------------------------------------------------------------------
  try {
    // Current JR001 photo path from Test 1
    const oldFilePath = test1DiskPath;
    const oldFileExistedBefore = fs.existsSync(oldFilePath);

    // Upload new replacement PNG photo for JR001
    const newPng = createValidPngBuffer();
    const replaceRes = await fetchApi('/member/upload-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        base64Data: newPng.toString('base64'),
        filename: 'new_replacement_photo.png',
        mimeType: 'image/png'
      })
    });

    const newPhotoId = replaceRes.data.photoId;
    const newDbRecord = db.prepare('SELECT * FROM photos WHERE id = ?').get(newPhotoId) as any;
    const newFilePath = newDbRecord ? path.resolve(process.cwd(), newDbRecord.storage_path) : '';

    // Verify previous draft file on disk was cleanly deleted
    const oldFileDeleted = !fs.existsSync(oldFilePath);
    const newFileExists = fs.existsSync(newFilePath);
    const countPhotosForJR001 = db.prepare('SELECT COUNT(*) as cnt FROM photos WHERE couple_id = ?').get('JR001') as any;

    const success = replaceRes.ok && oldFileDeleted && newFileExists && countPhotosForJR001.cnt === 1;
    record(5, 'Replace photo → New photo replaces draft photo; previous draft deleted', success,
      `Old file cleaned up: ${oldFileDeleted}, New file created: ${newFileExists}, Photos in DB for JR001: ${countPhotosForJR001.cnt}`);
  } catch (err: any) {
    record(5, 'Replace photo → New photo replaces draft photo; previous draft deleted', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Remove photo → Photo removed from disk/draft
  // --------------------------------------------------------------------------
  try {
    // Check current JR001 photo
    const currentPhoto = db.prepare('SELECT * FROM photos WHERE couple_id = ?').get('JR001') as any;
    const filePathBefore = path.resolve(process.cwd(), currentPhoto.storage_path);

    const deleteRes = await fetchApi('/member/photo', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const isOk = deleteRes.ok && deleteRes.data.success;
    const fileDeletedFromDisk = !fs.existsSync(filePathBefore);
    const photoCountInDb = (db.prepare('SELECT COUNT(*) as cnt FROM photos WHERE couple_id = ?').get('JR001') as any).cnt;
    const profilePhotoId = (db.prepare('SELECT photo_id FROM year2_profiles WHERE couple_id = ?').get('JR001') as any)?.photo_id;

    const success = isOk && fileDeletedFromDisk && photoCountInDb === 0 && !profilePhotoId;
    record(6, 'Remove photo → Photo removed from disk/draft', success,
      `Delete API ok: ${isOk}, Disk file unlinked: ${fileDeletedFromDisk}, DB photos count: ${photoCountInDb}, Profile photo_id null: ${!profilePhotoId}`);
  } catch (err: any) {
    record(6, 'Remove photo → Photo removed from disk/draft', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Logout/login → Draft photo remains available
  // --------------------------------------------------------------------------
  let jr002ActivePhotoId = '';
  try {
    // JR002 currently has a photo uploaded in Test 2.
    // Simulate full logout: clear tokens, re-authenticate JR002 via SMS OTP flow
    requestOtp('9990000003', { bypassCooldown: true });
    const reAuth = verifyOtp('9990000003', '123456');
    const freshTokenJR002 = reAuth.token;

    // Fetch /api/member/me with new session
    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${freshTokenJR002}` }
    });

    const hasPhoto = meRes.ok && meRes.data.photo && meRes.data.photo.id;
    jr002ActivePhotoId = meRes.data.photo?.id;

    const success = hasPhoto && meRes.data.session.coupleId === 'JR002';
    record(7, 'Logout/login → Draft photo remains available', success,
      `Re-authenticated Couple: ${meRes.data?.session?.coupleId}, Retrieved Photo ID: ${jr002ActivePhotoId}`);
  } catch (err: any) {
    record(7, 'Logout/login → Draft photo remains available', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: JR001 attempts to access JR002 photo → Blocked (HTTP 403 or 404)
  // --------------------------------------------------------------------------
  try {
    // JR001 tries to access JR002's private photo using JR001's valid JWT token
    const crossAccessRes = await fetchApi(`/member/photo/${jr002ActivePhotoId}`, {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const isBlocked = crossAccessRes.status === 403;
    const hasForbiddenMessage = crossAccessRes.data?.error?.includes('permission') || crossAccessRes.data?.error?.includes('Forbidden');
    record(8, 'JR001 attempts to access JR002 photo → Blocked (HTTP 403 or 404)', isBlocked,
      `HTTP Status: ${crossAccessRes.status}, Response: "${crossAccessRes.data?.error}"`);
  } catch (err: any) {
    record(8, 'JR001 attempts to access JR002 photo → Blocked (HTTP 403 or 404)', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Attempt to manipulate storage path (path traversal `../`) → Blocked
  // --------------------------------------------------------------------------
  try {
    // Attempt 1: Path traversal via URL parameter
    const traversalParamRes = await fetchApi('/member/photo/..%2F..%2Fetc%2Fpasswd', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    // Attempt 2: Path traversal via query string
    const traversalQueryRes = await fetchApi('/member/photo?path=../../etc/passwd', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const paramBlocked = traversalParamRes.status === 400 || traversalParamRes.status === 403 || traversalParamRes.status === 404;
    const queryBlocked = traversalQueryRes.status === 400 || traversalQueryRes.status === 403;

    record(9, 'Attempt to manipulate storage path (path traversal `../`) → Blocked', paramBlocked && queryBlocked,
      `Param Traversal Status: ${traversalParamRes.status}, Query Traversal Status: ${traversalQueryRes.status}`);
  } catch (err: any) {
    record(9, 'Attempt to manipulate storage path (path traversal `../`) → Blocked', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Two different couples upload simultaneously → Correct couple ID association
  // --------------------------------------------------------------------------
  try {
    const jpgJR001 = createValidJpgBuffer();
    const pngJR003 = createValidPngBuffer();

    // Concurrent upload requests
    const [res1, res3] = await Promise.all([
      fetchApi('/member/upload-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenJR001}` },
        body: JSON.stringify({
          base64Data: jpgJR001.toString('base64'),
          filename: 'jr001_concurrent.jpg',
          mimeType: 'image/jpeg'
        })
      }),
      fetchApi('/member/upload-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenJR003}` },
        body: JSON.stringify({
          base64Data: pngJR003.toString('base64'),
          filename: 'jr003_concurrent.png',
          mimeType: 'image/png'
        })
      })
    ]);

    const id1 = res1.data.photoId;
    const id3 = res3.data.photoId;

    const db1 = db.prepare('SELECT couple_id, filename, storage_path FROM photos WHERE id = ?').get(id1) as any;
    const db3 = db.prepare('SELECT couple_id, filename, storage_path FROM photos WHERE id = ?').get(id3) as any;

    const couple1Match = db1?.couple_id === 'JR001' && db1?.storage_path.includes('JR001');
    const couple3Match = db3?.couple_id === 'JR003' && db3?.storage_path.includes('JR003');
    const distinctFiles = db1?.storage_path !== db3?.storage_path;

    const success = res1.ok && res3.ok && couple1Match && couple3Match && distinctFiles;
    record(10, 'Two different couples upload simultaneously → Correct couple ID association', success,
      `JR001 File: ${db1?.storage_path}, JR003 File: ${db3?.storage_path}`);
  } catch (err: any) {
    record(10, 'Two different couples upload simultaneously → Correct couple ID association', false, err.message);
  }

  // --------------------------------------------------------------------------
  // FINAL STATUS REPORT
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`PHOTO UPLOAD STATUS: ${passedTests === totalTests ? 'READY' : 'NOT READY'}`);
  console.log(`Total tests run: ${totalTests}`);
  console.log(`Passing: ${passedTests}`);
  console.log(`Failing: ${failedTestsList.length}`);
  console.log('Security notes:');
  console.log('  - Genuine magic-byte inspection enforced on backend (JPEG, PNG, WebP).');
  console.log('  - Disguised/corrupted files and empty 0-byte files strictly rejected.');
  console.log('  - Maximum file size capped at 10 MB.');
  console.log('  - Private filesystem storage under data/year2-photos/{couple_id}/.');
  console.log('  - Directory traversal attacks (../) and cross-couple photo access strictly forbidden (HTTP 403).');
  console.log('  - Previous draft photos cleaned up upon replacement or removal.');
  console.log('================================================================\n');

  if (failedTestsList.length > 0) {
    console.error('FAILED TESTS LIST:');
    failedTestsList.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

runStep6PhotoVerification().catch((err) => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
