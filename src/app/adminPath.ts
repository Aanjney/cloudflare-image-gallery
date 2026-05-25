import type { Env } from '../types';
import type { GalleryApp } from './worker';

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
