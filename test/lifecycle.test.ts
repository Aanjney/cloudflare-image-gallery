import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETRY_POLICIES } from '../src/app/retry';
import { LIST_LIMITS } from '../src/domain/contract';
import type { ImageMeta } from '../src/domain/imageMeta';
import { ORIGIN, indexWorld as world } from './support/fakes';

const UPLOAD_ID = '0b7c6f8e-3d2a-4c1b-9e8f-1a2b3c4d5e6f';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('delete converges after partial failure', () => {
  it('a retry finishes a delete whose R2 step failed', async () => {
    const w = world();
    await w.seed('d1');
    w.failR2Deletes(RETRY_POLICIES.r2Delete.attempts);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await w.del('d1');
    expect(first.status).toBe(500);

    w.failR2Deletes(0);
    const retry = await w.del('d1');
    expect(retry.status).toBe(200);
    expect(w.r2.has('images/d1.jpg')).toBe(false);
    expect(w.order()).toEqual([]);
  });

  it('a retry finishes a delete whose index step failed after R2 was removed', async () => {
    const w = world();
    await w.seed('d2');
    w.setHook((path) => (path === '/delete' ? new Response('boom', { status: 500 }) : undefined));

    const first = await w.del('d2');
    expect(first.status).toBe(500);
    expect(w.r2.has('images/d2.jpg')).toBe(false);

    w.setHook(null);
    const retry = await w.del('d2');
    expect(retry.status).toBe(200);
    expect(w.order()).toEqual([]);
  });

  it('two concurrent deletes of the same photo both succeed', async () => {
    const w = world();
    await w.seed('d3');

    const [a, b] = await Promise.all([w.del('d3'), w.del('d3')]);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(w.r2.has('images/d3.jpg')).toBe(false);
  });

  it('stays within the 50 Cache API and subrequest budget when R2 needs every retry', async () => {
    const w = world();
    await w.seed('d4');
    let cacheDeletes = 0;
    vi.stubGlobal('caches', {
      default: {
        match: async () => undefined,
        put: async () => {},
        delete: async () => {
          cacheDeletes++;
          return true;
        },
      },
    });
    w.failR2Deletes(RETRY_POLICIES.r2Delete.attempts - 1);

    const resp = await w.del('d4');

    expect(resp.status).toBe(200);
    expect(cacheDeletes).toBeGreaterThan(0);
    expect(cacheDeletes + w.r2DeleteCalls()).toBeLessThanOrEqual(50);
  });
});

