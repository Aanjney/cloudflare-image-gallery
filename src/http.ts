import type { Context, Hono, Next } from 'hono';
import type { Env } from './types';

export type GalleryApp = Hono<{ Bindings: Env }>;

export const getIndexStub = (env: Env) => {
  const id = env.IMAGE_INDEX.idFromName('global');
  return env.IMAGE_INDEX.get(id);
};

export const getEdgeCache = () =>
  (caches as unknown as { default: Cache }).default;

const formatPref = (accept: string | undefined): string => {
  if (accept?.includes('image/avif')) return 'avif';
  if (accept?.includes('image/webp')) return 'webp';
  return 'jpeg';
};

export const buildCacheKey = (url: string, accept?: string): Request => {
  const u = new URL(url);
  u.searchParams.set('_accept', formatPref(accept));
  return new Request(u.toString());
};

export const addSecurityHeaders = (resp: Response) => {
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

export const getAdminPrefix = (env: Env) => {
  let p = (env.ADMIN_PATH || '/_admin').trim().replace(/\/+$/, '');
  if (p && !p.startsWith('/')) p = `/${p}`;
  return p || '/_admin';
};

export const registerAdminRewrite = (app: GalleryApp) => {
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
};

export const requireAdminAuth = async (
  c: Context<{ Bindings: Env }>,
  next: Next,
) => {
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
