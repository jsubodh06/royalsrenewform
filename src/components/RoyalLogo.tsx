import React from 'react';

export const ROYALS_LOGO_SRC = '/assets/aistudio/file_00000000679071f5a5e7d2bf243a4828__1__fe221d87.png';

interface RoyalLogoProps {
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export const RoyalLogo: React.FC<RoyalLogoProps> = ({
  className = 'w-11 h-11 rounded-2xl',
  imgClassName = 'w-full h-full object-contain',
  alt = 'The Royals — JSG Royals Logo',
}) => {
  return (
    <div
      className={`bg-[#122619] border border-[#C5A869]/70 overflow-hidden flex items-center justify-center shrink-0 select-none ${className}`}
    >
      <img
        src={ROYALS_LOGO_SRC}
        alt={alt}
        className={imgClassName}
        draggable={false}
      />
    </div>
  );
};
