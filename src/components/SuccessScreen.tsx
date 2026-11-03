import React, { useState } from 'react';
import { Crown, CheckCircle2, Lock, Eye, Calendar, MapPin, Heart, Sparkles } from 'lucide-react';
import { MemberYear1, Year2ProfileData, Year2PreferenceData, SubmissionData } from '../lib/types.ts';

interface SuccessScreenProps {
  member: MemberYear1;
  profile: Year2ProfileData | null;
  preferences: Year2PreferenceData | null;
  submission: SubmissionData | null;
  token: string;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  member,
  profile,
  preferences,
  submission,
  token,
}) => {
  const [showSummary, setShowSummary] = useState(false);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-300">
      <div className="bg-[#FFFFFF] border-2 border-[#C5A869]/40 rounded-3xl p-6 sm:p-10 shadow-lg text-center relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#FAF4E6] pointer-events-none -z-0"></div>

        {/* Crest */}
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-full bg-[#1C1917] border-2 border-[#D4AF37] flex items-center justify-center mx-auto shadow-md mb-6">
            <Crown className="w-10 h-10 text-[#D4AF37]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-4">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Submission Recorded in Official Database</span>
          </div>

          <h1 className="font-serif-royal text-3xl sm:text-4xl font-extrabold text-[#1C1917] mb-2 tracking-wide">
            You&apos;re all set! 👑
          </h1>

          <p className="font-serif italic text-base sm:text-lg text-[#78716C] mb-6">
            Your Year-2 details have been successfully submitted.
          </p>

          <div className="bg-[#FAF7F2] border border-[#E7DDCE] rounded-2xl p-4 mb-6 max-w-sm mx-auto text-xs text-[#57534E] space-y-1">
            <div className="font-serif-royal font-bold text-sm text-[#1C1917]">
              JSG Royals — Year 2 • 2027
            </div>
            <div className="text-[#8C6D2B] font-semibold">
              One Royal Family.
            </div>
            {submission && (
              <div className="text-[11px] text-[#A8A29E] pt-1">
                Recorded on: {new Date(submission.submitted_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </div>

          {/* Submission locked notice */}
          <div className="bg-[#FAF4E6] border border-[#DFCFAE] rounded-2xl p-3.5 mb-6 text-xs text-[#8C6D2B] flex items-center justify-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Your Year-2 membership update has already been submitted for Couple ID <strong>{member.couple_id}</strong>.
            </span>
          </div>

          {/* View Submitted Summary Button */}
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1C1917] hover:text-[#8C6D2B] underline decoration-[#D4AF37] transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>{showSummary ? 'Hide Submitted Details' : 'View Your Submitted Year-2 Details'}</span>
          </button>

          {/* Expanded Summary */}
          {showSummary && (
            <div className="mt-6 pt-6 border-t border-[#F0E8DC] text-left text-xs space-y-4 animate-in fade-in">
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E9DFCE] space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#EBE1D0]">
                  <span className="font-bold text-[#8C6D2B] uppercase tracking-wider text-[11px]">
                    Couple Identification
                  </span>
                  <span className="font-serif font-bold text-sm text-[#1C1917]">
                    {member.couple_id}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#78716C] block text-[11px]">Husband</span>
                    <span className="font-semibold text-[#1C1917]">{member.husband_name}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[11px]">Wife</span>
                    <span className="font-semibold text-[#1C1917]">{member.wife_name}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[11px]">Updated City</span>
                    <span className="font-semibold text-[#1C1917]">{profile?.city || member.year1_city}</span>
                  </div>
                  <div>
                    <span className="text-[#78716C] block text-[11px]">Anniversary</span>
                    <span className="font-semibold text-[#1C1917]">{member.marriage_anniversary}</span>
                  </div>
                </div>

                {profile?.photo_id && (
                  <div className="pt-2 border-t border-[#EBE1D0]">
                    <span className="text-[#78716C] block text-[11px] mb-2">Uploaded Family Photo</span>
                    <img
                      src={`/api/member/photo/${profile.photo_id}?token=${token}`}
                      alt="Submitted Family"
                      className="w-32 h-32 object-cover rounded-xl border border-[#DFCFAE] shadow-xs"
                    />
                  </div>
                )}

                {preferences?.wishlist && preferences.wishlist.length > 0 && (
                  <div className="pt-2 border-t border-[#EBE1D0]">
                    <span className="text-[#78716C] block text-[11px] mb-1.5">Selected Wishlist Interests</span>
                    <div className="flex flex-wrap gap-1.5">
                      {preferences.wishlist.map((item) => (
                        <span key={item} className="px-2 py-0.5 rounded-full bg-[#EFE6D5] text-[#8C6D2B] text-[10px] font-medium">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {preferences?.royal_idea && (
                  <div className="pt-2 border-t border-[#EBE1D0]">
                    <span className="text-[#78716C] block text-[11px] mb-1">Your Royal Idea</span>
                    <p className="italic text-[#44403C] bg-white p-2.5 rounded-lg border border-[#EDE3D3]">
                      &ldquo;{preferences.royal_idea}&rdquo;
                    </p>
                  </div>
                )}

                {profile?.photo_id && (
                  <div className="pt-2 border-t border-[#EBE1D0]">
                    <span className="text-[#78716C] block text-[11px] mb-1">Year-2 Royal Photograph</span>
                    <img
                      src={`/api/member/photo/${profile.photo_id}?token=${token}`}
                      alt="Year-2 Photograph"
                      className="max-h-48 w-auto rounded-lg border border-[#DFCFAE] shadow-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
