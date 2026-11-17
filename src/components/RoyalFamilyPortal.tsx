import React, { useState, useMemo, useEffect } from 'react';
import {
  Crown,
  Heart,
  Users,
  User,
  Sparkles,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Baby,
  Image as ImageIcon,
  PartyPopper,
  ShieldCheck,
  RefreshCw,
  Award,
  Gem,
  Printer,
  Share2,
  KeyRound,
  ExternalLink,
  Link2,
  Eye,
  Download,
  IndianRupee,
  Clock,
  UserPlus,
  FileText,
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  registerFamilyApi,
  uploadFamilyPhotoApi,
  requestFamilyEmailOtpApi,
  verifyFamilyEmailOtpApi
} from '../lib/api.ts';
import { RoyalLogo } from './RoyalLogo.tsx';
import { PhotoLightboxModal } from './PhotoLightboxModal.tsx';
import { getDisplayImageSrc, isExternalCloudUrl, downloadMediaImage } from '../lib/media.ts';

export interface ChildItem {
  id: string;
  name: string;
  gender: 'son' | 'daughter';
  dob: string;
  education: string;
  interests?: string;
  photo_url?: string;
}

interface PhotoUploadOrDriveLinkProps {
  label: string;
  labelNote?: string;
  subtitle?: string;
  guideline?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
  fieldError?: string;
}

