import React from 'react';
import { Crown, ShieldCheck, ArrowRight, Sparkles, HeartHandshake, Lock } from 'lucide-react';

interface LandingScreenProps {
  onBegin: () => void;
  onOpenAdmin: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onBegin, onOpenAdmin }) => {
  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col justify-between py-8 px-4 sm:px-6">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center items-center text-center">
        
        {/* Royal Crest Emblem */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-[#1C1917] border-2 border-[#C5A869] shadow-xl flex items-center justify-center p-3 relative z-10">
            <Crown className="w-12 h-12 text-[#D4AF37]" />
          </div>
          <div className="absolute -inset-2 rounded-full border border-[#D4AF37]/30 animate-pulse pointer-events-none"></div>
        </div>

        {/* Brand Typography */}
        <div className="space-y-2 mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-[#EFE6D5] border border-[#DFCFAE] text-[#8C6D2B] text-xs font-semibold tracking-widest uppercase">
            Year 2 • 2027
          </div>
          <h1 className="font-serif-royal text-3xl sm:text-4xl font-extrabold tracking-wide text-[#1C1917]">
            JSG ROYALS
          </h1>
          <p className="font-serif italic text-lg sm:text-xl text-[#78716C] font-normal">
            New Year. New Memories. One Royal Family.
          </p>
        </div>

        {/* Welcome Card */}
        <div className="w-full bg-[#FFFFFF]/80 backdrop-blur-xs border border-[#E7DDCE] rounded-3xl p-6 sm:p-7 shadow-sm text-left mb-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8C6D2B] uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-[#C5A869]" />
            Private Member Portal
          </div>
          <p className="text-sm text-[#44403C] leading-relaxed">
            Welcome to the official Year-2 portal for our 110 esteemed Royal couples.
            Please verify your registered mobile number to review your Year-1 profile and complete your Year-2 membership details.
          </p>

          <div className="border-t border-[#F0E8DC] pt-3 grid grid-cols-2 gap-3 text-xs text-[#57534E]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#8C6D2B] shrink-0" />
              <span>Registered Mobile OTP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#8C6D2B] shrink-0" />
              <span>Single Couple Session</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-[#8C6D2B] shrink-0" />
              <span>Husband or Wife Login</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-[#8C6D2B] shrink-0" />
              <span>110 Permanent Royals</span>
            </div>
          </div>
        </div>

        {/* Primary CTA Button */}
        <button
          onClick={onBegin}
          className="w-full py-4 px-6 rounded-2xl bg-[#1C1917] hover:bg-[#2A2623] active:scale-[0.99] text-[#FAF7F2] font-semibold text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 border border-[#C5A869]/30 group"
        >
          <span>Begin Year 2</span>
          <ArrowRight className="w-5 h-5 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="text-[12px] text-[#A8A29E] mt-3">
          Only verified numbers registered in Year 1 can proceed.
        </p>
      </div>

      {/* Footer info */}
      <footer className="text-center text-xs text-[#A8A29E] pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <span>JSG Royals • 2027 Executive Committee</span>
        <span className="hidden sm:inline">•</span>
        <button
          onClick={onOpenAdmin}
          className="text-[#78716C] hover:text-[#1C1917] underline decoration-[#D4AF37]/50"
        >
          Committee Administration
        </button>
      </footer>
    </div>
  );
};
