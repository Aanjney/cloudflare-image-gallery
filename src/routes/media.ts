import {
  addSecurityHeaders,
  buildCacheKey,
  getEdgeCache,
  getIndexStub,
  type GalleryApp,
} from '../http';
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
    if (!metaResp.ok) {
      return c.json(
        { error: 'Not found' },
        404,
        { 'Cache-Control': 'private, no-store' },
      );
    }
    const meta = (await metaResp.json()) as ImageMeta;
    const obj = await c.env.IMAGES_BUCKET.get(meta.key);
    if (!obj || !obj.body) {
      return addSecurityHeaders(
        c.json(
          { error: 'Not found' },
          404,
          { 'Cache-Control': 'private, no-store' },
        ),
      );
    }

    const etag = obj.httpEtag || obj.etag || `"${meta.id}-${meta.size}"`;
    const ifNoneMatch = c.req.header('if-none-match');
    if (etag && ifNoneMatch && ifNoneMatch.replace(/W\//, '') === etag.replace(/W\//, '')) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    const headers = new Headers();
    headers.set('Content-Type', meta.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable');
    headers.set('Vary', 'Accept');
    if (etag) headers.set('ETag', etag);
    if (typeof obj.size === 'number') headers.set('Content-Length', String(obj.size));
    const resp = addSecurityHeaders(new Response(obj.body, { headers }));
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
    if (!metaResp.ok)
      return c.json(
        { error: 'Not found' },
        404,
        { 'Cache-Control': 'private, no-store' },
      );
    const meta = (await metaResp.json()) as ImageMeta;

    const origin =
      buildImageOrigin(c.env, meta.key) ||
      `${new URL(c.req.url).origin}/media/${id}`;

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
    const ifNoneMatch = c.req.header('if-none-match');
    if (etag && ifNoneMatch && ifNoneMatch.replace(/W\//, '') === etag.replace(/W\//, '')) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable',
          Vary: 'Accept',
        },
      });
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
      if (!obj?.body)
        return addSecurityHeaders(
          c.json(
            { error: 'Not found' },
            404,
            { 'Cache-Control': 'private, no-store' },
          ),
        );
      const hdrs = new Headers();
      hdrs.set('Content-Type', meta.contentType || 'image/jpeg');
      hdrs.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable');
      hdrs.set('Vary', 'Accept');
      const rawEtag = obj.httpEtag || obj.etag || `"${meta.id}-${meta.size}"`;
      if (rawEtag) hdrs.set('ETag', rawEtag);
      if (typeof obj.size === 'number') hdrs.set('Content-Length', String(obj.size));
      const fallback = addSecurityHeaders(new Response(obj.body, { headers: hdrs }));
      c.executionCtx?.waitUntil(cache.put(edgeKey, fallback.clone()));
      return fallback;
    }

    const headers = new Headers(resp.headers);
    if (etag) headers.set('ETag', etag);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable');
    headers.set('Vary', 'Accept');
    const final = addSecurityHeaders(new Response(resp.body, { headers, status: resp.status }));
    c.executionCtx?.waitUntil(cache.put(edgeKey, final.clone()));
    return final;
  });
};
