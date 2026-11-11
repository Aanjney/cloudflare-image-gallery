import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';
import { verifyAccessJwt } from './accessJwt';

const unauthorized = (message: string) => ({ error: 'Unauthorized', message });

export const requireAdminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.env.ACCESS_BYPASS_DEV === 'true') return next();

  const teamDomain = c.env.ACCESS_TEAM_DOMAIN?.trim();
  if (!teamDomain) {
    return c.json(
      unauthorized('Set ACCESS_TEAM_DOMAIN to your Cloudflare Access team domain.'),
      401,
    );
  }

  const audience = c.env.ACCESS_AUD?.trim();
  if (!audience) {
    return c.json(
      unauthorized('Set ACCESS_AUD to your Cloudflare Access application AUD tag.'),
      401,
    );
  }

  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) {
    return c.json(
      unauthorized(
        'Protect this route with Cloudflare Access or set ACCESS_BYPASS_DEV=true for local dev only.',
      ),
      401,
    );
  }

  const result = await verifyAccessJwt(token, { teamDomain, audience });
  if (!result.ok) return c.json(unauthorized(result.reason), 401);

  await next();
};
