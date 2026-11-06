import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { MAX_UPLOAD_BYTES, UPLOAD_FORMAT_LABEL } from '../src/domain/uploadPolicy';
import type { Env, ImageMeta } from '../src/types';
import { ORIGIN, type StubFetch, fakeNamespace } from './support/fakes';

class FakeImagesBucket {
  readonly putKeys: string[] = [];
  readonly deleteKeys: string[] = [];
  deleteFailures = 0;

  async put(key: string) {
    this.putKeys.push(key);
    return {} as R2Object;
  }

  async get() {
    return null;
  }

  async delete(key: string) {
    if (this.deleteFailures > 0) {
      this.deleteFailures--;
      throw new Error('R2 delete failed');
    }
    this.deleteKeys.push(key);
  }
}

const createEnv = (
  stubFetch: StubFetch = () => Response.json({}),
  overrides: Partial<Env> = {},
) => {
  const bucket = new FakeImagesBucket();
  const env = {
    IMAGES_BUCKET: bucket as unknown as R2Bucket,
    IMAGE_INDEX: fakeNamespace(stubFetch),
    ...overrides,
  } satisfies Env;

  return { env, bucket };
};

const adminRequest = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('Origin', ORIGIN);
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
};

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const recordingIndex = () => {
  const added: ImageMeta[] = [];
  const stubFetch: StubFetch = (_request, init) => {
    const meta = JSON.parse(String(init?.body ?? '{}')) as ImageMeta;
    added.push(meta);
    return Response.json(meta);
  };
  return { added, stubFetch };
};

const uploadRequest = (fields: Record<string, string> = {}, file?: File) => {
  const form = new FormData();
  form.set('file', file ?? new File(['png'], 'photo.png', { type: 'image/png' }));
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return adminRequest('/_admin/api/upload', { method: 'POST', body: form });
};

const imageMeta = (partial: Partial<ImageMeta> = {}): ImageMeta => ({
  id: 'img-1',
  key: 'images/img-1.jpg',
  createdAt: '2024-01-01T00:00:00Z',
  size: 12,
  contentType: 'image/jpeg',
  ...partial,
});

describe('admin routes', () => {
  it('rejects admin requests without Access headers or dev bypass', async () => {
    const { env } = createEnv();

    const response = await app.fetch(adminRequest('/_admin/ping'), env);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Unauthorized',
    });
  });

  it('rejects unsupported upload image types before writing to R2', async () => {
    const { env, bucket } = createEnv(undefined, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(
      uploadRequest({}, new File(['gif'], 'bad.gif', { type: 'image/gif' })),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: `Only ${UPLOAD_FORMAT_LABEL} images are allowed`,
    });
    expect(bucket.putKeys).toEqual([]);
    expect(bucket.deleteKeys).toEqual([]);
  });

  it('deletes the uploaded R2 key when metadata recording fails', async () => {
    const { env, bucket } = createEnv(() => new Response('DO unavailable', { status: 500 }), {
      ACCESS_BYPASS_DEV: 'true',
    });

    const response = await app.fetch(uploadRequest(), env);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to record metadata',
      detail: 'DO unavailable',
    });
    expect(bucket.putKeys).toHaveLength(1);
    expect(bucket.putKeys[0]).toMatch(/^images\/.+\.png$/);
    expect(bucket.deleteKeys).toEqual(bucket.putKeys);
  });

  const deleteIndex = (deleteResponse: () => Response) =>
    vi.fn((request: RequestInfo | URL) => {
      const url = request instanceof Request ? request.url : request.toString();
      const path = new URL(url).pathname;
      if (path === '/meta/img-1') return Response.json(imageMeta());
      if (path === '/delete') return deleteResponse();
      return new Response('not found', { status: 404 });
    });

  const deleteRequest = () =>
    adminRequest('/_admin/api/images/delete', {
      method: 'POST',
      body: JSON.stringify({ id: 'img-1' }),
      headers: { 'Content-Type': 'application/json' },
    });

  it('treats an index 404 during delete as already deleted', async () => {
    const doFetch = deleteIndex(() => new Response('Not found', { status: 404 }));
    const { env } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(deleteRequest(), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 'img-1' });
  });

  it('keeps the index entry when every R2 delete attempt fails', async () => {
    const doFetch = deleteIndex(() => Response.json({ ok: true }));
    const { env, bucket } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });
    bucket.deleteFailures = 3;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await app.fetch(deleteRequest(), env);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Failed to delete image file',
      id: 'img-1',
      detail: 'R2 delete failed',
    });
    expect(bucket.deleteKeys).toEqual([]);
    expect(doFetch.mock.calls.map(([r]) => new URL(String(r)).pathname)).not.toContain('/delete');
    consoleSpy.mockRestore();
  });
});

