import { describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import type { Env, ImageMeta } from '../src/types';

type StubFetch = (request: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response;

class FakeImageIndexNamespace {
  constructor(private readonly stubFetch: StubFetch = () => Response.json({})) {}

  idFromName() {
    return {} as DurableObjectId;
  }

  get() {
    return {
      fetch: this.stubFetch,
    } as DurableObjectStub;
  }
}

class FakeImagesBucket {
  readonly putKeys: string[] = [];
  readonly deleteKeys: string[] = [];

  async put(key: string) {
    this.putKeys.push(key);
    return {} as R2Object;
  }

  async get() {
    return null;
  }

  async delete(key: string) {
    this.deleteKeys.push(key);
  }
}

const createEnv = (
  stubFetch?: StubFetch,
  overrides: Partial<Env> = {},
) => {
  const bucket = new FakeImagesBucket();
  const env = {
    IMAGES_BUCKET: bucket as unknown as R2Bucket,
    IMAGE_INDEX: new FakeImageIndexNamespace(stubFetch) as unknown as DurableObjectNamespace,
    ...overrides,
  } satisfies Env;

  return { env, bucket };
};

const adminRequest = (path: string, init?: RequestInit) =>
  new Request(`https://gallery.test${path}`, init);

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

  it('allows admin requests when ACCESS_BYPASS_DEV is true', async () => {
    const { env } = createEnv(undefined, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(adminRequest('/_admin/ping'), env);

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      admin: true,
    });
  });

  it('rejects unsupported upload image types before writing to R2', async () => {
    const { env, bucket } = createEnv(undefined, { ACCESS_BYPASS_DEV: 'true' });
    const form = new FormData();
    form.set('file', new File(['gif'], 'bad.gif', { type: 'image/gif' }));

    const response = await app.fetch(
      adminRequest('/_admin/api/upload', {
        method: 'POST',
        body: form,
      }),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Only JPEG, PNG, or WebP images are allowed',
    });
    expect(bucket.putKeys).toEqual([]);
    expect(bucket.deleteKeys).toEqual([]);
  });

  it('deletes the uploaded R2 key when metadata recording fails', async () => {
    const doFetch = vi.fn<StubFetch>(() => new Response('DO unavailable', { status: 500 }));
    const { env, bucket } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });
    const form = new FormData();
    form.set('file', new File(['png'], 'photo.png', { type: 'image/png' }));

    const response = await app.fetch(
      adminRequest('/_admin/api/upload', {
        method: 'POST',
        body: form,
      }),
      env,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to record metadata',
      detail: 'DO unavailable',
    });
    expect(bucket.putKeys).toHaveLength(1);
    expect(bucket.putKeys[0]).toMatch(/^images\/.+\.png$/);
    expect(bucket.deleteKeys).toEqual(bucket.putKeys);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('does not delete from R2 when metadata delete fails', async () => {
    const doFetch = vi.fn<StubFetch>((request: RequestInfo | URL) => {
      const url = request instanceof Request ? request.url : request.toString();
      const path = new URL(url).pathname;
      if (path === '/meta/img-1') {
        return Response.json(imageMeta());
      }
      if (path === '/delete') {
        return new Response('delete failed', { status: 500 });
      }
      return new Response('not found', { status: 404 });
    });
    const { env, bucket } = createEnv(doFetch, { ACCESS_BYPASS_DEV: 'true' });

    const response = await app.fetch(
      adminRequest('/_admin/api/images/delete', {
        method: 'POST',
        body: JSON.stringify({ id: 'img-1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      env,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Failed to remove index',
      detail: 'delete failed',
    });
    expect(bucket.deleteKeys).toEqual([]);
  });
});
