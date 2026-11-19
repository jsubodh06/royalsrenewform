import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'jsg_royals_secure_jwt_secret_2027';
const VAULT_SECRET = process.env.MEMBER_VAULT_SECRET || JWT_SECRET;

export interface MemberVaultEntry {
  vault_id: string;
  reg_id: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  created_at: string;
  updated_at: string;
}

export function normalizeEmail(raw?: string | null): string {
  return String(raw || '').trim().toLowerCase();
}

export function computeVaultIdForEmail(rawEmail: string): string {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes('@')) return '';
  const digest = crypto
    .createHmac('sha256', VAULT_SECRET)
    .update(`vault-id:${email}`)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase();
  return `MV-${digest}`;
}

export function computeCandidateRegIdsForEmail(rawEmail: string): string[] {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes('@')) return [];
  const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 10).toUpperCase();
  return [`APP-${emailHash}`, `ROYAL-${emailHash}`];
}

function deriveVaultKeyForEmail(rawEmail: string): Buffer {
  const email = normalizeEmail(rawEmail);
  return crypto
    .createHmac('sha256', VAULT_SECRET)
    .update(`vault-key:${email}`)
    .digest();
}

export function collectHouseholdEmails(reg: any): string[] {
  const raw = [reg?.submitter_email, reg?.husband_email, reg?.wife_email];
  return Array.from(
    new Set(raw.map((e) => normalizeEmail(e)).filter((e) => e.includes('@')))
  );
}

export function collectVaultIdsForRegistration(reg: any): string[] {
  return collectHouseholdEmails(reg)
    .map((email) => computeVaultIdForEmail(email))
    .filter(Boolean);
}

function sanitizePhotoUrlForVault(val: any): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  return trimmed.slice(0, 1000);
}

function buildCompactRegistrationSnapshot(reg: any) {
  let childrenArr: any[] = [];
  if (Array.isArray(reg?.children)) {
    childrenArr = reg.children;
  } else if (typeof reg?.children_json === 'string' && reg.children_json.trim()) {
    try {
      const parsed = JSON.parse(reg.children_json);
      if (Array.isArray(parsed)) childrenArr = parsed;
    } catch {}
  }

  const normalizedChildren = childrenArr.slice(0, 10).map((c: any, idx: number) => ({
    id: String(c?.id || idx + 1),
    name: String(c?.name || ''),
    gender: c?.gender === 'daughter' ? 'daughter' : 'son',
    dob: String(c?.dob || ''),
    education: String(c?.education || ''),
    interests: String(c?.interests || ''),
    photo_url: sanitizePhotoUrlForVault(c?.photo_url),
  }));

  const nowIso = new Date().toISOString();
  const membershipType = reg?.membership_type === 'new' ? 'new' : 'existing';
  const subRole = reg?.submitted_by_role === 'wife' ? 'wife' : 'husband';
  const hEmail = normalizeEmail(reg?.husband_email);
  const wEmail = normalizeEmail(reg?.wife_email);
  const subEmail = normalizeEmail(reg?.submitter_email) || (subRole === 'wife' ? wEmail : hEmail);

  return {
    reg_id: String(reg?.reg_id || '').trim(),
    membership_type: membershipType,
    submitted_by_role: subRole,
    submitter_email: subEmail,
    husband_name: String(reg?.husband_name || ''),
    husband_mobile: String(reg?.husband_mobile || ''),
    husband_email: hEmail,
    husband_dob: reg?.husband_dob || null,
    husband_qualification: reg?.husband_qualification || null,
    husband_occupation: reg?.husband_occupation || null,
    husband_organization: reg?.husband_organization || null,
    husband_blood_group: reg?.husband_blood_group || null,
    husband_instagram: reg?.husband_instagram || null,
    husband_photo_url: sanitizePhotoUrlForVault(reg?.husband_photo_url),
    wife_name: String(reg?.wife_name || ''),
    wife_mobile: String(reg?.wife_mobile || ''),
    wife_email: wEmail,
    wife_dob: reg?.wife_dob || null,
    wife_qualification: reg?.wife_qualification || null,
    wife_occupation: reg?.wife_occupation || null,
    wife_organization: reg?.wife_organization || null,
    wife_blood_group: reg?.wife_blood_group || null,
    wife_instagram: reg?.wife_instagram || null,
    wife_photo_url: sanitizePhotoUrlForVault(reg?.wife_photo_url),
    marriage_anniversary: String(reg?.marriage_anniversary || ''),
    current_city: String(reg?.current_city || ''),
    residential_address: String(reg?.residential_address || ''),
    native_place: reg?.native_place || null,
    has_children: Boolean(reg?.has_children) || normalizedChildren.length > 0,
    children: normalizedChildren,
    couple_photo_url: sanitizePhotoUrlForVault(reg?.couple_photo_url),
    family_photo_url: sanitizePhotoUrlForVault(reg?.family_photo_url),
    contribution_areas: reg?.contribution_areas || null,
    royal_idea: reg?.royal_idea || null,
    jsg_should_be_known_for: reg?.jsg_should_be_known_for || null,
    president_name: reg?.president_name || null,
    president_mobile: reg?.president_mobile || null,
    secretary_name: reg?.secretary_name || null,
    secretary_mobile: reg?.secretary_mobile || null,
    other_group_member: reg?.other_group_member || null,
    other_group_name: reg?.other_group_name || null,
    other_group_position: reg?.other_group_position || null,
    new_member_contribution: reg?.new_member_contribution || null,
    reference_name: reg?.reference_name || null,
    reference_mobile: reg?.reference_mobile || null,
    business_description: reg?.business_description || null,
    exp_rating:
      typeof reg?.exp_rating === 'number' && Number.isFinite(reg.exp_rating)
        ? reg.exp_rating
        : null,
    exp_favourite_event: reg?.exp_favourite_event || null,
    exp_international_trip: reg?.exp_international_trip || null,
    exp_trip_month_destination: reg?.exp_trip_month_destination || null,
    exp_missing: reg?.exp_missing || null,
    status: reg?.status || (membershipType === 'new' ? 'pending_review' : 'submitted'),
    created_at: String(reg?.created_at || nowIso),
    updated_at: String(reg?.updated_at || nowIso),
  };
}

