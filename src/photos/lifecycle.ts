import { getEdgeCache } from '../app/cache';
import { RETRY_POLICIES, retry } from '../app/retry';
import {
  addImageMeta,
  getImageMeta,
  removeImageMeta,
  updateImageMeta,
  type IndexResult,
} from '../do/client';
import { firstPageCacheKey } from '../domain/contract';
import type { ImageMeta, MetaFields } from '../domain/imageMeta';
import { UPLOAD_WARM_VARIANTS, imagePath, photoCacheKeys } from '../domain/imageVariants';
import type { Env } from '../types';

const UPLOAD_WARM_TIMEOUT_MS = 10_000;

const invalidateFirstPage = (origin: string) =>
  getEdgeCache()
    .delete(firstPageCacheKey(origin))
    .catch(() => {});

type PhotoUpload = {
  file: File;
  ext: string;
  /** The client's id for this photo, reused on every retry of the same upload. */
  uploadId: string | null;
  fields: MetaFields;
  width?: number;
  height?: number;
};

export async function uploadPhoto(
  env: Env,
  origin: string,
  waitUntil: (promise: Promise<unknown>) => void,
  { file, ext, uploadId, fields, width, height }: PhotoUpload,
): Promise<IndexResult<ImageMeta>> {
  const id = uploadId ?? crypto.randomUUID();
  const key = `images/${id}.${ext}`;

  if (uploadId) {
    const existing = await getImageMeta(env, id);
    if (existing.ok && (await env.IMAGES_BUCKET.head(existing.data.key))) {
      // The first attempt landed but its response was lost; the retry carries the latest fields.
      return updatePhoto(env, origin, { id, ...fields });
    }
    if (!existing.ok && existing.kind !== 'notFound') return existing;
  }

  await env.IMAGES_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: fields.alt ? { alt: fields.alt } : undefined,
  });

  const saved = await addImageMeta(env, {
    id,
    key,
    createdAt: new Date().toISOString(),
    size: file.size,
    contentType: file.type,
    width,
    height,
    ...fields,
  });

  if (!saved.ok) {
    await env.IMAGES_BUCKET.delete(key).catch((err) => {
      console.error(`orphan R2 object after failed index add: id=${id} key=${key}`, err);
    });
    return saved;
  }

  waitUntil(
    Promise.allSettled(
      UPLOAD_WARM_VARIANTS.map((variant) =>
        fetch(origin + imagePath(id, variant), {
          cf: { cacheEverything: true, cacheTtl: 86400 },
          signal: AbortSignal.timeout(UPLOAD_WARM_TIMEOUT_MS),
        }),
      ),
    ),
  );
  await invalidateFirstPage(origin);
  return saved;
}

export async function updatePhoto(
  env: Env,
  origin: string,
  update: { id: string } & MetaFields,
): Promise<IndexResult<ImageMeta>> {
  const updated = await updateImageMeta(env, update);
  if (updated.ok) await invalidateFirstPage(origin);
  return updated;
}

type DeletePhotoResult =
  { ok: true } | { ok: false; stage: 'index' | 'storage'; error: string; detail?: string };

/**
 * Deletes the R2 object before the index entry. The index holds the only pointer to the
 * object, so this order leaves every partial failure in a state a retry can finish.
 * Both steps are idempotent: R2 delete of a missing key succeeds, and an index 404 means
 * another request already finished the delete.
 */
export async function deletePhoto(
  env: Env,
  origin: string,
  { id, key }: ImageMeta,
): Promise<DeletePhotoResult> {
  try {
    await retry(() => env.IMAGES_BUCKET.delete(key), RETRY_POLICIES.r2Delete);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`R2 delete failed, index kept for retry: id=${id} key=${key}`, detail);
    return { ok: false, stage: 'storage', error: 'Failed to delete image file', detail };
  }

  const removed = await removeImageMeta(env, id);
  const cache = getEdgeCache();
  // Free-plan Workers allow 50 Cache API calls per request; calls past that fail.
  const targets = [...photoCacheKeys(id, origin), firstPageCacheKey(origin)];
  await Promise.allSettled(targets.map((target) => cache.delete(target)));

  if (!removed.ok && removed.kind !== 'notFound') {
    return { ok: false, stage: 'index', error: 'Failed to remove index', detail: removed.detail };
  }
  return { ok: true };
}
