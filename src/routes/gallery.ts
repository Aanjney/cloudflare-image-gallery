import { buildGalleryHTML } from '../pages/gallery';
import { getEdgeCache } from '../app/cache';
import { PRIVATE_NO_STORE } from '../app/cacheControl';
import { listImages } from '../do/client';
import { GALLERY_FIRST_PAGE_PATH, PUBLIC_PATHS, firstPageCacheKey } from '../domain/contract';
import type { GalleryApp } from '../types';
import { indexFailureResponse } from './errors';

export const registerGalleryRoutes = (app: GalleryApp) => {
  app.get('/api/health', (c) => c.json({ ok: true, now: new Date().toISOString() }));

  app.get(PUBLIC_PATHS.images, async (c) => {
    const url = new URL(c.req.url);
    const edgeKey =
      url.pathname + url.search === GALLERY_FIRST_PAGE_PATH ? firstPageCacheKey(url.origin) : null;
    const cache = getEdgeCache();
    const cached = edgeKey && (await cache.match(edgeKey));
    if (cached) return cached;

    const q = c.req.query('q');
    const listed = await listImages(c.env, {
      cursor: c.req.query('cursor'),
      limit: c.req.query('limit'),
      q,
    });
    if (!listed.ok) return indexFailureResponse(listed);

    const listResp = c.json(listed.data, 200, {
      'Cache-Control': q ? PRIVATE_NO_STORE : 'public, max-age=30, s-maxage=60',
    });
    // A put racing an upload or delete purge can keep a stale first page until s-maxage.
    // Fencing it needs an index version to re-check, so that bound is accepted instead.
    if (edgeKey) c.executionCtx.waitUntil(cache.put(edgeKey, listResp.clone()));
    return listResp;
  });

  app.get('/', (c) => {
    const baseUrl = new URL('/', c.req.url).toString();
    return c.html(buildGalleryHTML(baseUrl), 200, { 'Cache-Control': 'no-cache' });
  });
};
