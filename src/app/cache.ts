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

const formatPref = (accept: string | undefined): string => {
  if (accept?.includes('image/avif')) return 'avif';
  if (accept?.includes('image/webp')) return 'webp';
  return 'jpeg';
};

export const buildCacheKey = (url: string, accept?: string): Request => {
  const u = new URL(url);
  u.searchParams.set('_accept', formatPref(accept));
  return new Request(u.toString());
};
