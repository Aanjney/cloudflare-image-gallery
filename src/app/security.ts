import type { Context, Next } from 'hono';
import type { Env } from '../types';

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

export const requireAdminAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const bypass = c.env.ACCESS_BYPASS_DEV === 'true';
  const hasAccessHeader = Boolean(
    c.req.header('cf-access-authenticated-user-email') || c.req.header('cf-access-verified-email'),
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
