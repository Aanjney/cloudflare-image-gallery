import { getEdgeCache, putWhileIndexed } from '../app/cache';
import { PRIVATE_NO_STORE } from '../app/cacheControl';
import {
  buildR2ImageResponse,
  buildTransformedImageResponse,
  NEGOTIATED_VARY,
  notModifiedIfMatch,
  r2ObjectEtag,
} from '../app/mediaResponse';
import { RETRY_POLICIES, retry } from '../app/retry';
import { getImageMeta } from '../do/client';
import { PUBLIC_PATHS } from '../domain/contract';
import {
  formatPref,
  imageCacheKey,
  mediaUrl,
  snapVariant,
  variantKey,
} from '../domain/imageVariants';
import type { Env, GalleryApp } from '../types';
import { indexFailureResponse, notFoundResponse } from './errors';

const TRAILING_SLASHES = /\/+$/;

const buildImageOrigin = (env: Env, key: string) =>
  env.R2_PUBLIC_HOST ? `https://${env.R2_PUBLIC_HOST.replace(TRAILING_SLASHES, '')}/${key}` : null;

const numberParam = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const RESIZE_TIMEOUT_MS = 15000;

const getR2Object = (env: Env, key: string) =>
  retry(() => env.IMAGES_BUCKET.get(key), { ...RETRY_POLICIES.r2Read, label: 'R2 get' });

const stillIndexed = (env: Env, id: string) => async () => (await getImageMeta(env, id)).ok;

export const registerMediaRoutes = (app: GalleryApp) => {
  app.get(`${PUBLIC_PATHS.media}:id`, async (c) => {
    const cache = getEdgeCache();
    const id = c.req.param('id');
    const cacheReq = new Request(mediaUrl(new URL(c.req.url).origin, id));
    const cached = await cache.match(cacheReq);
    const ifNoneMatch = c.req.header('if-none-match');
    if (cached) return notModifiedIfMatch(ifNoneMatch, cached.headers.get('ETag')) ?? cached;

    const found = await getImageMeta(c.env, id);
    if (!found.ok) return indexFailureResponse(found);

    const meta = found.data;
    const obj = await getR2Object(c.env, meta.key);
    if (!obj || !obj.body) return notFoundResponse();

    const notModified = notModifiedIfMatch(ifNoneMatch, r2ObjectEtag(obj, meta));
    if (notModified) return notModified;

    const resp = buildR2ImageResponse(obj, meta);
    c.executionCtx.waitUntil(
      putWhileIndexed(cache, cacheReq, resp.clone(), stillIndexed(c.env, id)),
    );
    return resp;
  });

  app.get(`${PUBLIC_PATHS.img}:id`, async (c) => {
    const cache = getEdgeCache();
    const id = c.req.param('id');
    const { width, quality } = snapVariant(
      numberParam(c.req.query('w')),
      numberParam(c.req.query('q')),
    );
    const format = c.req.query('fmt') === 'webp' ? 'webp' : formatPref(c.req.header('accept'));
    const origin = new URL(c.req.url).origin;

    const edgeKey = new Request(imageCacheKey(origin, { id, width, quality, format }));
    const cached = await cache.match(edgeKey);
    const ifNoneMatch = c.req.header('if-none-match');
    if (cached) {
      return notModifiedIfMatch(ifNoneMatch, cached.headers.get('ETag'), NEGOTIATED_VARY) ?? cached;
    }

    const found = await getImageMeta(c.env, id);
    if (!found.ok) return indexFailureResponse(found);
    const meta = found.data;

    const effectiveWidth = width && Math.min(width, meta.width || width);
    const rendered = variantKey({ id, width: effectiveWidth, quality, format });

    const etag = `"v-${rendered}"`;
    const notModified = notModifiedIfMatch(ifNoneMatch, etag, NEGOTIATED_VARY);
    if (notModified) return notModified;

    const resp = await fetch(buildImageOrigin(c.env, meta.key) || mediaUrl(origin, id), {
      signal: AbortSignal.timeout(RESIZE_TIMEOUT_MS),
      cf: {
        image: { width: effectiveWidth, quality, format },
        cacheEverything: true,
        cacheTtl: 86400,
        cacheKey: `img-${rendered}`,
      },
    }).catch(() => null);

    if (!resp?.ok) {
      const obj = await getR2Object(c.env, meta.key);
      if (!obj?.body) return notFoundResponse();
      const fallback = buildR2ImageResponse(obj, meta);
      fallback.headers.set('Cache-Control', PRIVATE_NO_STORE);
      return fallback;
    }

    const final = buildTransformedImageResponse(resp, etag);
    c.executionCtx.waitUntil(
      putWhileIndexed(cache, edgeKey, final.clone(), stillIndexed(c.env, id)),
    );
    return final;
  });
};
