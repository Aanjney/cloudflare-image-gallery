import { formatPref, getEdgeCache, putWhileIndexed } from '../app/cache';
import {
  PRIVATE_NO_STORE,
  PUBLIC_IMAGE_CACHE,
  buildR2ImageResponse,
  buildTransformedImageResponse,
  etagsMatch,
  indexUnavailableResponse,
  notFoundResponse,
  notModifiedResponse,
  r2ObjectEtag,
} from '../app/mediaResponse';
import { retry, withTimeout } from '../app/retry';
import { addSecurityHeaders } from '../app/security';
import { getImageMeta, type GalleryApp } from '../app/worker';
import { imageCacheKey, mediaCacheKey, snapVariant } from '../domain/imageVariants';
import type { Env } from '../types';

const TRAILING_SLASHES = /\/+$/;

const buildImageOrigin = (env: Env, key: string) =>
  env.R2_PUBLIC_HOST ? `https://${env.R2_PUBLIC_HOST.replace(TRAILING_SLASHES, '')}/${key}` : null;

const numberParam = (raw: string | undefined): number | undefined => {
  const n = Number(raw);
  return raw && n && Number.isFinite(n) ? n : undefined;
};

const RESIZE_TIMEOUT_MS = 15000;

const getR2Object = (env: Env, key: string) =>
  retry(() => withTimeout(env.IMAGES_BUCKET.get(key), 5000, 'R2 get'), {
    attempts: 2,
    baseMs: 100,
    capMs: 1000,
  });

const stillIndexed = (env: Env, id: string) => async () => (await getImageMeta(env, id)).ok;

export const registerMediaRoutes = (app: GalleryApp) => {
  app.get('/media/:id', async (c) => {
    const cache = getEdgeCache();
    const id = c.req.param('id');
    const cacheReq = new Request(mediaCacheKey(new URL(c.req.url).origin, id));
    const cached = await cache.match(cacheReq);
    if (cached) {
      const cachedEtag = cached.headers.get('ETag');
      return cachedEtag && etagsMatch(c.req.header('if-none-match'), cachedEtag)
        ? notModifiedResponse(cachedEtag, PUBLIC_IMAGE_CACHE)
        : cached;
    }

    const found = await getImageMeta(c.env, id);
    if (!found.ok) return found.notFound ? notFoundResponse() : indexUnavailableResponse();

    const meta = found.data;
    const obj = await getR2Object(c.env, meta.key);
    if (!obj || !obj.body) return notFoundResponse(true);

    const etag = r2ObjectEtag(obj, meta);
    if (etagsMatch(c.req.header('if-none-match'), etag)) {
      return notModifiedResponse(etag, PUBLIC_IMAGE_CACHE);
    }

    const resp = addSecurityHeaders(buildR2ImageResponse(obj, meta));
    c.executionCtx.waitUntil(
      putWhileIndexed(cache, cacheReq, resp.clone(), stillIndexed(c.env, id)),
    );
    return resp;
  });

  app.get('/img/:id', async (c) => {
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
    if (cached) {
      const cachedEtag = cached.headers.get('ETag');
      return cachedEtag && etagsMatch(c.req.header('if-none-match'), cachedEtag)
        ? notModifiedResponse(cachedEtag, PUBLIC_IMAGE_CACHE, { Vary: 'Accept' })
        : cached;
    }

    const found = await getImageMeta(c.env, id);
    if (!found.ok) return found.notFound ? notFoundResponse() : indexUnavailableResponse();
    const meta = found.data;

    const effectiveWidth = width && Math.min(width, meta.width || width);
    const imageOpts = { width: effectiveWidth, quality, format };

    const etag = `"v-${id}-${effectiveWidth || 'orig'}-${quality}-${format}"`;
    if (etagsMatch(c.req.header('if-none-match'), etag)) {
      return notModifiedResponse(etag, PUBLIC_IMAGE_CACHE, { Vary: 'Accept' });
    }

    const resp = await fetch(buildImageOrigin(c.env, meta.key) || `${origin}/media/${id}`, {
      signal: AbortSignal.timeout(RESIZE_TIMEOUT_MS),
      cf: {
        image: imageOpts,
        cacheEverything: true,
        cacheTtl: 86400,
        cacheKey: `img-${id}-w${effectiveWidth || 'orig'}-q${quality}-${format}`,
      },
    }).catch(() => null);

    if (!resp?.ok) {
      const obj = await getR2Object(c.env, meta.key);
      if (!obj?.body) return notFoundResponse(true);
      const fallback = addSecurityHeaders(buildR2ImageResponse(obj, meta));
      fallback.headers.set('Cache-Control', PRIVATE_NO_STORE);
      return fallback;
    }

    const final = addSecurityHeaders(buildTransformedImageResponse(resp, etag));
    c.executionCtx.waitUntil(
      putWhileIndexed(cache, edgeKey, final.clone(), stillIndexed(c.env, id)),
    );
    return final;
  });
};
