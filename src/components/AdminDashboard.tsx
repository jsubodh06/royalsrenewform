import React, { useState, useEffect } from 'react';
import {
  Shield,
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
  Briefcase
} from 'lucide-react';
import {
  getAdminOverviewApi,
  getAdminMembersApi,
  getAdminMemberDetailApi,
  getAdminCorrectionsApi,
  resolveAdminCorrectionApi,
  getAdminExportApi,
  adminLoginApi,
  addAdminNoteApi,
  getAdminAuditLogsApi,
  getMembersImportStatusApi,
  importMembersApi
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
  const [email, setEmail] = useState('subodhjain2007777@gmail.com');
  const [pin, setPin] = useState('royals2027');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Active Tab: 'members' | 'corrections' | 'audit' | 'export' | 'import'
  const [activeTab, setActiveTab] = useState<'members' | 'corrections' | 'audit' | 'export' | 'import'>('members');

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

  // 1. Handle Admin Login
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

  // 2. Fetch Overview Metrics
  const loadOverview = async () => {
    if (!adminToken) return;
    try {
      const data = await getAdminOverviewApi(adminToken);
      setOverview(data);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
      loadMembers();
      loadCorrections();
    }
  }, [adminToken, verificationFilter, year2Filter, correctionFilter, pagination.page]);

  useEffect(() => {
    if (adminToken && activeTab === 'audit') {
      loadAuditLogs(auditPagination.page);
    }
    if (adminToken && activeTab === 'import') {
      loadImportStatus();
    }
  }, [adminToken, activeTab, auditPagination.page]);

  // Debounced search
  useEffect(() => {
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
    } catch (err) {
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
      <div className="min-h-[calc(100vh-80px)] flex flex-col justify-center items-center py-12 px-4">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-[#1C1917] text-[#D4AF37] border border-[#C5A869]/50 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-[#D4AF37]" />
          </div>

          <div className="text-center mb-6">
            <h2 className="font-serif-royal text-2xl font-bold text-[#1C1917]">
              Committee Security
            </h2>
            <p className="text-xs text-[#78716C] mt-1">
              Authorized Committee Members & Administrators Only
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                Admin Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#D9CDB8] text-sm text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                Passcode / Access PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#D9CDB8] text-sm text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 border border-[#C5A869]/40 cursor-pointer"
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

          <div className="mt-6 p-3 bg-[#FAF7F2] rounded-xl border border-[#E9DFCE] text-[11px] text-[#78716C] text-center space-y-1">
            <div>Super Admin: <strong>subodhjain2007777@gmail.com</strong> / <strong>royals2027</strong></div>
            <div>Admin: <strong>admin@jsgroyals.org</strong> / <strong>royals2027</strong></div>
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
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7DDCE]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-serif-royal font-bold text-2xl text-[#1C1917]">
              JSG Royals Administration
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1C1917] text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider border border-[#C5A869]/30">
              Year 2 • 2027
            </span>
            {adminSession?.role && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wider border border-amber-300">
                {adminSession.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            )}
          </div>
          <p className="text-xs text-[#78716C] mt-0.5">
            Signed in as: <strong className="text-[#1C1917]">{adminSession?.email || 'Authorized Administrator'}</strong> • Strict database oversight: 110 Royal Couples
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadCsv('all')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFFFFF] border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] shadow-xs transition-all cursor-pointer"
            title="Quick CSV Export"
          >
            <Download className="w-3.5 h-3.5 text-[#8C6D2B]" />
            <span className="hidden sm:inline">Quick CSV</span>
          </button>
          <button
            onClick={() => {
              loadOverview();
              loadMembers();
              loadCorrections();
              if (activeTab === 'audit') loadAuditLogs();
            }}
            className="p-2 rounded-xl bg-[#FFFFFF] border border-[#D9CDB8] text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF7F2] cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onAdminLogout}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
              Total Members
            </span>
            <span className="font-serif-royal text-2xl font-black text-[#1C1917]">
              {overview.totalMembers}
            </span>
            <span className="text-[10px] text-[#A8A29E] block mt-0.5">Permanent Roster</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-[#8C6D2B] uppercase tracking-wider block">
              Verified
            </span>
            <span className="font-serif-royal text-2xl font-black text-[#8C6D2B]">
              {overview.verifiedCount}
            </span>
            <span className="text-[10px] text-[#78716C] block mt-0.5">OTP Authenticated</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
              Not Verified
            </span>
            <span className="font-serif-royal text-2xl font-black text-[#78716C]">
              {overview.notVerifiedCount}
            </span>
            <span className="text-[10px] text-[#A8A29E] block mt-0.5">Pending Login</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider block">
              Incomplete / Draft
            </span>
            <span className="font-serif-royal text-2xl font-black text-amber-700">
              {overview.incompleteCount}
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Work In Progress</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
              Submitted
            </span>
            <span className="font-serif-royal text-2xl font-black text-emerald-700">
              {overview.submittedCount}
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">Locked & Final</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#E7DDCE] shadow-xs">
            <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider block">
              Corrections
            </span>
            <span className="font-serif-royal text-2xl font-black text-purple-700">
              {overview.pendingCorrectionsCount}
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">Pending Review</span>
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E7DDCE] overflow-x-auto">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'members'
              ? 'border-[#1C1917] text-[#1C1917]'
              : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Overview & Members</span>
        </button>

        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'corrections'
              ? 'border-[#1C1917] text-[#1C1917]'
              : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-purple-600" />
          <span>Correction Queue ({correctionsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[#1C1917] text-[#1C1917]'
              : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
          }`}
        >
          <Activity className="w-4 h-4 text-[#8C6D2B]" />
          <span>Audit Trail</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'export'
              ? 'border-[#1C1917] text-[#1C1917]'
              : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          <span>Export Center</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'import'
              ? 'border-[#1C1917] text-[#1C1917]'
              : 'border-transparent text-[#78716C] hover:text-[#1C1917]'
          }`}
        >
          <Users className="w-4 h-4 text-amber-700" />
          <span>Import Master Data (Step 9)</span>
        </button>
      </div>

      {/* TAB 1: MEMBERS TABLE WITH COMBINABLE FILTERS */}
      {activeTab === 'members' && (
        <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-5 shadow-sm space-y-4">
          
          {/* Search Bar & Combinable Filter Dropdowns */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-[#A8A29E] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Couple ID, Name, Mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>

              {/* Combinable Filters Controls */}
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                {/* Verification Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C]">Auth:</span>
                  <select
                    value={verificationFilter}
                    onChange={(e) => {
                      setVerificationFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-lg px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  >
                    <option value="all">All Auth Status</option>
                    <option value="verified">Verified Only</option>
                    <option value="not_verified">Not Verified Only</option>
                  </select>
                </div>

                {/* Year 2 Status Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C]">Year 2:</span>
                  <select
                    value={year2Filter}
                    onChange={(e) => {
                      setYear2Filter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-lg px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                  >
                    <option value="all">All Year-2 Status</option>
                    <option value="submitted">Submitted Only</option>
                    <option value="draft">Draft / Incomplete</option>
                    <option value="not_started">Not Started</option>
                  </select>
                </div>

                {/* Corrections Filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-bold text-[#78716C]">Corrections:</span>
                  <select
                    value={correctionFilter}
                    onChange={(e) => {
                      setCorrectionFilter(e.target.value);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-xs bg-[#FAF8F5] border border-[#D9CDB8] rounded-lg px-2.5 py-1.5 text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
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
                    onClick={() => {
                      setVerificationFilter('all');
                      setYear2Filter('all');
                      setCorrectionFilter('all');
                      setSearch('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className="text-[11px] text-[#8C6D2B] underline hover:text-[#1C1917] px-1 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F0E8DC] text-[#78716C] uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-3">Couple ID</th>
                  <th className="py-3 px-3">Husband & Wife</th>
                  <th className="py-3 px-3">Registered Mobile</th>
                  <th className="py-3 px-3">Auth Status</th>
                  <th className="py-3 px-3">Year-2 Status</th>
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
                            {m.husband_name} & {m.wife_name}
                          </div>
                          <div className="text-[10px] text-[#78716C]">
                            Anniversary: {m.marriage_anniversary || '—'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-[#57534E]">
                          <div>H: {m.husband_registered_mobile}</div>
                          {m.wife_registered_mobile && (
                            <div className="text-[10px] text-[#78716C]">W: {m.wife_registered_mobile}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-medium">
                              NOT VERIFIED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {isSubmitted ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              SUBMITTED ✓
                            </span>
                          ) : isDraft ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                              DRAFT
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">
                              NOT STARTED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {m.correction_status === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                              ⚠️ PENDING
                            </span>
                          ) : m.correction_status === 'UNDER_REVIEW' ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              UNDER REVIEW
                            </span>
                          ) : m.correction_status === 'RESOLVED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              RESOLVED
                            </span>
                          ) : m.correction_status === 'REJECTED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px]">
                              REJECTED
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#A8A29E]">NO CORRECTION</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#78716C] text-[11px]">
                          {m.submitted_at
                            ? new Date(m.submitted_at).toLocaleDateString()
                            : m.last_activity
                            ? new Date(m.last_activity).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => inspectMember(m.couple_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#2A2623] text-white text-[11px] font-medium transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-[#D4AF37]" />
                            <span>View Dossier</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F0E8DC] text-xs text-[#78716C]">
            <span>
              Showing {members.length} of {pagination.total} registered couples
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                className="p-1.5 rounded-lg border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-[#1C1917]">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                className="p-1.5 rounded-lg border border-[#D9CDB8] disabled:opacity-40 hover:bg-[#FAF8F5] cursor-pointer"
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
                Export Year-2 Submissions & Registry
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
                  { id: 'submitted', label: 'Submitted Only (Completed Year 2 Updates)' },
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
              <li><strong>Shared Couple Mapping:</strong> Both the husband&apos;s and wife&apos;s registered mobiles authenticate to the exact same Couple ID and the same Year-2 dossier.</li>
              <li><strong>RLS &amp; Isolation:</strong> Authenticated sessions can query only their own Couple ID, preventing cross-couple data leakage.</li>
            </ul>
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
                        Year-2 Submitted ✓ ({new Date(memberDetail.submission.submitted_at).toLocaleDateString()})
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
                        Year-2 Family / Couple Photograph
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

                  {/* Year 2 Updates */}
                  <div className="p-4 bg-[#F5EFE6] rounded-2xl border border-[#DFCFAE] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#DFCFAE] pb-1.5">
                      <span className="text-[11px] font-bold text-[#8C6D2B] uppercase tracking-wider">
                        Year-2 Member Updates
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

                {/* Year 2 Preferences & Vision */}
                {memberDetail.year2Preferences && (
                  <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E7DDCE] space-y-3">
                    <span className="text-[11px] font-bold text-[#8C6D2B] uppercase tracking-wider block">
                      Year-2 Wishlist & Royals Vision
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
                      placeholder="Add an internal note (e.g. Verified via WhatsApp; sent Year 2 kit)..."
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
                          Final Year-2 submission recorded on {new Date(memberDetail.submission.submitted_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
