import type { MiddlewareHandler } from 'hono';

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  // Responses from fetch and the Cache API have immutable headers, so copy them.
  const headers = new Headers(c.res.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  c.res = new Response(c.res.body, {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
};

export const httpsRedirect: MiddlewareHandler = async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol !== 'http:') return next();
  url.protocol = 'https:';
  return c.redirect(url.toString(), 301);
};
