import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  AUTHORIZED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase.ts';

const photoMemoryCache = new Map<string, string>();
const inflightPhotoFetches = new Map<string, Promise<string | null>>();

function clampStr(val: unknown, maxLen: number): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function clampRequiredStr(val: unknown, minLen: number, maxLen: number, fallback: string): string {
  const cleaned = clampStr(val, maxLen);
  return cleaned.length >= minLen ? cleaned : fallback;
}

function clampOptionalStr(val: unknown, maxLen: number): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function sanitizeMobile(val: unknown): string {
  const cleaned = String(val ?? '').trim().slice(0, 20);
  if (cleaned.length >= 10) return cleaned;
  return cleaned.padEnd(10, '0');
}

function sanitizeExpRating(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.round(num);
  return intVal >= 1 && intVal <= 10 ? intVal : null;
}

function sanitizeChildrenList(children: unknown): Array<Record<string, string | null>> {
  let list: any[] = [];
  if (Array.isArray(children)) {
    list = children;
  } else if (typeof children === 'string' && children.trim()) {
    try {
      const parsed = JSON.parse(children);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  return list.slice(0, 10).map((c, idx) => ({
    id: clampStr(c?.id || String(idx + 1), 64) || String(idx + 1),
    name: clampStr(c?.name, 150),
    gender: c?.gender === 'daughter' ? 'daughter' : 'son',
    dob: clampStr(c?.dob, 40),
    education: clampStr(c?.education, 200),
    interests: clampStr(c?.interests, 300),
    photo_url: clampOptionalStr(c?.photo_url, 1000),
  }));
}

export function extractPhotoIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  const marker = '/api/family/photo/';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const filename = trimmed.slice(idx + marker.length).split('?')[0].trim();
    if (/^[a-zA-Z0-9_\-.]+$/.test(filename) && filename.length >= 3 && filename.length <= 160) {
      return filename;
    }
  }
  return null;
}

export function isAuthorizedFirebaseAdmin(): boolean {
  const user = auth.currentUser;
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()
  );
}

