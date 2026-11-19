import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel
  ? path.resolve('/tmp', 'data')
  : path.resolve(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'jsg_royals.db');

// If on Vercel and the database does not exist in /tmp/data, copy the bundled seed db
if (isVercel && !fs.existsSync(dbPath)) {
  const seedDbPath = path.resolve(process.cwd(), 'data', 'jsg_royals.db');
  if (fs.existsSync(seedDbPath)) {
    try {
      fs.copyFileSync(seedDbPath, dbPath);
      const seedWal = path.resolve(process.cwd(), 'data', 'jsg_royals.db-wal');
      const seedShm = path.resolve(process.cwd(), 'data', 'jsg_royals.db-shm');
      if (fs.existsSync(seedWal)) fs.copyFileSync(seedWal, path.join(dataDir, 'jsg_royals.db-wal'));
      if (fs.existsSync(seedShm)) fs.copyFileSync(seedShm, path.join(dataDir, 'jsg_royals.db-shm'));
      console.log('Successfully copied seed SQLite database to /tmp/data');
    } catch (e) {
      console.warn('Could not copy seed database to /tmp:', e);
    }
  }
}

export const db = new Database(dbPath);

// Enable busy timeout, foreign key constraints, and safe atomic DELETE journaling mode
db.pragma('busy_timeout = 5000');
try {
  db.pragma('journal_mode = DELETE');
  db.pragma('synchronous = FULL');
} catch (e) {
  try {
    db.pragma('journal_mode = DELETE');
  } catch (err) {}
}
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Drop obsolete legacy tables if schema changed to guarantee clean constraints
  // db.exec('PRAGMA foreign_keys = OFF;');
  
  // 1. members — Permanent Year-1 member master
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT UNIQUE NOT NULL,
      husband_name TEXT NOT NULL,
      wife_name TEXT NOT NULL,
      husband_registered_mobile TEXT,
      wife_registered_mobile TEXT,
      husband_dob TEXT,
      wife_dob TEXT,
      marriage_anniversary TEXT,
      kids TEXT,
      year1_status TEXT DEFAULT 'Active / Year-1 Member',
      requires_mobile_review INTEGER DEFAULT 0,
      mobile_review_reasons TEXT,
      year1_profile_data TEXT,
      active_status INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Indexes on registered mobiles and couple_id
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_members_husband_mobile ON members(husband_registered_mobile);
    CREATE INDEX IF NOT EXISTS idx_members_wife_mobile ON members(wife_registered_mobile);
    CREATE INDEX IF NOT EXISTS idx_members_couple_id ON members(couple_id);
  `);

  // 2. verification — Records successful member verification
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT NOT NULL,
      verified_mobile TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 3. year2_profiles — Year-2 editable information
  db.exec(`
    CREATE TABLE IF NOT EXISTS year2_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT UNIQUE NOT NULL,
      current_city TEXT,
      residential_address TEXT,
      occupation_update TEXT,
      organization_update TEXT,
      family_update TEXT,
      family_photo_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 4. year2_preferences — Year-2 member preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS year2_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT UNIQUE NOT NULL,
      wishlist TEXT,
      contribution_areas TEXT,
      royal_idea TEXT,
      jsg_should_be_known_for TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 5. submissions — STRICT database-level UNIQUE constraint on couple_id
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      submitted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 6. correction_requests — Official Year-1 record correction flow
  db.exec(`
    CREATE TABLE IF NOT EXISTS correction_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT NOT NULL,
      requested_correction TEXT NOT NULL,
      member_message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'under_review', 'resolved', 'rejected')),
      admin_notes TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 7. admin_users — Administrative users with role-based access
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('super_admin', 'admin')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 8. otp_codes — Server-side securely hashed OTP management (Never store plain-text OTPs)
  try {
    const otpCols = db.prepare('PRAGMA table_info(otp_codes)').all().map((c: any) => c.name);
    if (otpCols.length > 0 && !otpCols.includes('otp_hash')) {
      db.exec('DROP TABLE otp_codes;');
    }
  } catch (e) {
    // table didn't exist yet
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL,
      couple_id TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'husband',
      otp_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_otp_codes_email ON email_otp_codes(email);
  `);

  // 9. photos — Private storage metadata (no binary BLOB in database)
  try {
    const photoCols = (db.prepare('PRAGMA table_info(photos)').all() as any[]).map((c: any) => c.name);
    if (photoCols.length > 0 && photoCols.includes('data')) {
      db.exec('DROP TABLE photos;');
    }
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      couple_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 10. member_admin_notes — Internal admin notes on members (Private to admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      couple_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(couple_id) REFERENCES members(couple_id) ON DELETE CASCADE
    );
  `);

  // 11. audit_logs — Administrative audit trail
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_couple_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 12. app_settings — Dynamic system configuration (e.g. Fast2SMS API key)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 13. family_registrations — Email-based fresh family registrations with cross-spouse awareness
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_id TEXT UNIQUE NOT NULL,
      submitted_by_role TEXT NOT NULL,
      submitter_email TEXT NOT NULL,
      
      husband_name TEXT NOT NULL,
      husband_mobile TEXT NOT NULL,
      husband_email TEXT NOT NULL,
      husband_dob TEXT,
      husband_qualification TEXT,
      husband_occupation TEXT,
      husband_organization TEXT,
      husband_blood_group TEXT,
      husband_instagram TEXT,

      wife_name TEXT NOT NULL,
      wife_mobile TEXT NOT NULL,
      wife_email TEXT NOT NULL,
      wife_dob TEXT,
      wife_qualification TEXT,
      wife_occupation TEXT,
      wife_organization TEXT,
      wife_blood_group TEXT,
      wife_instagram TEXT,

      marriage_anniversary TEXT NOT NULL,
      current_city TEXT NOT NULL,
      residential_address TEXT NOT NULL,
      native_place TEXT,

      has_children INTEGER DEFAULT 0,
      children_json TEXT,

      husband_photo_url TEXT,
      wife_photo_url TEXT,
      couple_photo_url TEXT,
      family_photo_url TEXT,
      contribution_areas TEXT,
      royal_idea TEXT,
      jsg_should_be_known_for TEXT,

      president_name TEXT,
      president_mobile TEXT,
      secretary_name TEXT,
      secretary_mobile TEXT,

      membership_type TEXT NOT NULL DEFAULT 'existing',
      other_group_member TEXT,
      other_group_name TEXT,
      other_group_position TEXT,
      new_member_contribution TEXT,
      reference_name TEXT,
      reference_mobile TEXT,
      business_description TEXT,

      exp_rating INTEGER,
      exp_favourite_event TEXT,
      exp_international_trip TEXT,
      exp_trip_month_destination TEXT,
      exp_missing TEXT,

      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_fr_husband_email ON family_registrations(husband_email);
    CREATE INDEX IF NOT EXISTS idx_fr_wife_email ON family_registrations(wife_email);
    CREATE INDEX IF NOT EXISTS idx_fr_husband_mobile ON family_registrations(husband_mobile);
    CREATE INDEX IF NOT EXISTS idx_fr_wife_mobile ON family_registrations(wife_mobile);
  `);

  // 14. family_photos — Persistent binary storage for uploaded family/individual photos
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_photos (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 15. new_member_applications — Prospective new member application submissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS new_member_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT UNIQUE NOT NULL,
      applicant_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      email TEXT NOT NULL,
      other_group_member TEXT NOT NULL DEFAULT 'No',
      other_group_name TEXT,
      other_group_position TEXT,
      contribution TEXT NOT NULL,
      reference_name TEXT NOT NULL,
      reference_mobile TEXT NOT NULL,
      business_description TEXT NOT NULL,
      president_name TEXT NOT NULL,
      president_mobile TEXT NOT NULL,
      secretary_name TEXT NOT NULL,
      secretary_mobile TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nma_email ON new_member_applications(email);
    CREATE INDEX IF NOT EXISTS idx_nma_mobile ON new_member_applications(mobile_number);
  `);

  // 16. deleted_tombstones — Prevents deleted rows from resurfacing across reloads/instances
  db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_tombstones (
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      email TEXT,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (record_type, record_id)
    );
    CREATE INDEX IF NOT EXISTS idx_dt_email ON deleted_tombstones(email);
  `);

  // Admin users are seeded/maintained with subodhjain2007777@gmail.com and PIN rroyals2027
  seedAdminUsers();

  // Add migration columns if they do not exist
  ensureYear2Columns();
  ensureMemberColumns();
  ensureFamilyRegistrationColumns();
  ensureNewMemberApplicationColumns();
  syncExistingFamilyPhotosToDb();

  // Master member auto-seeding disabled per user request for fresh database start
  // ensureMasterMembersSeeded();
}

