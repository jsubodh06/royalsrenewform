import React from 'react';
import { LogOut } from 'lucide-react';
import { MemberSession } from '../lib/types.ts';
import { RoyalLogo } from './RoyalLogo.tsx';

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
    <header className="sticky top-0 z-40 bg-[#FAF6EE]/95 backdrop-blur-md border-b border-[#DFD1B4] shadow-[0_1px_12px_rgba(28,25,23,0.04)]">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand Crest */}
        <button
          type="button"
          onClick={onBackToPortal}
          className="flex items-center gap-2.5 sm:gap-3.5 cursor-pointer group select-none min-w-0 text-left rounded-xl"
        >
          <RoyalLogo className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-[#C5A869]/80 shadow-sm p-0.5 shrink-0 transition-all duration-200 group-hover:scale-[1.03] group-hover:border-[#D4AF37]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap sm:flex-nowrap">
              <span className="font-serif-royal font-bold text-sm sm:text-lg tracking-[0.07em] sm:tracking-[0.08em] text-[#1C1917] whitespace-nowrap shrink-0">
                JSG ROYALS
              </span>
              <span aria-hidden="true" className="hidden sm:inline-block h-3.5 w-px bg-[#C5A869]/60" />
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.16em] font-semibold text-[#8C6D2B] whitespace-nowrap shrink-0">
                Chapter 2 · 2027
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#78716C] font-medium tracking-wide flex items-center gap-1 sm:gap-1.5 mt-0.5 min-w-0">
              <span className="text-[#C5A869] shrink-0">✦</span>
              <span className="text-[#8C6D2B] truncate">One Royal Family</span>
              <span aria-hidden="true" className="text-[#C5A869] shrink-0">·</span>
              <span className="truncate">Master Directory</span>
            </p>
          </div>
        </button>

        {/* Right Action / Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {memberSession && activeView !== 'admin' && (
            <div className="flex items-center gap-2 sm:gap-2.5 bg-[#F3EBDC] border border-[#DECFAF] px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-[#1C1917] whitespace-nowrap shrink-0">
              <span className="font-serif-royal font-bold text-[#8C6D2B] tracking-wide">
                {memberSession.coupleId}
              </span>
              <span className="hidden sm:inline text-[#C5A869]">·</span>
              <span className="hidden sm:inline font-medium text-[#44403C]">
                {memberSession.spouseType === 'husband'
                  ? (memberSession.husbandName?.trim() ? memberSession.husbandName.split(' ')[0] : 'Husband')
                  : (memberSession.wifeName?.trim() ? memberSession.wifeName.split(' ')[0] : 'Wife')}
              </span>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="ml-0.5 p-1.5 rounded-md hover:bg-red-50 hover:text-red-700 transition-colors text-[#78716C] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeView === 'admin' && (
            <button
              type="button"
              onClick={onBackToPortal}
              className="text-[11px] sm:text-xs font-semibold px-3 sm:px-4 py-2 min-h-[40px] rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] border border-[#C5A869]/50 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              ← Return to Royal Portal
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
