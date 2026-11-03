import React, { useState, useEffect } from 'react';
import {
  Crown,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Building2,
  MapPin,
  Users,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Edit3,
  Check,
  Heart,
  HelpCircle,
  Briefcase,
  Compass,
  Gift,
  Camera,
  UploadCloud,
  Trash2
} from 'lucide-react';
import {
  MemberYear1,
  Year2ProfileData,
  Year2PreferenceData,
} from '../lib/types.ts';
import { saveDraftApi, resetDraftApi, submitYear2Api, uploadPhotoMultipartApi, deletePhotoApi } from '../lib/api.ts';

interface Year2FormProps {
  token: string;
  member: MemberYear1;
  initialProfile: Year2ProfileData | null;
  initialPreferences: Year2PreferenceData | null;
  initialPhoto?: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  } | null;
  hasDraft?: boolean;
  isSubmitted?: boolean;
  submissionDate?: string | null;
  onSuccessSubmit: () => void;
  onBackToProfile: () => void;
}

// Fixed option constants matching Step 5 specification
const OCCUPATION_OPTIONS = [
  'No change',
  'Changed occupation',
  'Started a new business',
  'Changed business',
  'Changed organization',
  'Other',
];

const FAMILY_OPTIONS = [
  'No change',
  'New child',
  'Child milestone',
  'Family member change',
  'Other',
];

const WISHLIST_OPTIONS = [
  'Luxury travel',
  'Weekend getaways',
  'Family trips',
  'Adventure',
  'Sports',
  'Food & dining',
  'Parties & celebrations',
  'Wellness',
  'Cultural experiences',
  'Kids & family activities',
  'Business networking',
  'Community / social initiatives',
  'Other',
];

const CONTRIBUTION_OPTIONS = [
  'Event planning',
  'Travel planning',
  'Sports',
  'Food & hospitality',
  'Photography',
  'Video / content',
  'Design / creative',
  'Business networking',
  'Family activities',
  'Kids activities',
  'Sponsorship',
  'Venue / logistics',
  'Technology',
  'Community initiatives',
  'Other',
];

const IDENTITY_OPTIONS = [
  'Friendship',
  'Family',
  'Experiences',
  'Travel',
  'Celebrations',
  'Sports',
  'Business networking',
  'Giving back',
  'Kids & families',
  'Something else',
];

