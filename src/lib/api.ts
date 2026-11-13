import {
  MemberYear1,
  Year2ProfileData,
  Year2PreferenceData,
  SubmissionData,
  CorrectionRequest,
  MemberSession,
  AdminSession,
} from './types.ts';

export const LIVE_BACKEND_URL = 'https://ais-pre-t5c2x6fk3je4yhythikayj-923279058412.asia-southeast1.run.app';

export function getApiBase(): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return '/api';
}

export const API_BASE = getApiBase();

export function getPhotoDisplayUrl(photoId: string, token?: string | null): string {
  const base = getApiBase();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/member/photo/${photoId}${tokenQuery}`;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

// 1. Auth APIs
export async function requestOtpApi(mobile: string) {
  return apiRequest<{
    success: boolean;
    coupleId: string;
    mobile: string;
    registeredName: string;
    smsDispatched?: boolean;
    fast2smsCalled?: boolean;
    fast2smsStatusCode?: number;
    message: string;
  }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

export async function verifyOtpApi(mobile: string, otp: string) {
  return apiRequest<{
    token: string;
    member: MemberSession;
  }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp }),
  });
}

export async function verifyFirebaseSessionApi(mobile: string) {
  return apiRequest<{
    token: string;
    member: MemberSession;
  }>('/auth/firebase-verify-session', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

export async function verifySecretApi(mobile: string, dateInput: string) {
  return apiRequest<{
    success: boolean;
    token: string;
    member: MemberSession;
    message: string;
  }>('/auth/verify-secret', {
    method: 'POST',
    body: JSON.stringify({ mobile, dateInput }),
  });
}

export async function adminLoginApi(email: string, pin: string) {
  return apiRequest<{
    token: string;
    admin: AdminSession;
  }>('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pin }),
  });
}

export async function getAdminSmsConfigApi(token: string) {
  return apiRequest<{
    configured: boolean;
    gateway: string;
    maskedKey: string | null;
    wallet: string | null;
    walletError: string | null;
  }>('/admin/sms-config', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function updateAdminSmsConfigApi(token: string, apiKey: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    walletCheck?: any;
  }>('/admin/sms-config', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ apiKey })
  });
}

export async function testFast2SmsApi(token: string, mobile?: string) {
  return apiRequest<{
    success: boolean;
    maskedKey: string;
    testMobile: string;
    walletResult: any;
    otpRouteResult: any;
    quickRouteResult: any;
    statusSummary: string;
    timestamp: string;
  }>('/admin/test-fast2sms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mobile }),
  });
}

export async function getRecentOtpsApi(token: string) {
  return apiRequest<{
    success: boolean;
    records: Array<{
      id: number;
      mobile: string;
      couple_id: string;
      created_at: number;
      expires_at: number;
      attempts: number;
      verified: number;
      husband_name: string;
      wife_name: string;
    }>;
  }>('/admin/recent-otps', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTestSamplesApi() {
  return apiRequest<{
    testMode: boolean;
    fixedTestOtp: string;
    adminDefaultEmail: string;
    adminDefaultPin: string;
    samples: Array<{
      couple_id: string;
      husband_name: string;
      wife_name: string;
      husband_registered_mobile: string;
      wife_registered_mobile: string;
      year1_city: string;
    }>;
  }>('/test/sample-accounts');
}

export async function resetTestDatabaseApi() {
  return apiRequest<{
    success: boolean;
    message: string;
  }>('/test/reset-database', {
    method: 'POST',
  });
}

// 2. Member APIs
export async function getMemberMeApi(token: string) {
  return apiRequest<{
    session: MemberSession;
    year1: MemberYear1;
    isSubmitted: boolean;
    hasDraft?: boolean;
    submission: SubmissionData | null;
    year2Profile: Year2ProfileData | null;
    year2Preferences: Year2PreferenceData | null;
    photo?: {
      id: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      url: string;
    } | null;
    corrections: CorrectionRequest[];
  }>('/member/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveDraftApi(
  token: string,
  profile: Partial<Year2ProfileData>,
  preferences: Partial<Year2PreferenceData>
) {
  return apiRequest<{ success: boolean; message: string }>('/member/save-draft', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profile, preferences }),
  });
}

export async function resetDraftApi(token: string) {
  return apiRequest<{ success: boolean; message: string }>('/member/reset-draft', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadPhotoApi(
  token: string,
  base64Data: string,
  filename: string,
  mimeType: string
) {
  return apiRequest<{
    success: boolean;
    photoId: string;
    filename: string;
    sizeBytes: number;
    url?: string;
  }>('/member/upload-photo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ base64Data, filename, mimeType }),
  });
}

export async function uploadPhotoMultipartApi(
  token: string,
  file: File
) {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(`${API_BASE}/member/upload-photo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Upload failed with status ${response.status}`);
  }
  return data as {
    success: boolean;
    photoId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  };
}

export async function deletePhotoApi(token: string) {
  return apiRequest<{ success: boolean; message: string }>('/member/photo', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function submitYear2Api(token: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    coupleId: string;
    submittedAt: string;
  }>('/member/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function requestCorrectionApi(
  token: string,
  requested_correction: string,
  member_message: string
) {
  return apiRequest<{ success: boolean; message: string }>('/member/request-correction', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ requested_correction, member_message }),
  });
}

// 3. Admin APIs
export async function getAdminMeApi(adminToken: string) {
  return apiRequest<{
    admin: AdminSession;
  }>('/admin/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getAdminOverviewApi(adminToken: string) {
  return apiRequest<{
    totalMembers: number;
    verifiedCount: number;
    notVerifiedCount: number;
    startedCount: number;
    incompleteCount: number;
    submittedCount: number;
    pendingCorrectionsCount: number;
  }>('/admin/overview', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getAdminMembersApi(
  adminToken: string,
  params: {
    search?: string;
    status?: string;
    verification?: string;
    year2?: string;
    corrections?: string;
    page?: number;
    limit?: number;
  }
) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.verification) query.set('verification', params.verification);
  if (params.year2) query.set('year2', params.year2);
  if (params.corrections) query.set('corrections', params.corrections);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  return apiRequest<{
    members: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/admin/members?${query.toString()}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getAdminMemberDetailApi(adminToken: string, coupleId: string) {
  return apiRequest<{
    member: MemberYear1;
    year2Profile: Year2ProfileData | null;
    year2Preferences: Year2PreferenceData | null;
    submission: SubmissionData | null;
    verifications: any[];
    corrections: CorrectionRequest[];
    notes: any[];
    photoUrl?: string | null;
  }>(`/admin/member/${coupleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function addAdminNoteApi(adminToken: string, coupleId: string, note: string) {
  return apiRequest<{ success: boolean; note: any }>('/admin/notes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ coupleId, note }),
  });
}

export async function getAdminNotesApi(adminToken: string, coupleId: string) {
  return apiRequest<{ notes: any[] }>(`/admin/notes/${coupleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getAdminCorrectionsApi(adminToken: string) {
  return apiRequest<{ corrections: any[] }>('/admin/corrections', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function resolveAdminCorrectionApi(
  adminToken: string,
  correctionId: number,
  status: string,
  adminNotes?: string
) {
  return apiRequest<{ success: boolean; message: string }>('/admin/resolve-correction', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ correctionId, status, adminNotes }),
  });
}

export async function getAdminAuditLogsApi(adminToken: string, page = 1, limit = 50) {
  return apiRequest<{
    logs: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>(`/admin/audit-logs?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getAdminExportApi(adminToken: string, filter = 'all') {
  return apiRequest<{
    exportedAt: string;
    count: number;
    data: any[];
  }>(`/admin/export?filter=${encodeURIComponent(filter)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function getMembersImportStatusApi(adminToken: string) {
  return apiRequest<{
    isReady: boolean;
    totalMembers: number;
    jr001Present: boolean;
    jr110Present: boolean;
    missingCoupleIds: string[];
    duplicateCoupleIds: string[];
    missingHusbandMobile: number;
    missingWifeMobile: number;
    duplicateHusbandMobiles: Array<{ mobile: string; couples: string[] }>;
    duplicateWifeMobiles: Array<{ mobile: string; couples: string[] }>;
    missingHusbandDob: number;
    missingWifeDob: number;
    missingAnniversary: number;
    aadhaarFieldsImported: number;
    recordsRequiringMobileReview: number;
    mobileReviewList: Array<{
      couple_id: string;
      husband_name: string;
      wife_name: string;
      husband_mobile: string | null;
      wife_mobile: string | null;
      reasons: string;
    }>;
  }>('/admin/members-import-status', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function importMembersApi(
  adminToken: string,
  payload: { members?: any[]; csvText?: string }
) {
  return apiRequest<{
    success: boolean;
    message: string;
    status: any;
  }>('/admin/import-members', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payload),
  });
}

// Fresh Email-Based Family Registration APIs & 6-Digit Email OTP
export async function requestFamilyEmailOtpApi(email: string, role: 'husband' | 'wife') {
  return apiRequest<{
    success: boolean;
    email: string;
    role: 'husband' | 'wife';
    expiresInSeconds: number;
    cooldownSeconds: number;
    emailSentReal: boolean;
    isAlreadyRegistered: boolean;
    spouseName?: string;
    spouseRole?: 'husband' | 'wife';
    filedBySpouse?: boolean;
    providerUsed?: string;
    message: string;
  }>('/family/request-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function verifyFamilyEmailOtpApi(email: string, otp: string) {
  return apiRequest<{
    verified: boolean;
    email: string;
    role: 'husband' | 'wife';
    alreadyRegistered: boolean;
    filedBySpouse?: boolean;
    spouseName?: string;
    spouseRole?: 'husband' | 'wife';
    message: string;
    registration?: any;
  }>('/family/verify-email-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

export async function getEmailConfigApi(options?: { verify?: boolean; force?: boolean }) {
  const params = new URLSearchParams();
  if (options?.verify) params.set('verify', '1');
  if (options?.force) params.set('force', '1');
  const qs = params.toString();
  return apiRequest<{
    isConfigured: boolean;
    activeProvider: 'resend' | 'brevo' | 'gmail' | 'smtp' | 'demo';
    senderEmail: string;
    maskedPass?: string | null;
    source?: 'env' | 'db' | null;
    mode: 'live' | 'demo';
    connectionOk?: boolean | null;
    connectionError?: string | null;
  }>(`/family/email-config${qs ? `?${qs}` : ''}`);
}

export async function saveEmailConfigApi(config: any) {
  return apiRequest<{
    success: boolean;
    isConfigured: boolean;
    activeProvider: string;
    senderEmail: string;
    maskedPass?: string | null;
    source?: 'env' | 'db' | null;
    mode: string;
    connectionOk?: boolean | null;
    connectionError?: string | null;
  }>('/family/email-config', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function sendAdminTestEmailApi(adminToken: string, email?: string) {
  return apiRequest<{
    success: boolean;
    provider: string;
    message: string;
  }>('/admin/test-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

export async function checkFamilyEmailApi(email: string, role: 'husband' | 'wife') {
  return apiRequest<{
    exists: boolean;
    filedBySpouse?: boolean;
    spouseName?: string;
    spouseRole?: 'husband' | 'wife';
    submitterRole?: string;
    submitterEmail?: string;
    submittedAt?: string;
    message?: string;
    registration?: any;
  }>('/family/check-email', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function registerFamilyApi(data: any) {
  return apiRequest<{
    success: boolean;
    regId: string;
    message: string;
    registration: any;
    alreadyRegistered?: boolean;
    filedBySpouse?: boolean;
    spouseName?: string;
    spouseRole?: string;
  }>('/family/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.readAsDataURL(file);
  });
}

async function optimizeImageFileForUpload(file: File): Promise<File> {
  // Compress & normalize any large or non-standard image via canvas so mobile camera
  // portraits upload reliably under proxy size/timeout limits.
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return file;
  }

  const isStandardFastSmall =
    file.size <= 550 * 1024 &&
    (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp');
  if (isStandardFastSmall) {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image decode failed'));
        el.src = objectUrl;
      });

      const maxDim = 1600;
      let { width, height } = img;
      if (!width || !height) return file;

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      // White background ensures transparent PNGs look crisp when encoded as JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );
      if (!blob || blob.size === 0) return file;

      // Keep original if it was already small standard format and smaller than canvas result
      if (
        blob.size > file.size &&
        (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp') &&
        file.size <= 2 * 1024 * 1024
      ) {
        return file;
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '') || 'photo';
      return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

export async function uploadFamilyPhotoApi(file: File) {
  const preparedFile = await optimizeImageFileForUpload(file);
  const uploadUrl = `${API_BASE}/family/upload-photo`;
  const base64Url = `${API_BASE}/family/upload-photo-base64`;

  let lastNetworkErr: any = null;

  // Attempt 1 & 2: Standard Multipart FormData upload with retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const formData = new FormData();
      formData.append('photo', preparedFile);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resData.error || `Upload failed with status ${response.status}`);
      }
      return resData as {
        success: boolean;
        filename: string;
        url: string;
      };
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      const isNetworkFailure =
        err?.name === 'TypeError' ||
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('load failed');

      if (!isNetworkFailure) {
        throw err;
      }
      lastNetworkErr = err;
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }

  // Attempt 3: JSON Base64 fallback (bypasses proxy multipart restrictions if any)
  try {
    const dataUrl = await fileToDataUrl(preparedFile);
    const response = await fetch(base64Url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataUrl, filename: preparedFile.name }),
      credentials: 'same-origin',
    });

    const resData = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(resData.error || `Upload failed with status ${response.status}`);
    }
    return resData as {
      success: boolean;
      filename: string;
      url: string;
    };
  } catch (fallbackErr: any) {
    const msg = fallbackErr?.message || lastNetworkErr?.message || 'Network error while uploading photo';
    if (msg.toLowerCase().includes('failed to fetch')) {
      throw new Error(
        'Connection interrupted while uploading photo. Please check your internet or paste a Google Drive photo link.'
      );
    }
    throw new Error(msg);
  }
}

export async function getAdminFamilyRegistrationsApi(adminToken: string) {
  return apiRequest<{
    success: boolean;
    count: number;
    registrations: any[];
  }>('/admin/family-registrations', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