describe('upload', () => {
  it('removes the R2 object when the index add throws', async () => {
    const w = world();
    w.setHook((path) => {
      if (path === '/add') throw new Error('DO reset');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const resp = await w.upload();

    expect(resp.status).toBe(503);
    expect(w.r2Puts).toHaveLength(1);
    expect(w.r2.size).toBe(0);
  });

  it('rejects more than one file per request before writing to R2', async () => {
    const w = world();

    const resp = await w.upload({}, 2);

    expect(resp.status).toBe(400);
    expect(w.r2Puts).toEqual([]);
  });

  it('uses uploadId as the image id and does not duplicate on a retried upload', async () => {
    const w = world();

    const first = await w.upload({ uploadId: UPLOAD_ID });
    const second = await w.upload({ uploadId: UPLOAD_ID });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = (await first.json()) as { image: ImageMeta };
    const b = (await second.json()) as { ok: boolean; image: ImageMeta };
    expect(a.image.id).toBe(UPLOAD_ID);
    expect(b).toEqual({ ok: true, image: a.image });
    expect(w.order()).toEqual([UPLOAD_ID]);
    expect(w.r2Puts).toEqual([`images/${UPLOAD_ID}.png`]);
  });

  it('rewrites R2 on a retry when the index entry exists but the object is missing', async () => {
    const w = world();
    await w.upload({ uploadId: UPLOAD_ID });
    w.r2.clear();

    const retry = await w.upload({ uploadId: UPLOAD_ID });

    expect(retry.status).toBe(200);
    expect(w.r2.has(`images/${UPLOAD_ID}.png`)).toBe(true);
    expect(w.order()).toEqual([UPLOAD_ID]);
  });

  it('repairs a lost index-add response when the client retries with the same uploadId', async () => {
    const w = world();
    let lost = false;
    w.setHook(async (path, forward) => {
      if (path === '/add' && !lost) {
        lost = true;
        await forward();
        throw new Error('response lost after the add committed');
      }
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const first = await w.upload({ uploadId: UPLOAD_ID });
    expect(first.status).toBe(503);
    expect(w.order()).toEqual([UPLOAD_ID]);
    expect((await w.run(`/media/${UPLOAD_ID}`)).status).toBe(404);

    const retry = await w.upload({ uploadId: UPLOAD_ID });

    expect(retry.status).toBe(200);
    expect(w.order()).toEqual([UPLOAD_ID]);
    expect((await w.run(`/media/${UPLOAD_ID}`)).status).toBe(200);
  });

  it.each(['not-a-uuid', `${UPLOAD_ID}x`, '../../etc', UPLOAD_ID.toUpperCase() + ' '])(
    'rejects malformed uploadId %j',
    async (uploadId) => {
      const w = world();

      const resp = await w.upload({ uploadId });

      expect(resp.status).toBe(400);
      expect(w.r2Puts).toEqual([]);
    },
  );

  it('keeps fields edited before a retry of an upload that already landed', async () => {
    const w = world();
    await w.upload({ uploadId: UPLOAD_ID, location: 'LISBON' });

    const retry = await w.upload({ uploadId: UPLOAD_ID, location: 'PORTO' });

    expect(((await retry.json()) as { image: ImageMeta }).image.location).toBe('PORTO');
    const listed = (await (await w.run('/api/images?q=porto')).json()) as { items: ImageMeta[] };
    expect(listed.items.map((i) => i.id)).toEqual([UPLOAD_ID]);
    expect(w.r2Puts).toHaveLength(1);
  });

  it('generates a server id when uploadId is absent', async () => {
    const w = world();

    const resp = await w.upload();

    const body = (await resp.json()) as { image: ImageMeta };
    expect(body.image.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('explains a full archive with 409 and removes the R2 object', async () => {
    const w = world();
    w.seedMany(LIST_LIMITS.maxPhotos);

    const resp = await w.upload();

    expect(resp.status).toBe(409);
    await expect(resp.json()).resolves.toEqual({
      error: `The archive is full (${LIST_LIMITS.maxPhotos} photos). Delete some photos before uploading more.`,
    });
    expect(w.r2.size).toBe(0);
  });

  it('warms variants with a bounded fetch', async () => {
    const w = world();
    const fetchSpy = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchSpy);

    await w.upload();

    expect(fetchSpy).toHaveBeenCalled();
    for (const call of fetchSpy.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect(call[1].signal).toBeInstanceOf(AbortSignal);
    }
  });
});

describe('index reads', () => {
  it('retries a retryable DO error', async () => {
    const w = world();
    await w.seed('r1');
    let thrown = 0;
    w.setHook((path) => {
      if (path === '/meta/r1' && thrown++ === 0) {
        throw Object.assign(new Error('DO reset'), { retryable: true });
      }
    });

    const resp = await w.del('r1');

    expect(resp.status).toBe(200);
    expect(w.indexCalls.filter((p) => p === '/meta/r1')).toHaveLength(2);
  });

  it('does not retry an overloaded DO', async () => {
    const w = world();
    await w.seed('r2');
    w.setHook((path) => {
      if (path === '/meta/r2') {
        throw Object.assign(new Error('overloaded'), { retryable: true, overloaded: true });
      }
    });

    await w.del('r2');

    expect(w.indexCalls.filter((p) => p === '/meta/r2')).toHaveLength(1);
  });

  it('times out a hung DO read and retries it', async () => {
    vi.useFakeTimers();
    try {
      const w = world();
      await w.seed('r3');
      let calls = 0;
      w.setHook((path) => {
        if (path === '/meta/r3' && calls++ === 0) return new Promise<Response>(() => {});
      });

      const pending = w.del('r3');
      await vi.advanceTimersByTimeAsync(7000);
      const resp = await pending;

      expect(resp.status).toBe(200);
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('index outage', () => {
  const failMetaReads = (w: ReturnType<typeof world>) =>
    w.setHook((path) => {
      if (path.startsWith('/meta/')) throw new Error('DO reset');
    });

  it('answers a delete with 503 and keeps the photo when the meta read fails', async () => {
    const w = world();
    await w.seed('o1');
    failMetaReads(w);

    const resp = await w.del('o1');

    expect(resp.status).toBe(503);
    expect(resp.headers.get('Cache-Control')).toBe('private, no-store');
    expect(w.r2.has('images/o1.jpg')).toBe(true);
    expect(w.order()).toEqual(['o1']);
  });

  it('answers a delete with 404 when the index has no such photo', async () => {
    const w = world();

    const resp = await w.del('missing');

    expect(resp.status).toBe(404);
  });

  it.each(['/media/o2', '/img/o2?w=400'])(
    'answers GET %s with an uncacheable 503 when the meta read fails',
    async (path) => {
      const w = world();
      await w.seed('o2');
      failMetaReads(w);

      const resp = await w.run(path);

      expect(resp.status).toBe(503);
      expect(resp.headers.get('Cache-Control')).toBe('private, no-store');
    },
  );

  it('answers an upload retry with 503 when the uploadId check fails', async () => {
    const w = world();
    failMetaReads(w);

    const resp = await w.upload({ uploadId: UPLOAD_ID });

    expect(resp.status).toBe(503);
    expect(w.r2Puts).toEqual([]);
  });
});

describe('index failure reporting', () => {
  it('logs the failure detail that the 503 body leaves out', async () => {
    const w = world();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    w.setHook((path) =>
      path === '/stats' ? new Response('disk on fire', { status: 500 }) : undefined,
    );

    const resp = await w.run('/_admin/api/stats');

    expect(resp.status).toBe(503);
    expect(log.mock.calls.flat().join(' ')).toContain('disk on fire');
  });

  it('keeps a photo id inside the meta lookup even when it contains a path', async () => {
    const w = world();

    const resp = await w.run('/media/..%2Fstats');

    expect(resp.status).toBe(404);
    expect(w.indexCalls).not.toContain('/stats');
  });
});

describe('update', () => {
  it('answers 404 for a photo that is not in the index', async () => {
    const w = world();

    const resp = await w.run('/_admin/api/images/update', {
      method: 'POST',
      body: JSON.stringify({ id: 'gone', location: 'FAROE' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(resp.status).toBe(404);
  });
});

describe('admin path boundary', () => {
  it('serves public routes that share the ADMIN_PATH prefix', async () => {
    const w = world();
    await w.seed('m1');

    const media = await w.run('/media/m1', {}, { ADMIN_PATH: '/m' });
    const ping = await w.run('/m/ping', {}, { ADMIN_PATH: '/m' });
    const root = await w.run('/m', {}, { ADMIN_PATH: '/m' });

    expect(media.status).toBe(200);
    expect(ping.status).toBe(200);
    expect(root.status).toBe(301);
    expect(root.headers.get('location')).toBe('/m/');
  });
});

describe('sitemap', () => {
  it('lists at most 500 photos with one index call', async () => {
    const w = world();
    w.seedMany(600);

    const resp = await w.run('/sitemap.xml');
    const xml = await resp.text();

    expect(resp.status).toBe(200);
    expect(xml.match(/<url>/g)).toHaveLength(500);
    expect(w.indexCalls.filter((p) => p.startsWith('/list'))).toHaveLength(1);
  });

  it('returns 503 with Retry-After when the index list fails', async () => {
    const w = world();
    w.setHook((path) => (path === '/list' ? new Response('down', { status: 500 }) : undefined));

    const resp = await w.run('/sitemap.xml');

    expect(resp.status).toBe(503);
    expect(resp.headers.get('Retry-After')).toBeTruthy();
  });
});
