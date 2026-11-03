import { db, validateAndImportYear1Members, getMembersImportStatus, seed3FictionalTestMembers } from '../src/db/database.ts';
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
  console.log('🚀 STEP 9 VERIFICATION: YEAR-1 MEMBER MASTER DATA & SECURITY');
  console.log('============================================================\n');

  // 1. Verify schema contains all required fields and NO Aadhaar fields
  const tableCols = (db.prepare('PRAGMA table_info(members)').all() as any[]).map(c => c.name);
  const requiredFields = [
    'couple_id',
    'husband_name',
    'husband_registered_mobile',
    'husband_dob',
    'wife_name',
    'wife_registered_mobile',
    'wife_dob',
    'marriage_anniversary',
    'kids',
    'year1_status',
    'requires_mobile_review',
    'mobile_review_reasons'
  ];
  const allFieldsPresent = requiredFields.every(f => tableCols.includes(f));
  const aadhaarCols = tableCols.filter(c => c.toLowerCase().includes('aadhaar') || c.toLowerCase().includes('aadhar'));

  assert(allFieldsPresent, 'Test 1: members table contains all 12 required Step 9 fields');
  assert(aadhaarCols.length === 0, 'Test 2: Zero Aadhaar fields exist in the database schema (MUST BE 0)');

  // 2. Security Test: Ingesting Aadhaar field is strictly blocked
  try {
    validateAndImportYear1Members([
      {
        couple_id: 'JR001',
        husband_name: 'Test Husband',
        wife_name: 'Test Wife',
        aadhaar_number: '1234-5678-9012'
      }
    ]);
    assert(false, 'Test 3: Ingesting record with Aadhaar must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('SECURITY VIOLATION') && err.message.includes('Aadhaar'),
      'Test 3: Attempting to import Aadhaar data is strictly rejected with a security violation'
    );
  }

  // 3. Validation Test: Invalid Couple ID format is rejected
  try {
    validateAndImportYear1Members([
      {
        couple_id: 'JR999',
        husband_name: 'Invalid ID',
        wife_name: 'Invalid ID'
      }
    ]);
    assert(false, 'Test 4: Invalid Couple ID JR999 must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('Must be JR001 through JR110'),
      'Test 4: Invalid Couple ID format (outside JR001-JR110) is rejected'
    );
  }

  // 4. Validation Test: Duplicate Couple IDs in payload are rejected
  try {
    validateAndImportYear1Members([
      { couple_id: 'JR001', husband_name: 'H1', wife_name: 'W1' },
      { couple_id: 'JR001', husband_name: 'H2', wife_name: 'W2' }
    ]);
    assert(false, 'Test 5: Duplicate Couple IDs must be rejected');
  } catch (err: any) {
    assert(
      err.message.includes('Duplicate Couple IDs'),
      'Test 5: Duplicate Couple IDs in import payload are rejected'
    );
  }

  // 5. Mobile discrepancy detection and review flagging
  const testSample = [
    {
      couple_id: 'JR001',
      husband_name: 'Husband One',
      wife_name: 'Wife One',
      husband_registered_mobile: '', // Missing husband mobile
      wife_registered_mobile: '9826011111',
      marriage_anniversary: '10 Dec'
    },
    {
      couple_id: 'JR002',
      husband_name: 'Husband Two',
      wife_name: 'Wife Two',
      husband_registered_mobile: '9826022222',
      wife_registered_mobile: '12345', // Suspicious format (< 10 digits)
      marriage_anniversary: '15 Jan'
    },
    {
      couple_id: 'JR003',
      husband_name: 'Husband Three',
      wife_name: 'Wife Three',
      husband_registered_mobile: '9826022222', // Duplicate mobile (shared with JR002)
      wife_registered_mobile: '9826033333',
      marriage_anniversary: '20 Feb'
    }
  ];

  validateAndImportYear1Members(testSample, 'test_admin@jsgroyals.org');

  const member1 = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR001') as any;
  const member2 = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR002') as any;
  const member3 = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR003') as any;

  assert(
    member1.requires_mobile_review === 1 && member1.mobile_review_reasons.includes('Missing husband mobile'),
    'Test 6: Missing husband mobile is flagged for review without silent guessing or mutation'
  );
  assert(
    member2.requires_mobile_review === 1 && member2.mobile_review_reasons.includes('Suspicious wife mobile format'),
    'Test 7: Suspicious/invalid mobile format (< 10 digits) is flagged for administrative review'
  );
  assert(
    member3.requires_mobile_review === 1 && member3.mobile_review_reasons.includes('Duplicate husband mobile'),
    'Test 8: Duplicate mobile shared across couples is detected and flagged for review'
  );
  assert(
    member1.year1_status === 'Active / Year-1 Member',
    'Test 9: Member year1_status is set to "Active / Year-1 Member"'
  );

  // 6. Security & Access Control Check
  // A verified member can access ONLY their own Couple ID
  const jr1Token = jwt.sign(
    { coupleId: 'JR001', mobile: '9826011111', role: 'member', spouseType: 'wife' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Wife mobile and husband mobile authenticate to SAME couple profile
  const meRes = await fetch(`${BASE_URL}/member/me`, {
    headers: { Authorization: `Bearer ${jr1Token}` }
  });
  const meData = await meRes.json();

  assert(
    meRes.status === 200 && meData.year1.couple_id === 'JR001',
    'Test 10: Authenticated member retrieves only their own couple ID'
  );

  // Member cannot directly mutate protected identity fields
  const updateRes = await fetch(`${BASE_URL}/member/update-identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jr1Token}`
    },
    body: JSON.stringify({ husband_name: 'Hacked Name' })
  });
  assert(
    updateRes.status === 403,
    'Test 11: Member is blocked from directly modifying protected Year-1 identity fields (HTTP 403)'
  );

  // Member cannot access admin endpoints
  const adminRes = await fetch(`${BASE_URL}/admin/members-import-status`, {
    headers: { Authorization: `Bearer ${jr1Token}` }
  });
  assert(
    adminRes.status === 403,
    'Test 12: Member token cannot access admin import endpoints (HTTP 403 Forbidden)'
  );

  // 7. Verify Real 110 Member Master Data Import
  const { importYear1MasterData } = await import('../scripts/import_year1_csv.ts');
  const status = importYear1MasterData();

  console.log('\n------------------------------------------------------------');
  console.log('MEMBER IMPORT STATUS REPORT:');
  console.log(`- Total members: ${status.totalMembers} / 110`);
  console.log(`- JR001 present: ${status.jr001Present ? 'YES' : 'NO'}`);
  console.log(`- JR110 present: ${status.jr110Present ? 'YES' : 'NO'}`);
  console.log(`- Missing Couple IDs: ${status.missingCoupleIds.length === 0 ? 'None' : `${status.missingCoupleIds.length} missing (${status.missingCoupleIds.slice(0, 5).join(', ')}...)`}`);
  console.log(`- Duplicate Couple IDs: ${status.duplicateCoupleIds.length === 0 ? '0' : status.duplicateCoupleIds.join(', ')}`);
  console.log(`- Missing husband mobile: ${status.missingHusbandMobile}`);
  console.log(`- Missing wife mobile: ${status.missingWifeMobile}`);
  console.log(`- Duplicate husband mobiles: ${status.duplicateHusbandMobiles.length}`);
  console.log(`- Duplicate wife mobiles: ${status.duplicateWifeMobiles.length}`);
  console.log(`- Missing husband DOB: ${status.missingHusbandDob}`);
  console.log(`- Missing wife DOB: ${status.missingWifeDob}`);
  console.log(`- Missing anniversary: ${status.missingAnniversary}`);
  console.log(`- Aadhaar fields imported: ${status.aadhaarFieldsImported} (MUST BE 0)`);
  console.log(`- Records requiring mobile review: ${status.recordsRequiringMobileReview}`);
  console.log('------------------------------------------------------------\n');

  assert(status.totalMembers === 110, 'Test 13: Exactly 110 members imported in database');
  assert(status.jr001Present && status.jr110Present, 'Test 14: Both JR001 and JR110 exist in database');
  assert(status.missingCoupleIds.length === 0, 'Test 15: Zero missing Couple IDs between JR001 and JR110');
  assert(status.aadhaarFieldsImported === 0, 'Test 16: Zero Aadhaar fields exist (MUST BE 0)');

  console.log('============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`IMPORT ENGINE STATUS: ${failed === 0 ? 'READY' : 'NOT READY'}`);
  console.log(`MASTER DATASET STATUS: ${status.totalMembers === 110 ? 'READY' : 'NOT READY'}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
