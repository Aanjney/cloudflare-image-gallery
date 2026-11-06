import type { Env } from '../types';
import type { GalleryApp } from './worker';

const TRAILING_SLASHES = /\/+$/;

export const getAdminPrefix = (env: Env) => {
  let p = (env.ADMIN_PATH || '/_admin').trim().replace(TRAILING_SLASHES, '');
  if (p && !p.startsWith('/')) p = `/${p}`;
  return p || '/_admin';
};

const rewrittenAdminRequests = new WeakSet<Request>();

export const isAdminRewrite = (req: Request) => rewrittenAdminRequests.has(req);

export const registerAdminRewrite = (app: GalleryApp) => {
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return c.redirect(url.toString(), 301);
    }

    const prefix = getAdminPrefix(c.env);
    const underPrefix = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
    if (prefix !== '/_admin' && underPrefix) {
      const rewritten = '/_admin' + url.pathname.slice(prefix.length);
      const init: RequestInit = {
        method: c.req.method,
        headers: c.req.raw.headers,
        redirect: c.req.raw.redirect,
      };
      if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        init.body = c.req.raw.body;
      }
      const newReq = new Request(url.origin + rewritten + url.search, init);
      rewrittenAdminRequests.add(newReq);
      return app.fetch(newReq, c.env, c.executionCtx);
    }

    await next();
  });
};
