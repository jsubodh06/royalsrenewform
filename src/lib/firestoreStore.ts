import {
  collection,
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
    husband_dob: clampOptionalStr(reg?.husband_dob, 40),
    husband_qualification: clampOptionalStr(reg?.husband_qualification, 200),
    husband_occupation: clampOptionalStr(reg?.husband_occupation, 200),
    husband_organization: clampOptionalStr(reg?.husband_organization, 200),
    husband_blood_group: clampOptionalStr(reg?.husband_blood_group, 10),
    husband_photo_url: clampOptionalStr(reg?.husband_photo_url, 1000),

    wife_name: clampStr(reg?.wife_name, 150) || 'Spouse',
    wife_mobile: sanitizeMobile(reg?.wife_mobile),
    wife_email: wEmail,
    wife_dob: clampOptionalStr(reg?.wife_dob, 40),
    wife_qualification: clampOptionalStr(reg?.wife_qualification, 200),
    wife_occupation: clampOptionalStr(reg?.wife_occupation, 200),
    wife_organization: clampOptionalStr(reg?.wife_organization, 200),
    wife_blood_group: clampOptionalStr(reg?.wife_blood_group, 10),
    wife_photo_url: clampOptionalStr(reg?.wife_photo_url, 1000),

    marriage_anniversary: clampRequiredStr(reg?.marriage_anniversary, 4, 40, '2000-01-01'),
    current_city: clampStr(reg?.current_city, 120) || 'Indore',
    residential_address: clampStr(reg?.residential_address, 600) || 'Indore',
    native_place: clampOptionalStr(reg?.native_place, 200),

    has_children: Boolean(reg?.has_children),
    children: sanitizedChildren,
    couple_photo_url: clampOptionalStr(reg?.couple_photo_url, 1000),
    family_photo_url: clampOptionalStr(reg?.family_photo_url, 1000),

    contribution_areas: clampOptionalStr(reg?.contribution_areas, 1000),
    royal_idea: clampOptionalStr(reg?.royal_idea, 2000),
    jsg_should_be_known_for: clampOptionalStr(reg?.jsg_should_be_known_for, 2000),

    president_name: clampOptionalStr(reg?.president_name, 150) || 'Utkarsh Pooja Surana',
    president_mobile: clampOptionalStr(reg?.president_mobile, 25) || '8770713343',
    secretary_name: clampOptionalStr(reg?.secretary_name, 150) || 'Harsh Tanya Kataria',
    secretary_mobile: clampOptionalStr(reg?.secretary_mobile, 25) || '9669618111',

    other_group_member: clampOptionalStr(reg?.other_group_member, 10),
    other_group_name: clampOptionalStr(reg?.other_group_name, 200),
    new_member_contribution: clampOptionalStr(reg?.new_member_contribution, 2000),
    reference_name: clampOptionalStr(reg?.reference_name, 150),
    reference_mobile: clampOptionalStr(reg?.reference_mobile, 20),
    business_description: clampOptionalStr(reg?.business_description, 2000),

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

export async function saveFamilyRegistrationToFirestore(reg: any): Promise<void> {
  const payload = buildFirestoreFamilyRegistrationPayload(reg);
  const path = `family_registrations/${payload.reg_id}`;
  try {
    await setDoc(doc(db, 'family_registrations', payload.reg_id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Also mirror new member applications in dedicated Firestore collection
  if (payload.membership_type === 'new') {
    const subRole = payload.submitted_by_role;
    const applicantName = subRole === 'wife' ? payload.wife_name : payload.husband_name;
    const businessName =
      (subRole === 'wife' ? payload.wife_organization : payload.husband_organization) ||
      payload.husband_organization ||
      payload.wife_organization ||
      'New Member Business';
    const mobileNumber = subRole === 'wife' ? payload.wife_mobile : payload.husband_mobile;

    await saveNewMemberApplicationToFirestore({
      app_id: payload.reg_id,
      applicant_name: applicantName,
      business_name: businessName,
      mobile_number: mobileNumber,
      email: payload.submitter_email,
      other_group_member: payload.other_group_member === 'Yes' ? 'Yes' : 'No',
      other_group_name: payload.other_group_name,
      contribution: payload.new_member_contribution || payload.contribution_areas || 'Community participation',
      reference_name: payload.reference_name || 'Committee Reference',
      reference_mobile: payload.reference_mobile || '0000000000',
      business_description: payload.business_description || businessName,
      president_name: payload.president_name,
      president_mobile: payload.president_mobile,
      secretary_name: payload.secretary_name,
      secretary_mobile: payload.secretary_mobile,
      status: 'pending_review',
      created_at: payload.created_at,
      updated_at: payload.updated_at,
    });
  }
}

export async function saveNewMemberApplicationToFirestore(appRecord: any): Promise<void> {
  const payload = buildFirestoreNewMemberApplicationPayload(appRecord);
  const path = `new_member_applications/${payload.app_id}`;
  try {
    await setDoc(doc(db, 'new_member_applications', payload.app_id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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

export async function fetchAllFamilyRegistrationsFromFirestore(): Promise<any[]> {
  const path = 'family_registrations';
  try {
    const q = query(collection(db, path), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...d.data(),
      _source: 'firestore',
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllNewMemberApplicationsFromFirestore(): Promise<any[]> {
  const path = 'new_member_applications';
  try {
    const q = query(collection(db, path), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...d.data(),
      _source: 'firestore',
    }));
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

  const cloudRegIds = new Set(cloudRegistrations.map((r) => String(r.reg_id || '').toUpperCase()));
  const cloudAppIds = new Set(cloudApplications.map((a) => String(a.app_id || '').toUpperCase()));

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
