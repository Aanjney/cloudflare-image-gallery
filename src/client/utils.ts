export function esc(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function fmtDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildAltFromMeta(meta: {
  filmStock?: string;
  cameraBody?: string;
  location?: string;
  year?: string;
  fallback?: string;
}): string {
  const parts: string[] = [];
  if (meta.filmStock) parts.push(meta.filmStock);
  if (meta.cameraBody) parts.push(meta.cameraBody);
  if (meta.location) parts.push(meta.location);
  if (meta.year) parts.push(meta.year);
  if (!parts.length) return meta.fallback ?? 'Film photograph';
  return `Film photograph \u2014 ${parts.join(', ')}`;
}
