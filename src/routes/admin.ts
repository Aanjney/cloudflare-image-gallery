import { buildAdminHTML } from '../html/admin';
import {
  addSecurityHeaders,
  getAdminPrefix,
  getEdgeCache,
  getIndexStub,
  requireAdminAuth,
  type GalleryApp,
} from '../http';
import {
  UPLOAD_WARM_VARIANTS,
  imagePath,
  purgeImageCacheTargets,
} from '../imageVariants';
import type { ImageMeta } from '../types';

const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const registerAdminRoutes = (app: GalleryApp) => {
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

    const delResp = await stub.fetch('https://index/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
    if (!delResp.ok) {
      const msg = await delResp.text();
      return c.json({ error: 'Failed to remove index', detail: msg }, 500);
    }

    await c.env.IMAGES_BUCKET.delete(meta.key);

    const cache = getEdgeCache();
    const base = new URL(c.req.url);
    const purgeTargets = purgeImageCacheTargets(id, base);
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
      if (!file.type || !ALLOWED_UPLOAD_TYPES.has(file.type)) {
        return addSecurityHeaders(
          c.json(
            { error: 'Only JPEG, PNG, or WebP images are allowed' },
            400,
          ),
        );
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
        await c.env.IMAGES_BUCKET.delete(key).catch(() => {});
        return c.json(
          { error: 'Failed to record metadata', detail: message },
          500,
        );
      }

      const saved = (await doResp.json()) as ImageMeta;
      uploaded.push(saved);

      const base = new URL(c.req.url);
      const warmUrls = UPLOAD_WARM_VARIANTS.map((variant) =>
        new URL(imagePath(id, variant), base).toString(),
      );
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
};
