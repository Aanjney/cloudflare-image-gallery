import { retry } from '../app/retry';
import { removeImageMeta } from '../app/worker';
import type { Env, ImageMeta } from '../types';

export type DeleteImageResult =
  | { ok: true; id: string }
  | { ok: false; stage: 'index' | 'storage'; id: string; error: string; detail?: string };

export const R2_DELETE_ATTEMPTS = 3;

/**
 * Deletes the R2 object before the index entry. The index holds the only pointer to the
 * object, so this order leaves every partial failure in a state a retry can finish.
 * Both steps are idempotent: R2 delete of a missing key succeeds, and an index 404 means
 * another request already finished the delete.
 */
export async function deleteImage(env: Env, meta: ImageMeta): Promise<DeleteImageResult> {
  const { id, key } = meta;
  try {
    await retry(() => env.IMAGES_BUCKET.delete(key), {
      attempts: R2_DELETE_ATTEMPTS,
      baseMs: 100,
      capMs: 1000,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`R2 delete failed, index kept for retry: id=${id} key=${key}`, detail);
    return { ok: false, stage: 'storage', id, error: 'Failed to delete image file', detail };
  }

  const removed = await removeImageMeta(env, id);
  if (!removed.ok && !removed.notFound) {
    return {
      ok: false,
      stage: 'index',
      id,
      error: 'Failed to remove index',
      detail: removed.detail,
    };
  }
  return { ok: true, id };
}