function syncExistingFamilyPhotosToDb() {
  try {
    const familyDir = path.resolve(dataDir, 'year2-photos', 'family');
    if (!fs.existsSync(familyDir)) return;
    const files = fs.readdirSync(familyDir);
    const checkStmt = db.prepare('SELECT 1 FROM family_photos WHERE filename = ?');
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO family_photos (filename, mime_type, data, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const file of files) {
      if (!/\.(jpe?g|png|webp|gif)$/i.test(file)) continue;
      const exists = checkStmt.get(file);
      if (exists) continue;
      const fullPath = path.join(familyDir, file);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const buf = fs.readFileSync(fullPath);
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      insertStmt.run(file, mime, buf, buf.length, new Date().toISOString());
    }
  } catch (e) {
    console.warn('syncExistingFamilyPhotosToDb warning:', e);
  }
}

function ensureFamilyRegistrationColumns() {
  try {
    const tableInfo = db.pragma('table_info(family_registrations)') as any[];
    const columnNames = (tableInfo || []).map((c) => c.name);

    if (!columnNames.includes('husband_photo_url')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN husband_photo_url TEXT');
    }
    if (!columnNames.includes('wife_photo_url')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN wife_photo_url TEXT');
    }
    if (!columnNames.includes('couple_photo_url')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN couple_photo_url TEXT');
    }
    if (!columnNames.includes('family_photo_url')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN family_photo_url TEXT');
    }
    if (!columnNames.includes('president_name')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN president_name TEXT');
    }
    if (!columnNames.includes('president_mobile')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN president_mobile TEXT');
    }
    if (!columnNames.includes('secretary_name')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN secretary_name TEXT');
    }
    if (!columnNames.includes('secretary_mobile')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN secretary_mobile TEXT');
    }
    if (!columnNames.includes('membership_type')) {
      db.exec("ALTER TABLE family_registrations ADD COLUMN membership_type TEXT NOT NULL DEFAULT 'existing'");
    }
    if (!columnNames.includes('other_group_member')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN other_group_member TEXT');
    }
    if (!columnNames.includes('other_group_name')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN other_group_name TEXT');
    }
    if (!columnNames.includes('other_group_position')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN other_group_position TEXT');
    }
    if (!columnNames.includes('new_member_contribution')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN new_member_contribution TEXT');
    }
    if (!columnNames.includes('reference_name')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN reference_name TEXT');
    }
    if (!columnNames.includes('reference_mobile')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN reference_mobile TEXT');
    }
    if (!columnNames.includes('business_description')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN business_description TEXT');
    }
    if (!columnNames.includes('husband_instagram')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN husband_instagram TEXT');
    }
    if (!columnNames.includes('wife_instagram')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN wife_instagram TEXT');
    }
    if (!columnNames.includes('exp_rating')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN exp_rating INTEGER');
    }
    if (!columnNames.includes('exp_favourite_event')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN exp_favourite_event TEXT');
    }
    if (!columnNames.includes('exp_international_trip')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN exp_international_trip TEXT');
    }
    if (!columnNames.includes('exp_trip_month_destination')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN exp_trip_month_destination TEXT');
    }
    if (!columnNames.includes('exp_missing')) {
      db.exec('ALTER TABLE family_registrations ADD COLUMN exp_missing TEXT');
    }
  } catch (e) {
    console.error('ensureFamilyRegistrationColumns error:', e);
  }
}

