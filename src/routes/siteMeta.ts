import { FAVICON_SVG } from '../favicon';
import { listImages } from '../do/client';
import { LIST_LIMITS } from '../domain/contract';
import { mediaUrl } from '../domain/imageVariants';
import type { GalleryApp } from '../types';

const faviconHeaders = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
};

export const registerSiteMetaRoutes = (app: GalleryApp) => {
  app.get('/favicon.svg', () => new Response(FAVICON_SVG, { headers: faviconHeaders }));

  app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 301));

  app.get('/robots.txt', (c) =>
    c.text(
      `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', c.req.url).toString()}\n`,
      200,
      { 'Content-Type': 'text/plain; charset=utf-8' },
    ),
  );

  app.get('/sitemap.xml', async (c) => {
    const listed = await listImages(c.env, { limit: LIST_LIMITS.maxPageSize });
    if (!listed.ok) {
      return c.text('Sitemap temporarily unavailable', 503, {
        'Retry-After': '60',
        'Cache-Control': 'no-store',
      });
    }

    const baseUrl = new URL(c.req.url).origin;
    const urls = listed.data.items.map(
      (item) =>
        `<url><loc>${mediaUrl(baseUrl, item.id)}</loc><lastmod>${item.createdAt}</lastmod></url>`,
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join(
      '\n',
    )}\n</urlset>`;
    return c.text(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
  });
};
