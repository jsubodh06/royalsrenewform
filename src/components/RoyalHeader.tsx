import React from 'react';
import { Crown, LogOut, Shield } from 'lucide-react';
import { MemberSession } from '../lib/types.ts';

interface RoyalHeaderProps {
  memberSession: MemberSession | null;
  isAdmin: boolean;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onBackToPortal?: () => void;
  activeView: string;
}

export const RoyalHeader: React.FC<RoyalHeaderProps> = ({
  memberSession,
  isAdmin,
  onLogout,
  onOpenAdmin,
  onBackToPortal,
  activeView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E2D5BE] shadow-xs">
      <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
        {/* Brand Crest */}
        <div 
          onClick={onBackToPortal}
          className="flex items-center gap-3.5 cursor-pointer group select-none"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1C1917] via-[#2A2623] to-[#141210] text-[#D4AF37] flex items-center justify-center border border-[#C5A869]/60 shadow-md transition-all group-hover:scale-105 group-hover:border-[#D4AF37]">
            <Crown className="w-5 h-5 text-[#D4AF37] animate-pulse-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-royal font-bold text-lg sm:text-xl tracking-wider text-[#1C1917]">
                JSG ROYALS
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md bg-[#1C1917] text-[#D4AF37] border border-[#C5A869]/40 shadow-2xs">
                Year 2 • 2027
              </span>
            </div>
            <p className="text-[11px] text-[#8C6D2B] font-medium tracking-wide flex items-center gap-1.5">
              <span>✦</span>
              <span>One Royal Family</span>
              <span>✦</span>
              <span className="text-[#A8A29E]">Master Directory</span>
            </p>
          </div>
        </div>

        {/* Right Action / Profile */}
        <div className="flex items-center gap-3">
          {memberSession && activeView !== 'admin' && (
            <div className="flex items-center gap-2 bg-[#F1E9DA] border border-[#DFD1BD] px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#1C1917]">
              <span className="font-serif font-bold text-[#8C6D2B]">
                {memberSession.coupleId}
              </span>
              <span className="hidden sm:inline text-[#A8A29E]">/</span>
              <span className="hidden sm:inline font-medium text-[#44403C]">
                {memberSession.spouseType === 'husband'
                  ? (memberSession.husbandName?.trim() ? memberSession.husbandName.split(' ')[0] : 'Husband')
                  : (memberSession.wifeName?.trim() ? memberSession.wifeName.split(' ')[0] : 'Wife')}
              </span>
              <button
                onClick={onLogout}
                title="Sign out"
                className="ml-1 p-1 hover:text-red-700 transition-colors text-[#78716C] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeView === 'admin' && (
            <button
              onClick={onBackToPortal}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] border border-[#C5A869]/40 transition-all cursor-pointer shadow-xs"
            >
              ← Return to Royal Portal
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
