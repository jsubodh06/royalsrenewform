import { resolvePhotoFromFirestore } from './firestoreStore.ts';

export function isUploadedServerPhoto(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('/api/family/photo/');
}

export function isDriveUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com') || url.includes('photos.google.com');
}

export function isExternalCloudUrl(url?: string | null): boolean {
  if (!url) return false;
  return !url.startsWith('data:') && !isUploadedServerPhoto(url);
}

export function extractDriveFileId(url?: string | null): string | null {
  if (!url) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) return fileMatch[1];
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch && openMatch[1]) return openMatch[1];
  const ucMatch = url.match(/\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (ucMatch && ucMatch[1]) return ucMatch[1];
  return null;
}

export function extractFamilyPhotoRelativePath(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  const marker = '/api/family/photo/';
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  const rawFilename = trimmed.slice(idx + marker.length).split('?')[0].split('#')[0].trim();
  if (!rawFilename) return null;
  return `${marker}${rawFilename}`;
}

export function getDisplayImageSrc(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const relPhotoPath = extractFamilyPhotoRelativePath(trimmed);
  if (relPhotoPath) return relPhotoPath;
  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return trimmed;
}

const PUBLIC_APP_URL_FALLBACK =
  'https://ais-pre-t5c2x6fk3je4yhythikayj-923279058412.asia-southeast1.run.app';

function getPublicMediaOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/+$/, '');
    if (
      !origin.includes('localhost') &&
      !origin.includes('127.0.0.1') &&
      !origin.includes('ais-dev-')
    ) {
      return origin;
    }
  }
  return PUBLIC_APP_URL_FALLBACK;
}

function isKnownDeploymentPhotoOrigin(url: string): boolean {
  return (
    url.startsWith('/') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('ais-dev-') ||
    url.includes('ais-pre-') ||
    url.includes('royalsrenewform.vercel.app')
  );
}

export function resolveFullMediaUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:')) return trimmed;

  const relPhotoPath = extractFamilyPhotoRelativePath(trimmed);
  if (relPhotoPath && isKnownDeploymentPhotoOrigin(trimmed)) {
    return `${getPublicMediaOrigin()}${relPhotoPath}`;
  }

  if (trimmed.startsWith('/')) {
    return `${getPublicMediaOrigin()}${trimmed}`;
  }
  return trimmed;
}

export async function downloadMediaImage(url: string, suggestedName = 'royal-photo.jpg') {
  if (url.startsWith('data:')) {
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const fetchUrl = getDisplayImageSrc(url) || url;
  try {
    const res = await fetch(fetchUrl, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Direct download unavailable');
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error('Response is not an image');
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  } catch {
    const cloudDataUrl = await resolvePhotoFromFirestore(url).catch(() => null);
    if (cloudDataUrl) {
      const link = document.createElement('a');
      link.href = cloudDataUrl;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const resolved = resolveFullMediaUrl(url);
    const link = document.createElement('a');
    link.href = resolved.includes('?') ? `${resolved}&download=1` : `${resolved}?download=1`;
    link.download = suggestedName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
