import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { Env, ImageMeta, ListResponse } from './types';
import { buildGalleryHTML } from './html/gallery';
import { buildAdminHTML } from './html/admin';
import { FAVICON_SVG } from './favicon';

const app = new Hono<{ Bindings: Env }>();

const getIndexStub = (env: Env) => {
  const id = env.IMAGE_INDEX.idFromName('global');
  return env.IMAGE_INDEX.get(id);
};

// ─── Edge Cache helpers ───

const getEdgeCache = () =>
  (caches as unknown as { default: Cache }).default;

const formatPref = (accept: string | undefined): string => {
  if (accept?.includes('image/avif')) return 'avif';
  if (accept?.includes('image/webp')) return 'webp';
  return 'jpeg';
};

const buildCacheKey = (url: string, accept?: string): Request => {
  const u = new URL(url);
  u.searchParams.set('_accept', formatPref(accept));
  return new Request(u.toString());
};

const FORMAT_VARIANTS = ['avif', 'webp', 'jpeg'] as const;

const addSecurityHeaders = (resp: Response) => {
  const headers = new Headers(resp.headers);
  headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
};

const getAdminPrefix = (env: Env) => {
  let p = (env.ADMIN_PATH || '/_admin').trim().replace(/\/+$/, '');
  if (p && !p.startsWith('/')) p = `/${p}`;
  return p || '/_admin';
};

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return c.redirect(url.toString(), 301);
  }

  const prefix = getAdminPrefix(c.env);
  if (prefix !== '/_admin' && url.pathname.startsWith(prefix)) {
    const rewritten = '/_admin' + url.pathname.slice(prefix.length);
    const newUrl = new URL(rewritten + url.search, url.origin);
    const h = new Headers(c.req.raw.headers);
    h.set('x-gallery-admin-rewrite', '1');
    const init: RequestInit = {
      method: c.req.method,
      headers: h,
      redirect: c.req.raw.redirect,
    };
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      init.body = c.req.raw.body;
    }
    const newReq = new Request(newUrl.toString(), init);
    return app.fetch(newReq, c.env, c.executionCtx);
  }

  await next();
});

const buildImageOrigin = (env: Env, key: string) => {
  if (env.R2_PUBLIC_HOST) {
    return `https://${env.R2_PUBLIC_HOST.replace(/\/+$/, '')}/${key}`;
  }
  return null;
};

const requireAdminAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const bypass = c.env.ACCESS_BYPASS_DEV === 'true';
  const hasAccessHeader = Boolean(
    c.req.header('cf-access-authenticated-user-email') ||
      c.req.header('cf-access-verified-email'),
  );

  if (!bypass && !hasAccessHeader) {
    return c.json(
      {
        error: 'Unauthorized',
        message:
          'Protect this route with Cloudflare Access or set ACCESS_BYPASS_DEV=true for local dev only.',
      },
      401,
    );
  }

  await next();
};

// ─── Public API ───

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

// ─── Media serving ───

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

// ─── Admin routes ───

/** Block bare /_admin when a custom ADMIN_PATH is set; allow internally rewritten requests. */
app.use('/_admin/*', async (c, next) => {
  const prefix = getAdminPrefix(c.env);
  if (prefix !== '/_admin' && !c.req.header('x-gallery-admin-rewrite')) {
    return c.notFound();
  }
  await next();
});

app.get('/_admin', (c) => {
  const prefix = getAdminPrefix(c.env);
  if (prefix !== '/_admin' && !c.req.header('x-gallery-admin-rewrite')) {
    return c.notFound();
  }
  const url = new URL(c.req.url);
  url.pathname = prefix + '/';
  return c.redirect(url.toString(), 301);
});

app.use('/_admin/*', requireAdminAuth);

app.get('/_admin/ping', (c) =>
  c.json({ ok: true, admin: true, now: new Date().toISOString() }),
);

app.post('/_admin/api/images/delete', async (c) => {
  const parsed = (await c.req.json().catch(() => ({}))) as { id?: string };
  const id =
    parsed && typeof parsed.id === 'string' && parsed.id.trim().length > 0
      ? parsed.id
      : undefined;
  if (!id) return c.json({ error: 'id is required' }, 400);

  const stub = getIndexStub(c.env);
  const metaResp = await stub.fetch(`https://index/meta/${id}`);
  if (!metaResp.ok)
    return addSecurityHeaders(
      c.json(
        { error: 'Not found' },
        404,
        { 'Cache-Control': 'private, no-store' },
      ),
    );
  const meta = (await metaResp.json()) as ImageMeta;

  await c.env.IMAGES_BUCKET.delete(meta.key);

  const delResp = await stub.fetch('https://index/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!delResp.ok) {
    const msg = await delResp.text();
    return c.json({ error: 'Failed to remove index', detail: msg }, 500);
  }

  const cache = getEdgeCache();
  const base = new URL(c.req.url);
  const imgPaths = [
    `/img/${id}`,
    `/img/${id}?w=240&q=75&fmt=auto`,
    `/img/${id}?w=160&q=75&fmt=auto`,
    `/img/${id}?w=160&q=75&fmt=webp`,
    `/img/${id}?w=320&q=78&fmt=auto`,
    `/img/${id}?w=480&q=78&fmt=auto`,
    `/img/${id}?w=480&q=80&fmt=auto`,
    `/img/${id}?w=720&q=80&fmt=auto`,
    `/img/${id}?w=800&q=80&fmt=auto`,
    `/img/${id}?w=800&q=85&fmt=auto`,
    `/img/${id}?w=960&q=80&fmt=auto`,
    `/img/${id}?w=1200&q=80&fmt=auto`,
    `/img/${id}?w=1200&q=85&fmt=auto`,
    `/img/${id}?w=1600&q=82&fmt=auto`,
    `/img/${id}?w=1600&q=85&fmt=auto`,
  ];
  const purgeTargets: string[] = [new URL(`/media/${id}`, base).toString()];
  for (const p of imgPaths) {
    const fullUrl = new URL(p, base).toString();
    purgeTargets.push(fullUrl);
    for (const fmt of FORMAT_VARIANTS) {
      const u = new URL(fullUrl);
      u.searchParams.set('_accept', fmt);
      purgeTargets.push(u.toString());
    }
  }
  purgeTargets.push(new URL('/api/images', base).toString());
  await Promise.allSettled(purgeTargets.map((t) => cache.delete(t)));

  return addSecurityHeaders(c.json({ ok: true, id }));
});

