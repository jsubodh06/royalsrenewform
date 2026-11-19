import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Crown,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Eye,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  LogOut,
  Check,
  Calendar,
  MapPin,
  Phone,
  FileSpreadsheet,
  FileText,
  Activity,
  MessageSquare,
  Plus,
  CheckCircle,
  XCircle,
  Camera,
  Heart,
  Briefcase,
  Terminal,
  Zap,
  Send,
  Mail,
  ExternalLink,
  KeyRound,
  Printer,
  Link2,
  Image as ImageIcon,
  UserPlus,
  Building2,
  Cloud,
  CloudOff,
  Trash2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider, AUTHORIZED_ADMIN_EMAIL } from '../lib/firebase.ts';
import {
  deleteFamilyPhotoFromFirestore,
  deleteFamilyRegistrationFromFirestore,
  deleteMemberFromFirestore,
  deleteMemberVaultFromFirestore,
  deleteNewMemberApplicationFromFirestore,
  extractPhotoIdFromUrl,
  fetchAllFamilyRegistrationsFromFirestore,
  fetchAllNewMemberApplicationsFromFirestore,
  formatFirestoreErrorMessage,
  resolvePhotoFromFirestore,
  saveMemberVaultsToFirestore
} from '../lib/firestoreStore.ts';
import { RoyalLogo } from './RoyalLogo.tsx';
import { PhotoLightboxModal, PreviewPhotoState } from './PhotoLightboxModal.tsx';
import {
  getDisplayImageSrc,
  isExternalCloudUrl,
  resolveFullMediaUrl,
  downloadMediaImage
} from '../lib/media.ts';
import {
  getAdminOverviewApi,
  getAdminMembersApi,
  getAdminMemberDetailApi,
  getAdminCorrectionsApi,
  resolveAdminCorrectionApi,
  getAdminExportApi,
  adminLoginApi,
  adminFirebaseLoginApi,
  addAdminNoteApi,
  getAdminAuditLogsApi,
  getMembersImportStatusApi,
  importMembersApi,
  getAdminSmsConfigApi,
  updateAdminSmsConfigApi,
  testFast2SmsApi,
  getRecentOtpsApi,
  getAdminFamilyRegistrationsApi,
  getAdminNewMemberApplicationsApi,
  NewMemberApplicationRecord,
  getEmailConfigApi,
  saveEmailConfigApi,
  sendAdminTestEmailApi,
  deleteAdminFamilyRegistrationApi,
  deleteAdminNewMemberApplicationApi,
  deleteAdminMemberApi,
  reconcileAdminCloudApi,
  encryptAdminVaultsApi
} from '../lib/api.ts';
import {
  AdminSession,
  MemberYear1,
  Year2ProfileData,
  Year2PreferenceData,
  SubmissionData,
  CorrectionRequest,
  AdminNote,
  AdminAuditLog
} from '../lib/types.ts';

function CloudAwareImage({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(() => getDisplayImageSrc(url));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(getDisplayImageSrc(url));
    setFailed(false);
  }, [url]);

  if (!src || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-[#FAF7F2] text-[#A8A29E] ${className || 'w-6 h-6 rounded border border-[#D9CDB8]'}`}
        title="Photo unavailable on current host"
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={async () => {
        if (src && !src.startsWith('data:')) {
          const cloudSrc = await resolvePhotoFromFirestore(url).catch(() => null);
          if (cloudSrc) {
            setSrc(cloudSrc);
            return;
          }
        }
        setFailed(true);
      }}
      className={className}
    />
  );
}

