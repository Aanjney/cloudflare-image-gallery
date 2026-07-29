import type { ImageMeta } from '../types';

export type DeleteImageResult =
  | { ok: true; id: string }
  | {
      ok: false;
      stage: 'index' | 'storage';
      id: string;
      error: string;
      detail?: string;
      orphanKey?: string;
    };

// ponytail: 3 immediate retries, no backoff; upgrade to tombstone/reconcile queue if orphans matter
const R2_DELETE_ATTEMPTS = 3;

async function deleteR2Object(bucket: R2Bucket, key: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < R2_DELETE_ATTEMPTS; attempt++) {
    try {
      await bucket.delete(key);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function deleteImage(
  bucket: R2Bucket,
  stub: DurableObjectStub,
  id: string,
  meta: ImageMeta,
): Promise<DeleteImageResult> {
  const delResp = await stub.fetch('https://index/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
  if (!delResp.ok) {
    const detail = await delResp.text();
    return { ok: false, stage: 'index', id, error: 'Failed to remove index', detail };
  }

  try {
    await deleteR2Object(bucket, meta.key);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`orphan R2 object after index delete: id=${id} key=${meta.key}`, detail);
    return {
      ok: false,
      stage: 'storage',
      id,
      error: 'Index removed but storage delete failed',
      detail,
      orphanKey: meta.key,
    };
  }

  return { ok: true, id };
}
