export const getEdgeCache = () => (caches as unknown as { default: Cache }).default;

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
