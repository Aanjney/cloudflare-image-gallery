import { FAVICON_SVG } from '../favicon';
import { addSecurityHeaders } from '../app/security';
import { getIndexStub, type GalleryApp } from '../app/worker';
import type { ImageMeta, ListResponse } from '../types';

const faviconHeaders = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
};

export const registerSiteMetaRoutes = (app: GalleryApp) => {
  app.get('/favicon.svg', (c) =>
    addSecurityHeaders(new Response(FAVICON_SVG, { headers: faviconHeaders })),
  );

  app.get('/favicon.ico', (c) => {
    const loc = new URL('/favicon.svg', c.req.url).toString();
    return addSecurityHeaders(c.redirect(loc, 301));
  });

  app.get('/robots.txt', (c) =>
    addSecurityHeaders(
      c.text(
        `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', c.req.url).toString()}\n`,
        200,
        { 'Content-Type': 'text/plain; charset=utf-8' },
      ),
    ),
  );

  app.get('/sitemap.xml', async (c) => {
    const stub = getIndexStub(c.env);
    const items: ImageMeta[] = [];
    let cursor: string | null | undefined;
    const limit = 200;
    do {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (cursor) qs.set('cursor', cursor);
      const resp = await stub.fetch(`https://index/list?${qs.toString()}`);
      if (!resp.ok) break;
      const data = (await resp.json()) as ListResponse;
      items.push(...(data.items || []));
      cursor = data.cursor;
    } while (cursor && items.length < 500);

    const baseUrl = new URL('/', c.req.url).toString().replace(/\/+$/, '');
    const urls = items.map(
      (item) =>
        `<url><loc>${baseUrl}/media/${item.id}</loc><lastmod>${item.createdAt}</lastmod></url>`,
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      '\n',
    )}\n</urlset>`;
    return addSecurityHeaders(
      c.text(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' }),
    );
  });
};
