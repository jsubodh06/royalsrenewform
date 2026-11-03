import React, { useState } from 'react';
import {
  Crown,
  Lock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Phone,
  Calendar,
  Users,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { MemberYear1, MemberSession, CorrectionRequest } from '../lib/types.ts';
import { CorrectionModal } from './CorrectionModal.tsx';
import { apiRequest } from '../lib/api.ts';

interface Year1ProfileCardProps {
  member: MemberYear1 & { parsedData?: any };
  session: MemberSession;
  token: string;
  corrections: CorrectionRequest[];
  hasDraft?: boolean;
  onConfirmYear1: () => void;
  onGoToYear2?: () => void;
  onRefresh: () => void;
}

export const Year1ProfileCard: React.FC<Year1ProfileCardProps> = ({
  member,
  session,
  token,
  corrections,
  hasDraft = false,
  onConfirmYear1,
  onGoToYear2,
  onRefresh,
}) => {
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  // Handle "YES, EVERYTHING IS CORRECT"
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await apiRequest('/member/confirm-year1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfirmedSuccess(true);
      setTimeout(() => {
        onConfirmYear1();
      }, 1200);
    } catch (err) {
      alert('Failed to record confirmation. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const parsedInfo = member.parsedData || {};

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      
      {/* 1. Header Greeting */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-xs font-semibold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Authenticated Member Profile</span>
        </div>
        <h1 className="font-serif-royal text-2xl sm:text-3xl font-extrabold text-[#1C1917] pt-1">
          Welcome back, Royals 👑
        </h1>
        <p className="font-serif italic text-base sm:text-lg text-[#78716C]">
          Here&apos;s what we have from Year 1.
        </p>
      </div>

      {/* 2. Read-Only Protected Fields Notice */}
      <div className="bg-[#FAF7F2] border border-[#EBE1D0] rounded-2xl p-4 text-xs text-[#57534E] flex items-start gap-3">
        <Lock className="w-4 h-4 text-[#8C6D2B] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-[#1C1917] block">
            Protected Identity Records (Read-Only)
          </span>
          <span className="text-[11px] text-[#78716C]">
            Year-1 identity fields are strictly read-only to preserve permanent club records. If any detail needs to be updated, use the correction request option below.
          </span>
        </div>
      </div>

      {/* 3. Main Profile Dossier Card */}
      <div className="bg-[#FFFFFF] border-2 border-[#E9DFCE] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* SECTION A: Couple */}
        <div className="space-y-3 pb-5 border-b border-[#F0E8DC]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B]">
              Couple
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#1C1917] text-[#D4AF37] font-mono font-bold text-xs">
              {member.couple_id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Husband Name</span>
              <span className="text-sm font-bold text-[#1C1917]">{member.husband_name}</span>
            </div>
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Wife Name</span>
              <span className="text-sm font-bold text-[#1C1917]">{member.wife_name}</span>
            </div>
          </div>

          <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1] text-xs">
            <div className="flex items-center gap-1.5 text-[#78716C] mb-0.5">
              <Calendar className="w-3.5 h-3.5 text-[#8C6D2B]" />
              <span className="text-[10px] uppercase font-semibold">Marriage Anniversary</span>
            </div>
            <span className="text-sm font-bold text-[#1C1917]">{member.marriage_anniversary || 'Not recorded'}</span>
          </div>
        </div>

        {/* SECTION B: Contact */}
        <div className="space-y-3 pb-5 border-b border-[#F0E8DC]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
            Contact
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <div className="flex items-center gap-1.5 text-[#78716C] mb-0.5">
                <Phone className="w-3.5 h-3.5 text-[#8C6D2B]" />
                <span className="text-[10px] uppercase font-semibold">Husband Registered Mobile</span>
              </div>
              <span className="font-mono font-bold text-[#1C1917]">+91 {member.husband_registered_mobile}</span>
            </div>
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <div className="flex items-center gap-1.5 text-[#78716C] mb-0.5">
                <Phone className="w-3.5 h-3.5 text-[#8C6D2B]" />
                <span className="text-[10px] uppercase font-semibold">Wife Registered Mobile</span>
              </div>
              <span className="font-mono font-bold text-[#1C1917]">
                {member.wife_registered_mobile ? `+91 ${member.wife_registered_mobile}` : 'Not provided'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION C: Personal */}
        <div className="space-y-3 pb-5 border-b border-[#F0E8DC]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
            Personal
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Husband Date of Birth</span>
              <span className="font-semibold text-[#1C1917]">{member.husband_dob || 'Recorded in Registry'}</span>
            </div>
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Wife Date of Birth</span>
              <span className="font-semibold text-[#1C1917]">{member.wife_dob || 'Recorded in Registry'}</span>
            </div>
          </div>
        </div>

        {/* SECTION D: Family */}
        <div className="space-y-3 pb-5 border-b border-[#F0E8DC]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
            Family
          </span>
          <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#EFEAE1] text-xs">
            <div className="flex items-center gap-1.5 text-[#78716C] mb-1">
              <Users className="w-3.5 h-3.5 text-[#8C6D2B]" />
              <span className="text-[10px] uppercase font-semibold">Children Information from Year 1</span>
            </div>
            <p className="font-semibold text-[#1C1917]">
              {member.children_info || parsedInfo.children || 'Recorded in Registry'}
            </p>
          </div>
        </div>

        {/* SECTION E: Year-1 Information */}
        <div className="space-y-3 pb-5 border-b border-[#F0E8DC]">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
            Year-1 Information
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">City</span>
              <span className="font-semibold text-[#1C1917]">{parsedInfo.city || member.year1_city || 'Indore'}</span>
            </div>
            <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#EFEAE1]">
              <span className="text-[#78716C] block text-[10px] uppercase font-semibold">Business / Occupation</span>
              <span className="font-semibold text-[#1C1917]">{parsedInfo.business || member.year1_business || 'Recorded in Ledger'}</span>
            </div>
          </div>
        </div>

        {/* SECTION F: Existing Correction Requests Status */}
        {corrections.length > 0 && (
          <div className="space-y-2.5 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8C6D2B] block">
              Your Correction Requests
            </span>
            <div className="space-y-2">
              {corrections.map((cr) => (
                <div
                  key={cr.id}
                  className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E7DDCE] text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-[#1C1917] block">{cr.requested_correction}</span>
                    <span className="text-[#78716C] text-[11px] italic">&ldquo;{cr.member_message}&rdquo;</span>
                    {cr.admin_notes && (
                      <span className="block text-[10px] text-[#8C6D2B] mt-0.5">Admin Note: {cr.admin_notes}</span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      cr.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}
                  >
                    {cr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION G: CONFIRMATION PROMPT */}
        <div className="pt-2 text-center space-y-3">
          <p className="font-serif font-bold text-base text-[#1C1917]">
            Is everything correct?
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] active:scale-[0.99] text-[#FAF7F2] font-semibold text-xs tracking-wider uppercase transition-all shadow-sm border border-[#C5A869]/30 flex items-center justify-center gap-2"
            >
              {confirming ? (
                <span>Confirming...</span>
              ) : confirmedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Confirmed!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>YES, EVERYTHING IS CORRECT</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCorrectionModal(true)}
              className="w-full sm:flex-1 py-3.5 px-4 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF7F2] text-[#8C6D2B] font-semibold text-xs tracking-wider uppercase border border-[#D9CDB8] transition-all flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-4 h-4 text-[#8C6D2B]" />
              <span>SOMETHING NEEDS TO BE CORRECTED</span>
            </button>
          </div>

          {(confirmedSuccess || hasDraft || onGoToYear2) && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onGoToYear2 || onConfirmYear1}
                className="w-full py-3 px-4 rounded-xl bg-[#FAF7F2] hover:bg-[#EFE6D5] text-[#8C6D2B] font-semibold text-xs tracking-wider uppercase transition-all border border-[#DFCFAE] flex items-center justify-center gap-2"
              >
                <span>Proceed to Year-2 Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Correction Request Modal */}
      {showCorrectionModal && (
        <CorrectionModal
          coupleId={member.couple_id}
          token={token}
          onClose={() => setShowCorrectionModal(false)}
          onSuccess={() => {
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