describe('secret admin path', () => {
  const secretEnv = () =>
    createEnv(undefined, { ADMIN_PATH: '/s3cret', ACCESS_BYPASS_DEV: 'true' }).env;

  it('does not leak ADMIN_PATH when a client forges the rewrite header', async () => {
    const response = await app.fetch(
      new Request(`${ORIGIN}/_admin`, { headers: { 'x-gallery-admin-rewrite': '1' } }),
      secretEnv(),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not serve /_admin/* when a client forges the rewrite header', async () => {
    const response = await app.fetch(
      new Request(`${ORIGIN}/_admin/ping`, { headers: { 'x-gallery-admin-rewrite': '1' } }),
      secretEnv(),
      ctx,
    );

    expect(response.status).toBe(404);
  });
});

describe('admin mutation origin and content type', () => {
  const deleteRequest = (headers: Record<string, string>) =>
    new Request(`${ORIGIN}/_admin/api/images/delete`, {
      method: 'POST',
      body: JSON.stringify({ id: 'img-1' }),
      headers,
    });

  const missingImageEnv = () =>
    createEnv(() => new Response('missing', { status: 404 }), { ACCESS_BYPASS_DEV: 'true' }).env;

  it('rejects a cross-site text/plain POST', async () => {
    const response = await app.fetch(
      deleteRequest({ Origin: 'https://evil.test', 'Content-Type': 'text/plain' }),
      missingImageEnv(),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('rejects a POST with no Origin header', async () => {
    const response = await app.fetch(
      deleteRequest({ 'Content-Type': 'application/json' }),
      missingImageEnv(),
      ctx,
    );

    expect(response.status).toBe(403);
  });

  it('rejects a same-origin JSON route sent as text/plain', async () => {
    const response = await app.fetch(
      deleteRequest({ Origin: ORIGIN, 'Content-Type': 'text/plain' }),
      missingImageEnv(),
      ctx,
    );

    expect(response.status).toBe(415);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('accepts a same-origin JSON POST', async () => {
    const response = await app.fetch(
      deleteRequest({ Origin: ORIGIN, 'Content-Type': 'application/json; charset=utf-8' }),
      missingImageEnv(),
      ctx,
    );

    expect(response.status).toBe(404);
  });

  it('rejects a cross-site multipart upload but accepts a same-origin one', async () => {
    const { env, bucket } = createEnv(recordingIndex().stubFetch, { ACCESS_BYPASS_DEV: 'true' });
    const crossSite = uploadRequest();
    crossSite.headers.set('Origin', 'https://evil.test');

    expect((await app.fetch(crossSite, env, ctx)).status).toBe(403);
    expect(bucket.putKeys).toEqual([]);
    expect((await app.fetch(uploadRequest(), env, ctx)).status).toBe(200);
    expect(bucket.putKeys).toHaveLength(1);
  });
});

describe('admin image update', () => {
  it('forwards only validated editable fields to the index', async () => {
    const doFetch = vi.fn((_request: RequestInfo | URL, init?: RequestInit) =>
      Response.json(imageMeta(JSON.parse(String(init?.body)))),
    );
    const { env } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(
      adminRequest('/_admin/api/images/update', {
        method: 'POST',
        body: JSON.stringify({ id: 'img-1', location: 'FAROE', key: 'images/other.jpg' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      ctx,
    );

    expect(response.ok).toBe(true);
    expect(JSON.parse(String(doFetch.mock.calls[0][1]?.body))).toEqual({
      id: 'img-1',
      location: 'FAROE',
    });
  });

  it('rejects a non-string editable field', async () => {
    const doFetch = vi.fn(() => Response.json({}));
    const { env } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(
      adminRequest('/_admin/api/images/update', {
        method: 'POST',
        body: JSON.stringify({ id: 'img-1', year: 2024 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
      ctx,
    );

    expect(response.status).toBe(400);
    expect(doFetch).not.toHaveBeenCalled();
  });
});

describe('upload validation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['-5', '0'],
    ['NaN', 'abc'],
    ['1e9', '1.5'],
    ['Infinity', '-Infinity'],
  ])('drops invalid width=%s height=%s', async (width, height) => {
    const { added, stubFetch } = recordingIndex();
    const { env } = createEnv(stubFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(uploadRequest({ width, height }), env, ctx);

    expect(response.status).toBe(200);
    expect(added).toHaveLength(1);
    expect(added[0].width).toBeUndefined();
    expect(added[0].height).toBeUndefined();
  });

  it('keeps valid integer dimensions', async () => {
    const { added, stubFetch } = recordingIndex();
    const { env } = createEnv(stubFetch, { ACCESS_BYPASS_DEV: 'true' });

    await app.fetch(uploadRequest({ width: '4000', height: '3000' }), env, ctx);

    expect(added[0]).toMatchObject({ width: 4000, height: 3000 });
  });

  it('rejects files larger than MAX_UPLOAD_BYTES before writing to R2', async () => {
    const { env, bucket } = createEnv(recordingIndex().stubFetch, { ACCESS_BYPASS_DEV: 'true' });
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });

    const response = await app.fetch(uploadRequest({}, big), env, ctx);

    expect(response.status).toBe(413);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(bucket.putKeys).toEqual([]);
  });

  it('rejects an oversized Content-Length without parsing the body', async () => {
    const { env, bucket } = createEnv(recordingIndex().stubFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(
      adminRequest('/_admin/api/upload', {
        method: 'POST',
        body: 'not multipart',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=x',
          'Content-Length': String(MAX_UPLOAD_BYTES * 2),
        },
      }),
      env,
      ctx,
    );

    expect(response.status).toBe(413);
    expect(bucket.putKeys).toEqual([]);
  });
});
