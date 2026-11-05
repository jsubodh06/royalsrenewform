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

export async function adminLoginApi(email: string, pin: string) {
  return apiRequest<{
    token: string;
    admin: AdminSession;
  }>('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pin }),
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
