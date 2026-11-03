import { db, seed3FictionalTestMembers } from '../src/db/database.ts';
import { requestOtp, verifyOtp } from '../src/server/auth.ts';

// Helper to make local requests to running dev server or query directly
const BASE_URL = 'http://127.0.0.1:3000/api';

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
  return { status: res.status, ok: res.ok, data };
}

async function runStep5FormVerification() {
  console.log('================================================================');
  console.log('   JSG ROYALS YEAR 2 • 2027 — STEP 5 FORM & DRAFT VERIFICATION  ');
  console.log('================================================================\n');

  // Reset database with fresh test accounts
  seed3FictionalTestMembers(true);

  let passedTests = 0;
  const totalTests = 13;
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

  let tokenJR001 = '';
  let tokenJR002 = '';
  let tokenJR003 = '';

  // --------------------------------------------------------------------------
  // TEST 1: Form loads after successful authentication
  // --------------------------------------------------------------------------
  try {
    requestOtp('9990000001', { bypassCooldown: true });
    const auth1 = verifyOtp('9990000001', '123456');
    tokenJR001 = auth1.token;

    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const success = meRes.ok && meRes.data.session && meRes.data.year1;
    record(
      1,
      'Form loads after successful authentication',
      success,
      `Status: ${meRes.status}, Member: ${meRes.data.year1?.husband_name} & ${meRes.data.year1?.wife_name}`
    );
  } catch (err: any) {
    record(1, 'Form loads after successful authentication', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Displays correct Couple ID
  // --------------------------------------------------------------------------
  try {
    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const isMatch = meRes.data.session?.coupleId === 'JR001' && meRes.data.year1?.couple_id === 'JR001';
    record(
      2,
      'Displays correct Couple ID',
      isMatch,
      `Authenticated Couple ID: ${meRes.data.session?.coupleId}`
    );
  } catch (err: any) {
    record(2, 'Displays correct Couple ID', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Moving between steps preserves entered information
  // --------------------------------------------------------------------------
  try {
    // Save Step 1 data
    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        profile: {
          current_city: 'Indore — Old Palasia',
          residential_address: '102 Royal Residency, Manoramaganj',
          occupation_status: 'Started a new business',
          occupation_details: 'Import-export of luxury textiles',
          organization_update: 'Royal Heritage Weaves',
          last_step: 2
        }
      })
    });

    // Save Step 2 data while keeping Step 1
    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        profile: {
          current_city: 'Indore — Old Palasia',
          residential_address: '102 Royal Residency, Manoramaganj',
          occupation_status: 'Started a new business',
          occupation_details: 'Import-export of luxury textiles',
          organization_update: 'Royal Heritage Weaves',
          family_status: 'Child milestone',
          family_details: 'Elder daughter started architecture school',
          last_step: 3
        }
      })
    });

    // Check that both Step 1 and Step 2 data are preserved
    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const p = meRes.data.year2Profile;
    const preserved =
      p?.current_city === 'Indore — Old Palasia' &&
      p?.occupation_status === 'Started a new business' &&
      p?.family_status === 'Child milestone' &&
      p?.family_details === 'Elder daughter started architecture school';

    record(
      3,
      'Moving between steps preserves entered information',
      preserved,
      `Preserved city: ${p?.current_city}, occupation: ${p?.occupation_status}, family: ${p?.family_status}`
    );
  } catch (err: any) {
    record(3, 'Moving between steps preserves entered information', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Logging out and logging back in retrieves saved draft
  // --------------------------------------------------------------------------
  try {
    // "Logout" by discarding tokenJR001 and authenticating as JR001 wife
    requestOtp('9990000002', { bypassCooldown: true });
    const authWife = verifyOtp('9990000002', '123456');
    const tokenWife = authWife.token;

    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenWife}` }
    });

    const p = meRes.data.year2Profile;
    const retrieved =
      meRes.data.session?.coupleId === 'JR001' &&
      p?.current_city === 'Indore — Old Palasia' &&
      p?.organization_update === 'Royal Heritage Weaves';

    record(
      4,
      'Logging out and logging back in retrieves saved draft',
      retrieved,
      `Wife logged in for JR001 and retrieved draft city: "${p?.current_city}", org: "${p?.organization_update}"`
    );
  } catch (err: any) {
    record(4, 'Logging out and logging back in retrieves saved draft', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: JR001 cannot view or modify JR002's draft
  // --------------------------------------------------------------------------
  try {
    // Authenticate JR002
    requestOtp('9990000003', { bypassCooldown: true });
    const auth2 = verifyOtp('9990000003', '123456');
    tokenJR002 = auth2.token;

    // JR002 sets their draft city
    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR002}` },
      body: JSON.stringify({
        profile: {
          current_city: 'Bhopal Central',
          family_status: 'No change',
          last_step: 1
        }
      })
    });

    // JR001 attempts to modify JR002's draft by sending malicious couple_id in payload
    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        couple_id: 'JR002',
        profile: {
          current_city: 'ATTACKED CITY',
        }
      })
    });

    // Check JR002's draft in database
    const jr002InDb = db.prepare('SELECT current_city FROM year2_profiles WHERE couple_id = ?').get('JR002') as any;

    const isolated = jr002InDb && jr002InDb.current_city === 'Bhopal Central';
    record(
      5,
      "JR001 cannot view or modify JR002's draft",
      isolated,
      `JR002 city remained intact: "${jr002InDb?.current_city}". Backend strictly enforced token session.`
    );
  } catch (err: any) {
    record(5, "JR001 cannot view or modify JR002's draft", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Required fields trigger proper validation if empty
  // --------------------------------------------------------------------------
  try {
    // Authenticate JR003 with empty draft
    requestOtp('9990000005', { bypassCooldown: true });
    const auth3 = verifyOtp('9990000005', '123456');
    tokenJR003 = auth3.token;

    // Attempt submit with empty fields
    const failSubmitRes = await fetchApi('/member/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR003}` },
      body: JSON.stringify({})
    });

    const isRejected = failSubmitRes.status === 400 && failSubmitRes.data.missingFields;
    record(
      6,
      'Required fields trigger proper validation if empty',
      isRejected,
      `Status: ${failSubmitRes.status}, Missing fields identified: ${failSubmitRes.data.missingFields?.join(', ')}`
    );
  } catch (err: any) {
    record(6, 'Required fields trigger proper validation if empty', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Optional fields can be left blank without blocking submission
  // --------------------------------------------------------------------------
  try {
    // Submit JR003 with ONLY required fields and NO optional fields
    const resOpt = await fetchApi('/member/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR003}` },
      body: JSON.stringify({
        profile: {
          current_city: 'Indore',
          family_status: 'No change',
          // Optional fields left completely blank:
          residential_address: '',
          occupation_details: '',
          organization_update: '',
          family_details: ''
        },
        preferences: {
          wishlist: ['Luxury travel'],
          contribution_areas: ['Sports'],
          // Optional fields left completely blank:
          dream_experience: '',
          royal_idea: '',
          identity_statement: '',
          contribution_help_text: ''
        }
      })
    });

    const optSuccess = resOpt.ok && resOpt.data.success === true;
    record(
      7,
      'Optional fields can be left blank without blocking submission',
      optSuccess,
      `Submission succeeded with only 4 required fields. Status: ${resOpt.status}`
    );
  } catch (err: any) {
    record(7, 'Optional fields can be left blank without blocking submission', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Multi-select wishlist allows multiple choices
  // --------------------------------------------------------------------------
  try {
    const selectedWishlist = [
      'Luxury travel',
      'Weekend getaways',
      'Food & dining',
      'Parties & celebrations'
    ];

    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        preferences: {
          wishlist: selectedWishlist
        }
      })
    });

    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const retrievedWishlist = meRes.data.year2Preferences?.wishlist || [];
    const wishlistMatch =
      Array.isArray(retrievedWishlist) &&
      selectedWishlist.every((w) => retrievedWishlist.includes(w)) &&
      retrievedWishlist.length === 4;

    record(
      8,
      'Multi-select wishlist allows multiple choices',
      wishlistMatch,
      `Saved & retrieved ${retrievedWishlist.length} choices: ${retrievedWishlist.join(', ')}`
    );
  } catch (err: any) {
    record(8, 'Multi-select wishlist allows multiple choices', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Multi-select contribution allows multiple choices
  // --------------------------------------------------------------------------
  try {
    const selectedContrib = [
      'Event planning',
      'Sports',
      'Food & hospitality',
      'Technology'
    ];

    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        preferences: {
          contribution_areas: selectedContrib
        }
      })
    });

    const meRes = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const retrievedContrib = meRes.data.year2Preferences?.contribution_areas || [];
    const contribMatch =
      Array.isArray(retrievedContrib) &&
      selectedContrib.every((c) => retrievedContrib.includes(c)) &&
      retrievedContrib.length === 4;

    record(
      9,
      'Multi-select contribution allows multiple choices',
      contribMatch,
      `Saved & retrieved ${retrievedContrib.length} choices: ${retrievedContrib.join(', ')}`
    );
  } catch (err: any) {
    record(9, 'Multi-select contribution allows multiple choices', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Incomplete form shows "Continue where I left off" or "Start over"
  // --------------------------------------------------------------------------
  try {
    // Check hasDraft flag on /member/me for JR001
    const meRes1 = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });
    const hasDraftFlag = meRes1.data.hasDraft === true;

    // Test "Start over" (reset-draft endpoint)
    const resetRes = await fetchApi('/member/reset-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    // Check after reset
    const meRes2 = await fetchApi('/member/me', {
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });
    const draftCleared = !meRes2.data.hasDraft && !meRes2.data.year2Profile;

    const test10Passed = hasDraftFlag && resetRes.ok && draftCleared;
    record(
      10,
      'Incomplete form shows "Continue where I left off" or "Start over"',
      test10Passed,
      `hasDraft before reset: ${hasDraftFlag}, reset status: ${resetRes.status}, draft cleared: ${draftCleared}`
    );
  } catch (err: any) {
    record(10, 'Incomplete form shows "Continue where I left off" or "Start over"', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Submitting locks the form permanently
  // --------------------------------------------------------------------------
  try {
    // Fill JR001 with valid data and submit
    await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({
        profile: {
          current_city: 'Indore',
          residential_address: 'Palasia Green',
          occupation_status: 'No change',
          family_status: 'No change',
        },
        preferences: {
          wishlist: ['Luxury travel', 'Cultural experiences'],
          contribution_areas: ['Event planning'],
          royal_idea: 'Annual Royal Heritage Gala in Udaipur'
        }
      })
    });

    const submitRes = await fetchApi('/member/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    // Check that draft saving is now rejected
    const postSaveRes = await fetchApi('/member/save-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` },
      body: JSON.stringify({ profile: { current_city: 'New City' } })
    });

    // Check that reset is rejected
    const postResetRes = await fetchApi('/member/reset-draft', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    const locked = submitRes.ok && postSaveRes.status === 403 && postResetRes.status === 403;
    record(
      11,
      'Submitting locks the form permanently',
      locked,
      `Submitted: ${submitRes.ok}, subsequent save rejected with 403: ${postSaveRes.status === 403}, reset rejected with 403: ${postResetRes.status === 403}`
    );
  } catch (err: any) {
    record(11, 'Submitting locks the form permanently', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Already submitted profile cannot be resubmitted
  // --------------------------------------------------------------------------
  try {
    // Attempt second submission for JR001
    const resubmitRes = await fetchApi('/member/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenJR001}` }
    });

    // Also verify database count for submissions has exactly 1 row for JR001
    const subCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE couple_id = ?').get('JR001') as any;

    const cannotResubmit = resubmitRes.status === 409 && subCount.count === 1;
    record(
      12,
      'Already submitted profile cannot be resubmitted',
      cannotResubmit,
      `Resubmission returned HTTP ${resubmitRes.status} (${resubmitRes.data.error}), DB submissions count: ${subCount.count}`
    );
  } catch (err: any) {
    record(12, 'Already submitted profile cannot be resubmitted', false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Year-1 protected fields remain untouched throughout
  // --------------------------------------------------------------------------
  try {
    const memberJR001 = db.prepare('SELECT * FROM members WHERE couple_id = ?').get('JR001') as any;

    const untouched =
      memberJR001 &&
      memberJR001.couple_id === 'JR001' &&
      memberJR001.husband_name === '[TEST] Husband Alpha' &&
      memberJR001.wife_name === '[TEST] Wife Alpha' &&
      memberJR001.husband_registered_mobile === '9990000001' &&
      memberJR001.wife_registered_mobile === '9990000002' &&
      memberJR001.husband_dob === '1985-01-15' &&
      memberJR001.wife_dob === '1987-03-20' &&
      memberJR001.marriage_anniversary === '12 December';

    record(
      13,
      'Year-1 protected fields remain untouched throughout',
      untouched,
      `Husband: ${memberJR001.husband_name}, Wife: ${memberJR001.wife_name}, Mobiles: ${memberJR001.husband_registered_mobile}/${memberJR001.wife_registered_mobile}, Anniversary: ${memberJR001.marriage_anniversary}`
    );
  } catch (err: any) {
    record(13, 'Year-1 protected fields remain untouched throughout', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passedTests} of ${totalTests} PASSED`);
  if (failedTestsList.length > 0) {
    console.log('FAILED TESTS:');
    failedTestsList.forEach(f => console.log('  - ' + f));
  }
  console.log('================================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runStep5FormVerification().catch((err) => {
  console.error('Test runner encountered fatal error:', err);
  process.exit(1);
});
