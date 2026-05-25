import { buildGalleryHTML } from '../html/gallery';
import { addSecurityHeaders, getIndexStub, type GalleryApp } from '../http';
import type { ListResponse } from '../types';

export const registerPublicRoutes = (app: GalleryApp) => {
  app.get('/api/health', (c) =>
    addSecurityHeaders(
      c.json({ ok: true, now: new Date().toISOString() }),
    ),
  );

  app.get('/api/images', async (c) => {
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit');
    const q = c.req.query('q');
    const stub = getIndexStub(c.env);
    const qs = new URLSearchParams();
    if (cursor) qs.set('cursor', cursor);
    if (limit) qs.set('limit', limit);
    if (q) qs.set('q', q);
    const resp = await stub.fetch(`https://index/list?${qs.toString()}`);
    const data = (await resp.json()) as ListResponse;
    return addSecurityHeaders(
      new Response(JSON.stringify(data), {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': q
            ? 'private, no-store'
            : 'public, max-age=30, stale-while-revalidate=120',
        },
      }),
    );
  });

  app.get('/', (c) => {
    const baseUrl = new URL('/', c.req.url).toString();
    return addSecurityHeaders(c.html(buildGalleryHTML(baseUrl)));
  });
};
