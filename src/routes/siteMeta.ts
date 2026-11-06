import { FAVICON_SVG } from '../favicon';
import { addSecurityHeaders } from '../app/security';
import { listImages, type GalleryApp } from '../app/worker';

const faviconHeaders = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
};

export const registerSiteMetaRoutes = (app: GalleryApp) => {
  app.get('/favicon.svg', (c) =>
    addSecurityHeaders(new Response(FAVICON_SVG, { headers: faviconHeaders })),
  );

  app.get('/favicon.ico', (c) => addSecurityHeaders(c.redirect('/favicon.svg', 301)));

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
    // The sitemap lists the newest 500 photos, which is the index's page size cap.
    const listed = await listImages(c.env, new URLSearchParams({ limit: '500' }));
    if (!listed.ok) {
      return addSecurityHeaders(
        c.text('Sitemap temporarily unavailable', 503, {
          'Retry-After': '60',
          'Cache-Control': 'no-store',
        }),
      );
    }
    const items = listed.data.items ?? [];

    const baseUrl = new URL(c.req.url).origin;
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
