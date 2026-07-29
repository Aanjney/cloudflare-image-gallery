import { Hono } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  clearAccessJwksCache,
  normalizeAccessIssuer,
  verifyAccessJwt,
} from '../src/app/accessJwt';
import { requireAdminAuth } from '../src/app/security';
import type { Env } from '../src/types';

const TEAM = 'test-team';
const ISSUER = normalizeAccessIssuer(TEAM);
const AUD = 'test-app-aud';
const KID = 'test-kid';

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string };

const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const encodeJsonPart = (value: unknown): string =>
  bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));

const signJwt = async (
  payload: Record<string, unknown>,
  options: { kid?: string; key?: CryptoKey } = {},
): Promise<string> => {
  const header = { alg: 'RS256', kid: options.kid ?? KID, typ: 'JWT' };
  const headerB64 = encodeJsonPart(header);
  const payloadB64 = encodeJsonPart(payload);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    options.key ?? privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
};

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  aud: [AUD],
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  iss: ISSUER,
  email: 'admin@example.com',
  ...overrides,
});

const mockJwksFetch = () =>
  vi.fn(async () =>
    Response.json({
      keys: [publicJwk],
    }),
  );

beforeAll(async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  privateKey = keyPair.privateKey;
  const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk = { ...exported, kid: KID, alg: 'RS256', use: 'sig' };
});

afterEach(() => {
  clearAccessJwksCache();
  vi.restoreAllMocks();
});

describe('verifyAccessJwt', () => {
  it('accepts a valid Access JWT', async () => {
    const token = await signJwt(validPayload());
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(
      token,
      { teamDomain: TEAM, audience: AUD },
      fetchFn as typeof fetch,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.email).toBe('admin@example.com');
    }
    expect(fetchFn).toHaveBeenCalledWith(`${ISSUER}/cdn-cgi/access/certs`);
  });

  it('accepts full issuer URL in team domain config', async () => {
    const token = await signJwt(validPayload());
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(
      token,
      { teamDomain: ISSUER, audience: AUD },
      fetchFn as typeof fetch,
    );

    expect(result.ok).toBe(true);
  });

  it('rejects missing or malformed JWTs', async () => {
    const fetchFn = mockJwksFetch();

    await expect(
      verifyAccessJwt('not-a-jwt', { teamDomain: TEAM }, fetchFn as typeof fetch),
    ).resolves.toEqual({ ok: false, reason: 'Invalid Access JWT' });
  });

  it('rejects expired JWTs', async () => {
    const token = await signJwt(validPayload({ exp: Math.floor(Date.now() / 1000) - 60 }));
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(token, { teamDomain: TEAM }, fetchFn as typeof fetch);

    expect(result).toEqual({ ok: false, reason: 'Access JWT expired' });
  });

  it('rejects JWTs with wrong issuer', async () => {
    const token = await signJwt(validPayload({ iss: 'https://wrong.cloudflareaccess.com' }));
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(token, { teamDomain: TEAM }, fetchFn as typeof fetch);

    expect(result).toEqual({ ok: false, reason: 'Invalid Access JWT issuer' });
  });

  it('rejects JWTs with wrong audience when ACCESS_AUD is configured', async () => {
    const token = await signJwt(validPayload({ aud: ['other-aud'] }));
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(
      token,
      { teamDomain: TEAM, audience: AUD },
      fetchFn as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: 'Invalid Access JWT audience' });
  });

  it('rejects JWTs signed with an unknown key', async () => {
    const otherPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      false,
      ['sign'],
    );
    const token = await signJwt(validPayload(), { key: otherPair.privateKey });
    const fetchFn = mockJwksFetch();

    const result = await verifyAccessJwt(token, { teamDomain: TEAM }, fetchFn as typeof fetch);

    expect(result).toEqual({ ok: false, reason: 'Invalid Access JWT signature' });
  });

  it('rejects JWTs when JWKS fetch fails', async () => {
    const token = await signJwt(validPayload());
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));

    const result = await verifyAccessJwt(token, { teamDomain: TEAM }, fetchFn as typeof fetch);

    expect(result).toEqual({ ok: false, reason: 'Unable to verify Access JWT' });
  });
});

describe('requireAdminAuth', () => {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', requireAdminAuth);
  app.get('/admin', (c) => c.json({ ok: true }));

  const env = {} as Env;

  it('allows requests when ACCESS_BYPASS_DEV is true', async () => {
    const response = await app.fetch(
      new Request('https://gallery.test/admin'),
      { ...env, ACCESS_BYPASS_DEV: 'true' },
    );

    expect(response.status).toBe(200);
  });

  it('rejects requests without ACCESS_TEAM_DOMAIN configured', async () => {
    const response = await app.fetch(new Request('https://gallery.test/admin'), env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unauthorized',
      message: 'Set ACCESS_TEAM_DOMAIN to your Cloudflare Access team domain.',
    });
  });

  it('rejects requests without Cf-Access-Jwt-Assertion', async () => {
    const response = await app.fetch(new Request('https://gallery.test/admin'), {
      ...env,
      ACCESS_TEAM_DOMAIN: TEAM,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' });
  });

  it('allows requests with a verified Access JWT', async () => {
    const token = await signJwt(validPayload());
    const fetchSpy = mockJwksFetch();
    vi.stubGlobal('fetch', fetchSpy);

    const response = await app.fetch(
      new Request('https://gallery.test/admin', {
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'cf-access-authenticated-user-email': 'admin@example.com',
        },
      }),
      { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD },
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
