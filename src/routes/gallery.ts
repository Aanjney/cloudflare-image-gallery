import { buildGalleryHTML } from '../html/gallery';
import { getEdgeCache } from '../app/cache';
import { PRIVATE_NO_STORE } from '../app/mediaResponse';
import { retry, withTimeout } from '../app/retry';
import { addSecurityHeaders } from '../app/security';
import { getIndexStub, type GalleryApp } from '../app/worker';
import { GALLERY_FIRST_PAGE_PATH } from '../domain/imageVariants';

export const registerGalleryRoutes = (app: GalleryApp) => {
  app.get('/api/health', (c) =>
    addSecurityHeaders(c.json({ ok: true, now: new Date().toISOString() })),
  );

  app.get('/api/images', async (c) => {
    const url = new URL(c.req.url);
    const edgeKey =
      url.pathname + url.search === GALLERY_FIRST_PAGE_PATH ? new Request(c.req.url) : null;
    const cache = getEdgeCache();
    const cached = edgeKey && (await cache.match(edgeKey));
    if (cached) return cached;

    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit');
    const q = c.req.query('q');
    const stub = getIndexStub(c.env);
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', limit);
    if (q) qs.set('q', q);
    const resp = await retry(
      () => withTimeout(stub.fetch(`https://index/list?${qs.toString()}`), 5000, 'index list'),
      { attempts: 2, baseMs: 100, capMs: 1000 },
    );
    const listResp = addSecurityHeaders(
      new Response(resp.body, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': q ? PRIVATE_NO_STORE : 'public, max-age=30, s-maxage=60',
        },
      }),
    );
    // A put racing an upload or delete purge can keep a stale first page until s-maxage.
    // Fencing it needs an index version to re-check; the 60 s bound is accepted instead.
    if (edgeKey && listResp.ok) c.executionCtx.waitUntil(cache.put(edgeKey, listResp.clone()));
    return listResp;
  });

  app.get('/', (c) => {
    const baseUrl = new URL('/', c.req.url).toString();
    return addSecurityHeaders(
      c.html(buildGalleryHTML(baseUrl), 200, { 'Cache-Control': 'no-cache' }),
    );
  });
};
