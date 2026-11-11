/** URLs and limits the Worker serves and the browser scripts request. Both sides import them from here. */

export const PUBLIC_PATHS = {
  images: '/api/images',
  media: '/media/',
  img: '/img/',
} as const;

/** Relative to the admin prefix. */
export const ADMIN_API_PATHS = {
  upload: '/api/upload',
  update: '/api/images/update',
  delete: '/api/images/delete',
  stats: '/api/stats',
} as const;

export const LIST_LIMITS = {
  defaultPageSize: 20,
  maxPageSize: 500,
  maxPhotos: 5000,
} as const;

/** The gallery's first request. It is preloaded by the page and edge-cached, so every use must match exactly. */
export const GALLERY_FIRST_PAGE_PATH = `${PUBLIC_PATHS.images}?limit=200`;

export const firstPageCacheKey = (origin: string): string => origin + GALLERY_FIRST_PAGE_PATH;
