import { db, initDatabase } from '../src/db/database.ts';
import { requestOtp, verifyOtp, signMemberToken, signAdminToken } from '../src/server/auth.ts';

async function runTests() {
  console.log('--- Starting Comprehensive JSG ROYALS 2027 Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Database seed check: Exactly 3 test couples in Step 2
  const countRes = db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number };
  assert(countRes.count === 3, `Database has exactly 3 fictional test couples (Actual: ${countRes.count})`);

  // 2. Specific test couple JR001 check
  const jr1 = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR001') as any;
  assert(
    jr1 && jr1.husband_name === '[TEST] Husband Alpha' && jr1.wife_name === '[TEST] Wife Alpha',
    'JR001 correctly seeded as fictional test couple'
  );

  // Test Case 1: Wrong mobile
  try {
    requestOtp('9999999999');
    assert(false, 'Test 1: Wrong mobile should throw error');
  } catch (e: any) {
    assert(e.message.includes('not registered'), 'Test 1: Wrong mobile rejected properly');
  }

  // Test Case 2: Correct registered mobile
  try {
    const otpRes = requestOtp('9990000001');
    assert(otpRes.success && otpRes.coupleId === 'JR001', 'Test 2: Correct registered mobile resolves to JR001');
  } catch (e: any) {
    assert(false, `Test 2 failed: ${e.message}`);
  }

  // Test Case 3: Wrong OTP
  try {
    verifyOtp('9990000001', '999999');
    assert(false, 'Test 3: Wrong OTP should throw error');
  } catch (e: any) {
    assert(e.message.includes('Invalid OTP'), 'Test 3: Wrong OTP rejected properly');
  }

  // Test Case 4: Correct OTP
  let memberToken = '';
  try {
    const authRes = verifyOtp('9990000001', '123456');
    memberToken = authRes.token;
    assert(
      authRes.member.coupleId === 'JR001' && authRes.member.spouseType === 'husband',
      'Test 4: Correct OTP authenticates husband and issues token'
    );
  } catch (e: any) {
    assert(false, `Test 4 failed: ${e.message}`);
  }

  // Test Case 7 & 8: Wife login resolves to SAME Couple ID (JR001)
  try {
    requestOtp('9990000002');
    const wifeAuth = verifyOtp('9990000002', '123456');
    assert(
      wifeAuth.member.coupleId === 'JR001' && wifeAuth.member.spouseType === 'wife',
      'Test 7 & 8: Wife mobile (9990000002) authenticates SAME couple ID JR001'
    );
  } catch (e: any) {
    assert(false, `Test 7 & 8 failed: ${e.message}`);
  }

  // Test Case 11 & 12: Draft autosave & resume
  try {
    // Draft for JR002
    db.prepare(`
      INSERT OR REPLACE INTO year2_profiles (couple_id, current_city, residential_address, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run('JR002', 'Test City B', 'Near Test Park');
    const resumed = db.prepare('SELECT current_city FROM year2_profiles WHERE couple_id = ?').get('JR002') as any;
    assert(resumed.current_city === 'Test City B', 'Test 11 & 12: Incomplete draft saves and resumes correctly');
  } catch (e: any) {
    assert(false, `Test 11 & 12 failed: ${e.message}`);
  }

  // Test Case 10: Submission lock & Duplicate submission prevention
  try {
    // Clean any prior submission for JR001
    db.prepare('DELETE FROM submissions WHERE couple_id = ?').run('JR001');

    // First submission
    db.prepare(`
      INSERT INTO submissions (couple_id, status, submitted_at, created_at, updated_at)
      VALUES (?, 'submitted', datetime('now'), datetime('now'), datetime('now'))
    `).run('JR001');

    // Attempt duplicate submission
    let duplicatePrevented = false;
    try {
      db.prepare(`
        INSERT INTO submissions (couple_id, status, submitted_at, created_at, updated_at)
        VALUES (?, 'submitted', datetime('now'), datetime('now'), datetime('now'))
      `).run('JR001');
    } catch (dupErr: any) {
      if (dupErr.message.includes('UNIQUE constraint failed')) {
        duplicatePrevented = true;
      }
    }
    assert(duplicatePrevented, 'Test 10: Duplicate submission blocked at database level by UNIQUE constraint');
  } catch (e: any) {
    assert(false, `Test 10 failed: ${e.message}`);
  }

  // Test Case 15 & 16: Correction request and admin resolution
  try {
    db.prepare(`
      INSERT INTO correction_requests (couple_id, requested_correction, member_message, status, created_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run('JR001', 'Name Spelling', 'Change test wife name spelling');

    const correction = db.prepare('SELECT * FROM correction_requests WHERE couple_id = ? ORDER BY id DESC LIMIT 1').get('JR001') as any;
    assert(correction && correction.status === 'pending', 'Test 15: Member correction request recorded');

    // Admin resolves it
    db.prepare('UPDATE correction_requests SET status = ?, admin_notes = ? WHERE id = ?').run('resolved', 'Updated in registry', correction.id);
    const resolvedCorrection = db.prepare('SELECT status, admin_notes FROM correction_requests WHERE id = ?').get(correction.id) as any;
    assert(resolvedCorrection.status === 'resolved' && resolvedCorrection.admin_notes === 'Updated in registry', 'Test 16: Admin resolution recorded');
  } catch (e: any) {
    assert(false, `Test 15 & 16 failed: ${e.message}`);
  }

  // Clean test submission for JR001 so fresh tests can be performed by the user
  db.prepare('DELETE FROM submissions WHERE couple_id = ?').run('JR001');

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
