import type { Hono } from 'hono';
import type { Env, ImageMeta, ListResponse, StatsResponse } from '../types';
import type { ImageMetaUpdate } from './parseRequest';
import { TimeoutError, retry, withTimeout } from './retry';

export type GalleryApp = Hono<{ Bindings: Env }>;

export const getIndexStub = (env: Env) => {
  const id = env.IMAGE_INDEX.idFromName('global');
  return env.IMAGE_INDEX.get(id);
};

/** `status` is 0 when the index threw instead of answering. `notFound` is the index's own 404. */
export type IndexResult<T> =
  { ok: true; data: T } | { ok: false; notFound: boolean; status: number; detail: string };

const INDEX_READ_TIMEOUT_MS = 5000;
const INDEX_BACKOFF = { baseMs: 100, capMs: 1000 };

// https://developers.cloudflare.com/durable-objects/best-practices/error-handling/
const isRetryableIndexError = (err: unknown): boolean => {
  if (err instanceof TimeoutError) return true;
  const flags = err as { retryable?: unknown; overloaded?: unknown } | null;
  return flags?.retryable === true && !flags.overloaded;
};

const settle = async <T>(send: () => Promise<Response>): Promise<IndexResult<T>> => {
  try {
    const resp = await send();
    if (!resp.ok) {
      return {
        ok: false,
        notFound: resp.status === 404,
        status: resp.status,
        detail: await resp.text(),
      };
    }
    return { ok: true, data: (await resp.json()) as T };
  } catch (err) {
    return {
      ok: false,
      notFound: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
};

const readIndex = <T>(env: Env, path: string, attempts = 3) =>
  settle<T>(() =>
    retry(
      () =>
        withTimeout(
          getIndexStub(env).fetch(`https://index${path}`),
          INDEX_READ_TIMEOUT_MS,
          `index ${path}`,
        ),
      { attempts, ...INDEX_BACKOFF, retryOn: isRetryableIndexError },
    ),
  );

// Writes are not raced against a timeout: an abandoned write can still land after we give up.
const writeIndex = <T>(env: Env, path: string, body: unknown) =>
  settle<T>(() =>
    retry(
      () =>
        getIndexStub(env).fetch(`https://index${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      { attempts: 2, ...INDEX_BACKOFF, retryOn: isRetryableIndexError },
    ),
  );

export const getImageMeta = (env: Env, id: string) => readIndex<ImageMeta>(env, `/meta/${id}`);

export const getIndexStats = (env: Env) => readIndex<StatsResponse>(env, '/stats');

export const listImages = (env: Env, query: URLSearchParams) =>
  readIndex<ListResponse>(env, `/list?${query.toString()}`, 2);

export const addImageMeta = (env: Env, meta: ImageMeta) => writeIndex<ImageMeta>(env, '/add', meta);

export const updateImageMeta = (env: Env, update: ImageMetaUpdate) =>
  writeIndex<ImageMeta>(env, '/update', update);

export const removeImageMeta = (env: Env, id: string) =>
  writeIndex<{ ok: true }>(env, '/delete', { id });
