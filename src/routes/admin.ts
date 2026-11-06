import type { MiddlewareHandler } from 'hono';
import { buildAdminHTML } from '../html/admin';
import { getAdminPrefix, isAdminRewrite } from '../app/adminPath';
import { getEdgeCache } from '../app/cache';
import { PRIVATE_NO_STORE } from '../app/mediaResponse';
import { parseIdBody, parseImageUpdateBody, parseRequestJson } from '../app/parseRequest';
import { addSecurityHeaders, requireAdminAuth } from '../app/security';
import {
  addImageMeta,
  getImageMeta,
  getIndexStats,
  updateImageMeta,
  type GalleryApp,
} from '../app/worker';
import { ORDER_LIMIT } from '../do/ImageIndex';
import { deleteImage } from '../domain/deleteImage';
import {
  GALLERY_FIRST_PAGE_PATH,
  UPLOAD_WARM_VARIANTS,
  imagePath,
  purgeImageCacheTargets,
} from '../domain/imageVariants';
import {
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_UPLOAD_REQUEST_BYTES,
  UPLOAD_EXTENSIONS,
  UPLOAD_FORMAT_LABEL,
} from '../domain/uploadPolicy';
import type { Env } from '../types';

const requireJsonBody: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const mediaType = c.req.header('content-type')?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return c.json({ error: 'Content-Type must be application/json' }, 415);
  }
  await next();
};

const parseDimension = (value: FormDataEntryValue | null): number | undefined => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= MAX_IMAGE_DIMENSION ? n : undefined;
};

const tooLarge = { error: `Each image must be ${MAX_UPLOAD_LABEL} or smaller` };

// Lowercase only: the admin client sends crypto.randomUUID(), and the id becomes an R2 key.
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const UPLOAD_WARM_TIMEOUT_MS = 10_000;

