import { RETRY_POLICIES, TimeoutError, retry, type RetryPolicy } from '../app/retry';
import type { MetaFields } from '../domain/imageMeta';
import type { ImageMeta } from '../domain/imageMeta';
import type { Env, ListResponse, StatsResponse } from '../types';
import { INDEX_PATHS } from './ImageIndex';

export type IndexFailure = { kind: 'notFound' | 'full' | 'unavailable'; detail: string };

export type IndexResult<T> = { ok: true; data: T } | ({ ok: false } & IndexFailure);

const failureKind = (status: number): IndexFailure['kind'] => {
  if (status === 404) return 'notFound';
  if (status === 409) return 'full';
  return 'unavailable';
};

// https://developers.cloudflare.com/durable-objects/best-practices/error-handling/
const isRetryableIndexError = (err: unknown): boolean => {
  if (err instanceof TimeoutError) return true;
  const flags = err as { retryable?: unknown; overloaded?: unknown } | null;
  return flags?.retryable === true && !flags.overloaded;
};

const call = async <T>(
  env: Env,
  path: string,
  policy: RetryPolicy,
  init?: RequestInit,
): Promise<IndexResult<T>> => {
  // A stub can stay broken after it throws, so each attempt gets a new one.
  const stub = () => env.IMAGE_INDEX.get(env.IMAGE_INDEX.idFromName('global'));
  try {
    const resp = await retry(() => stub().fetch(`https://index${path}`, init), {
      ...policy,
      label: `index ${path}`,
      retryOn: isRetryableIndexError,
    });
    if (!resp.ok) return { ok: false, kind: failureKind(resp.status), detail: await resp.text() };
    return { ok: true, data: (await resp.json()) as T };
  } catch (err) {
    return {
      ok: false,
      kind: 'unavailable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
};

const write = <T>(env: Env, path: string, body: unknown) =>
  call<T>(env, path, RETRY_POLICIES.indexWrite, { method: 'POST', body: JSON.stringify(body) });

export const getImageMeta = (env: Env, id: string) =>
  call<ImageMeta>(env, INDEX_PATHS.meta + encodeURIComponent(id), RETRY_POLICIES.indexRead);

export const getIndexStats = (env: Env) =>
  call<StatsResponse>(env, INDEX_PATHS.stats, RETRY_POLICIES.indexRead);

type ListQuery = { cursor?: string; limit?: string | number; q?: string };

export const listImages = (env: Env, { cursor, limit, q }: ListQuery) => {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (limit) query.set('limit', String(limit));
  if (q) query.set('q', q);
  return call<ListResponse>(env, `${INDEX_PATHS.list}?${query}`, RETRY_POLICIES.indexList);
};

export const addImageMeta = (env: Env, meta: ImageMeta) =>
  write<ImageMeta>(env, INDEX_PATHS.add, meta);

export const updateImageMeta = (env: Env, update: { id: string } & MetaFields) =>
  write<ImageMeta>(env, INDEX_PATHS.update, update);

export const removeImageMeta = (env: Env, id: string) =>
  write<{ ok: true }>(env, INDEX_PATHS.delete, { id });
