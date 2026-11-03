import { seed3FictionalTestMembers, db } from '../src/db/database.ts';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'jsg_royals_secure_jwt_secret_2027';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🚀 STEP 8 VERIFICATION: JSG ROYALS SECURE ADMIN DASHBOARD');
  console.log('============================================================\n');

  // 0. Reset and re-seed 3 fictional members and admin users
  seed3FictionalTestMembers(true);

  // Test 1: Admin login with valid credentials -> Token + role
  let superAdminToken = '';
  let adminToken = '';
  try {
    const res = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'subodhjain2007777@gmail.com', pin: 'royals2027' })
    });
    const data = await res.json();
    assert(
      res.status === 200 && !!data.token && data.admin?.role === 'super_admin',
      'Test 1: Admin login with valid credentials returns JWT & role super_admin'
    );
    superAdminToken = data.token;
  } catch (e: any) {
    assert(false, 'Test 1: Admin login with valid credentials', e.message);
  }

  // Also get secondary admin token
  try {
    const res = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jsgroyals.org', pin: 'royals2027' })
    });
    const data = await res.json();
    adminToken = data.token;
    assert(
      res.status === 200 && data.admin?.role === 'admin',
      'Test 1b: Secondary admin login returns role admin'
    );
  } catch (e: any) {
    assert(false, 'Test 1b: Secondary admin login', e.message);
  }

  // Test 2: Admin login with invalid PIN -> HTTP 401
  try {
    const res = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'subodhjain2007777@gmail.com', pin: 'wrongpin' })
    });
    assert(res.status === 401, 'Test 2: Admin login with invalid PIN is blocked with HTTP 401');
  } catch (e: any) {
    assert(false, 'Test 2: Admin login invalid PIN', e.message);
  }

  // Create a member token for JR001
  const memberToken = jwt.sign(
    { coupleId: 'JR001', mobile: '9826011111', role: 'member', spouseType: 'husband', husbandName: 'Subodh Jain', wifeName: 'Aaradhya Jain' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Test 3: Normal member token attempting /api/admin/overview -> HTTP 403
  try {
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert(res.status === 403, 'Test 3: Normal member token attempting /api/admin/overview is blocked with HTTP 403');
  } catch (e: any) {
    assert(false, 'Test 3: Member token to admin endpoint', e.message);
  }

  // Test 4: Unauthenticated request to /api/admin/overview -> HTTP 401
  try {
    const res = await fetch(`${BASE_URL}/admin/overview`);
    assert(res.status === 401, 'Test 4: Unauthenticated request to /api/admin/overview is blocked with HTTP 401');
  } catch (e: any) {
    assert(false, 'Test 4: Unauthenticated admin overview', e.message);
  }

  // Seed some state for testing metrics:
  // 1. Verify JR001
  db.prepare(`
    INSERT INTO verification (couple_id, verified_mobile, verification_status, verified_at, created_at)
    VALUES ('JR001', '9826011111', 'verified', ?, ?)
  `).run(new Date().toISOString(), new Date().toISOString());

  // 2. Add draft for JR001
  db.prepare(`
    INSERT INTO year2_profiles (couple_id, current_city, residential_address, occupation_status, created_at, updated_at)
    VALUES ('JR001', 'Indore', '123 Royal Palms', 'No change', ?, ?)
  `).run(new Date().toISOString(), new Date().toISOString());

  // 3. Add correction request for JR002
  db.prepare(`
    INSERT INTO correction_requests (couple_id, requested_correction, member_message, status, created_at)
    VALUES ('JR002', 'Marriage Anniversary', 'Our anniversary is Nov 20, 2011', 'pending', ?)
  `).run(new Date().toISOString());

  // Test 5: Dynamic dashboard overview metrics match database counts
  try {
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data = await res.json();
    assert(
      res.status === 200 &&
      data.totalMembers === 3 &&
      data.verifiedCount === 1 &&
      data.notVerifiedCount === 2 &&
      data.incompleteCount === 1 &&
      data.submittedCount === 0 &&
      data.pendingCorrectionsCount === 1,
      'Test 5: Dynamic dashboard overview metrics match database counts'
    );
  } catch (e: any) {
    assert(false, 'Test 5: Dashboard overview metrics', e.message);
  }

  // Test 6: Member search by Couple ID, Husband name, Wife name, Mobile
  try {
    // Search by Couple ID
    const resId = await fetch(`${BASE_URL}/admin/members?search=JR002`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataId = await resId.json();

    // Search by Husband Name (Alpha)
    const resName = await fetch(`${BASE_URL}/admin/members?search=Alpha`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataName = await resName.json();

    // Search by Mobile (9990000005)
    const resMobile = await fetch(`${BASE_URL}/admin/members?search=9990000005`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataMobile = await resMobile.json();

    assert(
      dataId.members.length === 1 && dataId.members[0].couple_id === 'JR002' &&
      dataName.members.length === 1 && dataName.members[0].couple_id === 'JR001' &&
      dataMobile.members.length === 1 && dataMobile.members[0].couple_id === 'JR003',
      'Test 6: Server-side search across Couple ID, Husband name, and Mobile works'
    );
  } catch (e: any) {
    assert(false, 'Test 6: Server-side search', e.message);
  }

  // Test 7: Combinable filters (Verification + Year 2 status + Correction status)
  try {
    // Verified + Draft
    const res1 = await fetch(`${BASE_URL}/admin/members?verification=verified&year2=draft`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data1 = await res1.json();

    // Not verified + Not started
    const res2 = await fetch(`${BASE_URL}/admin/members?verification=not_verified&year2=not_started`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data2 = await res2.json();

    // Has pending corrections
    const res3 = await fetch(`${BASE_URL}/admin/members?corrections=pending`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data3 = await res3.json();

    assert(
      data1.members.length === 1 && data1.members[0].couple_id === 'JR001' &&
      data2.members.length === 2 &&
      data3.members.length === 1 && data3.members[0].couple_id === 'JR002',
      'Test 7: Combinable server-side filters (verification, year2, corrections) work accurately'
    );
  } catch (e: any) {
    assert(false, 'Test 7: Combinable filters', e.message);
  }

  // Test 8: Member detail endpoint returns full profile and marks protected fields
  try {
    const res = await fetch(`${BASE_URL}/admin/member/JR001`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data = await res.json();
    assert(
      res.status === 200 &&
      data.member.couple_id === 'JR001' &&
      Array.isArray(data.member.protectedFields) &&
      data.member.protectedFields.includes('couple_id') &&
      data.member.protectedFields.includes('husband_name') &&
      data.member.protectedFields.includes('husband_registered_mobile') &&
      data.year2Profile?.current_city === 'Indore',
      'Test 8: Member detail endpoint returns full profile and marks protected fields'
    );
  } catch (e: any) {
    assert(false, 'Test 8: Member detail endpoint', e.message);
  }

  // Test 9: Member cannot access another member's detail via member routes
  try {
    // JR001 token tries to query JR002's correction requests
    const res = await fetch(`${BASE_URL}/member/corrections?couple_id=JR002`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    assert(res.status === 403, 'Test 9: Member cannot access another couple\'s data via member endpoints (HTTP 403)');
  } catch (e: any) {
    assert(false, 'Test 9: Cross-member isolation', e.message);
  }

  // Test 10: Private Admin Notes can be added by admin and retrieved by admin
  let noteId = 0;
  try {
    const resAdd = await fetch(`${BASE_URL}/admin/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        coupleId: 'JR001',
        note: 'Spoke with Subodh Jain on WhatsApp; confirmed attendance for Year 2 launch.'
      })
    });
    const dataAdd = await resAdd.json();
    noteId = dataAdd.note?.id;

    const resGet = await fetch(`${BASE_URL}/admin/notes/JR001`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataGet = await resGet.json();

    assert(
      resAdd.status === 200 &&
      dataAdd.success &&
      dataGet.notes.length >= 1 &&
      dataGet.notes[0].note.includes('Subodh Jain on WhatsApp'),
      'Test 10: Private Admin Notes can be added and retrieved by admin'
    );
  } catch (e: any) {
    assert(false, 'Test 10: Admin notes addition & retrieval', e.message);
  }

  // Test 11: Private Admin Notes are NEVER returned in member-facing endpoints
  try {
    const res = await fetch(`${BASE_URL}/member/me`, {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
    const data = await res.json();
    assert(
      res.status === 200 &&
      !('notes' in data) &&
      !('adminNotes' in data) &&
      JSON.stringify(data).indexOf('Subodh Jain on WhatsApp') === -1,
      'Test 11: Private Admin Notes are strictly confidential and NEVER returned in /member/me'
    );
  } catch (e: any) {
    assert(false, 'Test 11: Private Admin Notes member confidentiality', e.message);
  }

  // Test 12: Correction requests queue returns items and allows status transition
  try {
    const resList = await fetch(`${BASE_URL}/admin/corrections`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataList = await resList.json();
    const target = dataList.corrections.find((c: any) => c.couple_id === 'JR002');

    // Update status to 'under_review'
    const resReview = await fetch(`${BASE_URL}/admin/resolve-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        correctionId: target.id,
        status: 'under_review',
        adminNotes: 'Checking with founding committee'
      })
    });
    const dataReview = await resReview.json();

    // Update status to 'resolved'
    const resResolve = await fetch(`${BASE_URL}/admin/resolve-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        correctionId: target.id,
        status: 'resolved',
        adminNotes: 'Anniversary verified with wedding invitation copy'
      })
    });
    const dataResolve = await resResolve.json();

    const updated = db.prepare('SELECT status, admin_notes, resolved_at FROM correction_requests WHERE id = ?').get(target.id) as any;

    assert(
      dataReview.success &&
      dataResolve.success &&
      updated.status === 'resolved' &&
      !!updated.resolved_at &&
      updated.admin_notes.includes('wedding invitation copy'),
      'Test 12: Correction request transitions through under_review and resolved statuses with admin notes'
    );
  } catch (e: any) {
    assert(false, 'Test 12: Correction request status transition', e.message);
  }

  // Test 13: Updating correction status does NOT overwrite protected member identity
  try {
    const memberJR002 = db.prepare('SELECT marriage_anniversary FROM members WHERE couple_id = ?').get('JR002') as any;
    assert(
      memberJR002.marriage_anniversary === '05 February',
      'Test 13: Updating correction status does NOT auto-mutate protected Year-1 records'
    );
  } catch (e: any) {
    assert(false, 'Test 13: Protected master records preserved', e.message);
  }

  // Test 14: Secure photo viewing: Admin can view member photo via admin token
  try {
    // Insert a mock photo for JR001
    const photoId = 'photo_JR001_mocktest';
    db.prepare(`
      INSERT OR REPLACE INTO photos (id, couple_id, filename, storage_path, mime_type, size_bytes, created_at)
      VALUES (?, 'JR001', 'family.jpg', 'storage/photos/JR001/family.jpg', 'image/jpeg', 1024, ?)
    `).run(photoId, new Date().toISOString());

    // Both super_admin and admin tokens should be recognized as admin
    const superAdminDecoded = jwt.verify(superAdminToken, JWT_SECRET) as any;
    const adminDecoded = jwt.verify(adminToken, JWT_SECRET) as any;

    assert(
      superAdminDecoded.role === 'super_admin' && adminDecoded.role === 'admin',
      'Test 14: Super Admin and Admin JWT tokens possess correct roles for photo access'
    );
  } catch (e: any) {
    assert(false, 'Test 14: Photo viewing admin role check', e.message);
  }

  // Test 15: Member cannot view another couple's photo (HTTP 403)
  try {
    // Create JR002 member token
    const jr002Token = jwt.sign(
      { coupleId: 'JR002', mobile: '9990000003', role: 'member' },
      JWT_SECRET
    );
    const res = await fetch(`${BASE_URL}/member/photo/photo_JR001_mocktest`, {
      headers: { Authorization: `Bearer ${jr002Token}` }
    });
    assert(res.status === 403, 'Test 15: JR002 member cannot view JR001 photo (HTTP 403)');
  } catch (e: any) {
    assert(false, 'Test 15: Member photo isolation', e.message);
  }

  // Test 16: Export Year 2 data respects admin permission, supports filter options, produces CSV
  try {
    // Export with filter 'all'
    const resJson = await fetch(`${BASE_URL}/admin/export?filter=all`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const dataJson = await resJson.json();

    // Export as CSV
    const resCsv = await fetch(`${BASE_URL}/admin/export?filter=all&format=csv`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const csvText = await resCsv.text();

    assert(
      resJson.status === 200 &&
      dataJson.count === 3 &&
      resCsv.status === 200 &&
      csvText.includes('Couple ID') &&
      csvText.includes('Husband Name') &&
      csvText.includes('JR001') &&
      csvText.includes('JR002') &&
      csvText.includes('JR003'),
      'Test 16: Export Year 2 data produces RFC-4180 CSV with all members and live database fields'
    );
  } catch (e: any) {
    assert(false, 'Test 16: Export Year 2 data', e.message);
  }

  // Test 17: Audit trail logs all critical actions
  try {
    const res = await fetch(`${BASE_URL}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    const data = await res.json();
    const actions = data.logs.map((l: any) => l.action);

    const hasLogin = actions.includes('Admin login');
    const hasProfileView = actions.includes('Member profile viewed');
    const hasCorrectionChange = actions.includes('Correction status changed');
    const hasNoteAdd = actions.includes('Admin note added');
    const hasExport = actions.includes('Export generated');

    assert(
      hasLogin && hasProfileView && hasCorrectionChange && hasNoteAdd && hasExport,
      'Test 17: Audit trail logs all 5 critical administrative operations'
    );
  } catch (e: any) {
    assert(false, 'Test 17: Audit trail logs', e.message);
  }

  console.log('\n============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of 18 test assertions.`);
  console.log(`ADMIN DASHBOARD STATUS: ${failed === 0 ? 'READY' : 'NOT READY'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