function ensureNewMemberApplicationColumns() {
  try {
    const tableInfo = db.pragma('table_info(new_member_applications)') as any[];
    const columnNames = (tableInfo || []).map((c) => c.name);
    if (!columnNames.includes('other_group_position')) {
      db.exec('ALTER TABLE new_member_applications ADD COLUMN other_group_position TEXT');
    }
  } catch (e) {
    console.error('ensureNewMemberApplicationColumns error:', e);
  }
}

function parseRFC4180(text: string): string[][] {
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
          i++;
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
        if (nextChar === '\n') i++;
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

function ensureMasterMembersSeeded() {
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number };
    if (countRow && countRow.count >= 110) {
      return; // Already has full master dataset
    }

    const csvPath = path.resolve(
      process.cwd(),
      'public/assets/aistudio/Members_JSG_THE_ROYAL_S_2026_Membership_Application_Form__Responses__7f81956f.csv'
    );
    if (fs.existsSync(csvPath)) {
      const csvText = fs.readFileSync(csvPath, 'utf8');
      const rows = parseRFC4180(csvText);
      if (rows.length >= 111) {
        const recordsToImport: any[] = [];
        for (let i = 1; i <= 110; i++) {
          const row = rows[i];
          const coupleId = `JR${String(i).padStart(3, '0')}`;
          recordsToImport.push({
            couple_id: coupleId,
            husband_name: row[1]?.trim() || 'Member Husband',
            husband_registered_mobile: row[2]?.trim() || null,
            husband_dob: row[16]?.trim() || null,
            wife_name: row[8]?.trim() || 'Member Spouse',
            wife_registered_mobile: row[9]?.trim() || null,
            wife_dob: row[17]?.trim() || null,
            marriage_anniversary: row[18]?.trim() || null,
            kids: row[19]?.trim() || null,
            year1_status: 'Active / Year-1 Member',
            city: row[15]?.trim() || 'Indore',
            residential_address: row[15]?.trim() || '',
            husband_occupation: row[4]?.trim() || '',
            husband_organization: row[5]?.trim() || '',
            wife_occupation: row[11]?.trim() || '',
            wife_organization: row[12]?.trim() || ''
          });
        }
        validateAndImportYear1Members(recordsToImport, 'system_auto_seed');
        console.log('Auto-seeded 110 real JSG Royals members from CSV.');
        return;
      }
    }

    seed3FictionalTestMembers(false);
  } catch (err) {
    console.error('ensureMasterMembersSeeded error:', err);
  }
}

