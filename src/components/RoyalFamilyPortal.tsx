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
  Link2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  checkFamilyEmailApi,
  registerFamilyApi,
  uploadFamilyPhotoApi,
  requestFamilyEmailOtpApi,
  verifyFamilyEmailOtpApi
} from '../lib/api.ts';

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
  subtitle?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
}

function PhotoUploadOrDriveLink({
  label,
  subtitle,
  value,
  onChange,
  required = false
}: PhotoUploadOrDriveLinkProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'drive'>('upload');
  const [driveInput, setDriveInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDriveLink = Boolean(
    value &&
    !value.startsWith('data:') &&
    (value.includes('drive.google.com') || value.includes('google.com') || value.startsWith('http://') || value.startsWith('https://'))
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10 MB');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFamilyPhotoApi(file);
      onChange(res.url);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
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
    <div className="p-3.5 rounded-xl bg-white border border-[#E2D5BE] space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#44403C]">
            {label} {required && <span className="text-red-500">*</span>}
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

      {error && (
        <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {value ? (
        <div className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] flex items-center gap-3">
          {isDriveLink ? (
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <Link2 className="w-6 h-6 text-blue-600" />
            </div>
          ) : (
            <img
              src={value}
              alt="Photo preview"
              className="w-12 h-12 rounded-xl object-cover border border-[#D9CDB8] shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase text-[#8C6D2B] block">
              {isDriveLink ? 'Google Drive / Cloud Link Attached' : 'Photo Attached'}
            </span>
            <p className="text-xs text-[#1C1917] truncate font-mono" title={value}>
              {value}
            </p>
          </div>

          {isDriveLink && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold shrink-0 transition-colors shadow-2xs"
            >
              <span>Open Link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
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
                {uploading ? 'Uploading image...' : 'Choose image (JPG/PNG)'}
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
    </div>
  );
}

function isCloudDriveLink(url: string | null | undefined): boolean {
  if (!url) return false;
  return !url.startsWith('data:') && !url.startsWith('/api/family/photo/');
}

function DossierPhotoThumbnail({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) return null;
  const isDrive = isCloudDriveLink(url);
  if (isDrive) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-semibold transition-colors mt-1.5 max-w-full"
      >
        <Link2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="truncate max-w-[200px]">{url}</span>
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    );
  }
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <img
        src={url}
        alt={alt}
        className="w-14 h-14 rounded-xl object-cover border border-[#D9CDB8] shadow-2xs shrink-0"
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-[#8C6D2B] hover:underline inline-flex items-center gap-1"
      >
        <span>Open Photo</span>
        <ExternalLink className="w-3 h-3" />
      </a>
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
    <div className={`flex items-center justify-center gap-3 my-4 select-none ${className}`}>
      <span className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-[#C5A869]/80 to-[#C5A869]" />
      <div className="flex items-center gap-1.5 text-[#D4AF37]">
        <span className="text-[10px] animate-twinkle">✦</span>
        <span className="text-sm font-serif-royal">❖</span>
        <span className="text-[10px] animate-twinkle">✦</span>
      </div>
      <span className="h-px w-16 sm:w-24 bg-gradient-to-l from-transparent via-[#C5A869]/80 to-[#C5A869]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Royal Corner Gilded Brackets
// ---------------------------------------------------------------------------
function RoyalCornerBrackets() {
  return (
    <>
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#D4AF37]/60 pointer-events-none rounded-tl-sm" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#D4AF37]/60 pointer-events-none rounded-tr-sm" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#D4AF37]/60 pointer-events-none rounded-bl-sm" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#D4AF37]/60 pointer-events-none rounded-br-sm" />
    </>
  );
}

export function RoyalFamilyPortal({ onOpenAdmin }: RoyalFamilyPortalProps) {
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
  const [husbandBloodGroup, setHusbandBloodGroup] = useState('O+');

  const [wifeName, setWifeName] = useState('');
  const [wifeMobile, setWifeMobile] = useState('');
  const [wifeEmail, setWifeEmail] = useState('');
  const [wifeDob, setWifeDob] = useState('');
  const [wifeQualification, setWifeQualification] = useState('');
  const [wifeOccupation, setWifeOccupation] = useState('');
  const [wifeOrganization, setWifeOrganization] = useState('');
  const [wifeBloodGroup, setWifeBloodGroup] = useState('O+');

  const [marriageAnniversary, setMarriageAnniversary] = useState('');
  const [currentCity, setCurrentCity] = useState('Indore');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [nativePlace, setNativePlace] = useState('');

  const [hasChildren, setHasChildren] = useState<boolean>(true);
  const [children, setChildren] = useState<ChildItem[]>([
    { id: '1', name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }
  ]);

  const [husbandPhotoUrl, setHusbandPhotoUrl] = useState<string | null>(null);
  const [wifePhotoUrl, setWifePhotoUrl] = useState<string | null>(null);
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState<string | null>(null);

  const [contributionAreas, setContributionAreas] = useState<string[]>([
    'Cultural & Stage Programs',
    'Sports & Fitness Events'
  ]);
  const [royalIdea, setRoyalIdea] = useState('');
  const [jsgShouldBeKnownFor, setJsgShouldBeKnownFor] = useState('');

  // Clean Entrance Reset Helper (always lands back on initial Email gate screen)
  const resetToEntrance = () => {
    setGateOtpStep('email');
    setGateOtp('');
    setGateEmail('');
    setIsEmailVerified(false);
    setResendCooldown(0);
    setGateError(null);
    setGateSuccessMsg(null);
    setExistingRecord(null);
    setFinalRegistration(null);
    setActiveStep(1);

    setHusbandName('');
    setHusbandMobile('');
    setHusbandEmail('');
    setHusbandDob('');
    setHusbandQualification('');
    setHusbandOccupation('');
    setHusbandOrganization('');
    setHusbandBloodGroup('O+');
    setHusbandPhotoUrl(null);

    setWifeName('');
    setWifeMobile('');
    setWifeEmail('');
    setWifeDob('');
    setWifeQualification('');
    setWifeOccupation('');
    setWifeOrganization('');
    setWifeBloodGroup('O+');
    setWifePhotoUrl(null);

    setMarriageAnniversary('');
    setCurrentCity('Indore');
    setResidentialAddress('');
    setNativePlace('');

    setHasChildren(true);
    setChildren([{ id: '1', name: '', gender: 'son', dob: '', education: '', interests: '', photo_url: '' }]);
    setFamilyPhotoUrl(null);
    setRoyalIdea('');
    setJsgShouldBeKnownFor('');
    setSubmitError(null);

    setCurrentView('gate');
  };

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finalRegistration, setFinalRegistration] = useState<any>(null);

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
    if (!gateEmail.trim() || !gateEmail.includes('@')) {
      setGateError('Please enter a valid email address.');
      return;
    }

    setSendingOtp(true);
    setGateError(null);
    setGateSuccessMsg(null);

    try {
      const email = gateEmail.trim().toLowerCase();
      const res = await requestFamilyEmailOtpApi(email, gateRole);
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
          setIsFiledBySpouse(true);
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

  // Real-time check if the spouse's email is already registered when typing in form
  const handleCheckSpouseEmailOnBlur = async (emailToCheck: string, expectedRole: 'husband' | 'wife') => {
    if (!emailToCheck || !emailToCheck.includes('@') || emailToCheck.length < 5) return;
    try {
      const res = await checkFamilyEmailApi(emailToCheck.trim().toLowerCase(), expectedRole);
      if (res.exists && res.registration) {
        setExistingRecord(res.registration);
        setSpouseNotificationMessage(res.message || 'Your spouse has already registered your family household!');
        setIsFiledBySpouse(true);
        setSpouseName(res.spouseName || (expectedRole === 'husband' ? res.registration.husband_name : res.registration.wife_name));
        setSpouseRole(res.spouseRole || expectedRole);
        setCurrentView('spouse_celebration');
        triggerConfettiFanfare();
      }
    } catch (e) {
      // Non-blocking on blur
    }
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
    setContributionAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  // 5. Final Submit Handler
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEmailVerified) {
      setSubmitError('Email verification is required before accessing or submitting the royal dossier.');
      setCurrentView('gate');
      return;
    }

    if (!husbandName.trim() || !husbandMobile.trim() || !husbandEmail.trim()) {
      setSubmitError('Husband Name, Mobile, and Email are required.');
      setActiveStep(1);
      return;
    }
    if (!wifeName.trim() || !wifeMobile.trim() || !wifeEmail.trim()) {
      setSubmitError('Wife Name, Mobile, and Email are required.');
      setActiveStep(2);
      return;
    }
    if (!marriageAnniversary) {
      setSubmitError('Please enter your Marriage Anniversary date.');
      setActiveStep(3);
      return;
    }
    if (!currentCity.trim() || !residentialAddress.trim()) {
      setSubmitError('Current City and Residential Address are required.');
      setActiveStep(3);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      submitted_by_role: gateRole,
      submitter_email: gateEmail.trim().toLowerCase() || (gateRole === 'husband' ? husbandEmail : wifeEmail),
      husband_name: husbandName.trim(),
      husband_mobile: husbandMobile.trim(),
      husband_email: husbandEmail.trim().toLowerCase(),
      husband_dob: husbandDob || null,
      husband_qualification: husbandQualification.trim() || null,
      husband_occupation: husbandOccupation.trim() || null,
      husband_organization: husbandOrganization.trim() || null,
      husband_blood_group: husbandBloodGroup,
      husband_photo_url: husbandPhotoUrl || null,
      wife_name: wifeName.trim(),
      wife_mobile: wifeMobile.trim(),
      wife_email: wifeEmail.trim().toLowerCase(),
      wife_dob: wifeDob || null,
      wife_qualification: wifeQualification.trim() || null,
      wife_occupation: wifeOccupation.trim() || null,
      wife_organization: wifeOrganization.trim() || null,
      wife_blood_group: wifeBloodGroup,
      wife_photo_url: wifePhotoUrl || null,
      marriage_anniversary: marriageAnniversary,
      current_city: currentCity.trim(),
      residential_address: residentialAddress.trim(),
      native_place: nativePlace.trim() || null,
      has_children: hasChildren,
      children: hasChildren ? children.filter((c) => c.name.trim().length > 0).map((c) => ({
        id: c.id,
        name: c.name.trim(),
        gender: c.gender,
        dob: c.dob || '',
        education: c.education || '',
        interests: c.interests || '',
        photo_url: c.photo_url || null
      })) : [],
      family_photo_url: familyPhotoUrl || null,
      contribution_areas: contributionAreas.join(', '),
      royal_idea: royalIdea.trim() || null,
      jsg_should_be_known_for: jsgShouldBeKnownFor.trim() || null
    };

    try {
      const res = await registerFamilyApi(payload);

      if (res.alreadyRegistered) {
        setExistingRecord(res.registration);
        setSpouseNotificationMessage(res.message);
        setIsFiledBySpouse(true);
        setSpouseName(res.spouseName || 'Spouse');
        setSpouseRole(res.spouseRole === 'husband' ? 'husband' : 'wife');
        setCurrentView('spouse_celebration');
        triggerConfettiFanfare();
        return;
      }

      setFinalRegistration(res.registration);
      setCurrentView('success');
      triggerConfettiFanfare();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit family registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedStep = () => {
    if (activeStep === 1) {
      return husbandName.trim().length > 0 && husbandMobile.trim().length >= 10 && husbandEmail.includes('@');
    }
    if (activeStep === 2) {
      return wifeName.trim().length > 0 && wifeMobile.trim().length >= 10 && wifeEmail.includes('@');
    }
    if (activeStep === 3) {
      return marriageAnniversary.length > 0 && currentCity.trim().length > 0 && residentialAddress.trim().length > 0;
    }
    return true;
  };

  return (
    <div className="min-h-screen bg-royal-parchment text-[#1C1917] selection:bg-[#EFE4C9] selection:text-[#8C6D2B] relative overflow-hidden">
      
      {/* Decorative Golden Ambient Lighting Stars */}
      <div className="absolute top-10 left-10 text-[#D4AF37]/30 text-lg animate-twinkle pointer-events-none select-none">✦</div>
      <div className="absolute top-40 right-16 text-[#C5A869]/25 text-xl animate-twinkle pointer-events-none select-none" style={{ animationDelay: '1.2s' }}>✧</div>
      <div className="absolute top-96 left-1/4 text-[#D4AF37]/20 text-sm animate-twinkle pointer-events-none select-none" style={{ animationDelay: '2.1s' }}>✦</div>
      <div className="absolute bottom-20 right-1/4 text-[#C5A869]/20 text-lg animate-twinkle pointer-events-none select-none" style={{ animationDelay: '0.8s' }}>✧</div>

      {/* Royal Ribbon Announcement Header */}
      <div className="bg-[#1C1917] text-[#FAF7F2] py-2.5 px-4 text-center text-xs tracking-wider border-b border-[#C5A869]/40 shadow-xs flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5 mx-auto">
          <Crown className="w-4 h-4 text-[#D4AF37] animate-pulse-gold shrink-0" />
          <span className="font-serif-royal font-bold tracking-widest text-[#D4AF37]">
            JSG ROYALS • YEAR 2 • 2027
          </span>
          <span className="hidden sm:inline text-[#C5A869]/40">❖</span>
          <span className="hidden sm:inline text-[#E7DDCE] font-medium">
            Unified Royal Family Directory &amp; Heritage Dossier
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: REGAL ENTRANCE GATE & UNIQUE EMAIL CHECK                          */}
      {/* ========================================================================= */}
      {currentView === 'gate' && (
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-18 relative z-10 animate-fade-in-up">
          <div className="bg-[#FFFFFF]/90 backdrop-blur-md border border-[#E2D5BE] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden royal-box-shadow">
            
            {/* Gilded Top Shimmer Accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Regal Heraldic Crest Icon */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1C1917] via-[#2A2623] to-[#12100E] border-2 border-[#D4AF37] text-[#D4AF37] flex items-center justify-center mx-auto shadow-xl animate-float-slow group">
                <Crown className="w-10 h-10 text-[#D4AF37] group-hover:scale-110 transition-transform" />
              </div>
            </div>

            {/* Title & Introduction */}
            <div className="text-center space-y-2 mb-6">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
                Exclusive Royal Family Registry
              </span>
              <h1 className="font-serif-royal text-2xl sm:text-3xl font-extrabold text-[#1C1917] tracking-tight">
                Welcome, Royal Household
              </h1>
              <RoyalFlourish />
              <p className="text-xs sm:text-sm text-[#78716C] max-w-md mx-auto leading-relaxed">
                Enter your unique email address to register your complete household.
                Husband, Wife, and Children are captured together in a single magnificent dossier.
              </p>
            </div>

            {/* Notifications & Error Banners */}
            {gateError && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50/95 border border-red-200 text-red-900 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-800">Verification Alert</p>
                  <p className="leading-relaxed">{gateError}</p>
                </div>
              </div>
            )}

            {gateSuccessMsg && gateOtpStep === 'otp' && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50/95 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-800">Verification Code Dispatched</p>
                  <p className="leading-relaxed">{gateSuccessMsg}</p>
                </div>
              </div>
            )}

            {/* STEP 1: ROYAL EMAIL INPUT */}
            {gateOtpStep === 'email' && (
              <form onSubmit={handleRequestOtp} className="space-y-6">
                
                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-2.5 text-center">
                    Select Your Royal Identity
                  </label>
                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() => setGateRole('husband')}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2.5 ${
                        gateRole === 'husband'
                          ? 'bg-gradient-to-b from-[#1C1917] to-[#25221F] border-[#D4AF37] text-[#FAF7F2] shadow-lg ring-2 ring-[#C5A869]/40'
                          : 'bg-[#FAF7F2] border-[#E7DDCE] text-[#44403C] hover:bg-[#F2ECE1] hover:border-[#D9CDB8]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        gateRole === 'husband' ? 'bg-[#312B26] text-[#D4AF37]' : 'bg-white text-[#8C6D2B] shadow-2xs'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">I am the Husband</div>
                        <div className={`text-[10px] uppercase tracking-wider ${gateRole === 'husband' ? 'text-[#D4AF37]' : 'text-[#78716C]'}`}>
                          Royal Gentleman
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGateRole('wife')}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2.5 ${
                        gateRole === 'wife'
                          ? 'bg-gradient-to-b from-[#1C1917] to-[#25221F] border-[#D4AF37] text-[#FAF7F2] shadow-lg ring-2 ring-[#C5A869]/40'
                          : 'bg-[#FAF7F2] border-[#E7DDCE] text-[#44403C] hover:bg-[#F2ECE1] hover:border-[#D9CDB8]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        gateRole === 'wife' ? 'bg-[#312B26] text-[#D4AF37]' : 'bg-white text-[#8C6D2B] shadow-2xs'
                      }`}>
                        <Heart className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">I am the Wife</div>
                        <div className={`text-[10px] uppercase tracking-wider ${gateRole === 'wife' ? 'text-[#D4AF37]' : 'text-[#78716C]'}`}>
                          Royal Lady
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                    Your Unique Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#8C6D2B]" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. royalfamily@example.com"
                      value={gateEmail}
                      onChange={(e) => setGateEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#D9CDB8] text-sm text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869] transition-all shadow-xs"
                    />
                  </div>
                  <p className="text-[11px] text-[#78716C] mt-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                    <span>
                      A 6-digit verification code will be dispatched to this email to verify your royal household identity.
                    </span>
                  </p>
                </div>

                {/* Send OTP Button */}
                <button
                  type="submit"
                  disabled={sendingOtp || !gateEmail.trim()}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#1C1917] via-[#2A2623] to-[#1C1917] hover:from-black hover:to-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-xl transition-all flex items-center justify-center gap-2 border border-[#C5A869]/50 cursor-pointer"
                >
                  {sendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 text-[#D4AF37]" />
                      <span>Send 6-Digit Royal Code</span>
                      <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: 6-DIGIT EMAIL OTP VERIFICATION */}
            {gateOtpStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6 animate-in fade-in">
                
                {/* Back & Email Pill */}
                <div className="flex items-center justify-between pb-2 border-b border-[#F0E8DC]">
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    className="text-xs text-[#78716C] hover:text-[#1C1917] flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Email</span>
                  </button>
                  <div className="text-xs bg-[#FAF7F2] border border-[#E7DDCE] text-[#44403C] px-3 py-1 rounded-full font-mono flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-[#8C6D2B]" />
                    <span>{gateEmail}</span>
                  </div>
                </div>

                {/* 6-Digit Verification Code Input */}
                <div className="text-center space-y-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C]">
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
                      className="w-full py-4 text-center text-3xl font-mono font-bold tracking-[0.4em] rounded-2xl border-2 border-[#D4AF37] bg-white text-[#1C1917] outline-hidden focus:ring-4 focus:ring-[#C5A869]/20 focus:border-[#8C6D2B] transition-all shadow-inner"
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
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#1C1917] via-[#2A2623] to-[#1C1917] hover:from-black hover:to-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-xl transition-all flex items-center justify-center gap-2 border border-[#C5A869]/50 cursor-pointer"
                >
                  {verifyingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                      <span>Verifying Royal Code...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                      <span>Verify Code &amp; Enter Dossier</span>
                      <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                    </>
                  )}
                </button>

                {/* Resend Controls */}
                <div className="text-center pt-2">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-[#78716C] font-mono">
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

            {/* Smart Cross-Spouse Sync Badge & Discreet Admin Link */}
            <div className="mt-8 pt-6 border-t border-[#F0E8DC] text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF7F2] border border-[#E7DDCE] text-[11px] text-[#78716C]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#8C6D2B]" />
                <span>Zero Duplicate Entries • Automated Cross-Spouse Synchronization</span>
              </div>
              {onOpenAdmin && (
                <div>
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="text-[10px] text-[#A8A29E] hover:text-[#78716C] tracking-wider uppercase transition-colors cursor-pointer"
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
          <div className="bg-[#FFFFFF]/95 backdrop-blur-md border border-[#E2D5BE] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-8 royal-box-shadow animate-in fade-in zoom-in-95">
            
            <div className="absolute top-0 left-0 right-0 h-2 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Royal Decree Seal */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#1C1917] via-[#2A2623] to-[#141210] border-2 border-[#D4AF37] text-[#D4AF37] flex items-center justify-center mx-auto shadow-xl animate-ring-float">
                <Heart className="w-10 h-10 text-[#D4AF37] fill-[#D4AF37]/20" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Official Royal Decree Sealed</span>
              </div>

              <h2 className="font-serif-royal text-2xl sm:text-3xl font-bold text-[#1C1917] leading-tight">
                {spouseNotificationMessage}
              </h2>

              <RoyalFlourish />

              <p className="text-xs sm:text-sm text-[#78716C] max-w-lg mx-auto leading-relaxed">
                {isFiledBySpouse
                  ? `Your beloved ${spouseRole === 'husband' ? 'husband' : 'wife'} (${spouseName}) has already registered your complete royal household in the JSG Royals Year 2 Directory. You do not need to fill out any form!`
                  : `Your family dossier is officially recorded and confirmed in the JSG Royals Master Directory.`}
              </p>
            </div>

            {/* Interactive Dossier Inspector */}
            <div className="bg-[#FAF7F2] border border-[#E2D5BE] rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2D5BE]">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#8C6D2B]" />
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
                    {existingRecord.husband_blood_group && (
                      <div>🩸 Blood Group: <strong>{existingRecord.husband_blood_group}</strong></div>
                    )}
                    {existingRecord.husband_occupation && (
                      <div>💼 {existingRecord.husband_occupation} {existingRecord.husband_organization ? `at ${existingRecord.husband_organization}` : ''}</div>
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
                    {existingRecord.wife_blood_group && (
                      <div>🩸 Blood Group: <strong>{existingRecord.wife_blood_group}</strong></div>
                    )}
                    {existingRecord.wife_occupation && (
                      <div>💼 {existingRecord.wife_occupation} {existingRecord.wife_organization ? `at ${existingRecord.wife_organization}` : ''}</div>
                    )}
                    <DossierPhotoThumbnail url={existingRecord.wife_photo_url} alt={existingRecord.wife_name} />
                  </div>
                </div>
              </div>

              {/* Union & Residence */}
              <div className="p-4 rounded-xl bg-white border border-[#E7DDCE] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">Marriage Anniversary</span>
                  <span className="font-semibold text-[#1C1917]">{existingRecord.marriage_anniversary}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">City</span>
                  <span className="font-semibold text-[#1C1917]">{existingRecord.current_city}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[#78716C] block">Residence</span>
                  <span className="text-[#57534E] truncate block" title={existingRecord.residential_address}>
                    {existingRecord.residential_address}
                  </span>
                </div>
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
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[#1C1917]">{child.name}</div>
                            <div className="text-[11px] text-[#78716C]">{child.education || 'Royal Heir'}</div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-[#FAF7F2] text-[#8C6D2B]">
                            {child.gender}
                          </span>
                        </div>
                        <DossierPhotoThumbnail url={child.photo_url} alt={child.name} />
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
                  {isCloudDriveLink(existingRecord.family_photo_url) ? (
                    <div className="flex justify-center">
                      <DossierPhotoThumbnail url={existingRecord.family_photo_url} alt="Royal Family Portrait" />
                    </div>
                  ) : (
                    <div className="inline-block p-2 rounded-2xl bg-white gilded-frame">
                      <img
                        src={existingRecord.family_photo_url}
                        alt="Royal Family"
                        className="max-h-52 rounded-xl object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={triggerConfettiFanfare}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs transition-all flex items-center justify-center gap-2 border border-[#C5A869]/40 cursor-pointer shadow-md"
              >
                <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                <span>Launch Confetti Celebration!</span>
              </button>

              <button
                type="button"
                onClick={resetToEntrance}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-[#FAF7F2] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] transition-all cursor-pointer"
              >
                ← Return to Entrance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: FRESH MULTI-STEP UNIFIED FAMILY FORM                              */}
      {/* ========================================================================= */}
      {currentView === 'form' && isEmailVerified && (
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6 relative z-10 animate-fade-in-up">
          
          <div className="bg-[#FFFFFF]/95 backdrop-blur-md border border-[#E2D5BE] rounded-3xl p-6 sm:p-9 shadow-xl space-y-6 royal-box-shadow relative overflow-hidden">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            {/* Stepper Header with Regal Medals */}
            <div className="space-y-4 pb-4 border-b border-[#F0E8DC]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] flex items-center gap-1.5">
                    <span>✦</span>
                    <span>Step {activeStep} of {totalSteps}</span>
                  </span>
                  <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                    {activeStep === 1 && "🤵 Husband's Royal Dossier"}
                    {activeStep === 2 && "👰 Wife's Royal Dossier"}
                    {activeStep === 3 && "💍 Royal Union & Residence"}
                    {activeStep === 4 && "👶 Royal Heirs & Children"}
                    {activeStep === 5 && "📸 Family Portrait & Vision"}
                    {activeStep === 6 && "📜 Review & Royal Seal"}
                  </h2>
                </div>

                <div className="text-[11px] text-[#78716C] font-serif">
                  JSG Royals • Year 2 • 2027
                </div>
              </div>

              {/* Regal Step Navigation Bar */}
              <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto py-1">
                {[
                  { num: 1, label: 'Husband' },
                  { num: 2, label: 'Wife' },
                  { num: 3, label: 'Union' },
                  { num: 4, label: 'Children' },
                  { num: 5, label: 'Portrait' },
                  { num: 6, label: 'Seal' }
                ].map((s) => {
                  const isCurrent = s.num === activeStep;
                  const isCompleted = s.num < activeStep;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (isCompleted || canProceedStep()) {
                          setActiveStep(s.num);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-[#1C1917] text-[#D4AF37] border border-[#C5A869] shadow-xs ring-1 ring-[#C5A869]/30'
                          : isCompleted
                          ? 'bg-[#FAF7F2] text-[#8C6D2B] hover:bg-[#F2ECE1] border border-[#E7DDCE]'
                          : 'bg-white text-[#A8A29E] border border-transparent'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent ? 'bg-[#312B26] text-[#D4AF37]' : isCompleted ? 'bg-[#8C6D2B] text-white' : 'bg-[#E7DDCE] text-[#78716C]'
                      }`}>
                        {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {submitError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Form Step Contents */}
            <form onSubmit={handleSubmitForm} className="space-y-6">
              
              {/* STEP 1: HUSBAND DOSSIER */}
              {activeStep === 1 && (
                <div key={1} className="space-y-4 animate-fade-in-up">
                  <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-[#D4AF37] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-[#57534E]">
                      Record the gentleman&apos;s personal and professional identity in the Master Directory.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Husband Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Subodh Samota"
                        value={husbandName}
                        onChange={(e) => setHusbandName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Husband Registered Mobile *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder="10-digit mobile"
                          value={husbandMobile}
                          onChange={(e) => setHusbandMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C]">
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
                        placeholder="husband@example.com"
                        value={husbandEmail}
                        onChange={(e) => setHusbandEmail(e.target.value)}
                        onBlur={() => {
                          if (gateRole === 'wife') {
                            handleCheckSpouseEmailOnBlur(husbandEmail, 'husband');
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={husbandDob}
                        onChange={(e) => setHusbandDob(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Blood Group
                      </label>
                      <select
                        value={husbandBloodGroup}
                        onChange={(e) => setHusbandBloodGroup(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Highest Educational Qualification
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MBA / B.Tech / CA"
                        value={husbandQualification}
                        onChange={(e) => setHusbandQualification(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Occupation / Profession
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Business / Software Architect"
                        value={husbandOccupation}
                        onChange={(e) => setHusbandOccupation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Company / Business / Organization
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Samota Industries"
                        value={husbandOrganization}
                        onChange={(e) => setHusbandOrganization(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>
                  </div>

                  {/* Husband Portrait Photo / Google Drive Link */}
                  <PhotoUploadOrDriveLink
                    label="📸 Husband Photo / Google Drive Link"
                    subtitle="Upload a portrait of the husband or paste a Google Drive photo URL"
                    value={husbandPhotoUrl}
                    onChange={setHusbandPhotoUrl}
                  />
                </div>
              )}

              {/* STEP 2: WIFE DOSSIER */}
              {activeStep === 2 && (
                <div key={2} className="space-y-4 animate-fade-in-up">
                  <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1C1917] text-[#D4AF37] flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-[#57534E]">
                      Record the royal lady&apos;s personal and professional identity in the Master Directory.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Wife Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Shaily Agrawal"
                        value={wifeName}
                        onChange={(e) => setWifeName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Wife Registered Mobile *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78716C]">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          placeholder="10-digit mobile"
                          value={wifeMobile}
                          onChange={(e) => setWifeMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C]">
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
                        placeholder="wife@example.com"
                        value={wifeEmail}
                        onChange={(e) => setWifeEmail(e.target.value)}
                        onBlur={() => {
                          if (gateRole === 'husband') {
                            handleCheckSpouseEmailOnBlur(wifeEmail, 'wife');
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={wifeDob}
                        onChange={(e) => setWifeDob(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Blood Group
                      </label>
                      <select
                        value={wifeBloodGroup}
                        onChange={(e) => setWifeBloodGroup(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      >
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Highest Educational Qualification
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MBA / MSc / B.Arch"
                        value={wifeQualification}
                        onChange={(e) => setWifeQualification(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Occupation / Profession
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Product Manager / Homemaker"
                        value={wifeOccupation}
                        onChange={(e) => setWifeOccupation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Company / Business / Organization
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Swiggy / Entrepreneur"
                        value={wifeOrganization}
                        onChange={(e) => setWifeOrganization(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>
                  </div>

                  {/* Wife Portrait Photo / Google Drive Link */}
                  <PhotoUploadOrDriveLink
                    label="📸 Wife Photo / Google Drive Link"
                    subtitle="Upload a portrait of the wife or paste a Google Drive photo URL"
                    value={wifePhotoUrl}
                    onChange={setWifePhotoUrl}
                  />
                </div>
              )}

              {/* STEP 3: ROYAL UNION & RESIDENCE */}
              {activeStep === 3 && (
                <div key={3} className="space-y-4 animate-fade-in-up">
                  
                  {/* Anniversary Spotlight */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FAF7F2] to-[#F5ECE0] border border-[#E2D5BE] space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gem className="w-4 h-4 text-[#8C6D2B]" />
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#44403C]">
                          💍 Marriage Anniversary Date *
                        </label>
                      </div>
                      {yearsTogether !== null && (
                        <span className="px-3 py-1 rounded-full bg-[#1C1917] text-[#D4AF37] font-serif-royal font-bold text-[11px] border border-[#C5A869]/40">
                          {yearsTogether} Glorious Years Together
                        </span>
                      )}
                    </div>

                    <input
                      type="date"
                      required
                      value={marriageAnniversary}
                      onChange={(e) => {
                        setMarriageAnniversary(e.target.value);
                        if (e.target.value) {
                          triggerConfettiFanfare();
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Current City of Residence *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Indore"
                        value={currentCity}
                        onChange={(e) => setCurrentCity(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                        Native Place / Hometown
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ratlam, Udaipur, Indore"
                        value={nativePlace}
                        onChange={(e) => setNativePlace(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                      Complete Residential Address *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="House/Bungalow number, street, colony, landmark, pincode..."
                      value={residentialAddress}
                      onChange={(e) => setResidentialAddress(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: CHILDREN / ROYAL HEIRS */}
              {activeStep === 4 && (
                <div key={4} className="space-y-4 animate-fade-in-up">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE]">
                    <div>
                      <h4 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                        Royal Heirs &amp; Children
                      </h4>
                      <p className="text-xs text-[#78716C]">
                        Register details for your sons and daughters.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#57534E]">Have children?</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !hasChildren;
                          setHasChildren(next);
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
                  </div>

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
                              <span>Royal Heir #{index + 1}</span>
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
                              <label className="block text-[11px] font-semibold uppercase text-[#44403C] mb-1">
                                Child Full Name
                              </label>
                              <input
                                type="text"
                                placeholder="Child full name"
                                value={child.name}
                                onChange={(e) => handleUpdateChild(child.id, 'name', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[#D9CDB8] text-xs bg-white outline-hidden focus:ring-1 focus:ring-[#C5A869]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase text-[#44403C] mb-1">
                                Gender
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
                              <label className="block text-[11px] font-semibold uppercase text-[#44403C] mb-1">
                                Date of Birth / Age
                              </label>
                              <input
                                type="date"
                                value={child.dob}
                                onChange={(e) => handleUpdateChild(child.id, 'dob', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[#D9CDB8] text-xs bg-white outline-hidden focus:ring-1 focus:ring-[#C5A869]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase text-[#44403C] mb-1">
                                School / College / Profession
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Daly College / IIT / Working"
                                value={child.education}
                                onChange={(e) => handleUpdateChild(child.id, 'education', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-[#D9CDB8] text-xs bg-white outline-hidden focus:ring-1 focus:ring-[#C5A869]"
                              />
                            </div>
                          </div>

                          {/* Child Photo / Google Drive Link */}
                          <PhotoUploadOrDriveLink
                            label={`📸 ${child.name.trim() ? `${child.name.trim()}'s` : `Child #${index + 1}`} Photo / Google Drive Link`}
                            subtitle="Upload a portrait of this child or paste a Google Drive photo URL"
                            value={child.photo_url || null}
                            onChange={(url) => handleUpdateChild(child.id, 'photo_url', url || '')}
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddChild}
                        className="w-full py-3 rounded-xl border border-dashed border-[#8C6D2B] bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#8C6D2B] font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Add Another Royal Child</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#FAF7F2] rounded-2xl border border-[#E7DDCE] text-xs text-[#78716C] space-y-1">
                      <Baby className="w-8 h-8 text-[#8C6D2B] mx-auto opacity-50 mb-2" />
                      <div className="font-semibold text-[#1C1917]">No Children Registered</div>
                      <div>Couples without children can proceed directly to the next step.</div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5: PORTRAIT & ROYAL VISION */}
              {activeStep === 5 && (
                <div key={5} className="space-y-6 animate-fade-in-up">
                  
                  {/* Family Portrait Photo or Google Drive Link */}
                  <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] space-y-3">
                    <PhotoUploadOrDriveLink
                      label="📸 Royal Family Group Portrait / Google Drive Link"
                      subtitle="Upload a high-resolution family photo or paste your Google Drive link for the 2027 Heritage Directory"
                      value={familyPhotoUrl}
                      onChange={setFamilyPhotoUrl}
                    />
                  </div>

                  {/* Contribution Areas */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C]">
                      Areas Where You&apos;d Love to Contribute
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
                  </div>

                  {/* Royal Idea */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1">
                      One Grand Idea for JSG Royals Year 2 (2027)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Share a unique event, retreat, or initiative you would love our royal club to organize..."
                      value={royalIdea}
                      onChange={(e) => setRoyalIdea(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                    />
                  </div>
                </div>
              )}

              {/* STEP 6: REVIEW & ROYAL SEAL */}
              {activeStep === 6 && (
                <div key={6} className="space-y-6 animate-fade-in-up">
                  
                  {/* Parchment Certificate Review Card */}
                  <div className="p-6 rounded-3xl bg-gradient-to-br from-[#1C1917] via-[#24201D] to-[#12100E] text-[#FAF7F2] border-2 border-[#D4AF37] space-y-5 shadow-2xl relative overflow-hidden">
                    <RoyalCornerBrackets />
                    
                    <div className="flex items-center justify-between pb-3 border-b border-[#C5A869]/30">
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-[#D4AF37] animate-pulse-gold" />
                        <span className="font-serif-royal font-bold text-sm text-[#D4AF37] tracking-wider">
                          Royal Family Seal of Authenticity
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A8A29E] uppercase tracking-wider">
                        Master Record Review
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold block">
                          🤵 Royal Gentleman
                        </span>
                        <div className="font-bold text-sm text-white">{husbandName || 'Not entered'}</div>
                        <div className="text-[11px] text-[#D6D3D1]">{husbandMobile}</div>
                        <div className="text-[11px] text-[#A8A29E] truncate">{husbandEmail}</div>
                        <div className="text-[10px] text-[#D4AF37] pt-1">
                          {husbandPhotoUrl ? '✓ Photo / Drive Link Attached' : 'No Photo Attached'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-bold block">
                          👰 Royal Lady
                        </span>
                        <div className="font-bold text-sm text-white">{wifeName || 'Not entered'}</div>
                        <div className="text-[11px] text-[#D6D3D1]">{wifeMobile}</div>
                        <div className="text-[11px] text-[#A8A29E] truncate">{wifeEmail}</div>
                        <div className="text-[10px] text-[#D4AF37] pt-1">
                          {wifePhotoUrl ? '✓ Photo / Drive Link Attached' : 'No Photo Attached'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#C5A869]/30 text-xs">
                      <div>
                        <span className="text-[10px] text-[#A8A29E] uppercase block">Anniversary</span>
                        <span className="font-semibold text-[#D4AF37]">{marriageAnniversary || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A8A29E] uppercase block">Residence</span>
                        <span className="text-white truncate block">{currentCity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A8A29E] uppercase block">Children</span>
                        <span className="text-white">
                          {hasChildren ? `${children.filter((c) => c.name.trim().length > 0).length} Royal Heir(s)` : 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#A8A29E] uppercase block">Family Portrait</span>
                        <span className="text-[#D4AF37]">
                          {familyPhotoUrl ? '✓ Attached' : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <Sparkles className="w-4 h-4 text-[#8C6D2B]" />
                      <span>Automated Cross-Spouse Sync:</span>
                    </div>
                    <p className="text-[11px]">
                      Upon sealing, if your spouse visits the portal with their email ({gateRole === 'husband' ? wifeEmail || 'Wife' : husbandEmail || 'Husband'}),
                      they will immediately be presented with this completed dossier!
                    </p>
                  </div>
                </div>
              )}

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-[#F0E8DC]">
                {activeStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep((prev) => prev - 1)}
                    className="px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous Step</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resetToEntrance}
                    className="px-4 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition-all cursor-pointer"
                  >
                    Change Email / Exit
                  </button>
                )}

                {activeStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canProceedStep()) {
                        setSubmitError('Please complete the required fields before continuing.');
                        return;
                      }
                      setSubmitError(null);
                      setActiveStep((prev) => prev + 1);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 border border-[#C5A869]/40 cursor-pointer"
                  >
                    <span>Next: {activeStep === 1 ? 'Wife Details' : activeStep === 2 ? 'Union' : activeStep === 3 ? 'Children' : activeStep === 4 ? 'Portrait' : 'Review'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#D4AF37]" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#1C1917] via-[#2A2623] to-[#12100E] hover:from-black hover:to-[#1C1917] text-[#FAF7F2] font-serif-royal font-bold text-sm shadow-2xl transition-all flex items-center gap-2 border-2 border-[#D4AF37] cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                        <span>Sealing Royal Dossier...</span>
                      </>
                    ) : (
                      <>
                        <Crown className="w-4 h-4 text-[#D4AF37]" />
                        <span>Seal &amp; Submit Family Dossier</span>
                        <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: OFFICIAL CERTIFICATE OF REGISTRATION (SUCCESS)                    */}
      {/* ========================================================================= */}
      {currentView === 'success' && (
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20 relative z-10 animate-fade-in-up">
          <div className="bg-[#FFFFFF]/95 backdrop-blur-md border-2 border-[#C5A869] rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 relative overflow-hidden royal-box-shadow animate-in zoom-in-95">
            
            <div className="absolute top-0 left-0 right-0 h-2 shimmer-gold-bg" />
            <RoyalCornerBrackets />

            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1C1917] to-[#25221F] border-2 border-[#D4AF37] text-[#D4AF37] flex items-center justify-center mx-auto shadow-2xl animate-bounce">
              <Crown className="w-10 h-10 text-[#D4AF37]" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#8C6D2B]">
                Official Certificate of Registration
              </span>
              <h2 className="font-serif-royal text-2xl sm:text-3xl font-extrabold text-[#1C1917]">
                Family Dossier Sealed &amp; Registered!
              </h2>
              <RoyalFlourish />
              <p className="text-xs sm:text-sm text-[#78716C] max-w-md mx-auto">
                Congratulations! Your royal household has been officially entered into the JSG Royals Year 2 • 2027 Directory.
              </p>
            </div>

            {finalRegistration && (
              <div className="space-y-4 text-left">
                {/* Official Code Header */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E2D5BE] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">Official Registration Code</span>
                    <span className="font-mono font-black text-lg text-[#8C6D2B]">{finalRegistration.reg_id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Sealed &amp; Verified
                    </span>
                    <span className="text-[10px] text-[#78716C] block mt-1">
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
                      {finalRegistration.husband_occupation && <div>💼 {finalRegistration.husband_occupation}{finalRegistration.husband_organization ? ` at ${finalRegistration.husband_organization}` : ''}</div>}
                      {finalRegistration.husband_blood_group && <div>🩸 Blood Group: <strong>{finalRegistration.husband_blood_group}</strong></div>}
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
                      {finalRegistration.wife_occupation && <div>💼 {finalRegistration.wife_occupation}{finalRegistration.wife_organization ? ` at ${finalRegistration.wife_organization}` : ''}</div>}
                      {finalRegistration.wife_blood_group && <div>🩸 Blood Group: <strong>{finalRegistration.wife_blood_group}</strong></div>}
                      <DossierPhotoThumbnail url={finalRegistration.wife_photo_url} alt={finalRegistration.wife_name} />
                    </div>
                  </div>
                </div>

                {/* Residence & Anniversary */}
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D5BE] text-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716C] block">Marriage Anniversary</span>
                      <span className="font-semibold text-[#1C1917]">{finalRegistration.marriage_anniversary}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#78716C] block">Current City</span>
                      <span className="font-semibold text-[#1C1917]">{finalRegistration.current_city}</span>
                    </div>
                  </div>
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
                            <span className="font-semibold text-[#1C1917]">{c.name}</span>
                            <span className="text-[10px] uppercase font-bold text-[#8C6D2B] bg-white px-2 py-0.5 rounded border border-[#E2D5BE]">
                              {c.gender} {c.dob ? `• ${c.dob}` : ''}
                            </span>
                          </div>
                          <DossierPhotoThumbnail url={c.photo_url} alt={c.name} />
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

                {/* Contributions / Vision */}
                {(finalRegistration.contribution_areas || finalRegistration.royal_idea || finalRegistration.jsg_should_be_known_for) && (
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2D5BE] text-xs space-y-2">
                    {finalRegistration.contribution_areas && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">Areas of Contribution</span>
                        <span className="text-[#1C1917] font-medium">{finalRegistration.contribution_areas}</span>
                      </div>
                    )}
                    {finalRegistration.royal_idea && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#78716C] block">Royal Year 2 Idea</span>
                        <p className="text-[#57534E] italic font-serif-royal">"{finalRegistration.royal_idea}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-left flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong>Cross-Spouse Sync Enabled:</strong> Your registration has been securely recorded. When your spouse logs in with their email, they will automatically see this verified family dossier.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white hover:bg-[#FAF7F2] text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#8C6D2B]" />
                <span>Print / Save Dossier Slip</span>
              </button>

              <button
                type="button"
                onClick={triggerConfettiFanfare}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs shadow-md transition-all flex items-center justify-center gap-2 border border-[#C5A869]/40 cursor-pointer"
              >
                <PartyPopper className="w-4 h-4 text-[#D4AF37]" />
                <span>Celebrate!</span>
              </button>

              <button
                type="button"
                onClick={resetToEntrance}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-white hover:bg-[#FAF7F2] text-[#78716C] hover:text-[#1C1917] font-semibold text-xs border border-[#D9CDB8] transition-all cursor-pointer"
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
