import type { Context, Next } from 'hono';
import { verifyAccessJwt } from './accessJwt';
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
  if (c.env.ACCESS_BYPASS_DEV === 'true') {
    await next();
    return;
  }

  const teamDomain = c.env.ACCESS_TEAM_DOMAIN?.trim();
  if (!teamDomain) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Set ACCESS_TEAM_DOMAIN to your Cloudflare Access team domain.',
      },
      401,
    );
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion') ?? c.req.header('cf-access-jwt-assertion');
  if (!token) {
    return c.json(
      {
        error: 'Unauthorized',
        message:
          'Protect this route with Cloudflare Access or set ACCESS_BYPASS_DEV=true for local dev only.',
      },
      401,
    );
  }

  const result = await verifyAccessJwt(token, {
    teamDomain,
    audience: c.env.ACCESS_AUD,
  });

  if (!result.ok) {
    return c.json({ error: 'Unauthorized', message: result.reason }, 401);
  }

  await next();
};