export const Year2Form: React.FC<Year2FormProps> = ({
  token,
  member,
  initialProfile,
  initialPreferences,
  initialPhoto,
  hasDraft: propHasDraft = false,
  isSubmitted = false,
  submissionDate,
  onSuccessSubmit,
  onBackToProfile,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(
    initialProfile?.last_step && initialProfile.last_step >= 1 && initialProfile.last_step <= 7
      ? initialProfile.last_step
      : 1
  );
  const totalSteps = 7;

  // Step 6: Photo Upload state
  const [photoData, setPhotoData] = useState<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  } | null>(initialPhoto || (initialProfile?.photo_id ? {
    id: initialProfile.photo_id,
    filename: initialProfile.photo_filename || 'family_photo.jpg',
    mimeType: initialProfile.photo_mime || 'image/jpeg',
    sizeBytes: initialProfile.photo_size || 0,
    url: initialProfile.family_photo_url || `/api/member/photo/${initialProfile.photo_id}`
  } : null));

  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialPhoto) {
      setPhotoData(initialPhoto);
    }
  }, [initialPhoto]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPhotoError(null);

    // Reject 0-byte file
    if (file.size === 0) {
      setPhotoError('File is empty (0 bytes). Please select a valid photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Reject > 10MB
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('Photo exceeds the maximum allowed size of 10 MB. Please select a smaller photo.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.webp');

    if (!validTypes.includes(file.type.toLowerCase()) && !hasValidExt) {
      setPhotoError('Unsupported file format. Please upload a JPG, PNG, or WEBP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingPhoto(true);
    try {
      const res = await uploadPhotoMultipartApi(token, file);
      setPhotoData({
        id: res.photoId,
        filename: res.filename,
        mimeType: res.mimeType,
        sizeBytes: res.sizeBytes,
        url: res.url,
      });
      setPhotoError(null);
      await persistDraft(6);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!photoData) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      await deletePhotoApi(token);
      setPhotoData(null);
      await persistDraft(6);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to remove photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Step 1: Your Year
  const [city, setCity] = useState(
    initialProfile?.current_city || initialProfile?.city || member.year1_city || 'Indore'
  );
  const [residentialAddress, setResidentialAddress] = useState(
    initialProfile?.residential_address || ''
  );
  const [occupationStatus, setOccupationStatus] = useState<string>(
    initialProfile?.occupation_status || 'No change'
  );
  const [occupationDetails, setOccupationDetails] = useState<string>(
    initialProfile?.occupation_details || ''
  );
  const [organizationUpdate, setOrganizationUpdate] = useState<string>(
    initialProfile?.organization_update || initialProfile?.organization_firm_name || ''
  );

  // Step 2: Family
  const [familyStatus, setFamilyStatus] = useState<string>(
    initialProfile?.family_status || 'No change'
  );
  const [familyDetails, setFamilyDetails] = useState<string>(
    initialProfile?.family_details || ''
  );

  // Step 3: Wishlist
  const [wishlist, setWishlist] = useState<string[]>(
    initialPreferences?.wishlist || []
  );
  const [wishlistOther, setWishlistOther] = useState<string>(
    initialPreferences?.wishlist_other || ''
  );
  const [dreamExperience, setDreamExperience] = useState<string>(
    initialPreferences?.dream_experience || ''
  );

  // Step 4: Contribution
  const [contributionAreas, setContributionAreas] = useState<string[]>(
    initialPreferences?.contribution_areas || []
  );
  const [contributionOther, setContributionOther] = useState<string>(
    initialPreferences?.contribution_other || ''
  );
  const [contributionHelpText, setContributionHelpText] = useState<string>(
    initialPreferences?.contribution_help_text || ''
  );

  // Step 5: Royal Idea & Identity
  const [royalIdea, setRoyalIdea] = useState<string>(
    initialPreferences?.royal_idea || ''
  );
  const [identityKnownFor, setIdentityKnownFor] = useState<string[]>(
    initialPreferences?.identity_known_for || []
  );
  const [identityOther, setIdentityOther] = useState<string>('');
  const [identityStatement, setIdentityStatement] = useState<string>(
    initialPreferences?.identity_statement || initialPreferences?.jsg_royals_identity || ''
  );

  // Resume Banner & Reset Modal state
  const [showResumeBanner, setShowResumeBanner] = useState<boolean>(propHasDraft && !isSubmitted);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Autosave and Submission state
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  // Save draft to backend
  const persistDraft = async (stepToSave: number = currentStep) => {
    if (isSubmitted) return;
    setSavingStatus('saving');
    try {
      await saveDraftApi(
        token,
        {
          current_city: city.trim(),
          residential_address: residentialAddress.trim(),
          occupation_status: occupationStatus,
          occupation_details: occupationDetails.trim(),
          organization_update: organizationUpdate.trim(),
          family_status: familyStatus,
          family_details: familyDetails.trim(),
          last_step: stepToSave,
        },
        {
          wishlist,
          wishlist_other: wishlistOther.trim(),
          dream_experience: dreamExperience.trim(),
          contribution_areas: contributionAreas,
          contribution_other: contributionOther.trim(),
          contribution_help_text: contributionHelpText.trim(),
          royal_idea: royalIdea.trim(),
          identity_known_for: identityKnownFor,
          identity_statement: identityStatement.trim(),
        }
      );
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2500);
    } catch (e) {
      setSavingStatus('idle');
    }
  };

  // Step navigation
  const handleNextStep = async () => {
    const nextStep = Math.min(currentStep + 1, totalSteps);
    await persistDraft(nextStep);
    setCurrentStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = async () => {
    const prevStep = Math.max(currentStep - 1, 1);
    await persistDraft(prevStep);
    setCurrentStep(prevStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToStep = async (step: number) => {
    await persistDraft(step);
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle multi-select options
  const toggleWishlistOption = (opt: string) => {
    if (wishlist.includes(opt)) {
      setWishlist(wishlist.filter((x) => x !== opt));
    } else {
      setWishlist([...wishlist, opt]);
    }
  };

  const toggleContributionOption = (opt: string) => {
    if (contributionAreas.includes(opt)) {
      setContributionAreas(contributionAreas.filter((x) => x !== opt));
    } else {
      setContributionAreas([...contributionAreas, opt]);
    }
  };

  const toggleIdentityOption = (opt: string) => {
    if (identityKnownFor.includes(opt)) {
      setIdentityKnownFor(identityKnownFor.filter((x) => x !== opt));
    } else {
      setIdentityKnownFor([...identityKnownFor, opt]);
    }
  };

  // Validate required fields
  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!city || city.trim() === '') {
      errors.push('Current city is required (Step 1).');
    }
    if (!familyStatus || familyStatus.trim() === '') {
      errors.push('Family update selection is required (Step 2).');
    }
    if (!wishlist || wishlist.length === 0) {
      errors.push('Please select at least one Wishlist option (Step 3).');
    }
    if (!contributionAreas || contributionAreas.length === 0) {
      errors.push('Please select at least one Contribution area (Step 4).');
    }
    return errors;
  };

  // Handle final submission
  const handleSubmitForm = async () => {
    setSubmitErrorMessage(null);
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationErrors([]);
    setSubmitting(true);

    try {
      // First save latest inputs
      await saveDraftApi(
        token,
        {
          current_city: city.trim(),
          residential_address: residentialAddress.trim(),
          occupation_status: occupationStatus,
          occupation_details: occupationDetails.trim(),
          organization_update: organizationUpdate.trim(),
          family_status: familyStatus,
          family_details: familyDetails.trim(),
          last_step: 7,
        },
        {
          wishlist,
          wishlist_other: wishlistOther.trim(),
          dream_experience: dreamExperience.trim(),
          contribution_areas: contributionAreas,
          contribution_other: contributionOther.trim(),
          contribution_help_text: contributionHelpText.trim(),
          royal_idea: royalIdea.trim(),
          identity_known_for: identityKnownFor,
          identity_statement: identityStatement.trim(),
        }
      );

      // Perform final submission
      await submitYear2Api(token);
      onSuccessSubmit();
    } catch (err: any) {
      setSubmitErrorMessage(err.message || 'Failed to submit Year-2 update.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle "Start over" action
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetDraftApi(token);
      // Reset local state to initial defaults
      setCity(member.year1_city || 'Indore');
      setResidentialAddress('');
      setOccupationStatus('No change');
      setOccupationDetails('');
      setOrganizationUpdate('');
      setFamilyStatus('No change');
      setFamilyDetails('');
      setWishlist([]);
      setWishlistOther('');
      setDreamExperience('');
      setContributionAreas([]);
      setContributionOther('');
      setContributionHelpText('');
      setRoyalIdea('');
      setIdentityKnownFor([]);
      setIdentityStatement('');
      setPhotoData(null);
      setPhotoError(null);
      setCurrentStep(1);
      setShowResumeBanner(false);
      setShowResetConfirmModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to reset draft.');
    } finally {
      setIsResetting(false);
    }
  };

  // If already submitted, display locked banner
  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#FFFFFF] border-2 border-[#E9DFCE] rounded-3xl p-6 sm:p-8 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="font-serif-royal text-2xl font-bold text-[#1C1917]">
            Your Year-2 update has already been submitted.
          </h2>
          <p className="text-sm text-[#78716C] max-w-md mx-auto">
            Thank you, Royals! Your Year-2 membership details for {member.couple_id} are safely recorded in the registry and locked from duplicate submissions.
          </p>
          {submissionDate && (
            <p className="text-xs font-mono text-[#8C6D2B]">
              Submitted on: {new Date(submissionDate).toLocaleDateString()}
            </p>
          )}
          <div className="pt-4">
            <button
              type="button"
              onClick={onBackToProfile}
              className="py-2.5 px-6 rounded-xl bg-[#1C1917] text-[#FAF7F2] font-semibold text-xs tracking-wider uppercase"
            >
              Back to Member Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      
      {/* 1. WELCOME HEADER */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-xs font-semibold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{member.couple_id} • {member.husband_name} &amp; {member.wife_name}</span>
        </div>
        <h1 className="font-serif-royal text-2xl sm:text-3xl font-extrabold text-[#1C1917] tracking-tight">
          Welcome to JSG Royals — Year 2 👑
        </h1>
        <p className="font-serif italic text-base sm:text-lg text-[#78716C]">
          Let&apos;s make 2027 another year to remember.
        </p>
      </div>

      {/* 2. INCOMPLETE DRAFT RESUME PROMPT BANNER */}
      {showResumeBanner && (
        <div className="bg-[#FAF7F2] border-2 border-[#DFCFAE] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#EFE6D5] text-[#8C6D2B] flex items-center justify-center shrink-0 mt-0.5">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif-royal font-bold text-sm text-[#1C1917]">
                Welcome back, Royals 👑
              </h3>
              <p className="text-xs text-[#78716C]">
                You&apos;ve already started your Year-2 update. We saved your draft so you can easily continue.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 sm:pl-11">
            <button
              type="button"
              onClick={() => setShowResumeBanner(false)}
              className="py-2 px-4 rounded-xl bg-[#1C1917] text-[#FAF7F2] font-semibold text-xs tracking-wider uppercase hover:bg-[#2A2623] transition-all"
            >
              Continue where I left off
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              className="py-2 px-4 rounded-xl bg-transparent hover:bg-[#EFE6D5] text-[#8C6D2B] font-semibold text-xs tracking-wider uppercase transition-all border border-[#DFCFAE]"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* 3. PROGRESS INDICATOR & AUTOSAVE STATUS */}
      <div className="bg-[#FFFFFF] border border-[#E9DFCE] rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-[#8C6D2B] font-mono">
            STEP {currentStep} OF {totalSteps}
          </span>
          <span className="text-[11px] text-[#78716C]">
            {savingStatus === 'saving' && 'Saving draft...'}
            {savingStatus === 'saved' && (
              <span className="text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Draft saved
              </span>
            )}
            {savingStatus === 'idle' && (
              <button
                type="button"
                onClick={() => persistDraft()}
                className="hover:underline text-[#8C6D2B]"
              >
                Save progress
              </button>
            )}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#FAF7F2] h-2 rounded-full overflow-hidden border border-[#EFEAE1]">
          <div
            className="bg-[#1C1917] h-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Titles Pill List */}
        <div className="flex items-center justify-between text-[11px] font-medium text-[#78716C] pt-1 overflow-x-auto gap-2">
          <span className={currentStep === 1 ? 'font-bold text-[#1C1917]' : ''}>1. Year</span>
          <span className={currentStep === 2 ? 'font-bold text-[#1C1917]' : ''}>2. Family</span>
          <span className={currentStep === 3 ? 'font-bold text-[#1C1917]' : ''}>3. Wishlist</span>
          <span className={currentStep === 4 ? 'font-bold text-[#1C1917]' : ''}>4. Contribution</span>
          <span className={currentStep === 5 ? 'font-bold text-[#1C1917]' : ''}>5. Idea</span>
          <span className={currentStep === 6 ? 'font-bold text-[#1C1917]' : ''}>6. Photo</span>
          <span className={currentStep === 7 ? 'font-bold text-[#1C1917]' : ''}>7. Review</span>
        </div>
      </div>

      {/* VALIDATION ALERT */}
      {validationErrors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Please complete all required fields:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {submitErrorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          <span>{submitErrorMessage}</span>
        </div>
      )}

      {/* 4. MAIN FORM BODY */}
      <div className="bg-[#FFFFFF] border-2 border-[#E9DFCE] rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* ========================================================= */}
        {/* STEP 1: YOUR YEAR */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 1 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                What&apos;s new in your world?
              </h2>
              <p className="text-xs text-[#78716C]">
                Help us keep your primary residence and professional details up to date.
              </p>
            </div>

            {/* Current City (Required) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Current City <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#8C6D2B] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Indore, Mumbai, Dubai, etc."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30 focus:border-[#8C6D2B]"
                />
              </div>
              <p className="text-[11px] text-[#78716C]">
                Confirm or update the primary city where you currently reside.
              </p>
            </div>

            {/* Residential Address (Optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Residential Address <span className="text-[10px] text-[#78716C] lowercase font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={residentialAddress}
                onChange={(e) => setResidentialAddress(e.target.value)}
                placeholder="Current home or residential address"
                className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30 focus:border-[#8C6D2B]"
              />
            </div>

            {/* Occupation / Business Updates */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Occupation / Business: Has anything changed in your professional life?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {OCCUPATION_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      occupationStatus === opt
                        ? 'border-[#8C6D2B] bg-[#FAF7F2] font-semibold text-[#1C1917]'
                        : 'border-[#EFEAE1] hover:bg-[#FAF8F5] text-[#57534E]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="occupation_status"
                      value={opt}
                      checked={occupationStatus === opt}
                      onChange={() => setOccupationStatus(opt)}
                      className="accent-[#8C6D2B]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {/* Conditional: Tell us what's new */}
              {occupationStatus !== 'No change' && (
                <div className="space-y-1.5 pt-2 animate-fadeIn">
                  <label className="block text-xs font-semibold text-[#1C1917]">
                    Tell us what&apos;s new
                  </label>
                  <input
                    type="text"
                    value={occupationDetails}
                    onChange={(e) => setOccupationDetails(e.target.value)}
                    placeholder="Briefly describe your new role, venture, or industry..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FFFFFF] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
                  />
                </div>
              )}
            </div>

            {/* Organization / Business Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Organization / Business <span className="text-[10px] text-[#78716C] lowercase font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-[#8C6D2B] absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={organizationUpdate}
                  onChange={(e) => setOrganizationUpdate(e.target.value)}
                  placeholder="e.g. Firm name, company, or practice"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: FAMILY */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 2 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                What&apos;s new with the family?
              </h2>
              <p className="text-xs text-[#78716C]">
                Keep the royal family ledger refreshed with your family updates.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Any family updates since Year 1? <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FAMILY_OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      familyStatus === opt
                        ? 'border-[#8C6D2B] bg-[#FAF7F2] font-semibold text-[#1C1917]'
                        : 'border-[#EFEAE1] hover:bg-[#FAF8F5] text-[#57534E]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="family_status"
                      value={opt}
                      checked={familyStatus === opt}
                      onChange={() => setFamilyStatus(opt)}
                      className="accent-[#8C6D2B]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>

              {/* Conditional: Tell us about it */}
              {familyStatus !== 'No change' && (
                <div className="space-y-1.5 pt-2 animate-fadeIn">
                  <label className="block text-xs font-semibold text-[#1C1917]">
                    Tell us about it
                  </label>
                  <textarea
                    rows={3}
                    value={familyDetails}
                    onChange={(e) => setFamilyDetails(e.target.value)}
                    placeholder="Tell us about the milestone, welcoming a new member, or educational update..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FFFFFF] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
                  />
                  <p className="text-[11px] text-[#78716C]">
                    Note: Please do not enter sensitive government ID numbers or documents.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: YEAR-2 WISHLIST */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 3 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                What would make Year 2 special?
              </h2>
              <p className="text-xs text-[#78716C]">
                Select the gatherings, retreats, and experiences you would love to enjoy with JSG Royals in 2027.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                  Wishlist Experiences <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-[#8C6D2B] font-semibold">
                  {wishlist.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WISHLIST_OPTIONS.map((opt) => {
                  const isChecked = wishlist.includes(opt);
                  return (
                    <label
                      key={opt}
                      onClick={() => toggleWishlistOption(opt)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#8C6D2B] bg-[#FAF7F2] font-semibold text-[#1C1917]'
                          : 'border-[#EFEAE1] hover:bg-[#FAF8F5] text-[#57534E]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="accent-[#8C6D2B] rounded"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>

              {/* Custom Other input if 'Other' is checked */}
              {wishlist.includes('Other') && (
                <div className="pt-2 animate-fadeIn space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1C1917]">
                    Specify other wishlist idea:
                  </label>
                  <input
                    type="text"
                    value={wishlistOther}
                    onChange={(e) => setWishlistOther(e.target.value)}
                    placeholder="What else would you love to see happen in Year 2?"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FFFFFF] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
                  />
                </div>
              )}
            </div>

            {/* Optional: Dream JSG Royals experience */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Your dream JSG Royals experience <span className="text-[10px] text-[#78716C] lowercase font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={dreamExperience}
                onChange={(e) => setDreamExperience(e.target.value)}
                placeholder="Paint a picture of your ideal getaway, celebration, or club gathering..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: YOUR CONTRIBUTION */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 4 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                Every Royal makes the family stronger.
              </h2>
              <p className="text-xs text-[#78716C]">
                Where would you like to contribute or help organise?
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                  Contribution Areas <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-[#8C6D2B] font-semibold">
                  {contributionAreas.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CONTRIBUTION_OPTIONS.map((opt) => {
                  const isChecked = contributionAreas.includes(opt);
                  return (
                    <label
                      key={opt}
                      onClick={() => toggleContributionOption(opt)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#8C6D2B] bg-[#FAF7F2] font-semibold text-[#1C1917]'
                          : 'border-[#EFEAE1] hover:bg-[#FAF8F5] text-[#57534E]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-[#8C6D2B] rounded"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>

              {/* Custom Other input if 'Other' is checked */}
              {contributionAreas.includes('Other') && (
                <div className="pt-2 animate-fadeIn space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1C1917]">
                    Specify other contribution area:
                  </label>
                  <input
                    type="text"
                    value={contributionOther}
                    onChange={(e) => setContributionOther(e.target.value)}
                    placeholder="Tell us what special talent, connection or skill you bring..."
                    className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FFFFFF] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
                  />
                </div>
              )}
            </div>

            {/* Optional: I'd love to help with... */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                I&apos;d love to help with... <span className="text-[10px] text-[#78716C] lowercase font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={contributionHelpText}
                onChange={(e) => setContributionHelpText(e.target.value)}
                placeholder="Any specific initiative, committee, or vision you'd like to spearhead..."
                className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 5: YOUR ROYAL IDEA & IDENTITY */}
        {/* ========================================================= */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 5 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                Your idea could become our next favourite memory.
              </h2>
              <p className="text-xs text-[#78716C]">
                Help craft the soul and signature experiences of JSG Royals in 2027.
              </p>
            </div>

            {/* 1. If you could introduce ONE new idea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                If you could introduce ONE new idea to JSG Royals in 2027, what would it be?
              </label>
              <textarea
                rows={4}
                value={royalIdea}
                onChange={(e) => setRoyalIdea(e.target.value)}
                placeholder="Think big, small, crazy or completely unexpected..."
                className="w-full px-4 py-3 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
              />
            </div>

            {/* 2. What should JSG Royals be known for? */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                What should JSG Royals be known for?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {IDENTITY_OPTIONS.map((opt) => {
                  const isChecked = identityKnownFor.includes(opt);
                  return (
                    <label
                      key={opt}
                      onClick={() => toggleIdentityOption(opt)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-[#8C6D2B] bg-[#FAF7F2] font-semibold text-[#1C1917]'
                          : 'border-[#EFEAE1] hover:bg-[#FAF8F5] text-[#57534E]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="accent-[#8C6D2B] rounded"
                      />
                      <span className="truncate">{opt}</span>
                    </label>
                  );
                })}
              </div>

              {identityKnownFor.includes('Something else') && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={identityOther}
                    onChange={(e) => setIdentityOther(e.target.value)}
                    placeholder="Specify other defining quality..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D9CDB8] text-xs bg-[#FFFFFF]"
                  />
                </div>
              )}
            </div>

            {/* 3. In one sentence, what should JSG Royals stand for? */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                In one sentence, what should JSG Royals stand for? <span className="text-[10px] text-[#78716C] lowercase font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={identityStatement}
                onChange={(e) => setIdentityStatement(e.target.value)}
                placeholder="e.g. Unconditional warmth, unforgettable adventures, and lifelong family bonds."
                className="w-full px-4 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF8F5] text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#8C6D2B]/30"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 6: ONE PICTURE FOR YEAR 2 📸 */}
        {/* ========================================================= */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 6 of 7
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917] flex items-center gap-2">
                <span>One picture for Year 2 📸</span>
              </h2>
              <p className="text-xs text-[#78716C]">
                Let&apos;s capture one more Royal memory.
              </p>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {/* Error message */}
            {photoError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{photoError}</span>
              </div>
            )}

            {photoData ? (
              /* Uploaded Photo Preview Card */
              <div className="bg-[#FAF8F5] border-2 border-[#D9CDB8] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#EFEAE1]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                      Photograph Attached
                    </span>
                  </div>
                  <span className="text-[11px] text-[#78716C] font-mono">
                    {(photoData.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                {/* Framed Image Display */}
                <div className="relative group rounded-xl overflow-hidden bg-black/5 border border-[#DFCFAE] flex items-center justify-center p-2">
                  <img
                    src={`/api/member/photo/${photoData.id}?token=${token}`}
                    alt="Year 2 Royal Memory"
                    className="max-h-72 w-auto object-contain rounded-lg shadow-sm"
                  />
                </div>

                {/* File info details */}
                <div className="text-xs text-[#78716C] space-y-1 bg-white p-3 rounded-xl border border-[#EFEAE1]">
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#1C1917]">File:</span>
                    <span className="font-mono truncate max-w-[200px]">{photoData.filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#1C1917]">Format:</span>
                    <span className="uppercase">{photoData.mimeType.replace('image/', '')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-[#1C1917]">Private Storage:</span>
                    <span className="text-emerald-700 font-semibold">Protected & Authenticated</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="py-2.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#D4AF37]" />
                    <span>Change photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="py-2.5 px-4 rounded-xl bg-transparent hover:bg-red-50 text-red-600 border border-red-200 font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove photo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone / Upload area */
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#C5A869]/60 hover:border-[#8C6D2B] bg-[#FAF8F5] hover:bg-[#F5F0E6] transition-all rounded-3xl p-8 text-center cursor-pointer space-y-4 group"
              >
                <div className="w-16 h-16 rounded-full bg-[#EFE6D5] group-hover:scale-105 transition-transform flex items-center justify-center mx-auto text-[#8C6D2B] shadow-inner">
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-[#8C6D2B] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-serif-royal font-bold text-base text-[#1C1917]">
                    {uploadingPhoto ? 'Validating and uploading photo...' : 'Click to select your Year-2 photograph'}
                  </h3>
                  <p className="text-xs text-[#78716C] max-w-sm mx-auto">
                    Choose one high-resolution family or couple photograph to be treasured in the JSG Royals Year-2 registry.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#EFEAE1] text-[11px] text-[#8C6D2B] font-medium">
                  <span>JPG, PNG or WEBP</span>
                  <span>•</span>
                  <span>Max 10 MB</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 7: REVIEW & SUBMISSION */}
        {/* ========================================================= */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="space-y-1 border-b border-[#F0E8DC] pb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
                Step 7 of 7 • Final Review
              </span>
              <h2 className="font-serif-royal text-xl sm:text-2xl font-bold text-[#1C1917]">
                Review Your Year-2 Dossier
              </h2>
              <p className="text-xs text-[#78716C]">
                Please review your responses before final submission. You can click Edit to change any section.
              </p>
            </div>

            {/* Summary Sections */}
            <div className="space-y-4 text-xs">
              
              {/* SECTION 1: Your Year */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> 1. Your Year
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(1)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[#1C1917]">
                  <div>
                    <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Current City</span>
                    <span className="font-medium">{city || <span className="text-red-500">Missing</span>}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Residential Address</span>
                    <span className="font-medium">{residentialAddress || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Professional Life</span>
                    <span className="font-medium">
                      {occupationStatus}
                      {occupationDetails ? ` — ${occupationDetails}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Organization / Business</span>
                    <span className="font-medium">{organizationUpdate || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Family */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> 2. Family Updates
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(2)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="pt-1 text-[#1C1917]">
                  <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Status</span>
                  <span className="font-medium">{familyStatus}</span>
                  {familyDetails && (
                    <p className="mt-1 text-xs text-[#57534E] italic bg-white p-2.5 rounded-lg border border-[#EFEAE1]">
                      &ldquo;{familyDetails}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION 3: Wishlist */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5" /> 3. Wishlist ({wishlist.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(3)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="pt-1">
                  {wishlist.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {wishlist.map((w) => (
                        <span
                          key={w}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#EFEAE1] text-[11px] font-medium text-[#1C1917]"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-red-500 font-medium">No wishlist option selected (at least 1 required)</span>
                  )}
                  {dreamExperience && (
                    <p className="mt-2 text-xs text-[#57534E] italic bg-white p-2.5 rounded-lg border border-[#EFEAE1]">
                      Dream Experience: &ldquo;{dreamExperience}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION 4: Contribution */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5" /> 4. Contribution Areas ({contributionAreas.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(4)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="pt-1">
                  {contributionAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {contributionAreas.map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#EFEAE1] text-[11px] font-medium text-[#1C1917]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-red-500 font-medium">No contribution area selected (at least 1 required)</span>
                  )}
                  {contributionHelpText && (
                    <p className="mt-2 text-xs text-[#57534E] italic bg-white p-2.5 rounded-lg border border-[#EFEAE1]">
                      Help details: &ldquo;{contributionHelpText}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION 5: Royal Idea */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> 5. Royal Idea &amp; Identity
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(5)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="space-y-1.5 pt-1 text-[#1C1917]">
                  {royalIdea && (
                    <div>
                      <span className="text-[#78716C] block text-[10px] uppercase font-semibold">New Idea for 2027</span>
                      <p className="font-medium italic bg-white p-2.5 rounded-lg border border-[#EFEAE1]">
                        &ldquo;{royalIdea}&rdquo;
                      </p>
                    </div>
                  )}
                  {identityKnownFor.length > 0 && (
                    <div>
                      <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Known For</span>
                      <span className="font-medium">{identityKnownFor.join(', ')}</span>
                    </div>
                  )}
                  {identityStatement && (
                    <div>
                      <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Should Stand For</span>
                      <span className="font-medium italic">&ldquo;{identityStatement}&rdquo;</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 6: Year-2 Royal Photograph */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE1] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[#8C6D2B] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> 6. Year-2 Royal Photograph
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(6)}
                    className="text-[#8C6D2B] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </div>
                <div className="pt-1">
                  {photoData ? (
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-[#EFEAE1]">
                      <img
                        src={`/api/member/photo/${photoData.id}?token=${token}`}
                        alt="Thumbnail"
                        className="w-16 h-16 object-cover rounded-lg border border-[#DFCFAE]"
                      />
                      <div className="text-[#1C1917] space-y-0.5">
                        <span className="font-semibold block truncate max-w-[200px]">{photoData.filename}</span>
                        <span className="text-[11px] text-[#78716C] block">
                          {(photoData.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {photoData.mimeType}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                          Ready for Submission
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#78716C] italic">No photo attached (Optional, can be added in Step 6)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Submission Lock Notice */}
            <div className="bg-[#FAF7F2] border border-[#E9DFCE] rounded-2xl p-4 text-xs text-[#57534E] flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#8C6D2B] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#1C1917] block">
                  Final Submission Lock
                </span>
                <span className="text-[11px] text-[#78716C]">
                  Once submitted, your responses cannot be changed. The record will be permanently bound to Couple ID <strong className="font-mono text-[#1C1917]">{member.couple_id}</strong>.
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitForm}
                disabled={submitting}
                className="w-full py-4 px-6 rounded-2xl bg-[#1C1917] hover:bg-[#2A2623] active:scale-[0.99] text-[#FAF7F2] font-semibold text-xs tracking-widest uppercase transition-all shadow-md border border-[#C5A869]/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span>Recording Final Submission...</span>
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-[#D4AF37]" />
                    <span>Submit Year-2 Update</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEPPER CONTROLS (Next / Back buttons) */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between pt-6 border-t border-[#F0E8DC] mt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="py-2.5 px-4 rounded-xl bg-[#FAF8F5] hover:bg-[#EFEAE1] text-[#1C1917] font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 border border-[#E0D5C3]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackToProfile}
              className="py-2.5 px-4 rounded-xl bg-transparent hover:bg-[#FAF8F5] text-[#78716C] font-semibold text-xs tracking-wider uppercase transition-all"
            >
              Back to Profile
            </button>
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="py-2.5 px-6 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 5. START OVER CONFIRMATION MODAL */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-[#FFFFFF] border-2 border-[#DFCFAE] rounded-3xl max-w-md w-full p-6 shadow-xl space-y-4 animate-scaleUp">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-royal font-bold text-lg text-[#1C1917]">
                Start over from beginning?
              </h3>
              <p className="text-xs text-[#78716C] mt-1 leading-relaxed">
                This will clear all your currently entered Year-2 draft answers and reset the form to Step 1. Your permanent Year-1 club records will not be affected.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                disabled={isResetting}
                className="py-2 px-4 rounded-xl bg-transparent hover:bg-[#FAF8F5] text-[#57534E] text-xs font-semibold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold uppercase tracking-wider shadow-xs"
              >
                {isResetting ? 'Clearing...' : 'Yes, Start Over'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
