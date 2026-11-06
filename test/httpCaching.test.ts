import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import app from '../src/index';
import type { Env, ImageMeta } from '../src/types';
import { FakeCache, ORIGIN, fakeNamespace } from './support/fakes';

const ONE_YEAR = 31536000;
const ONE_DAY = 86400;

const meta = (partial: Partial<ImageMeta> = {}): ImageMeta => ({
  id: 'img-1',
  key: 'images/img-1.jpg',
  createdAt: '2024-01-01T00:00:00Z',
  size: 1000,
  contentType: 'image/jpeg',
  width: 4000,
  ...partial,
});

const makeIndex = () => {
  const calls: string[] = [];
  const fetch = async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    calls.push(url.pathname);
    switch (url.pathname) {
      case '/meta/img-1':
        return Response.json(meta());
      case '/list':
        return Response.json({ items: [meta()], cursor: null });
      case '/add':
      case '/update':
        return Response.json({ ...meta(), ...JSON.parse(String(init?.body ?? '{}')) });
      case '/delete':
        return Response.json({ ok: true });
      default:
        return new Response('not found', { status: 404 });
    }
  };
  return { calls, namespace: fakeNamespace(fetch) };
};

const makeEnv = (index: ReturnType<typeof makeIndex>) =>
  ({
    IMAGES_BUCKET: {
      get: vi.fn(async () => ({
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
        httpEtag: '"r2-etag"',
        size: 3,
      })),
      put: vi.fn(async () => ({})),
      delete: vi.fn(async () => {}),
    } as unknown as R2Bucket,
    IMAGE_INDEX: index.namespace,
    ACCESS_BYPASS_DEV: 'true',
  }) satisfies Env;

const directives = (response: Response) => {
  const out = new Map<string, string | true>();
  for (const part of (response.headers.get('Cache-Control') ?? '').split(',')) {
    const [name, value] = part.trim().toLowerCase().split('=');
    if (name) out.set(name, value ?? true);
  }
  return out;
};

const adminPost = (path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    body,
    headers: { Origin: ORIGIN, ...headers },
  });

const jsonPost = (path: string, body: unknown) =>
  adminPost(path, JSON.stringify(body), { 'Content-Type': 'application/json' });

