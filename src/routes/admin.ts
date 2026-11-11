import type { MiddlewareHandler } from 'hono';
import { buildAdminHTML } from '../pages/admin';
import { requireAdminAuth } from '../app/adminAuth';
import { PRIVATE_NO_STORE } from '../app/cacheControl';
import { parseIdBody, parseImageUpdateBody, parseRequestJson } from '../app/parseRequest';
import { getImageMeta, getIndexStats } from '../do/client';
import { ADMIN_API_PATHS } from '../domain/contract';
import { readMetaFields } from '../domain/imageMeta';
import {
  MAX_IMAGE_DIMENSION,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_UPLOAD_REQUEST_BYTES,
  UPLOAD_EXTENSIONS,
  UPLOAD_FORMAT_LABEL,
} from '../domain/uploadPolicy';
import { deletePhoto, updatePhoto, uploadPhoto } from '../photos/lifecycle';
import type { Env, GalleryApp } from '../types';
import { indexFailureResponse } from './errors';

const TRAILING_SLASHES = /\/+$/;

/** Where the admin routes are registered. A custom ADMIN_PATH is rewritten onto it. */
const ADMIN_ROUTES = '/_admin';

const getAdminPrefix = (env: Env) => {
  let p = (env.ADMIN_PATH || ADMIN_ROUTES).trim().replace(TRAILING_SLASHES, '');
  if (p && !p.startsWith('/')) p = `/${p}`;
  return p || ADMIN_ROUTES;
};

// Only requests built by the rewrite below are in this set, so a client cannot forge one.
const rewrittenRequests = new WeakSet<Request>();

const rewriteAdminPrefix =
  (app: GalleryApp): MiddlewareHandler<{ Bindings: Env }> =>
  async (c, next) => {
    const prefix = getAdminPrefix(c.env);
    const url = new URL(c.req.url);
    const underPrefix = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
    if (prefix === ADMIN_ROUTES || !underPrefix) return next();

    const init: RequestInit = {
      method: c.req.method,
      headers: c.req.raw.headers,
      redirect: c.req.raw.redirect,
    };
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') init.body = c.req.raw.body;
    const rewritten = new Request(
      url.origin + ADMIN_ROUTES + url.pathname.slice(prefix.length) + url.search,
      init,
    );
    rewrittenRequests.add(rewritten);
    return app.fetch(rewritten, c.env, c.executionCtx);
  };

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

const formText = (form: FormData, name: string): unknown => {
  const value = form.get(name);
  if (value === null) return undefined;
  return typeof value === 'string' && !value.trim() ? undefined : value;
};

const tooLarge = { error: `Each image must be ${MAX_UPLOAD_LABEL} or smaller` };

// Lowercase only: the admin client sends crypto.randomUUID(), and the id becomes an R2 key.
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Registers the admin rewrite and routes. Call it before the public routes so the rewrite runs first. */
export const registerAdminRoutes = (app: GalleryApp) => {
  const route = (path: string) => ADMIN_ROUTES + path;

  app.use('*', rewriteAdminPrefix(app));

  app.use(route('/*'), async (c, next) => {
    await next();
    c.res.headers.set('Cache-Control', PRIVATE_NO_STORE);
  });

  app.use(route('/*'), async (c, next) => {
    if (getAdminPrefix(c.env) !== ADMIN_ROUTES && !rewrittenRequests.has(c.req.raw)) {
      return c.notFound();
    }
    await next();
  });

  app.get(ADMIN_ROUTES, (c) => c.redirect(getAdminPrefix(c.env) + '/', 301));

  app.use(route('/*'), async (c, next) => {
    const isSafeMethod = c.req.method === 'GET' || c.req.method === 'HEAD';
    if (!isSafeMethod && c.req.header('origin') !== new URL(c.req.url).origin) {
      return c.json({ error: 'Cross-origin request rejected' }, 403);
    }
    await next();
  });

  app.use(route('/*'), requireAdminAuth);

  app.get(route('/'), (c) => c.html(buildAdminHTML(getAdminPrefix(c.env))));

  app.get(route('/ping'), (c) => c.json({ ok: true, admin: true, now: new Date().toISOString() }));

  app.get(route(ADMIN_API_PATHS.stats), async (c) => {
    const stats = await getIndexStats(c.env);
    return stats.ok ? c.json(stats.data) : indexFailureResponse(stats);
  });

  app.post(route(ADMIN_API_PATHS.delete), requireJsonBody, async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseIdBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { id } = parsed.data;

    const found = await getImageMeta(c.env, id);
    if (!found.ok) return indexFailureResponse(found);

    const result = await deletePhoto(c.env, new URL(c.req.url).origin, found.data);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error, id, detail: result.detail }, 500);
    }
    return c.json({ ok: true, id });
  });

  app.post(route(ADMIN_API_PATHS.update), requireJsonBody, async (c) => {
    const json = await parseRequestJson(c.req);
    if (!json.ok) return c.json({ error: json.error }, 400);
    const parsed = parseImageUpdateBody(json.data);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);

    const updated = await updatePhoto(c.env, new URL(c.req.url).origin, parsed.data);
    if (!updated.ok) return indexFailureResponse(updated);
    return c.json({ ok: true, image: updated.data });
  });

  app.post(route(ADMIN_API_PATHS.upload), async (c) => {
    if (Number(c.req.header('content-length')) > MAX_UPLOAD_REQUEST_BYTES) {
      return c.json(tooLarge, 413);
    }

    const form = await c.req.formData();
    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (!files.length) return c.json({ error: 'file field (File) is required' }, 400);
    if (files.length > 1) return c.json({ error: 'Send one file per upload request' }, 400);

    const [file] = files;
    const ext = UPLOAD_EXTENSIONS.get(file.type);
    if (!ext) return c.json({ error: `Only ${UPLOAD_FORMAT_LABEL} images are allowed` }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json(tooLarge, 413);

    const uploadId = form.get('uploadId');
    if (uploadId !== null && (typeof uploadId !== 'string' || !UPLOAD_ID_PATTERN.test(uploadId))) {
      return c.json({ error: 'uploadId must be a lowercase UUID' }, 400);
    }

    const fields = readMetaFields((field) =>
      field === 'name'
        ? (formText(form, 'name') ?? (file.name || undefined))
        : formText(form, field),
    );
    if (!fields.ok) return c.json({ error: fields.error }, 400);

    const saved = await uploadPhoto(
      c.env,
      new URL(c.req.url).origin,
      (promise) => c.executionCtx.waitUntil(promise),
      {
        file,
        ext,
        uploadId,
        fields: fields.fields,
        width: parseDimension(form.get('width')),
        height: parseDimension(form.get('height')),
      },
    );
    if (!saved.ok) return indexFailureResponse(saved);
    return c.json({ ok: true, image: saved.data });
  });
};
