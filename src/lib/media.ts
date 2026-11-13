export function isUploadedServerPhoto(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith('/api/family/photo/') || url.includes('/api/family/photo/');
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

export function getDisplayImageSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/api/family/photo/')) return url;
  if (url.includes('/api/family/photo/')) {
    const idx = url.indexOf('/api/family/photo/');
    return url.slice(idx);
  }
  const driveId = extractDriveFileId(url);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url;
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

export function resolveFullMediaUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';

  const marker = '/api/family/photo/';
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const isPrivateOrRelative =
      trimmed.startsWith('/') ||
      trimmed.includes('localhost') ||
      trimmed.includes('127.0.0.1') ||
      trimmed.includes('ais-dev-');
    if (isPrivateOrRelative) {
      return `${getPublicMediaOrigin()}${trimmed.slice(idx)}`;
    }
  }

  if (trimmed.startsWith('/')) {
    return `${getPublicMediaOrigin()}${trimmed}`;
  }
  return trimmed;
}

export async function downloadMediaImage(url: string, suggestedName = 'royal-photo.jpg') {
  const fetchUrl = getDisplayImageSrc(url) || url;
  try {
    const res = await fetch(fetchUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('Download failed');
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
    const link = document.createElement('a');
    link.href = url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
