import { buildCacheKey, getEdgeCache } from '../app/cache';
import {
  MEDIA_NOT_MODIFIED_CACHE,
  PUBLIC_IMAGE_CACHE,
  buildR2ImageResponse,
  buildTransformedImageResponse,
  etagsMatch,
  notFoundResponse,
  notModifiedResponse,
  r2ObjectEtag,
} from '../app/mediaResponse';
import { addSecurityHeaders } from '../app/security';
import { getIndexStub, type GalleryApp } from '../app/worker';
import type { Env, ImageMeta } from '../types';

const buildImageOrigin = (env: Env, key: string) => {
  if (env.R2_PUBLIC_HOST) {
    return `https://${env.R2_PUBLIC_HOST.replace(/\/+$/, '')}/${key}`;
  }
  return null;
};

export const registerMediaRoutes = (app: GalleryApp) => {
  app.get('/media/:id', async (c) => {
    const cache = getEdgeCache();
    const cacheReq = new Request(c.req.url);
    const cached = await cache.match(cacheReq);
    if (cached) return cached;

    const id = c.req.param('id');
    const stub = getIndexStub(c.env);
    const metaResp = await stub.fetch(`https://index/meta/${id}`);
    if (!metaResp.ok) return notFoundResponse();

    const meta = (await metaResp.json()) as ImageMeta;
    const obj = await c.env.IMAGES_BUCKET.get(meta.key);
    if (!obj || !obj.body) return notFoundResponse(true);

    const etag = r2ObjectEtag(obj, meta);
    if (etagsMatch(c.req.header('if-none-match'), etag)) {
      return notModifiedResponse(etag, MEDIA_NOT_MODIFIED_CACHE);
    }

    const resp = addSecurityHeaders(buildR2ImageResponse(obj, meta));
    c.executionCtx?.waitUntil(cache.put(cacheReq, resp.clone()));
    return resp;
  });

  app.get('/img/:id', async (c) => {
    const cache = getEdgeCache();
    const accept = c.req.header('accept');
    const edgeKey = buildCacheKey(c.req.url, accept);
    const cached = await cache.match(edgeKey);
    if (cached) return cached;

    const id = c.req.param('id');
    const width = c.req.query('w');
    const quality = c.req.query('q');
    const format = c.req.query('fmt');
    const dprRaw = c.req.header('sec-ch-dpr') || '';
    const dpr = Number(dprRaw) || 1;

    const stub = getIndexStub(c.env);
    const metaResp = await stub.fetch(`https://index/meta/${id}`);
    if (!metaResp.ok) return notFoundResponse();

    const meta = (await metaResp.json()) as ImageMeta;

    const origin = buildImageOrigin(c.env, meta.key) || `${new URL(c.req.url).origin}/media/${id}`;

    const imageOpts: Record<string, unknown> = {};
    const requested = width ? Number(width) || undefined : undefined;
    const effectiveWidth = requested
      ? Math.round(Math.min(requested * Math.min(dpr, 2), meta.width || requested))
      : undefined;
    if (effectiveWidth) imageOpts.width = effectiveWidth;
    imageOpts.quality = quality ? Number(quality) || undefined : 85;
    imageOpts.format = format || 'auto';

    const cacheTag = `img-${id}-w${imageOpts.width || 'orig'}-q${imageOpts.quality || ''}-${imageOpts.format || ''}`;
    const etag = `"v-${id}-${imageOpts.width || 'orig'}-${imageOpts.quality || ''}-${imageOpts.format || ''}"`;
    if (etagsMatch(c.req.header('if-none-match'), etag)) {
      return notModifiedResponse(etag, PUBLIC_IMAGE_CACHE, { Vary: 'Accept' });
    }

    const resp = await fetch(origin, {
      cf: {
        image: imageOpts,
        cacheEverything: true,
        cacheTtl: 86400,
        cacheKey: cacheTag,
      },
    });

    if (!resp.ok) {
      const obj = await c.env.IMAGES_BUCKET.get(meta.key);
      if (!obj?.body) return notFoundResponse(true);
      const fallback = addSecurityHeaders(buildR2ImageResponse(obj, meta));
      c.executionCtx?.waitUntil(cache.put(edgeKey, fallback.clone()));
      return fallback;
    }

    const final = addSecurityHeaders(buildTransformedImageResponse(resp, etag));
    c.executionCtx?.waitUntil(cache.put(edgeKey, final.clone()));
    return final;
  });
};