describe('HTTP caching', () => {
  let cache: FakeCache;
  let resizeFetch: Mock<any[], Promise<Response>>;
  let index: ReturnType<typeof makeIndex>;
  let env: ReturnType<typeof makeEnv>;
  let pending: Promise<unknown>[];

  const send = async (request: Request) => {
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void pending.push(p),
      passThroughOnException: () => {},
      props: {},
    } as unknown as ExecutionContext;
    const response = await app.fetch(request, env, ctx);
    await Promise.all(pending);
    pending = [];
    return response;
  };

  const get = (path: string, headers: Record<string, string> = {}) =>
    send(new Request(`${ORIGIN}${path}`, { headers }));

  const listCalls = () => index.calls.filter((p) => p === '/list').length;

  beforeEach(() => {
    cache = new FakeCache();
    resizeFetch = vi.fn(
      async () => new Response('resized', { headers: { 'Content-Type': 'image/avif' } }),
    );
    index = makeIndex();
    env = makeEnv(index);
    pending = [];
    vi.stubGlobal('fetch', resizeFetch);
    vi.stubGlobal('caches', { default: cache });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('revalidation on edge cache hits', () => {
    const IMG = '/img/img-1?w=960&q=80&fmt=auto';

    it('answers a matching If-None-Match on a cached /img with 304 and no body', async () => {
      const first = await get(IMG, { accept: 'image/avif' });
      const etag = first.headers.get('ETag');
      expect(etag).toBeTruthy();

      const second = await get(IMG, { accept: 'image/avif', 'if-none-match': etag! });

      expect(resizeFetch).toHaveBeenCalledTimes(1);
      expect(second.status).toBe(304);
      expect(second.headers.get('ETag')).toBe(etag);
      expect(await second.text()).toBe('');
    });

    it('answers a matching weak If-None-Match on a cached /img with 304', async () => {
      const etag = (await get(IMG, { accept: 'image/avif' })).headers.get('ETag')!;
      const second = await get(IMG, { accept: 'image/avif', 'if-none-match': `W/${etag}` });
      expect(second.status).toBe(304);
    });

    it('returns the full cached /img when If-None-Match does not match', async () => {
      await get(IMG, { accept: 'image/avif' });
      const second = await get(IMG, { accept: 'image/avif', 'if-none-match': '"stale"' });

      expect(second.status).toBe(200);
      expect(await second.text()).toBe('resized');
    });

    it('answers a matching If-None-Match on a cached /media original with 304', async () => {
      const first = await get('/media/img-1');
      const etag = first.headers.get('ETag')!;
      const metaLookups = index.calls.length;

      const second = await get('/media/img-1', { 'if-none-match': etag });

      expect(second.status).toBe(304);
      expect(second.headers.get('ETag')).toBe(etag);
      expect(index.calls.length).toBe(metaLookups);
    });
  });

  describe('image lifetimes', () => {
    for (const [name, path] of [
      ['/img', '/img/img-1?w=960&q=80&fmt=auto'],
      ['/media', '/media/img-1'],
    ] as const) {
      it(`lets browsers keep ${name} responses for a year without revalidating`, async () => {
        const cc = directives(await get(path, { accept: 'image/avif' }));

        expect(cc.get('public')).toBe(true);
        expect(cc.get('max-age')).toBe(String(ONE_YEAR));
        expect(cc.get('immutable')).toBe(true);
        expect(cc.has('stale-while-revalidate')).toBe(false);
      });

      it(`bounds how long the edge keeps ${name} responses to one day`, async () => {
        const sMaxAge = Number(
          directives(await get(path, { accept: 'image/avif' })).get('s-maxage'),
        );

        expect(sMaxAge).toBeGreaterThan(0);
        expect(sMaxAge).toBeLessThanOrEqual(ONE_DAY);
      });

      it(`keeps the year-long browser lifetime on ${name} 304 responses`, async () => {
        const etag = (await get(path, { accept: 'image/avif' })).headers.get('ETag')!;
        const revalidated = await get(path, { accept: 'image/avif', 'if-none-match': etag });

        expect(revalidated.status).toBe(304);
        expect(directives(revalidated).get('max-age')).toBe(String(ONE_YEAR));
      });
    }
  });

  describe('Vary', () => {
    it('does not vary /media originals on Accept, since their bytes never change', async () => {
      const vary = (await get('/media/img-1', { accept: 'image/avif' })).headers.get('Vary') ?? '';
      expect(vary.toLowerCase()).not.toContain('accept');
    });

    it('varies negotiated /img responses on Accept', async () => {
      const vary = (
        await get('/img/img-1?w=960&q=80&fmt=auto', { accept: 'image/avif' })
      ).headers.get('Vary');
      expect(vary?.toLowerCase()).toContain('accept');
    });
  });

  describe('gallery HTML', () => {
    it('tells browsers to revalidate the page on every visit', async () => {
      expect(directives(await get('/')).get('no-cache')).toBe(true);
    });
  });

  describe('photo list edge cache', () => {
    const FIRST_PAGE = '/api/images?limit=200';

    it('serves a repeat first-page request from the edge without reading the index', async () => {
      const first = await get(FIRST_PAGE);
      const second = await get(FIRST_PAGE);

      expect(listCalls()).toBe(1);
      expect(await second.json()).toEqual(await first.json());
    });

    it('keeps the browser lifetime of the photo list short', async () => {
      const maxAge = Number(directives(await get(FIRST_PAGE)).get('max-age'));
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(60);
    });

    it('never caches search results', async () => {
      const first = await get('/api/images?q=faroe');
      await get('/api/images?q=faroe');

      expect(listCalls()).toBe(2);
      expect(directives(first).get('no-store')).toBe(true);
    });

    it('reads later cursor pages from the index every time', async () => {
      await get('/api/images?limit=200&cursor=200');
      await get('/api/images?limit=200&cursor=200');
      expect(listCalls()).toBe(2);
    });

    it('drops the cached list after an upload', async () => {
      await get(FIRST_PAGE);
      const form = new FormData();
      form.set('file', new File(['png'], 'photo.png', { type: 'image/png' }));
      expect((await send(adminPost('/_admin/api/upload', form))).ok).toBe(true);

      await get(FIRST_PAGE);
      expect(listCalls()).toBe(2);
    });

    it('drops the cached list after a metadata edit', async () => {
      await get(FIRST_PAGE);
      const edited = await send(
        jsonPost('/_admin/api/images/update', { id: 'img-1', location: 'Faroe Islands' }),
      );
      expect(edited.ok).toBe(true);

      await get(FIRST_PAGE);
      expect(listCalls()).toBe(2);
    });

    it('drops the cached list after a delete', async () => {
      await get(FIRST_PAGE);
      expect((await send(jsonPost('/_admin/api/images/delete', { id: 'img-1' }))).ok).toBe(true);

      await get(FIRST_PAGE);
      expect(listCalls()).toBe(2);
    });
  });
});
