import { addSecurityHeaders } from './security';
import type { ImageMeta } from '../types';

export const PRIVATE_NO_STORE = 'private, no-store';

// Image URLs never change bytes; s-maxage bounds how long other colos serve a deleted photo.
export const PUBLIC_IMAGE_CACHE = 'public, max-age=31536000, s-maxage=86400, immutable';

type R2ImageObject = {
  body: ReadableStream | null;
  httpEtag?: string;
  etag?: string;
  size?: number;
};

const WEAK_ETAG_PREFIX = /^W\//;

export const etagsMatch = (ifNoneMatch: string | undefined, etag: string | undefined): boolean => {
  if (!etag || !ifNoneMatch) return false;
  return ifNoneMatch.replace(WEAK_ETAG_PREFIX, '') === etag.replace(WEAK_ETAG_PREFIX, '');
};

export const notFoundResponse = (secure = false): Response => {
  const resp = Response.json(
    { error: 'Not found' },
    { status: 404, headers: { 'Cache-Control': PRIVATE_NO_STORE } },
  );
  return secure ? addSecurityHeaders(resp) : resp;
};

export const indexUnavailableResponse = (): Response =>
  Response.json(
    { error: 'Index unavailable' },
    { status: 503, headers: { 'Cache-Control': PRIVATE_NO_STORE } },
  );

export const notModifiedResponse = (
  etag: string,
  cacheControl: string,
  extraHeaders?: Record<string, string>,
): Response =>
  new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      'Cache-Control': cacheControl,
      ...extraHeaders,
    },
  });

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
  headers.set('Vary', 'Accept');
  return new Response(upstream.body, { headers, status: upstream.status });
};
