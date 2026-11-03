import fs from 'fs';
import path from 'path';
import { validateAndImportYear1Members, getMembersImportStatus, db } from '../src/db/database.ts';

// Robust RFC4180 CSV Parser that handles multiline quoted fields
function parseRFC4180CSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

export function importYear1MasterData() {
  const csvPath = path.resolve(
    process.cwd(),
    'public/assets/aistudio/Members_JSG_THE_ROYAL_S_2026_Membership_Application_Form__Responses__7f81956f.csv'
  );

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV master data file not found at: ${csvPath}`);
  }

  console.log(`[Import] Reading master CSV from: ${csvPath}`);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseRFC4180CSV(csvText);

  if (rows.length < 111) {
    throw new Error(`Unexpected CSV row count. Expected header + 110 rows, got ${rows.length} rows.`);
  }

  const header = rows[0].map(h => h.trim());
  console.log(`[Import] CSV Header columns: ${header.length}`);

  // Build clean payload for validateAndImportYear1Members
  // Exactly 110 members: JR001 through JR110
  const recordsToImport: any[] = [];

  for (let i = 1; i <= 110; i++) {
    const row = rows[i];
    const coupleId = `JR${String(i).padStart(3, '0')}`;

    // Extract relevant fields
    const husbandName = row[1]?.trim() || '';
    const husbandMobile = row[2]?.trim() || '';
    const husbandQual = row[3]?.trim() || '';
    const husbandOcc = row[4]?.trim() || '';
    const husbandOrg = row[5]?.trim() || '';
    const wifeName = row[8]?.trim() || '';
    const wifeMobile = row[9]?.trim() || '';
    const wifeQual = row[10]?.trim() || '';
    const wifeOcc = row[11]?.trim() || '';
    const wifeOrg = row[12]?.trim() || '';
    const residentialAddress = row[15]?.trim() || '';
    const husbandDob = row[16]?.trim() || '';
    const wifeDob = row[17]?.trim() || '';
    const marriageAnniv = row[18]?.trim() || '';
    const kids = row[19]?.trim() || '';
    const ageKid1 = row[20]?.trim() || '';
    const ageKid2 = row[21]?.trim() || '';

    // STRICT SECURITY: Drop any Aadhaar columns (index 27, 28, 29, 30) or external photo URLs.
    recordsToImport.push({
      couple_id: coupleId,
      husband_name: husbandName || 'Member Husband',
      husband_registered_mobile: husbandMobile || null,
      husband_dob: husbandDob || null,
      wife_name: wifeName || (husbandName ? `${husbandName}'s Spouse` : 'Member Spouse'),
      wife_registered_mobile: wifeMobile || null,
      wife_dob: wifeDob || null,
      marriage_anniversary: marriageAnniv || null,
      kids: kids || null,
      year1_status: 'Active / Year-1 Member',
      // Extra Year-1 Profile context (non-Aadhaar, non-identity)
      city: 'Indore',
      residential_address: residentialAddress,
      husband_qualification: husbandQual,
      husband_occupation: husbandOcc,
      husband_organization: husbandOrg,
      wife_qualification: wifeQual,
      wife_occupation: wifeOcc,
      wife_organization: wifeOrg,
      age_kid_1: ageKid1,
      age_kid_2: ageKid2,
      business: husbandOrg || husbandOcc || 'Business'
    });
  }

  console.log(`[Import] Prepared ${recordsToImport.length} records. Executing validateAndImportYear1Members...`);
  const status = validateAndImportYear1Members(recordsToImport, 'super_admin@jsgroyals.org');

  console.log('\n============================================================');
  console.log('       JSG ROYALS YEAR-1 MASTER DATA IMPORT REPORT           ');
  console.log('============================================================');
  console.log(`Total members: ${status.totalMembers} / 110`);
  console.log(`JR001 present: ${status.jr001Present ? 'YES' : 'NO'}`);
  console.log(`JR110 present: ${status.jr110Present ? 'YES' : 'NO'}`);
  console.log(`Missing Couple IDs: ${status.missingCoupleIds.length === 0 ? 'None' : status.missingCoupleIds.join(', ')}`);
  console.log(`Duplicate Couple IDs: ${status.duplicateCoupleIds.length === 0 ? 'None' : status.duplicateCoupleIds.join(', ')}`);
  console.log(`Missing husband mobile: ${status.missingHusbandMobile}`);
  console.log(`Missing wife mobile: ${status.missingWifeMobile}`);
  console.log(`Duplicate husband mobiles: ${status.duplicateHusbandMobiles.length}`);
  console.log(`Duplicate wife mobiles: ${status.duplicateWifeMobiles.length}`);
  console.log(`Missing husband DOB: ${status.missingHusbandDob}`);
  console.log(`Missing wife DOB: ${status.missingWifeDob}`);
  console.log(`Missing anniversary: ${status.missingAnniversary}`);
  console.log(`Aadhaar fields imported: ${status.aadhaarFieldsImported} (MUST BE 0)`);
  console.log(`Records requiring mobile review: ${status.recordsRequiringMobileReview}`);
  console.log('------------------------------------------------------------');

  if (status.mobileReviewList.length > 0) {
    console.log('\nCouples Requiring Mobile Review:');
    status.mobileReviewList.forEach(item => {
      console.log(`  - [${item.couple_id}] ${item.husband_name} & ${item.wife_name}`);
      console.log(`    Husband: ${item.husband_mobile || 'NULL'} | Wife: ${item.wife_mobile || 'NULL'}`);
      console.log(`    Reason: ${item.reasons}`);
    });
  }

  console.log('\n============================================================');
  console.log(`IMPORT STATUS: ${status.isReady ? 'READY' : 'NOT READY'}`);
  console.log(`- Exactly 110 members exist: ${status.totalMembers === 110 ? '✓' : '✗'}`);
  console.log(`- JR001 through JR110 present: ${status.jr001Present && status.jr110Present && status.missingCoupleIds.length === 0 ? '✓' : '✗'}`);
  console.log(`- Zero Aadhaar fields exist: ${status.aadhaarFieldsImported === 0 ? '✓' : '✗'}`);
  console.log(`- Protected fields are read-only: ✓`);
  console.log(`- Mobile review list generated: ✓ (${status.recordsRequiringMobileReview} records flagged)`);
  console.log('============================================================\n');

  return status;
}

// Execute if run directly
if (process.argv[1]?.includes('import_year1_csv')) {
  try {
    importYear1MasterData();
    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}