export function logAdminAudit(adminEmail: string, action: string, targetCoupleId?: string, details?: string) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (admin_email, action, target_couple_id, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      adminEmail || 'admin',
      action,
      targetCoupleId || null,
      details || null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

function ensureMemberColumns() {
  const cols = db.prepare('PRAGMA table_info(members)').all() as any[];
  const husbandCol = cols.find(c => c.name === 'husband_registered_mobile');
  const colNames = cols.map((c) => c.name);

  // If husband_registered_mobile has NOT NULL, migrate table to relax constraint for Step 9
  if (husbandCol && husbandCol.notnull === 1) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS members_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        couple_id TEXT UNIQUE NOT NULL,
        husband_name TEXT NOT NULL,
        wife_name TEXT NOT NULL,
        husband_registered_mobile TEXT,
        wife_registered_mobile TEXT,
        husband_dob TEXT,
        wife_dob TEXT,
        marriage_anniversary TEXT,
        kids TEXT,
        year1_status TEXT DEFAULT 'Active / Year-1 Member',
        requires_mobile_review INTEGER DEFAULT 0,
        mobile_review_reasons TEXT,
        year1_profile_data TEXT,
        active_status INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO members_v2 (
        id, couple_id, husband_name, wife_name,
        husband_registered_mobile, wife_registered_mobile,
        husband_dob, wife_dob, marriage_anniversary,
        year1_profile_data, active_status, created_at, updated_at
      )
      SELECT 
        id, couple_id, husband_name, wife_name,
        husband_registered_mobile, wife_registered_mobile,
        husband_dob, wife_dob, marriage_anniversary,
        year1_profile_data, active_status, created_at, updated_at
      FROM members;
      DROP TABLE members;
      ALTER TABLE members_v2 RENAME TO members;
      CREATE INDEX IF NOT EXISTS idx_members_husband_mobile ON members(husband_registered_mobile);
      CREATE INDEX IF NOT EXISTS idx_members_wife_mobile ON members(wife_registered_mobile);
      CREATE INDEX IF NOT EXISTS idx_members_couple_id ON members(couple_id);
      PRAGMA foreign_keys = ON;
    `);
  } else {
    if (!colNames.includes('kids')) db.exec('ALTER TABLE members ADD COLUMN kids TEXT;');
    if (!colNames.includes('year1_status')) db.exec("ALTER TABLE members ADD COLUMN year1_status TEXT DEFAULT 'Active / Year-1 Member';");
    if (!colNames.includes('requires_mobile_review')) db.exec('ALTER TABLE members ADD COLUMN requires_mobile_review INTEGER DEFAULT 0;');
    if (!colNames.includes('mobile_review_reasons')) db.exec('ALTER TABLE members ADD COLUMN mobile_review_reasons TEXT;');
  }
}

function ensureYear2Columns() {
  const profileCols = (db.prepare('PRAGMA table_info(year2_profiles)').all() as any[]).map(c => c.name);
  if (!profileCols.includes('occupation_status')) db.exec('ALTER TABLE year2_profiles ADD COLUMN occupation_status TEXT;');
  if (!profileCols.includes('occupation_details')) db.exec('ALTER TABLE year2_profiles ADD COLUMN occupation_details TEXT;');
  if (!profileCols.includes('family_status')) db.exec('ALTER TABLE year2_profiles ADD COLUMN family_status TEXT;');
  if (!profileCols.includes('family_details')) db.exec('ALTER TABLE year2_profiles ADD COLUMN family_details TEXT;');
  if (!profileCols.includes('last_step')) db.exec('ALTER TABLE year2_profiles ADD COLUMN last_step INTEGER DEFAULT 1;');
  if (!profileCols.includes('photo_id')) db.exec('ALTER TABLE year2_profiles ADD COLUMN photo_id TEXT;');
  if (!profileCols.includes('photo_filename')) db.exec('ALTER TABLE year2_profiles ADD COLUMN photo_filename TEXT;');
  if (!profileCols.includes('photo_mime')) db.exec('ALTER TABLE year2_profiles ADD COLUMN photo_mime TEXT;');
  if (!profileCols.includes('photo_size')) db.exec('ALTER TABLE year2_profiles ADD COLUMN photo_size INTEGER;');
  if (!profileCols.includes('family_photo_path')) db.exec('ALTER TABLE year2_profiles ADD COLUMN family_photo_path TEXT;');

  const photoCols = (db.prepare('PRAGMA table_info(photos)').all() as any[]).map(c => c.name);
  if (photoCols.length > 0 && !photoCols.includes('storage_path')) {
    db.exec('ALTER TABLE photos ADD COLUMN storage_path TEXT;');
  }

  const prefCols = (db.prepare('PRAGMA table_info(year2_preferences)').all() as any[]).map(c => c.name);
  if (!prefCols.includes('wishlist_other')) db.exec('ALTER TABLE year2_preferences ADD COLUMN wishlist_other TEXT;');
  if (!prefCols.includes('dream_experience')) db.exec('ALTER TABLE year2_preferences ADD COLUMN dream_experience TEXT;');
  if (!prefCols.includes('contribution_other')) db.exec('ALTER TABLE year2_preferences ADD COLUMN contribution_other TEXT;');
  if (!prefCols.includes('contribution_help_text')) db.exec('ALTER TABLE year2_preferences ADD COLUMN contribution_help_text TEXT;');
  if (!prefCols.includes('identity_known_for')) db.exec('ALTER TABLE year2_preferences ADD COLUMN identity_known_for TEXT;');
  if (!prefCols.includes('identity_statement')) db.exec('ALTER TABLE year2_preferences ADD COLUMN identity_statement TEXT;');
}

export function validateAndImportYear1Members(records: any[], adminEmail = 'super_admin') {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No member records provided for import.');
  }

  // 1. Critical Security Rule: Strict rejection of any Aadhaar fields
  for (const raw of records) {
    for (const [k, v] of Object.entries(raw)) {
      const kLower = k.toLowerCase();
      const vLower = String(v || '').toLowerCase();
      if (
        kLower.includes('aadhaar') ||
        kLower.includes('aadhar') ||
        kLower.includes('uidai') ||
        vLower.includes('aadhaar') ||
        vLower.includes('aadhar') ||
        vLower.includes('uidai')
      ) {
        throw new Error(`SECURITY VIOLATION: Aadhaar data detected in record (${k}). Aadhaar storage or ingestion is strictly forbidden.`);
      }
    }
  }

  // 2. Validate Couple IDs (Format JR001 to JR110)
  const coupleIdMap = new Map<string, number>();
  const husbandMobilesCount = new Map<string, string[]>();
  const wifeMobilesCount = new Map<string, string[]>();

  for (const r of records) {
    const coupleId = (r.couple_id || '').trim().toUpperCase();
    if (!coupleId || !/^JR(0\d{2}|10\d|110)$/.test(coupleId)) {
      throw new Error(`Invalid Couple ID format: "${coupleId}". Must be JR001 through JR110.`);
    }
    coupleIdMap.set(coupleId, (coupleIdMap.get(coupleId) || 0) + 1);

    const rawHMob = (r.husband_registered_mobile || '').toString().trim();
    const cleanHMob = rawHMob.replace(/[^0-9]/g, '');
    const normHMob = cleanHMob.length > 0 ? (cleanHMob.length === 12 && cleanHMob.startsWith('91') ? cleanHMob.slice(2) : cleanHMob) : '';

    const rawWMob = (r.wife_registered_mobile || '').toString().trim();
    const cleanWMob = rawWMob.replace(/[^0-9]/g, '');
    const normWMob = cleanWMob.length > 0 ? (cleanWMob.length === 12 && cleanWMob.startsWith('91') ? cleanWMob.slice(2) : cleanWMob) : '';

    if (normHMob) {
      const arr = husbandMobilesCount.get(normHMob) || [];
      arr.push(coupleId);
      husbandMobilesCount.set(normHMob, arr);
    }
    if (normWMob) {
      const arr = wifeMobilesCount.get(normWMob) || [];
      arr.push(coupleId);
      wifeMobilesCount.set(normWMob, arr);
    }
  }

  // Check for duplicate Couple IDs in payload
  const duplicateIds: string[] = [];
  for (const [id, count] of coupleIdMap.entries()) {
    if (count > 1) duplicateIds.push(id);
  }
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate Couple IDs found in import payload: ${duplicateIds.join(', ')}`);
  }

  // 3. Process and analyze each record
  const now = new Date().toISOString();
  const processedRows = records.map((r) => {
    const couple_id = (r.couple_id || '').trim().toUpperCase();
    const husband_name = (r.husband_name || '').trim();
    const wife_name = (r.wife_name || '').trim();

    const rawHMob = r.husband_registered_mobile != null ? String(r.husband_registered_mobile).trim() : '';
    const cleanHMob = rawHMob.replace(/[^0-9]/g, '');
    const husband_registered_mobile = cleanHMob.length > 0 ? (cleanHMob.length === 12 && cleanHMob.startsWith('91') ? cleanHMob.slice(2) : cleanHMob) : null;

    const rawWMob = r.wife_registered_mobile != null ? String(r.wife_registered_mobile).trim() : '';
    const cleanWMob = rawWMob.replace(/[^0-9]/g, '');
    const wife_registered_mobile = cleanWMob.length > 0 ? (cleanWMob.length === 12 && cleanWMob.startsWith('91') ? cleanWMob.slice(2) : cleanWMob) : null;

    const husband_dob = r.husband_dob ? String(r.husband_dob).trim() : null;
    const wife_dob = r.wife_dob ? String(r.wife_dob).trim() : null;
    const marriage_anniversary = r.marriage_anniversary ? String(r.marriage_anniversary).trim() : null;
    const kids = r.kids ? String(r.kids).trim() : (r.children ? String(r.children).trim() : null);
    const year1_status = 'Active / Year-1 Member';

    // Mobile review rules:
    // - missing husband mobile
    // - missing wife mobile
    // - duplicate husband mobile
    // - duplicate wife mobile
    // - suspicious/invalid mobile format
    const reviewReasons: string[] = [];

    if (!husband_registered_mobile) {
      reviewReasons.push('Missing husband mobile');
    } else if (husband_registered_mobile.length !== 10) {
      reviewReasons.push(`Suspicious husband mobile format (${husband_registered_mobile})`);
    } else if (husbandMobilesCount.get(husband_registered_mobile) && husbandMobilesCount.get(husband_registered_mobile)!.length > 1) {
      reviewReasons.push(`Duplicate husband mobile (shared with ${husbandMobilesCount.get(husband_registered_mobile)!.filter(id => id !== couple_id).join(', ')})`);
    }

    if (!wife_registered_mobile) {
      reviewReasons.push('Missing wife mobile');
    } else if (wife_registered_mobile.length !== 10) {
      reviewReasons.push(`Suspicious wife mobile format (${wife_registered_mobile})`);
    } else if (wifeMobilesCount.get(wife_registered_mobile) && wifeMobilesCount.get(wife_registered_mobile)!.length > 1) {
      reviewReasons.push(`Duplicate wife mobile (shared with ${wifeMobilesCount.get(wife_registered_mobile)!.filter(id => id !== couple_id).join(', ')})`);
    }

    const requires_mobile_review = reviewReasons.length > 0 ? 1 : 0;
    const mobile_review_reasons = reviewReasons.length > 0 ? reviewReasons.join('; ') : null;

    return {
      couple_id,
      husband_name,
      wife_name,
      husband_registered_mobile,
      wife_registered_mobile,
      husband_dob,
      wife_dob,
      marriage_anniversary,
      kids,
      year1_status,
      requires_mobile_review,
      mobile_review_reasons,
      year1_profile_data: JSON.stringify({
        city: r.city || r.year1_city || 'Indore',
        residential_address: r.residential_address || '',
        husband_qualification: r.husband_qualification || '',
        husband_occupation: r.husband_occupation || '',
        husband_organization: r.husband_organization || '',
        wife_qualification: r.wife_qualification || '',
        wife_occupation: r.wife_occupation || '',
        wife_organization: r.wife_organization || '',
        kids: kids || 'None Recorded',
        age_kid_1: r.age_kid_1 || '',
        age_kid_2: r.age_kid_2 || '',
        business: r.husband_organization || r.husband_occupation || r.business || 'Business',
        importedAt: now
      }),
      active_status: 1,
      created_at: now,
      updated_at: now
    };
  });

  // 4. Transactionally import into database
  const importTx = db.transaction(() => {
    // Clean out previous test members
    db.prepare('DELETE FROM members').run();

    const insertStmt = db.prepare(`
      INSERT INTO members (
        couple_id, husband_name, wife_name,
        husband_registered_mobile, wife_registered_mobile,
        husband_dob, wife_dob, marriage_anniversary,
        kids, year1_status, requires_mobile_review, mobile_review_reasons,
        year1_profile_data, active_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    for (const row of processedRows) {
      insertStmt.run(
        row.couple_id,
        row.husband_name,
        row.wife_name,
        row.husband_registered_mobile,
        row.wife_registered_mobile,
        row.husband_dob,
        row.wife_dob,
        row.marriage_anniversary,
        row.kids,
        row.year1_status,
        row.requires_mobile_review,
        row.mobile_review_reasons,
        row.year1_profile_data,
        row.active_status,
        row.created_at,
        row.updated_at
      );
    }
  });

  importTx();

  logAdminAudit(
    adminEmail,
    'Master data imported',
    undefined,
    `Successfully imported ${processedRows.length} Year-1 member records.`
  );

  return getMembersImportStatus();
}

export function getMembersImportStatus() {
  const allMembers = db.prepare('SELECT * FROM members ORDER BY couple_id ASC').all() as any[];
  const totalMembers = allMembers.length;
  const coupleIds = allMembers.map((m) => m.couple_id);
  const jr001Present = coupleIds.includes('JR001');
  const jr110Present = coupleIds.includes('JR110');

  const expectedIds: string[] = [];
  for (let i = 1; i <= 110; i++) {
    expectedIds.push(`JR${String(i).padStart(3, '0')}`);
  }

  const missingCoupleIds = expectedIds.filter((id) => !coupleIds.includes(id));

  // Find duplicate IDs
  const seenIds = new Set<string>();
  const duplicateCoupleIds: string[] = [];
  for (const id of coupleIds) {
    if (seenIds.has(id) && !duplicateCoupleIds.includes(id)) {
      duplicateCoupleIds.push(id);
    }
    seenIds.add(id);
  }

  // Mobile and demographic statistics
  let missingHusbandMobile = 0;
  let missingWifeMobile = 0;
  let missingHusbandDob = 0;
  let missingWifeDob = 0;
  let missingAnniversary = 0;

  const husbandMobilesMap = new Map<string, string[]>();
  const wifeMobilesMap = new Map<string, string[]>();

  for (const m of allMembers) {
    const hMob = (m.husband_registered_mobile || '').toString().trim();
    const wMob = (m.wife_registered_mobile || '').toString().trim();

    if (!hMob) missingHusbandMobile++;
    else {
      const arr = husbandMobilesMap.get(hMob) || [];
      arr.push(m.couple_id);
      husbandMobilesMap.set(hMob, arr);
    }

    if (!wMob) missingWifeMobile++;
    else {
      const arr = wifeMobilesMap.get(wMob) || [];
      arr.push(m.couple_id);
      wifeMobilesMap.set(wMob, arr);
    }

    if (!m.husband_dob || !String(m.husband_dob).trim()) missingHusbandDob++;
    if (!m.wife_dob || !String(m.wife_dob).trim()) missingWifeDob++;
    if (!m.marriage_anniversary || !String(m.marriage_anniversary).trim()) missingAnniversary++;
  }

  const duplicateHusbandMobiles: Array<{ mobile: string; couples: string[] }> = [];
  for (const [mob, couples] of husbandMobilesMap.entries()) {
    if (couples.length > 1) duplicateHusbandMobiles.push({ mobile: mob, couples });
  }

  const duplicateWifeMobiles: Array<{ mobile: string; couples: string[] }> = [];
  for (const [mob, couples] of wifeMobilesMap.entries()) {
    if (couples.length > 1) duplicateWifeMobiles.push({ mobile: mob, couples });
  }

  // Security check: Verify Aadhaar fields imported is exactly 0
  const cols = (db.prepare('PRAGMA table_info(members)').all() as any[]).map((c) => c.name);
  let aadhaarFieldsImported = 0;
  for (const col of cols) {
    if (col.toLowerCase().includes('aadhaar') || col.toLowerCase().includes('aadhar')) {
      aadhaarFieldsImported++;
    }
  }

  const reviewMembers = allMembers.filter((m) => m.requires_mobile_review === 1);

  const isReady =
    totalMembers === 110 &&
    jr001Present &&
    jr110Present &&
    missingCoupleIds.length === 0 &&
    duplicateCoupleIds.length === 0 &&
    aadhaarFieldsImported === 0;

  return {
    isReady,
    totalMembers,
    jr001Present,
    jr110Present,
    missingCoupleIds,
    duplicateCoupleIds,
    missingHusbandMobile,
    missingWifeMobile,
    duplicateHusbandMobiles,
    duplicateWifeMobiles,
    missingHusbandDob,
    missingWifeDob,
    missingAnniversary,
    aadhaarFieldsImported,
    recordsRequiringMobileReview: reviewMembers.length,
    mobileReviewList: reviewMembers.map((m) => ({
      couple_id: m.couple_id,
      husband_name: m.husband_name,
      wife_name: m.wife_name,
      husband_mobile: m.husband_registered_mobile,
      wife_mobile: m.wife_registered_mobile,
      reasons: m.mobile_review_reasons,
    })),
  };
}

function seedAdminUsers() {
  const insertOrUpdateAdmin = db.prepare(`
    INSERT INTO admin_users (email, role, password_hash, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
  `);
  const now = new Date().toISOString();
  insertOrUpdateAdmin.run('subodhjain2007777@gmail.com', 'super_admin', 'rroyals2027', now);
  insertOrUpdateAdmin.run('admin@jsgroyals.org', 'admin', 'rroyals2027', now);
  console.log('Seeded and updated admin PIN to rroyals2027');
}

// STEP 2 REQUIREMENT: Create ONLY 3 clearly marked test members with obviously fictional test information
export function seed3FictionalTestMembers(force = false) {
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number };
  if (memberCount.count > 0 && !force) {
    return;
  }

  const now = new Date().toISOString();
  
  // Delete child records and OTP codes first to respect foreign key constraints
  db.exec(`
    DELETE FROM member_admin_notes;
    DELETE FROM audit_logs;
    DELETE FROM photos;
    DELETE FROM otp_codes;
    DELETE FROM verification;
    DELETE FROM year2_profiles;
    DELETE FROM year2_preferences;
    DELETE FROM submissions;
    DELETE FROM correction_requests;
    DELETE FROM members;
  `);

  // Clean up private photos storage folder on full test reset
  const photosDir = path.resolve(process.cwd(), 'data', 'year2-photos');
  if (fs.existsSync(photosDir)) {
    try {
      fs.rmSync(photosDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  }

  const insertMember = db.prepare(`
    INSERT INTO members (
      couple_id, husband_name, wife_name,
      husband_registered_mobile, wife_registered_mobile,
      husband_dob, wife_dob, marriage_anniversary,
      year1_profile_data, active_status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  // Fictional Test Member 1: JR001
  insertMember.run(
    'JR001',
    '[TEST] Husband Alpha',
    '[TEST] Wife Alpha',
    '9990000001',
    '9990000002',
    '1985-01-15',
    '1987-03-20',
    '12 December',
    JSON.stringify({ city: 'Test City A', business: 'Fictional Testing Enterprises', children: '2 Test Children' }),
    1,
    now,
    now
  );

  // Fictional Test Member 2: JR002
  insertMember.run(
    'JR002',
    '[TEST] Husband Beta',
    '[TEST] Wife Beta',
    '9990000003',
    '9990000004',
    '1983-06-10',
    '1986-09-25',
    '05 February',
    JSON.stringify({ city: 'Test City B', business: 'Fictional Software Diagnostics', children: '1 Test Child' }),
    1,
    now,
    now
  );

  // Fictional Test Member 3: JR003
  insertMember.run(
    'JR003',
    '[TEST] Husband Gamma',
    '[TEST] Wife Gamma',
    '9990000005',
    '9990000006',
    '1988-11-05',
    '1990-04-18',
    '28 April',
    JSON.stringify({ city: 'Test City C', business: 'Fictional Analytics Lab', children: 'No Children' }),
    1,
    now,
    now
  );

  console.log('Successfully seeded ONLY 3 fictional test members (JR001, JR002, JR003).');
}

export function getSetting(key: string): string | null {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  } catch (e) {
    return null;
  }
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

// Initialize tables and seed
initDatabase();
