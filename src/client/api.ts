export function imagesListUrl(params: { limit?: number; cursor?: string; q?: string } = {}): string {
  const search = new URLSearchParams();
  if (params.limit != null) search.set('limit', String(params.limit));
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.q) search.set('q', params.q);
  const query = search.toString();
  return query ? `/api/images?${query}` : '/api/images';
}

export function adminUploadUrl(adminPrefix: string): string {
  return `${adminPrefix}/api/upload`;
}

export function adminDeleteUrl(adminPrefix: string): string {
  return `${adminPrefix}/api/images/delete`;
}

export function adminUpdateUrl(adminPrefix: string): string {
  return `${adminPrefix}/api/images/update`;
}

export function mediaPageUrl(origin: string, id: string): string {
  return `${origin}/media/${id}`;
}