interface AdminDashboardProps {
  adminToken: string | null;
  adminSession?: AdminSession | null;
  onAdminLoginSuccess: (token: string, admin: AdminSession) => void;
  onAdminLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  adminSession,
  onAdminLoginSuccess,
  onAdminLogout,
}) => {
  // Login form state
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Firebase Auth & Cloud Firestore Archive State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudRegCount, setCloudRegCount] = useState<number>(0);
  const [cloudAppCount, setCloudAppCount] = useState<number>(0);

  const isFirebaseAdmin = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      firebaseUser.email?.toLowerCase() === AUTHORIZED_ADMIN_EMAIL.toLowerCase()
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setFirebaseAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Active Tab: 'members' | 'family' | 'applications' | 'corrections' | 'sms' | 'email' | 'audit' | 'export' | 'import'
  const [activeTab, setActiveTab] = useState<'members' | 'family' | 'applications' | 'corrections' | 'sms' | 'email' | 'audit' | 'export' | 'import'>('family');

  // Fresh Family Registrations State
  const [familyRegistrations, setFamilyRegistrations] = useState<any[]>([]);
  const [loadingFamilyRegs, setLoadingFamilyRegs] = useState(false);
  const [viewingFamilyModal, setViewingFamilyModal] = useState<any | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<PreviewPhotoState | null>(null);
  const [familyFilterSearch, setFamilyFilterSearch] = useState('');

  // New Member Applications State
  const [newApplications, setNewApplications] = useState<NewMemberApplicationRecord[]>([]);
  const [loadingNewApplications, setLoadingNewApplications] = useState(false);
  const [newAppFilterSearch, setNewAppFilterSearch] = useState('');
  const [viewingNewAppModal, setViewingNewAppModal] = useState<NewMemberApplicationRecord | null>(null);

  // Raw un-deduplicated lists for cleaning up duplicate docs on delete
  const rawFamilyRecordsRef = useRef<any[]>([]);
  const rawAppRecordsRef = useRef<any[]>([]);

  type TombstoneEntry = {
    kind: 'family' | 'application' | 'member';
    ids: string[];
    emails: string[];
    deletedAt: number;
  };

  const TOMBSTONE_STORAGE_KEY = 'jsg_admin_deleted_tombstones_v1';

  const readTombstones = (): TombstoneEntry[] => {
    try {
      const raw = localStorage.getItem(TOMBSTONE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const recordTombstone = (entry: Omit<TombstoneEntry, 'deletedAt'>) => {
    try {
      const now = Date.now();
      const existing = readTombstones().filter((t) => now - t.deletedAt < 30 * 24 * 60 * 60 * 1000);
      existing.push({
        kind: entry.kind,
        ids: entry.ids.map((id) => id.trim().toUpperCase()).filter(Boolean),
        emails: entry.emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')),
        deletedAt: now,
      });
      localStorage.setItem(TOMBSTONE_STORAGE_KEY, JSON.stringify(existing.slice(-200)));
    } catch {}
  };

  const isRecordTombstoned = (
    kind: 'family' | 'application' | 'member',
    record: any,
    idFields: string[],
    emailFields: string[]
  ): boolean => {
    const tombstones = readTombstones().filter((t) => t.kind === kind);
    if (tombstones.length === 0) return false;

    const recIds = idFields
      .map((f) => String(record?.[f] || '').trim().toUpperCase())
      .filter(Boolean);
    const recEmails = emailFields
      .map((f) => String(record?.[f] || '').trim().toLowerCase())
      .filter((e) => e.includes('@'));
    const recTime = new Date(record?.updated_at || record?.created_at || 0).getTime() || 0;

    for (const t of tombstones) {
      const idMatch = recIds.some((id) => t.ids.includes(id));
      const emailMatch = recEmails.some((em) => t.emails.includes(em));
      if ((idMatch || emailMatch) && (recTime === 0 || recTime <= t.deletedAt + 2000)) {
        return true;
      }
    }
    return false;
  };

  // Permanent DB Entry Removal Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'family'; reg: any }
    | { kind: 'application'; app: NewMemberApplicationRecord & { _docId?: string; _source?: string } }
    | { kind: 'member'; member: any }
    | null
  >(null);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const collectUnreferencedPhotoIds = (regs: any[], excludeIds: Set<string>): string[] => {
    if (!regs || regs.length === 0) return [];
    const getIdsFromReg = (r: any): string[] => {
      const urls: Array<string | null | undefined> = [
        r?.husband_photo_url,
        r?.wife_photo_url,
        r?.couple_photo_url,
        r?.family_photo_url,
      ];
      if (Array.isArray(r?.children)) {
        for (const c of r.children) {
          if (c?.photo_url) urls.push(c.photo_url);
        }
      }
      return urls
        .map((u) => extractPhotoIdFromUrl(u))
        .filter((id): id is string => Boolean(id));
    };

    const candidateIds = Array.from(new Set(regs.flatMap(getIdsFromReg)));
    if (candidateIds.length === 0) return [];

    const stillReferenced = new Set<string>();
    for (const other of familyRegistrations) {
      const otherIds = [other?.reg_id, other?._docId]
        .map((x) => String(x || '').toUpperCase())
        .filter(Boolean);
      if (otherIds.some((id) => excludeIds.has(id))) {
        continue;
      }
      for (const id of getIdsFromReg(other)) {
        stillReferenced.add(id);
      }
    }

    return candidateIds.filter((id) => !stillReferenced.has(id));
  };

  const handleConfirmDelete = async () => {
    if (!adminToken || !deleteTarget) return;
    setDeletingEntry(true);
    setDeleteError(null);
    setDeleteSuccessMsg(null);

    try {
      if (deleteTarget.kind === 'family') {
        const reg = deleteTarget.reg;
        const primaryRegId = String(reg?.reg_id || reg?._docId || '').trim();
        if (!primaryRegId) throw new Error('Missing registration ID for deletion.');

        const targetEmails = Array.from(
          new Set(
            [reg?.submitter_email, reg?.husband_email, reg?.wife_email]
              .map((e) => String(e || '').trim().toLowerCase())
              .filter((e) => e.includes('@'))
          )
        );
        const primaryEmail = String(reg?.submitter_email || targetEmails[0] || '').trim().toLowerCase();

        // Collect all duplicate docs matching same reg_id, _docId, or submitter_email so older rows never resurface on refresh
        const matchingFamilyRecords = rawFamilyRecordsRef.current.filter((r) => {
          const rId = String(r?.reg_id || '').trim().toUpperCase();
          const rDoc = String(r?._docId || '').trim().toUpperCase();
          const rSubEmail = String(r?.submitter_email || '').trim().toLowerCase();
          return (
            rId === primaryRegId.toUpperCase() ||
            rDoc === primaryRegId.toUpperCase() ||
            (primaryEmail && rSubEmail === primaryEmail)
          );
        });
        if (matchingFamilyRecords.length === 0) {
          matchingFamilyRecords.push(reg);
        }

        const firestoreFamilyDocIds = Array.from(
          new Set(
            matchingFamilyRecords
              .flatMap((r) => [r?._docId, r?.reg_id])
              .map((id) => String(id || '').trim())
              .filter(Boolean)
          )
        );

        // If any matching record lives in Cloud Firestore, require Firebase Admin auth so Refresh won't bring it back
        const hasCloudCopy = matchingFamilyRecords.some((r) => r?._source === 'firestore');
        if (hasCloudCopy && !isFirebaseAdmin) {
          throw new Error(
            `This dossier is stored in Cloud Firestore. Click "Connect Google Cloud Archive" below or in the banner (${AUTHORIZED_ADMIN_EMAIL}) before deleting.`
          );
        }

        const matchingLinkedApps = rawAppRecordsRef.current.filter((a) => {
          const aId = String(a?.app_id || '').trim().toUpperCase();
          const aDoc = String(a?._docId || '').trim().toUpperCase();
          const aEmail = String(a?.email || '').trim().toLowerCase();
          return (
            firestoreFamilyDocIds.some((id) => id.toUpperCase() === aId || id.toUpperCase() === aDoc) ||
            (primaryEmail && aEmail === primaryEmail)
          );
        });
        const mirroredAppDocIds = Array.from(
          new Set([
            ...(reg?.membership_type === 'new' ? firestoreFamilyDocIds : []),
            ...matchingLinkedApps.flatMap((a) => [a?._docId, a?.app_id]),
          ].map((id) => String(id || '').trim()).filter(Boolean))
        );

        const excludeUpperSet = new Set(firestoreFamilyDocIds.map((id) => id.toUpperCase()));
        const candidatePhotoIds = collectUnreferencedPhotoIds(matchingFamilyRecords, excludeUpperSet);

        if (isFirebaseAdmin) {
          await deleteFamilyRegistrationFromFirestore(
            firestoreFamilyDocIds,
            candidatePhotoIds,
            mirroredAppDocIds
          );
        }

        const localRes = await deleteAdminFamilyRegistrationApi(adminToken, primaryRegId, primaryEmail);
        if (isFirebaseAdmin && Array.isArray(localRes?.deletedPhotoIds) && localRes.deletedPhotoIds.length > 0) {
          for (const pid of localRes.deletedPhotoIds) {
            if (!candidatePhotoIds.includes(pid)) {
              await deleteFamilyPhotoFromFirestore(pid).catch(() => {});
            }
          }
        }
        if (isFirebaseAdmin && Array.isArray(localRes?.deletedVaultIds) && localRes.deletedVaultIds.length > 0) {
          for (const vid of localRes.deletedVaultIds) {
            await deleteMemberVaultFromFirestore(vid).catch(() => {});
          }
        }

        recordTombstone({
          kind: 'family',
          ids: firestoreFamilyDocIds,
          emails: targetEmails.length > 0 ? targetEmails : primaryEmail ? [primaryEmail] : [],
        });
        if (mirroredAppDocIds.length > 0 || localRes?.deletedLinkedApp) {
          recordTombstone({
            kind: 'application',
            ids: mirroredAppDocIds.length > 0 ? mirroredAppDocIds : firestoreFamilyDocIds,
            emails: targetEmails.length > 0 ? targetEmails : primaryEmail ? [primaryEmail] : [],
          });
        }

        const excludedEmailSet = new Set(targetEmails);
        if (primaryEmail) excludedEmailSet.add(primaryEmail);
        setFamilyRegistrations((prev) =>
          prev.filter((r) => {
            const rId = String(r?.reg_id || '').toUpperCase();
            const rDoc = String(r?._docId || '').toUpperCase();
            const rEmails = [r?.submitter_email, r?.husband_email, r?.wife_email]
              .map((e) => String(e || '').trim().toLowerCase())
              .filter((e) => e.includes('@'));
            return (
              !excludeUpperSet.has(rId) &&
              !excludeUpperSet.has(rDoc) &&
              !rEmails.some((e) => excludedEmailSet.has(e))
            );
          })
        );
        if (mirroredAppDocIds.length > 0 || localRes?.deletedLinkedApp) {
          const appExclude = new Set(mirroredAppDocIds.map((id) => id.toUpperCase()));
          setNewApplications((prev) =>
            prev.filter((a: any) => {
              const aId = String(a?.app_id || '').toUpperCase();
              const aDoc = String(a?._docId || '').toUpperCase();
              const aEmail = String(a?.email || '').trim().toLowerCase();
              return !appExclude.has(aId) && !appExclude.has(aDoc) && (!primaryEmail || aEmail !== primaryEmail);
            })
          );
        }
        if (viewingFamilyModal) {
          const vId = String(viewingFamilyModal.reg_id || '').toUpperCase();
          if (excludeUpperSet.has(vId)) setViewingFamilyModal(null);
        }

        setDeleteTarget(null);
        setDeleteSuccessMsg(
          `Permanently removed family registration ${primaryRegId} (${reg.husband_name || ''} & ${reg.wife_name || ''}) from the database.`
        );
        await Promise.all([loadFamilyRegistrations(), loadNewApplications()]);
      } else if (deleteTarget.kind === 'application') {
        const app = deleteTarget.app;
        const primaryAppId = String(app?.app_id || app?._docId || '').trim();
        if (!primaryAppId) throw new Error('Missing application ID for deletion.');

        const primaryEmail = String(app?.email || '').trim().toLowerCase();
        const matchingApps = rawAppRecordsRef.current.filter((a) => {
          const aId = String(a?.app_id || '').trim().toUpperCase();
          const aDoc = String(a?._docId || '').trim().toUpperCase();
          const aEmail = String(a?.email || '').trim().toLowerCase();
          return (
            aId === primaryAppId.toUpperCase() ||
            aDoc === primaryAppId.toUpperCase() ||
            (primaryEmail && aEmail === primaryEmail)
          );
        });
        if (matchingApps.length === 0) matchingApps.push(app);

        const hasCloudCopy = matchingApps.some((a) => a?._source === 'firestore');
        if (hasCloudCopy && !isFirebaseAdmin) {
          throw new Error(
            `This application is stored in Cloud Firestore. Connect Google Cloud Archive (${AUTHORIZED_ADMIN_EMAIL}) first so it can be deleted from the cloud.`
          );
        }

        const firestoreAppDocIds = Array.from(
          new Set(
            matchingApps
              .flatMap((a) => [a?._docId, a?.app_id])
              .map((id) => String(id || '').trim())
              .filter(Boolean)
          )
        );
        const appExcludeSet = new Set(firestoreAppDocIds.map((id) => id.toUpperCase()));

        const linkedRegs = rawFamilyRecordsRef.current.filter((r) => {
          const rId = String(r?.reg_id || '').trim().toUpperCase();
          const rDoc = String(r?._docId || '').trim().toUpperCase();
          const rEmail = String(r?.submitter_email || '').trim().toLowerCase();
          return appExcludeSet.has(rId) || appExcludeSet.has(rDoc) || (primaryEmail && rEmail === primaryEmail);
        });
        const linkedRegDocIds = Array.from(
          new Set(
            linkedRegs
              .flatMap((r) => [r?._docId, r?.reg_id])
              .map((id) => String(id || '').trim())
              .filter(Boolean)
          )
        );
        const regExcludeSet = new Set(linkedRegDocIds.map((id) => id.toUpperCase()));
        const candidatePhotoIds = collectUnreferencedPhotoIds(linkedRegs, regExcludeSet);

        if (isFirebaseAdmin) {
          await deleteNewMemberApplicationFromFirestore(
            firestoreAppDocIds,
            linkedRegDocIds,
            candidatePhotoIds
          );
        }

        const localRes = await deleteAdminNewMemberApplicationApi(adminToken, primaryAppId, primaryEmail);
        if (isFirebaseAdmin && Array.isArray(localRes?.deletedPhotoIds) && localRes.deletedPhotoIds.length > 0) {
          for (const pid of localRes.deletedPhotoIds) {
            if (!candidatePhotoIds.includes(pid)) {
              await deleteFamilyPhotoFromFirestore(pid).catch(() => {});
            }
          }
        }
        if (isFirebaseAdmin && Array.isArray(localRes?.deletedVaultIds) && localRes.deletedVaultIds.length > 0) {
          for (const vid of localRes.deletedVaultIds) {
            await deleteMemberVaultFromFirestore(vid).catch(() => {});
          }
        }

        recordTombstone({
          kind: 'application',
          ids: firestoreAppDocIds,
          emails: primaryEmail ? [primaryEmail] : [],
        });
        if (linkedRegDocIds.length > 0 || localRes?.deletedLinkedReg) {
          recordTombstone({
            kind: 'family',
            ids: linkedRegDocIds.length > 0 ? linkedRegDocIds : firestoreAppDocIds,
            emails: primaryEmail ? [primaryEmail] : [],
          });
        }

        setNewApplications((prev) =>
          prev.filter((a: any) => {
            const aId = String(a?.app_id || '').toUpperCase();
            const aDoc = String(a?._docId || '').toUpperCase();
            const aEmail = String(a?.email || '').trim().toLowerCase();
            return !appExcludeSet.has(aId) && !appExcludeSet.has(aDoc) && (!primaryEmail || aEmail !== primaryEmail);
          })
        );
        if (linkedRegDocIds.length > 0 || localRes?.deletedLinkedReg) {
          setFamilyRegistrations((prev) =>
            prev.filter((r) => {
              const rId = String(r?.reg_id || '').toUpperCase();
              const rDoc = String(r?._docId || '').toUpperCase();
              const rEmail = String(r?.submitter_email || '').trim().toLowerCase();
              return !regExcludeSet.has(rId) && !regExcludeSet.has(rDoc) && (!primaryEmail || rEmail !== primaryEmail);
            })
          );
        }
        if (viewingNewAppModal && appExcludeSet.has(String(viewingNewAppModal.app_id || '').toUpperCase())) {
          setViewingNewAppModal(null);
        }

        setDeleteTarget(null);
        setDeleteSuccessMsg(
          `Permanently removed application ${primaryAppId} (${app.applicant_name || ''}) from the database.`
        );
        await Promise.all([loadNewApplications(), loadFamilyRegistrations()]);
      } else if (deleteTarget.kind === 'member') {
        const m = deleteTarget.member;
        const coupleId = String(m?.couple_id || '').trim().toUpperCase();
        if (!coupleId) throw new Error('Missing Couple ID for deletion.');

        if (isFirebaseAdmin) {
          await deleteMemberFromFirestore(coupleId);
        }

        await deleteAdminMemberApi(adminToken, coupleId);

        setMembers((prev) => prev.filter((row) => String(row.couple_id || '').toUpperCase() !== coupleId));
        if (selectedCoupleId && selectedCoupleId.toUpperCase() === coupleId) {
          setSelectedCoupleId(null);
          setMemberDetail(null);
        }

        setDeleteTarget(null);
        setDeleteSuccessMsg(
          `Permanently removed roster member ${coupleId} (${m.husband_name || ''} & ${m.wife_name || ''}) from the database.`
        );
        await Promise.all([loadMembers(), loadOverview(), loadCorrections()]);
      }
    } catch (err: any) {
      if (handleAuthError(err)) return;
      setDeleteError(formatFirestoreErrorMessage(err));
    } finally {
      setDeletingEntry(false);
    }
  };

  // Central Authentication Error Handler (Auto-logout if session expired or invalid)
  const handleAuthError = (err: any) => {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('unauthorized') || msg.includes('admin session expired') || msg.includes('forbidden') || msg.includes('401')) {
      onAdminLogout();
      return true;
    }
    return false;
  };

  const handleFullSignOut = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {}
    onAdminLogout();
  };

  const getRecordTimestamp = (item: any): number => {
    return new Date(item?.updated_at || item?.created_at || 0).getTime() || 0;
  };

  const mergeByUniqueKey = <T extends Record<string, any>>(
    primaryCloud: T[],
    secondaryLocal: T[],
    keyField: string
  ): T[] => {
    const mergedMap = new Map<string, T>();
    for (const item of secondaryLocal) {
      const k = String(item?.[keyField] || item?._docId || item?.id || '').toUpperCase();
      if (k) mergedMap.set(k, item);
    }
    for (const item of primaryCloud) {
      const k = String(item?.[keyField] || item?._docId || item?.id || '').toUpperCase();
      if (!k) continue;
      const existing = mergedMap.get(k);
      if (!existing || getRecordTimestamp(item) >= getRecordTimestamp(existing)) {
        mergedMap.set(k, item);
      }
    }
    return Array.from(mergedMap.values()).sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
  };

  const deduplicateByEmailFields = <T extends Record<string, any>>(
    records: T[],
    emailFields: string[]
  ): T[] => {
    const sorted = [...records].sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
    const seenEmails = new Set<string>();
    const result: T[] = [];

    for (const rec of sorted) {
      const emails = emailFields
        .map((field) => String(rec?.[field] || '').trim().toLowerCase())
        .filter((e) => e.includes('@'));
      if (emails.some((e) => seenEmails.has(e))) {
        continue;
      }
      emails.forEach((e) => seenEmails.add(e));
      result.push(rec);
    }
    return result;
  };

  const loadFamilyRegistrations = async () => {
    if (!adminToken) return;
    setLoadingFamilyRegs(true);
    setCloudError(null);
    const snapshotTimestampMs = Date.now();
    try {
      const localPromise = getAdminFamilyRegistrationsApi(adminToken);
      const cloudPromise = isFirebaseAdmin
        ? fetchAllFamilyRegistrationsFromFirestore().catch((err) => {
            setCloudError(formatFirestoreErrorMessage(err));
            return null;
          })
        : Promise.resolve(null);

      const [localData, cloudRegs] = await Promise.all([localPromise, cloudPromise]);
      const localList = (Array.isArray(localData?.registrations) ? localData.registrations : []).filter(
        (r: any) =>
          !isRecordTombstoned('family', r, ['reg_id', '_docId'], ['submitter_email', 'husband_email', 'wife_email'])
      );

      if (Array.isArray(cloudRegs)) {
        const filteredCloud = cloudRegs.filter(
          (r: any) =>
            !isRecordTombstoned('family', r, ['reg_id', '_docId'], ['submitter_email', 'husband_email', 'wife_email'])
        );
        const cloudRegIds = Array.from(
          new Set(
            cloudRegs
              .map((r: any) => String(r?.reg_id || r?._docId || '').trim().toUpperCase())
              .filter(Boolean)
          )
        );
        const cloudRegIdSet = new Set(cloudRegIds);
        const cutoffMs = snapshotTimestampMs - 15_000;

        // Fire-and-forget SQLite reconciliation so rows deleted directly in Firebase never resurface on login
        const hasStaleLocal = localList.some((r: any) => {
          const rid = String(r?.reg_id || '').trim().toUpperCase();
          return rid && !cloudRegIdSet.has(rid) && getRecordTimestamp(r) <= cutoffMs;
        });
        if (hasStaleLocal) {
          reconcileAdminCloudApi(adminToken, { cloudRegIds, snapshotTimestampMs }).catch(() => null);
        }

        // Backfill encrypted member lookup vaults & local SQLite cache for all cloud dossiers
        if (filteredCloud.length > 0) {
          encryptAdminVaultsApi(adminToken, filteredCloud)
            .then((vaultRes) => {
              if (vaultRes?.vaultEntries?.length) {
                return saveMemberVaultsToFirestore(vaultRes.vaultEntries);
              }
            })
            .catch(() => null);
        }

        const activeLocalList = localList.filter((r: any) => {
          const rid = String(r?.reg_id || '').trim().toUpperCase();
          return cloudRegIdSet.has(rid) || getRecordTimestamp(r) > cutoffMs;
        });

        rawFamilyRecordsRef.current = [...filteredCloud, ...activeLocalList];
        const merged = mergeByUniqueKey(filteredCloud, activeLocalList, 'reg_id');
        const deduped = deduplicateByEmailFields(merged, ['submitter_email', 'husband_email', 'wife_email']);
        setCloudRegCount(deduplicateByEmailFields(filteredCloud, ['submitter_email', 'husband_email', 'wife_email']).length);
        setFamilyRegistrations(deduped);
      } else {
        rawFamilyRecordsRef.current = localList;
        setFamilyRegistrations(
          deduplicateByEmailFields(localList, ['submitter_email', 'husband_email', 'wife_email'])
        );
      }
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load family registrations', err);
    } finally {
      setLoadingFamilyRegs(false);
    }
  };

  const loadNewApplications = async () => {
    if (!adminToken) return;
    setLoadingNewApplications(true);
    const snapshotTimestampMs = Date.now();
    try {
      const localPromise = getAdminNewMemberApplicationsApi(adminToken);
      const cloudPromise = isFirebaseAdmin
        ? fetchAllNewMemberApplicationsFromFirestore().catch((err) => {
            setCloudError(formatFirestoreErrorMessage(err));
            return null;
          })
        : Promise.resolve(null);

      const [localData, cloudApps] = await Promise.all([localPromise, cloudPromise]);
      const localList = (Array.isArray(localData?.applications) ? localData.applications : []).filter(
        (a: any) => !isRecordTombstoned('application', a, ['app_id', '_docId'], ['email'])
      );

      if (Array.isArray(cloudApps)) {
        const filteredCloud = cloudApps.filter(
          (a: any) => !isRecordTombstoned('application', a, ['app_id', '_docId'], ['email'])
        );
        const cloudAppIds = Array.from(
          new Set(
            cloudApps
              .map((a: any) => String(a?.app_id || a?._docId || '').trim().toUpperCase())
              .filter(Boolean)
          )
        );
        const cloudAppIdSet = new Set(cloudAppIds);
        const cutoffMs = snapshotTimestampMs - 15_000;

        const hasStaleLocal = localList.some((a: any) => {
          const aid = String(a?.app_id || '').trim().toUpperCase();
          return aid && !cloudAppIdSet.has(aid) && getRecordTimestamp(a) <= cutoffMs;
        });
        if (hasStaleLocal) {
          reconcileAdminCloudApi(adminToken, { cloudAppIds, snapshotTimestampMs }).catch(() => null);
        }

        const activeLocalList = localList.filter((a: any) => {
          const aid = String(a?.app_id || '').trim().toUpperCase();
          return cloudAppIdSet.has(aid) || getRecordTimestamp(a) > cutoffMs;
        });

        rawAppRecordsRef.current = [...filteredCloud, ...activeLocalList];
        const merged = mergeByUniqueKey(filteredCloud, activeLocalList, 'app_id');
        const deduped = deduplicateByEmailFields(merged, ['email']);
        setCloudAppCount(deduplicateByEmailFields(filteredCloud, ['email']).length);
        setNewApplications(deduped as NewMemberApplicationRecord[]);
      } else {
        rawAppRecordsRef.current = localList;
        setNewApplications(deduplicateByEmailFields(localList, ['email']) as NewMemberApplicationRecord[]);
      }
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load new member applications', err);
    } finally {
      setLoadingNewApplications(false);
    }
  };

  const exportNewApplicationsCsv = () => {
    if (newApplications.length === 0) return;
    const headers = [
      'Application ID',
      'Applicant Name',
      'Business Name',
      'Mobile Number',
      'Email',
      'Part of Other Group',
      'Other Group Name',
      'Other Group Position',
      'How Can You Contribute',
      'Reference Name',
      'Reference Mobile',
      'Business/Job',
      'President Name',
      'President Mobile',
      'Secretary Name',
      'Secretary Mobile',
      'Status',
      'Submitted At'
    ];
    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const rows = newApplications.map((a) => [
      escapeCsv(a.app_id),
      escapeCsv(a.applicant_name),
      escapeCsv(a.business_name),
      escapeCsv(a.mobile_number),
      escapeCsv(a.email),
      escapeCsv(a.other_group_member),
      escapeCsv(a.other_group_name || ''),
      escapeCsv(a.other_group_position || ''),
      escapeCsv(a.contribution),
      escapeCsv(a.reference_name),
      escapeCsv(a.reference_mobile),
      escapeCsv(a.business_description),
      escapeCsv(a.president_name),
      escapeCsv(a.president_mobile),
      escapeCsv(a.secretary_name),
      escapeCsv(a.secretary_mobile),
      escapeCsv(a.status),
      escapeCsv(a.created_at)
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `JSG_Royals_New_Member_Applications_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportFamiliesCsv = () => {
    if (familyRegistrations.length === 0) return;
    const maxKidsCount = familyRegistrations.reduce((max, r) => {
      const len = Array.isArray(r.children) ? r.children.length : 0;
      return len > max ? len : max;
    }, 0);
    const childPhotoHeaders = Array.from({ length: Math.max(maxKidsCount, 2) }, (_, i) => `Child ${i + 1} Photo URL`);

    const headers = [
      'Reg ID',
      'Membership Type',
      'Submitted By Role',
      'Submitter Email',
      'Husband Name',
      'Husband Mobile',
      'Husband Email',
      'Husband DOB',
      'Husband Qualification',
      'Husband Occupation',
      'Husband Organization',
      'Husband Blood Group',
      'Husband Instagram',
      'Husband Photo / Drive URL',
      'Wife Name',
      'Wife Mobile',
      'Wife Email',
      'Wife DOB',
      'Wife Qualification',
      'Wife Occupation',
      'Wife Organization',
      'Wife Blood Group',
      'Wife Instagram',
      'Wife Photo / Drive URL',
      'Couple Photo / Drive URL',
      'Family Photo / Drive URL',
      'Anniversary',
      'City',
      'Address',
      'Native Place',
      'Children Count',
      'Children Details',
      ...childPhotoHeaders,
      'Children Photo / Drive URLs',
      'Contribution Areas',
      'Royal Idea',
      'JSG Vision',
      'Experience Rating (1-10)',
      'Favourite Event',
      'Intl / Domestic Trip & Month Response',
      'Preferred Month & Destination (Legacy)',
      'Ideas for Upcoming Tenure',
      'President Name',
      'President Mobile',
      'Secretary Name',
      'Secretary Mobile',
      'Other Group Member',
      'Other Group Name',
      'Other Group Position',
      'Reference Name',
      'Reference Mobile',
      'Business/Job',
      'Contribution to Group',
      'Status',
      'Registered At'
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = familyRegistrations.map((r) => {
      const kidsList = Array.isArray(r.children) ? r.children : [];
      const kids = kidsList
        .map((c: any) => `${c.name || ''} (${c.gender || ''}${c.dob ? `, DOB: ${c.dob}` : ''}${c.education ? `, Edu: ${c.education}` : ''}${c.photo_url ? `, Photo: ${resolveFullMediaUrl(c.photo_url)}` : ''})`)
        .join('; ');
      const individualKidPhotoCells = Array.from({ length: Math.max(maxKidsCount, 2) }, (_, i) =>
        escapeCsv(resolveFullMediaUrl(kidsList[i]?.photo_url))
      );
      const kidsPhotoUrls = kidsList
        .filter((c: any) => c.photo_url)
        .map((c: any) => `${c.name || 'Child'}: ${resolveFullMediaUrl(c.photo_url)}`)
        .join(' | ');
      return [
        escapeCsv(r.reg_id),
        escapeCsv(r.membership_type === 'new' ? 'New Application' : 'Existing Renewal'),
        escapeCsv(r.submitted_by_role),
        escapeCsv(r.submitter_email),
        escapeCsv(r.husband_name),
        escapeCsv(r.husband_mobile),
        escapeCsv(r.husband_email),
        escapeCsv(r.husband_dob),
        escapeCsv(r.husband_qualification),
        escapeCsv(r.husband_occupation),
        escapeCsv(r.husband_organization),
        escapeCsv(r.husband_blood_group),
        escapeCsv(r.husband_instagram || ''),
        escapeCsv(resolveFullMediaUrl(r.husband_photo_url)),
        escapeCsv(r.wife_name),
        escapeCsv(r.wife_mobile),
        escapeCsv(r.wife_email),
        escapeCsv(r.wife_dob),
        escapeCsv(r.wife_qualification),
        escapeCsv(r.wife_occupation),
        escapeCsv(r.wife_organization),
        escapeCsv(r.wife_blood_group),
        escapeCsv(r.wife_instagram || ''),
        escapeCsv(resolveFullMediaUrl(r.wife_photo_url)),
        escapeCsv(resolveFullMediaUrl(r.couple_photo_url)),
        escapeCsv(resolveFullMediaUrl(r.family_photo_url)),
        escapeCsv(r.marriage_anniversary),
        escapeCsv(r.current_city),
        escapeCsv(r.residential_address),
        escapeCsv(r.native_place),
        escapeCsv(kidsList.length),
        escapeCsv(kids),
        ...individualKidPhotoCells,
        escapeCsv(kidsPhotoUrls),
        escapeCsv(r.contribution_areas),
        escapeCsv(r.royal_idea),
        escapeCsv(r.jsg_should_be_known_for),
        escapeCsv(r.exp_rating ?? ''),
        escapeCsv(r.exp_favourite_event || ''),
        escapeCsv(r.exp_international_trip || ''),
        escapeCsv(r.exp_trip_month_destination || ''),
        escapeCsv(r.exp_missing || ''),
        escapeCsv(r.president_name || ''),
        escapeCsv(r.president_mobile || ''),
        escapeCsv(r.secretary_name || ''),
        escapeCsv(r.secretary_mobile || ''),
        escapeCsv(r.other_group_member || ''),
        escapeCsv(r.other_group_name || ''),
        escapeCsv(r.other_group_position || ''),
        escapeCsv(r.reference_name || ''),
        escapeCsv(r.reference_mobile || ''),
        escapeCsv(r.business_description || ''),
        escapeCsv(r.new_member_contribution || ''),
        escapeCsv(r.status),
        escapeCsv(r.created_at)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `JSG_Royals_Family_Registrations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Step 9 Master Data Import State
  const [importStatus, setImportStatus] = useState<any>(null);
  const [loadingImportStatus, setLoadingImportStatus] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Dashboard Data State
  const [overview, setOverview] = useState<{
    totalMembers: number;
    verifiedCount: number;
    notVerifiedCount: number;
    startedCount: number;
    incompleteCount: number;
    submittedCount: number;
    pendingCorrectionsCount: number;
  } | null>(null);

  // Members Table State & Combinable Filters
  const [members, setMembers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 110, totalPages: 8 });
  const [search, setSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'all', 'verified', 'not_verified'
  const [year2Filter, setYear2Filter] = useState('all'); // 'all', 'not_started', 'draft', 'submitted'
  const [correctionFilter, setCorrectionFilter] = useState('all'); // 'all', 'no_correction', 'pending', 'under_review', 'resolved', 'rejected'
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Corrections Tab State
  const [correctionsList, setCorrectionsList] = useState<any[]>([]);
  const [correctionStatusTab, setCorrectionStatusTab] = useState<'all' | 'pending' | 'under_review' | 'resolved' | 'rejected'>('all');
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<'resolved' | 'under_review' | 'rejected' | null>(null);
  const [actionAdminNotes, setActionAdminNotes] = useState('');
  const [processingCorrection, setProcessingCorrection] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Export Tab State
  const [exportFilter, setExportFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportSummary, setExportSummary] = useState<string | null>(null);

  // SMS Gateway (Fast2SMS) Tab State
  const [smsConfig, setSmsConfig] = useState<{
    configured: boolean;
    gateway: string;
    maskedKey: string | null;
    wallet: string | null;
    walletError: string | null;
  } | null>(null);
  const [loadingSmsConfig, setLoadingSmsConfig] = useState(false);
  const [newSmsApiKey, setNewSmsApiKey] = useState('');
  const [savingSmsKey, setSavingSmsKey] = useState(false);
  const [smsKeySuccess, setSmsKeySuccess] = useState<string | null>(null);
  const [smsKeyError, setSmsKeyError] = useState<string | null>(null);

  const loadSmsConfig = async () => {
    if (!adminToken) return;
    setLoadingSmsConfig(true);
    setSmsKeyError(null);
    try {
      const data = await getAdminSmsConfigApi(adminToken);
      setSmsConfig(data);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      setSmsKeyError(err?.message || 'Failed to load SMS Gateway configuration.');
    } finally {
      setLoadingSmsConfig(false);
    }
  };

  const handleSaveSmsKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newSmsApiKey.trim()) return;
    setSavingSmsKey(true);
    setSmsKeySuccess(null);
    setSmsKeyError(null);
    try {
      const res = await updateAdminSmsConfigApi(adminToken, newSmsApiKey.trim());
      setSmsKeySuccess(res.message || 'Fast2SMS API Key updated successfully!');
      setNewSmsApiKey('');
      await loadSmsConfig();
    } catch (err: any) {
      if (handleAuthError(err)) return;
      setSmsKeyError(err?.message || 'Failed to save Fast2SMS API Key.');
    } finally {
      setSavingSmsKey(false);
    }
  };

  // Live Fast2SMS Diagnostic Test State
  const [testMobile, setTestMobile] = useState('9977933333');
  const [testingFast2Sms, setTestingFast2Sms] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    maskedKey: string;
    testMobile: string;
    walletResult: any;
    otpRouteResult: any;
    quickRouteResult: any;
    statusSummary: string;
    timestamp: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Recent OTPs State
  const [recentOtps, setRecentOtps] = useState<Array<{
    id: number;
    mobile: string;
    couple_id: string;
    created_at: number | string;
    expires_at: number | string;
    attempts: number;
    verified: number;
    husband_name?: string;
    wife_name?: string;
  }>>([]);
  const [loadingRecentOtps, setLoadingRecentOtps] = useState(false);

  const loadRecentOtps = async () => {
    if (!adminToken) return;
    setLoadingRecentOtps(true);
    try {
      const data = await getRecentOtpsApi(adminToken);
      if (data?.records) {
        setRecentOtps(data.records);
      }
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load recent OTP records', err);
    } finally {
      setLoadingRecentOtps(false);
    }
  };

  const handleRunFast2SmsTest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminToken) return;
    setTestingFast2Sms(true);
    setTestError(null);
    try {
      const result = await testFast2SmsApi(adminToken, testMobile);
      setTestResult(result);
      await loadSmsConfig();
      await loadRecentOtps();
    } catch (err: any) {
      setTestError(err?.message || 'Fast2SMS test failed.');
    } finally {
      setTestingFast2Sms(false);
    }
  };

  // Email Gateway (Gmail / SMTP / Resend) State
  const [emailConfig, setEmailConfig] = useState<{
    isConfigured: boolean;
    activeProvider: string;
    senderEmail: string;
    maskedPass?: string | null;
    source?: 'env' | 'db' | null;
    mode: string;
    connectionOk?: boolean | null;
    connectionError?: string | null;
  } | null>(null);
  const [loadingEmailConfig, setLoadingEmailConfig] = useState(false);
  const [emailProvider, setEmailProvider] = useState<'gmail' | 'resend'>('gmail');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPass, setGmailAppPass] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [savingEmailConfig, setSavingEmailConfig] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState<string | null>(null);
  const [emailSaveError, setEmailSaveError] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  const loadEmailConfig = async (force = false) => {
    setLoadingEmailConfig(true);
    try {
      const data = await getEmailConfigApi({ verify: true, force });
      setEmailConfig(data);
      if (data?.activeProvider === 'resend') {
        setEmailProvider('resend');
      } else if (data?.activeProvider === 'gmail') {
        setEmailProvider('gmail');
        if (data.senderEmail && data.senderEmail.includes('@')) {
          setGmailUser(data.senderEmail);
        }
      }
    } catch (e) {
      console.error('Failed to load email config', e);
    } finally {
      setLoadingEmailConfig(false);
    }
  };

  const handleSaveEmailConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingEmailConfig(true);
    setEmailSaveError(null);
    setEmailSaveSuccess(null);
    try {
      const payload: any = { provider: emailProvider };
      if (emailProvider === 'gmail') {
        payload.gmailUser = gmailUser.trim();
        payload.gmailPass = gmailAppPass.trim().replace(/\s+/g, '');
      } else if (emailProvider === 'resend') {
        payload.resendApiKey = resendApiKey.trim();
      }
      const res = await saveEmailConfigApi(payload);
      setEmailConfig(res);
      setEmailSaveSuccess(
        emailProvider === 'gmail'
          ? `Gmail SMTP successfully verified and connected! (${gmailUser})`
          : 'Resend API Key successfully connected!'
      );
      setGmailAppPass('');
    } catch (err: any) {
      setEmailSaveError(err?.message || 'Failed to verify and save email gateway.');
    } finally {
      setSavingEmailConfig(false);
    }
  };

  const handleSendTestEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminToken) return;
    setTestingEmail(true);
    setTestEmailError(null);
    setTestEmailResult(null);
    try {
      const res = await sendAdminTestEmailApi(adminToken, testEmailAddress.trim());
      setTestEmailResult(res.message || `Test verification email dispatched to ${testEmailAddress}!`);
    } catch (err: any) {
      setTestEmailError(err?.message || 'Failed to dispatch test email.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleResetEmailConfig = async () => {
    if (!confirm('Are you sure you want to disconnect and clear email credentials?')) return;
    setSavingEmailConfig(true);
    setEmailSaveError(null);
    setEmailSaveSuccess(null);
    try {
      await saveEmailConfigApi({ provider: 'reset' });
      await loadEmailConfig();
      setEmailSaveSuccess('Email gateway credentials successfully cleared.');
    } catch (e: any) {
      setEmailSaveError(e?.message || 'Failed to clear credentials.');
    } finally {
      setSavingEmailConfig(false);
    }
  };

  // Selected Member Details Dossier Modal
  const [selectedCoupleId, setSelectedCoupleId] = useState<string | null>(null);
  const [memberDetail, setMemberDetail] = useState<{
    member: MemberYear1 & { protectedFields?: string[] };
    year2Profile: Year2ProfileData | null;
    year2Preferences: Year2PreferenceData | null;
    submission: SubmissionData | null;
    verifications: any[];
    corrections: CorrectionRequest[];
    notes: AdminNote[];
    photo?: { id: string; filename: string; mime_type: string; url: string } | null;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New Admin Note state in Dossier
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // 1. Handle Admin Login (Email & PIN)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await adminLoginApi(email, pin);
      onAdminLoginSuccess(res.token, res.admin);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid admin credentials');
    } finally {
      setLoginLoading(false);
    }
  };

  // 1b. Handle Google Admin Sign-In (Connects Cloud Firestore Archive + Backend Token)
  const handleGoogleAdminLogin = async (connectOnly = false) => {
    setGoogleLoginLoading(true);
    setLoginError(null);
    setCloudError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedEmail = (result.user.email || '').toLowerCase();
      if (signedEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
        await signOut(auth).catch(() => {});
        const msg = `Please sign in using the authorized admin Google account (${AUTHORIZED_ADMIN_EMAIL}). Signed in as: ${signedEmail}`;
        if (connectOnly) setCloudError(msg);
        else setLoginError(msg);
        return;
      }
      if (!connectOnly) {
        const idToken = await result.user.getIdToken();
        const res = await adminFirebaseLoginApi(idToken);
        onAdminLoginSuccess(res.token, res.admin);
      }
    } catch (err: any) {
      const msg = err?.message || 'Google Sign-In failed or was cancelled.';
      if (connectOnly) setCloudError(msg);
      else setLoginError(msg);
    } finally {
      setGoogleLoginLoading(false);
    }
  };

  // 2. Fetch Overview Metrics
  const loadOverview = async () => {
    if (!adminToken) return;
    try {
      const data = await getAdminOverviewApi(adminToken);
      setOverview(data);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load admin overview:', err);
    }
  };

  // 3. Fetch Members with Search & Combinable Filters
  const loadMembers = async () => {
    if (!adminToken) return;
    setLoadingMembers(true);
    try {
      const res = await getAdminMembersApi(adminToken, {
        search,
        verification: verificationFilter,
        year2: year2Filter,
        corrections: correctionFilter,
        page: pagination.page,
        limit: pagination.limit,
      });
      setMembers(res.members);
      setPagination(res.pagination);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to query members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // 4. Fetch Corrections List
  const loadCorrections = async () => {
    if (!adminToken) return;
    try {
      const res = await getAdminCorrectionsApi(adminToken);
      setCorrectionsList(res.corrections);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load corrections:', err);
    }
  };

  // 5. Fetch Audit Logs
  const loadAuditLogs = async (page = 1) => {
    if (!adminToken) return;
    setLoadingAudit(true);
    try {
      const res = await getAdminAuditLogsApi(adminToken, page, auditPagination.limit);
      setAuditLogs(res.logs);
      setAuditPagination(res.pagination);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  // 6. Fetch Step 9 Members Import Status
  const loadImportStatus = async () => {
    if (!adminToken) return;
    setLoadingImportStatus(true);
    try {
      const data = await getMembersImportStatusApi(adminToken);
      setImportStatus(data);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to load import status:', err);
    } finally {
      setLoadingImportStatus(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !csvInput.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const res = await importMembersApi(adminToken, { csvText: csvInput.trim() });
      setImportMessage(res.message);
      setImportStatus(res.status);
      setCsvInput('');
      await loadOverview();
      await loadMembers();
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  // Lifecycle listeners
  useEffect(() => {
    if (adminToken) {
      loadOverview();
      loadFamilyRegistrations();
      loadNewApplications();
      loadMembers();
      loadCorrections();
      loadEmailConfig();
    }
  }, [adminToken, isFirebaseAdmin, firebaseAuthReady, verificationFilter, year2Filter, correctionFilter, pagination.page]);

  useEffect(() => {
    if (adminToken && activeTab === 'audit') {
      loadAuditLogs(auditPagination.page);
    }
    if (adminToken && activeTab === 'import') {
      loadImportStatus();
    }
    if (adminToken && activeTab === 'sms') {
      loadSmsConfig();
      loadRecentOtps();
    }
    if (adminToken && activeTab === 'family') {
      loadFamilyRegistrations();
    }
    if (adminToken && activeTab === 'applications') {
      loadNewApplications();
    }
    if (adminToken && activeTab === 'email') {
      loadEmailConfig(true);
    }
  }, [adminToken, activeTab, auditPagination.page]);

  // Debounced search (skip initial mount since the filter/page effect above already fetches)
  const didMountSearchRef = useRef(false);
  useEffect(() => {
    if (!didMountSearchRef.current) {
      didMountSearchRef.current = true;
      return;
    }
    if (!adminToken) return;
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      loadMembers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 6. Inspect Single Member Dossier
  const inspectMember = async (coupleId: string) => {
    if (!adminToken) return;
    setSelectedCoupleId(coupleId);
    setLoadingDetail(true);
    try {
      const detail = await getAdminMemberDetailApi(adminToken, coupleId);
      setMemberDetail(detail as any);
    } catch (err: any) {
      if (handleAuthError(err)) return;
      console.error('Failed to inspect member:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 7. Add Internal Admin Note
  const handleAddAdminNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !selectedCoupleId || !newNoteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await addAdminNoteApi(adminToken, selectedCoupleId, newNoteText.trim());
      if (res.success && memberDetail) {
        setMemberDetail({
          ...memberDetail,
          notes: [res.note, ...(memberDetail.notes || [])]
        });
        setNewNoteText('');
      }
    } catch (err) {
      alert('Failed to add internal admin note');
    } finally {
      setAddingNote(false);
    }
  };

  // 8. Handle Correction Request State Transitions
  const handleUpdateCorrectionStatus = async (id: number, status: 'resolved' | 'under_review' | 'rejected') => {
    if (!adminToken) return;
    setProcessingCorrection(true);
    try {
      await resolveAdminCorrectionApi(adminToken, id, status, actionAdminNotes.trim());
      setActionTargetId(null);
      setActionType(null);
      setActionAdminNotes('');
      await loadCorrections();
      await loadOverview();
      if (selectedCoupleId) {
        inspectMember(selectedCoupleId);
      }
    } catch (err) {
      alert('Failed to update correction status.');
    } finally {
      setProcessingCorrection(false);
    }
  };

  // 9. Handle CSV Export
  const handleDownloadCsv = async (filterToUse = exportFilter) => {
    if (!adminToken) return;
    setExporting(true);
    setExportSummary(null);
    try {
      const res = await getAdminExportApi(adminToken, filterToUse);
      if (!res.data || res.data.length === 0) {
        setExportSummary('No member records matched the selected export filter.');
        setExporting(false);
        return;
      }

      // Convert to clean RFC-4180 CSV
      const headers = [
        'Couple ID',
        'Husband Name',
        'Wife Name',
        'Husband Registered Mobile',
        'Wife Registered Mobile',
        'Marriage Anniversary',
        'Updated City',
        'Residential Address',
        'Professional Update',
        'Organization / Business',
        'Family Update',
        'Wishlist',
        'Contribution Areas',
        'Royal Idea for 2027',
        'JSG Royals Identity',
        'Photo ID',
        'Verification Status',
        'Verification Date',
        'Submission Status',
        'Submission Date',
        'Correction Status'
      ];

      const csvRows = [
        headers.join(','),
        ...res.data.map((r: any) => {
          const escape = (val: any) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            try {
              if (str.startsWith('[') && str.endsWith(']')) {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) str = parsed.join(', ');
              }
            } catch (e) {}
            return `"${str.replace(/"/g, '""')}"`;
          };

          return [
            escape(r.couple_id),
            escape(r.husband_name),
            escape(r.wife_name),
            escape(r.husband_registered_mobile),
            escape(r.wife_registered_mobile),
            escape(r.marriage_anniversary),
            escape(r.updated_city || 'Indore'),
            escape(r.updated_address || ''),
            escape(r.occupation_update || ''),
            escape(r.organization_update || ''),
            escape(r.family_update || ''),
            escape(r.wishlist || ''),
            escape(r.contribution_areas || ''),
            escape(r.royal_idea || ''),
            escape(r.jsg_should_be_known_for || ''),
            escape(r.photo_id || 'None'),
            escape(r.verified_at ? 'Verified' : 'Not Verified'),
            escape(r.verified_at || ''),
            escape(r.submitted_at ? 'Submitted' : (r.updated_city ? 'Draft' : 'Not Started')),
            escape(r.submitted_at || ''),
            escape(r.correction_status ? r.correction_status.toUpperCase() : 'No Correction')
          ].join(',');
        })
      ];

      const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `JSG_Royals_Year2_Export_${filterToUse}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSummary(`Successfully exported ${res.data.length} records (${filterToUse}).`);
    } catch (err) {
      alert('Failed to generate export file.');
    } finally {
      setExporting(false);
    }
  };

  // RENDER: Admin Login Gate
  if (!adminToken) {
    return (
      <div className="min-h-[calc(100dvh-72px)] bg-royal-parchment flex flex-col justify-center items-center py-8 sm:py-12 px-4">
        <div className="w-full max-w-md lg:max-w-4xl bg-white border border-[#E7DDCE] rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Architectural Heritage Column (Compact banner on mobile, full panel on desktop) */}
          <div className="lg:col-span-5 bg-royal-obsidian text-[#FAF7F2] p-6 sm:p-8 flex flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-[#C5A869]/30 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-[#D4AF37]/10 blur-2xl pointer-events-none" />
            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <RoyalLogo className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-[#D4AF37] shadow-md p-0.5 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] block">
                    JSG Royals • Chapter 2
                  </span>
                  <h1 className="font-serif-royal text-xl sm:text-2xl font-bold text-white leading-tight">
                    Committee Secretariat
                  </h1>
                </div>
              </div>
              <p className="text-xs sm:text-[13px] text-[#D6CFC2] leading-relaxed">
                Central administration ledger for verified family dossiers, new member applications, and 2027 directory exports.
              </p>
            </div>

            <div className="hidden lg:block space-y-3 pt-4 border-t border-[#C5A869]/20 relative z-10 text-xs text-[#E7DFD2]">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Verified Cloud Firestore Archive &amp; Local Sync</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Husband, Wife &amp; Children Dossier Review</span>
              </div>
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>One-Click RFC-4180 CSV &amp; Photo Archive</span>
              </div>
            </div>

            <div className="hidden lg:block text-[10px] uppercase tracking-[0.18em] text-[#A89F91] relative z-10">
              Authorized Administrators Only
            </div>
          </div>

          {/* Right Auth Column */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
            <div className="mb-5">
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                Sign In to Console
              </h2>
              <p className="text-xs sm:text-[13px] text-[#78716C] mt-1">
                Use Google Workspace to unlock live Cloud Archive sync, or sign in with your Committee Access PIN.
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleGoogleAdminLogin(false)}
              disabled={googleLoginLoading || loginLoading}
              className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#F3ECE0] text-[#1C1917] font-semibold text-sm shadow-2xs transition-all flex items-center justify-center gap-2.5 border-2 border-[#D4AF37] cursor-pointer mb-4 disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
              </svg>
              <span>
                {googleLoginLoading
                  ? 'Connecting Google Admin...'
                  : 'Sign in with Google (Cloud Archive)'}
              </span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <span className="h-px flex-1 bg-[#E7DDCE]" />
              <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
                Or Admin PIN
              </span>
              <span className="h-px flex-1 bg-[#E7DDCE]" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Admin Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-white text-base sm:text-sm text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Passcode / Access PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-white text-base sm:text-sm text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || googleLoginLoading}
                className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 border border-[#C5A869]/40 cursor-pointer disabled:opacity-60"
              >
                {loginLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-[#D4AF37]" />
                    <span>Enter Admin Dashboard</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#F0E8DC] text-center text-[10px] text-[#78716C] tracking-wider uppercase">
              Confidential • JSG Royals Central Secretariat
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filtered corrections list for the Corrections Tab
  const displayedCorrections = correctionsList.filter((c) => {
    if (correctionStatusTab === 'all') return true;
    return c.status === correctionStatusTab;
  });

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 space-y-5">

      {/* Top Banner & Action Header */}
      <header className="bg-white border border-[#E7DDCE] rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <RoyalLogo className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl border border-[#D4AF37]/80 shadow-2xs p-0.5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif-royal font-bold text-lg sm:text-2xl text-[#1C1917] tracking-tight">
                JSG Royals Administration
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[#1C1917] text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider border border-[#C5A869]/30">
                Chapter 2 • 2027
              </span>
              {adminSession?.role && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                  {adminSession.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#78716C]">
              <span className="truncate">
                Signed in: <strong className="text-[#1C1917]">{adminSession?.email || 'Authorized Administrator'}</strong>
              </span>
              {isFirebaseAdmin && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md tabular-nums">
                  <Cloud className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Cloud Sync: {cloudRegCount} Families • {cloudAppCount} Apps</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => handleDownloadCsv('all')}
            className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1] transition-colors cursor-pointer whitespace-nowrap"
            title="Quick CSV Export"
          >
            <Download className="w-3.5 h-3.5 text-[#8C6D2B]" />
            <span>Quick CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              loadOverview();
              loadFamilyRegistrations();
              loadNewApplications();
              loadMembers();
              loadCorrections();
              if (activeTab === 'audit') loadAuditLogs();
            }}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D9CDB8] text-xs font-semibold text-[#44403C] hover:text-[#1C1917] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loadingFamilyRegs || loadingNewApplications || loadingMembers) ? 'animate-spin text-[#8C6D2B]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleFullSignOut}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Cloud Archive Connection Banner when logged in via PIN without Google Auth */}
      {firebaseAuthReady && !isFirebaseAdmin && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-0.5">
              <div className="font-bold">Connect Google Cloud Archive to sync cloud records &amp; deletions</div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Signed in with Access PIN. Authorize once with <strong>{AUTHORIZED_ADMIN_EMAIL}</strong> to load &amp; manage registrations and photos stored in Cloud Firestore.
              </p>
              {cloudError && (
                <p className="text-[11px] text-red-700 font-semibold pt-1">{cloudError}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleGoogleAdminLogin(true)}
            disabled={googleLoginLoading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#D4AF37] text-xs font-semibold border border-[#C5A869] shrink-0 cursor-pointer transition-all"
          >
            {googleLoginLoading ? 'Connecting...' : 'Connect Cloud Archive'}
          </button>
        </div>
      )}

      {cloudError && isFirebaseAdmin && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{cloudError}</span>
        </div>
      )}

      {deleteSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
            <span className="leading-snug">{deleteSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMsg(null)}
            className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700 cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Grid — Clean 2x4 -> 4x2 Responsive Hierarchy */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-royal-obsidian p-4 rounded-2xl border border-[#D4AF37] text-white flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <span>Fresh Families</span>
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-white tabular-nums">
              {familyRegistrations.length}
            </span>
            <span className="text-[11px] text-[#C5A869]">Chapter 2 Renewals</span>
          </div>

          <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#C5A869] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-bold text-[#8C6D2B] uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-[#8C6D2B] shrink-0" />
              <span>New Apps</span>
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#1C1917] tabular-nums">
              {newApplications.length}
            </span>
            <span className="text-[11px] text-[#78716C]">Pending Review</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
              Total Members
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#1C1917] tabular-nums">
              {overview.totalMembers}
            </span>
            <span className="text-[11px] text-[#78716C]">Permanent Roster</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-[#8C6D2B] uppercase tracking-wider">
              Verified
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#8C6D2B] tabular-nums">
              {overview.verifiedCount}
            </span>
            <span className="text-[11px] text-[#78716C]">OTP Authenticated</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
              Not Verified
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#57534E] tabular-nums">
              {overview.notVerifiedCount}
            </span>
            <span className="text-[11px] text-[#78716C]">Pending Login</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
              Incomplete / Draft
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">
              {overview.incompleteCount}
            </span>
            <span className="text-[11px] text-amber-700/80">Work In Progress</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
              Submitted
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">
              {overview.submittedCount}
            </span>
            <span className="text-[11px] text-emerald-700/80">Locked &amp; Final</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E7DDCE] flex flex-col justify-between gap-1.5">
            <span className="text-[10px] font-semibold text-purple-800 uppercase tracking-wider">
              Corrections
            </span>
            <span className="font-serif-royal text-2xl sm:text-3xl font-bold text-purple-700 tabular-nums">
              {overview.pendingCorrectionsCount}
            </span>
            <span className="text-[11px] text-purple-700/80">Pending Review</span>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs Rail */}
      <nav aria-label="Admin sections" className="bg-white border border-[#E7DDCE] rounded-2xl p-1.5 shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('family');
              loadFamilyRegistrations();
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeTab === 'family'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Crown className={`w-4 h-4 ${activeTab === 'family' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
            <span>Fresh Family Dossiers ({familyRegistrations.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('applications');
              loadNewApplications();
            }}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeTab === 'applications'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <UserPlus className={`w-4 h-4 ${activeTab === 'applications' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
            <span>New Member Apps ({newApplications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'members' ? 'text-[#D4AF37]' : 'text-[#57534E]'}`} />
            <span>Members Roster</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('corrections')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
              activeTab === 'corrections'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'corrections' ? 'text-[#D4AF37]' : 'text-purple-600'}`} />
            <span>Corrections ({correctionsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Activity className={`w-4 h-4 ${activeTab === 'audit' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
            <span>Audit Trail</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'export' ? 'text-[#D4AF37]' : 'text-emerald-700'}`} />
            <span>Export Center</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'import'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'import' ? 'text-[#D4AF37]' : 'text-amber-700'}`} />
            <span>Import Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sms')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'sms'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Phone className={`w-4 h-4 ${activeTab === 'sms' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
            <span>SMS Gateway</span>
            {smsConfig?.configured && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'email'
                ? 'bg-[#1C1917] text-[#FAF7F2] shadow-2xs'
                : 'text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917]'
            }`}
          >
            <Mail className={`w-4 h-4 ${activeTab === 'email' ? 'text-[#D4AF37]' : 'text-indigo-700'}`} />
            <span>Email Gateway</span>
            {emailConfig?.isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>
      </nav>

      {/* TAB: FRESH FAMILY REGISTRATIONS (EMAIL-BASED) */}
      {activeTab === 'family' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E8DC]">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <RoyalLogo className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border border-[#C5A869]/70 shadow-2xs p-0.5 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-serif-royal font-bold text-base sm:text-lg text-[#1C1917] leading-snug">
                  Fresh Family Registrations
                </h2>
                <p className="text-xs text-[#78716C]">
                  Full household dossiers with Husband, Wife, Children &amp; cross-spouse sync
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {familyRegistrations.length > 0 && (
                <button
                  type="button"
                  onClick={exportFamiliesCsv}
                  className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-colors cursor-pointer shadow-2xs tabular-nums"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export CSV ({familyRegistrations.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={loadFamilyRegistrations}
                disabled={loadingFamilyRegs}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFamilyRegs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {familyRegistrations.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-[#FAF7F2] rounded-2xl border border-[#E7DDCE] space-y-2.5">
              <RoyalLogo className="w-16 h-16 rounded-2xl mx-auto border border-[#C5A869]/70 shadow-sm p-0.5 opacity-90" />
              <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                No Fresh Family Registrations Yet
              </div>
              <p className="text-xs text-[#78716C] max-w-md mx-auto">
                Members can register their complete royal household directly from the home screen.
                All submissions will appear here with full husband, wife, children details and instant export.
              </p>
            </div>
          ) : (() => {
            const term = familyFilterSearch.trim().toLowerCase();
            const filteredFamilies = familyRegistrations.filter((reg) => {
              if (!term) return true;
              return (
                (reg.husband_name || '').toLowerCase().includes(term) ||
                (reg.wife_name || '').toLowerCase().includes(term) ||
                (reg.husband_mobile || '').includes(term) ||
                (reg.wife_mobile || '').includes(term) ||
                (reg.husband_email || '').toLowerCase().includes(term) ||
                (reg.wife_email || '').toLowerCase().includes(term) ||
                (reg.submitter_email || '').toLowerCase().includes(term) ||
                (reg.husband_instagram || '').toLowerCase().includes(term) ||
                (reg.wife_instagram || '').toLowerCase().includes(term) ||
                (reg.current_city || '').toLowerCase().includes(term) ||
                (reg.exp_favourite_event || '').toLowerCase().includes(term) ||
                (reg.exp_trip_month_destination || '').toLowerCase().includes(term) ||
                (reg.exp_missing || '').toLowerCase().includes(term) ||
                (reg.reg_id || '').toLowerCase().includes(term)
              );
            });

            return (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Total Families</span>
                    <span className="text-xl font-serif-royal font-bold text-[#1C1917] tabular-nums">{familyRegistrations.length}</span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">By Husbands</span>
                    <span className="text-xl font-serif-royal font-bold text-[#8C6D2B] tabular-nums">
                      {familyRegistrations.filter((r) => r.submitted_by_role === 'husband').length}
                    </span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">By Wives</span>
                    <span className="text-xl font-serif-royal font-bold text-[#8C6D2B] tabular-nums">
                      {familyRegistrations.filter((r) => r.submitted_by_role === 'wife').length}
                    </span>
                  </div>
                  <div className="p-3 sm:p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Total Children</span>
                    <span className="text-xl font-serif-royal font-bold text-emerald-800 tabular-nums">
                      {familyRegistrations.reduce((acc, r) => acc + (r.children ? r.children.length : 0), 0)}
                    </span>
                  </div>
                </div>

                {/* Search Bar for Families */}
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={familyFilterSearch}
                    onChange={(e) => setFamilyFilterSearch(e.target.value)}
                    placeholder="Search dossiers by name, mobile, email, city, or Reg ID..."
                    className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] text-base sm:text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C5A869]/40 focus:border-[#C5A869]"
                  />
                </div>

                {filteredFamilies.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs text-[#78716C]">
                    No family dossiers matched &ldquo;{familyFilterSearch}&rdquo;.
                  </div>
                ) : (
                  <>
                    {/* Mobile & Small Tablet Cards View (< md) */}
                    <div className="md:hidden space-y-3">
                      {filteredFamilies.map((reg) => {
                        const rowKey = reg._docId || reg.reg_id || reg.id;
                        return (
                          <article
                            key={rowKey}
                            className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#E7DDCE]">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-[#8C6D2B]">{reg.reg_id}</span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                    reg.membership_type === 'new'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  }`}>
                                    {reg.membership_type === 'new' ? 'New App' : 'Renewal'}
                                  </span>
                                </div>
                                <h3 className="font-serif-royal font-bold text-base text-[#1C1917] leading-snug">
                                  {reg.husband_name} &amp; {reg.wife_name}
                                </h3>
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  reg.submitted_by_role === 'husband' ? 'bg-blue-100 text-blue-900' : 'bg-rose-100 text-rose-900'
                                }`}>
                                  {reg.submitted_by_role}
                                </span>
                                <div className="text-[11px] text-[#78716C] tabular-nums">
                                  {new Date(reg.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-xl bg-white border border-[#E7DDCE] space-y-0.5">
                                <span className="text-[10px] font-bold uppercase text-[#8C6D2B] block">Husband</span>
                                <div className="font-semibold text-[#1C1917]">{reg.husband_name}</div>
                                <div className="text-[11px] text-[#57534E] font-mono tabular-nums">{reg.husband_mobile}</div>
                                <div className="text-[11px] text-[#78716C] truncate">{reg.husband_email}</div>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white border border-[#E7DDCE] space-y-0.5">
                                <span className="text-[10px] font-bold uppercase text-rose-700 block">Wife</span>
                                <div className="font-semibold text-[#1C1917]">{reg.wife_name}</div>
                                <div className="text-[11px] text-[#57534E] font-mono tabular-nums">{reg.wife_mobile}</div>
                                <div className="text-[11px] text-[#78716C] truncate">{reg.wife_email}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#57534E]">
                              {reg.marriage_anniversary && (
                                <span>Anniversary: <strong className="text-[#1C1917]">{reg.marriage_anniversary}</strong></span>
                              )}
                              {reg.current_city && (
                                <span>City: <strong className="text-[#1C1917]">{reg.current_city}</strong></span>
                              )}
                              <span>
                                Children: <strong className="text-[#1C1917] tabular-nums">{reg.children?.length || 0}</strong>
                              </span>
                              {reg.exp_rating !== null && reg.exp_rating !== undefined && (
                                <span className="px-1.5 py-0.5 rounded bg-[#1C1917] text-[#F3DF9C] font-bold text-[10px] tabular-nums">
                                  Rating: {reg.exp_rating}/10
                                </span>
                              )}
                            </div>

                            {/* Photo Quick Buttons */}
                            {(reg.husband_photo_url || reg.wife_photo_url || reg.couple_photo_url || reg.family_photo_url || (Array.isArray(reg.children) && reg.children.some((c: any) => c.photo_url))) && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                {reg.husband_photo_url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhotoModal({
                                      title: `Husband Photo — ${reg.husband_name}`,
                                      url: reg.husband_photo_url,
                                      downloadName: `${reg.reg_id}_husband.jpg`
                                    })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#D9CDB8] text-[11px] font-semibold text-blue-800 cursor-pointer"
                                  >
                                    <CloudAwareImage
                                      url={reg.husband_photo_url}
                                      alt={reg.husband_name}
                                      className="w-5 h-5 rounded object-cover border border-[#D9CDB8] shrink-0"
                                    />
                                    <span>Husband</span>
                                  </button>
                                )}
                                {reg.wife_photo_url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhotoModal({
                                      title: `Wife Photo — ${reg.wife_name}`,
                                      url: reg.wife_photo_url,
                                      downloadName: `${reg.reg_id}_wife.jpg`
                                    })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#D9CDB8] text-[11px] font-semibold text-rose-800 cursor-pointer"
                                  >
                                    <CloudAwareImage
                                      url={reg.wife_photo_url}
                                      alt={reg.wife_name}
                                      className="w-5 h-5 rounded object-cover border border-[#D9CDB8] shrink-0"
                                    />
                                    <span>Wife</span>
                                  </button>
                                )}
                                {reg.couple_photo_url && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewPhotoModal({
                                      title: `Couple Photo — ${reg.husband_name} & ${reg.wife_name}`,
                                      url: reg.couple_photo_url,
                                      downloadName: `${reg.reg_id}_couple.jpg`
                                    })}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#D9CDB8] text-[11px] font-semibold text-amber-800 cursor-pointer"
                                  >
                                    <CloudAwareImage
                                      url={reg.couple_photo_url}
                                      alt="Couple"
                                      className="w-5 h-5 rounded object-cover border border-[#D9CDB8] shrink-0"
                                    />
                                    <span>Couple</span>
                                  </button>
                                )}
                                {Array.isArray(reg.children) && reg.children.map((c: any, idx: number) =>
                                  c.photo_url ? (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setPreviewPhotoModal({
                                        title: `Child Photo — ${c.name || `Child #${idx + 1}`}`,
                                        url: c.photo_url,
                                        downloadName: `${reg.reg_id}_child_${idx + 1}.jpg`
                                      })}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#D9CDB8] text-[11px] font-semibold text-emerald-800 cursor-pointer"
                                    >
                                      <CloudAwareImage
                                        url={c.photo_url}
                                        alt={c.name || `Child #${idx + 1}`}
                                        className="w-5 h-5 rounded object-cover border border-[#D9CDB8] shrink-0"
                                      />
                                      <span className="truncate max-w-[90px]">{c.name || `Child #${idx + 1}`}</span>
                                    </button>
                                  ) : null
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7DDCE]">
                              <button
                                type="button"
                                onClick={() => setViewingFamilyModal(reg)}
                                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#F2ECE1] text-[#1C1917] border border-[#D9CDB8] font-semibold text-xs transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#8C6D2B]" />
                                <span>View Dossier</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget({ kind: 'family', reg });
                                }}
                                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Desktop Registrations Table (>= md) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#E7DDCE]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F5EFE6] text-[#44403C] uppercase text-[10px] font-semibold border-b border-[#E7DDCE]">
                          <tr>
                            <th className="px-4 py-3">Reg ID</th>
                            <th className="px-4 py-3">Submitter</th>
                            <th className="px-4 py-3">Husband Details</th>
                            <th className="px-4 py-3">Wife Details</th>
                            <th className="px-4 py-3">Anniversary &amp; City</th>
                            <th className="px-4 py-3">Children</th>
                            <th className="px-4 py-3">Experience Feedback</th>
                            <th className="px-4 py-3">Photos &amp; Drive URLs</th>
                            <th className="px-4 py-3">Submitted At</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0E8DC] bg-white">
                          {filteredFamilies.map((reg) => (
                            <tr key={reg._docId || reg.reg_id || reg.id} className="hover:bg-[#FAF7F2] transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-[#8C6D2B] whitespace-nowrap">
                                <div>{reg.reg_id}</div>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase tracking-wider ${
                                  reg.membership_type === 'new'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                }`}>
                                  {reg.membership_type === 'new' ? 'New Application' : 'Existing Renewal'}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  reg.submitted_by_role === 'husband' ? 'bg-blue-100 text-blue-900' : 'bg-rose-100 text-rose-900'
                                }`}>
                                  {reg.submitted_by_role}
                                </span>
                                <div className="text-[11px] text-[#78716C] mt-0.5 truncate max-w-[140px]" title={reg.submitter_email}>
                                  {reg.submitter_email}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#1C1917]">{reg.husband_name}</div>
                                <div className="text-[11px] text-[#78716C] tabular-nums">{reg.husband_mobile}</div>
                                <div className="text-[11px] text-[#78716C] truncate max-w-[150px]">{reg.husband_email}</div>
                                {reg.husband_instagram && <div className="text-[11px] text-[#8C6D2B] truncate max-w-[150px]">📷 {reg.husband_instagram}</div>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#1C1917]">{reg.wife_name}</div>
                                <div className="text-[11px] text-[#78716C] tabular-nums">{reg.wife_mobile}</div>
                                <div className="text-[11px] text-[#78716C] truncate max-w-[150px]">{reg.wife_email}</div>
                                {reg.wife_instagram && <div className="text-[11px] text-rose-700 truncate max-w-[150px]">📷 {reg.wife_instagram}</div>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-semibold text-[#1C1917]">{reg.marriage_anniversary}</div>
                                <div className="text-[11px] text-[#78716C]">{reg.current_city}</div>
                              </td>
                              <td className="px-4 py-3">
                                {reg.children && reg.children.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {reg.children.map((c: any, idx: number) => (
                                      <div key={idx} className="text-[11px] text-[#1C1917]">
                                        • {c.name} ({c.gender})
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[#78716C] italic">None</span>
                                )}
                              </td>
                              <td className="px-4 py-3 min-w-[180px] max-w-[230px]">
                                {(reg.exp_rating !== null && reg.exp_rating !== undefined) ||
                                reg.exp_favourite_event ||
                                reg.exp_international_trip ||
                                reg.exp_missing ? (
                                  <div className="space-y-1 text-[11px]">
                                    {reg.exp_rating !== null && reg.exp_rating !== undefined && (
                                      <div>
                                        <span className="inline-block px-2 py-0.5 rounded bg-[#1C1917] text-[#F3DF9C] font-bold text-[10px] tabular-nums">
                                          Rating: {reg.exp_rating}/10
                                        </span>
                                      </div>
                                    )}
                                    {reg.exp_favourite_event && (
                                      <div className="text-[#1C1917] truncate" title={reg.exp_favourite_event}>
                                        <span className="text-[#78716C] font-semibold">Fav:</span> {reg.exp_favourite_event}
                                      </div>
                                    )}
                                    {(reg.exp_international_trip || reg.exp_trip_month_destination) && (
                                      <div className="text-[#44403C] truncate" title={reg.exp_trip_month_destination || reg.exp_international_trip}>
                                        <span className="text-[#78716C] font-semibold">Trip &amp; Month:</span>{' '}
                                        {reg.exp_international_trip === 'Yes' && reg.exp_trip_month_destination
                                          ? `Yes (${reg.exp_trip_month_destination})`
                                          : reg.exp_international_trip || reg.exp_trip_month_destination}
                                      </div>
                                    )}
                                    {reg.exp_missing && (
                                      <div className="text-[#57534E] truncate" title={reg.exp_missing}>
                                        <span className="text-[#78716C] font-semibold">Ideas:</span> {reg.exp_missing}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[#A8A29E] italic">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-1.5 max-w-[220px]">
                                  {reg.husband_photo_url && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPhotoModal({
                                          title: `Husband Photo — ${reg.husband_name}`,
                                          url: reg.husband_photo_url,
                                          downloadName: `${reg.reg_id}_husband.jpg`
                                        })}
                                        className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-700 hover:underline truncate cursor-pointer text-left"
                                      >
                                        {getDisplayImageSrc(reg.husband_photo_url) && (
                                          <CloudAwareImage
                                            url={reg.husband_photo_url}
                                            alt={reg.husband_name}
                                            className="w-6 h-6 rounded object-cover border border-[#D9CDB8] shrink-0"
                                          />
                                        )}
                                        <span className="truncate">Husband Photo</span>
                                      </button>
                                      {isExternalCloudUrl(reg.husband_photo_url) && (
                                        <a
                                          href={resolveFullMediaUrl(reg.husband_photo_url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open Drive Link"
                                          className="text-blue-600 hover:text-blue-800 shrink-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {reg.wife_photo_url && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPhotoModal({
                                          title: `Wife Photo — ${reg.wife_name}`,
                                          url: reg.wife_photo_url,
                                          downloadName: `${reg.reg_id}_wife.jpg`
                                        })}
                                        className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-700 hover:underline truncate cursor-pointer text-left"
                                      >
                                        {getDisplayImageSrc(reg.wife_photo_url) && (
                                          <CloudAwareImage
                                            url={reg.wife_photo_url}
                                            alt={reg.wife_name}
                                            className="w-6 h-6 rounded object-cover border border-[#D9CDB8] shrink-0"
                                          />
                                        )}
                                        <span className="truncate">Wife Photo</span>
                                      </button>
                                      {isExternalCloudUrl(reg.wife_photo_url) && (
                                        <a
                                          href={resolveFullMediaUrl(reg.wife_photo_url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open Drive Link"
                                          className="text-rose-600 hover:text-rose-800 shrink-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {reg.couple_photo_url && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPhotoModal({
                                          title: `Couple Photo — ${reg.husband_name} & ${reg.wife_name}`,
                                          url: reg.couple_photo_url,
                                          downloadName: `${reg.reg_id}_couple.jpg`
                                        })}
                                        className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800 hover:underline truncate cursor-pointer text-left"
                                      >
                                        {getDisplayImageSrc(reg.couple_photo_url) && (
                                          <CloudAwareImage
                                            url={reg.couple_photo_url}
                                            alt="Couple"
                                            className="w-6 h-6 rounded object-cover border border-[#D9CDB8] shrink-0"
                                          />
                                        )}
                                        <span className="truncate">Couple Photo</span>
                                      </button>
                                      {isExternalCloudUrl(reg.couple_photo_url) && (
                                        <a
                                          href={resolveFullMediaUrl(reg.couple_photo_url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open Drive Link"
                                          className="text-amber-700 hover:text-amber-900 shrink-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {reg.family_photo_url && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewPhotoModal({
                                          title: `Family Portrait — ${reg.husband_name} & ${reg.wife_name}`,
                                          url: reg.family_photo_url,
                                          downloadName: `${reg.reg_id}_family.jpg`
                                        })}
                                        className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8C6D2B] hover:underline truncate cursor-pointer text-left"
                                      >
                                        {getDisplayImageSrc(reg.family_photo_url) && (
                                          <CloudAwareImage
                                            url={reg.family_photo_url}
                                            alt="Family"
                                            className="w-6 h-6 rounded object-cover border border-[#D9CDB8] shrink-0"
                                          />
                                        )}
                                        <span className="truncate">Family Portrait</span>
                                      </button>
                                      {isExternalCloudUrl(reg.family_photo_url) && (
                                        <a
                                          href={resolveFullMediaUrl(reg.family_photo_url)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open Drive Link"
                                          className="text-[#8C6D2B] hover:text-[#6D531E] shrink-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {Array.isArray(reg.children) && reg.children.some((c: any) => c.photo_url) && (
                                    reg.children.map((c: any, idx: number) =>
                                      c.photo_url ? (
                                        <div key={idx} className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setPreviewPhotoModal({
                                              title: `Child Photo — ${c.name || `Child #${idx + 1}`}`,
                                              url: c.photo_url,
                                              downloadName: `${reg.reg_id}_child_${idx + 1}.jpg`
                                            })}
                                            className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 hover:underline truncate cursor-pointer text-left"
                                          >
                                            {getDisplayImageSrc(c.photo_url) && (
                                              <CloudAwareImage
                                                url={c.photo_url}
                                                alt={c.name}
                                                className="w-6 h-6 rounded object-cover border border-[#D9CDB8] shrink-0"
                                              />
                                            )}
                                            <span className="truncate">{c.name || `Child #${idx + 1}`}</span>
                                          </button>
                                          {isExternalCloudUrl(c.photo_url) && (
                                            <a
                                              href={resolveFullMediaUrl(c.photo_url)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              title="Open Drive Link"
                                              className="text-emerald-600 hover:text-emerald-800 shrink-0"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          )}
                                        </div>
                                      ) : null
                                    )
                                  )}
                                  {!reg.husband_photo_url &&
                                    !reg.wife_photo_url &&
                                    !reg.couple_photo_url &&
                                    !reg.family_photo_url &&
                                    !(Array.isArray(reg.children) && reg.children.some((c: any) => c.photo_url)) && (
                                      <span className="text-[11px] text-[#A8A29E] italic">No photos</span>
                                    )}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-[11px] text-[#78716C] tabular-nums">
                                {new Date(reg.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingFamilyModal(reg)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] border border-[#D9CDB8] font-semibold text-[11px] transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Eye className="w-3 h-3 text-[#8C6D2B]" />
                                    <span>View Dossier</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteError(null);
                                      setDeleteTarget({ kind: 'family', reg });
                                    }}
                                    title="Remove entry from database"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px] transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: NEW MEMBER APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E8DC]">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#1C1917] border border-[#C5A869]/70 shadow-2xs flex items-center justify-center text-[#D4AF37] shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif-royal font-bold text-base sm:text-lg text-[#1C1917] leading-snug">
                  New Member Applications
                </h2>
                <p className="text-xs text-[#78716C]">
                  Prospective member applications submitted for Chapter 2 review &amp; committee approval
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
              {newApplications.length > 0 && (
                <button
                  type="button"
                  onClick={exportNewApplicationsCsv}
                  className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-colors cursor-pointer shadow-2xs tabular-nums"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export CSV ({newApplications.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={loadNewApplications}
                disabled={loadingNewApplications}
                className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingNewApplications ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {newApplications.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-[#FAF7F2] rounded-2xl border border-[#E7DDCE] space-y-2.5">
              <UserPlus className="w-12 h-12 text-[#C5A869] mx-auto" />
              <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                No New Member Applications Yet
              </div>
              <p className="text-xs text-[#78716C] max-w-md mx-auto">
                Prospective member applications submitted from the main portal will appear here for committee review.
              </p>
            </div>
          ) : (() => {
            const term = newAppFilterSearch.trim().toLowerCase();
            const filteredApps = newApplications.filter((app) => {
              if (!term) return true;
              return (
                (app.app_id || '').toLowerCase().includes(term) ||
                (app.applicant_name || '').toLowerCase().includes(term) ||
                (app.business_name || '').toLowerCase().includes(term) ||
                (app.mobile_number || '').includes(term) ||
                (app.email || '').toLowerCase().includes(term) ||
                (app.reference_name || '').toLowerCase().includes(term)
              );
            });

            return (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newAppFilterSearch}
                    onChange={(e) => setNewAppFilterSearch(e.target.value)}
                    placeholder="Search applications by name, business, mobile, email, reference, or App ID..."
                    className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] text-base sm:text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:ring-2 focus:ring-[#C5A869]/40 focus:border-[#C5A869]"
                  />
                </div>

                {filteredApps.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs text-[#78716C]">
                    No applications matched &ldquo;{newAppFilterSearch}&rdquo;.
                  </div>
                ) : (
                  <>
                    {/* Mobile Applications Cards (< md) */}
                    <div className="md:hidden space-y-3">
                      {filteredApps.map((app) => (
                        <article
                          key={(app as any)._docId || app.app_id || app.id}
                          className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#E7DDCE]">
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-[#8C6D2B]">{app.app_id}</span>
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Pending Review
                                </span>
                              </div>
                              <h3 className="font-serif-royal font-bold text-base text-[#1C1917]">
                                {app.applicant_name}
                              </h3>
                              <div className="text-xs text-[#57534E] flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-[#8C6D2B] shrink-0" />
                                <span className="truncate">{app.business_name}</span>
                              </div>
                            </div>
                            <span className="text-[11px] text-[#78716C] shrink-0 tabular-nums">
                              {new Date(app.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-white border border-[#E7DDCE]">
                              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Contact</span>
                              <div className="font-mono text-[#1C1917] tabular-nums">{app.mobile_number}</div>
                              <div className="text-[11px] text-[#78716C] truncate">{app.email}</div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-[#E7DDCE]">
                              <span className="text-[10px] font-bold uppercase text-[#78716C] block">Reference</span>
                              <div className="font-semibold text-[#1C1917]">{app.reference_name}</div>
                              <div className="text-[11px] text-[#78716C] font-mono tabular-nums">{app.reference_mobile}</div>
                            </div>
                          </div>

                          <div className="text-[11px] text-[#57534E] flex flex-wrap gap-x-4 gap-y-1">
                            <span>Pres: <strong className="text-[#1C1917]">{app.president_name}</strong></span>
                            <span>Sec: <strong className="text-[#1C1917]">{app.secretary_name}</strong></span>
                            <span>
                              Other Group:{' '}
                              <strong className="text-[#1C1917]">
                                {app.other_group_member === 'Yes' ? app.other_group_name : 'No'}
                              </strong>
                              {app.other_group_member === 'Yes' && app.other_group_position ? (
                                <span className="text-[#78716C]"> ({app.other_group_position})</span>
                              ) : null}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7DDCE]">
                            <button
                              type="button"
                              onClick={() => setViewingNewAppModal(app)}
                              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#F2ECE1] text-[#1C1917] border border-[#D9CDB8] font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#8C6D2B]" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget({ kind: 'application', app });
                              }}
                              className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>

                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#E7DDCE]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F5EFE6] text-[#44403C] uppercase text-[10px] font-semibold border-b border-[#E7DDCE]">
                          <tr>
                            <th className="px-4 py-3">App ID</th>
                            <th className="px-4 py-3">Applicant &amp; Business</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Reference</th>
                            <th className="px-4 py-3">President / Secretary</th>
                            <th className="px-4 py-3">Other Group</th>
                            <th className="px-4 py-3">Submitted At</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0E8DC] bg-white">
                          {filteredApps.map((app) => (
                            <tr key={(app as any)._docId || app.app_id || app.id} className="hover:bg-[#FAF7F2] transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-[#8C6D2B] whitespace-nowrap">
                                {app.app_id}
                                <div className="text-[10px] font-sans font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                                  Pending Review
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-[#1C1917]">{app.applicant_name}</div>
                                <div className="text-[11px] text-[#57534E] flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3 text-[#8C6D2B] shrink-0" />
                                  <span>{app.business_name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono text-[#1C1917] tabular-nums">{app.mobile_number}</div>
                                <div className="text-[11px] text-[#78716C] truncate max-w-[160px]">{app.email}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-[#1C1917]">{app.reference_name}</div>
                                <div className="text-[11px] text-[#78716C] font-mono tabular-nums">{app.reference_mobile}</div>
                              </td>
                              <td className="px-4 py-3 text-[11px]">
                                <div>
                                  <span className="text-[#78716C]">Pres:</span>{' '}
                                  <strong className="text-[#1C1917]">{app.president_name}</strong> ({app.president_mobile})
                                </div>
                                <div className="mt-0.5">
                                  <span className="text-[#78716C]">Sec:</span>{' '}
                                  <strong className="text-[#1C1917]">{app.secretary_name}</strong> ({app.secretary_mobile})
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {app.other_group_member === 'Yes' ? (
                                  <div className="space-y-1">
                                    <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-semibold">
                                      Yes: {app.other_group_name}
                                    </span>
                                    {app.other_group_position && (
                                      <div className="text-[11px] text-[#57534E]">
                                        Position: <strong className="text-[#1C1917]">{app.other_group_position}</strong>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[#78716C]">No</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-[11px] text-[#78716C] tabular-nums">
                                {new Date(app.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingNewAppModal(app)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] border border-[#D9CDB8] font-semibold text-[11px] transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Eye className="w-3 h-3 text-[#8C6D2B]" />
                                    <span>View</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteError(null);
                                      setDeleteTarget({ kind: 'application', app });
                                    }}
                                    title="Remove application from database"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px] transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 1: MEMBERS TABLE WITH COMBINABLE FILTERS */}
      {activeTab === 'members' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
          
          {/* Search Bar & Combinable Filter Dropdowns */}
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
              {/* Search */}
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Couple ID, Name, Mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-h-[42px] pl-10 pr-4 py-2 text-base sm:text-xs rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>

              {/* Combinable Filters Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex items-center gap-2 w-full lg:w-auto">
                {/* Verification Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] shrink-0">Auth:</span>
                  <select
                    value={verificationFilter}
                    onChange={(e) => {
                      setVerificationFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full sm:w-auto min-h-[40px] text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-xl px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  >
                    <option value="all">All Auth Status</option>
                    <option value="verified">Verified Only</option>
                    <option value="not_verified">Not Verified Only</option>
                  </select>
                </div>

                {/* Chapter 2 Status Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] shrink-0">Chapter 2:</span>
                  <select
                    value={year2Filter}
                    onChange={(e) => {
                      setYear2Filter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full sm:w-auto min-h-[40px] text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-xl px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  >
                    <option value="all">All Chapter-2 Status</option>
                    <option value="submitted">Submitted Only</option>
                    <option value="draft">Draft / Incomplete</option>
                    <option value="not_started">Not Started</option>
                  </select>
                </div>

                {/* Corrections Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C] shrink-0">Corrections:</span>
                  <select
                    value={correctionFilter}
                    onChange={(e) => {
                      setCorrectionFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="w-full sm:w-auto min-h-[40px] text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-xl px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  >
                    <option value="all">All Corrections</option>
                    <option value="pending">Pending Review</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                    <option value="no_correction">No Corrections</option>
                  </select>
                </div>

                {(verificationFilter !== 'all' || year2Filter !== 'all' || correctionFilter !== 'all' || search) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationFilter('all');
                      setYear2Filter('all');
                      setCorrectionFilter('all');
                      setSearch('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="sm:col-span-3 lg:col-span-1 min-h-[38px] text-[11px] font-semibold text-[#8C6D2B] underline hover:text-[#1C1917] px-2 cursor-pointer text-left lg:text-center"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Member Cards View (< md) */}
          <div className="md:hidden space-y-3">
            {loadingMembers ? (
              <div className="py-10 text-center text-xs text-[#78716C]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8C6D2B]" />
                Querying database records...
              </div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#78716C] bg-[#FAF7F2] rounded-2xl border border-[#E7DDCE]">
                No matching couple records found for current filter criteria.
              </div>
            ) : (
              members.map((m) => {
                const isSubmitted = m.year2_status === 'SUBMITTED';
                const isDraft = m.year2_status === 'DRAFT';
                const isVerified = m.is_verified === 1;

                return (
                  <article
                    key={m.couple_id}
                    className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7DDCE] space-y-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E7DDCE]">
                      <div>
                        <span className="font-mono font-bold text-[#8C6D2B]">{m.couple_id}</span>
                        <h3 className="font-serif-royal font-bold text-base text-[#1C1917] mt-0.5">
                          {m.husband_name} &amp; {m.wife_name}
                        </h3>
                        <div className="text-[11px] text-[#78716C]">
                          Anniversary: {m.marriage_anniversary || '—'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isVerified ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            VERIFIED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
                            NOT VERIFIED
                          </span>
                        )}
                        {isSubmitted ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            SUBMITTED
                          </span>
                        ) : isDraft ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                            DRAFT
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                            NOT STARTED
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[#57534E] font-mono text-[11px] tabular-nums">
                      <span>H: {m.husband_registered_mobile}</span>
                      {m.wife_registered_mobile && <span>W: {m.wife_registered_mobile}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7DDCE]">
                      <button
                        type="button"
                        onClick={() => inspectMember(m.couple_id)}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                        <span>View Dossier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget({ kind: 'member', member: m });
                        }}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Desktop Members Table (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-[#E7DDCE]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F5EFE6] border-b border-[#E7DDCE] text-[#44403C] uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-3">Couple ID</th>
                  <th className="py-3 px-3">Husband &amp; Wife</th>
                  <th className="py-3 px-3">Registered Mobile</th>
                  <th className="py-3 px-3">Auth Status</th>
                  <th className="py-3 px-3">Chapter-2 Status</th>
                  <th className="py-3 px-3">Correction Status</th>
                  <th className="py-3 px-3">Last Activity</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6EFE6]">
                {loadingMembers ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#78716C]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8C6D2B]" />
                      Querying database records...
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#78716C]">
                      No matching couple records found for current filter criteria.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const isSubmitted = m.year2_status === 'SUBMITTED';
                    const isDraft = m.year2_status === 'DRAFT';
                    const isVerified = m.is_verified === 1;

                    return (
                      <tr key={m.couple_id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="py-3.5 px-3 font-mono font-bold text-[#1C1917]">
                          {m.couple_id}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-[#1C1917]">
                            {m.husband_name} &amp; {m.wife_name}
                          </div>
                          <div className="text-[10px] text-[#78716C]">
                            Anniversary: {m.marriage_anniversary || '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-[#57534E] tabular-nums">
                          <div>H: {m.husband_registered_mobile}</div>
                          {m.wife_registered_mobile && (
                            <div className="text-[10px] text-[#78716C]">W: {m.wife_registered_mobile}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
                              NOT VERIFIED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {isSubmitted ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              SUBMITTED
                            </span>
                          ) : isDraft ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              DRAFT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]">
                              NOT STARTED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {m.correction_status === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                              PENDING
                            </span>
                          ) : m.correction_status === 'UNDER_REVIEW' ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              UNDER REVIEW
                            </span>
                          ) : m.correction_status === 'RESOLVED' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              RESOLVED
                            </span>
                          ) : m.correction_status === 'REJECTED' ? (
                            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px]">
                              REJECTED
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#A8A29E]">NO CORRECTION</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#78716C] text-[11px] tabular-nums">
                          {m.submitted_at
                            ? new Date(m.submitted_at).toLocaleDateString()
                            : m.last_activity
                            ? new Date(m.last_activity).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => inspectMember(m.couple_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#2A2623] text-white text-[11px] font-medium transition-all cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-[#D4AF37]" />
                              <span>View Dossier</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget({ kind: 'member', member: m });
                              }}
                              title="Remove member from database"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#F0E8DC] text-xs text-[#78716C]">
            <span className="tabular-nums">
              Showing {members.length} of {pagination.total} registered couples
            </span>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 rounded-xl border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#1C1917] tabular-nums px-2">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center p-2 rounded-xl border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CORRECTION QUEUE */}
      {activeTab === 'corrections' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F0E8DC] gap-2">
            <div>
              <h3 className="font-serif-royal font-bold text-lg text-[#1C1917]">
                Member Identity Correction Requests
              </h3>
              <p className="text-xs text-[#78716C]">
                Review member-submitted discrepancy notices. Updating status records administrative decisions without directly altering protected master records.
              </p>
            </div>

            {/* Status Filter for Corrections */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['all', 'pending', 'under_review', 'resolved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setCorrectionStatusTab(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    correctionStatusTab === st
                      ? 'bg-[#1C1917] text-[#FAF7F2]'
                      : 'bg-[#FAF8F5] text-[#57534E] hover:bg-[#EFE6D5]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {displayedCorrections.length === 0 ? (
            <div className="py-12 text-center text-[#78716C] text-xs">
              No correction requests matching the &ldquo;{correctionStatusTab.replace('_', ' ')}&rdquo; filter.
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCorrections.map((cr) => (
                <div
                  key={cr.id}
                  className="p-4 rounded-2xl border border-[#E7DDCE] bg-[#FAF8F5] space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-[#1C1917] bg-[#EFE6D5] px-2 py-0.5 rounded text-[11px]">
                          {cr.couple_id}
                        </span>
                        <span className="font-bold text-[#1C1917]">
                          {cr.husband_name} & {cr.wife_name}
                        </span>
                        <span className="text-[11px] text-[#78716C]">
                          (H: {cr.husband_registered_mobile})
                        </span>
                      </div>
                      <div className="text-[#8C6D2B] font-semibold mt-1">
                        Requested Correction Area: <strong>{cr.requested_correction}</strong>
                      </div>
                    </div>

                    <span
                      className={`self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        cr.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : cr.status === 'under_review'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : cr.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {cr.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E9DFCE] text-[#44403C]">
                    <span className="text-[10px] text-[#A8A29E] uppercase font-bold block mb-1">
                      Member Description:
                    </span>
                    {cr.member_message}
                  </div>

                  {cr.admin_notes && (
                    <div className="text-[11px] text-[#57534E] bg-[#F5EFE6] p-2.5 rounded-lg border border-[#DFCFAE]">
                      <strong>Committee Admin Note:</strong> {cr.admin_notes}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="pt-2 border-t border-[#F0E8DC]">
                    {actionTargetId === cr.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder={`Enter admin note for marking ${actionType?.replace('_', ' ')}...`}
                          value={actionAdminNotes}
                          onChange={(e) => setActionAdminNotes(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[#D9CDB8] text-xs bg-white"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            disabled={processingCorrection}
                            onClick={() => handleUpdateCorrectionStatus(cr.id, actionType!)}
                            className="px-3 py-1.5 rounded-lg bg-[#1C1917] text-white font-semibold text-xs cursor-pointer"
                          >
                            {processingCorrection ? 'Saving...' : `Confirm ${actionType?.replace('_', ' ')}`}
                          </button>
                          <button
                            onClick={() => {
                              setActionTargetId(null);
                              setActionType(null);
                              setActionAdminNotes('');
                            }}
                            className="px-2 py-1.5 text-xs text-[#78716C] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        {cr.status !== 'under_review' && cr.status !== 'resolved' && (
                          <button
                            onClick={() => {
                              setActionTargetId(cr.id);
                              setActionType('under_review');
                              setActionAdminNotes('Request is currently under review by the Royals Committee.');
                            }}
                            className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                          >
                            Mark Under Review
                          </button>
                        )}

                        {cr.status !== 'resolved' && (
                          <button
                            onClick={() => {
                              setActionTargetId(cr.id);
                              setActionType('resolved');
                              setActionAdminNotes('Correction verified and noted in administrative ledger.');
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
                          >
                            Mark as Resolved
                          </button>
                        )}

                        {cr.status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setActionTargetId(cr.id);
                              setActionType('rejected');
                              setActionAdminNotes('Request reviewed; does not meet criteria or already matches official records.');
                            }}
                            className="px-3 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-semibold hover:bg-red-100 cursor-pointer"
                          >
                            Reject
                          </button>
                        )}

                        <button
                          onClick={() => inspectMember(cr.couple_id)}
                          className="px-3 py-1 rounded-lg bg-white border border-[#D9CDB8] text-[#1C1917] text-xs font-semibold hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          View Member Dossier
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DC]">
            <div>
              <h3 className="font-serif-royal font-bold text-lg text-[#1C1917]">
                Administrative Security Audit Log
              </h3>
              <p className="text-xs text-[#78716C]">
                Tamper-evident record of all administrative logins, profile views, correction reviews, internal notes, and data exports.
              </p>
            </div>
            <button
              onClick={() => loadAuditLogs(auditPagination.page)}
              className="p-1.5 rounded-lg border border-[#D9CDB8] text-[#57534E] hover:bg-[#FAF7F2] cursor-pointer"
              title="Refresh audit log"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F0E8DC] text-[#78716C] uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Admin Email</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Target Couple</th>
                  <th className="py-3 px-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6EFE6]">
                {loadingAudit ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#78716C]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8C6D2B]" />
                      Loading audit events...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#78716C]">
                      No audit events logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    let actionBadgeColor = 'bg-gray-100 text-gray-700';
                    if (log.action.includes('login')) actionBadgeColor = 'bg-blue-50 text-blue-700 border border-blue-200';
                    else if (log.action.includes('profile')) actionBadgeColor = 'bg-purple-50 text-purple-700 border border-purple-200';
                    else if (log.action.includes('Correction')) actionBadgeColor = 'bg-amber-50 text-amber-800 border border-amber-200';
                    else if (log.action.includes('note')) actionBadgeColor = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                    else if (log.action.includes('Export')) actionBadgeColor = 'bg-indigo-50 text-indigo-700 border border-indigo-200';

                    return (
                      <tr key={log.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-3 px-3 text-[#78716C] font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-medium text-[#1C1917]">
                          {log.admin_email}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${actionBadgeColor}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#8C6D2B]">
                          {log.target_couple_id || '—'}
                        </td>
                        <td className="py-3 px-3 text-[#57534E] max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Audit Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F0E8DC] text-xs text-[#78716C]">
            <span>Total Logged Events: {auditPagination.total}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={auditPagination.page <= 1}
                onClick={() => loadAuditLogs(auditPagination.page - 1)}
                className="p-1.5 rounded-lg border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#1C1917]">
                Page {auditPagination.page} of {auditPagination.totalPages || 1}
              </span>
              <button
                disabled={auditPagination.page >= auditPagination.totalPages}
                onClick={() => loadAuditLogs(auditPagination.page + 1)}
                className="p-1.5 rounded-lg border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXPORT CENTER */}
      {activeTab === 'export' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#F0E8DC] pb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-[#8C6D2B]" />
              <h3 className="font-serif-royal font-bold text-xl text-[#1C1917]">
                Export Chapter-2 Submissions & Registry
              </h3>
            </div>
            <p className="text-xs text-[#78716C] mt-1">
              Download clean, live database exports formatted for Microsoft Excel / Google Sheets (RFC-4180 CSV standard).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Filter Selector */}
            <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7DDCE] space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1C1917] block">
                Select Export Filter
              </span>

              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All 110 Royal Couples (Full Registry)' },
                  { id: 'submitted', label: 'Submitted Only (Completed Chapter 2 Updates)' },
                  { id: 'not_submitted', label: 'Not Submitted (Incomplete Drafts + Not Started)' },
                  { id: 'verified', label: 'Verified Only (OTP Authenticated)' },
                  { id: 'corrections', label: 'Couples with Correction Requests' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      exportFilter === opt.id
                        ? 'border-[#1C1917] bg-white font-semibold text-[#1C1917] shadow-xs'
                        : 'border-[#E9DFCE] text-[#57534E] hover:bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="exportFilter"
                      value={opt.id}
                      checked={exportFilter === opt.id}
                      onChange={() => setExportFilter(opt.id)}
                      className="accent-[#1C1917]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>

              <button
                disabled={exporting}
                onClick={() => handleDownloadCsv(exportFilter)}
                className="w-full py-3 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {exporting ? (
                  <span>Generating CSV...</span>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-[#D4AF37]" />
                    <span>Download CSV Spreadsheet</span>
                  </>
                )}
              </button>

              {exportSummary && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                  {exportSummary}
                </div>
              )}
            </div>

            {/* Information & Security Details */}
            <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E9DFCE] space-y-3 text-xs text-[#57534E]">
              <span className="font-bold uppercase tracking-wider text-[#8C6D2B] block text-[11px]">
                Data & Security Assurance
              </span>
              <ul className="space-y-2 list-disc list-inside text-[11px]">
                <li><strong>Live Database Query:</strong> Export reflects the live SQLite source of truth at the moment of download.</li>
                <li><strong>Excluded Sensitive Fields:</strong> Admin passwords, OTP verification codes, and session JWTs are strictly omitted from exports.</li>
                <li><strong>Included Fields:</strong> Couple ID, Husband & Wife names, Registered Mobiles, Anniversary, Updated City, Residential Address, Professional Update, Organization, Family updates, Wishlist, Contribution Areas, Royal Idea for 2027, Photo ID, and Verification & Submission timestamps.</li>
                <li><strong>Audited:</strong> Every export action is logged with the downloading admin&apos;s email in the Committee Audit Trail.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: IMPORT MASTER DATA (STEP 9) */}
      {activeTab === 'import' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-[#F0E8DC] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-[#8C6D2B]" />
                <h3 className="font-serif-royal font-bold text-xl text-[#1C1917]">
                  STEP 9 — Import Real Year-1 Member Master Data
                </h3>
              </div>
              <p className="text-xs text-[#78716C] mt-1">
                Permanent Year-1 member master for exactly 110 Royal Couples (JR001 through JR110). Validates identity constraints, detects mobile discrepancies, and guarantees zero Aadhaar data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  importStatus?.isReady
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border border-amber-300'
                }`}
              >
                STATUS: {importStatus?.isReady ? 'READY' : 'NOT READY'}
              </span>
              <button
                onClick={loadImportStatus}
                className="p-1.5 rounded-lg border border-[#D9CDB8] text-[#57534E] hover:bg-[#FAF7F2] cursor-pointer"
                title="Refresh validation metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Validation Metrics Grid */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1C1917] block">
              Automated Member Master Validation
            </span>

            {loadingImportStatus ? (
              <div className="p-8 text-center text-xs text-[#78716C]">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8C6D2B]" />
                Validating database records...
              </div>
            ) : importStatus ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Total Members</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.totalMembers} / 110</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">JR001 Present</span>
                  <span className={`text-lg font-bold ${importStatus.jr001Present ? 'text-emerald-700' : 'text-red-600'}`}>
                    {importStatus.jr001Present ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">JR110 Present</span>
                  <span className={`text-lg font-bold ${importStatus.jr110Present ? 'text-emerald-700' : 'text-red-600'}`}>
                    {importStatus.jr110Present ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Aadhaar Ingested</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {importStatus.aadhaarFieldsImported} (0 REQUIRED)
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Couple IDs</span>
                  <span className={`text-lg font-bold ${importStatus.missingCoupleIds.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {importStatus.missingCoupleIds.length}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Duplicate Couple IDs</span>
                  <span className={`text-lg font-bold ${importStatus.duplicateCoupleIds.length === 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {importStatus.duplicateCoupleIds.length}
                  </span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Husband Mobile</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.missingHusbandMobile}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Wife Mobile</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.missingWifeMobile}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Duplicate Husband Mobiles</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.duplicateHusbandMobiles.length}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Duplicate Wife Mobiles</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.duplicateWifeMobiles.length}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Husband DOB</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.missingHusbandDob}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Wife DOB</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.missingWifeDob}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Missing Anniversary</span>
                  <span className="text-lg font-bold text-[#1C1917]">{importStatus.missingAnniversary}</span>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE]">
                  <span className="text-[10px] text-[#78716C] uppercase font-semibold block">Mobile Review Required</span>
                  <span className={`text-lg font-bold ${importStatus.recordsRequiringMobileReview > 0 ? 'text-purple-700' : 'text-emerald-700'}`}>
                    {importStatus.recordsRequiringMobileReview} records
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Records Requiring Mobile Review List */}
          {importStatus?.mobileReviewList?.length > 0 && (
            <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2 text-xs">
              <span className="font-bold text-purple-900 uppercase text-[11px] block">
                Records Requiring Administrative Mobile Review ({importStatus.mobileReviewList.length})
              </span>
              <p className="text-[11px] text-purple-800">
                In accordance with Step 9 guidelines, mobile discrepancies are not silently corrected or guessed; they are flagged below for manual review.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                {importStatus.mobileReviewList.map((m: any) => (
                  <div key={m.couple_id} className="p-2 bg-white rounded-lg border border-purple-200 flex items-center justify-between">
                    <div>
                      <strong className="font-mono text-[#1C1917]">{m.couple_id}</strong>: {m.husband_name} &amp; {m.wife_name}
                      <span className="text-[10px] text-gray-500 block">H: {m.husband_mobile || 'None'} • W: {m.wife_mobile || 'None'}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                      {m.reasons}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingest / Upload Interface */}
          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E7DDCE] space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#1C1917] block">
                Ingest Real 110-Member Master Dataset
              </span>
              <p className="text-xs text-[#78716C] mt-0.5">
                Paste the CSV / JSON records from the Year-1 master spreadsheet or choose a CSV file.
              </p>
            </div>

            {importMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200">
                {importMessage}
              </div>
            )}

            {importError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {importError}
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-white border border-[#D9CDB8] text-xs font-semibold rounded-lg hover:bg-[#FAF7F2] cursor-pointer inline-flex items-center gap-1.5">
                  <span>Upload CSV File</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          setCsvInput((evt.target?.result as string) || '');
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
                <span className="text-[11px] text-[#78716C]">or paste CSV / JSON content below:</span>
              </div>

              <textarea
                rows={8}
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="couple_id,husband_name,husband_registered_mobile,husband_dob,wife_name,wife_registered_mobile,wife_dob,marriage_anniversary,kids,year1_status&#10;JR001,Rajesh Jain,9826011111,1980-01-15,Pooja Jain,9826022222,1982-03-20,2005-12-10,2 Kids,Active / Year-1 Member..."
                className="w-full p-3 text-xs font-mono rounded-xl border border-[#D9CDB8] bg-white text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#8C6D2B]"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#78716C]">
                  Fields supported: couple_id (JR001-JR110), husband_name, husband_registered_mobile, husband_dob, wife_name, wife_registered_mobile, wife_dob, marriage_anniversary, kids.
                </span>
                <button
                  type="submit"
                  disabled={importing || !csvInput.trim()}
                  className="px-4 py-2 bg-[#1C1917] hover:bg-[#2A2623] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
                >
                  {importing ? (
                    <span>Validating &amp; Ingesting...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                      <span>Validate &amp; Ingest Members</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Compliance & RLS Security Rules */}
          <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E9DFCE] text-xs text-[#57534E] space-y-2">
            <span className="font-bold uppercase tracking-wider text-[#8C6D2B] block text-[11px]">
              Critical Step 9 Security Assertions
            </span>
            <ul className="space-y-1 list-disc list-inside text-[11px]">
              <li><strong>Zero Aadhaar:</strong> Aadhaar numbers or URLs are strictly blocked at ingestion and cannot be stored or exposed anywhere in the portal.</li>
              <li><strong>Protected Identity Master:</strong> Couple IDs, names, registered mobiles, DOBs, and anniversaries are immutable for members; discrepancies must be routed through the correction workflow.</li>
              <li><strong>Shared Couple Mapping:</strong> Both the husband&apos;s and wife&apos;s registered mobiles authenticate to the exact same Couple ID and the same Chapter-2 dossier.</li>
              <li><strong>RLS &amp; Isolation:</strong> Authenticated sessions can query only their own Couple ID, preventing cross-couple data leakage.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 6: SMS GATEWAY (FAST2SMS) CONFIGURATION */}
      {activeTab === 'sms' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E8DC]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F5EFE6] text-[#8C6D2B] flex items-center justify-center border border-[#E2D5BE] shrink-0">
                <Phone className="w-6 h-6 text-[#8C6D2B]" />
              </div>
              <div>
                <h3 className="font-serif-royal font-bold text-lg text-[#1C1917]">
                  Fast2SMS Gateway Integration
                </h3>
                <p className="text-xs text-[#78716C]">
                  Direct Indian carrier SMS delivery for member OTP verification
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadSmsConfig}
              disabled={loadingSmsConfig}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSmsConfig ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Status Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE]">
              <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider block mb-1">
                Gateway Status
              </span>
              <div className="flex items-center gap-2">
                {smsConfig?.configured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">Active & Configured</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">Awaiting API Key</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE]">
              <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider block mb-1">
                Fast2SMS Route
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1C1917]">bulkV2 OTP (Transactional)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE]">
              <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider block mb-1">
                Wallet Balance
              </span>
              <div className="flex items-center gap-2">
                {smsConfig?.wallet ? (
                  <span className="text-base font-bold text-emerald-800 font-mono">
                    ₹{smsConfig.wallet}
                  </span>
                ) : (
                  <span className="text-xs text-[#78716C]">
                    {smsConfig?.configured ? 'Checking...' : 'Enter key to view'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Active Key Display */}
          {smsConfig?.maskedKey && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
              <div>
                <span className="font-bold block">Current Active Authorization Key:</span>
                <span className="font-mono text-xs">{smsConfig.maskedKey}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                Ready for SMS
              </span>
            </div>
          )}

          {/* Update Key Form */}
          <div className="bg-[#FAF7F2] border border-[#E7DDCE] rounded-2xl p-5 space-y-4">
            <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
              Configure Fast2SMS Authorization Key
            </h4>
            <p className="text-xs text-[#57534E] leading-relaxed">
              To obtain your Fast2SMS API Key:
              <br />
              1. Log in to your <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer" className="underline font-semibold text-[#8C6D2B]">Fast2SMS Dashboard</a>.
              <br />
              2. Click <strong>Dev API</strong> from the left sidebar (or visit <code className="bg-[#EFE6D5] px-1 rounded">https://www.fast2sms.com/dashboard/dev-api</code>).
              <br />
              3. Copy your <strong>Authorization Key</strong> and paste it below.
            </p>

            {smsKeySuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{smsKeySuccess}</span>
              </div>
            )}

            {smsKeyError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{smsKeyError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSmsKey} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Fast2SMS Authorization / API Key
                </label>
                <input
                  type="text"
                  placeholder="Paste your Fast2SMS API Key here..."
                  value={newSmsApiKey}
                  onChange={(e) => setNewSmsApiKey(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>

              <button
                type="submit"
                disabled={savingSmsKey || !newSmsApiKey.trim()}
                className="py-2.5 px-5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {savingSmsKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                    <span>Validating Key...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Save & Test Fast2SMS Connection</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Live Diagnostic Test with Current Credentials */}
          <div className="bg-[#FAF7F2] border border-[#E7DDCE] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1C1917] text-[#D4AF37] flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                    Live Fast2SMS API Diagnostic Tester
                  </h4>
                  <p className="text-[11px] text-[#78716C]">
                    Test live carrier routes directly against Fast2SMS servers with your current credentials
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[10px] uppercase tracking-wider">
                Direct API Test
              </span>
            </div>

            <form onSubmit={handleRunFast2SmsTest} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Test Destination Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={testMobile}
                    onChange={(e) => setTestMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={testingFast2Sms || !smsConfig?.configured || testMobile.length !== 10}
                className="py-2.5 px-5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {testingFast2Sms ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                    <span>Calling Fast2SMS API...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Execute Fast2SMS Test API</span>
                  </>
                )}
              </button>
            </form>

            {testError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{testError}</span>
              </div>
            )}

            {testResult && (
              <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DC]">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-[#1C1917]">
                      Fast2SMS Live Diagnostic Report ({testResult.testMobile})
                    </span>
                  </div>
                  <span className="text-[10px] text-[#78716C]">
                    Tested at: {new Date(testResult.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Account & Wallet Check */}
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E7DDCE] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">Fast2SMS Account Authentication:</span>
                    {testResult.walletResult?.return ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        AUTHENTICATED • BALANCE: ₹{testResult.walletResult.wallet}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-bold">
                        FAILED
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#78716C]">
                    API Key: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E2D5BE]">{testResult.maskedKey}</code> • SMS Credits in wallet: <strong>{testResult.walletResult?.sms_count ?? 200}</strong>
                  </p>
                </div>

                {/* Route 1: OTP Route */}
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E7DDCE] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">Route 1: Dedicated OTP Route (route: &apos;otp&apos;)</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      testResult.otpRouteResult?.return ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {testResult.otpRouteResult?.return ? 'READY' : `STATUS CODE ${testResult.otpRouteResult?.status_code || 996}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#44403C]">
                    {testResult.otpRouteResult?.message?.[0] || testResult.otpRouteResult?.message || 'OTP route verification response.'}
                  </p>
                  {testResult.otpRouteResult?.status_code === 996 && (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      <strong>How to activate OTP route:</strong> In your Fast2SMS Dashboard, click <em>Dev API &gt; OTP Message</em> and submit the quick website verification with URL <code>https://ais-pre-t5c2x6fk3je4yhythikayj-923279058412.asia-southeast1.run.app</code>.
                    </div>
                  )}
                </div>

                {/* Route 2: Quick Route Fallback */}
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E7DDCE] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1C1917]">Route 2: Quick SMS Route (route: &apos;q&apos; fallback)</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      testResult.quickRouteResult?.return ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-900'
                    }`}>
                      {testResult.quickRouteResult?.return ? 'DISPATCHED' : `STATUS CODE ${testResult.quickRouteResult?.status_code || 999}`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#44403C]">
                    {testResult.quickRouteResult?.message?.[0] || testResult.quickRouteResult?.message || 'Quick route verification response.'}
                  </p>
                  {testResult.quickRouteResult?.status_code === 999 && (
                    <div className="p-2 rounded bg-orange-50 border border-orange-200 text-[11px] text-orange-950">
                      <strong>Fast2SMS Carrier Policy Requirement:</strong> Fast2SMS provides ₹50 promotional credit, but programmatically requires one minimum transaction of ₹100 INR on <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer" className="underline font-semibold text-[#8C6D2B]">fast2sms.com</a> before releasing live SMS to cellular towers. Once ₹100 is recharged, live delivery activates immediately.
                    </div>
                  )}
                </div>

                {/* Technical Raw Payload Accordion */}
                <details className="text-[11px] text-[#78716C] border border-[#E7DDCE] rounded-lg p-2 bg-[#FAF7F2]">
                  <summary className="font-semibold cursor-pointer select-none">
                    View Raw Server Responses from Fast2SMS
                  </summary>
                  <pre className="mt-2 p-2 bg-[#1C1917] text-[#FAF7F2] font-mono text-[10px] rounded overflow-x-auto">
                    {JSON.stringify({
                      wallet: testResult.walletResult,
                      otpRoute: testResult.otpRouteResult,
                      quickRoute: testResult.quickRouteResult
                    }, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          {/* Recent OTP Activity Monitor */}
          <div className="bg-[#FAF7F2] border border-[#E7DDCE] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#8C6D2B]" />
                <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                  Recent OTP Verification Activity
                </h4>
              </div>
              <button
                type="button"
                onClick={loadRecentOtps}
                disabled={loadingRecentOtps}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#D9CDB8] text-[11px] font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRecentOtps ? 'animate-spin' : ''}`} />
                <span>Refresh Log</span>
              </button>
            </div>

            <p className="text-xs text-[#78716C]">
              Real-time audit log of OTP codes issued to members trying to log in.
            </p>

            {recentOtps.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#78716C] bg-white rounded-xl border border-[#E7DDCE]">
                No recent OTP activity recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E7DDCE] bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5EFE6] text-[#44403C] uppercase text-[10px] font-semibold border-b border-[#E7DDCE]">
                    <tr>
                      <th className="px-3 py-2.5">Time</th>
                      <th className="px-3 py-2.5">Mobile</th>
                      <th className="px-3 py-2.5">Couple ID / Name</th>
                      <th className="px-3 py-2.5">Attempts</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E8DC]">
                    {recentOtps.map((record) => {
                      const isExpired = new Date(record.expires_at).getTime() < Date.now();
                      const coupleLabel = record.husband_name && record.wife_name
                        ? `${record.couple_id}: ${record.husband_name} & ${record.wife_name}`
                        : record.couple_id;
                      return (
                        <tr key={record.id} className="hover:bg-[#FAF7F2]">
                          <td className="px-3 py-2 text-[#78716C] whitespace-nowrap">
                            {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-[#1C1917] whitespace-nowrap">
                            {record.mobile}
                          </td>
                          <td className="px-3 py-2 text-[#44403C] truncate max-w-[200px]" title={coupleLabel}>
                            {coupleLabel}
                          </td>
                          <td className="px-3 py-2 text-center text-[#78716C]">
                            {record.attempts}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {record.verified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <Check className="w-3 h-3" /> Verified
                              </span>
                            ) : isExpired ? (
                              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-medium">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                                <Clock className="w-3 h-3" /> Awaiting Input
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: EMAIL GATEWAY (GMAIL / RESEND) CONFIGURATION */}
      {activeTab === 'email' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E8DC]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-indigo-700 flex items-center justify-center border border-indigo-200 shrink-0">
                <Mail className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <h3 className="font-serif-royal font-bold text-lg text-[#1C1917]">
                  Email Verification Gateway
                </h3>
                <p className="text-xs text-[#78716C]">
                  Configure your 16-character Google App Password or Resend API key for real member OTP delivery
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadEmailConfig(true)}
              disabled={loadingEmailConfig}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF7F2] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#F2ECE1] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEmailConfig ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Current Gateway Status Banner */}
          {(() => {
            const hasAuthFailure = Boolean(emailConfig?.isConfigured && emailConfig?.connectionOk === false);
            const isHealthy = Boolean(emailConfig?.isConfigured && emailConfig?.connectionOk !== false);
            return (
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                hasAuthFailure
                  ? 'bg-red-50/90 border-red-300 text-red-950'
                  : isHealthy
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-start gap-3">
                  {hasAuthFailure ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  ) : isHealthy ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">
                        {hasAuthFailure
                          ? `Gateway Credentials Rejected (${emailConfig?.activeProvider?.toUpperCase()})`
                          : isHealthy
                          ? `Gateway Active (${emailConfig?.activeProvider?.toUpperCase()})`
                          : 'Email Gateway Not Configured'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        hasAuthFailure
                          ? 'bg-red-200 text-red-900'
                          : isHealthy
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-amber-200/80 text-amber-900'
                      }`}>
                        {hasAuthFailure ? 'Auth Failed' : isHealthy ? 'Live Delivery' : 'Offline'}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-[#44403C]">
                      {hasAuthFailure
                        ? emailConfig?.connectionError || 'Stored credentials were rejected by the mail server.'
                        : isHealthy
                        ? `Dispatches real 6-digit OTP verification emails via ${emailConfig?.senderEmail}.`
                        : 'OTP emails cannot be sent until credentials are saved. Configure your 16-character Google App Password or Resend API key below.'}
                    </p>
                    {emailConfig?.isConfigured && emailConfig.maskedPass && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`font-mono font-semibold bg-white/90 px-2.5 py-0.5 rounded-lg border ${
                          hasAuthFailure ? 'border-red-300 text-red-900' : 'border-emerald-200 text-emerald-900'
                        }`}>
                          Active Key: {emailConfig.maskedPass}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg bg-white/80 border font-medium ${
                          hasAuthFailure ? 'border-red-300 text-red-900' : 'border-emerald-200 text-emerald-800'
                        }`}>
                          {emailConfig.source === 'env'
                            ? 'Source: Environment Secrets (GMAIL_APP_PASS)'
                            : 'Source: Current Container Session DB (Resets on server restart / new deploy)'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {emailConfig?.isConfigured && emailConfig.source === 'db' && (
                  <button
                    type="button"
                    onClick={handleResetEmailConfig}
                    disabled={savingEmailConfig}
                    className="px-3.5 py-1.5 rounded-xl border border-red-300 text-red-700 bg-white hover:bg-red-50 text-xs font-semibold transition-all cursor-pointer shrink-0"
                  >
                    Clear Session Key
                  </button>
                )}
              </div>
            );
          })()}

          {(!emailConfig?.isConfigured || emailConfig?.source !== 'env' || emailConfig?.connectionOk === false) && (
            <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs space-y-1.5">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Why does saving the 16-character App Password work in one session and fail later?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-900">
                Entering your 16-character App Password in the form below saves it only inside this container&apos;s temporary database for the active session.
                Whenever the server restarts, scales, or opens on the Shared URL, that temporary database resets and reverts to the{' '}
                <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono font-bold">GMAIL_APP_PASS</code> value in{' '}
                <strong>AI Studio Secrets</strong>{emailConfig?.source === 'env' && emailConfig?.maskedPass ? ` (currently ${emailConfig.maskedPass})` : ''}.
              </p>
              <p className="text-[11px] leading-relaxed text-blue-900 font-medium">
                To fix it permanently across all future sessions and shared links: update{' '}
                <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono font-bold">GMAIL_USER</code> and{' '}
                <code className="bg-white px-1 py-0.5 rounded border border-blue-200 font-mono font-bold">GMAIL_APP_PASS</code> in{' '}
                AI Studio <strong>Secrets / Environment Variables</strong> with your latest valid 16-character App Password (no spaces).
              </p>
            </div>
          )}

          {/* Provider Selection Tabs */}
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C]">
              Select Email Service Provider
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setEmailProvider('gmail')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  emailProvider === 'gmail'
                    ? 'bg-[#1C1917] text-[#FAF7F2] border-[#D4AF37] shadow-md'
                    : 'bg-[#FAF7F2] text-[#44403C] border-[#E7DDCE] hover:bg-[#F2ECE1]'
                }`}
              >
                <Mail className={`w-5 h-5 shrink-0 ${emailProvider === 'gmail' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
                <div>
                  <div className="font-bold text-xs">Gmail SMTP</div>
                  <div className={`text-[10px] ${emailProvider === 'gmail' ? 'text-[#D4AF37]' : 'text-[#78716C]'}`}>
                    16-char App Password
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEmailProvider('resend')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  emailProvider === 'resend'
                    ? 'bg-[#1C1917] text-[#FAF7F2] border-[#D4AF37] shadow-md'
                    : 'bg-[#FAF7F2] text-[#44403C] border-[#E7DDCE] hover:bg-[#F2ECE1]'
                }`}
              >
                <Zap className={`w-5 h-5 shrink-0 ${emailProvider === 'resend' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
                <div>
                  <div className="font-bold text-xs">Resend API</div>
                  <div className={`text-[10px] ${emailProvider === 'resend' ? 'text-[#D4AF37]' : 'text-[#78716C]'}`}>
                    Cloud HTTPS API Key
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* GMAIL CONFIGURATION */}
          {emailProvider === 'gmail' && (
            <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>How to get your 16-character Google App Password:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-blue-900">
                  <li>
                    Ensure 2-Step Verification is active on your Google Account.
                  </li>
                  <li>
                    Open{' '}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-bold text-blue-700 inline-flex items-center gap-1 hover:text-blue-900"
                    >
                      <span>myaccount.google.com/apppasswords</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Under &quot;App name&quot;, type <strong>JSG Royals</strong> and click <strong>Create</strong>.</li>
                  <li>Copy the 16-letter password shown on your screen (e.g. <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono">abcd efgh ijkl mnop</code>) and paste it below.</li>
                </ol>
                <p className="text-[10px] text-blue-800">
                  Note: Google permanently forbids standard account passwords on SMTP (causing error 535-5.7.8). The 16-character App Password is the only official method.
                </p>
              </div>

              <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                      Your Gmail Address
                    </label>
                    <input
                      type="email"
                      required
                      value={gmailUser}
                      onChange={(e) => setGmailUser(e.target.value)}
                      placeholder="e.g. admin@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                      16-Character Google App Password
                    </label>
                    <input
                      type="password"
                      required
                      value={gmailAppPass}
                      onChange={(e) => setGmailAppPass(e.target.value)}
                      placeholder="•••• •••• •••• ••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingEmailConfig || !gmailAppPass.trim()}
                  className="py-3 px-6 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingEmailConfig ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                      <span>Authenticating with Gmail SMTP...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Verify &amp; Save Gmail Gateway</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* RESEND CONFIGURATION */}
          {emailProvider === 'resend' && (
            <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-900">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Resend (100 Free Emails / Day with Instant Cloud Delivery):</span>
                </div>
                <p className="text-[11px] leading-relaxed text-purple-900">
                  Resend operates over HTTPS port 443, ensuring 100% instantaneous delivery without any SMTP security blocks.
                  Get your free API key at{' '}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-bold text-purple-700 inline-flex items-center gap-1 hover:text-purple-900"
                  >
                    <span>resend.com/api-keys</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <form onSubmit={handleSaveEmailConfig} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                    Resend API Key
                  </label>
                  <input
                    type="password"
                    required
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    placeholder="re_123456789abcdef..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingEmailConfig || !resendApiKey.trim()}
                  className="py-3 px-6 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {savingEmailConfig ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                      <span>Verifying Resend API Key...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Verify &amp; Save Resend Gateway</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Feedback messages */}
          {emailSaveError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-bold">Gateway Connection Failed</p>
                <p className="mt-0.5">{emailSaveError}</p>
              </div>
            </div>
          )}

          {emailSaveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{emailSaveSuccess}</span>
            </div>
          )}

          {/* LIVE TEST EMAIL DISPATCH SECTION */}
          <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-[#8C6D2B]" />
              <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                Live Email Dispatch Test
              </h4>
            </div>
            <p className="text-xs text-[#78716C]">
              Send a live royal verification code directly to your inbox to confirm real delivery.
            </p>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  required
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Recipient email address"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>

              <button
                type="submit"
                disabled={testingEmail || !emailConfig?.isConfigured || !testEmailAddress.includes('@')}
                className="py-2.5 px-5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {testingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                    <span>Dispatching Test Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Send Live Test OTP Email</span>
                  </>
                )}
              </button>
            </form>

            {testEmailError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{testEmailError}</span>
              </div>
            )}

            {testEmailResult && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{testEmailResult}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEMBER DETAILS DOSSIER MODAL */}
      {selectedCoupleId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setSelectedCoupleId(null);
                setMemberDetail(null);
              }}
              className="absolute top-5 right-5 text-[#78716C] hover:text-[#1C1917] p-2 rounded-full hover:bg-[#F5EFE6] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetail || !memberDetail ? (
              <div className="py-16 text-center text-[#78716C] text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8C6D2B]" />
                Retrieving confidential couple dossier...
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                
                {/* Dossier Header */}
                <div className="border-b border-[#F0E8DC] pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-base font-bold bg-[#EFE6D5] text-[#8C6D2B] px-3 py-1 rounded-lg">
                      {memberDetail.member.couple_id}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-stone-100 text-[#44403C] text-[10px] font-bold uppercase tracking-wider border border-stone-200">
                      🔒 Protected Master Record
                    </span>
                  </div>

                  <h2 className="font-serif-royal text-2xl font-bold text-[#1C1917] mt-2">
                    {memberDetail.member.husband_name} & {memberDetail.member.wife_name}
                  </h2>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {memberDetail.submission ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                        Chapter-2 Submitted ✓ ({new Date(memberDetail.submission.submitted_at).toLocaleDateString()})
                      </span>
                    ) : memberDetail.verifications && memberDetail.verifications.length > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                        Verified • Draft In Progress
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                        Not Yet Verified
                      </span>
                    )}

                    {memberDetail.corrections && memberDetail.corrections.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
                        {memberDetail.corrections.length} Correction Request(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Family Photo Preview (Private Storage streamed via Admin Token) */}
                {memberDetail.year2Profile?.photo_id && (
                  <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E7DDCE]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#8C6D2B] uppercase tracking-wider flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5" />
                        Chapter-2 Family / Couple Photograph
                      </span>
                      <span className="text-[10px] text-[#78716C]">
                        Photo ID: {memberDetail.year2Profile.photo_id}
                      </span>
                    </div>
                    <img
                      src={`/api/member/photo/${memberDetail.year2Profile.photo_id}?token=${adminToken}`}
                      alt="Couple"
                      className="max-h-64 object-cover rounded-xl border border-[#DFCFAE] shadow-xs"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Protected Year-1 Master Record vs Year-2 Updates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Year 1 Master Record */}
                  <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E9DFCE] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#E0D5C3] pb-1.5">
                      <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider">
                        Year-1 Master Record
                      </span>
                      <span className="text-[10px] text-[#A8A29E] font-mono">Immutable</span>
                    </div>
                    <p><strong>🔒 Couple ID:</strong> {memberDetail.member.couple_id}</p>
                    <p><strong>🔒 Husband Name:</strong> {memberDetail.member.husband_name}</p>
                    <p><strong>🔒 Wife Name:</strong> {memberDetail.member.wife_name}</p>
                    <p><strong>🔒 Husband Mobile:</strong> {memberDetail.member.husband_registered_mobile}</p>
                    <p><strong>🔒 Wife Mobile:</strong> {memberDetail.member.wife_registered_mobile || '—'}</p>
                    <p><strong>🔒 Marriage Anniversary:</strong> {memberDetail.member.marriage_anniversary || '—'}</p>
                    <p><strong>🔒 Husband DOB:</strong> {memberDetail.member.husband_dob || '—'}</p>
                    <p><strong>🔒 Wife DOB:</strong> {memberDetail.member.wife_dob || '—'}</p>
                    <p><strong>City:</strong> {memberDetail.member.year1_city || 'Indore'}</p>
                    <p><strong>Children:</strong> {memberDetail.member.children_info || '—'}</p>
                    <p><strong>Business:</strong> {memberDetail.member.year1_business || '—'}</p>
                  </div>

                  {/* Chapter 2 Updates */}
                  <div className="p-4 bg-[#F5EFE6] rounded-2xl border border-[#DFCFAE] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#DFCFAE] pb-1.5">
                      <span className="text-[11px] font-bold text-[#8C6D2B] uppercase tracking-wider">
                        Chapter-2 Member Updates
                      </span>
                      <span className="text-[10px] text-[#8C6D2B] font-semibold">
                        {memberDetail.submission ? 'Submitted' : 'Draft'}
                      </span>
                    </div>
                    <p><strong>Updated City:</strong> {memberDetail.year2Profile?.city || memberDetail.year2Profile?.current_city || 'No update'}</p>
                    <p><strong>Residential Address:</strong> {memberDetail.year2Profile?.residential_address || '—'}</p>
                    <p><strong>Professional Update:</strong> {memberDetail.year2Profile?.occupation_status || memberDetail.year2Profile?.occupation_business_update || '—'}</p>
                    <p><strong>Firm / Business:</strong> {memberDetail.year2Profile?.organization_update || memberDetail.year2Profile?.organization_firm_name || '—'}</p>
                    <p><strong>Family Notes:</strong> {memberDetail.year2Profile?.family_status || memberDetail.year2Profile?.family_children_updates || '—'}</p>
                  </div>
                </div>

                {/* Chapter 2 Preferences & Vision */}
                {memberDetail.year2Preferences && (
                  <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E7DDCE] space-y-3">
                    <span className="text-[11px] font-bold text-[#8C6D2B] uppercase tracking-wider block">
                      Chapter-2 Wishlist & Royals Vision
                    </span>
                    <div>
                      <strong className="block text-[11px] text-[#78716C] mb-1">Wishlist Interests:</strong>
                      <div className="flex flex-wrap gap-1">
                        {memberDetail.year2Preferences.wishlist?.map((w) => (
                          <span key={w} className="px-2 py-0.5 rounded-full bg-[#EFE6D5] text-[#8C6D2B] text-[10px]">
                            {w}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong className="block text-[11px] text-[#78716C] mb-1">Contribution Areas:</strong>
                      <div className="flex flex-wrap gap-1">
                        {memberDetail.year2Preferences.contribution_areas?.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded-full bg-[#8C6D2B] text-white text-[10px]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    {memberDetail.year2Preferences.royal_idea && (
                      <div>
                        <strong className="block text-[11px] text-[#78716C]">Royal Idea for 2027:</strong>
                        <p className="italic bg-white p-2.5 rounded-lg border border-[#EDE3D3] mt-1 text-[#44403C]">
                          &ldquo;{memberDetail.year2Preferences.royal_idea}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PRIVATE INTERNAL ADMIN NOTES */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-300 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                    <div>
                      <span className="text-[11px] font-bold text-stone-900 uppercase tracking-wider block">
                        Internal Admin Notes (Private Committee Only)
                      </span>
                      <span className="text-[10px] text-stone-500">
                        Strictly confidential to administrators. Never returned to members.
                      </span>
                    </div>
                    <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-mono">
                      {memberDetail.notes?.length || 0} Notes
                    </span>
                  </div>

                  {/* List of existing notes */}
                  {memberDetail.notes && memberDetail.notes.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {memberDetail.notes.map((note) => (
                        <div key={note.id} className="p-2.5 bg-white rounded-xl border border-stone-200 text-[11px]">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
                            <strong>{note.admin_email}</strong>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-stone-800">{note.note}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-500 italic">
                      No internal notes recorded for this couple yet.
                    </p>
                  )}

                  {/* Form to add new note */}
                  <form onSubmit={handleAddAdminNote} className="pt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add an internal note (e.g. Verified via WhatsApp; sent Chapter 2 kit)..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs text-stone-900 outline-hidden focus:ring-2 focus:ring-[#8C6D2B]"
                    />
                    <button
                      type="submit"
                      disabled={addingNote || !newNoteText.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#2A2623] text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      {addingNote ? 'Saving...' : 'Add Note'}
                    </button>
                  </form>
                </div>

                {/* Security Audit Timeline */}
                <div className="pt-2 border-t border-[#F0E8DC]">
                  <span className="text-[11px] text-[#78716C] font-semibold block mb-1">
                    Security Verification & Submission History:
                  </span>
                  <div className="text-[10px] text-[#78716C] space-y-1">
                    {memberDetail.verifications && memberDetail.verifications.length > 0 ? (
                      memberDetail.verifications.map((v, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>
                            Verified via {v.verification_method || 'OTP'} on {new Date(v.verified_at).toLocaleString()} (Mobile: {v.verified_mobile})
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[#A8A29E]">No verification record logged.</div>
                    )}
                    {memberDetail.submission && (
                      <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                        <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>
                          Final Chapter-2 submission recorded on {new Date(memberDetail.submission.submitted_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Member Modal Footer with Remove from DB */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[#F0E8DC]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget({ kind: 'member', member: memberDetail.member });
                    }}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Entry from DB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCoupleId(null);
                      setMemberDetail(null);
                    }}
                    className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] transition-colors cursor-pointer"
                  >
                    Close Dossier
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FRESH FAMILY DOSSIER INSPECTION MODAL                                     */}
      {/* ========================================================================= */}
      {viewingFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#FFFFFF] border-2 border-[#D4AF37] rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-5 p-4 sm:p-8 animate-in zoom-in-95 relative">
            
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#F0E8DC]">
              <div className="flex items-center gap-3">
                <RoyalLogo className="w-12 h-12 rounded-2xl border border-[#C5A869]/70 shadow-xs p-0.5" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-serif-royal font-bold text-xl text-[#1C1917]">
                      {viewingFamilyModal.husband_name} &amp; {viewingFamilyModal.wife_name}
                    </h3>
                    <span className="font-mono text-xs font-bold text-[#8C6D2B] bg-[#FAF7F2] border border-[#E2D5BE] px-2.5 py-0.5 rounded">
                      {viewingFamilyModal.reg_id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      viewingFamilyModal.membership_type === 'new'
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {viewingFamilyModal.membership_type === 'new'
                        ? 'New Application • Pending Review'
                        : 'Existing Renewal'}
                    </span>
                  </div>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    Submitted by <strong className="capitalize">{viewingFamilyModal.submitted_by_role}</strong> ({viewingFamilyModal.submitter_email}) on {new Date(viewingFamilyModal.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-[#F0E8DC] text-[#1C1917] border border-[#E7DDCE] transition-all cursor-pointer"
                  title="Print Dossier"
                >
                  <Printer className="w-4 h-4 text-[#8C6D2B]" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewingFamilyModal(null)}
                  className="p-2 rounded-xl bg-[#FAF7F2] hover:bg-rose-50 text-[#78716C] hover:text-rose-700 border border-[#E7DDCE] transition-all cursor-pointer"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Husband & Wife Profiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Husband */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-[#E2D5BE] pb-2">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] text-[11px]">
                    🤵 Royal Gentleman
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-900">
                    Husband
                  </span>
                </div>
                <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                  {viewingFamilyModal.husband_name}
                </div>
                <div className="space-y-1.5 text-[#57534E]">
                  <div>📱 Mobile: <strong className="font-mono text-[#1C1917]">{viewingFamilyModal.husband_mobile}</strong></div>
                  <div>✉️ Email: <span className="text-[#1C1917]">{viewingFamilyModal.husband_email}</span></div>
                  {viewingFamilyModal.husband_dob && <div>🎂 DOB: <span className="text-[#1C1917]">{viewingFamilyModal.husband_dob}</span></div>}
                  {viewingFamilyModal.husband_qualification && <div>🎓 Education: <span className="text-[#1C1917]">{viewingFamilyModal.husband_qualification}</span></div>}
                  {viewingFamilyModal.husband_occupation && <div>💼 Profession: <span className="text-[#1C1917]">{viewingFamilyModal.husband_occupation}</span></div>}
                  {viewingFamilyModal.husband_organization && <div>🏢 Organization: <span className="text-[#1C1917]">{viewingFamilyModal.husband_organization}</span></div>}
                  {viewingFamilyModal.husband_blood_group && <div>🩸 Blood Group: <strong className="text-rose-700">{viewingFamilyModal.husband_blood_group}</strong></div>}
                  {viewingFamilyModal.husband_instagram && <div>📷 Instagram: <span className="text-[#1C1917] font-medium">{viewingFamilyModal.husband_instagram}</span></div>}
                  {viewingFamilyModal.husband_photo_url && (
                    <div className="pt-2 border-t border-[#E2D5BE] space-y-2">
                      <span className="text-[10px] font-bold uppercase text-[#8C6D2B] block">Husband Photo / Drive URL</span>
                      <div className="flex items-center gap-3">
                        {getDisplayImageSrc(viewingFamilyModal.husband_photo_url) && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal({
                              title: `Husband Photo — ${viewingFamilyModal.husband_name}`,
                              url: viewingFamilyModal.husband_photo_url,
                              downloadName: `${viewingFamilyModal.reg_id}_husband.jpg`
                            })}
                            className="cursor-pointer shrink-0"
                          >
                            <CloudAwareImage
                              url={viewingFamilyModal.husband_photo_url}
                              alt={viewingFamilyModal.husband_name}
                              className="w-20 h-20 rounded-xl object-cover border border-[#D9CDB8] hover:scale-105 transition-transform"
                            />
                          </button>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal({
                              title: `Husband Photo — ${viewingFamilyModal.husband_name}`,
                              url: viewingFamilyModal.husband_photo_url,
                              downloadName: `${viewingFamilyModal.reg_id}_husband.jpg`
                            })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-[11px] font-semibold cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Full</span>
                          </button>
                          {!isExternalCloudUrl(viewingFamilyModal.husband_photo_url) ? (
                            <button
                              type="button"
                              onClick={() => downloadMediaImage(viewingFamilyModal.husband_photo_url, `${viewingFamilyModal.reg_id}_husband.jpg`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1C1917] text-[#D4AF37] text-[11px] font-semibold cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          ) : (
                            <a
                              href={resolveFullMediaUrl(viewingFamilyModal.husband_photo_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open Drive</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-[#78716C] break-all">
                        {resolveFullMediaUrl(viewingFamilyModal.husband_photo_url)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Wife */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-[#E2D5BE] pb-2">
                  <span className="font-bold uppercase tracking-wider text-rose-800 text-[11px]">
                    👰 Royal Lady
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-900">
                    Wife
                  </span>
                </div>
                <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                  {viewingFamilyModal.wife_name}
                </div>
                <div className="space-y-1.5 text-[#57534E]">
                  <div>📱 Mobile: <strong className="font-mono text-[#1C1917]">{viewingFamilyModal.wife_mobile}</strong></div>
                  <div>✉️ Email: <span className="text-[#1C1917]">{viewingFamilyModal.wife_email}</span></div>
                  {viewingFamilyModal.wife_dob && <div>🎂 DOB: <span className="text-[#1C1917]">{viewingFamilyModal.wife_dob}</span></div>}
                  {viewingFamilyModal.wife_qualification && <div>🎓 Education: <span className="text-[#1C1917]">{viewingFamilyModal.wife_qualification}</span></div>}
                  {viewingFamilyModal.wife_occupation && <div>💼 Profession: <span className="text-[#1C1917]">{viewingFamilyModal.wife_occupation}</span></div>}
                  {viewingFamilyModal.wife_organization && <div>🏢 Organization: <span className="text-[#1C1917]">{viewingFamilyModal.wife_organization}</span></div>}
                  {viewingFamilyModal.wife_blood_group && <div>🩸 Blood Group: <strong className="text-rose-700">{viewingFamilyModal.wife_blood_group}</strong></div>}
                  {viewingFamilyModal.wife_instagram && <div>📷 Instagram: <span className="text-[#1C1917] font-medium">{viewingFamilyModal.wife_instagram}</span></div>}
                  {viewingFamilyModal.wife_photo_url && (
                    <div className="pt-2 border-t border-[#E2D5BE] space-y-2">
                      <span className="text-[10px] font-bold uppercase text-rose-800 block">Wife Photo / Drive URL</span>
                      <div className="flex items-center gap-3">
                        {getDisplayImageSrc(viewingFamilyModal.wife_photo_url) && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal({
                              title: `Wife Photo — ${viewingFamilyModal.wife_name}`,
                              url: viewingFamilyModal.wife_photo_url,
                              downloadName: `${viewingFamilyModal.reg_id}_wife.jpg`
                            })}
                            className="cursor-pointer shrink-0"
                          >
                            <CloudAwareImage
                              url={viewingFamilyModal.wife_photo_url}
                              alt={viewingFamilyModal.wife_name}
                              className="w-20 h-20 rounded-xl object-cover border border-[#D9CDB8] hover:scale-105 transition-transform"
                            />
                          </button>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal({
                              title: `Wife Photo — ${viewingFamilyModal.wife_name}`,
                              url: viewingFamilyModal.wife_photo_url,
                              downloadName: `${viewingFamilyModal.reg_id}_wife.jpg`
                            })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-[11px] font-semibold cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Full</span>
                          </button>
                          {!isExternalCloudUrl(viewingFamilyModal.wife_photo_url) ? (
                            <button
                              type="button"
                              onClick={() => downloadMediaImage(viewingFamilyModal.wife_photo_url, `${viewingFamilyModal.reg_id}_wife.jpg`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1C1917] text-[#D4AF37] text-[11px] font-semibold cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          ) : (
                            <a
                              href={resolveFullMediaUrl(viewingFamilyModal.wife_photo_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-semibold"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Open Drive</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] font-mono text-[#78716C] break-all">
                        {resolveFullMediaUrl(viewingFamilyModal.wife_photo_url)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Couple Photo Section */}
            {viewingFamilyModal.couple_photo_url && (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-2.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                  💑 Couple Photo / Drive URL
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {getDisplayImageSrc(viewingFamilyModal.couple_photo_url) && (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoModal({
                        title: `Couple Photo — ${viewingFamilyModal.husband_name} & ${viewingFamilyModal.wife_name}`,
                        url: viewingFamilyModal.couple_photo_url,
                        downloadName: `${viewingFamilyModal.reg_id}_couple.jpg`
                      })}
                      className="cursor-pointer text-left"
                    >
                      <CloudAwareImage
                        url={viewingFamilyModal.couple_photo_url}
                        alt="Couple Photo"
                        className="max-h-52 rounded-xl object-contain border border-[#D9CDB8] hover:opacity-95 transition-opacity"
                      />
                    </button>
                  )}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoModal({
                          title: `Couple Photo — ${viewingFamilyModal.husband_name} & ${viewingFamilyModal.wife_name}`,
                          url: viewingFamilyModal.couple_photo_url,
                          downloadName: `${viewingFamilyModal.reg_id}_couple.jpg`
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Full Size</span>
                      </button>
                      {!isExternalCloudUrl(viewingFamilyModal.couple_photo_url) ? (
                        <button
                          type="button"
                          onClick={() => downloadMediaImage(viewingFamilyModal.couple_photo_url, `${viewingFamilyModal.reg_id}_couple.jpg`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1917] text-[#D4AF37] text-xs font-semibold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      ) : (
                        <a
                          href={resolveFullMediaUrl(viewingFamilyModal.couple_photo_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Drive Link</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#78716C] break-all">
                      {resolveFullMediaUrl(viewingFamilyModal.couple_photo_url)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Family Portrait Section */}
            {viewingFamilyModal.family_photo_url && (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-2.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                  📸 Royal Family Portrait / Drive URL
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {getDisplayImageSrc(viewingFamilyModal.family_photo_url) && (
                    <button
                      type="button"
                      onClick={() => setPreviewPhotoModal({
                        title: `Family Portrait — ${viewingFamilyModal.husband_name} & ${viewingFamilyModal.wife_name}`,
                        url: viewingFamilyModal.family_photo_url,
                        downloadName: `${viewingFamilyModal.reg_id}_family.jpg`
                      })}
                      className="cursor-pointer text-left"
                    >
                      <CloudAwareImage
                        url={viewingFamilyModal.family_photo_url}
                        alt="Royal Family Portrait"
                        className="max-h-52 rounded-xl object-contain border border-[#D9CDB8] hover:opacity-95 transition-opacity"
                      />
                    </button>
                  )}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoModal({
                          title: `Family Portrait — ${viewingFamilyModal.husband_name} & ${viewingFamilyModal.wife_name}`,
                          url: viewingFamilyModal.family_photo_url,
                          downloadName: `${viewingFamilyModal.reg_id}_family.jpg`
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Full Size</span>
                      </button>
                      {!isExternalCloudUrl(viewingFamilyModal.family_photo_url) ? (
                        <button
                          type="button"
                          onClick={() => downloadMediaImage(viewingFamilyModal.family_photo_url, `${viewingFamilyModal.reg_id}_family.jpg`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1C1917] text-[#D4AF37] text-xs font-semibold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      ) : (
                        <a
                          href={resolveFullMediaUrl(viewingFamilyModal.family_photo_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Drive Link</span>
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#78716C] break-all">
                      {resolveFullMediaUrl(viewingFamilyModal.family_photo_url)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Marriage & Residence */}
            <div className="p-4 rounded-2xl bg-white border border-[#E7DDCE] space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
                Household &amp; Matrimonial Info
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[#57534E]">
                <div>💍 Marriage Anniversary: <strong className="text-[#1C1917]">{viewingFamilyModal.marriage_anniversary}</strong></div>
                <div>📍 Current City: <strong className="text-[#1C1917]">{viewingFamilyModal.current_city}</strong></div>
                <div className="sm:col-span-2">🏠 Residential Address: <span className="text-[#1C1917]">{viewingFamilyModal.residential_address}</span></div>
                {viewingFamilyModal.native_place && (
                  <div className="sm:col-span-2">🏛️ Native Place / Origin: <span className="text-[#1C1917]">{viewingFamilyModal.native_place}</span></div>
                )}
              </div>
            </div>

            {/* Children Section */}
            <div className="p-4 rounded-2xl bg-white border border-[#E7DDCE] space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
                Children ({viewingFamilyModal.children ? viewingFamilyModal.children.length : 0})
              </span>
              {viewingFamilyModal.children && viewingFamilyModal.children.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingFamilyModal.children.map((child: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#1C1917]">{child.name}</strong>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-[#E2D5BE] text-[#8C6D2B]">
                          {child.gender}
                        </span>
                      </div>
                      {child.dob && <div className="text-[11px] text-[#78716C]">DOB: {child.dob}</div>}
                      {child.education && <div className="text-[11px] text-[#78716C]">Education: {child.education}</div>}
                      {child.interests && <div className="text-[11px] text-[#78716C]">Hobbies: {child.interests}</div>}
                      {child.photo_url && (
                        <div className="pt-1.5 border-t border-[#E2D5BE] space-y-1.5">
                          <div className="flex items-center gap-2.5">
                            {getDisplayImageSrc(child.photo_url) && (
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoModal({
                                  title: `Child Photo — ${child.name}`,
                                  url: child.photo_url,
                                  downloadName: `${viewingFamilyModal.reg_id}_child_${idx + 1}.jpg`
                                })}
                                className="cursor-pointer shrink-0"
                              >
                                <CloudAwareImage
                                  url={child.photo_url}
                                  alt={child.name}
                                  className="w-16 h-16 rounded-lg object-cover border border-[#D9CDB8]"
                                />
                              </button>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoModal({
                                  title: `Child Photo — ${child.name}`,
                                  url: child.photo_url,
                                  downloadName: `${viewingFamilyModal.reg_id}_child_${idx + 1}.jpg`
                                })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-[10px] font-semibold cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View</span>
                              </button>
                              {!isExternalCloudUrl(child.photo_url) ? (
                                <button
                                  type="button"
                                  onClick={() => downloadMediaImage(child.photo_url, `${viewingFamilyModal.reg_id}_child_${idx + 1}.jpg`)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1C1917] text-[#D4AF37] text-[10px] font-semibold cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </button>
                              ) : (
                                <a
                                  href={resolveFullMediaUrl(child.photo_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-semibold"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open Drive</span>
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] font-mono text-[#78716C] break-all">
                            {resolveFullMediaUrl(child.photo_url)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#A8A29E] italic">No children listed in this household registration.</p>
              )}
            </div>

            {/* Existing Member Experience Feedback (Q1-Q4) */}
            {(viewingFamilyModal.exp_rating !== null && viewingFamilyModal.exp_rating !== undefined ||
              viewingFamilyModal.exp_favourite_event ||
              viewingFamilyModal.exp_international_trip ||
              viewingFamilyModal.exp_missing) && (
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7DDCE] space-y-2.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                  JSG Royals – Experience Feedback
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-[#E2D5BE]">
                    <span className="text-[10px] text-[#78716C] block">Q1. Overall Experience Rating (1–10)</span>
                    <strong className="text-[#1C1917] text-sm">
                      {viewingFamilyModal.exp_rating !== null && viewingFamilyModal.exp_rating !== undefined
                        ? `${viewingFamilyModal.exp_rating} / 10`
                        : '—'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-[#E2D5BE]">
                    <span className="text-[10px] text-[#78716C] block">Q3. International / Domestic Trip &amp; Months</span>
                    <strong className="text-[#1C1917] block whitespace-pre-wrap">
                      {viewingFamilyModal.exp_international_trip === 'Yes' && viewingFamilyModal.exp_trip_month_destination
                        ? `Yes — ${viewingFamilyModal.exp_trip_month_destination}`
                        : viewingFamilyModal.exp_international_trip || viewingFamilyModal.exp_trip_month_destination || '—'}
                    </strong>
                  </div>
                </div>
                {viewingFamilyModal.exp_favourite_event && (
                  <div className="p-3 rounded-xl bg-white border border-[#E2D5BE]">
                    <span className="text-[10px] text-[#78716C] block mb-0.5">Q2. Absolute Favourite Event / Experience</span>
                    <p className="text-[#1C1917] whitespace-pre-wrap">{viewingFamilyModal.exp_favourite_event}</p>
                  </div>
                )}
                {viewingFamilyModal.exp_missing && (
                  <div className="p-3 rounded-xl bg-white border border-[#E2D5BE]">
                    <span className="text-[10px] text-[#78716C] block mb-0.5">Q4. Ideas &amp; Wishes for Upcoming Tenure</span>
                    <p className="text-[#1C1917] whitespace-pre-wrap">{viewingFamilyModal.exp_missing}</p>
                  </div>
                )}
              </div>
            )}

            {/* Vision & Contributions */}
            {(viewingFamilyModal.contribution_areas || viewingFamilyModal.royal_idea || viewingFamilyModal.jsg_should_be_known_for) && (
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E7DDCE] space-y-2.5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                  Contributions &amp; Chapter 2 Vision
                </span>
                {viewingFamilyModal.contribution_areas && (
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Contribution Areas:</span>
                    <strong className="text-[#1C1917]">{viewingFamilyModal.contribution_areas}</strong>
                  </div>
                )}
                {viewingFamilyModal.royal_idea && (
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Royal Chapter 2 Idea:</span>
                    <p className="italic bg-white p-2.5 rounded-xl border border-[#E2D5BE] mt-0.5 text-[#1C1917]">
                      &ldquo;{viewingFamilyModal.royal_idea}&rdquo;
                    </p>
                  </div>
                )}
                {viewingFamilyModal.jsg_should_be_known_for && (
                  <div>
                    <span className="text-[10px] text-[#78716C] block">JSG Should Be Known For:</span>
                    <p className="italic bg-white p-2.5 rounded-xl border border-[#E2D5BE] mt-0.5 text-[#1C1917]">
                      &ldquo;{viewingFamilyModal.jsg_should_be_known_for}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* President & Secretary Details */}
            {(viewingFamilyModal.president_name || viewingFamilyModal.secretary_name) && (
              <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                  President &amp; Secretary Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[#57534E]">
                  <div>
                    <span className="text-[10px] text-[#78716C] block">President</span>
                    <strong className="text-[#1C1917]">{viewingFamilyModal.president_name || '—'}</strong>
                    {viewingFamilyModal.president_mobile && (
                      <div className="font-mono text-[11px] text-[#57534E]">{viewingFamilyModal.president_mobile}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-[#78716C] block">Secretary</span>
                    <strong className="text-[#1C1917]">{viewingFamilyModal.secretary_name || '—'}</strong>
                    {viewingFamilyModal.secretary_mobile && (
                      <div className="font-mono text-[11px] text-[#57534E]">{viewingFamilyModal.secretary_mobile}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* New Member Application Details */}
            {(viewingFamilyModal.membership_type === 'new' ||
              viewingFamilyModal.other_group_member ||
              viewingFamilyModal.reference_name ||
              viewingFamilyModal.business_description ||
              viewingFamilyModal.new_member_contribution) && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                  New Member Application Questions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-amber-200/70 space-y-1">
                    <span className="text-[10px] text-[#78716C] block">Part of Another Group?</span>
                    <strong className="text-[#1C1917] block">
                      {viewingFamilyModal.other_group_member === 'Yes'
                        ? `Yes — ${viewingFamilyModal.other_group_name || 'Not specified'}`
                        : viewingFamilyModal.other_group_member || 'No'}
                    </strong>
                    {viewingFamilyModal.other_group_member === 'Yes' && viewingFamilyModal.other_group_position && (
                      <div className="text-[11px] text-[#57534E] pt-0.5">
                        Position Held: <strong className="text-[#1C1917]">{viewingFamilyModal.other_group_position}</strong>
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-amber-200/70">
                    <span className="text-[10px] text-[#78716C] block">Referring Member</span>
                    <strong className="text-[#1C1917] block">{viewingFamilyModal.reference_name || '—'}</strong>
                    {viewingFamilyModal.reference_mobile && (
                      <span className="font-mono text-[11px] text-[#57534E]">{viewingFamilyModal.reference_mobile}</span>
                    )}
                  </div>
                </div>
                {viewingFamilyModal.business_description && (
                  <div className="p-3 rounded-xl bg-white border border-amber-200/70">
                    <span className="text-[10px] text-[#78716C] block mb-0.5">Business/Job</span>
                    <p className="text-[#1C1917] whitespace-pre-wrap leading-relaxed">
                      {viewingFamilyModal.business_description}
                    </p>
                  </div>
                )}
                {viewingFamilyModal.new_member_contribution && (
                  <div className="p-3 rounded-xl bg-white border border-amber-200/70">
                    <span className="text-[10px] text-[#78716C] block mb-0.5">How Applicant Can Contribute to the Group</span>
                    <p className="text-[#1C1917] whitespace-pre-wrap leading-relaxed">
                      {viewingFamilyModal.new_member_contribution}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[#F0E8DC]">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget({ kind: 'family', reg: viewingFamilyModal });
                }}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Entry from DB</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingFamilyModal(null)}
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] transition-colors cursor-pointer"
              >
                Close Dossier
              </button>
            </div>

          </div>
        </div>
      )}

      {/* New Member Application Detail Modal */}
      {viewingNewAppModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E7DDCE] rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-8 shadow-2xl space-y-5 my-4 sm:my-8">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#F0E8DC]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
                  New Member Application • Pending Review
                </span>
                <h3 className="font-serif-royal font-bold text-xl text-[#1C1917] mt-0.5">
                  {viewingNewAppModal.applicant_name}
                </h3>
                <p className="text-xs text-[#78716C] font-mono mt-0.5">
                  {viewingNewAppModal.app_id} • {new Date(viewingNewAppModal.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingNewAppModal(null)}
                className="p-2 rounded-xl bg-[#FAF7F2] text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">Business Name</span>
                <strong className="text-[#1C1917]">{viewingNewAppModal.business_name}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">Contact</span>
                <strong className="text-[#1C1917] font-mono block">{viewingNewAppModal.mobile_number}</strong>
                <span className="text-[#57534E]">{viewingNewAppModal.email}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">Other Group Membership</span>
                <strong className="text-[#1C1917] block">
                  {viewingNewAppModal.other_group_member === 'Yes'
                    ? `Yes — ${viewingNewAppModal.other_group_name}`
                    : 'No'}
                </strong>
                {viewingNewAppModal.other_group_member === 'Yes' && viewingNewAppModal.other_group_position && (
                  <div className="text-[11px] text-[#57534E] pt-0.5">
                    Position Held: <strong className="text-[#1C1917]">{viewingNewAppModal.other_group_position}</strong>
                  </div>
                )}
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">Referring Member</span>
                <strong className="text-[#1C1917] block">{viewingNewAppModal.reference_name}</strong>
                <span className="font-mono text-[#57534E]">{viewingNewAppModal.reference_mobile}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">President</span>
                <strong className="text-[#1C1917] block">{viewingNewAppModal.president_name}</strong>
                <span className="font-mono text-[#57534E]">{viewingNewAppModal.president_mobile}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE]">
                <span className="text-[10px] uppercase font-bold text-[#78716C] block">Secretary</span>
                <strong className="text-[#1C1917] block">{viewingNewAppModal.secretary_name}</strong>
                <span className="font-mono text-[#57534E]">{viewingNewAppModal.secretary_mobile}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E7DDCE] space-y-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#8C6D2B] block">Business/Job</span>
              <p className="text-[#1C1917] leading-relaxed">{viewingNewAppModal.business_description}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E7DDCE] space-y-2 text-xs">
              <span className="text-[10px] uppercase font-bold text-[#8C6D2B] block">How Applicant Can Contribute</span>
              <p className="text-[#1C1917] leading-relaxed">{viewingNewAppModal.contribution}</p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[#F0E8DC]">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget({ kind: 'application', app: viewingNewAppModal });
                }}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Entry from DB</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingNewAppModal(null)}
                className="min-h-[42px] px-5 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] transition-colors cursor-pointer"
              >
                Close Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent DB Entry Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border-2 border-red-200 rounded-2xl sm:rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-700 block">
                  Permanent Database Removal
                </span>
                <h3 className="font-serif-royal font-bold text-lg text-[#1C1917] mt-0.5">
                  Remove Entry from DB?
                </h3>
              </div>
              <button
                type="button"
                disabled={deletingEntry}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-[#78716C] hover:bg-[#FAF7F2] hover:text-[#1C1917] disabled:opacity-40 cursor-pointer"
                aria-label="Cancel removal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs space-y-1">
              {deleteTarget.kind === 'family' && (
                <>
                  <div className="font-mono font-bold text-[#8C6D2B]">{deleteTarget.reg.reg_id}</div>
                  <div className="font-bold text-[#1C1917]">
                    {deleteTarget.reg.husband_name} &amp; {deleteTarget.reg.wife_name}
                  </div>
                  <div className="text-[11px] text-[#78716C] break-all">{deleteTarget.reg.submitter_email}</div>
                </>
              )}
              {deleteTarget.kind === 'application' && (
                <>
                  <div className="font-mono font-bold text-[#8C6D2B]">{deleteTarget.app.app_id}</div>
                  <div className="font-bold text-[#1C1917]">{deleteTarget.app.applicant_name}</div>
                  <div className="text-[11px] text-[#78716C] break-all">
                    {deleteTarget.app.business_name} • {deleteTarget.app.email}
                  </div>
                </>
              )}
              {deleteTarget.kind === 'member' && (
                <>
                  <div className="font-mono font-bold text-[#8C6D2B]">{deleteTarget.member.couple_id}</div>
                  <div className="font-bold text-[#1C1917]">
                    {deleteTarget.member.husband_name} &amp; {deleteTarget.member.wife_name}
                  </div>
                  <div className="text-[11px] text-[#78716C]">
                    Includes Year-2 profile, preferences, submissions &amp; notes
                  </div>
                </>
              )}
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">
              This will permanently erase the record
              {deleteTarget.kind !== 'member' ? ', linked application data, and uploaded photos' : ' and all associated records'} from{' '}
              <strong>{isFirebaseAdmin ? 'both Cloud Firestore and the server SQLite database' : 'the server SQLite database'}</strong>.
              This action cannot be undone.
            </p>

            {!isFirebaseAdmin && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-snug space-y-2.5">
                <div>
                  <strong>Cloud Archive Disconnected:</strong> Connect with{' '}
                  <span className="font-mono break-all">{AUTHORIZED_ADMIN_EMAIL}</span> so deletions also remove records synced in Cloud Firestore.
                </div>
                <button
                  type="button"
                  disabled={googleLoginLoading || deletingEntry}
                  onClick={async () => {
                    await handleGoogleAdminLogin(true);
                    setDeleteError(null);
                  }}
                  className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#D4AF37] font-semibold text-xs border border-[#C5A869] disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{googleLoginLoading ? 'Connecting...' : 'Connect Google Cloud Archive'}</span>
                </button>
              </div>
            )}

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="break-words">{deleteError}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-[#F0E8DC]">
              <button
                type="button"
                disabled={deletingEntry}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="min-h-[42px] px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingEntry}
                onClick={handleConfirmDelete}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm disabled:opacity-50 cursor-pointer transition-all"
              >
                {deletingEntry ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing from DB...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Photo Lightbox Modal */}
      {previewPhotoModal && (
        <PhotoLightboxModal
          photo={previewPhotoModal}
          onClose={() => setPreviewPhotoModal(null)}
        />
      )}

    </div>
  );
};