export const registerAdminRoutes = (app: GalleryApp) => {
  app.use('/_admin/*', async (c, next) => {
    await next();
    c.res = addSecurityHeaders(c.res);
  });

  app.use('/_admin/*', async (c, next) => {
    const prefix = getAdminPrefix(c.env);
    if (prefix !== '/_admin' && !isAdminRewrite(c.req.raw)) {
      return c.notFound();
    }
    await next();
  });

  app.get('/_admin', (c) => c.redirect(getAdminPrefix(c.env) + '/', 301));

  app.use('/_admin/*', async (c, next) => {
    const isSafeMethod = c.req.method === 'GET' || c.req.method === 'HEAD';
    if (!isSafeMethod && c.req.header('origin') !== new URL(c.req.url).origin) {
      return c.json({ error: 'Cross-origin request rejected' }, 403);
    }
    await next();
  });

  app.use('/_admin/*', requireAdminAuth);

  app.get('/_admin/ping', (c) => c.json({ ok: true, admin: true, now: new Date().toISOString() }));

  app.get('/_admin/api/stats', async (c) => {
    const stats = await getIndexStats(c.env);
    if (!stats.ok) return c.json({ error: 'Failed to load stats', detail: stats.detail }, 500);
    return c.json(stats.data);
  });

  app.post('/_admin/api/images/delete', requireJsonBody, async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseIdBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { id } = parsed.data;

    const found = await getImageMeta(c.env, id);
    if (!found.ok && found.notFound) {
      return c.json({ error: 'Not found' }, 404, { 'Cache-Control': PRIVATE_NO_STORE });
    }
    if (!found.ok) {
      return c.json({ error: 'Index unavailable', detail: found.detail }, 503, {
        'Cache-Control': PRIVATE_NO_STORE,
      });
    }

    const result = await deleteImage(c.env, found.data);

    if (result.ok || result.stage === 'index') {
      const cache = getEdgeCache();
      const purgeTargets = purgeImageCacheTargets(id, new URL(c.req.url).origin);
      await Promise.allSettled(purgeTargets.map((t) => cache.delete(t)));
    }

    if (!result.ok) {
      return c.json({ ok: false, error: result.error, id, detail: result.detail }, 500, {
        'Cache-Control': PRIVATE_NO_STORE,
      });
    }
    return c.json({ ok: true, id });
  });

  app.post('/_admin/api/images/update', requireJsonBody, async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseImageUpdateBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const updated = await updateImageMeta(c.env, parsed.data);
    if (!updated.ok && updated.notFound) return c.json({ error: 'Not found' }, 404);
    if (!updated.ok) {
      return c.json({ error: 'Failed to update metadata', detail: updated.detail }, 500);
    }

    await getEdgeCache()
      .delete(new URL(c.req.url).origin + GALLERY_FIRST_PAGE_PATH)
      .catch(() => {});

    return c.json({ ok: true, image: updated.data });
  });

  app.get('/_admin/', (c) => c.html(buildAdminHTML(getAdminPrefix(c.env))));

  app.post('/_admin/api/upload', async (c) => {
    if (Number(c.req.header('content-length')) > MAX_UPLOAD_REQUEST_BYTES) {
      return c.json(tooLarge, 413);
    }

    const formData = await c.req.formData();
    const files = formData.getAll('file').filter((f): f is File => f instanceof File);

    if (!files.length) {
      return c.json({ error: 'file field (File) is required' }, 400);
    }
    if (files.length > 1) {
      return c.json({ error: 'Send one file per upload request' }, 400);
    }
    const [file] = files;
    const ext = UPLOAD_EXTENSIONS.get(file.type);
    if (!ext) {
      return c.json({ error: `Only ${UPLOAD_FORMAT_LABEL} images are allowed` }, 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) return c.json(tooLarge, 413);

    const uploadId = formData.get('uploadId');
    if (uploadId !== null && (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId))) {
      return c.json({ error: 'uploadId must be a lowercase UUID' }, 400);
    }
    const id = uploadId ?? crypto.randomUUID();
    const key = `images/${id}.${ext}`;

    if (uploadId) {
      const existing = await getImageMeta(c.env, id);
      if (existing.ok && (await c.env.IMAGES_BUCKET.head(existing.data.key))) {
        return c.json({ ok: true, image: existing.data });
      }
      if (!existing.ok && !existing.notFound) {
        return c.json(
          { error: 'Failed to check for an earlier upload', detail: existing.detail },
          503,
        );
      }
    }

    const alt = formData.get('alt')?.toString().trim() || undefined;
    const contentType = file.type;
    await c.env.IMAGES_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType },
      customMetadata: alt ? { alt } : undefined,
    });

    const saved = await addImageMeta(c.env, {
      id,
      key,
      createdAt: new Date().toISOString(),
      size: file.size,
      contentType,
      width: parseDimension(formData.get('width')),
      height: parseDimension(formData.get('height')),
      alt,
      name: formData.get('name')?.toString().trim() || file.name || undefined,
      placeholder: formData.get('placeholder')?.toString().trim() || undefined,
      cameraBody: formData.get('cameraBody')?.toString().trim() || undefined,
      filmStock: formData.get('filmStock')?.toString().trim() || undefined,
      location: formData.get('location')?.toString().trim() || undefined,
      year: formData.get('year')?.toString().trim() || undefined,
    });

    if (!saved.ok) {
      await c.env.IMAGES_BUCKET.delete(key).catch((err) => {
        console.error(`orphan R2 object after failed index add: id=${id} key=${key}`, err);
      });
      if (saved.status === 409) {
        return c.json(
          {
            error: `The archive is full (${ORDER_LIMIT} photos). Delete some photos before uploading more.`,
          },
          409,
        );
      }
      return c.json({ error: 'Failed to record metadata', detail: saved.detail }, 500);
    }

    const origin = new URL(c.req.url).origin;
    c.executionCtx.waitUntil(
      Promise.allSettled(
        UPLOAD_WARM_VARIANTS.map((variant) =>
          fetch(origin + imagePath(id, variant), {
            cf: { cacheEverything: true, cacheTtl: 86400 },
            signal: AbortSignal.timeout(UPLOAD_WARM_TIMEOUT_MS),
          }),
        ),
      ),
    );

    await getEdgeCache()
      .delete(origin + GALLERY_FIRST_PAGE_PATH)
      .catch(() => {});

    return c.json({ ok: true, image: saved.data });
  });
};
