type Jwk = JsonWebKey & { kid?: string };

type Jwks = { keys: Jwk[] };

let jwksCache: { url: string; keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

export type AccessJwtConfig = {
  teamDomain: string;
  audience?: string;
};

export type AccessJwtVerifyResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; reason: string };

export const normalizeAccessIssuer = (teamDomain: string): string => {
  const trimmed = teamDomain.trim().replace(/\/$/, '');
  if (trimmed.startsWith('https://')) return trimmed;
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

const audienceMatches = (aud: unknown, expected?: string): boolean => {
  if (!expected) return true;
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.some((value) => value === expected);
  return false;
};

const fetchJwks = async (issuer: string, fetchFn: typeof fetch): Promise<Jwk[]> => {
  const url = `${issuer}/cdn-cgi/access/certs`;
  const now = Date.now();
  if (jwksCache && jwksCache.url === url && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }

  const resp = await fetchFn(url);
  if (!resp.ok) throw new Error('Failed to fetch Access JWKS');

  const data = (await resp.json()) as Jwks;
  jwksCache = { url, keys: data.keys, fetchedAt: now };
  return data.keys;
};

const importRsaKey = (jwk: Jwk): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

export const clearAccessJwksCache = (): void => {
  jwksCache = null;
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
    keys = await fetchJwks(issuer, fetchFn);
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
