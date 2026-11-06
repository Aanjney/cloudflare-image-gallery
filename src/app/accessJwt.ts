import { isRetryableStatus, retry, withTimeout } from './retry';

type Jwk = JsonWebKey & { kid?: string };

type Jwks = { keys: Jwk[] };

let jwksCache: { url: string; keys: Jwk[]; fetchedAt: number } | null = null;
let jwksInFlight: { url: string; keys: Promise<Jwk[]> } | null = null;
let jwksLastFailureAt = 0;
const JWKS_TTL_MS = 60 * 60 * 1000;
// During an Access certs outage, keep verifying with the last good keys for this long.
const JWKS_MAX_STALE_MS = 24 * 60 * 60 * 1000;
const JWKS_REFETCH_COOLDOWN_MS = 30 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 3000;

class JwksError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export type AccessJwtConfig = {
  teamDomain: string;
  audience: string;
};

export type AccessJwtVerifyResult =
  { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string };

export const normalizeAccessIssuer = (teamDomain: string): string => {
  const trimmed = teamDomain.trim().replace(/\/$/, '');
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
  if (trimmed.endsWith('.cloudflareaccess.com')) return `https://${trimmed}`;
  return `https://${trimmed}.cloudflareaccess.com`;
};

const base64UrlToBytes = (input: string): Uint8Array => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const decodeJsonPart = (part: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));

const audienceMatches = (aud: unknown, expected: string): boolean => {
  if (!expected) return false;
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.some((value) => value === expected);
  return false;
};

const isJwkList = (keys: unknown): keys is Jwk[] =>
  Array.isArray(keys) && keys.every((key) => key !== null && typeof key === 'object');

const fetchJwks = async (issuer: string, fetchFn: typeof fetch, kid?: string): Promise<Jwk[]> => {
  const url = `${issuer}/cdn-cgi/access/certs`;
  const now = Date.now();
  const cached = jwksCache?.url === url ? jwksCache : null;
  if (cached) {
    const age = now - cached.fetchedAt;
    const hasKid = !kid || cached.keys.some((key) => key.kid === kid);
    if (age < JWKS_TTL_MS && (hasKid || age < JWKS_REFETCH_COOLDOWN_MS)) return cached.keys;
  }
  if (now - jwksLastFailureAt < JWKS_REFETCH_COOLDOWN_MS) {
    if (cached && now - cached.fetchedAt < JWKS_MAX_STALE_MS) return cached.keys;
    throw new JwksError('Access JWKS fetch failed recently', false);
  }

  if (jwksInFlight?.url !== url) {
    const keys = loadJwks(url, fetchFn).finally(() => {
      if (jwksInFlight?.keys === keys) jwksInFlight = null;
    });
    jwksInFlight = { url, keys };
  }
  try {
    return await jwksInFlight.keys;
  } catch (err) {
    jwksLastFailureAt = Date.now();
    if (cached && now - cached.fetchedAt < JWKS_MAX_STALE_MS) {
      console.warn('Access JWKS refetch failed; using the cached key set', {
        ageMs: now - cached.fetchedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      return cached.keys;
    }
    throw err;
  }
};

const loadJwks = (url: string, fetchFn: typeof fetch): Promise<Jwk[]> =>
  retry(
    async () => {
      const fetchedAt = Date.now();
      // withTimeout also covers a fetch implementation that ignores the abort signal.
      const data = await withTimeout(
        (async () => {
          const resp = await fetchFn(url, { signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS) });
          if (!resp.ok) {
            throw new JwksError(
              `Access JWKS fetch failed with ${resp.status}`,
              isRetryableStatus(resp.status),
            );
          }
          return (await resp.json()) as Partial<Jwks> | null;
        })(),
        JWKS_FETCH_TIMEOUT_MS,
        'Access JWKS fetch',
      );
      if (!isJwkList(data?.keys)) throw new JwksError('Malformed Access JWKS', false);
      jwksCache = { url, keys: data.keys, fetchedAt };
      return data.keys;
    },
    {
      attempts: 3,
      baseMs: 100,
      capMs: 1000,
      retryOn: (err) => !(err instanceof JwksError) || err.retryable,
    },
  );

const importRsaKey = (jwk: Jwk): Promise<CryptoKey> =>
  crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'verify',
  ]);

export const clearAccessJwksCache = (): void => {
  jwksCache = null;
  jwksInFlight = null;
  jwksLastFailureAt = 0;
};

export const verifyAccessJwt = async (
  token: string,
  config: AccessJwtConfig,
  fetchFn: typeof fetch = fetch,
): Promise<AccessJwtVerifyResult> => {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'Invalid Access JWT' };

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJsonPart(headerB64);
    payload = decodeJsonPart(payloadB64);
  } catch {
    return { ok: false, reason: 'Invalid Access JWT' };
  }

  if (header.alg !== 'RS256') return { ok: false, reason: 'Invalid Access JWT algorithm' };

  const issuer = normalizeAccessIssuer(config.teamDomain);
  if (payload.iss !== issuer) return { ok: false, reason: 'Invalid Access JWT issuer' };

  const exp = typeof payload.exp === 'number' ? payload.exp : NaN;
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'Access JWT expired' };
  }

  if (!audienceMatches(payload.aud, config.audience)) {
    return { ok: false, reason: 'Invalid Access JWT audience' };
  }

  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  let keys: Jwk[];
  try {
    keys = await fetchJwks(issuer, fetchFn, kid);
  } catch {
    return { ok: false, reason: 'Unable to verify Access JWT' };
  }

  const jwk = kid ? keys.find((key) => key.kid === kid) : keys[0];
  if (!jwk) return { ok: false, reason: 'Access JWT signing key not found' };

  try {
    const key = await importRsaKey(jwk);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(signatureB64) as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return { ok: false, reason: 'Invalid Access JWT signature' };
  } catch {
    return { ok: false, reason: 'Invalid Access JWT signature' };
  }

  return { ok: true, payload };
};
