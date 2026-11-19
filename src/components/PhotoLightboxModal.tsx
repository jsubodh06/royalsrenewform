import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ExternalLink, Image as ImageIcon, AlertCircle, Copy, Check } from 'lucide-react';
import {
  getDisplayImageSrc,
  isExternalCloudUrl,
  resolveFullMediaUrl,
  downloadMediaImage
} from '../lib/media.ts';
import { isAuthorizedFirebaseAdmin, resolvePhotoFromFirestore } from '../lib/firestoreStore.ts';

export interface PreviewPhotoState {
  title: string;
  url: string;
  downloadName?: string;
}

interface PhotoLightboxModalProps {
  photo: PreviewPhotoState | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ photo, onClose }) => {
  const [imgError, setImgError] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgError(false);
    setFallbackSrc(null);
  }, [photo?.url]);

  useEffect(() => {
    if (!photo) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus({ preventScroll: true });
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [photo, onClose]);

  if (!photo) return null;

  const displaySrc = fallbackSrc || getDisplayImageSrc(photo.url) || photo.url;
  const fullUrl = resolveFullMediaUrl(photo.url);
  const isExternal = isExternalCloudUrl(photo.url);
  const firebaseReady = isAuthorizedFirebaseAdmin();

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={photo.title}
        tabIndex={-1}
        data-focus-target="true"
        className="bg-[#FFFFFF] border-2 border-[#D4AF37] rounded-2xl sm:rounded-3xl max-w-3xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl outline-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-[#E7DDCE] bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-[#122619] text-[#D4AF37] flex items-center justify-center border border-[#C5A869]/60 shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif-royal font-bold text-sm text-[#1C1917] truncate">
                {photo.title}
              </h3>
              <p className="text-[10px] font-mono text-[#78716C] truncate" title={fullUrl}>
                {fullUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="inline-flex items-center justify-center gap-1 min-h-[38px] px-2.5 py-2 rounded-xl bg-white hover:bg-[#FAF7F2] text-[#1C1917] border border-[#D9CDB8] text-xs font-semibold transition-colors cursor-pointer"
              title="Copy public photo URL"
              aria-label="Copy public photo URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#8C6D2B]" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy Link'}</span>
            </button>

            {!isExternal && (
              <button
                type="button"
                onClick={() => downloadMediaImage(fallbackSrc || photo.url, photo.downloadName || 'royal-photo.jpg')}
                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#D4AF37] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}

            {isExternal && (
              <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Link</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-w-[38px] min-h-[38px] inline-flex items-center justify-center p-2 rounded-xl bg-white hover:bg-rose-50 text-[#78716C] hover:text-rose-700 border border-[#E7DDCE] transition-colors cursor-pointer"
              title="Close"
              aria-label="Close photo preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#121212] flex items-center justify-center p-4 min-h-[280px]">
          {!imgError ? (
            <img
              src={displaySrc}
              alt={photo.title}
              onError={async () => {
                if (!fallbackSrc) {
                  const cloudSrc = await resolvePhotoFromFirestore(photo.url).catch(() => null);
                  if (cloudSrc) {
                    setFallbackSrc(cloudSrc);
                    return;
                  }
                }
                setImgError(true);
              }}
              className="max-w-full max-h-[70dvh] object-contain rounded-xl shadow-lg"
            />
          ) : (
            <div className="text-center text-white/85 space-y-3 p-6 max-w-md">
              <AlertCircle className="w-10 h-10 text-[#D4AF37] mx-auto" />
              <p className="text-sm font-semibold">
                {isExternal
                  ? 'Inline preview unavailable for this external link.'
                  : !firebaseReady
                  ? 'Photo is not stored on this temporary server container.'
                  : 'Image file not found on server or Cloud Archive.'}
              </p>
              <p className="text-xs text-white/65 leading-relaxed">
                {isExternal
                  ? 'If this is a Google Drive link, make sure sharing is set to "Anyone with the link can view", or open it directly using the button above.'
                  : !firebaseReady
                  ? 'Connect Google Cloud Archive on the Admin dashboard to load archived member photos from Firestore.'
                  : 'This photo URL may reference a temporary file from an older deployment that was never backed up to Cloud Firestore.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