export function buildFirestoreFamilyRegistrationPayload(reg: any) {
  const nowIso = new Date().toISOString();
  const regId = clampStr(reg?.reg_id || reg?.regId, 64);
  if (!regId) {
    throw new Error('Missing registration ID for Firestore persistence.');
  }

  const membershipType = reg?.membership_type === 'new' ? 'new' : 'existing';
  const submittedByRole = reg?.submitted_by_role === 'wife' ? 'wife' : 'husband';
  const statusAllowed = ['submitted', 'pending_review', 'approved', 'rejected'];
  const status = statusAllowed.includes(reg?.status)
    ? reg.status
    : membershipType === 'new'
      ? 'pending_review'
      : 'submitted';

  const hEmail = clampRequiredStr(reg?.husband_email, 3, 200, 'member@jsgroyals.org').toLowerCase();
  const wEmail = clampRequiredStr(reg?.wife_email, 3, 200, 'member@jsgroyals.org').toLowerCase();
  const subEmail = clampRequiredStr(
    reg?.submitter_email || (submittedByRole === 'wife' ? wEmail : hEmail),
    3,
    200,
    submittedByRole === 'wife' ? wEmail : hEmail
  ).toLowerCase();

  const sanitizedChildren = sanitizeChildrenList(reg?.children ?? reg?.children_json);
  const createdAtIso = clampRequiredStr(reg?.created_at, 4, 64, nowIso);
  const updatedAtIso = clampRequiredStr(reg?.updated_at, 4, 64, createdAtIso);

  return {
    reg_id: regId,
    membership_type: membershipType,
    submitted_by_role: submittedByRole,
    submitter_email: subEmail,

    husband_name: clampStr(reg?.husband_name, 150) || 'Member',
    husband_mobile: sanitizeMobile(reg?.husband_mobile),
    husband_email: hEmail,
    husband_dob: clampStr(reg?.husband_dob, 40),
    husband_qualification: clampStr(reg?.husband_qualification, 200),
    husband_occupation: clampStr(reg?.husband_occupation, 200),
    husband_organization: clampStr(reg?.husband_organization, 200),
    husband_blood_group: clampStr(reg?.husband_blood_group, 10),
    husband_instagram: clampStr(reg?.husband_instagram, 120),
    husband_photo_url: clampStr(reg?.husband_photo_url, 1000),

    wife_name: clampStr(reg?.wife_name, 150) || 'Spouse',
    wife_mobile: sanitizeMobile(reg?.wife_mobile),
    wife_email: wEmail,
    wife_dob: clampStr(reg?.wife_dob, 40),
    wife_qualification: clampStr(reg?.wife_qualification, 200),
    wife_occupation: clampStr(reg?.wife_occupation, 200),
    wife_organization: clampStr(reg?.wife_organization, 200),
    wife_blood_group: clampStr(reg?.wife_blood_group, 10),
    wife_instagram: clampStr(reg?.wife_instagram, 120),
    wife_photo_url: clampStr(reg?.wife_photo_url, 1000),

    marriage_anniversary: clampStr(reg?.marriage_anniversary, 40),
    current_city: clampStr(reg?.current_city, 120),
    residential_address: clampStr(reg?.residential_address, 600),
    native_place: clampStr(reg?.native_place, 200),

    has_children: Boolean(reg?.has_children),
    children: sanitizedChildren,
    couple_photo_url: clampStr(reg?.couple_photo_url, 1000),
    family_photo_url: clampStr(reg?.family_photo_url, 1000),

    contribution_areas: clampStr(reg?.contribution_areas, 1000),
    royal_idea: clampStr(reg?.royal_idea, 2000),
    jsg_should_be_known_for: clampStr(reg?.jsg_should_be_known_for, 2000),

    president_name: clampStr(reg?.president_name, 150) || 'Utkarsh Pooja Surana',
    president_mobile: clampStr(reg?.president_mobile, 25) || '8770713343',
    secretary_name: clampStr(reg?.secretary_name, 150) || 'Harsh Tanya Kataria',
    secretary_mobile: clampStr(reg?.secretary_mobile, 25) || '9669618111',

    other_group_member: clampStr(reg?.other_group_member, 10),
    other_group_name: clampStr(reg?.other_group_name, 200),
    other_group_position: reg?.other_group_member === 'Yes' ? clampStr(reg?.other_group_position, 200) : '',
    new_member_contribution: clampStr(reg?.new_member_contribution, 2000),
    reference_name: clampStr(reg?.reference_name, 150),
    reference_mobile: clampStr(reg?.reference_mobile, 20),
    business_description: clampStr(reg?.business_description, 2000),

    exp_rating: sanitizeExpRating(reg?.exp_rating),
    exp_favourite_event: clampStr(reg?.exp_favourite_event, 1000),
    exp_international_trip: clampStr(reg?.exp_international_trip, 500),
    exp_trip_month_destination: clampStr(reg?.exp_trip_month_destination, 300),
    exp_missing: clampStr(reg?.exp_missing, 2000),

    status,
    created_at: createdAtIso,
    updated_at: updatedAtIso,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function buildFirestoreNewMemberApplicationPayload(app: any) {
  const nowIso = new Date().toISOString();
  const appId = clampStr(app?.app_id || app?.appId || app?.reg_id, 64);
  if (!appId) {
    throw new Error('Missing application ID for Firestore persistence.');
  }

  const statusAllowed = ['pending_review', 'approved', 'rejected'];
  const status = statusAllowed.includes(app?.status) ? app.status : 'pending_review';
  const createdAtIso = clampRequiredStr(app?.created_at, 4, 64, nowIso);
  const updatedAtIso = clampRequiredStr(app?.updated_at, 4, 64, createdAtIso);

  return {
    app_id: appId,
    applicant_name: clampStr(app?.applicant_name, 150) || 'Applicant',
    business_name: clampStr(app?.business_name, 200) || 'Business',
    mobile_number: sanitizeMobile(app?.mobile_number),
    email: clampRequiredStr(app?.email, 3, 200, 'applicant@jsgroyals.org').toLowerCase(),
    other_group_member: app?.other_group_member === 'Yes' ? 'Yes' : 'No',
    other_group_name: clampOptionalStr(app?.other_group_name, 200),
    other_group_position: app?.other_group_member === 'Yes' ? clampOptionalStr(app?.other_group_position, 200) : null,
    contribution: clampStr(app?.contribution, 2000) || 'Group participation',
    reference_name: clampStr(app?.reference_name, 150) || 'Member Reference',
    reference_mobile: sanitizeMobile(app?.reference_mobile),
    business_description: clampStr(app?.business_description, 2000) || 'Business',
    president_name: clampOptionalStr(app?.president_name, 150) || 'Utkarsh Pooja Surana',
    president_mobile: clampOptionalStr(app?.president_mobile, 25) || '8770713343',
    secretary_name: clampOptionalStr(app?.secretary_name, 150) || 'Harsh Tanya Kataria',
    secretary_mobile: clampOptionalStr(app?.secretary_mobile, 25) || '9669618111',
    status,
    created_at: createdAtIso,
    updated_at: updatedAtIso,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function isFirestorePermissionOrExistsError(error: any): boolean {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    code === 'already-exists' ||
    code === 'firestore/already-exists' ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('already exists')
  );
}

export async function saveFamilyRegistrationToFirestore(reg: any): Promise<void> {
  const payload = buildFirestoreFamilyRegistrationPayload(reg);
  const path = `family_registrations/${payload.reg_id}`;
  const docRef = doc(db, 'family_registrations', payload.reg_id);
  const { created_at: _omitCreatedStr, createdAt: _omitCreatedTs, ...updatePayload } = payload;

  if (isAuthorizedFirebaseAdmin()) {
    let exists = false;
    let existingData: any = null;
    try {
      const snap = await getDoc(docRef);
      exists = snap.exists();
      existingData = exists ? snap.data() : null;
    } catch (getErr) {
      handleFirestoreError(getErr, OperationType.GET, path);
    }

    if (exists) {
      const adminUpdatePayload =
        existingData && typeof existingData.created_at === 'string' && existingData.created_at
          ? updatePayload
          : { ...updatePayload, created_at: payload.created_at };
      try {
        await updateDoc(docRef, adminUpdatePayload);
      } catch (updateErr) {
        handleFirestoreError(updateErr, OperationType.UPDATE, path);
      }
    } else {
      try {
        await setDoc(docRef, payload);
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, path);
      }
    }
  } else {
    try {
      await setDoc(docRef, payload);
    } catch (createErr) {
      if (isFirestorePermissionOrExistsError(createErr)) {
        try {
          await updateDoc(docRef, updatePayload);
        } catch (updateErr) {
          console.warn(`Firestore create & update both rejected for ${path}:`, createErr, updateErr);
          handleFirestoreError(updateErr, OperationType.UPDATE, path);
        }
      } else {
        handleFirestoreError(createErr, OperationType.CREATE, path);
      }
    }
  }

  // Also mirror/update new member applications in dedicated Firestore collection
  if (payload.membership_type === 'new') {
    const subRole = payload.submitted_by_role;
    const applicantName = subRole === 'wife' ? payload.wife_name : payload.husband_name;
    const businessName =
      (subRole === 'wife' ? payload.wife_organization : payload.husband_organization) ||
      payload.husband_organization ||
      payload.wife_organization ||
      'New Member Business';
    const mobileNumber = subRole === 'wife' ? payload.wife_mobile : payload.husband_mobile;
    const mirroredStatus =
      payload.status === 'approved' || payload.status === 'rejected'
        ? payload.status
        : 'pending_review';

    await saveNewMemberApplicationToFirestore({
      app_id: payload.reg_id,
      applicant_name: applicantName,
      business_name: businessName,
      mobile_number: mobileNumber,
      email: payload.submitter_email,
      other_group_member: payload.other_group_member === 'Yes' ? 'Yes' : 'No',
      other_group_name: payload.other_group_name,
      other_group_position: payload.other_group_position,
      contribution: payload.new_member_contribution || payload.contribution_areas || 'Community participation',
      reference_name: payload.reference_name || 'Committee Reference',
      reference_mobile: payload.reference_mobile || '0000000000',
      business_description: payload.business_description || businessName,
      president_name: payload.president_name,
      president_mobile: payload.president_mobile,
      secretary_name: payload.secretary_name,
      secretary_mobile: payload.secretary_mobile,
      status: mirroredStatus,
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    });
  }
}

export async function saveNewMemberApplicationToFirestore(appRecord: any): Promise<void> {
  const payload = buildFirestoreNewMemberApplicationPayload(appRecord);
  const path = `new_member_applications/${payload.app_id}`;
  const docRef = doc(db, 'new_member_applications', payload.app_id);
  const { created_at: _omitCreatedStr, createdAt: _omitCreatedTs, ...updatePayload } = payload;

  if (isAuthorizedFirebaseAdmin()) {
    let exists = false;
    let existingData: any = null;
    try {
      const snap = await getDoc(docRef);
      exists = snap.exists();
      existingData = exists ? snap.data() : null;
    } catch (getErr) {
      handleFirestoreError(getErr, OperationType.GET, path);
    }

    if (exists) {
      const adminUpdatePayload =
        existingData && typeof existingData.created_at === 'string' && existingData.created_at
          ? updatePayload
          : { ...updatePayload, created_at: payload.created_at };
      try {
        await updateDoc(docRef, adminUpdatePayload);
      } catch (updateErr) {
        handleFirestoreError(updateErr, OperationType.UPDATE, path);
      }
    } else {
      try {
        await setDoc(docRef, payload);
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, path);
      }
    }
    return;
  }

  try {
    await setDoc(docRef, payload);
  } catch (createErr) {
    if (isFirestorePermissionOrExistsError(createErr)) {
      try {
        await updateDoc(docRef, updatePayload);
      } catch (updateErr) {
        console.warn(`Firestore create & update both rejected for ${path}:`, createErr, updateErr);
        handleFirestoreError(updateErr, OperationType.UPDATE, path);
      }
    } else {
      handleFirestoreError(createErr, OperationType.CREATE, path);
    }
  }
}

async function compressFileForFirestoreDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    throw new Error('Only browser image files can be backed up to Firestore.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image for cloud backup.'));
      el.src = objectUrl;
    });

    const maxDims = [960, 720, 540];
    const qualities = [0.76, 0.62, 0.48, 0.35];

    for (const maxDim of maxDims) {
      let { width, height } = img;
      if (!width || !height) break;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= 580000) {
          return { dataUrl, mimeType: 'image/jpeg' };
        }
      }
    }

    throw new Error('Compressed image still exceeds cloud backup limit.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function saveCompressedPhotoToFirestore(photoId: string, file: File): Promise<string | null> {
  if (!photoId || !/^[a-zA-Z0-9_\-.]+$/.test(photoId)) {
    return null;
  }

  try {
    const { dataUrl, mimeType } = await compressFileForFirestoreDataUrl(file);
    photoMemoryCache.set(photoId, dataUrl);

    const payload = {
      photo_id: photoId,
      mime_type: mimeType,
      data_url: dataUrl,
      size_bytes: dataUrl.length,
      created_at: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    const path = `family_photos/${photoId}`;
    await setDoc(doc(db, 'family_photos', photoId), payload);
    return dataUrl;
  } catch (error) {
    // Throw formatted error only if it's a Firestore permissions issue; compression skip shouldn't crash
    if (
      error instanceof Error &&
      (error.message.includes('Missing or insufficient permissions') ||
        error.message.includes('PERMISSION_DENIED'))
    ) {
      handleFirestoreError(error, OperationType.CREATE, `family_photos/${photoId}`);
    }
    console.warn('Firestore photo backup skipped:', error);
    return null;
  }
}

export async function resolvePhotoFromFirestore(urlOrFilename?: string | null): Promise<string | null> {
  if (!urlOrFilename) return null;
  const photoId = extractPhotoIdFromUrl(urlOrFilename) || (
    /^[a-zA-Z0-9_\-.]+\.(jpg|jpeg|png|webp)$/i.test(urlOrFilename.trim()) ? urlOrFilename.trim() : null
  );
  if (!photoId) return null;

  if (photoMemoryCache.has(photoId)) {
    return photoMemoryCache.get(photoId)!;
  }

  if (!isAuthorizedFirebaseAdmin()) {
    return null;
  }

  if (inflightPhotoFetches.has(photoId)) {
    return inflightPhotoFetches.get(photoId)!;
  }

  const fetchPromise = (async () => {
    const path = `family_photos/${photoId}`;
    try {
      const snap = await getDoc(doc(db, 'family_photos', photoId));
      if (snap.exists()) {
        const data = snap.data() as any;
        if (typeof data?.data_url === 'string' && data.data_url.startsWith('data:image/')) {
          photoMemoryCache.set(photoId, data.data_url);
          return data.data_url as string;
        }
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      inflightPhotoFetches.delete(photoId);
    }
  })();

  inflightPhotoFetches.set(photoId, fetchPromise);
  return fetchPromise;
}

function sortByTimestampDesc(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a?.updated_at || a?.created_at || 0).getTime() || 0;
    const tb = new Date(b?.updated_at || b?.created_at || 0).getTime() || 0;
    return tb - ta;
  });
}