export function encryptRegistrationForVaults(reg: any): MemberVaultEntry[] {
  const snapshot = buildCompactRegistrationSnapshot(reg);
  if (!snapshot.reg_id || !/^[a-zA-Z0-9_\-]+$/.test(snapshot.reg_id)) {
    return [];
  }

  const emails = collectHouseholdEmails(snapshot);
  if (emails.length === 0) return [];

  const plaintext = JSON.stringify(snapshot);
  const nowIso = new Date().toISOString();
  const entries: MemberVaultEntry[] = [];

  for (const email of emails) {
    const vaultId = computeVaultIdForEmail(email);
    if (!vaultId) continue;
    const key = deriveVaultKeyForEmail(email);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const ciphertext = encrypted.toString('base64');

    if (ciphertext.length > 115000) {
      continue;
    }

    entries.push({
      vault_id: vaultId,
      reg_id: snapshot.reg_id,
      iv: iv.toString('base64'),
      auth_tag: authTag.toString('base64'),
      ciphertext,
      created_at: snapshot.created_at || nowIso,
      updated_at: snapshot.updated_at || nowIso,
    });
  }

  return entries;
}

export function decryptVaultForEmail(
  rawEmail: string,
  vaultDoc: { iv?: string; auth_tag?: string; ciphertext?: string } | null | undefined
): any | null {
  try {
    if (!vaultDoc?.iv || !vaultDoc?.auth_tag || !vaultDoc?.ciphertext) {
      return null;
    }
    const email = normalizeEmail(rawEmail);
    if (!email || !email.includes('@')) return null;

    const key = deriveVaultKeyForEmail(email);
    const iv = Buffer.from(vaultDoc.iv, 'base64');
    const authTag = Buffer.from(vaultDoc.auth_tag, 'base64');
    const ciphertext = Buffer.from(vaultDoc.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted);
    if (!parsed || typeof parsed !== 'object' || !parsed.reg_id) {
      return null;
    }

    const householdEmails = collectHouseholdEmails(parsed);
    if (!householdEmails.includes(email)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function signFamilyLookupToken(rawEmail: string, role: 'husband' | 'wife'): string {
  const email = normalizeEmail(rawEmail);
  return jwt.sign(
    { purpose: 'family_otp_lookup', email, role: role === 'wife' ? 'wife' : 'husband' },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

export function verifyFamilyLookupToken(
  token: string
): { email: string; role: 'husband' | 'wife' } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded?.purpose !== 'family_otp_lookup' || typeof decoded?.email !== 'string') {
      return null;
    }
    const email = normalizeEmail(decoded.email);
    if (!email.includes('@')) return null;
    return {
      email,
      role: decoded.role === 'wife' ? 'wife' : 'husband',
    };
  } catch {
    return null;
  }
}

export function buildRegistrationMatchSummary(
  rawEmail: string,
  existingRecord: any,
  role?: 'husband' | 'wife'
) {
  const email = normalizeEmail(rawEmail);
  const isHusbandEmail = normalizeEmail(existingRecord?.husband_email) === email;
  const isWifeEmail = normalizeEmail(existingRecord?.wife_email) === email;
  const submittedByRole = existingRecord?.submitted_by_role === 'wife' ? 'wife' : 'husband';

  let filedBySpouse = false;
  let spouseName = '';
  let spouseRole: 'husband' | 'wife' = 'husband';
  let message = '';

  const dateFormatted = new Date(existingRecord?.created_at || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (isWifeEmail && submittedByRole === 'husband') {
    filedBySpouse = true;
    spouseName = existingRecord.husband_name || '';
    spouseRole = 'husband';
    message = `✨ Your husband, ${existingRecord.husband_name}, has already registered your royal household on ${dateFormatted}!`;
  } else if (isHusbandEmail && submittedByRole === 'wife') {
    filedBySpouse = true;
    spouseName = existingRecord.wife_name || '';
    spouseRole = 'wife';
    message = `✨ Your wife, ${existingRecord.wife_name}, has already registered your royal household on ${dateFormatted}!`;
  } else if (!isHusbandEmail && !isWifeEmail && role === 'wife' && submittedByRole === 'husband') {
    filedBySpouse = true;
    spouseName = existingRecord.husband_name || '';
    spouseRole = 'husband';
    message = `✨ Your husband, ${existingRecord.husband_name}, has already registered your royal household on ${dateFormatted}!`;
  } else if (!isHusbandEmail && !isWifeEmail && role === 'husband' && submittedByRole === 'wife') {
    filedBySpouse = true;
    spouseName = existingRecord.wife_name || '';
    spouseRole = 'wife';
    message = `✨ Your wife, ${existingRecord.wife_name}, has already registered your royal household on ${dateFormatted}!`;
  } else {
    filedBySpouse = false;
    spouseName = submittedByRole === 'husband' ? existingRecord.wife_name || '' : existingRecord.husband_name || '';
    spouseRole = submittedByRole === 'husband' ? 'wife' : 'husband';
    message = `✨ Your royal family dossier was already recorded on ${dateFormatted}.`;
  }

  let parsedChildren: any[] = [];
  if (Array.isArray(existingRecord?.children)) {
    parsedChildren = existingRecord.children;
  } else if (typeof existingRecord?.children_json === 'string' && existingRecord.children_json.trim()) {
    try {
      const parsed = JSON.parse(existingRecord.children_json);
      if (Array.isArray(parsed)) parsedChildren = parsed;
    } catch {}
  }

  return {
    isAlreadyRegistered: true,
    alreadyRegistered: true,
    filedBySpouse,
    spouseName,
    spouseRole,
    message,
    registration: {
      ...existingRecord,
      children: parsedChildren,
    },
  };
}

export function rehydrateLocalRegistrationCache(rawReg: any): void {
  const reg = buildCompactRegistrationSnapshot(rawReg);
  if (!reg.reg_id || !reg.husband_name || !reg.wife_name) return;

  try {
    const existingRow = db
      .prepare('SELECT id, updated_at FROM family_registrations WHERE UPPER(reg_id) = UPPER(?) LIMIT 1')
      .get(reg.reg_id) as any;

    const childrenJson = JSON.stringify(reg.children || []);
    const hasChildrenInt = reg.has_children ? 1 : 0;

    if (existingRow) {
      const existingTime = new Date(existingRow.updated_at || 0).getTime() || 0;
      const incomingTime = new Date(reg.updated_at || reg.created_at || 0).getTime() || 0;
      if (existingTime >= incomingTime) {
        return;
      }
      db.prepare(`
        UPDATE family_registrations SET
          submitted_by_role = ?, submitter_email = ?,
          husband_name = ?, husband_mobile = ?, husband_email = ?, husband_dob = ?,
          husband_qualification = ?, husband_occupation = ?, husband_organization = ?, husband_blood_group = ?, husband_instagram = ?,
          wife_name = ?, wife_mobile = ?, wife_email = ?, wife_dob = ?,
          wife_qualification = ?, wife_occupation = ?, wife_organization = ?, wife_blood_group = ?, wife_instagram = ?,
          marriage_anniversary = ?, current_city = ?, residential_address = ?, native_place = ?,
          has_children = ?, children_json = ?,
          husband_photo_url = ?, wife_photo_url = ?, couple_photo_url = ?, family_photo_url = ?,
          contribution_areas = ?, royal_idea = ?, jsg_should_be_known_for = ?,
          president_name = ?, president_mobile = ?, secretary_name = ?, secretary_mobile = ?,
          membership_type = ?, other_group_member = ?, other_group_name = ?, other_group_position = ?,
          new_member_contribution = ?, reference_name = ?, reference_mobile = ?, business_description = ?,
          exp_rating = ?, exp_favourite_event = ?, exp_international_trip = ?, exp_trip_month_destination = ?, exp_missing = ?,
          status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        reg.submitted_by_role, reg.submitter_email,
        reg.husband_name, reg.husband_mobile, reg.husband_email, reg.husband_dob,
        reg.husband_qualification, reg.husband_occupation, reg.husband_organization, reg.husband_blood_group, reg.husband_instagram,
        reg.wife_name, reg.wife_mobile, reg.wife_email, reg.wife_dob,
        reg.wife_qualification, reg.wife_occupation, reg.wife_organization, reg.wife_blood_group, reg.wife_instagram,
        reg.marriage_anniversary, reg.current_city, reg.residential_address, reg.native_place,
        hasChildrenInt, childrenJson,
        reg.husband_photo_url, reg.wife_photo_url, reg.couple_photo_url, reg.family_photo_url,
        reg.contribution_areas, reg.royal_idea, reg.jsg_should_be_known_for,
        reg.president_name, reg.president_mobile, reg.secretary_name, reg.secretary_mobile,
        reg.membership_type, reg.other_group_member, reg.other_group_name, reg.other_group_position,
        reg.new_member_contribution, reg.reference_name, reg.reference_mobile, reg.business_description,
        reg.exp_rating, reg.exp_favourite_event, reg.exp_international_trip, reg.exp_trip_month_destination, reg.exp_missing,
        reg.status, reg.updated_at, existingRow.id
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
        reg.reg_id, reg.submitted_by_role, reg.submitter_email,
        reg.husband_name, reg.husband_mobile, reg.husband_email, reg.husband_dob,
        reg.husband_qualification, reg.husband_occupation, reg.husband_organization, reg.husband_blood_group, reg.husband_instagram,
        reg.wife_name, reg.wife_mobile, reg.wife_email, reg.wife_dob,
        reg.wife_qualification, reg.wife_occupation, reg.wife_organization, reg.wife_blood_group, reg.wife_instagram,
        reg.marriage_anniversary, reg.current_city, reg.residential_address, reg.native_place,
        hasChildrenInt, childrenJson,
        reg.husband_photo_url, reg.wife_photo_url, reg.couple_photo_url, reg.family_photo_url,
        reg.contribution_areas, reg.royal_idea, reg.jsg_should_be_known_for,
        reg.president_name, reg.president_mobile, reg.secretary_name, reg.secretary_mobile,
        reg.membership_type, reg.other_group_member, reg.other_group_name, reg.other_group_position,
        reg.new_member_contribution, reg.reference_name, reg.reference_mobile, reg.business_description,
        reg.exp_rating, reg.exp_favourite_event, reg.exp_international_trip, reg.exp_trip_month_destination, reg.exp_missing,
        reg.status, reg.created_at, reg.updated_at
      );
    }
  } catch (err) {
    console.warn('Local SQLite cache rehydration skipped:', err);
  }
}
