import React from 'react';
import { X, ShieldCheck, Lock, EyeOff, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-[#F0E8DC] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F5EFE6] text-[#8C6D2B] flex items-center justify-center border border-[#E2D5BE]">
              <ShieldCheck className="w-5 h-5 text-[#8C6D2B]" />
            </div>
            <div>
              <h2 className="font-serif-royal text-xl font-bold text-[#1C1917]">
                Privacy & Data Security Policy
              </h2>
              <p className="text-xs text-[#78716C]">
                JSG Royals Year 2 • 2027 Official Member Policy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#78716C] hover:text-[#1C1917] hover:bg-[#EFE6D5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#44403C] leading-relaxed">
          {/* Section 1: Data Isolation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <Lock className="w-4 h-4 text-[#8C6D2B]" />
              <span>1. Strict Couple Data Isolation</span>
            </div>
            <p className="text-xs text-[#57534E] pl-6 leading-relaxed">
              Every couple in JSG Royals is assigned a permanent identifier (JR001 through JR110).
              Data isolation is enforced at both the database and application levels. An authenticated member
              can only view and submit data for their own Couple ID. Cross-couple data access or parameter manipulation is strictly prevented.
            </p>
          </div>

          {/* Section 2: Aadhaar & Government ID Exclusion */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <EyeOff className="w-4 h-4 text-[#8C6D2B]" />
              <span>2. Zero Sensitive Government ID Storage</span>
            </div>
            <p className="text-xs text-[#57534E] pl-6 leading-relaxed">
              In accordance with privacy standards, this platform does <strong>NOT</strong> collect, import, or store
              Aadhaar numbers or document links. Authentication relies exclusively on the registered husband and wife mobile numbers
              recorded in the official Year-1 ledger.
            </p>
          </div>

          {/* Section 3: Private Photo Storage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <ShieldCheck className="w-4 h-4 text-[#8C6D2B]" />
              <span>3. Private Membership Photo Storage</span>
            </div>
            <p className="text-xs text-[#57534E] pl-6 leading-relaxed">
              Year-2 family/couple photographs are stored in private cloud storage. They are never published to open public URLs
              or indexable web pages. Photos are validated for genuine file headers (magic bytes) up to a 10 MB limit and can only
              be accessed through secure, authenticated member or committee administrator tokens.
            </p>
          </div>

          {/* Section 4: Mobile Verification & OTP Security */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <CheckCircle2 className="w-4 h-4 text-[#8C6D2B]" />
              <span>4. Mobile Verification & OTP Security</span>
            </div>
            <p className="text-xs text-[#57534E] pl-6 leading-relaxed">
              OTP codes are never stored in plain text. All verification tokens use cryptographic hashing (SHA-256 with unique salting),
              rate limiting (maximum 5 requests per 15 minutes), and a strict 30-second cooldown between requests to protect members
              from spam and unauthorized access attempts.
            </p>
          </div>

          {/* Section 5: Member Rights & Corrections */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <FileText className="w-4 h-4 text-[#8C6D2B]" />
              <span>5. Correction Request Rights</span>
            </div>
            <p className="text-xs text-[#57534E] pl-6 leading-relaxed">
              To preserve identity integrity, Year-1 master fields (names, mobile numbers, dates of birth, marriage anniversary)
              are read-only for members. If an error is noticed, members have the right to submit a formal Correction Request
              directly in the portal for committee administrator review and resolution.
            </p>
          </div>

          {/* Notice Box */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs text-[#78716C]">
            <p className="font-semibold text-[#1C1917] mb-1">
              JSG Royals Executive Committee Notice
            </p>
            <p>
              This portal is maintained exclusively for active JSG Royals member families. For any questions regarding your membership records,
              please reach out to the Executive Committee administration.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#F0E8DC] bg-[#FAF7F2] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Understood & Close
          </button>
        </div>
      </div>
    </div>
  );
};
