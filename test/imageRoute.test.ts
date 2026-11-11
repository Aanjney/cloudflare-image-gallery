import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import app from '../src/index';
import type { ImageMeta } from '../src/domain/imageMeta';
import type { Env } from '../src/types';
import { FakeCache, fakeNamespace } from './support/fakes';

const meta: ImageMeta = {
  id: 'img-1',
  key: 'images/img-1.jpg',
  createdAt: '2024-01-01T00:00:00Z',
  size: 1000,
  contentType: 'image/jpeg',
  width: 4000,
};

const env = {
  IMAGES_BUCKET: {
    get: async () => ({ body: new ReadableStream(), httpEtag: '"from-r2"', size: 1000 }),
  } as unknown as R2Bucket,
  IMAGE_INDEX: fakeNamespace((request) =>
    new URL(String(request)).pathname === '/meta/img-1'
      ? Response.json(meta)
      : new Response('not found', { status: 404 }),
  ),
} satisfies Env;

const imgRequest = (query: string, init: RequestInit = {}) =>
  new Request(`https://gallery.test/img/img-1?${query}`, init);

describe('/img transform parameter handling', () => {
  let cache: FakeCache;
  let fetchMock: Mock<any[], Promise<Response>>;
  let pending: Promise<unknown>[];

  beforeEach(() => {
    cache = new FakeCache();
    fetchMock = vi.fn(
      async () => new Response('resized', { headers: { 'Content-Type': 'image/avif' } }),
    );
    pending = [];
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('caches', { default: cache });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const run = async (request: Request) => {
    const executionCtx = {
      waitUntil: (p: Promise<unknown>) => {
        pending.push(p);
      },
      passThroughOnException: () => {},
      props: {},
    };
    const response = await app.fetch(request, env, executionCtx);
    await Promise.all(pending);
    return response;
  };

  const fetchedImageOptions = (index = 0) => {
    const init = fetchMock.mock.calls[index]?.[1] as
      (RequestInit & { cf?: { image?: Record<string, unknown> } }) | undefined;
    return init?.cf?.image;
  };

  it('serves an unsnapped width from the snapped variant cache entry', async () => {
    const headers = { accept: 'image/avif' };
    await run(imgRequest('w=961&q=81&fmt=auto', { headers }));
    const response = await run(imgRequest('w=960&q=80&fmt=auto', { headers }));

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.putKeys).toHaveLength(1);
  });

  it('ignores a forged sec-ch-dpr hint so the cached width stays canonical', async () => {
    await run(
      imgRequest('w=960&q=80&fmt=auto', {
        headers: { accept: 'image/avif', 'sec-ch-dpr': '0.05' },
      }),
    );

    expect(fetchedImageOptions()).toMatchObject({ width: 960 });
  });

  it('does not edge-cache a failed resize fallback', async () => {
    fetchMock.mockImplementation(async () => new Response('upstream fail', { status: 502 }));

    const response = await run(
      imgRequest('w=960&q=80&fmt=auto', {
        headers: { accept: 'image/avif' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(cache.putKeys).toEqual([]);
  });

  it('serves a private R2 fallback when the resize fetch hangs', async () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('', 'TimeoutError')), ms);
      return controller.signal;
    });
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    try {
      const responsePromise = run(
        imgRequest('w=960&q=80&fmt=auto', { headers: { accept: 'image/avif' } }),
      );
      await vi.advanceTimersByTimeAsync(60_000);
      const response = await responsePromise;

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(cache.putKeys).toEqual([]);
    } finally {
      vi.useRealTimers();
      timeoutSpy.mockRestore();
    }
  });

  it('snaps w and q to allowed variants and resolves fmt from Accept', async () => {
    await run(
      imgRequest('w=5000&q=99&fmt=bmp', {
        headers: { accept: 'image/avif' },
      }),
    );

    expect(fetchedImageOptions()).toMatchObject({ width: 1600, quality: 82, format: 'avif' });
  });

  it('snaps a zero width to the smallest variant instead of the original', async () => {
    await run(imgRequest('w=0&q=70&fmt=auto', { headers: { accept: 'image/avif' } }));

    expect(fetchedImageOptions()).toMatchObject({ width: 120, quality: 70 });
  });

  it('chooses the output format explicitly so the cache key and body agree', async () => {
    await run(
      imgRequest('w=960&q=80&fmt=auto', {
        headers: { accept: 'image/avif' },
      }),
    );

    expect(fetchedImageOptions()).toMatchObject({ format: 'avif' });
    expect(cache.putKeys[0]).toMatch(/-avif$/);
  });

  it('keeps explicit fmt=webp for admin thumbs regardless of Accept', async () => {
    await run(
      imgRequest('w=160&q=75&fmt=webp', {
        headers: { accept: 'image/avif' },
      }),
    );

    expect(fetchedImageOptions()).toMatchObject({ width: 160, quality: 75, format: 'webp' });
    expect(cache.putKeys[0]).toMatch(/-webp$/);
  });
});
