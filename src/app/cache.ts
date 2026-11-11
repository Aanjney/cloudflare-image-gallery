const noopCache: Cache = {
  match: async () => undefined,
  put: async () => {},
  delete: async () => false,
  add: async () => {},
  addAll: async () => {},
  keys: async () => [],
  matchAll: async () => [],
};

export const getEdgeCache = (): Cache =>
  (globalThis as { caches?: { default?: Cache } }).caches?.default ?? noopCache;

/**
 * Puts, then deletes the entry again if the image left the index meanwhile. A delete
 * removes the index entry before it purges, so either this re-check sees the removal or
 * the purge runs after this put. The put must finish before the re-check starts.
 */
export const putWhileIndexed = async (
  cache: Cache,
  key: Request,
  response: Response,
  isIndexed: () => Promise<boolean>,
): Promise<void> => {
  await cache.put(key, response);
  if (!(await isIndexed().catch(() => false))) await cache.delete(key);
};
