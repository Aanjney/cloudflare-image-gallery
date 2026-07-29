import { buildAdminHTML } from '../html/admin';
import { getAdminPrefix } from '../app/adminPath';
import { getEdgeCache } from '../app/cache';
import { parseIdBody, parseImageUpdateBody, parseRequestJson } from '../app/parseRequest';
import { addSecurityHeaders, requireAdminAuth } from '../app/security';
import { getIndexStub, type GalleryApp } from '../app/worker';
import { deleteImage } from '../domain/deleteImage';
import { UPLOAD_WARM_VARIANTS, imagePath, purgeImageCacheTargets } from '../domain/imageVariants';
import { ALLOWED_UPLOAD_TYPE_SET } from '../domain/uploadPolicy';
import type { ImageMeta } from '../types';

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

  app.get('/_admin/ping', (c) => c.json({ ok: true, admin: true, now: new Date().toISOString() }));

  app.get('/_admin/api/stats', async (c) => {
    const stub = getIndexStub(c.env);
    const resp = await stub.fetch('https://index/stats');
    if (!resp.ok) {
      const message = await resp.text();
      return c.json({ error: 'Failed to load stats', detail: message }, 500);
    }
    return addSecurityHeaders(c.json(await resp.json()));
  });

  app.post('/_admin/api/images/delete', async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseIdBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { id } = parsed.data;

    const stub = getIndexStub(c.env);
    const metaResp = await stub.fetch(`https://index/meta/${id}`);
    if (!metaResp.ok)
      return addSecurityHeaders(
        c.json({ error: 'Not found' }, 404, { 'Cache-Control': 'private, no-store' }),
      );
    const meta = (await metaResp.json()) as ImageMeta;

    const result = await deleteImage(c.env.IMAGES_BUCKET, stub, id, meta);
    const purgeCache = async () => {
      const cache = getEdgeCache();
      const base = new URL(c.req.url);
      const purgeTargets = purgeImageCacheTargets(id, base);
      await Promise.allSettled(purgeTargets.map((t) => cache.delete(t)));
    };

    if (!result.ok) {
      if (result.stage === 'index') {
        return c.json({ error: result.error, detail: result.detail }, 500);
      }
      await purgeCache();
      return addSecurityHeaders(
        c.json(
          {
            ok: false,
            error: result.error,
            id: result.id,
            orphanKey: result.orphanKey,
            detail: result.detail,
          },
          500,
          { 'Cache-Control': 'private, no-store' },
        ),
      );
    }

    await purgeCache();
    return addSecurityHeaders(c.json({ ok: true, id }));
  });

  app.post('/_admin/api/images/update', async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseImageUpdateBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const body = parsed.data;

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

  app.get('/_admin/', (c) => addSecurityHeaders(c.html(buildAdminHTML(getAdminPrefix(c.env)))));

  app.post('/_admin/api/upload', async (c) => {
    const formData = await c.req.formData();
    const files = formData.getAll('file').filter((f): f is File => f instanceof File);

    if (!files.length) {
      return c.json({ error: 'file field (File) is required' }, 400);
    }

    const alt = formData.get('alt')?.toString().trim() || undefined;
    const width = formData.get('width') ? Number(formData.get('width')) : undefined;
    const height = formData.get('height') ? Number(formData.get('height')) : undefined;
    const name = formData.get('name')?.toString().trim() || undefined;
    const placeholder = formData.get('placeholder')?.toString().trim() || undefined;
    const cameraBody = formData.get('cameraBody')?.toString().trim() || undefined;
    const filmStock = formData.get('filmStock')?.toString().trim() || undefined;
    const location = formData.get('location')?.toString().trim() || undefined;
    const year = formData.get('year')?.toString().trim() || undefined;

    const stub = getIndexStub(c.env);
    const uploaded: ImageMeta[] = [];

    for (const file of files) {
      if (!file.type || !ALLOWED_UPLOAD_TYPE_SET.has(file.type)) {
        return addSecurityHeaders(
          c.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, 400),
        );
      }
      const contentType = file.type || 'image/jpeg';
      const ext =
        contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';

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
        return c.json({ error: 'Failed to record metadata', detail: message }, 500);
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
