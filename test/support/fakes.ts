import app from '../../src/index';
import { ImageIndex } from '../../src/do/ImageIndex';
import type { Env, ImageMeta } from '../../src/types';

export const ORIGIN = 'https://gallery.test';

const keyOf = (request: RequestInfo | URL) =>
  request instanceof Request ? request.url : String(request);

export class FakeStorage {
  readonly store = new Map<string, unknown>();
  async get<T>(key: string) {
    return structuredClone(this.store.get(key)) as T | undefined;
  }
  async put(key: string, value: unknown) {
    this.store.set(key, structuredClone(value));
  }
  async delete(key: string) {
    return this.store.delete(key);
  }
}

export class FakeCache {
  readonly store = new Map<string, Response>();
  readonly putKeys: string[] = [];
  async match(request: RequestInfo | URL) {
    return this.store.get(keyOf(request))?.clone();
  }
  async put(request: RequestInfo | URL, response: Response) {
    this.putKeys.push(keyOf(request));
    this.store.set(keyOf(request), new Response(await response.arrayBuffer(), response));
  }
  async delete(request: RequestInfo | URL) {
    return this.store.delete(keyOf(request));
  }
}

export type StubFetch = (
  request: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response> | Response;

export const fakeNamespace = (fetch: StubFetch) =>
  ({
    idFromName: () => ({}),
    get: () => ({ fetch }),
  }) as unknown as DurableObjectNamespace;

type IndexHook = (
  path: string,
  forward: () => Promise<Response>,
) => Promise<Response | void> | Response | void;

/** A real ImageIndex behind the worker, with an in-memory R2 bucket. */
export const indexWorld = () => {
  const storage = new FakeStorage();
  const index = new ImageIndex({ storage } as unknown as DurableObjectState, {} as Env);
  const indexCalls: string[] = [];
  let hook: IndexHook | null = null;
  // A real Durable Object handles one request at a time, so serialize like its input gate.
  let gate: Promise<unknown> = Promise.resolve();
  const stubFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(keyOf(input), init);
    const url = new URL(req.url);
    indexCalls.push(url.pathname + url.search);
    const forward = () => {
      const resp = gate.then(() => index.fetch(req));
      gate = resp.catch(() => {});
      return resp;
    };
    const hooked = await hook?.(url.pathname, forward);
    if (hooked) return hooked;
    return forward();
  };

  const r2 = new Map<string, Uint8Array>();
  const r2Puts: string[] = [];
  let r2DeleteCalls = 0;
  let deleteFailures = 0;
  let getHold: Promise<void> | null = null;
  const bucket = {
    async put(key: string) {
      r2Puts.push(key);
      r2.set(key, new Uint8Array([1, 2, 3]));
      return {};
    },
    async head(key: string) {
      return r2.has(key) ? { key } : null;
    },
    async get(key: string) {
      const bytes = r2.get(key);
      if (getHold) {
        const hold = getHold;
        getHold = null;
        await hold;
      }
      if (!bytes) return null;
      return {
        body: new ReadableStream({
          start(c) {
            c.enqueue(bytes);
            c.close();
          },
        }),
        httpEtag: '"e"',
        size: bytes.length,
      };
    },
    async delete(key: string) {
      r2DeleteCalls++;
      if (deleteFailures > 0) {
        deleteFailures--;
        throw new Error('R2 delete failed');
      }
      r2.delete(key);
    },
  };

  const env = {
    IMAGES_BUCKET: bucket as unknown as R2Bucket,
    IMAGE_INDEX: fakeNamespace(stubFetch),
    ACCESS_BYPASS_DEV: 'true',
  } satisfies Env;
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;

  const run = (path: string, init: RequestInit = {}, extraEnv: Partial<Env> = {}) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== 'GET') headers.set('Origin', ORIGIN);
    return app.fetch(
      new Request(ORIGIN + path, { ...init, headers }),
      { ...env, ...extraEnv },
      ctx,
    );
  };

  const seed = async (id: string) => {
    const key = `images/${id}.jpg`;
    r2.set(key, new Uint8Array([9]));
    await index.fetch(
      new Request('https://index/add', {
        method: 'POST',
        body: JSON.stringify({ id, key, createdAt: '2024-01-01T00:00:00Z', size: 1, width: 4000 }),
      }),
    );
  };

  const seedMany = (count: number) => {
    const ids = Array.from({ length: count }, (_, i) => `id-${i}`);
    storage.store.set('order', ids);
    for (const id of ids) {
      storage.store.set(`meta:${id}`, {
        id,
        key: `images/${id}.jpg`,
        createdAt: '2024-01-01T00:00:00Z',
        size: 1,
        contentType: 'image/jpeg',
      } satisfies ImageMeta);
    }
  };

  const del = (id: string) =>
    run('/_admin/api/images/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    });

  const upload = (fields: Record<string, string> = {}, files = 1) => {
    const form = new FormData();
    for (let i = 0; i < files; i++) {
      form.append('file', new File(['png'], `a${i}.png`, { type: 'image/png' }));
    }
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return run('/_admin/api/upload', { method: 'POST', body: form });
  };

  return {
    r2,
    r2Puts,
    indexCalls,
    run,
    seed,
    seedMany,
    del,
    upload,
    flush: () => Promise.all(pending),
    setHook: (h: IndexHook | null) => (hook = h),
    holdNextR2Get: (hold: Promise<void>) => (getHold = hold),
    failR2Deletes: (n: number) => (deleteFailures = n),
    r2DeleteCalls: () => r2DeleteCalls,
    order: () => storage.store.get('order') as string[] | undefined,
  };
};
