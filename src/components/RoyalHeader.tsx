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
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E9DFCE] shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Crest */}
        <div 
          onClick={onBackToPortal}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full bg-[#1C1917] text-[#D4AF37] flex items-center justify-center border border-[#C5A869]/40 shadow-sm transition-transform group-hover:scale-105">
            <Crown className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-royal font-bold text-lg tracking-wider text-[#1C1917]">
                JSG ROYALS
              </span>
              <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-[#EFE6D5] text-[#8C6D2B] border border-[#DFCFAE]">
                Year 2 • 2027
              </span>
            </div>
            <p className="text-[11px] text-[#78716C] font-medium tracking-tight">
              One Royal Family
            </p>
          </div>
        </div>

        {/* Right Action / Profile */}
        <div className="flex items-center gap-2">
          {memberSession && activeView !== 'admin' && (
            <div className="flex items-center gap-2 bg-[#F1E9DA] border border-[#DFD1BD] px-3 py-1.5 rounded-full text-xs font-medium text-[#1C1917]">
              <span className="font-serif font-bold text-[#8C6D2B]">
                {memberSession.coupleId}
              </span>
              <span className="hidden sm:inline text-[#57534E]">|</span>
              <span className="hidden sm:inline font-medium text-[#44403C]">
                {memberSession.spouseType === 'husband'
                  ? (memberSession.husbandName?.trim() ? memberSession.husbandName.split(' ')[0] : 'Husband')
                  : (memberSession.wifeName?.trim() ? memberSession.wifeName.split(' ')[0] : 'Wife')}
              </span>
              <button
                onClick={onLogout}
                title="Sign out"
                className="ml-1 p-1 hover:text-red-700 transition-colors text-[#78716C]"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeView !== 'admin' ? (
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-[#D9CDB8] text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFE6D5] transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-[#8C6D2B]" />
              <span className="hidden xs:inline">Admin</span>
            </button>
          ) : (
            <button
              onClick={onBackToPortal}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1C1917] text-[#FAF7F2] hover:bg-[#292524] transition-all"
            >
              ← Member Portal
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