app.post('/_admin/api/images/update', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<ImageMeta> & { id?: string };
  if (!body?.id) return c.json({ error: 'id is required' }, 400);

  const stub = getIndexStub(c.env);
  const doResp = await stub.fetch('https://index/update', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!doResp.ok) {
    const message = await doResp.text();
    return c.json({ error: 'Failed to update metadata', detail: message }, 500);
  }
  const updated = (await doResp.json()) as ImageMeta;

  const cache = getEdgeCache();
  const base = new URL(c.req.url);
  const apiUrl = new URL('/api/images', base).toString();
  await cache.delete(new Request(apiUrl)).catch(() => {});

  return addSecurityHeaders(c.json({ ok: true, image: updated }));
});

app.get('/_admin/', (c) =>
  addSecurityHeaders(c.html(buildAdminHTML(getAdminPrefix(c.env)))),
);

app.post('/_admin/api/upload', async (c) => {
  const formData = await c.req.formData();
  const files = formData
    .getAll('file')
    .filter((f): f is File => f instanceof File);

  if (!files.length) {
    return c.json({ error: 'file field (File) is required' }, 400);
  }

  const alt = formData.get('alt')?.toString().trim() || undefined;
  const width = formData.get('width') ? Number(formData.get('width')) : undefined;
  const height = formData.get('height')
    ? Number(formData.get('height'))
    : undefined;
  const name = formData.get('name')?.toString().trim() || undefined;
  const placeholder = formData.get('placeholder')?.toString().trim() || undefined;
  const cameraBody = formData.get('cameraBody')?.toString().trim() || undefined;
  const filmStock = formData.get('filmStock')?.toString().trim() || undefined;
  const location = formData.get('location')?.toString().trim() || undefined;
  const year = formData.get('year')?.toString().trim() || undefined;

  const stub = getIndexStub(c.env);
  const uploaded: ImageMeta[] = [];

  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) {
      return addSecurityHeaders(c.json({ error: 'Invalid file type' }, 400));
    }
    const contentType = file.type || 'image/jpeg';
    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const id = crypto.randomUUID();
    const key = `images/${id}.${ext}`;

    await c.env.IMAGES_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: alt ? { alt } : undefined,
    });

    const meta: ImageMeta = {
      id,
      key,
      createdAt: new Date().toISOString(),
      size: file.size ?? 0,
      contentType,
      width: Number.isFinite(width) ? width : undefined,
      height: Number.isFinite(height) ? height : undefined,
      alt,
      name: name || file.name || undefined,
      placeholder,
      cameraBody,
      filmStock,
      location,
      year,
    };

    const doResp = await stub.fetch('https://index/add', {
      method: 'POST',
      body: JSON.stringify(meta),
    });

    if (!doResp.ok) {
      const message = await doResp.text();
      return c.json(
        { error: 'Failed to record metadata', detail: message },
        500,
      );
    }

    const saved = (await doResp.json()) as ImageMeta;
    uploaded.push(saved);

    const base = new URL(c.req.url);
    const warmUrls = [
      `/img/${id}?w=240&q=75&fmt=auto`,
      `/img/${id}?w=480&q=78&fmt=auto`,
      `/img/${id}?w=800&q=80&fmt=auto`,
      `/img/${id}?w=1200&q=80&fmt=auto`,
    ].map((p) => new URL(p, base).toString());
    const warmPromise = Promise.allSettled(
      warmUrls.map((u) =>
        fetch(u, {
          cf: { cacheEverything: true, cacheTtl: 86400 },
        }),
      ),
    );
    c.executionCtx?.waitUntil(warmPromise);
  }

  if (uploaded.length === 1) {
    return addSecurityHeaders(c.json({ ok: true, image: uploaded[0] }));
  }
  return addSecurityHeaders(c.json({ ok: true, images: uploaded }));
});

// ─── SEO ───

const faviconHeaders = {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
};

app.get('/favicon.svg', (c) =>
  addSecurityHeaders(
    new Response(FAVICON_SVG, { headers: faviconHeaders }),
  ),
);

/** Crawlers and older clients request /favicon.ico; redirect to the SVG resource. */
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

// ─── Gallery home ───

app.get('/', (c) => {
  const baseUrl = new URL('/', c.req.url).toString();
  return addSecurityHeaders(c.html(buildGalleryHTML(baseUrl)));
});

export default app;
export { ImageIndex } from './do/ImageIndex';
