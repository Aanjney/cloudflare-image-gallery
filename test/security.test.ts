import { Hono } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearAccessJwksCache, verifyAccessJwt } from '../src/app/accessJwt';
import { requireAdminAuth } from '../src/app/adminAuth';
import type { Env } from '../src/types';

const TEAM = 'test-team';
const ISSUER = 'https://test-team.cloudflareaccess.com';
const AUD = 'test-app-aud';
const KID = 'test-kid';

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string };
let rotatedKey: CryptoKey;
let rotatedJwk: JsonWebKey & { kid: string };

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

const generateSigningKey = async (kid: string) => {
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
  const exported = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey,
    jwk: { ...exported, kid, alg: 'RS256', use: 'sig' },
  };
};

beforeAll(async () => {
  ({ privateKey, jwk: publicJwk } = await generateSigningKey(KID));
  ({ privateKey: rotatedKey, jwk: rotatedJwk } = await generateSigningKey('rotated-kid'));
});

afterEach(() => {
  clearAccessJwksCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const config = { teamDomain: TEAM, audience: AUD };

const verifyWith = (
  token: string,
  fetchFn: () => Promise<Response> = mockJwksFetch(),
  teamDomain = TEAM,
) => verifyAccessJwt(token, { teamDomain, audience: AUD }, fetchFn as typeof fetch);

describe('verifyAccessJwt', () => {
  it('accepts a valid Access JWT', async () => {
    const fetchFn = mockJwksFetch();

    const result = await verifyWith(await signJwt(validPayload()), fetchFn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.email).toBe('admin@example.com');
    }
    expect(fetchFn).toHaveBeenCalledWith(`${ISSUER}/cdn-cgi/access/certs`, {
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    ['a full issuer URL', ISSUER],
    ['a hostname without double suffixing', 'test-team.cloudflareaccess.com'],
  ])('accepts %s as the team domain', async (_name, teamDomain) => {
    const result = await verifyWith(await signJwt(validPayload()), undefined, teamDomain);
    expect(result.ok).toBe(true);
  });

  it('rejects missing or malformed JWTs', async () => {
    await expect(verifyWith('not-a-jwt')).resolves.toEqual({
      ok: false,
      reason: 'Invalid Access JWT',
    });
  });

  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 60 }, 'Access JWT expired'],
    ['wrong issuer', { iss: 'https://wrong.cloudflareaccess.com' }, 'Invalid Access JWT issuer'],
    ['wrong audience', { aud: ['other-aud'] }, 'Invalid Access JWT audience'],
  ])('rejects JWTs with %s', async (_name, overrides, reason) => {
    const result = await verifyWith(await signJwt(validPayload(overrides)));
    expect(result).toEqual({ ok: false, reason });
  });

  it('rejects JWTs signed with an unknown key', async () => {
    const { privateKey: otherKey } = await generateSigningKey(KID);
    const token = await signJwt(validPayload(), { key: otherKey });

    const result = await verifyWith(token);

    expect(result).toEqual({ ok: false, reason: 'Invalid Access JWT signature' });
  });

  it('fails closed on an empty audience', async () => {
    const token = await signJwt(validPayload());

    const result = await verifyAccessJwt(
      token,
      { teamDomain: TEAM, audience: '' },
      mockJwksFetch() as typeof fetch,
    );

    expect(result).toEqual({ ok: false, reason: 'Invalid Access JWT audience' });
  });

  it('rejects JWTs when JWKS fetch fails', async () => {
    const result = await verifyWith(
      await signJwt(validPayload()),
      async () => new Response('nope', { status: 500 }),
    );

    expect(result).toEqual({ ok: false, reason: 'Unable to verify Access JWT' });
  });
});