export async function fetchAllFamilyRegistrationsFromFirestore(): Promise<any[]> {
  const path = 'family_registrations';
  try {
    const snap = await getDocs(collection(db, path));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        ...data,
        reg_id: data.reg_id || d.id,
        _docId: d.id,
        _source: 'firestore',
      };
    });
    return sortByTimestampDesc(list);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllNewMemberApplicationsFromFirestore(): Promise<any[]> {
  const path = 'new_member_applications';
  try {
    const snap = await getDocs(collection(db, path));
    const list = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        ...data,
        app_id: data.app_id || d.id,
        _docId: d.id,
        _source: 'firestore',
      };
    });
    return sortByTimestampDesc(list);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateRegistrationStatusInFirestore(
  regId: string,
  status: 'submitted' | 'pending_review' | 'approved' | 'rejected'
): Promise<void> {
  const path = `family_registrations/${regId}`;
  try {
    await updateDoc(doc(db, 'family_registrations', regId), {
      status,
      updated_at: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncLocalOnlyRecordsToFirestore(
  localRegistrations: any[],
  cloudRegistrations: any[],
  localApplications: any[],
  cloudApplications: any[]
): Promise<{ syncedRegistrations: number; syncedApplications: number }> {
  if (!isAuthorizedFirebaseAdmin()) {
    return { syncedRegistrations: 0, syncedApplications: 0 };
  }

  const cloudRegIds = new Set(cloudRegistrations.map((r) => String(r.reg_id || r._docId || '').toUpperCase()));
  const cloudAppIds = new Set(cloudApplications.map((a) => String(a.app_id || a._docId || '').toUpperCase()));

  let syncedRegistrations = 0;
  let syncedApplications = 0;

  for (const reg of localRegistrations) {
    const idKey = String(reg.reg_id || '').toUpperCase();
    if (idKey && !cloudRegIds.has(idKey)) {
      await saveFamilyRegistrationToFirestore(reg);
      cloudRegIds.add(idKey);
      syncedRegistrations++;
    }
  }

  for (const app of localApplications) {
    const idKey = String(app.app_id || '').toUpperCase();
    if (idKey && !cloudAppIds.has(idKey)) {
      await saveNewMemberApplicationToFirestore(app);
      cloudAppIds.add(idKey);
      syncedApplications++;
    }
  }

  return { syncedRegistrations, syncedApplications };
}

function isValidFirestoreDocId(id: string): boolean {
  return id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function isValidFirestorePhotoId(id: string): boolean {
  return id.length >= 3 && id.length <= 160 && /^[a-zA-Z0-9_.\-]+$/.test(id);
}

export function formatFirestoreErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Operation failed');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      const lower = parsed.error.toLowerCase();
      if (lower.includes('permission') || lower.includes('insufficient')) {
        return `Cloud Archive permission error (${parsed.path || 'Firestore'}). Please sign out and reconnect Google Cloud Archive as ${AUTHORIZED_ADMIN_EMAIL}.`;
      }
      return parsed.error;
    }
  } catch {}
  return raw;
}

export async function deleteFamilyPhotoFromFirestore(photoId: string): Promise<void> {
  if (!isAuthorizedFirebaseAdmin() || !isValidFirestorePhotoId(photoId)) {
    return;
  }
  const path = `family_photos/${photoId}`;
  try {
    await deleteDoc(doc(db, 'family_photos', photoId));
    photoMemoryCache.delete(photoId);
  } catch (error) {
    // Non-fatal if photo never existed or has permission constraints; avoid blocking parent delete
    console.warn(`Optional Firestore photo cleanup skipped for ${path}:`, error);
  }
}

export async function deleteMemberVaultFromFirestore(vaultId: string): Promise<void> {
  if (!isAuthorizedFirebaseAdmin() || !isValidFirestoreDocId(vaultId)) {
    return;
  }
  const path = `member_vaults/${vaultId}`;
  try {
    await deleteDoc(doc(db, 'member_vaults', vaultId));
  } catch (error) {
    console.warn(`Optional Firestore member vault cleanup skipped for ${path}:`, error);
  }
}

export interface MemberVaultDocInput {
  vault_id: string;
  reg_id: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  created_at?: string;
  updated_at?: string;
}

export async function saveMemberVaultToFirestore(entry: MemberVaultDocInput): Promise<void> {
  const vaultId = clampStr(entry?.vault_id, 128);
  const regId = clampStr(entry?.reg_id, 64);
  if (!isValidFirestoreDocId(vaultId) || !isValidFirestoreDocId(regId)) {
    return;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    vault_id: vaultId,
    reg_id: regId,
    iv: clampStr(entry.iv, 64),
    auth_tag: clampStr(entry.auth_tag, 64),
    ciphertext: clampStr(entry.ciphertext, 120000),
    created_at: clampRequiredStr(entry.created_at, 4, 64, nowIso),
    updated_at: clampRequiredStr(entry.updated_at, 4, 64, nowIso),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.iv.length < 12 || payload.auth_tag.length < 16 || payload.ciphertext.length < 20) {
    return;
  }

  const path = `member_vaults/${vaultId}`;
  const docRef = doc(db, 'member_vaults', vaultId);
  const { created_at: _omitCreatedStr, createdAt: _omitCreatedTs, ...updatePayload } = payload;

  if (isAuthorizedFirebaseAdmin()) {
    let exists = false;
    let existingData: any = null;
    try {
      const snap = await getDoc(docRef);
      exists = snap.exists();
      existingData = exists ? snap.data() : null;
    } catch {
      exists = false;
    }

    if (exists) {
      const adminUpdatePayload =
        existingData && typeof existingData.created_at === 'string' && existingData.created_at
          ? updatePayload
          : { ...updatePayload, created_at: payload.created_at };
      try {
        await updateDoc(docRef, adminUpdatePayload);
      } catch (updateErr) {
        console.warn(`Optional Firestore member vault update skipped for ${path}:`, updateErr);
      }
    } else {
      try {
        await setDoc(docRef, payload);
      } catch (createErr) {
        console.warn(`Optional Firestore member vault create skipped for ${path}:`, createErr);
      }
    }
    return;
  }

  try {
    await setDoc(docRef, payload);
  } catch (createErr) {
    if (isFirestorePermissionOrExistsError(createErr)) {
      try {
        await updateDoc(docRef, updatePayload);
      } catch (updateErr) {
        console.warn(`Optional Firestore member vault upsert skipped for ${path}:`, updateErr);
      }
    } else {
      console.warn(`Optional Firestore member vault create skipped for ${path}:`, createErr);
    }
  }
}

export async function saveMemberVaultsToFirestore(entries: MemberVaultDocInput[] | undefined | null): Promise<void> {
  if (!Array.isArray(entries) || entries.length === 0) return;
  for (const entry of entries) {
    await saveMemberVaultToFirestore(entry);
  }
}

export async function fetchMemberVaultFromFirestore(
  vaultId: string
): Promise<
  | { status: 'found'; data: { vault_id: string; reg_id: string; iv: string; auth_tag: string; ciphertext: string; updated_at?: string } }
  | { status: 'not_found' }
  | { status: 'deleted_in_cloud' }
> {
  const cleanId = clampStr(vaultId, 128);
  if (!isValidFirestoreDocId(cleanId)) {
    return { status: 'not_found' };
  }

  try {
    const snap = await getDoc(doc(db, 'member_vaults', cleanId));
    if (!snap.exists()) {
      return { status: 'not_found' };
    }
    const data = snap.data() as any;
    if (!data?.iv || !data?.auth_tag || !data?.ciphertext || !data?.reg_id) {
      return { status: 'not_found' };
    }
    return {
      status: 'found',
      data: {
        vault_id: String(data.vault_id || cleanId),
        reg_id: String(data.reg_id),
        iv: String(data.iv),
        auth_tag: String(data.auth_tag),
        ciphertext: String(data.ciphertext),
        updated_at: typeof data.updated_at === 'string' ? data.updated_at : undefined,
      },
    };
  } catch (err) {
    if (isFirestorePermissionOrExistsError(err)) {
      // Master Gate rejected read because parent family_registrations/{reg_id} was deleted in Cloud Firestore
      return { status: 'deleted_in_cloud' };
    }
    console.warn(`Member vault lookup skipped for member_vaults/${cleanId}:`, err);
    return { status: 'not_found' };
  }
}

export async function fetchFamilyRegistrationByCandidateIds(
  candidateRegIds: string[] | undefined | null
): Promise<any | null> {
  try {
    await auth.authStateReady();
  } catch {}
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return null;
  }
  if (!Array.isArray(candidateRegIds) || candidateRegIds.length === 0) {
    return null;
  }

  const found: any[] = [];
  for (const rawId of candidateRegIds) {
    const cleanId = clampStr(rawId, 128);
    if (!isValidFirestoreDocId(cleanId)) continue;
    try {
      const snap = await getDoc(doc(db, 'family_registrations', cleanId));
      if (snap.exists()) {
        const data = snap.data() || {};
        found.push({
          ...data,
          reg_id: data.reg_id || snap.id,
          _docId: snap.id,
          _source: 'firestore',
        });
      }
    } catch {
      // Ignore permission misses for non-matching candidate IDs
    }
  }

  if (found.length === 0) return null;
  return sortByTimestampDesc(found)[0];
}

export async function checkFamilyRegistrationExistsInFirestore(
  regId: string | undefined | null
): Promise<'exists' | 'missing' | 'unknown'> {
  try {
    await auth.authStateReady();
  } catch {}
  if (!isAuthorizedFirebaseAdmin()) {
    return 'unknown';
  }
  const cleanId = clampStr(regId, 128);
  if (!isValidFirestoreDocId(cleanId)) {
    return 'unknown';
  }
  try {
    const snap = await getDoc(doc(db, 'family_registrations', cleanId));
    return snap.exists() ? 'exists' : 'missing';
  } catch {
    return 'unknown';
  }
}

export async function deleteFamilyRegistrationFromFirestore(
  regIdOrIds: string | string[],
  photoIdsToClean: string[] = [],
  alsoDeleteMirroredAppIds: boolean | string[] = false,
  vaultIdsToClean: string[] = []
): Promise<void> {
  if (!isAuthorizedFirebaseAdmin()) {
    return;
  }

  const rawIds = Array.isArray(regIdOrIds) ? regIdOrIds : [regIdOrIds];
  const validRegIds = Array.from(
    new Set(rawIds.map((id) => clampStr(id, 128)).filter((id) => id && isValidFirestoreDocId(id)))
  );

  if (validRegIds.length === 0) {
    throw new Error(`Invalid Firestore registration ID: ${rawIds.join(', ')}`);
  }

  for (const cleanRegId of validRegIds) {
    const regPath = `family_registrations/${cleanRegId}`;
    try {
      await deleteDoc(doc(db, 'family_registrations', cleanRegId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, regPath);
    }
  }

  const mirroredIds =
    Array.isArray(alsoDeleteMirroredAppIds)
      ? alsoDeleteMirroredAppIds
      : alsoDeleteMirroredAppIds
        ? validRegIds
        : [];
  const validAppIds = Array.from(
    new Set(mirroredIds.map((id) => clampStr(id, 128)).filter((id) => id && isValidFirestoreDocId(id)))
  );

  for (const appId of validAppIds) {
    const appPath = `new_member_applications/${appId}`;
    try {
      await deleteDoc(doc(db, 'new_member_applications', appId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, appPath);
    }
  }

  const uniqueVaultIds = Array.from(new Set(vaultIdsToClean.filter(isValidFirestoreDocId)));
  for (const vaultId of uniqueVaultIds) {
    await deleteMemberVaultFromFirestore(vaultId);
  }

  const uniquePhotoIds = Array.from(new Set(photoIdsToClean.filter(isValidFirestorePhotoId)));
  for (const photoId of uniquePhotoIds) {
    await deleteFamilyPhotoFromFirestore(photoId);
  }
}

export async function deleteNewMemberApplicationFromFirestore(
  appIdOrIds: string | string[],
  linkedRegIdOrIds?: string | string[] | null,
  photoIdsToClean: string[] = [],
  vaultIdsToClean: string[] = []
): Promise<void> {
  if (!isAuthorizedFirebaseAdmin()) {
    return;
  }

  const rawAppIds = Array.isArray(appIdOrIds) ? appIdOrIds : [appIdOrIds];
  const validAppIds = Array.from(
    new Set(rawAppIds.map((id) => clampStr(id, 128)).filter((id) => id && isValidFirestoreDocId(id)))
  );

  if (validAppIds.length === 0) {
    throw new Error(`Invalid Firestore application ID: ${rawAppIds.join(', ')}`);
  }

  for (const cleanAppId of validAppIds) {
    const appPath = `new_member_applications/${cleanAppId}`;
    try {
      await deleteDoc(doc(db, 'new_member_applications', cleanAppId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, appPath);
    }
  }

  const rawRegIds = Array.isArray(linkedRegIdOrIds)
    ? linkedRegIdOrIds
    : linkedRegIdOrIds
      ? [linkedRegIdOrIds]
      : [];
  const validRegIds = Array.from(
    new Set(rawRegIds.map((id) => clampStr(id, 128)).filter((id) => id && isValidFirestoreDocId(id)))
  );

  for (const linkedRegId of validRegIds) {
    const regPath = `family_registrations/${linkedRegId}`;
    try {
      await deleteDoc(doc(db, 'family_registrations', linkedRegId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, regPath);
    }
  }

  const uniqueVaultIds = Array.from(new Set(vaultIdsToClean.filter(isValidFirestoreDocId)));
  for (const vaultId of uniqueVaultIds) {
    await deleteMemberVaultFromFirestore(vaultId);
  }

  const uniquePhotoIds = Array.from(new Set(photoIdsToClean.filter(isValidFirestorePhotoId)));
  for (const photoId of uniquePhotoIds) {
    await deleteFamilyPhotoFromFirestore(photoId);
  }
}

export async function deleteMemberFromFirestore(coupleId: string): Promise<void> {
  if (!isAuthorizedFirebaseAdmin()) {
    return;
  }
  const cleanId = clampStr(coupleId, 20).toUpperCase();
  if (!/^JR[0-9]{3}$/.test(cleanId)) {
    return;
  }

  for (const colName of ['submissions', 'year2_profiles', 'members'] as const) {
    const docPath = `${colName}/${cleanId}`;
    try {
      await deleteDoc(doc(db, colName, cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }
}