function PhotoUploadOrDriveLink({
  label,
  labelNote,
  subtitle,
  guideline,
  value,
  onChange,
  required = false,
  fieldError
}: PhotoUploadOrDriveLinkProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'drive'>('upload');
  const [driveInput, setDriveInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setThumbFailed(false);
  }, [value]);

  const isDriveLink = isExternalCloudUrl(value);
  const displaySrc = getDisplayImageSrc(value);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-selecting or retrying the same file always triggers onChange
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be under 25 MB');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFamilyPhotoApi(file);
      onChange(res.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again or paste a Google Drive link.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDriveLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!driveInput.trim()) {
      setError('Please paste a valid Google Drive or cloud link.');
      return;
    }
    setError(null);
    onChange(driveInput.trim());
    setDriveInput('');
  };

  return (
    <div
      data-field-error={fieldError ? 'true' : undefined}
      className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
        fieldError ? 'border-red-500 bg-red-50/40' : 'border-[#E2D5BE] bg-white'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <label
            className={`block text-[11px] font-bold uppercase tracking-wider ${
              fieldError ? 'text-red-700' : 'text-[#44403C]'
            }`}
          >
            {label}{' '}
            {labelNote && (
              <span className="font-medium normal-case tracking-normal text-[#78716C]">
                {labelNote}
              </span>
            )}{' '}
            {required && <span className="text-red-500">*</span>}
          </label>
          {subtitle && <p className="text-[10px] text-[#78716C]">{subtitle}</p>}
        </div>

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setDriveInput('');
              setError(null);
            }}
            className="text-[10px] text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        )}
      </div>

      {guideline && (
        <div className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#D4AF37]/50 text-[#6D531E] text-[11px] flex items-start gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-[#8C6D2B] shrink-0 mt-0.5" />
          <span className="leading-snug font-medium">{guideline}</span>
        </div>
      )}

      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {value ? (
        <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] flex items-center gap-3">
          {displaySrc && !thumbFailed ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="relative group shrink-0 cursor-pointer"
              title="Click to preview full photo"
            >
              <img
                src={displaySrc}
                alt={label}
                onError={() => setThumbFailed(true)}
                className="w-12 h-12 rounded-xl object-cover border border-[#D9CDB8]"
              />
            </button>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-blue-600" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase text-[#8C6D2B] block">
              {isDriveLink ? 'Google Drive / Cloud Link Attached' : 'Photo Uploaded & Saved'}
            </span>
            <p className="text-xs text-[#1C1917] truncate font-mono" title={value}>
              {value}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1C1917] hover:bg-[#2A2623] text-[#D4AF37] text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <Eye className="w-3 h-3" />
              <span>View</span>
            </button>
            {isDriveLink && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Tabs for Upload vs Drive */}
          <div className="flex rounded-lg bg-[#FAF7F2] p-0.5 border border-[#E2D5BE]">
            <button
              type="button"
              onClick={() => { setActiveTab('upload'); setError(null); }}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-white text-[#1C1917] shadow-2xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Upload className="w-3 h-3 text-[#8C6D2B]" />
              <span>Upload Image File</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('drive'); setError(null); }}
              className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'drive'
                  ? 'bg-white text-[#1C1917] shadow-2xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Link2 className="w-3 h-3 text-blue-600" />
              <span>Paste Google Drive URL</span>
            </button>
          </div>

          {activeTab === 'upload' ? (
            <label className="border border-dashed border-[#D9CDB8] hover:border-[#8C6D2B] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all bg-[#FAF7F2] hover:bg-[#F5EFE6]">
              <ImageIcon className="w-4 h-4 text-[#8C6D2B]" />
              <span className="text-xs font-semibold text-[#1C1917]">
                {uploading ? 'Optimizing & uploading photo...' : 'Choose image (JPG/PNG)'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="url"
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                onBlur={() => {
                  const trimmed = driveInput.trim();
                  if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('drive.google.com'))) {
                    onChange(trimmed);
                    setDriveInput('');
                    setError(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveDriveLink();
                  }
                }}
                placeholder="https://drive.google.com/file/d/... or Photos link"
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-1 focus:ring-[#C5A869]"
              />
              <button
                type="button"
                onClick={() => handleSaveDriveLink()}
                className="px-3 py-1.5 rounded-lg bg-[#1C1917] text-[#D4AF37] text-xs font-semibold hover:bg-[#2A2623] cursor-pointer shrink-0"
              >
                Attach Link
              </button>
            </div>
          )}
        </div>
      )}

      {fieldError && (
        <p className="text-[11px] font-medium text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{fieldError}</span>
        </p>
      )}

      {previewOpen && value && (
        <PhotoLightboxModal
          photo={{ title: label, url: value }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function isCloudDriveLink(url: string | null | undefined): boolean {
  return isExternalCloudUrl(url);
}

function DossierPhotoThumbnail({ url, alt }: { url?: string | null; alt: string }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!url) return null;
  const isDrive = isCloudDriveLink(url);
  const displaySrc = getDisplayImageSrc(url);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2.5">
      {displaySrc && !thumbFailed ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="cursor-pointer group"
          title="Click to enlarge"
        >
          <img
            src={displaySrc}
            alt={alt}
            onError={() => setThumbFailed(true)}
            className="w-14 h-14 rounded-xl object-cover border border-[#D9CDB8] shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
          />
        </button>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF7F2] hover:bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-[11px] font-semibold cursor-pointer transition-colors"
        >
          <Eye className="w-3 h-3" />
          <span>View Photo</span>
        </button>

        {!isDrive ? (
          <button
            type="button"
            onClick={() => downloadMediaImage(url, `${alt.replace(/\s+/g, '_')}.jpg`)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1C1917] hover:bg-[#2A2623] border border-[#C5A869]/50 text-[#D4AF37] text-[11px] font-semibold cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-semibold transition-colors max-w-[210px]"
          >
            <Link2 className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="truncate">Open Drive Link</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )}
      </div>

      {previewOpen && (
        <PhotoLightboxModal
          photo={{ title: alt, url, downloadName: `${alt.replace(/\s+/g, '_')}.jpg` }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

interface RoyalFamilyPortalProps {
  onOpenAdmin?: () => void;
}

// ---------------------------------------------------------------------------
// Royal Ornamental Flourish Divider
// ---------------------------------------------------------------------------
function RoyalFlourish({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3.5 my-4 select-none ${className}`}>
      <span className="h-px w-16 sm:w-28 bg-gradient-to-r from-transparent via-[#C5A869]/75 to-[#C5A869]" />
      <div className="flex items-center gap-2 text-[#C5A869]">
        <span className="text-[10px] text-[#D4AF37] animate-twinkle">✦</span>
        <span className="text-sm font-serif-royal text-[#B89748]">❖</span>
        <span className="text-[10px] text-[#D4AF37] animate-twinkle">✦</span>
      </div>
      <span className="h-px w-16 sm:w-28 bg-gradient-to-l from-transparent via-[#C5A869]/75 to-[#C5A869]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Royal Corner Gilded Brackets
// ---------------------------------------------------------------------------
function RoyalCornerBrackets() {
  return (
    <>
      <div className="absolute top-3.5 left-3.5 w-5 h-5 border-t-[1.5px] border-l-[1.5px] border-[#C5A869]/65 pointer-events-none rounded-tl-sm" />
      <div className="absolute top-3.5 right-3.5 w-5 h-5 border-t-[1.5px] border-r-[1.5px] border-[#C5A869]/65 pointer-events-none rounded-tr-sm" />
      <div className="absolute bottom-3.5 left-3.5 w-5 h-5 border-b-[1.5px] border-l-[1.5px] border-[#C5A869]/65 pointer-events-none rounded-bl-sm" />
      <div className="absolute bottom-3.5 right-3.5 w-5 h-5 border-b-[1.5px] border-r-[1.5px] border-[#C5A869]/65 pointer-events-none rounded-br-sm" />
    </>
  );
}

interface FeeWindowStatus {
  month: number;
  day: number;
  isRegularWindow: boolean;
  isLateWindow: boolean;
  isRenewalClosed: boolean;
  isBeforeCollection: boolean;
  renewalFeeFormatted: string;
  statusHeading: string;
  statusDetail: string;
}

function getMembershipFeeWindowStatus(now = new Date()): FeeWindowStatus {
  let month = now.getMonth() + 1;
  let day = now.getDate();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    month = Number(parts.find((p) => p.type === 'month')?.value || month);
    day = Number(parts.find((p) => p.type === 'day')?.value || day);
  } catch {}

  const isRenewalClosed = month === 12 && day > 5;
  const isLateWindow = month === 12 && day >= 3 && day <= 5;
  const isRegularWindow = (month === 11 && day >= 18) || (month === 12 && day <= 2);
  const isBeforeCollection = !isRenewalClosed && !isLateWindow && !isRegularWindow;

  if (isRenewalClosed) {
    return {
      month,
      day,
      isRegularWindow: false,
      isLateWindow: false,
      isRenewalClosed: true,
      isBeforeCollection: false,
      renewalFeeFormatted: 'New Entry',
      statusHeading: 'Existing Member Renewals Closed (After 5 Dec 2026)',
      statusDetail: 'After 5 Dec 2026, existing members will be considered as a New Entry (₹60,000 Fees + ₹40,000 One-Time Registration Fees).',
    };
  }

  if (isLateWindow) {
    return {
      month,
      day,
      isRegularWindow: false,
      isLateWindow: true,
      isRenewalClosed: false,
      isBeforeCollection: false,
      renewalFeeFormatted: '₹70,000',
      statusHeading: 'Existing Member Fee: ₹70,000 (3–5 Dec 2026)',
      statusDetail: 'From 3 Dec to 5 Dec 2026, existing member renewal fee is ₹70,000 (with penalty). After 5 Dec 2026, existing members will be considered as a New Entry.',
    };
  }

  if (isRegularWindow) {
    return {
      month,
      day,
      isRegularWindow: true,
      isLateWindow: false,
      isRenewalClosed: false,
      isBeforeCollection: false,
      renewalFeeFormatted: '₹60,000',
      statusHeading: 'Existing Member Fee Open: ₹60,000 (18 Nov – 2 Dec 2026)',
      statusDetail: 'From 18 Nov to 2 Dec 2026, existing member fee is ₹60,000 (₹70,000 with penalty from 3–5 Dec 2026). After 5 Dec 2026, existing members will be considered as a New Entry.',
    };
  }

  return {
    month,
    day,
    isRegularWindow: false,
    isLateWindow: false,
    isRenewalClosed: false,
    isBeforeCollection: true,
    renewalFeeFormatted: '₹60,000',
    statusHeading: 'Existing Member Fee Window: 18 Nov – 2 Dec 2026',
    statusDetail: 'Existing: ₹60,000 (18 Nov – 2 Dec 2026), ₹70,000 with penalty (3–5 Dec 2026). After 5 Dec 2026, existing members will be considered as a New Entry.',
  };
}

const ROYAL_LEADERSHIP = {
  president: 'Utkarsh Pooja Surana',
  presidentPhone: '+91 87707 13343',
  secretary: 'Harsh Tanya Kataria',
  secretaryPhone: '+91 96696 18111',
} as const;

interface FeeCollectionContact {
  name: string;
  role: string;
  phone: string;
  addresses?: { label?: string; text: string }[];
}

const FEE_COLLECTION_CONTACTS: FeeCollectionContact[] = [
  {
    name: 'Vivek Samota',
    role: 'Fee Collection Coordinator',
    phone: '+91 96375 26522',
  },
  {
    name: 'Rishabh Betala',
    role: 'Fee Collection Coordinator',
    phone: '+91 77959 59911',
    addresses: [
      {
        text: 'Vikram Tower, 419-420, Sapna Sangeeta Rd, Old Agarwal Nagar, Indore, Madhya Pradesh 452001, India',
      },
    ],
  },
  {
    name: 'Piyush Jain (Office)',
    role: 'Office Collection Desk',
    phone: '+91 99770 80007',
    addresses: [
      {
        label: 'Anushakti',
        text: '5 H Sector A, Scheme No 71, Near Gumasta Nagar, Indore',
      },
      {
        label: 'Anushakti Earthmovers',
        text: 'M - 17, Block A, New Siyaganj, Indore (M.P.)',
      },
    ],
  },
];

function MembershipFeeSubmissionSection({
  membershipKind,
  feeStatus,
  expandedAddresses,
  setExpandedAddresses,
}: {
  membershipKind: 'existing' | 'new';
  feeStatus: ReturnType<typeof getMembershipFeeWindowStatus>;
  expandedAddresses: Record<string, boolean>;
  setExpandedAddresses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const isNew = membershipKind === 'new';

  return (
    <div className="space-y-5 text-left">
      {/* 1. Applicable Fees Card (Tailored to New vs Existing) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF7F2] border border-[#E0D2B8] space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-[#EAE0CE] pb-3.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C6D2B] block">
              {isNew ? 'New Member Fee Breakdown' : 'Existing Member Fee Schedule'}
            </span>
            <h3 className="font-serif-royal text-lg font-bold text-[#1C1917] mt-1">
              {isNew ? 'New Entries (New Member Fees)' : 'Applicable Renewal Fees'}
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white border border-[#E0D2B8] text-[#8C6D2B] flex items-center justify-center shrink-0">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>

        {isNew ? (
          <>
            <dl className="divide-y divide-[#EEE5D6] text-sm bg-white rounded-xl border border-[#E6DAC5] px-4 sm:px-5">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-[#44403C] font-medium">Fees</dt>
                <dd className="font-serif-royal font-bold text-base text-[#1C1917] tabular-nums whitespace-nowrap">
                  ₹60,000
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-[#44403C] font-medium">One-Time Registration Fees</dt>
                <dd className="font-serif-royal font-bold text-base text-[#1C1917] tabular-nums whitespace-nowrap">
                  ₹40,000
                </dd>
              </div>
              <div className="py-3.5 flex items-center justify-between gap-4">
                <dt className="text-xs font-bold uppercase tracking-[0.12em] text-[#8C6D2B]">
                  Total (New Entry)
                </dt>
                <dd className="font-serif-royal font-extrabold text-lg text-[#8C6D2B] tabular-nums whitespace-nowrap">
                  ₹1,00,000
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-[#57534E] leading-relaxed">
              Payable after your new member application is reviewed and approved by the committee.
            </p>
          </>
        ) : (
          <>
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                feeStatus.isRenewalClosed
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : feeStatus.isLateWindow
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-white border-[#E0D2B8] text-[#1C1917]'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-[#8C6D2B]" />
                <span>{feeStatus.statusHeading}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {feeStatus.statusDetail}
              </p>
            </div>

            <dl className="divide-y divide-[#EEE5D6] text-sm bg-white rounded-xl border border-[#E6DAC5] px-4 sm:px-5">
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-[#44403C] font-medium">
                  <span>18 Nov – 2 Dec 2026</span>
                  {feeStatus.isRegularWindow && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                      · Active Slab
                    </span>
                  )}
                </dt>
                <dd className="font-serif-royal font-bold text-base text-[#1C1917] tabular-nums whitespace-nowrap">
                  ₹60,000
                </dd>
              </div>
              <div className="py-3 flex items-center justify-between gap-4">
                <dt className="text-[#44403C] font-medium">
                  <span>3 Dec – 5 Dec 2026</span>
                  {feeStatus.isLateWindow && (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
                      · Active Slab
                    </span>
                  )}
                  <span className="block text-[11px] text-[#78716C] font-normal mt-0.5">
                    With penalty (late renewal fee)
                  </span>
                </dt>
                <dd className="font-serif-royal font-bold text-base text-amber-800 tabular-nums whitespace-nowrap">
                  ₹70,000
                </dd>
              </div>
            </dl>

            <div className="p-3 rounded-xl bg-red-50/90 border border-red-200 text-red-900 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>After 5 Dec 2026:</strong> Existing members will be considered as a <strong>New Entry</strong> (₹60,000 Fees + ₹40,000 One-Time Registration Fees).
              </p>
            </div>
          </>
        )}
      </div>

      {/* 2. Followed By: Where They Can Submit Fees */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E0D2B8] space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-[#EFE6D7] pb-3.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8C6D2B] block">
              Authorized Payment Desks
            </span>
            <h3 className="font-serif-royal text-lg font-bold text-[#1C1917] mt-1">
              Where to Submit Fees
            </h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] border border-[#E0D2B8] text-[#8C6D2B] flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4" />
          </div>
        </div>

        <p className="text-xs text-[#57534E] leading-relaxed">
          Please submit your membership fees or coordinate with any of the authorized representatives below:
        </p>

        <div className="space-y-3">
          {FEE_COLLECTION_CONTACTS.map((contact) => {
            const hasAddresses = Boolean(contact.addresses && contact.addresses.length > 0);
            const isExpanded = Boolean(expandedAddresses[contact.name]);
            const combinedPreview = contact.addresses
              ? contact.addresses
                  .map((addr) => (addr.label ? `${addr.label} — ${addr.text}` : addr.text))
                  .join(' | ')
              : '';

            return (
              <div
                key={contact.name}
                className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DAC5] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="font-semibold text-sm text-[#1C1917]">
                      {contact.name}
                    </div>
                    <div className="text-[11px] text-[#78716C] mt-0.5">
                      {contact.role}
                    </div>
                  </div>
                  <a
                    href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono tabular-nums font-semibold text-[#8C6D2B] hover:text-[#1C1917] bg-white hover:bg-[#FAF7F2] px-3.5 py-2 rounded-lg border border-[#E0D2B8] transition-colors shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{contact.phone}</span>
                  </a>
                </div>

                {hasAddresses && (
                  <div className="pt-2 border-t border-[#E7DDCE]/80 text-[11px] text-[#57534E]">
                    {!isExpanded ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-[#8C6D2B] shrink-0" />
                        <span className="truncate flex-1 min-w-0" title={combinedPreview}>
                          {combinedPreview}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAddresses((prev) => ({ ...prev, [contact.name]: true }))
                          }
                          className="text-[#8C6D2B] hover:text-[#6D531E] font-semibold underline underline-offset-2 shrink-0 cursor-pointer"
                        >
                          Show more
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {contact.addresses!.map((addr, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                            <MapPin className="w-3.5 h-3.5 text-[#8C6D2B] shrink-0 mt-0.5" />
                            <div>
                              {addr.label && (
                                <span className="font-semibold text-[#1C1917]">{addr.label}: </span>
                              )}
                              <span>{addr.text}</span>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAddresses((prev) => ({ ...prev, [contact.name]: false }))
                          }
                          className="text-[#8C6D2B] hover:text-[#6D531E] font-semibold underline underline-offset-2 cursor-pointer inline-block pt-0.5"
                        >
                          Show less
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RoyalFamilyPortal({ onOpenAdmin }: RoyalFamilyPortalProps) {
  const feeStatus = useMemo(() => getMembershipFeeWindowStatus(new Date()), []);
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});

  // Membership Type Selection: '' until user explicitly chooses 'existing' or 'new' (mandatory on entrance)
  const [membershipChoice, setMembershipChoice] = useState<'' | 'existing' | 'new'>('');
  const membershipType: 'existing' | 'new' = membershipChoice === 'new' ? 'new' : 'existing';

  // Navigation View: 'gate' | 'spouse_celebration' | 'form' | 'success'
  const [currentView, setCurrentView] = useState<'gate' | 'spouse_celebration' | 'form' | 'success'>('gate');

  // Gate Check & Email OTP Verification State (Mandatory 2-Step Real Verification)
  const [gateEmail, setGateEmail] = useState('');
  const [gateRole, setGateRole] = useState<'husband' | 'wife'>('husband');
  const [gateOtpStep, setGateOtpStep] = useState<'email' | 'otp'>('email');
  const [gateOtp, setGateOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [gateFieldError, setGateFieldError] = useState<'membership' | 'email' | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateSuccessMsg, setGateSuccessMsg] = useState<string | null>(null);

  // 30-Second Resend Cooldown Countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Spouse Celebration / Match State
  const [existingRecord, setExistingRecord] = useState<any>(null);
  const [spouseNotificationMessage, setSpouseNotificationMessage] = useState<string>('');
  const [isFiledBySpouse, setIsFiledBySpouse] = useState(false);
  const [spouseName, setSpouseName] = useState('');
  const [spouseRole, setSpouseRole] = useState<'husband' | 'wife'>('husband');
  const [activeSpouseDetailTab, setActiveSpouseDetailTab] = useState<'all' | 'husband' | 'wife' | 'children'>('all');

  // Form Stepper: 1 (Husband) -> 2 (Wife) -> 3 (Union) -> 4 (Children) -> 5 (Photo/Vision) -> 6 (Review)
  const [activeStep, setActiveStep] = useState<number>(1);
  const totalSteps = 6;

  // Form State
  const [husbandName, setHusbandName] = useState('');
  const [husbandMobile, setHusbandMobile] = useState('');
  const [husbandEmail, setHusbandEmail] = useState('');
  const [husbandDob, setHusbandDob] = useState('');
  const [husbandQualification, setHusbandQualification] = useState('');
  const [husbandOccupation, setHusbandOccupation] = useState('');
  const [husbandOrganization, setHusbandOrganization] = useState('');
  const [husbandBloodGroup, setHusbandBloodGroup] = useState('');
  const [husbandInstagram, setHusbandInstagram] = useState('');

  const [wifeName, setWifeName] = useState('');
  const [wifeMobile, setWifeMobile] = useState('');
  const [wifeEmail, setWifeEmail] = useState('');
  const [wifeDob, setWifeDob] = useState('');
  const [wifeQualification, setWifeQualification] = useState('');
  const [wifeOccupation, setWifeOccupation] = useState('');
  const [wifeOrganization, setWifeOrganization] = useState('');
  const [wifeBloodGroup, setWifeBloodGroup] = useState('');
  const [wifeInstagram, setWifeInstagram] = useState('');

  const [marriageAnniversary, setMarriageAnniversary] = useState('');
  const [currentCity, setCurrentCity] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [nativePlace, setNativePlace] = useState('');

  const [hasChildren, setHasChildren] = useState<boolean>(true);
  const [children, setChildren] = useState<ChildItem[]>([
    { id: '1', name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }
  ]);

  const [husbandPhotoUrl, setHusbandPhotoUrl] = useState<string | null>(null);
  const [wifePhotoUrl, setWifePhotoUrl] = useState<string | null>(null);
  const [couplePhotoUrl, setCouplePhotoUrl] = useState<string | null>(null);
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState<string | null>(null);

  const [contributionAreas, setContributionAreas] = useState<string[]>([]);
  const [royalIdea, setRoyalIdea] = useState('');
  const [jsgShouldBeKnownFor, setJsgShouldBeKnownFor] = useState('');

  // Additional Questions for New Members in the unified flow
  const [appOtherGroup, setAppOtherGroup] = useState<'No' | 'Yes'>('No');
  const [appOtherGroupName, setAppOtherGroupName] = useState('');
  const [appContribution, setAppContribution] = useState('');
  const [appRefName, setAppRefName] = useState('');
  const [appRefMobile, setAppRefMobile] = useState('');
  const [appBusinessDesc, setAppBusinessDesc] = useState('');
  const [expRating, setExpRating] = useState<number | null>(null);
  const [expFavouriteEvent, setExpFavouriteEvent] = useState('');
  const [expInternationalTrip, setExpInternationalTrip] = useState<'' | 'Yes' | 'No'>('');
  const [expTripMonthDestination, setExpTripMonthDestination] = useState('');
  const [expMissing, setExpMissing] = useState('');
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isUpdatedSubmission, setIsUpdatedSubmission] = useState(false);

  // Clean Entrance Reset Helper (always lands back on initial Email gate screen)
  const resetToEntrance = () => {
    setMembershipChoice('');
    setGateFieldError(null);
    setGateOtpStep('email');
    setGateOtp('');
    setGateEmail('');
    setIsEmailVerified(false);
    setResendCooldown(0);
    setGateError(null);
    setGateSuccessMsg(null);
    setExistingRecord(null);
    setFinalRegistration(null);
    setSubmissionNotice(null);
    setActiveStep(1);

    setHusbandName('');
    setHusbandMobile('');
    setHusbandEmail('');
    setHusbandDob('');
    setHusbandQualification('');
    setHusbandOccupation('');
    setHusbandOrganization('');
    setHusbandBloodGroup('');
    setHusbandInstagram('');
    setHusbandPhotoUrl(null);

    setWifeName('');
    setWifeMobile('');
    setWifeEmail('');
    setWifeDob('');
    setWifeQualification('');
    setWifeOccupation('');
    setWifeOrganization('');
    setWifeBloodGroup('');
    setWifeInstagram('');
    setWifePhotoUrl(null);

    setMarriageAnniversary('');
    setCurrentCity('');
    setResidentialAddress('');
    setNativePlace('');

    setHasChildren(true);
    setChildren([{ id: '1', name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }]);
    setCouplePhotoUrl(null);
    setFamilyPhotoUrl(null);
    setContributionAreas([]);
    setRoyalIdea('');
    setJsgShouldBeKnownFor('');
    setAppOtherGroup('No');
    setAppOtherGroupName('');
    setAppContribution('');
    setAppRefName('');
    setAppRefMobile('');
    setAppBusinessDesc('');
    setExpRating(null);
    setExpFavouriteEvent('');
    setExpInternationalTrip('');
    setExpTripMonthDestination('');
    setExpMissing('');
    setDeclarationAccepted(false);
    setIsUpdatedSubmission(false);
    setSubmitError(null);
    setFieldErrors({});

    setCurrentView('gate');
  };

  // Pre-fill form from existing dossier so user can update instead of creating a new entry
  const handleEditExistingRecord = () => {
    if (!existingRecord) return;
    const rec = existingRecord;
    const recType = rec.membership_type === 'new' ? 'new' : 'existing';
    setMembershipChoice(recType);
    setGateRole(rec.submitted_by_role === 'wife' ? 'wife' : 'husband');
    setIsEmailVerified(true);

    setHusbandName(rec.husband_name || '');
    setHusbandMobile(rec.husband_mobile || '');
    setHusbandEmail(rec.husband_email || '');
    setHusbandDob(rec.husband_dob || '');
    setHusbandQualification(rec.husband_qualification || '');
    setHusbandOccupation(rec.husband_occupation || '');
    setHusbandOrganization(rec.husband_organization || '');
    setHusbandBloodGroup(rec.husband_blood_group || '');
    setHusbandInstagram(rec.husband_instagram || '');
    setHusbandPhotoUrl(rec.husband_photo_url || null);

    setWifeName(rec.wife_name || '');
    setWifeMobile(rec.wife_mobile || '');
    setWifeEmail(rec.wife_email || '');
    setWifeDob(rec.wife_dob || '');
    setWifeQualification(rec.wife_qualification || '');
    setWifeOccupation(rec.wife_occupation || '');
    setWifeOrganization(rec.wife_organization || '');
    setWifeBloodGroup(rec.wife_blood_group || '');
    setWifeInstagram(rec.wife_instagram || '');
    setWifePhotoUrl(rec.wife_photo_url || null);

    setMarriageAnniversary(rec.marriage_anniversary || '');
    setCurrentCity(rec.current_city || '');
    setResidentialAddress(rec.residential_address || '');
    setNativePlace(rec.native_place || '');

    const kidsList = Array.isArray(rec.children) ? rec.children : [];
    setHasChildren(Boolean(rec.has_children) || kidsList.length > 0);
    setChildren(
      kidsList.length > 0
        ? kidsList.map((c: any, idx: number) => ({
            id: c.id || String(idx + 1),
            name: c.name || '',
            gender: c.gender === 'daughter' ? 'daughter' : 'son',
            dob: c.dob || '',
            education: c.education || '',
            interests: c.interests || '',
            photo_url: c.photo_url || '',
          }))
        : [{ id: '1', name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }]
    );

    setCouplePhotoUrl(rec.couple_photo_url || null);
    setFamilyPhotoUrl(rec.family_photo_url || null);

    const areas = typeof rec.contribution_areas === 'string' && rec.contribution_areas.trim()
      ? rec.contribution_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    setContributionAreas(areas);
    setRoyalIdea(rec.royal_idea || '');
    setJsgShouldBeKnownFor(rec.jsg_should_be_known_for || '');

    setAppOtherGroup(rec.other_group_member === 'Yes' ? 'Yes' : 'No');
    setAppOtherGroupName(rec.other_group_name || '');
    setAppContribution(rec.new_member_contribution || '');
    setAppRefName(rec.reference_name || '');
    setAppRefMobile(rec.reference_mobile || '');
    setAppBusinessDesc(rec.business_description || '');

    setExpRating(
      typeof rec.exp_rating === 'number' && rec.exp_rating >= 1 && rec.exp_rating <= 10
        ? rec.exp_rating
        : null
    );
    setExpFavouriteEvent(rec.exp_favourite_event || '');
    setExpInternationalTrip(
      rec.exp_international_trip === 'Yes'
        ? 'Yes'
        : rec.exp_international_trip === 'No'
          ? 'No'
          : ''
    );
    setExpTripMonthDestination(rec.exp_trip_month_destination || '');
    setExpMissing(rec.exp_missing || '');

    setDeclarationAccepted(false);
    setSubmitError(null);
    setFieldErrors({});
    setActiveStep(1);
    setCurrentView('form');
  };

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [finalRegistration, setFinalRegistration] = useState<any>(null);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const el = document.querySelector('[data-field-error="true"]') as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof el.focus === 'function') {
          el.focus({ preventScroll: true });
        }
      }
    }, 60);
  };

  // Grand Multi-Stage Confetti Fanfare
  const triggerConfettiFanfare = () => {
    try {
      // Golden shower
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#99782F', '#C5A869', '#1C1917', '#EFE4C9']
      });

      // Side fireworks
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
          colors: ['#D4AF37', '#FFD700', '#F59E0B', '#FAF0D7']
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
          colors: ['#D4AF37', '#FFD700', '#F59E0B', '#FAF0D7']
        });
      }, 200);

      // Star sparkle bursts
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 100,
          origin: { y: 0.4 },
          shapes: ['circle', 'square'],
          colors: ['#D4AF37', '#C5A869', '#FFF']
        });
      }, 450);
    } catch (e) {}
  };

  // Calculate Years of Togetherness from Marriage Anniversary
  const yearsTogether = useMemo(() => {
    if (!marriageAnniversary) return null;
    const annDate = new Date(marriageAnniversary);
    if (isNaN(annDate.getTime())) return null;
    const today = new Date();
    let years = today.getFullYear() - annDate.getFullYear();
    const m = today.getMonth() - annDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < annDate.getDate())) {
      years--;
    }
    return years >= 0 ? years : 0;
  }, [marriageAnniversary]);

  // 1. Step 1: Request 6-digit Royal Verification Code to Email
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!membershipChoice) {
      setGateFieldError('membership');
      setGateError('Please choose Existing Member or New Member before continuing.');
      return;
    }
    if (membershipChoice === 'existing' && feeStatus.isRenewalClosed) {
      setGateFieldError('membership');
      setGateError('After 5 Dec 2026, existing members are treated as a New Entry. Please choose New Member.');
      return;
    }
    if (!gateEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gateEmail.trim())) {
      setGateFieldError('email');
      setGateError('Please enter a valid email address.');
      return;
    }

    setSendingOtp(true);
    setGateFieldError(null);
    setGateError(null);
    setGateSuccessMsg(null);

    try {
      const email = gateEmail.trim().toLowerCase();
      const res = await requestFamilyEmailOtpApi(email, gateRole, membershipChoice);

      if (res.bypassOtp && res.verified) {
        setIsEmailVerified(true);
        if (res.alreadyRegistered && res.registration) {
          setExistingRecord(res.registration);
          setSpouseNotificationMessage(res.message || 'Your spouse has already registered your family household!');
          setIsFiledBySpouse(Boolean(res.filedBySpouse));
          setSpouseName(res.spouseName || (gateRole === 'husband' ? res.registration.wife_name : res.registration.husband_name));
          setSpouseRole(res.spouseRole || (gateRole === 'husband' ? 'wife' : 'husband'));
          setCurrentView('spouse_celebration');
          triggerConfettiFanfare();
        } else {
          if (gateRole === 'husband') {
            setHusbandEmail(email);
          } else {
            setWifeEmail(email);
          }
          setCurrentView('form');
          setActiveStep(1);
          triggerConfettiFanfare();
        }
        return;
      }

      setGateOtpStep('otp');
      setGateOtp('');
      setResendCooldown(res.cooldownSeconds || 30);
      setGateSuccessMsg(res.message || `A 6-digit verification code has been dispatched to ${email}.`);
    } catch (err: any) {
      setGateError(err?.message || 'Failed to dispatch verification code. Please check your email configuration.');
    } finally {
      setSendingOtp(false);
    }
  };

  // 2. Step 2: Verify 6-digit Royal Verification Code & Grant Access
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanOtp = gateOtp.replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setGateError('Please enter the complete 6-digit verification code.');
      return;
    }

    setVerifyingOtp(true);
    setGateError(null);

    try {
      const email = gateEmail.trim().toLowerCase();
      const res = await verifyFamilyEmailOtpApi(email, cleanOtp);

      if (res.verified) {
        setIsEmailVerified(true);

        if (res.alreadyRegistered && res.registration) {
          // Spouse already completed registration! Show grand proclamation screen
          setExistingRecord(res.registration);
          setSpouseNotificationMessage(res.message || 'Your spouse has already registered your family household!');
          setIsFiledBySpouse(Boolean(res.filedBySpouse));
          setSpouseName(res.spouseName || (gateRole === 'husband' ? res.registration.wife_name : res.registration.husband_name));
          setSpouseRole(res.spouseRole || (gateRole === 'husband' ? 'wife' : 'husband'));
          setCurrentView('spouse_celebration');
          triggerConfettiFanfare();
        } else {
          // First-time submission for this household: grant verified access to the 6-step form!
          if (gateRole === 'husband') {
            setHusbandEmail(email);
          } else {
            setWifeEmail(email);
          }
          setCurrentView('form');
          setActiveStep(1);
          triggerConfettiFanfare();
        }
      }
    } catch (err: any) {
      setGateError(err?.message || 'Verification failed. Please check the 6-digit code and try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Resend OTP handler (respects 30s cooldown)
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || sendingOtp) return;
    await handleRequestOtp();
  };

  // Switch back to email change step
  const handleBackToEmail = () => {
    setGateOtpStep('email');
    setGateOtp('');
    setGateError(null);
    setGateSuccessMsg(null);
  };

  // Non-blocking spouse email blur handler (submissions update matching existing dossiers)
  const handleCheckSpouseEmailOnBlur = async (_emailToCheck: string, _expectedRole: 'husband' | 'wife') => {
    // Re-submissions update any matching household record in place.
  };

  // 2. Child management helpers
  const handleAddChild = () => {
    const newId = String(Date.now());
    setChildren((prev) => [
      ...prev,
      { id: newId, name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }
    ]);
  };

  const handleRemoveChild = (id: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  };

  const handleUpdateChild = (id: string, field: keyof ChildItem, value: any) => {
    setChildren((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  // 3. Contribution areas toggle
  const toggleContributionArea = (area: string) => {
    setContributionAreas((prev) => {
      const next = prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area];
      if (next.length > 0) clearFieldError('contributionAreas');
      return next;
    });
  };

  // 5. Final Multi-Step Submission Handler (directly seals after Declaration is checked)
  const executeSubmitForm = async () => {
    if (!isEmailVerified) {
      setSubmitError('Email verification is required before accessing or submitting the royal dossier.');
      setCurrentView('gate');
      return;
    }

    const mandatorySteps = [1, 2, 3, 4, 5];
    for (const stepNum of mandatorySteps) {
      const errs = validateStepFields(stepNum);
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setSubmitError(`Some mandatory fields in Step ${stepNum} were missed or invalid. Highlighted in red below.`);
        setActiveStep(stepNum);
        scrollToFirstError();
        return;
      }
    }

    if (!declarationAccepted) {
      setFieldErrors({
        declarationAccepted: 'Please read and accept the Member Declaration before proceeding.'
      });
      setSubmitError('Please accept the Member Declaration at the bottom of the review page before submitting.');
      scrollToFirstError();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    const payload = {
      membership_type: membershipType,
      submitted_by_role: gateRole,
      submitter_email: gateEmail.trim().toLowerCase() || (gateRole === 'husband' ? husbandEmail : wifeEmail),
      husband_name: husbandName.trim(),
      husband_mobile: husbandMobile.trim(),
      husband_email: husbandEmail.trim().toLowerCase(),
      husband_dob: husbandDob || null,
      husband_qualification: husbandQualification.trim() || null,
      husband_occupation: husbandOccupation.trim() || null,
      husband_organization: husbandOrganization.trim() || null,
      husband_blood_group: husbandBloodGroup || null,
      husband_instagram: husbandInstagram.trim() || null,
      husband_photo_url: husbandPhotoUrl || null,
      wife_name: wifeName.trim(),
      wife_mobile: wifeMobile.trim(),
      wife_email: wifeEmail.trim().toLowerCase(),
      wife_dob: wifeDob || null,
      wife_qualification: wifeQualification.trim() || null,
      wife_occupation: wifeOccupation.trim() || null,
      wife_organization: wifeOrganization.trim() || null,
      wife_blood_group: wifeBloodGroup || null,
      wife_instagram: wifeInstagram.trim() || null,
      wife_photo_url: wifePhotoUrl || null,
      marriage_anniversary: marriageAnniversary.trim(),
      current_city: currentCity.trim(),
      residential_address: residentialAddress.trim(),
      native_place: nativePlace.trim() || null,
      has_children: hasChildren,
      children: hasChildren
        ? children
            .filter(
              (c) =>
                c.name.trim().length > 0 ||
                Boolean(c.dob) ||
                c.education.trim().length > 0 ||
                Boolean(c.interests?.trim()) ||
                Boolean(c.photo_url)
            )
            .map((c, idx) => ({
              id: c.id,
              name: c.name.trim() || `Royal Heir #${idx + 1}`,
              gender: c.gender,
              dob: c.dob || '',
              education: c.education.trim() || '',
              interests: c.interests?.trim() || '',
              photo_url: c.photo_url || null
            }))
        : [],
      couple_photo_url: couplePhotoUrl || null,
      family_photo_url: familyPhotoUrl || null,
      contribution_areas: contributionAreas.join(', '),
      royal_idea: royalIdea.trim() || null,
      jsg_should_be_known_for: jsgShouldBeKnownFor.trim() || null,
      ...(membershipType === 'existing'
        ? {
            exp_rating: expRating,
            exp_favourite_event: expFavouriteEvent.trim() || null,
            exp_international_trip: expInternationalTrip || null,
            exp_trip_month_destination:
              expInternationalTrip === 'Yes' ? expTripMonthDestination.trim() || null : null,
            exp_missing: expMissing.trim() || null,
          }
        : {}),
      ...(membershipType === 'new'
        ? {
            other_group_member: appOtherGroup,
            other_group_name: appOtherGroup === 'Yes' ? appOtherGroupName.trim() : null,
            business_description: appBusinessDesc.trim(),
            new_member_contribution: appContribution.trim(),
            reference_name: appRefName.trim(),
            reference_mobile: appRefMobile.replace(/\D/g, ''),
          }
        : {}),
    };

    try {
      const res = await registerFamilyApi(payload);

      setIsUpdatedSubmission(Boolean(res.updated));
      setSubmissionNotice(
        res.notice ||
          (membershipType === 'new'
            ? 'This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.'
            : null)
      );
      setFinalRegistration(res.registration);
      setCurrentView('success');
      triggerConfettiFanfare();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit family registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const validateStepFields = (step: number): Record<string, string> => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isNew = membershipType === 'new';

    if (step === 1) {
      if (!husbandName.trim()) {
        errors.husbandName = 'This field was missed — please enter Husband Full Name.';
      }
      const hDigits = husbandMobile.replace(/\D/g, '');
      if (hDigits.length !== 10) {
        errors.husbandMobile = hDigits.length === 0
          ? 'This field was missed — please enter a 10-digit mobile number.'
          : 'Please enter a valid 10-digit mobile number.';
      }
      if (!husbandEmail.trim()) {
        errors.husbandEmail = 'This field was missed — please enter Husband Email.';
      } else if (!emailRegex.test(husbandEmail.trim())) {
        errors.husbandEmail = 'Please enter a valid email address.';
      }
      if (!husbandInstagram.trim()) {
        errors.husbandInstagram = 'This field was missed — please enter Husband Instagram Handle.';
      }
      if (isNew) {
        if (!husbandDob) {
          errors.husbandDob = 'This field was missed — please select Date of Birth.';
        } else if (husbandDob < '1988-01-01') {
          errors.husbandDob = 'Date of Birth must be on or after 01 Jan 1988 (1987 and earlier not allowed).';
        }
        if (!husbandBloodGroup.trim()) {
          errors.husbandBloodGroup = 'This field was missed — please select Blood Group.';
        }
        if (!husbandQualification.trim()) {
          errors.husbandQualification = 'This field was missed — please enter Highest Educational Qualification.';
        }
        if (!husbandOccupation.trim()) {
          errors.husbandOccupation = 'This field was missed — please enter Occupation / Profession.';
        }
        if (!husbandOrganization.trim()) {
          errors.husbandOrganization = 'This field was missed — please enter Company / Business / Organization.';
        }
        if (!husbandPhotoUrl?.trim()) {
          errors.husbandPhotoUrl = 'This field was missed — please upload Husband Photo or attach a Google Drive photo link.';
        }
      }
    } else if (step === 2) {
      if (!wifeName.trim()) {
        errors.wifeName = 'This field was missed — please enter Wife Full Name.';
      }
      const wDigits = wifeMobile.replace(/\D/g, '');
      if (wDigits.length !== 10) {
        errors.wifeMobile = wDigits.length === 0
          ? 'This field was missed — please enter a 10-digit mobile number.'
          : 'Please enter a valid 10-digit mobile number.';
      }
      if (!wifeEmail.trim()) {
        errors.wifeEmail = 'This field was missed — please enter Wife Email.';
      } else if (!emailRegex.test(wifeEmail.trim())) {
        errors.wifeEmail = 'Please enter a valid email address.';
      }
      if (!wifeInstagram.trim()) {
        errors.wifeInstagram = 'This field was missed — please enter Wife Instagram Handle.';
      }
      if (isNew) {
        if (!wifeDob) {
          errors.wifeDob = 'This field was missed — please select Date of Birth.';
        } else if (wifeDob < '1988-01-01') {
          errors.wifeDob = 'Date of Birth must be on or after 01 Jan 1988 (1987 and earlier not allowed).';
        }
        if (!wifeBloodGroup.trim()) {
          errors.wifeBloodGroup = 'This field was missed — please select Blood Group.';
        }
        if (!wifeQualification.trim()) {
          errors.wifeQualification = 'This field was missed — please enter Highest Educational Qualification.';
        }
        if (!wifeOccupation.trim()) {
          errors.wifeOccupation = 'This field was missed — please enter Occupation / Profession.';
        }
        if (!wifeOrganization.trim()) {
          errors.wifeOrganization = 'This field was missed — please enter Company / Business / Organization.';
        }
        if (!wifePhotoUrl?.trim()) {
          errors.wifePhotoUrl = 'This field was missed — please upload Wife Photo or attach a Google Drive photo link.';
        }
      }
    } else if (step === 3) {
      if (isNew) {
        if (!marriageAnniversary) {
          errors.marriageAnniversary = 'This field was missed — please select Marriage Anniversary Date.';
        }
        if (!couplePhotoUrl?.trim()) {
          errors.couplePhotoUrl = 'This field was missed — please upload Couple Photo or attach a Google Drive photo link.';
        }
        if (!currentCity.trim()) {
          errors.currentCity = 'This field was missed — please enter Current City of Residence.';
        }
        if (!nativePlace.trim()) {
          errors.nativePlace = 'This field was missed — please enter Native Place / Hometown.';
        }
        if (!residentialAddress.trim()) {
          errors.residentialAddress = 'This field was missed — please enter Complete Residential Address.';
        }
      }
    } else if (step === 4) {
      if (hasChildren) {
        if (isNew && children.length === 0) {
          errors.childrenList = 'Please add at least one child or toggle "Have children?" off.';
        }
        children.forEach((child, index) => {
          const childLabel = child.name.trim() || `Royal Heir #${index + 1}`;
          if (child.dob && child.dob < '1988-01-01') {
            errors[`childDob_${child.id}`] = `Date of Birth for ${childLabel} must be on or after 01 Jan 1988 (1987 and earlier not allowed).`;
          } else if (isNew && !child.dob) {
            errors[`childDob_${child.id}`] = `This field was missed — please select Date of Birth for ${childLabel}.`;
          }
          if (isNew) {
            if (!child.name.trim()) {
              errors[`childName_${child.id}`] = `This field was missed — please enter Full Name for Royal Heir #${index + 1}.`;
            }
            if (!child.education.trim()) {
              errors[`childEducation_${child.id}`] = `This field was missed — please enter School / College / Profession for ${childLabel}.`;
            }
            if (!child.photo_url?.trim()) {
              errors[`childPhoto_${child.id}`] = `This field was missed — please upload Kid Photo with Parents for ${childLabel}.`;
            }
          }
        });
      }
    } else if (step === 5) {
      if (isNew) {
        if (contributionAreas.length === 0) {
          errors.contributionAreas = 'This field was missed — please select at least one contribution area.';
        }
        if (!royalIdea.trim()) {
          errors.royalIdea = 'This field was missed — please share One Grand Idea for JSG Royals Chapter 2 (2027).';
        }
        if (appOtherGroup === 'Yes' && !appOtherGroupName.trim()) {
          errors.appOtherGroupName = 'This field was missed — please enter the Group Name.';
        }
        if (!appBusinessDesc.trim()) {
          errors.appBusinessDesc = 'This field was missed — please provide short Business/Job details.';
        }
        if (!appContribution.trim()) {
          errors.appContribution = 'This field was missed — please share how you can contribute to the group.';
        }
        if (!appRefName.trim()) {
          errors.appRefName = 'This field was missed — please enter Referring Member Name.';
        }
        const rDigits = appRefMobile.replace(/\D/g, '');
        if (rDigits.length !== 10) {
          errors.appRefMobile = rDigits.length === 0
            ? 'This field was missed — please enter Referring Member 10-digit Mobile.'
            : 'Please enter a valid 10-digit mobile number.';
        }
      }
    }

    return errors;
  };

  const getFieldBorderClass = (key: string) =>
    fieldErrors[key]
      ? 'border-red-500 bg-red-50/70 text-red-950 focus:ring-2 focus:ring-red-400/50 focus:border-red-600 transition-colors'
      : 'border-[#D8CAAF] bg-white text-[#1C1917] focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#B89748] transition-colors';

  const getLabelColorClass = (key: string) =>
    fieldErrors[key] ? 'text-red-700' : 'text-[#44403C]';

  const renderFieldError = (key: string) =>
    fieldErrors[key] ? (
      <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-center gap-1">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>{fieldErrors[key]}</span>
      </p>
    ) : null;

  const canProceedStep = () => Object.keys(validateStepFields(activeStep)).length === 0;

  return (
    <div className="min-h-screen bg-royal-parchment text-[#1C1917] selection:bg-[#EFE4C9] selection:text-[#8C6D2B] relative overflow-hidden">
      
      {/* Decorative Golden Ambient Lighting Stars */}
      <div className="absolute top-10 left-10 text-[#D4AF37]/25 text-lg animate-twinkle pointer-events-none select-none">✦</div>
      <div className="absolute top-40 right-16 text-[#C5A869]/20 text-xl animate-twinkle pointer-events-none select-none" style={{ animationDelay: '1.2s' }}>✧</div>
      <div className="absolute top-96 left-1/4 text-[#D4AF37]/15 text-sm animate-twinkle pointer-events-none select-none" style={{ animationDelay: '2.1s' }}>✦</div>
      <div className="absolute bottom-20 right-1/4 text-[#C5A869]/20 text-lg animate-twinkle pointer-events-none select-none" style={{ animationDelay: '0.8s' }}>✧</div>

      {/* ========================================================================= */}
      {/* COMPACT ANIMATED ROYAL LEADERSHIP BANNER (PRESIDENT & SECRETARY)          */}
      {/* ========================================================================= */}
      {currentView === 'gate' && (
        <div className="max-w-2xl mx-auto px-4 pt-5 sm:pt-7 relative z-10 animate-fade-in-up">
          <div className="relative rounded-2xl p-[1px] overflow-hidden royal-box-shadow">
            {/* Orbiting metallic gold border sheen */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[160%] animate-royal-orbit opacity-85"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(212,175,55,0.12) 0deg, rgba(247,232,176,0.9) 55deg, rgba(197,168,105,0.22) 120deg, rgba(247,232,176,0.75) 210deg, rgba(140,109,43,0.18) 290deg, rgba(212,175,55,0.12) 360deg)',
              }}
            />

            <div className="relative rounded-[15px] bg-gradient-to-br from-[#1B1714] via-[#120F0D] to-[#1E1915] px-3 py-2.5 sm:px-4 sm:py-2.5 overflow-hidden">
              {/* Sweeping diagonal specular sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#F5E6B3]/12 to-transparent animate-royal-sheen"
              />
              {/* Soft ambient gold canopy glow */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full bg-[#D4AF37]/15 blur-2xl animate-royal-aura"
              />

              {/* President & Secretary Compact Pedestals */}
              <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 items-stretch">
                {/* President */}
                <div className="group relative rounded-xl bg-white/[0.03] border border-[#C5A869]/30 hover:border-[#D4AF37]/75 px-3 py-2 flex items-center gap-2.5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
                  <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-dashed border-[#D4AF37]/55 animate-royal-orbit"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0.5 rounded-full border border-[#F3DF9C]/35 animate-royal-orbit-reverse"
                    />
                    <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-[#2C241B] to-[#17130F] border border-[#D4AF37]/80 flex items-center justify-center">
                      <Crown className="w-2.5 h-2.5 text-[#F3DF9C]" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C5A869]">
                        President
                      </span>
                      <a
                        href={`tel:${ROYAL_LEADERSHIP.presidentPhone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono tabular-nums text-[#E7DDCE]/90 hover:text-[#F3DF9C] transition-colors shrink-0"
                      >
                        <Phone className="w-2.5 h-2.5 text-[#D4AF37] shrink-0" />
                        <span>{ROYAL_LEADERSHIP.presidentPhone}</span>
                      </a>
                    </div>
                    <div className="font-serif-royal font-bold text-xs sm:text-[13px] tracking-wide royal-foil-name truncate leading-snug mt-0.5">
                      {ROYAL_LEADERSHIP.president}
                    </div>
                  </div>
                </div>

                {/* Secretary */}
                <div className="group relative rounded-xl bg-white/[0.03] border border-[#C5A869]/30 hover:border-[#D4AF37]/75 px-3 py-2 flex items-center gap-2.5 transition-transform duration-300 ease-out hover:-translate-y-0.5">
                  <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-dashed border-[#D4AF37]/55 animate-royal-orbit-reverse"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0.5 rounded-full border border-[#F3DF9C]/35 animate-royal-orbit"
                    />
                    <div className="relative w-5 h-5 rounded-full bg-gradient-to-br from-[#2C241B] to-[#17130F] border border-[#D4AF37]/80 flex items-center justify-center">
                      <Award className="w-2.5 h-2.5 text-[#F3DF9C]" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C5A869]">
                        Secretary
                      </span>
                      <a
                        href={`tel:${ROYAL_LEADERSHIP.secretaryPhone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1 text-[10px] font-mono tabular-nums text-[#E7DDCE]/90 hover:text-[#F3DF9C] transition-colors shrink-0"
                      >
                        <Phone className="w-2.5 h-2.5 text-[#D4AF37] shrink-0" />
                        <span>{ROYAL_LEADERSHIP.secretaryPhone}</span>
                      </a>
                    </div>
                    <div className="font-serif-royal font-bold text-xs sm:text-[13px] tracking-wide royal-foil-name truncate leading-snug mt-0.5">
                      {ROYAL_LEADERSHIP.secretary}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: FIRST-FOLD ENTRANCE GATE (MEMBER TYPE + EMAIL ENTRY)              */}
      {/* ========================================================================= */}
      {currentView === 'gate' && (
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-12 sm:pb-16 relative z-10 animate-fade-in-up">
          <div className="bg-[#FFFFFF]/96 backdrop-blur-md border border-[#DFD1B4] rounded-3xl p-6 sm:p-9 relative overflow-hidden royal-box-shadow">
            
            {/* Gilded Top Shimmer Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Centered Royal Crest Emblem */}
            <div className="text-center pt-1 pb-2">
              <RoyalLogo className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-[#D4AF37] mx-auto shadow-xl p-1" />
              <RoyalFlourish className="mt-4 mb-2" />
            </div>

            {/* Alert Banners */}
            {gateError && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50/95 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 shadow-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span className="leading-snug">{gateError}</span>
              </div>
            )}

            {gateSuccessMsg && gateOtpStep === 'otp' && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-50/95 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="leading-snug">{gateSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: MEMBERSHIP TYPE + ROLE + EMAIL INPUT */}
            {gateOtpStep === 'email' && (
              <form onSubmit={handleRequestOtp} noValidate className="space-y-5">
                
                {/* Mandatory Membership Type Selection */}
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 ${
                    gateFieldError === 'membership' ? 'text-red-700' : 'text-[#44403C]'
                  }`}>
                    Membership Type *
                  </label>
                  <div className={`grid grid-cols-2 gap-2 p-1.5 rounded-2xl border ${
                    gateFieldError === 'membership'
                      ? 'border-red-500 bg-red-50/60'
                      : 'border-[#E5D8C0] bg-[#FAF7F2]'
                  }`}>
                    <button
                      type="button"
                      disabled={feeStatus.isRenewalClosed}
                      onClick={() => {
                        if (!feeStatus.isRenewalClosed) {
                          setMembershipChoice('existing');
                          if (gateFieldError === 'membership') setGateFieldError(null);
                          setGateError(null);
                        }
                      }}
                      className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        feeStatus.isRenewalClosed
                          ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                          : membershipChoice === 'existing'
                          ? 'bg-[#1C1917] text-[#F3DF9C] shadow-sm border border-[#D4AF37]/60 cursor-pointer'
                          : 'bg-white text-[#44403C] hover:bg-[#F5EFE6] border border-transparent cursor-pointer'
                      }`}
                    >
                      {feeStatus.isRenewalClosed ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Crown className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">
                        {feeStatus.isRenewalClosed ? 'Existing (Closed)' : 'Existing Member'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMembershipChoice('new');
                        if (gateFieldError === 'membership') setGateFieldError(null);
                        setGateError(null);
                      }}
                      className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                        membershipChoice === 'new'
                          ? 'bg-[#1C1917] text-[#F3DF9C] shadow-sm border border-[#D4AF37]/60'
                          : 'bg-white text-[#44403C] hover:bg-[#F5EFE6] border border-transparent'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">New Member</span>
                    </button>
                  </div>
                  {gateFieldError === 'membership' && (
                    <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>This field was missed — please select Existing Member or New Member.</span>
                    </p>
                  )}
                </div>

                {/* Role Selection (Compact Single Row) */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#44403C] mb-2">
                    Your Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGateRole('husband')}
                      className={`min-h-[44px] py-2.5 px-4 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        gateRole === 'husband'
                          ? 'bg-[#1C1917] border-[#D4AF37] text-[#FAF7F2] shadow-sm'
                          : 'bg-[#FAF7F2] border-[#E5D8C0] text-[#44403C] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <User className={`w-4 h-4 shrink-0 ${gateRole === 'husband' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
                      <span className="font-semibold text-xs whitespace-nowrap">Husband</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGateRole('wife')}
                      className={`min-h-[44px] py-2.5 px-4 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        gateRole === 'wife'
                          ? 'bg-[#1C1917] border-[#D4AF37] text-[#FAF7F2] shadow-sm'
                          : 'bg-[#FAF7F2] border-[#E5D8C0] text-[#44403C] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 shrink-0 ${gateRole === 'wife' ? 'text-[#D4AF37]' : 'text-[#8C6D2B]'}`} />
                      <span className="font-semibold text-xs whitespace-nowrap">Wife</span>
                    </button>
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label className={`block text-[11px] font-semibold uppercase tracking-[0.12em] mb-2 ${
                    gateFieldError === 'email' ? 'text-red-700' : 'text-[#44403C]'
                  }`}>
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 ${
                      gateFieldError === 'email' ? 'text-red-500' : 'text-[#8C6D2B]'
                    }`} />
                    <input
                      type="email"
                      required
                      placeholder="e.g. royalfamily@example.com"
                      value={gateEmail}
                      onChange={(e) => {
                        setGateEmail(e.target.value);
                        if (gateFieldError === 'email') setGateFieldError(null);
                        if (gateError) setGateError(null);
                      }}
                      className={`w-full pl-11 pr-4 py-3.5 rounded-xl border text-sm outline-hidden transition-colors shadow-2xs ${
                        gateFieldError === 'email'
                          ? 'border-red-500 bg-red-50/70 text-red-950 focus:ring-2 focus:ring-red-400/50 focus:border-red-600'
                          : 'border-[#D5C7AD] bg-white text-[#1C1917] focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#B89748]'
                      }`}
                    />
                  </div>
                  {gateFieldError === 'email' && (
                    <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>This field was missed — please enter a valid email address.</span>
                    </p>
                  )}
                </div>

                {/* Send OTP Button */}
                <button
                  type="submit"
                  disabled={sendingOtp}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#1C1917] via-[#2B2520] to-[#171412] hover:from-black hover:to-[#24201C] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2.5 border border-[#C5A869]/60 cursor-pointer"
                >
                  {sendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>
                        {gateEmail.trim().toLowerCase() === 'jsubodh06@gmail.com'
                          ? 'Verifying Access...'
                          : 'Sending Verification Code...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 text-[#D4AF37]" />
                      <span>
                        {gateEmail.trim().toLowerCase() === 'jsubodh06@gmail.com'
                          ? 'Continue to Portal'
                          : 'Send 6-Digit Royal Code'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: 6-DIGIT EMAIL OTP VERIFICATION */}
            {gateOtpStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in">
                
                {/* Back & Email Frame */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFE6D7]">
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    className="text-xs text-[#78716C] hover:text-[#1C1917] flex items-center gap-1.5 cursor-pointer font-medium py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Email</span>
                  </button>
                  <div className="text-xs bg-[#FAF7F2] border border-[#E5D8C0] text-[#44403C] px-3 py-1.5 rounded-lg font-mono flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-[#8C6D2B]" />
                    <span>{gateEmail}</span>
                  </div>
                </div>

                {/* 6-Digit Verification Code Input */}
                <div className="text-center space-y-3">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#44403C]">
                    Enter 6-Digit Royal Verification Code
                  </label>
                  <div className="relative max-w-xs mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      placeholder="••••••"
                      value={gateOtp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setGateOtp(val);
                      }}
                      className="w-full py-4 text-center text-3xl font-mono tabular-nums font-bold tracking-[0.4em] rounded-xl border-2 border-[#D4AF37] bg-white text-[#1C1917] outline-hidden focus:ring-4 focus:ring-[#C5A869]/20 focus:border-[#8C6D2B] transition-all shadow-inner"
                    />
                  </div>
                  <p className="text-[11px] text-[#78716C]">
                    Please check your email inbox and spam folder for your 6-digit code.
                  </p>
                </div>

                {/* Verify Code Button */}
                <button
                  type="submit"
                  disabled={verifyingOtp || gateOtp.length !== 6}
                  className="w-full min-h-[48px] py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#1C1917] via-[#2B2520] to-[#171412] hover:from-black hover:to-[#24201C] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 border border-[#C5A869]/60 cursor-pointer"
                >
                  {verifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>Verifying Royal Code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                      <span>
                        {membershipType === 'new' ? 'Verify Code & Start Application' : 'Verify Code & Enter Dossier'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                    </>
                  )}
                </button>

                {/* Resend Controls */}
                <div className="text-center pt-1">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-[#78716C] font-mono tabular-nums">
                      Resend code in <strong className="text-[#8C6D2B]">{resendCooldown}s</strong>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={sendingOtp}
                      className="text-xs text-[#8C6D2B] hover:text-[#6D531E] font-semibold underline underline-offset-4 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${sendingOtp ? 'animate-spin' : ''}`} />
                      <span>Resend Verification Code</span>
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Smart Cross-Spouse Sync Badge, Query Help & Discreet Admin Link */}
            <div className="mt-7 pt-5 relative text-center space-y-2.5">
              <div className="royal-divider absolute top-0 left-0 right-0" />
              <p className="text-[11px] text-[#57534E] leading-relaxed">
                In case of any query while filling out the form, please contact{' '}
                <strong className="text-[#1C1917]">Subodh Samota</strong> at{' '}
                <a
                  href="tel:+917021509358"
                  className="font-mono tabular-nums font-semibold text-[#8C6D2B] hover:underline whitespace-nowrap"
                >
                  7021509358
                </a>
                .
              </p>
              <p className="text-[11px] text-[#78716C] flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8C6D2B]" />
                <span>Zero Duplicate Entries · Automated Cross-Spouse Synchronization</span>
              </p>
              {onOpenAdmin && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="text-[10px] text-[#A8A29E] hover:text-[#78716C] tracking-[0.14em] uppercase transition-colors cursor-pointer"
                  >
                    Secretariat &amp; Gateway Console
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SPOUSE COMPLETED CELEBRATION / PROCLAMATION SCREEN                */}
      {/* ========================================================================= */}
      {currentView === 'spouse_celebration' && existingRecord && (
        <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16 relative z-10 animate-fade-in-up">
          <div className="bg-[#FFFFFF]/96 backdrop-blur-md border border-[#DFD1B4] rounded-3xl p-6 sm:p-10 relative overflow-hidden space-y-8 royal-box-shadow animate-in fade-in zoom-in-95">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Royal Decree Seal */}
            <div className="text-center space-y-3.5">
              <RoyalLogo className="w-24 h-24 rounded-2xl border-2 border-[#D4AF37] mx-auto shadow-xl animate-ring-float p-1" />

              {existingRecord.membership_type === 'new' || existingRecord.status === 'pending_review' ? (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/80 text-[11px] font-bold uppercase tracking-[0.14em]">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>New Application · Pending Review</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-[11px] font-bold uppercase tracking-[0.14em]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Official Royal Decree Sealed</span>
                </div>
              )}

              <h2 className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#1C1917] leading-tight">
                {spouseNotificationMessage}
              </h2>

              <RoyalFlourish />

              {(existingRecord.membership_type === 'new' || existingRecord.status === 'pending_review') && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs sm:text-sm font-medium max-w-lg mx-auto">
                  This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.
                </div>
              )}

              <p className="text-xs sm:text-sm text-[#78716C] max-w-lg mx-auto leading-relaxed">
                {isFiledBySpouse
                  ? `Your beloved ${spouseRole === 'husband' ? 'husband' : 'wife'} (${spouseName}) has already registered your complete royal household in the JSG Royals Chapter 2 Directory. You do not need to fill out any form!`
                  : `Your family dossier is officially recorded in the JSG Royals Master Directory.`}
              </p>
            </div>

            {/* Interactive Dossier Inspector */}
            <div className="bg-[#FAF7F2] border border-[#E0D2B8] rounded-2xl p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#EAE0CE]">
                <div className="flex items-center gap-2.5">
                  <RoyalLogo className="w-6 h-6 rounded-md border border-[#C5A869]/70 p-0.5" />
                  <span className="font-serif-royal font-bold text-sm text-[#1C1917]">
                    Royal Household Dossier Breakdown
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-[#78716C]">Reg Code:</span>
                  <span className="font-mono text-xs font-bold text-[#8C6D2B] bg-white px-2 py-0.5 rounded border border-[#E2D5BE]">
                    {existingRecord.reg_id}
                  </span>
                </div>
              </div>

              {/* Husband & Wife Side-by-Side Presentation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Husband Dossier Card */}
                <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D2B]">
                      🤵 Royal Gentleman
                    </span>
                    {existingRecord.submitted_by_role === 'husband' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        Submitted by him
                      </span>
                    )}
                  </div>
                  <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                    {existingRecord.husband_name}
                  </div>
                  <div className="text-xs text-[#57534E] space-y-1 pt-2 border-t border-[#F0E8DC]">
                    <div>📱 <span className="font-mono">{existingRecord.husband_mobile}</span></div>
                    <div>✉️ {existingRecord.husband_email}</div>
                    {existingRecord.husband_dob && <div>🎂 DOB: <strong>{existingRecord.husband_dob}</strong></div>}
                    {existingRecord.husband_qualification && <div>🎓 {existingRecord.husband_qualification}</div>}
                    {existingRecord.husband_blood_group && (
                      <div>🩸 Blood Group: <strong>{existingRecord.husband_blood_group}</strong></div>
                    )}
                    {existingRecord.husband_occupation && (
                      <div>💼 {existingRecord.husband_occupation} {existingRecord.husband_organization ? `at ${existingRecord.husband_organization}` : ''}</div>
                    )}
                    {existingRecord.husband_instagram && (
                      <div>📷 Instagram: <strong>{existingRecord.husband_instagram}</strong></div>
                    )}
                    <DossierPhotoThumbnail url={existingRecord.husband_photo_url} alt={existingRecord.husband_name} />
                  </div>
                </div>

                {/* Wife Dossier Card */}
                <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D2B]">
                      👰 Royal Lady
                    </span>
                    {existingRecord.submitted_by_role === 'wife' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        Submitted by her
                      </span>
                    )}
                  </div>
                  <div className="font-serif-royal font-bold text-base text-[#1C1917]">
                    {existingRecord.wife_name}
                  </div>
                  <div className="text-xs text-[#57534E] space-y-1 pt-2 border-t border-[#F0E8DC]">
                    <div>📱 <span className="font-mono">{existingRecord.wife_mobile}</span></div>
                    <div>✉️ {existingRecord.wife_email}</div>
                    {existingRecord.wife_dob && <div>🎂 DOB: <strong>{existingRecord.wife_dob}</strong></div>}
                    {existingRecord.wife_qualification && <div>🎓 {existingRecord.wife_qualification}</div>}
                    {existingRecord.wife_blood_group && (
                      <div>🩸 Blood Group: <strong>{existingRecord.wife_blood_group}</strong></div>
                    )}
                    {existingRecord.wife_occupation && (
                      <div>💼 {existingRecord.wife_occupation} {existingRecord.wife_organization ? `at ${existingRecord.wife_organization}` : ''}</div>
                    )}
                    {existingRecord.wife_instagram && (
                      <div>📷 Instagram: <strong>{existingRecord.wife_instagram}</strong></div>
                    )}
                    <DossierPhotoThumbnail url={existingRecord.wife_photo_url} alt={existingRecord.wife_name} />
                  </div>
                </div>
              </div>

              {/* Union & Residence */}
              <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">Marriage Anniversary</span>
                  <span className="font-semibold text-[#1C1917]">{existingRecord.marriage_anniversary}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">City {existingRecord.native_place ? '• Native Place' : ''}</span>
                  <span className="font-semibold text-[#1C1917]">
                    {existingRecord.current_city}
                    {existingRecord.native_place ? ` • ${existingRecord.native_place}` : ''}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">Residential Address</span>
                  <span className="text-[#57534E] block">{existingRecord.residential_address}</span>
                </div>
                {existingRecord.couple_photo_url && (
                  <div className="sm:col-span-2 pt-2 border-t border-[#F0E8DC] space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-[#8C6D2B] block">
                      💑 Couple Photo
                    </span>
                    <DossierPhotoThumbnail url={existingRecord.couple_photo_url} alt="Couple Photo" />
                  </div>
                )}
              </div>

              {/* Children */}
              {existingRecord.children && existingRecord.children.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D2B] block">
                    👶 Royal Heirs ({existingRecord.children.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {existingRecord.children.map((child: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-white border border-[#E7DDCE] text-xs space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#1C1917]">{child.name || `Royal Heir #${idx + 1}`}</div>
                            {child.dob && <div className="text-[11px] text-[#57534E]">🎂 DOB: {child.dob}</div>}
                            {child.education && <div className="text-[11px] text-[#78716C]">🎓 {child.education}</div>}
                            {child.interests && <div className="text-[11px] text-[#78716C]">✨ {child.interests}</div>}
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-[#FAF7F2] text-[#8C6D2B] shrink-0">
                            {child.gender === 'daughter' ? 'Daughter' : 'Son'}
                          </span>
                        </div>
                        <DossierPhotoThumbnail url={child.photo_url} alt={child.name || `Child ${idx + 1}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Family Photo Preview */}
              {existingRecord.family_photo_url && (
                <div className="text-center pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D2B] block mb-2">
                    📸 Registered Royal Family Portrait
                  </span>
                  <div className="flex justify-center">
                    <DossierPhotoThumbnail url={existingRecord.family_photo_url} alt="Royal Family Portrait" />
                  </div>
                </div>
              )}

              {(existingRecord.contribution_areas || existingRecord.royal_idea || existingRecord.president_name || existingRecord.secretary_name) && (
                <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] text-xs space-y-2.5">
                  {(existingRecord.president_name || existingRecord.secretary_name) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2 border-b border-[#F0E8DC]">
                      {existingRecord.president_name && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#78716C] block">President</span>
                          <span className="text-[#1C1917] font-semibold">
                            {existingRecord.president_name}
                            {existingRecord.president_mobile ? ` · ${existingRecord.president_mobile}` : ''}
                          </span>
                        </div>
                      )}
                      {existingRecord.secretary_name && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#78716C] block">Secretary</span>
                          <span className="text-[#1C1917] font-semibold">
                            {existingRecord.secretary_name}
                            {existingRecord.secretary_mobile ? ` · ${existingRecord.secretary_mobile}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {existingRecord.contribution_areas && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#78716C] block">Contribution Areas</span>
                      <span className="text-[#1C1917] font-medium">{existingRecord.contribution_areas}</span>
                    </div>
                  )}
                  {existingRecord.royal_idea && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#78716C] block">Royal Chapter 2 Idea</span>
                      <span className="text-[#57534E] italic">"{existingRecord.royal_idea}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Applicable Membership Fees & Where to Submit Fees */}
            <MembershipFeeSubmissionSection
              membershipKind={existingRecord.membership_type === 'new' ? 'new' : 'existing'}
              feeStatus={feeStatus}
              expandedAddresses={expandedAddresses}
              setExpandedAddresses={setExpandedAddresses}
            />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={handleEditExistingRecord}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-[#C5A869]/60 cursor-pointer shadow-md"
              >
                <Crown className="w-4 h-4 text-[#D4AF37]" />
                <span>Update Existing Registration</span>
              </button>

              <button
                type="button"
                onClick={triggerConfettiFanfare}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-[#FAF7F2] hover:bg-[#F3ECE0] text-[#1C1917] font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-[#D8CAAF] cursor-pointer"
              >
                <PartyPopper className="w-4 h-4 text-[#8C6D2B]" />
                <span>Launch Confetti Celebration</span>
              </button>

              <button
                type="button"
                onClick={resetToEntrance}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#1C1917] font-semibold text-xs border border-[#D8CAAF] transition-all cursor-pointer"
              >
                ← Return to Entrance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: UNIFIED MULTI-STEP FAMILY DOSSIER FORM (EXISTING & NEW MEMBERS)   */}
      {/* ========================================================================= */}
      {currentView === 'form' && isEmailVerified && (membershipType === 'new' || !feeStatus.isRenewalClosed) && (
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-9 space-y-5 relative z-10 animate-fade-in-up">
          
          <div className="bg-[#FFFFFF]/96 backdrop-blur-md border border-[#DFD1B4] rounded-3xl p-5 sm:p-8 space-y-5 royal-box-shadow relative overflow-hidden">
            
            <div className="absolute top-0 left-0 right-0 h-1 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Stepper Header */}
            <div className="space-y-4 pb-4 border-b border-[#EAE0CE]">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8C6D2B] flex items-center gap-1.5">
                    <span className="text-[#D4AF37]">✦</span>
                    <span>
                      Step {activeStep} of {totalSteps} ·{' '}
                      {membershipType === 'new' ? 'New Member Application' : 'Existing Member Update'}
                    </span>
                  </span>
                  <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917] mt-1 tracking-tight">
                    {activeStep === 1 && 'Husband Details'}
                    {activeStep === 2 && 'Wife Details'}
                    {activeStep === 3 &&
                      (membershipType === 'existing'
                        ? 'Address & Couple Photo (Optional)'
                        : 'Marriage & Residence Details')}
                    {activeStep === 4 &&
                      (membershipType === 'existing' ? 'Children Details (Optional)' : 'Children Details')}
                    {activeStep === 5 &&
                      (membershipType === 'existing'
                        ? 'JSG Royals – Your Experience Matters!'
                        : 'Ideas & Reference')}
                    {activeStep === 6 && 'Review & Submit'}
                  </h2>
                </div>

                <div className="text-[11px] uppercase tracking-[0.14em] text-[#78716C] font-medium whitespace-nowrap">
                  JSG Royals · Chapter 2 · 2027
                </div>
              </div>

              {/* Step Navigation Bar */}
              <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {[
                  { num: 1, label: 'Husband' },
                  { num: 2, label: 'Wife' },
                  { num: 3, label: membershipType === 'existing' ? 'Address' : 'Residence' },
                  { num: 4, label: 'Children' },
                  { num: 5, label: membershipType === 'existing' ? 'Feedback' : 'Ideas' },
                  { num: 6, label: 'Review' }
                ].map((s) => {
                  const isCurrent = s.num === activeStep;
                  const isCompleted = s.num < activeStep;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (isCompleted) {
                          setFieldErrors({});
                          setSubmitError(null);
                          setActiveStep(s.num);
                          return;
                        }
                        if (s.num === activeStep) return;
                        for (let step = activeStep; step < s.num; step++) {
                          const errs = validateStepFields(step);
                          if (Object.keys(errs).length > 0) {
                            setFieldErrors(errs);
                            setSubmitError(`Please fill the highlighted required field(s) in Step ${step} before continuing.`);
                            setActiveStep(step);
                            scrollToFirstError();
                            return;
                          }
                        }
                        setFieldErrors({});
                        setSubmitError(null);
                        setActiveStep(s.num);
                      }}
                      className={`min-h-[38px] flex items-center justify-center sm:justify-start gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[#1C1917] text-[#F3DF9C] border border-[#D4AF37]/80 shadow-xs'
                          : isCompleted
                          ? 'bg-[#FAF6EE] text-[#8C6D2B] hover:bg-[#F2ECE1] border border-[#DECFAF]'
                          : 'bg-[#FBF9F5] text-[#A8A29E] border border-[#EFE6D7] hover:border-[#DFD1B4]'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isCurrent ? 'bg-[#312B26] text-[#F3DF9C]' : isCompleted ? 'bg-[#8C6D2B] text-white' : 'bg-[#EAE0CE] text-[#78716C]'
                      }`}>
                        {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                      </span>
                      <span className="hidden sm:inline truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Form Step Contents */}
            <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
              
              {/* STEP 1: HUSBAND DETAILS */}
              {activeStep === 1 && (
                <div key={1} className="space-y-4 animate-fade-in-up">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandName')}`}>
                        Husband Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        data-field-error={fieldErrors.husbandName ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.husbandName)}
                        placeholder="e.g. Subodh Samota"
                        value={husbandName}
                        onChange={(e) => {
                          setHusbandName(e.target.value);
                          clearFieldError('husbandName');
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandName')}`}
                      />
                      {renderFieldError('husbandName')}
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandMobile')}`}>
                        Husband Registered Mobile *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          data-field-error={fieldErrors.husbandMobile ? 'true' : undefined}
                          aria-invalid={Boolean(fieldErrors.husbandMobile)}
                          placeholder="10-digit mobile"
                          value={husbandMobile}
                          onChange={(e) => {
                            setHusbandMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                            clearFieldError('husbandMobile');
                          }}
                          className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-xs font-mono outline-hidden ${getFieldBorderClass('husbandMobile')}`}
                        />
                      </div>
                      {renderFieldError('husbandMobile')}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`block text-xs font-semibold uppercase tracking-wider ${getLabelColorClass('husbandEmail')}`}>
                          Husband Unique Email *
                        </label>
                        {gateRole === 'husband' && gateEmail && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isEmailVerified ? 'text-emerald-800 bg-emerald-100 border border-emerald-200' : 'text-[#8C6D2B] bg-[#F1E9DA]'
                          }`}>
                            <CheckCircle2 className={`w-3 h-3 ${isEmailVerified ? 'text-emerald-600' : 'text-[#8C6D2B]'}`} />
                            {isEmailVerified ? 'Verified via Email OTP' : 'Pre-filled from Entrance'}
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        required
                        data-field-error={fieldErrors.husbandEmail ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.husbandEmail)}
                        placeholder="husband@example.com"
                        value={husbandEmail}
                        onChange={(e) => {
                          setHusbandEmail(e.target.value);
                          clearFieldError('husbandEmail');
                        }}
                        onBlur={() => {
                          if (gateRole === 'wife') {
                            handleCheckSpouseEmailOnBlur(husbandEmail, 'husband');
                          }
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandEmail')}`}
                      />
                      {renderFieldError('husbandEmail')}
                    </div>

                    {membershipType === 'new' && (
                      <>
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandDob')}`}>
                            Date of Birth *
                          </label>
                          <input
                            type="date"
                            min="1988-01-01"
                            required
                            data-field-error={fieldErrors.husbandDob ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.husbandDob)}
                            value={husbandDob}
                            onChange={(e) => {
                              setHusbandDob(e.target.value);
                              clearFieldError('husbandDob');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandDob')}`}
                          />
                          <span className="block mt-1 text-[10px] text-[#78716C]">
                            Born on or after 1 Jan 1988 (age limit)
                          </span>
                          {renderFieldError('husbandDob')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandBloodGroup')}`}>
                            Blood Group *
                          </label>
                          <select
                            required
                            data-field-error={fieldErrors.husbandBloodGroup ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.husbandBloodGroup)}
                            value={husbandBloodGroup}
                            onChange={(e) => {
                              setHusbandBloodGroup(e.target.value);
                              clearFieldError('husbandBloodGroup');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandBloodGroup')}`}
                          >
                            <option value="">Select Blood Group</option>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                          {renderFieldError('husbandBloodGroup')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandQualification')}`}>
                            Highest Educational Qualification *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.husbandQualification ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.husbandQualification)}
                            placeholder="e.g. MBA / B.Tech / CA"
                            value={husbandQualification}
                            onChange={(e) => {
                              setHusbandQualification(e.target.value);
                              clearFieldError('husbandQualification');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandQualification')}`}
                          />
                          {renderFieldError('husbandQualification')}
                        </div>
                      </>
                    )}

                    {membershipType === 'new' && (
                      <>
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandOccupation')}`}>
                            Occupation / Profession *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.husbandOccupation ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.husbandOccupation)}
                            placeholder="e.g. Business / Software Architect"
                            value={husbandOccupation}
                            onChange={(e) => {
                              setHusbandOccupation(e.target.value);
                              clearFieldError('husbandOccupation');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandOccupation')}`}
                          />
                          {renderFieldError('husbandOccupation')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandOrganization')}`}>
                            Company / Business / Organization *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.husbandOrganization ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.husbandOrganization)}
                            placeholder="e.g. Samota Industries"
                            value={husbandOrganization}
                            onChange={(e) => {
                              setHusbandOrganization(e.target.value);
                              clearFieldError('husbandOrganization');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandOrganization')}`}
                          />
                          {renderFieldError('husbandOrganization')}
                        </div>
                      </>
                    )}

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('husbandInstagram')}`}>
                        Instagram Handle *
                      </label>
                      <input
                        type="text"
                        required
                        data-field-error={fieldErrors.husbandInstagram ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.husbandInstagram)}
                        placeholder="e.g. @subodh_samota"
                        value={husbandInstagram}
                        onChange={(e) => {
                          setHusbandInstagram(e.target.value);
                          clearFieldError('husbandInstagram');
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('husbandInstagram')}`}
                      />
                      {renderFieldError('husbandInstagram')}
                    </div>
                  </div>

                  {/* Husband Photo */}
                  <PhotoUploadOrDriveLink
                    label="Husband Photo"
                    labelNote={
                      membershipType === 'existing'
                        ? '(Upload new photo if you want to update previous photo)'
                        : undefined
                    }
                    value={husbandPhotoUrl}
                    required={membershipType === 'new'}
                    fieldError={fieldErrors.husbandPhotoUrl}
                    onChange={(url) => {
                      setHusbandPhotoUrl(url);
                      if (url) clearFieldError('husbandPhotoUrl');
                    }}
                  />
                </div>
              )}

              {/* STEP 2: WIFE DETAILS */}
              {activeStep === 2 && (
                <div key={2} className="space-y-4 animate-fade-in-up">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeName')}`}>
                        Wife Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        data-field-error={fieldErrors.wifeName ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.wifeName)}
                        placeholder="e.g. Shaily Agrawal"
                        value={wifeName}
                        onChange={(e) => {
                          setWifeName(e.target.value);
                          clearFieldError('wifeName');
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeName')}`}
                      />
                      {renderFieldError('wifeName')}
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeMobile')}`}>
                        Wife Registered Mobile *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          data-field-error={fieldErrors.wifeMobile ? 'true' : undefined}
                          aria-invalid={Boolean(fieldErrors.wifeMobile)}
                          placeholder="10-digit mobile"
                          value={wifeMobile}
                          onChange={(e) => {
                            setWifeMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                            clearFieldError('wifeMobile');
                          }}
                          className={`w-full pl-11 pr-4 py-2.5 rounded-xl border text-xs font-mono outline-hidden ${getFieldBorderClass('wifeMobile')}`}
                        />
                      </div>
                      {renderFieldError('wifeMobile')}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`block text-xs font-semibold uppercase tracking-wider ${getLabelColorClass('wifeEmail')}`}>
                          Wife Unique Email *
                        </label>
                        {gateRole === 'wife' && gateEmail && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isEmailVerified ? 'text-emerald-800 bg-emerald-100 border border-emerald-200' : 'text-[#8C6D2B] bg-[#F1E9DA]'
                          }`}>
                            <CheckCircle2 className={`w-3 h-3 ${isEmailVerified ? 'text-emerald-600' : 'text-[#8C6D2B]'}`} />
                            {isEmailVerified ? 'Verified via Email OTP' : 'Pre-filled from Entrance'}
                          </span>
                        )}
                      </div>
                      <input
                        type="email"
                        required
                        data-field-error={fieldErrors.wifeEmail ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.wifeEmail)}
                        placeholder="wife@example.com"
                        value={wifeEmail}
                        onChange={(e) => {
                          setWifeEmail(e.target.value);
                          clearFieldError('wifeEmail');
                        }}
                        onBlur={() => {
                          if (gateRole === 'husband') {
                            handleCheckSpouseEmailOnBlur(wifeEmail, 'wife');
                          }
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeEmail')}`}
                      />
                      {renderFieldError('wifeEmail')}
                    </div>

                    {membershipType === 'new' && (
                      <>
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeDob')}`}>
                            Date of Birth *
                          </label>
                          <input
                            type="date"
                            min="1988-01-01"
                            required
                            data-field-error={fieldErrors.wifeDob ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.wifeDob)}
                            value={wifeDob}
                            onChange={(e) => {
                              setWifeDob(e.target.value);
                              clearFieldError('wifeDob');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeDob')}`}
                          />
                          <span className="block mt-1 text-[10px] text-[#78716C]">
                            Born on or after 1 Jan 1988 (age limit)
                          </span>
                          {renderFieldError('wifeDob')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeBloodGroup')}`}>
                            Blood Group *
                          </label>
                          <select
                            required
                            data-field-error={fieldErrors.wifeBloodGroup ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.wifeBloodGroup)}
                            value={wifeBloodGroup}
                            onChange={(e) => {
                              setWifeBloodGroup(e.target.value);
                              clearFieldError('wifeBloodGroup');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeBloodGroup')}`}
                          >
                            <option value="">Select Blood Group</option>
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                          {renderFieldError('wifeBloodGroup')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeQualification')}`}>
                            Highest Educational Qualification *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.wifeQualification ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.wifeQualification)}
                            placeholder="e.g. MBA / MSc / B.Arch"
                            value={wifeQualification}
                            onChange={(e) => {
                              setWifeQualification(e.target.value);
                              clearFieldError('wifeQualification');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeQualification')}`}
                          />
                          {renderFieldError('wifeQualification')}
                        </div>
                      </>
                    )}

                    {membershipType === 'new' && (
                      <>
                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeOccupation')}`}>
                            Occupation / Profession *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.wifeOccupation ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.wifeOccupation)}
                            placeholder="e.g. Product Manager / Homemaker"
                            value={wifeOccupation}
                            onChange={(e) => {
                              setWifeOccupation(e.target.value);
                              clearFieldError('wifeOccupation');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeOccupation')}`}
                          />
                          {renderFieldError('wifeOccupation')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeOrganization')}`}>
                            Company / Business / Organization *
                          </label>
                          <input
                            type="text"
                            required
                            data-field-error={fieldErrors.wifeOrganization ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.wifeOrganization)}
                            placeholder="e.g. Swiggy / Entrepreneur"
                            value={wifeOrganization}
                            onChange={(e) => {
                              setWifeOrganization(e.target.value);
                              clearFieldError('wifeOrganization');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeOrganization')}`}
                          />
                          {renderFieldError('wifeOrganization')}
                        </div>
                      </>
                    )}

                    <div>
                      <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('wifeInstagram')}`}>
                        Instagram Handle *
                      </label>
                      <input
                        type="text"
                        required
                        data-field-error={fieldErrors.wifeInstagram ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.wifeInstagram)}
                        placeholder="e.g. @shaily_agrawal"
                        value={wifeInstagram}
                        onChange={(e) => {
                          setWifeInstagram(e.target.value);
                          clearFieldError('wifeInstagram');
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('wifeInstagram')}`}
                      />
                      {renderFieldError('wifeInstagram')}
                    </div>
                  </div>

                  {/* Wife Photo */}
                  <PhotoUploadOrDriveLink
                    label="Wife Photo"
                    labelNote={
                      membershipType === 'existing'
                        ? '(Upload new photo if you want to update previous photo)'
                        : undefined
                    }
                    value={wifePhotoUrl}
                    required={membershipType === 'new'}
                    fieldError={fieldErrors.wifePhotoUrl}
                    onChange={(url) => {
                      setWifePhotoUrl(url);
                      if (url) clearFieldError('wifePhotoUrl');
                    }}
                  />
                </div>
              )}

              {/* STEP 3: ADDRESS & COUPLE PHOTO / MARRIAGE & RESIDENCE */}
              {activeStep === 3 && (
                <div key={3} className="space-y-4 animate-fade-in-up">

                  {/* Anniversary Spotlight (fixed data — New Members only) */}
                  {membershipType === 'new' && (
                    <div className={`p-5 sm:p-6 rounded-2xl border space-y-3.5 shadow-2xs ${
                      fieldErrors.marriageAnniversary
                        ? 'bg-red-50/60 border-red-400'
                        : 'bg-gradient-to-br from-[#FAF7F2] to-[#F4ECE0] border-[#E0D2B8]'
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Gem className={`w-4 h-4 ${fieldErrors.marriageAnniversary ? 'text-red-600' : 'text-[#8C6D2B]'}`} />
                          <label className={`text-xs font-semibold uppercase tracking-wider ${getLabelColorClass('marriageAnniversary')}`}>
                            💍 Marriage Anniversary Date *
                          </label>
                        </div>
                        {yearsTogether !== null && (
                          <span className="px-3 py-1 rounded-lg bg-[#1C1917] text-[#F3DF9C] font-serif-royal font-bold text-[11px] border border-[#C5A869]/50 tabular-nums">
                            {yearsTogether} Glorious Years Together
                          </span>
                        )}
                      </div>

                      <input
                        type="date"
                        required
                        data-field-error={fieldErrors.marriageAnniversary ? 'true' : undefined}
                        aria-invalid={Boolean(fieldErrors.marriageAnniversary)}
                        value={marriageAnniversary}
                        onChange={(e) => {
                          setMarriageAnniversary(e.target.value);
                          clearFieldError('marriageAnniversary');
                          if (e.target.value) {
                            triggerConfettiFanfare();
                          }
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('marriageAnniversary')}`}
                      />
                      {renderFieldError('marriageAnniversary')}
                    </div>
                  )}

                  {/* Couple Photo */}
                  <PhotoUploadOrDriveLink
                    label="Couple Photo (Husband & Wife Together)"
                    labelNote={
                      membershipType === 'existing'
                        ? '(Upload new photo if you want to update previous photo)'
                        : undefined
                    }
                    value={couplePhotoUrl}
                    required={membershipType === 'new'}
                    fieldError={fieldErrors.couplePhotoUrl}
                    onChange={(url) => {
                      setCouplePhotoUrl(url);
                      if (url) clearFieldError('couplePhotoUrl');
                    }}
                  />

                  {membershipType === 'new' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('currentCity')}`}>
                          Current City of Residence *
                        </label>
                        <input
                          type="text"
                          required
                          data-field-error={fieldErrors.currentCity ? 'true' : undefined}
                          aria-invalid={Boolean(fieldErrors.currentCity)}
                          placeholder="e.g. Indore"
                          value={currentCity}
                          onChange={(e) => {
                            setCurrentCity(e.target.value);
                            clearFieldError('currentCity');
                          }}
                          className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('currentCity')}`}
                        />
                        {renderFieldError('currentCity')}
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('nativePlace')}`}>
                          Native Place / Hometown *
                        </label>
                        <input
                          type="text"
                          required
                          data-field-error={fieldErrors.nativePlace ? 'true' : undefined}
                          aria-invalid={Boolean(fieldErrors.nativePlace)}
                          placeholder="e.g. Ratlam, Udaipur, Indore"
                          value={nativePlace}
                          onChange={(e) => {
                            setNativePlace(e.target.value);
                            clearFieldError('nativePlace');
                          }}
                          className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('nativePlace')}`}
                        />
                        {renderFieldError('nativePlace')}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('residentialAddress')}`}>
                      Complete Residential Address {membershipType === 'new' ? '*' : ''}
                    </label>
                    <textarea
                      required={membershipType === 'new'}
                      rows={3}
                      data-field-error={fieldErrors.residentialAddress ? 'true' : undefined}
                      aria-invalid={Boolean(fieldErrors.residentialAddress)}
                      placeholder="House/Bungalow number, street, colony, landmark, pincode..."
                      value={residentialAddress}
                      onChange={(e) => {
                        setResidentialAddress(e.target.value);
                        clearFieldError('residentialAddress');
                      }}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('residentialAddress')}`}
                    />
                    {renderFieldError('residentialAddress')}
                  </div>
                </div>
              )}

              {/* STEP 4: CHILDREN */}
              {activeStep === 4 && (
                <div key={4} className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <span className="font-serif-royal font-bold text-sm text-[#1C1917]">
                      Have children?
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !hasChildren;
                        setHasChildren(next);
                        clearFieldError('childrenList');
                        if (next && children.length === 0) {
                          handleAddChild();
                        }
                      }}
                      className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                        hasChildren ? 'bg-[#1C1917]' : 'bg-[#D9CDB8]'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        hasChildren ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {renderFieldError('childrenList')}

                  {hasChildren ? (
                    <div className="space-y-4">
                      {children.map((child, index) => (
                        <div
                          key={child.id}
                          className="p-4 rounded-2xl bg-white border border-[#E2D5BE] space-y-3 relative group shadow-2xs"
                        >
                          <div className="flex items-center justify-between border-b border-[#F0E8DC] pb-2">
                            <span className="font-serif-royal font-bold text-xs text-[#8C6D2B] flex items-center gap-1.5">
                              <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>Child #{index + 1}</span>
                            </span>
                            {children.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveChild(child.id)}
                                className="text-xs text-red-600 hover:text-red-800 p-1 rounded-lg transition-colors cursor-pointer"
                                title="Remove child"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className={`block text-[11px] font-semibold uppercase mb-1 ${getLabelColorClass(`childName_${child.id}`)}`}>
                                Child Full Name {membershipType === 'new' ? '*' : ''}
                              </label>
                              <input
                                type="text"
                                required={membershipType === 'new'}
                                data-field-error={fieldErrors[`childName_${child.id}`] ? 'true' : undefined}
                                aria-invalid={Boolean(fieldErrors[`childName_${child.id}`])}
                                placeholder="Child full name"
                                value={child.name}
                                onChange={(e) => {
                                  handleUpdateChild(child.id, 'name', e.target.value);
                                  clearFieldError(`childName_${child.id}`);
                                }}
                                className={`w-full px-3 py-2 rounded-lg border text-xs outline-hidden ${getFieldBorderClass(`childName_${child.id}`)}`}
                              />
                              {renderFieldError(`childName_${child.id}`)}
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase text-[#44403C] mb-1">
                                Gender {membershipType === 'new' ? '*' : ''}
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChild(child.id, 'gender', 'son')}
                                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    child.gender === 'son'
                                      ? 'bg-[#1C1917] text-[#D4AF37] border-[#C5A869]'
                                      : 'bg-white text-[#78716C] border-[#D9CDB8]'
                                  }`}
                                >
                                  Son (Prince)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateChild(child.id, 'gender', 'daughter')}
                                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    child.gender === 'daughter'
                                      ? 'bg-[#1C1917] text-[#D4AF37] border-[#C5A869]'
                                      : 'bg-white text-[#78716C] border-[#D9CDB8]'
                                  }`}
                                >
                                  Daughter (Princess)
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className={`block text-[11px] font-semibold uppercase mb-1 ${getLabelColorClass(`childDob_${child.id}`)}`}>
                                Date of Birth / Age {membershipType === 'new' ? '*' : ''}
                              </label>
                              <input
                                type="date"
                                min="1988-01-01"
                                required={membershipType === 'new'}
                                data-field-error={fieldErrors[`childDob_${child.id}`] ? 'true' : undefined}
                                aria-invalid={Boolean(fieldErrors[`childDob_${child.id}`])}
                                value={child.dob}
                                onChange={(e) => {
                                  handleUpdateChild(child.id, 'dob', e.target.value);
                                  clearFieldError(`childDob_${child.id}`);
                                }}
                                className={`w-full px-3 py-2 rounded-lg border text-xs outline-hidden ${getFieldBorderClass(`childDob_${child.id}`)}`}
                              />
                              <span className="block mt-1 text-[10px] text-[#78716C]">
                                Born on or after 1 Jan 1988 (age limit)
                              </span>
                              {renderFieldError(`childDob_${child.id}`)}
                            </div>

                            <div>
                              <label className={`block text-[11px] font-semibold uppercase mb-1 ${getLabelColorClass(`childEducation_${child.id}`)}`}>
                                School / College / Profession {membershipType === 'new' ? '*' : ''}
                              </label>
                              <input
                                type="text"
                                required={membershipType === 'new'}
                                data-field-error={fieldErrors[`childEducation_${child.id}`] ? 'true' : undefined}
                                aria-invalid={Boolean(fieldErrors[`childEducation_${child.id}`])}
                                placeholder="e.g. Daly College / IIT / Working"
                                value={child.education}
                                onChange={(e) => {
                                  handleUpdateChild(child.id, 'education', e.target.value);
                                  clearFieldError(`childEducation_${child.id}`);
                                }}
                                className={`w-full px-3 py-2 rounded-lg border text-xs outline-hidden ${getFieldBorderClass(`childEducation_${child.id}`)}`}
                              />
                              {renderFieldError(`childEducation_${child.id}`)}
                            </div>
                          </div>

                          {/* Child's Photo with Parents */}
                          <PhotoUploadOrDriveLink
                            label={`${child.name.trim() ? `${child.name.trim()} — ` : `Child #${index + 1} — `}Child's Photo with Parents`}
                            labelNote={
                              membershipType === 'existing'
                                ? '(Upload new photo if you want to update previous photo)'
                                : undefined
                            }
                            value={child.photo_url || null}
                            required={membershipType === 'new' && hasChildren}
                            fieldError={fieldErrors[`childPhoto_${child.id}`]}
                            onChange={(url) => {
                              handleUpdateChild(child.id, 'photo_url', url || '');
                              if (url) clearFieldError(`childPhoto_${child.id}`);
                            }}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddChild}
                        className="w-full py-2.5 rounded-xl border border-dashed border-[#8C6D2B] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#8C6D2B] font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Another Child</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-[#FAF7F2] rounded-2xl border border-[#E7DDCE] text-xs text-[#78716C] space-y-1">
                      <Baby className="w-7 h-7 text-[#8C6D2B] mx-auto opacity-50 mb-1" />
                      <div className="font-semibold text-[#1C1917]">No Children Added</div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: EXPERIENCE FEEDBACK (EXISTING) / CONTRIBUTION & IDEAS (NEW) */}
              {activeStep === 5 && (
                <div key={5} className="space-y-5 animate-fade-in-up">
                  {membershipType === 'existing' ? (
                    <div className="space-y-5">
                      {/* Header Banner */}
                      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#1C1917] via-[#24201D] to-[#14110F] text-[#FAF7F2] border border-[#D4AF37]/75 shadow-md space-y-1.5 text-center">
                        <h3 className="font-serif-royal font-bold text-base sm:text-lg tracking-wide text-[#F3DF9C]">
                          JSG ROYALS – YOUR EXPERIENCE MATTERS! 🤍
                        </h3>
                        <p className="text-xs sm:text-sm text-[#E7DDCE]/90">
                          We would love to hear your feedback and ideas to make the next tenure even more exciting!
                        </p>
                      </div>

                      {/* Q1: Overall Experience Rating (1-10) */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] space-y-3">
                        <div>
                          <label className="block text-xs sm:text-sm font-bold text-[#1C1917]">
                            Q1. How would you rate your overall experience with JSG Royals in the last tenure?
                          </label>
                          <span className="text-[11px] text-[#78716C] block mt-0.5">
                            (Rate on a scale of 1–10)
                          </span>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                            const selected = expRating === score;
                            return (
                              <button
                                key={score}
                                type="button"
                                onClick={() => setExpRating(selected ? null : score)}
                                className={`min-h-[42px] rounded-xl text-sm font-bold tabular-nums border transition-all cursor-pointer flex items-center justify-center ${
                                  selected
                                    ? 'bg-[#1C1917] text-[#F3DF9C] border-[#D4AF37] shadow-sm scale-[1.03]'
                                    : 'bg-white text-[#44403C] border-[#D9CDB8] hover:border-[#B89748] hover:bg-[#FAF6EE]'
                                }`}
                              >
                                {score}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#78716C] font-medium px-0.5">
                          <span>1 · Needs Improvement</span>
                          {expRating !== null && (
                            <span className="text-[#8C6D2B] font-bold">
                              Selected: {expRating} / 10
                            </span>
                          )}
                          <span>10 · Extraordinary</span>
                        </div>
                      </div>

                      {/* Q2: Favourite Event / Experience */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2D5BE] space-y-2">
                        <label className="block text-xs sm:text-sm font-bold text-[#1C1917]">
                          Q2. Which event or experience was your absolute favourite from the last tenure?
                        </label>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          placeholder="Share your favourite event, celebration, or memorable moment..."
                          value={expFavouriteEvent}
                          onChange={(e) => setExpFavouriteEvent(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-[#D8CAAF] bg-[#FAF7F2]/50 focus:bg-white text-xs text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#B89748] transition-colors"
                        />
                      </div>

                      {/* Q3: International Trip Interest */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2D5BE] space-y-3">
                        <label className="block text-xs sm:text-sm font-bold text-[#1C1917]">
                          Q3. Would you be interested in an international trip with JSG Royals?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {(['Yes', 'No'] as const).map((choice) => {
                            const selected = expInternationalTrip === choice;
                            return (
                              <button
                                key={choice}
                                type="button"
                                onClick={() => {
                                  const next = selected ? '' : choice;
                                  setExpInternationalTrip(next);
                                  if (next !== 'Yes') {
                                    setExpTripMonthDestination('');
                                  }
                                }}
                                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                  selected
                                    ? 'bg-[#1C1917] text-[#F3DF9C] border-[#D4AF37] shadow-xs'
                                    : 'bg-[#FAF7F2] text-[#44403C] border-[#D9CDB8] hover:bg-[#F2ECE1]'
                                }`}
                              >
                                {selected && <Check className="w-3.5 h-3.5 text-[#D4AF37]" />}
                                <span>{choice === 'Yes' ? 'Yes, Interested' : 'No'}</span>
                              </button>
                            );
                          })}
                        </div>

                        {expInternationalTrip === 'Yes' && (
                          <div className="pt-1 space-y-1.5 animate-fade-in-up">
                            <label className="block text-xs font-semibold text-[#8C6D2B]">
                              If yes, which month &amp; destination
                            </label>
                            <input
                              type="text"
                              maxLength={300}
                              placeholder="e.g. May / June — Europe, Bali, Dubai, Japan..."
                              value={expTripMonthDestination}
                              onChange={(e) => setExpTripMonthDestination(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-[#D8CAAF] bg-white text-xs text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#B89748] transition-colors"
                            />
                          </div>
                        )}
                      </div>

                      {/* Q4: What Was Missing */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2D5BE] space-y-2">
                        <label className="block text-xs sm:text-sm font-bold text-[#1C1917]">
                          Q4. What was missing from the last tenure?
                        </label>
                        <textarea
                          rows={3}
                          maxLength={2000}
                          placeholder="Share any honest suggestions, activities, or experiences you would love to see..."
                          value={expMissing}
                          onChange={(e) => setExpMissing(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-[#D8CAAF] bg-[#FAF7F2]/50 focus:bg-white text-xs text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#D4AF37]/25 focus:border-[#B89748] transition-colors"
                        />
                      </div>

                      {/* Closing Footer Message */}
                      <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#D4AF37]/50 text-center">
                        <p className="text-xs sm:text-sm font-serif-royal font-bold text-[#1C1917]">
                          Your feedback will help us make the next tenure bigger, better and more memorable! ❤️
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Contribution Areas */}
                      <div
                        data-field-error={fieldErrors.contributionAreas ? 'true' : undefined}
                        className={`space-y-2 rounded-2xl transition-colors ${
                          fieldErrors.contributionAreas ? 'bg-red-50/70 border border-red-400 p-3' : ''
                        }`}
                      >
                        <label className={`block text-xs font-semibold uppercase tracking-wider ${getLabelColorClass('contributionAreas')}`}>
                          Areas Where You&apos;d Love to Contribute *
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {[
                            'Cultural & Stage Programs',
                            'Sports & Fitness Events',
                            'Community Outreach & Charity',
                            'Business & Entrepreneurship',
                            'Youth & Children Mentorship',
                            'Hospitality & Fellowship'
                          ].map((area) => {
                            const isSelected = contributionAreas.includes(area);
                            return (
                              <button
                                key={area}
                                type="button"
                                onClick={() => toggleContributionArea(area)}
                                className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all cursor-pointer flex items-center justify-between ${
                                  isSelected
                                    ? 'bg-[#1C1917] text-[#FAF7F2] border-[#C5A869]'
                                    : 'bg-[#FAF7F2] text-[#44403C] border-[#E7DDCE] hover:bg-[#F2ECE1]'
                                }`}
                              >
                                <span>{area}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {renderFieldError('contributionAreas')}
                      </div>

                      {/* One Grand Idea */}
                      <div>
                        <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('royalIdea')}`}>
                          One Grand Idea for JSG Royals Chapter 2 (2027) *
                        </label>
                        <textarea
                          rows={2}
                          required
                          data-field-error={fieldErrors.royalIdea ? 'true' : undefined}
                          aria-invalid={Boolean(fieldErrors.royalIdea)}
                          placeholder="Share an event, retreat, or initiative idea..."
                          value={royalIdea}
                          onChange={(e) => {
                            setRoyalIdea(e.target.value);
                            clearFieldError('royalIdea');
                          }}
                          className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('royalIdea')}`}
                        />
                        {renderFieldError('royalIdea')}
                      </div>

                      {/* Additional Questions for New Members Only */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-[#D4AF37]/60 space-y-4">
                        <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                          Group Background, Business &amp; Reference *
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                              Are you part of any other group? *
                            </label>
                            <select
                              value={appOtherGroup}
                              onChange={(e) => {
                                const val = e.target.value as 'Yes' | 'No';
                                setAppOtherGroup(val);
                                if (val === 'No') {
                                  setAppOtherGroupName('');
                                  clearFieldError('appOtherGroupName');
                                }
                              }}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </div>

                          {appOtherGroup === 'Yes' && (
                            <div>
                              <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('appOtherGroupName')}`}>
                                Group Name *
                              </label>
                              <input
                                type="text"
                                required
                                data-field-error={fieldErrors.appOtherGroupName ? 'true' : undefined}
                                aria-invalid={Boolean(fieldErrors.appOtherGroupName)}
                                placeholder="Enter name of the other group"
                                value={appOtherGroupName}
                                onChange={(e) => {
                                  setAppOtherGroupName(e.target.value);
                                  clearFieldError('appOtherGroupName');
                                }}
                                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('appOtherGroupName')}`}
                              />
                              {renderFieldError('appOtherGroupName')}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('appBusinessDesc')}`}>
                            Business/Job (Short industry or role details) *
                          </label>
                          <textarea
                            required
                            rows={2}
                            data-field-error={fieldErrors.appBusinessDesc ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.appBusinessDesc)}
                            placeholder="Briefly describe your business, industry, products/services, or job role..."
                            value={appBusinessDesc}
                            onChange={(e) => {
                              setAppBusinessDesc(e.target.value);
                              clearFieldError('appBusinessDesc');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('appBusinessDesc')}`}
                          />
                          {renderFieldError('appBusinessDesc')}
                        </div>

                        <div>
                          <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('appContribution')}`}>
                            How can you contribute to the group? *
                          </label>
                          <textarea
                            required
                            rows={2}
                            data-field-error={fieldErrors.appContribution ? 'true' : undefined}
                            aria-invalid={Boolean(fieldErrors.appContribution)}
                            placeholder="Share how you can contribute your skills, time, events, or fellowship..."
                            value={appContribution}
                            onChange={(e) => {
                              setAppContribution(e.target.value);
                              clearFieldError('appContribution');
                            }}
                            className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('appContribution')}`}
                          />
                          {renderFieldError('appContribution')}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('appRefName')}`}>
                              Reference (Referring Member Name) *
                            </label>
                            <input
                              type="text"
                              required
                              data-field-error={fieldErrors.appRefName ? 'true' : undefined}
                              aria-invalid={Boolean(fieldErrors.appRefName)}
                              placeholder="Name of referring JSG Royals member"
                              value={appRefName}
                              onChange={(e) => {
                                setAppRefName(e.target.value);
                                clearFieldError('appRefName');
                              }}
                              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-hidden ${getFieldBorderClass('appRefName')}`}
                            />
                            {renderFieldError('appRefName')}
                          </div>

                          <div>
                            <label className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${getLabelColorClass('appRefMobile')}`}>
                              Referring Member Mobile *
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">+91</span>
                              <input
                                type="tel"
                                required
                                inputMode="numeric"
                                maxLength={10}
                                data-field-error={fieldErrors.appRefMobile ? 'true' : undefined}
                                aria-invalid={Boolean(fieldErrors.appRefMobile)}
                                placeholder="10-digit mobile"
                                value={appRefMobile}
                                onChange={(e) => {
                                  setAppRefMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                                  clearFieldError('appRefMobile');
                                }}
                                className={`w-full pl-11 pr-3.5 py-2.5 rounded-xl border text-xs font-mono tabular-nums outline-hidden ${getFieldBorderClass('appRefMobile')}`}
                              />
                            </div>
                            {renderFieldError('appRefMobile')}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 6: REVIEW & ROYAL SEAL */}
              {activeStep === 6 && (() => {
                const filledChildren = hasChildren
                  ? children.filter(
                      (c) =>
                        c.name.trim().length > 0 ||
                        Boolean(c.dob) ||
                        c.education.trim().length > 0 ||
                        Boolean(c.interests?.trim()) ||
                        Boolean(c.photo_url)
                    )
                  : [];

                return (
                  <div key={6} className="space-y-5 animate-fade-in-up">
                    {/* Summary Review Card */}
                    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#1C1917] via-[#24201D] to-[#12100E] text-[#FAF7F2] border-2 border-[#D4AF37]/90 space-y-5 shadow-2xl relative overflow-hidden">
                      <RoyalCornerBrackets />

                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#C5A869]/30">
                        <div className="flex items-center gap-3">
                          <RoyalLogo className="w-8 h-8 rounded-lg border border-[#D4AF37]/70 p-0.5" />
                          <span className="font-serif-royal font-bold text-sm text-[#F3DF9C] tracking-[0.04em]">
                            {membershipType === 'existing' ? 'Update Summary' : 'Registration Summary'}
                          </span>
                        </div>
                      </div>

                      {/* Husband & Wife Full Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {/* Husband Card */}
                        <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C5A869]/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold">
                              Husband Details
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveStep(1)}
                              className="text-[10px] px-2.5 py-1 rounded-md bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3DF9C] font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="font-bold text-sm text-white">{husbandName || 'Not entered'}</div>
                          <div className="space-y-1 text-[11px] text-[#E7DDCE]">
                            <div>📱 <span className="font-mono tabular-nums">{husbandMobile || '—'}</span></div>
                            <div className="truncate text-[#C5BCAE]">✉️ {husbandEmail || '—'}</div>
                            {husbandDob && <div>🎂 DOB: {husbandDob}</div>}
                            {husbandBloodGroup && <div>🩸 Blood Group: {husbandBloodGroup}</div>}
                            {husbandQualification && <div>🎓 {husbandQualification}</div>}
                            {(husbandOccupation || husbandOrganization) && (
                              <div>
                                💼 {husbandOccupation}
                                {husbandOrganization ? ` • ${husbandOrganization}` : ''}
                              </div>
                            )}
                            {husbandInstagram.trim() && (
                              <div>📷 Instagram: {husbandInstagram.trim()}</div>
                            )}
                          </div>
                          {husbandPhotoUrl ? (
                            <div className="pt-1.5">
                              <DossierPhotoThumbnail url={husbandPhotoUrl} alt={husbandName || 'Husband Photo'} />
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#A8A29E] pt-1">No Photo Attached</div>
                          )}
                        </div>

                        {/* Wife Card */}
                        <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C5A869]/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold">
                              Wife Details
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveStep(2)}
                              className="text-[10px] px-2.5 py-1 rounded-md bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3DF9C] font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="font-bold text-sm text-white">{wifeName || 'Not entered'}</div>
                          <div className="space-y-1 text-[11px] text-[#E7DDCE]">
                            <div>📱 <span className="font-mono tabular-nums">{wifeMobile || '—'}</span></div>
                            <div className="truncate text-[#C5BCAE]">✉️ {wifeEmail || '—'}</div>
                            {wifeDob && <div>🎂 DOB: {wifeDob}</div>}
                            {wifeBloodGroup && <div>🩸 Blood Group: {wifeBloodGroup}</div>}
                            {wifeQualification && <div>🎓 {wifeQualification}</div>}
                            {(wifeOccupation || wifeOrganization) && (
                              <div>
                                💼 {wifeOccupation}
                                {wifeOrganization ? ` • ${wifeOrganization}` : ''}
                              </div>
                            )}
                            {wifeInstagram.trim() && (
                              <div>📷 Instagram: {wifeInstagram.trim()}</div>
                            )}
                          </div>
                          {wifePhotoUrl ? (
                            <div className="pt-1.5">
                              <DossierPhotoThumbnail url={wifePhotoUrl} alt={wifeName || 'Wife Photo'} />
                            </div>
                          ) : (
                            <div className="text-[10px] text-[#A8A29E] pt-1">No Photo Attached</div>
                          )}
                        </div>
                      </div>

                      {/* Address / Marriage & Residence */}
                      <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C5A869]/20 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold">
                            {membershipType === 'existing' ? 'Address & Couple Photo' : 'Marriage & Residence'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep(3)}
                            className="text-[10px] px-2.5 py-1 rounded-md bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3DF9C] font-semibold transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                        {(membershipType === 'new' || marriageAnniversary || currentCity || nativePlace) && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                            {(membershipType === 'new' || marriageAnniversary) && (
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Anniversary</span>
                                <span className="font-semibold text-[#F3DF9C]">
                                  {marriageAnniversary || 'Not entered'}
                                  {yearsTogether !== null ? ` (${yearsTogether} yrs)` : ''}
                                </span>
                              </div>
                            )}
                            {(membershipType === 'new' || currentCity) && (
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Current City</span>
                                <span className="text-white">{currentCity || 'Not entered'}</span>
                              </div>
                            )}
                            {(membershipType === 'new' || nativePlace) && (
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Native Place</span>
                                <span className="text-white">{nativePlace || '—'}</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="text-[11px]">
                          <span className="text-[10px] text-[#C5BCAE] uppercase block">Residential Address</span>
                          <span className="text-[#E7DDCE]">{residentialAddress || 'No change / Not entered'}</span>
                        </div>
                        {couplePhotoUrl ? (
                          <div className="pt-2 border-t border-white/10 space-y-1.5">
                            <span className="text-[10px] text-[#D4AF37] uppercase block font-bold">💑 Couple Photo</span>
                            <DossierPhotoThumbnail url={couplePhotoUrl} alt="Royal Couple Photo" />
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#A8A29E]">No Couple Photo Attached</div>
                        )}
                      </div>

                      {/* Children Details */}
                      <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C5A869]/20 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold">
                            Children ({hasChildren ? filledChildren.length : 0})
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep(4)}
                            className="text-[10px] px-2.5 py-1 rounded-md bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3DF9C] font-semibold transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>

                        {hasChildren && filledChildren.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filledChildren.map((c, idx) => (
                              <div key={c.id || idx} className="p-3.5 rounded-xl bg-black/25 border border-white/10 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="font-bold text-white text-xs">
                                    {c.name.trim() || `Royal Heir #${idx + 1}`}
                                  </div>
                                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#F3DF9C] shrink-0">
                                    {c.gender === 'daughter' ? 'Daughter' : 'Son'}
                                  </span>
                                </div>
                                {c.dob && <div className="text-[11px] text-[#E7DDCE]">🎂 DOB: {c.dob}</div>}
                                {c.education && <div className="text-[11px] text-[#E7DDCE]">🎓 {c.education}</div>}
                                {c.interests && <div className="text-[11px] text-[#C5BCAE]">✨ {c.interests}</div>}
                                {c.photo_url ? (
                                  <DossierPhotoThumbnail url={c.photo_url} alt={c.name || `Child ${idx + 1}`} />
                                ) : (
                                  <div className="text-[10px] text-[#A8A29E]">No Kid &amp; Parents Photo Attached</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-[#A8A29E]">
                            {hasChildren ? 'No child details entered yet.' : 'No children registered.'}
                          </div>
                        )}
                      </div>

                      {/* Experience Feedback / Ideas & Reference */}
                      <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C5A869]/20 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold">
                            {membershipType === 'existing' ? 'Your Experience Matters' : 'Ideas & Reference'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep(5)}
                            className="text-[10px] px-2.5 py-1 rounded-md bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3DF9C] font-semibold transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>

                        {membershipType === 'existing' && (
                          <div className="space-y-2 text-[11px]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Overall Experience (1–10)</span>
                                <span className="text-[#F3DF9C] font-bold">
                                  {expRating !== null ? `${expRating} / 10` : 'Not rated'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">International Trip Interest</span>
                                <span className="text-white font-semibold">
                                  {expInternationalTrip === 'Yes'
                                    ? `Yes${expTripMonthDestination.trim() ? ` — ${expTripMonthDestination.trim()}` : ''}`
                                    : expInternationalTrip === 'No'
                                      ? 'No'
                                      : 'Not answered'}
                                </span>
                              </div>
                            </div>
                            {expFavouriteEvent.trim() && (
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Favourite Event / Experience</span>
                                <span className="text-[#FAF7F2]">{expFavouriteEvent.trim()}</span>
                              </div>
                            )}
                            {expMissing.trim() && (
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">What Was Missing</span>
                                <span className="text-[#E7DDCE]">{expMissing.trim()}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {contributionAreas.length > 0 && (
                          <div className="text-[11px] pt-1">
                            <span className="text-[10px] text-[#C5BCAE] uppercase block">Contribution Areas</span>
                            <span className="text-[#FAF7F2]">{contributionAreas.join(', ')}</span>
                          </div>
                        )}

                        {royalIdea.trim() && (
                          <div className="text-[11px]">
                            <span className="text-[10px] text-[#C5BCAE] uppercase block">Chapter 2 Grand Idea</span>
                            <span className="text-[#E7DDCE] italic">"{royalIdea.trim()}"</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-white/10 text-[11px]">
                          <div>
                            <span className="text-[10px] text-[#C5BCAE] uppercase block">President</span>
                            <span className="text-[#F3DF9C] font-semibold">
                              {ROYAL_LEADERSHIP.president} · <span className="font-mono tabular-nums">{ROYAL_LEADERSHIP.presidentPhone}</span>
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#C5BCAE] uppercase block">Secretary</span>
                            <span className="text-[#F3DF9C] font-semibold">
                              {ROYAL_LEADERSHIP.secretary} · <span className="font-mono tabular-nums">{ROYAL_LEADERSHIP.secretaryPhone}</span>
                            </span>
                          </div>
                        </div>

                        {membershipType === 'new' && (
                          <div className="space-y-2.5 pt-2.5 border-t border-white/10 text-[11px]">
                            <span className="text-[10px] text-[#D4AF37] uppercase tracking-[0.12em] font-bold block">
                              New Member Application Details
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Other Group</span>
                                <span className="text-white">
                                  {appOtherGroup === 'Yes' ? `Yes — ${appOtherGroupName}` : 'No'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#C5BCAE] uppercase block">Referring Member</span>
                                <span className="text-white font-semibold">
                                  {appRefName || '—'} · <span className="font-mono tabular-nums text-[#F3DF9C]">{appRefMobile || '—'}</span>
                                </span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#C5BCAE] uppercase block">Business/Job</span>
                              <span className="text-[#E7DDCE]">{appBusinessDesc || '—'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#C5BCAE] uppercase block">How You Can Contribute</span>
                              <span className="text-[#E7DDCE]">{appContribution || '—'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {membershipType === 'new' && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Application Review Notice</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.
                        </p>
                      </div>
                    )}

                    {/* Member Declaration */}
                    <div
                      data-field-error={fieldErrors.declarationAccepted ? 'true' : undefined}
                      className={`p-5 sm:p-6 rounded-2xl border space-y-3.5 transition-colors ${
                        fieldErrors.declarationAccepted
                          ? 'bg-red-50/80 border-red-400'
                          : 'bg-[#FAF7F2] border-[#DECFAF]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-4 h-4 shrink-0 ${fieldErrors.declarationAccepted ? 'text-red-600' : 'text-[#8C6D2B]'}`} />
                        <span className={`text-xs font-bold uppercase tracking-[0.12em] ${fieldErrors.declarationAccepted ? 'text-red-800' : 'text-[#1C1917]'}`}>
                          Member Declaration *
                        </span>
                      </div>
                      <p className="text-xs text-[#44403C] leading-relaxed">
                        I hereby declare that all personal, family, and contact details provided above are true and accurate to the best of my knowledge. I understand that any discrepancy may affect directory records and agree to abide by the guidelines and ethos of JSG Royals Chapter 2 (2027).
                      </p>
                      <label className="flex items-start gap-3 cursor-pointer select-none pt-1">
                        <input
                          type="checkbox"
                          checked={declarationAccepted}
                          onChange={(e) => {
                            setDeclarationAccepted(e.target.checked);
                            clearFieldError('declarationAccepted');
                            if (submitError) setSubmitError(null);
                          }}
                          className="mt-0.5 w-4 h-4 rounded border-[#8C6D2B] accent-[#1C1917] cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-semibold text-[#1C1917] leading-snug">
                          I agree to the declaration above and confirm that I have reviewed all my details.
                        </span>
                      </label>
                      {renderFieldError('declarationAccepted')}
                    </div>
                  </div>
                );
              })()}

              {/* Step Navigation Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-[#EAE0CE]">
                {activeStep > 1 ? (
                  <button
                    key="prev-step-btn"
                    type="button"
                    onClick={() => {
                      setFieldErrors({});
                      setSubmitError(null);
                      setActiveStep((prev) => prev - 1);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D8CAAF] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous Step</span>
                  </button>
                ) : (
                  <button
                    key="exit-entrance-btn"
                    type="button"
                    onClick={resetToEntrance}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D8CAAF] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-all cursor-pointer"
                  >
                    Change Email / Exit
                  </button>
                )}

                {activeStep < totalSteps ? (
                  <button
                    key="next-step-btn"
                    type="button"
                    onClick={() => {
                      const errs = validateStepFields(activeStep);
                      if (Object.keys(errs).length > 0) {
                        setFieldErrors(errs);
                        const count = Object.keys(errs).length;
                        setSubmitError(
                          `${count} mandatory field${count > 1 ? 's were' : ' was'} missed or incomplete below. Please fill the fields highlighted in red.`
                        );
                        scrollToFirstError();
                        return;
                      }
                      setFieldErrors({});
                      setSubmitError(null);
                      setActiveStep((prev) => prev + 1);
                    }}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 border border-[#C5A869]/50 cursor-pointer"
                  >
                    <span>
                      Next:{' '}
                      {activeStep === 1
                        ? 'Wife'
                        : activeStep === 2
                        ? membershipType === 'existing'
                          ? 'Address'
                          : 'Residence'
                        : activeStep === 3
                        ? 'Children'
                        : activeStep === 4
                        ? membershipType === 'existing'
                          ? 'Feedback'
                          : 'Ideas'
                        : 'Review'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </button>
                ) : (
                  <button
                    key="review-seal-btn"
                    type="button"
                    disabled={submitting}
                    onClick={executeSubmitForm}
                    className="min-h-[46px] px-7 py-3 rounded-xl bg-gradient-to-r from-[#1C1917] via-[#2A2623] to-[#12100E] hover:from-black hover:to-[#1C1917] text-[#FAF7F2] font-serif-royal font-bold text-sm shadow-xl transition-all flex items-center gap-2 border-2 border-[#D4AF37] cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                        <span>{membershipType === 'new' ? 'Submitting Application...' : 'Saving Updates...'}</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 text-[#D4AF37]" />
                        <span>{membershipType === 'new' ? 'Submit New Member Application' : 'Submit Member Update'}</span>
                        <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Subtle Query Contact Note on Form Screens */}
              <div className="pt-2 relative text-center">
                <div className="royal-divider mb-3" />
                <p className="text-[11px] text-[#78716C]">
                  In case of any query while filling out the form, please contact{' '}
                  <strong className="text-[#1C1917]">Subodh Samota</strong> at{' '}
                  <a
                    href="tel:+917021509358"
                    className="font-mono tabular-nums font-semibold text-[#8C6D2B] hover:underline whitespace-nowrap"
                  >
                    7021509358
                  </a>
                  .
                </p>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: OFFICIAL CERTIFICATE OF REGISTRATION (SUCCESS)                    */}
      {/* ========================================================================= */}
      {currentView === 'success' && (
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16 relative z-10 animate-fade-in-up">
          <div className="bg-[#FFFFFF]/96 backdrop-blur-md border-2 border-[#C5A869] rounded-3xl p-7 sm:p-11 text-center space-y-7 relative overflow-hidden royal-box-shadow animate-in zoom-in-95">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            <RoyalLogo className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-[#D4AF37] mx-auto shadow-xl p-1" />

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C6D2B] block">
                {finalRegistration?.membership_type === 'new' || membershipType === 'new'
                  ? (isUpdatedSubmission ? 'New Member Application Updated' : 'New Member Application Received')
                  : (isUpdatedSubmission ? 'Official Dossier Updated' : 'Official Certificate of Registration')}
              </span>
              <h2 className="font-serif-royal text-2xl sm:text-3xl font-extrabold text-[#1C1917]">
                {finalRegistration?.membership_type === 'new' || membershipType === 'new'
                  ? (isUpdatedSubmission ? 'Application Updated for Review!' : 'Application Submitted for Review!')
                  : (isUpdatedSubmission ? 'Family Dossier Updated & Sealed!' : 'Family Dossier Sealed & Registered!')}
              </h2>
              <RoyalFlourish />
              <p className="text-xs sm:text-sm text-[#78716C] max-w-md mx-auto leading-relaxed">
                {finalRegistration?.membership_type === 'new' || membershipType === 'new'
                  ? (isUpdatedSubmission
                      ? 'Your updated family dossier and application have been saved for JSG Royals Chapter 2 · 2027.'
                      : 'Thank you for submitting your family dossier and application for JSG Royals Chapter 2 · 2027.')
                  : (isUpdatedSubmission
                      ? 'Your updated royal household details have been saved in the JSG Royals Chapter 2 · 2027 Directory.'
                      : 'Congratulations! Your royal household has been officially entered into the JSG Royals Chapter 2 · 2027 Directory.')}
              </p>
            </div>

            {(finalRegistration?.membership_type === 'new' || membershipType === 'new') && (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-left flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
                    Important Notice
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-amber-950">
                    {submissionNotice ||
                      'This is not a confirmed membership. Your application will be reviewed, and confirmation will be sent to you once approved.'}
                  </p>
                </div>
              </div>
            )}

            {finalRegistration && (
              <div className="space-y-5 text-left">
                {/* Official Code Header */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#E0D2B8] flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-[0.14em] block">
                      {finalRegistration.membership_type === 'new' ? 'Application Reference Code' : 'Official Registration Code'}
                    </span>
                    <span className="font-mono tabular-nums font-black text-lg text-[#8C6D2B] mt-0.5 block">{finalRegistration.reg_id}</span>
                  </div>
                  <div className="text-right">
                    {finalRegistration.membership_type === 'new' || finalRegistration.status === 'pending_review' ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-3 py-1 rounded-lg uppercase tracking-[0.12em]">
                        <Clock className="w-3 h-3 text-amber-700" />
                        <span>Pending Review</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-3 py-1 rounded-lg uppercase tracking-[0.12em]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        <span>Sealed &amp; Verified</span>
                      </span>
                    )}
                    <span className="text-[10px] text-[#78716C] block mt-1.5 tabular-nums">
                      {new Date(finalRegistration.created_at || Date.now()).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Husband & Wife Profiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Husband */}
                  <div className="p-4 rounded-xl bg-white border border-[#E2D5BE] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F0E8DC] pb-1.5">
                      <span className="font-bold text-[#8C6D2B] uppercase text-[10px] tracking-wider">🤵 Royal Gentleman</span>
                      <span className="text-[10px] bg-[#FAF7F2] px-2 py-0.5 rounded text-[#78716C] border border-[#E2D5BE]">Husband</span>
                    </div>
                    <div className="font-serif-royal font-bold text-sm text-[#1C1917]">{finalRegistration.husband_name}</div>
                    <div className="space-y-1 text-[#57534E] text-[11px]">
                      <div>📱 <span className="font-mono">{finalRegistration.husband_mobile}</span></div>
                      <div>✉️ {finalRegistration.husband_email}</div>
                      {finalRegistration.husband_dob && <div>🎂 DOB: <strong>{finalRegistration.husband_dob}</strong></div>}
                      {finalRegistration.husband_qualification && <div>🎓 {finalRegistration.husband_qualification}</div>}
                      {(finalRegistration.husband_occupation || finalRegistration.husband_organization) && (
                        <div>💼 {finalRegistration.husband_occupation}{finalRegistration.husband_organization ? ` at ${finalRegistration.husband_organization}` : ''}</div>
                      )}
                      {finalRegistration.husband_blood_group && <div>🩸 Blood Group: <strong>{finalRegistration.husband_blood_group}</strong></div>}
                      {finalRegistration.husband_instagram && <div>📷 Instagram: <strong>{finalRegistration.husband_instagram}</strong></div>}
                      <DossierPhotoThumbnail url={finalRegistration.husband_photo_url} alt={finalRegistration.husband_name} />
                    </div>
                  </div>

                  {/* Wife */}
                  <div className="p-4 rounded-xl bg-white border border-[#E2D5BE] space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F0E8DC] pb-1.5">
                      <span className="font-bold text-rose-800 uppercase text-[10px] tracking-wider">👰 Royal Lady</span>
                      <span className="text-[10px] bg-[#FAF7F2] px-2 py-0.5 rounded text-[#78716C] border border-[#E2D5BE]">Wife</span>
                    </div>
                    <div className="font-serif-royal font-bold text-sm text-[#1C1917]">{finalRegistration.wife_name}</div>
                    <div className="space-y-1 text-[#57534E] text-[11px]">
                      <div>📱 <span className="font-mono">{finalRegistration.wife_mobile}</span></div>
                      <div>✉️ {finalRegistration.wife_email}</div>
                      {finalRegistration.wife_dob && <div>🎂 DOB: <strong>{finalRegistration.wife_dob}</strong></div>}
                      {finalRegistration.wife_qualification && <div>🎓 {finalRegistration.wife_qualification}</div>}
                      {(finalRegistration.wife_occupation || finalRegistration.wife_organization) && (
                        <div>💼 {finalRegistration.wife_occupation}{finalRegistration.wife_organization ? ` at ${finalRegistration.wife_organization}` : ''}</div>
                      )}
                      {finalRegistration.wife_blood_group && <div>🩸 Blood Group: <strong>{finalRegistration.wife_blood_group}</strong></div>}
                      {finalRegistration.wife_instagram && <div>📷 Instagram: <strong>{finalRegistration.wife_instagram}</strong></div>}
                      <DossierPhotoThumbnail url={finalRegistration.wife_photo_url} alt={finalRegistration.wife_name} />
                    </div>
                  </div>
                </div>

                {/* Residence & Anniversary */}
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D5BE] text-xs space-y-2">
                  {(finalRegistration.marriage_anniversary || finalRegistration.current_city) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {finalRegistration.marriage_anniversary && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#78716C] block">Marriage Anniversary</span>
                          <span className="font-semibold text-[#1C1917]">{finalRegistration.marriage_anniversary}</span>
                        </div>
                      )}
                      {finalRegistration.current_city && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#78716C] block">Current City</span>
                          <span className="font-semibold text-[#1C1917]">{finalRegistration.current_city}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Residential Address</span>
                    <span className="text-[#1C1917]">{finalRegistration.residential_address}</span>
                  </div>
                  {finalRegistration.native_place && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716C] block">Native Place</span>
                      <span className="text-[#1C1917]">{finalRegistration.native_place}</span>
                    </div>
                  )}
                  {finalRegistration.couple_photo_url && (
                    <div className="pt-2 border-t border-[#E2D5BE] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#8C6D2B] block">💑 Couple Photo</span>
                      <DossierPhotoThumbnail url={finalRegistration.couple_photo_url} alt="Couple Photo" />
                    </div>
                  )}
                </div>

                {/* Children Details */}
                {finalRegistration.children && finalRegistration.children.length > 0 && (
                  <div className="p-4 rounded-xl bg-white border border-[#E2D5BE] text-xs space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                      Royal Children ({finalRegistration.children.length})
                    </span>
                    <div className="space-y-2">
                      {finalRegistration.children.map((c: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-[#FAF7F2] border border-[#E2D5BE] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#1C1917]">{c.name || `Royal Heir #${idx + 1}`}</span>
                            <span className="text-[10px] uppercase font-bold text-[#8C6D2B] bg-white px-2 py-0.5 rounded border border-[#E2D5BE]">
                              {c.gender === 'daughter' ? 'Daughter' : 'Son'} {c.dob ? `• ${c.dob}` : ''}
                            </span>
                          </div>
                          {c.education && (
                            <div className="text-[11px] text-[#57534E]">🎓 {c.education}</div>
                          )}
                          {c.interests && (
                            <div className="text-[11px] text-[#78716C]">✨ {c.interests}</div>
                          )}
                          <DossierPhotoThumbnail url={c.photo_url} alt={c.name || `Child ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Family Portrait */}
                {finalRegistration.family_photo_url && (
                  <div className="p-4 rounded-xl bg-white border border-[#E2D5BE] text-xs space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">
                      📸 Family Portrait Photo / Drive URL
                    </span>
                    <DossierPhotoThumbnail url={finalRegistration.family_photo_url} alt="Family Portrait" />
                  </div>
                )}

                {/* Existing Member Experience Feedback */}
                {(finalRegistration.exp_rating !== null && finalRegistration.exp_rating !== undefined ||
                  finalRegistration.exp_favourite_event ||
                  finalRegistration.exp_international_trip ||
                  finalRegistration.exp_missing) && (
                  <div className="p-4 rounded-xl bg-white border border-[#E2D5BE] text-xs space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-[#8C6D2B] block">
                      JSG Royals – Your Experience Matters!
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {finalRegistration.exp_rating !== null && finalRegistration.exp_rating !== undefined && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#78716C] block">Overall Experience (1–10)</span>
                          <span className="text-[#1C1917] font-bold">{finalRegistration.exp_rating} / 10</span>
                        </div>
                      )}
                      {finalRegistration.exp_international_trip && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#78716C] block">International Trip Interest</span>
                          <span className="text-[#1C1917] font-semibold">
                            {finalRegistration.exp_international_trip === 'Yes' && finalRegistration.exp_trip_month_destination
                              ? `Yes — ${finalRegistration.exp_trip_month_destination}`
                              : finalRegistration.exp_international_trip}
                          </span>
                        </div>
                      )}
                    </div>
                    {finalRegistration.exp_favourite_event && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">Favourite Event / Experience</span>
                        <span className="text-[#1C1917]">{finalRegistration.exp_favourite_event}</span>
                      </div>
                    )}
                    {finalRegistration.exp_missing && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">What Was Missing</span>
                        <span className="text-[#57534E]">{finalRegistration.exp_missing}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contributions / Vision & Leadership */}
                {(finalRegistration.contribution_areas || finalRegistration.royal_idea || finalRegistration.jsg_should_be_known_for || finalRegistration.president_name || finalRegistration.secretary_name) && (
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D5BE] text-xs space-y-2.5">
                    {(finalRegistration.president_name || finalRegistration.secretary_name) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2 border-b border-[#E2D5BE]">
                        {finalRegistration.president_name && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">President</span>
                            <span className="text-[#1C1917] font-semibold">
                              {finalRegistration.president_name}
                              {finalRegistration.president_mobile ? ` · ${finalRegistration.president_mobile}` : ''}
                            </span>
                          </div>
                        )}
                        {finalRegistration.secretary_name && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">Secretary</span>
                            <span className="text-[#1C1917] font-semibold">
                              {finalRegistration.secretary_name}
                              {finalRegistration.secretary_mobile ? ` · ${finalRegistration.secretary_mobile}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {finalRegistration.contribution_areas && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">Areas of Contribution</span>
                        <span className="text-[#1C1917] font-medium">{finalRegistration.contribution_areas}</span>
                      </div>
                    )}
                    {finalRegistration.royal_idea && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">Royal Chapter 2 Idea</span>
                        <p className="text-[#57534E] italic font-serif-royal">"{finalRegistration.royal_idea}"</p>
                      </div>
                    )}
                    {finalRegistration.membership_type === 'new' && (
                      <div className="space-y-2 pt-2 border-t border-[#E2D5BE]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">Other Group Membership</span>
                            <span className="text-[#1C1917] font-semibold">
                              {finalRegistration.other_group_member === 'Yes'
                                ? `Yes — ${finalRegistration.other_group_name}`
                                : 'No'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">Referring Member</span>
                            <span className="text-[#1C1917] font-semibold">
                              {finalRegistration.reference_name}
                              {finalRegistration.reference_mobile ? ` · ${finalRegistration.reference_mobile}` : ''}
                            </span>
                          </div>
                        </div>
                        {finalRegistration.business_description && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">Business/Job</span>
                            <p className="text-[#57534E]">{finalRegistration.business_description}</p>
                          </div>
                        )}
                        {finalRegistration.new_member_contribution && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#78716C] block">Contribution to Group</span>
                            <p className="text-[#57534E]">{finalRegistration.new_member_contribution}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tailored Membership Fees & Where to Submit Fees */}
            <MembershipFeeSubmissionSection
              membershipKind={
                finalRegistration?.membership_type === 'new' || membershipType === 'new'
                  ? 'new'
                  : 'existing'
              }
              feeStatus={feeStatus}
              expandedAddresses={expandedAddresses}
              setExpandedAddresses={setExpandedAddresses}
            />

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-left flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong>Cross-Spouse Sync Enabled:</strong> Your registration has been securely recorded. When your spouse logs in with their email, they will automatically see this verified family dossier.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#1C1917] font-semibold text-xs border border-[#D8CAAF] shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#8C6D2B]" />
                <span>Print / Save Dossier Slip</span>
              </button>

              <button
                type="button"
                onClick={triggerConfettiFanfare}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 border border-[#C5A869]/50 cursor-pointer"
              >
                <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                <span>Celebrate!</span>
              </button>

              <button
                type="button"
                onClick={resetToEntrance}
                className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#78716C] hover:text-[#1C1917] font-semibold text-xs border border-[#D8CAAF] transition-all cursor-pointer"
              >
                ← Return to Entrance
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