describe('requireAdminAuth', () => {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', requireAdminAuth);
  app.get('/admin', (c) => c.json({ ok: true }));

  const env = {} as Env;

  it('allows requests when ACCESS_BYPASS_DEV is true', async () => {
    const response = await app.fetch(new Request('https://gallery.test/admin'), {
      ...env,
      ACCESS_BYPASS_DEV: 'true',
    });

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

  it('rejects any token when ACCESS_AUD is unset, naming the variable', async () => {
    vi.stubGlobal('fetch', mockJwksFetch());
    const token = await signJwt(validPayload({ aud: ['some-other-access-app'] }));

    const response = await app.fetch(
      new Request('https://gallery.test/admin', { headers: { 'Cf-Access-Jwt-Assertion': token } }),
      { ...env, ACCESS_TEAM_DOMAIN: TEAM },
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('ACCESS_AUD');
  });

  it('rejects requests without Cf-Access-Jwt-Assertion', async () => {
    const fetchFn = mockJwksFetch();
    vi.stubGlobal('fetch', fetchFn);

    const response = await app.fetch(new Request('https://gallery.test/admin'), {
      ...env,
      ACCESS_TEAM_DOMAIN: TEAM,
      ACCESS_AUD: AUD,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('allows requests with a verified Access JWT', async () => {
    const token = await signJwt(validPayload());
    vi.stubGlobal('fetch', mockJwksFetch());

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
  });
});

describe('Access JWKS cache', () => {
  it('refetches the key set once when a token uses an unknown kid', async () => {
    let served = [publicJwk];
    const fetchFn = vi.fn(async () => Response.json({ keys: served }));

    const first = await verifyAccessJwt(
      await signJwt(validPayload()),
      config,
      fetchFn as typeof fetch,
    );
    expect(first.ok).toBe(true);

    served = [publicJwk, rotatedJwk];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);

    const rotated = await verifyAccessJwt(
      await signJwt(validPayload(), { kid: rotatedJwk.kid, key: rotatedKey }),
      config,
      fetchFn as typeof fetch,
    );

    expect(rotated.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('shares one key set fetch across concurrent verifications', async () => {
    const fetchFn = vi.fn(async () => Response.json({ keys: [publicJwk] }));
    const token = await signJwt(validPayload());

    const results = await Promise.all(
      [1, 2, 3].map(() => verifyAccessJwt(token, config, fetchFn as typeof fetch)),
    );

    expect(results.every((result) => result.ok)).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not refetch for an unknown kid inside the cooldown', async () => {
    const fetchFn = vi.fn(async () => Response.json({ keys: [publicJwk] }));

    await verifyAccessJwt(await signJwt(validPayload()), config, fetchFn as typeof fetch);
    for (let i = 0; i < 3; i++) {
      const result = await verifyAccessJwt(
        await signJwt(validPayload(), { kid: 'forged-kid', key: rotatedKey }),
        config,
        fetchFn as typeof fetch,
      );
      expect(result).toEqual({ ok: false, reason: 'Access JWT signing key not found' });
    }

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns a reason instead of throwing on a malformed JWKS', async () => {
    const token = await signJwt(validPayload());

    for (const body of [{}, { keys: 'nope' }, { keys: [null] }]) {
      clearAccessJwksCache();
      const fetchFn = vi.fn(async () => Response.json(body));
      await expect(verifyAccessJwt(token, config, fetchFn as typeof fetch)).resolves.toEqual({
        ok: false,
        reason: 'Unable to verify Access JWT',
      });
    }
  });

  it('keeps verifying with the last good key set when a refetch fails after the TTL', async () => {
    let healthy = true;
    const fetchFn = vi.fn(async () =>
      healthy ? Response.json({ keys: [publicJwk] }) : new Response('down', { status: 503 }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });

    expect(
      (await verifyAccessJwt(await signJwt(validPayload()), config, fetchFn as typeof fetch)).ok,
    ).toBe(true);

    healthy = false;
    vi.setSystemTime(now + 2 * 60 * 60 * 1000);
    const stale = await verifyAccessJwt(
      await signJwt(validPayload()),
      config,
      fetchFn as typeof fetch,
    );
    expect(stale.ok).toBe(true);
    expect(console.warn).toHaveBeenCalled();

    vi.setSystemTime(now + 25 * 60 * 60 * 1000);
    const tooStale = await verifyAccessJwt(
      await signJwt(validPayload()),
      config,
      fetchFn as typeof fetch,
    );
    expect(tooStale).toEqual({ ok: false, reason: 'Unable to verify Access JWT' });
  });

  it('does not refetch on every request while the key endpoint is down', async () => {
    let healthy = true;
    const fetchFn = vi.fn(async () =>
      healthy ? Response.json({ keys: [publicJwk] }) : new Response('down', { status: 503 }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    const token = await signJwt(validPayload());

    await verifyAccessJwt(token, config, fetchFn as typeof fetch);
    healthy = false;
    vi.setSystemTime(now + 2 * 60 * 60 * 1000);
    const laterToken = await signJwt(validPayload());
    expect((await verifyAccessJwt(laterToken, config, fetchFn as typeof fetch)).ok).toBe(true);
    const callsAfterFailure = fetchFn.mock.calls.length;
    expect((await verifyAccessJwt(laterToken, config, fetchFn as typeof fetch)).ok).toBe(true);

    expect(fetchFn.mock.calls.length).toBe(callsAfterFailure);
  });

  it('fails fast for 30 s after a failed fetch when no key set is cached', async () => {
    let healthy = false;
    const fetchFn = vi.fn(async () =>
      healthy ? Response.json({ keys: [publicJwk] }) : new Response('down', { status: 403 }),
    );
    const now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    const token = await signJwt(validPayload());

    const failed = await verifyAccessJwt(token, config, fetchFn as typeof fetch);
    const callsAfterFailure = fetchFn.mock.calls.length;
    healthy = true;
    vi.setSystemTime(now + 29_000);
    const cooling = await verifyAccessJwt(token, config, fetchFn as typeof fetch);

    expect(failed).toEqual({ ok: false, reason: 'Unable to verify Access JWT' });
    expect(cooling).toEqual({ ok: false, reason: 'Unable to verify Access JWT' });
    expect(fetchFn.mock.calls.length).toBe(callsAfterFailure);

    vi.setSystemTime(now + 31_000);
    expect((await verifyAccessJwt(token, config, fetchFn as typeof fetch)).ok).toBe(true);
  });

  it('retries a 5xx key set response but not a 4xx', async () => {
    const token = await signJwt(validPayload());
    let calls = 0;
    const flaky = vi.fn(async () =>
      calls++ === 0 ? new Response('busy', { status: 503 }) : Response.json({ keys: [publicJwk] }),
    );
    expect((await verifyAccessJwt(token, config, flaky as typeof fetch)).ok).toBe(true);
    expect(flaky).toHaveBeenCalledTimes(2);

    clearAccessJwksCache();
    const forbidden = vi.fn(async () => new Response('no', { status: 403 }));
    await verifyAccessJwt(token, config, forbidden as typeof fetch);
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  it('does not let a hung key set fetch pin later verifications', async () => {
    vi.useFakeTimers();
    const token = await signJwt(validPayload());
    const hung = vi.fn(() => new Promise<Response>(() => {}));

    const pending = verifyAccessJwt(token, config, hung as typeof fetch);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({ ok: false, reason: 'Unable to verify Access JWT' });

    await vi.advanceTimersByTimeAsync(30_000);
    const recovered = await verifyAccessJwt(token, config, mockJwksFetch() as typeof fetch);
    expect(recovered.ok).toBe(true);
  });
});
