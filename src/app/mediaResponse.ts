import type { ImageMeta } from '../domain/imageMeta';
import { PUBLIC_IMAGE_CACHE } from './cacheControl';

type R2ImageObject = {
  body: ReadableStream | null;
  httpEtag?: string;
  etag?: string;
  size?: number;
};

const WEAK_ETAG_PREFIX = /^W\//;

/** /img picks its format from Accept; /media originals never vary. */
export const NEGOTIATED_VARY = 'Accept';

/** A 304 when the client already holds `etag`, otherwise null. */
export const notModifiedIfMatch = (
  ifNoneMatch: string | undefined,
  etag: string | null | undefined,
  vary?: string,
): Response | null => {
  if (!etag || !ifNoneMatch) return null;
  if (ifNoneMatch.replace(WEAK_ETAG_PREFIX, '') !== etag.replace(WEAK_ETAG_PREFIX, '')) return null;
  const headers: Record<string, string> = { ETag: etag, 'Cache-Control': PUBLIC_IMAGE_CACHE };
  if (vary) headers.Vary = vary;
  return new Response(null, { status: 304, headers });
};

export const r2ObjectEtag = (obj: R2ImageObject, meta: Pick<ImageMeta, 'id' | 'size'>): string =>
  obj.httpEtag || obj.etag || `"${meta.id}-${meta.size}"`;

export const buildR2ImageResponse = (
  obj: R2ImageObject,
  meta: Pick<ImageMeta, 'contentType' | 'id' | 'size'>,
): Response => {
  const headers = new Headers();
  headers.set('Content-Type', meta.contentType || 'image/jpeg');
  headers.set('Cache-Control', PUBLIC_IMAGE_CACHE);
  headers.set('ETag', r2ObjectEtag(obj, meta));
  if (typeof obj.size === 'number') headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers });
};

export const buildTransformedImageResponse = (upstream: Response, etag: string): Response => {
  const headers = new Headers(upstream.headers);
  headers.set('ETag', etag);
  headers.set('Cache-Control', PUBLIC_IMAGE_CACHE);
  headers.set('Vary', NEGOTIATED_VARY);
  return new Response(upstream.body, { headers, status: upstream.status });
};
