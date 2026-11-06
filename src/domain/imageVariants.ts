export type ImageFormat = 'auto' | 'webp';

export type ImageVariant = {
  width: number;
  quality: number;
  format: ImageFormat;
};

export const FORMAT_VARIANTS = ['avif', 'webp', 'jpeg'] as const;

export type OutputFormat = (typeof FORMAT_VARIANTS)[number];

export const DEFAULT_QUALITY = 85;

export const GALLERY_GRID_DEFAULT_VARIANT: ImageVariant = {
  width: 960,
  quality: 80,
  format: 'auto',
};

export const GALLERY_GRID_VARIANTS: ImageVariant[] = [
  { width: 240, quality: 75, format: 'auto' },
  { width: 320, quality: 78, format: 'auto' },
  { width: 480, quality: 78, format: 'auto' },
  { width: 720, quality: 80, format: 'auto' },
  GALLERY_GRID_DEFAULT_VARIANT,
  { width: 1200, quality: 80, format: 'auto' },
  { width: 1600, quality: 82, format: 'auto' },
];

export const CAROUSEL_DEFAULT_VARIANT: ImageVariant = {
  width: 1600,
  quality: 85,
  format: 'auto',
};

export const CAROUSEL_VARIANTS: ImageVariant[] = [
  { width: 800, quality: 85, format: 'auto' },
  { width: 1200, quality: 85, format: 'auto' },
  CAROUSEL_DEFAULT_VARIANT,
];

export const ADMIN_THUMB_VARIANT: ImageVariant = {
  width: 160,
  quality: 75,
  format: 'webp',
};

export const ADMIN_BACKFILL_VARIANT: ImageVariant = {
  width: 120,
  quality: 70,
  format: 'auto',
};

export const UPLOAD_WARM_VARIANTS: ImageVariant[] = [
  { width: 240, quality: 75, format: 'auto' },
  { width: 480, quality: 78, format: 'auto' },
  { width: 800, quality: 80, format: 'auto' },
  { width: 1200, quality: 80, format: 'auto' },
];

const ALL_VARIANTS: ImageVariant[] = [
  ...GALLERY_GRID_VARIANTS,
  ...CAROUSEL_VARIANTS,
  ADMIN_THUMB_VARIANT,
  ADMIN_BACKFILL_VARIANT,
  ...UPLOAD_WARM_VARIANTS,
];

const ALLOWED_WIDTHS = [...new Set(ALL_VARIANTS.map((variant) => variant.width))].sort(
  (a, b) => a - b,
);

const snapToNearest = (value: number, allowed: readonly number[]): number => {
  let nearest = allowed[0];
  let distance = Math.abs(value - nearest);
  for (const candidate of allowed) {
    const candidateDistance = Math.abs(value - candidate);
    if (candidateDistance < distance) {
      nearest = candidate;
      distance = candidateDistance;
    }
  }
  return nearest;
};

export type VariantSize = { width: number | undefined; quality: number };

const ORIGINAL_SIZE: VariantSize = { width: undefined, quality: DEFAULT_QUALITY };

/**
 * Maps any requested width and quality to a size in the variant registry, so every
 * cache key /img can write is one that `purgeImageCacheTargets` deletes.
 */
export const snapVariant = (
  width: number | undefined,
  quality: number = DEFAULT_QUALITY,
): VariantSize => {
  if (width === undefined) return ORIGINAL_SIZE;
  const snappedWidth = snapToNearest(width, ALLOWED_WIDTHS);
  const qualities = ALL_VARIANTS.filter((v) => v.width === snappedWidth).map((v) => v.quality);
  return { width: snappedWidth, quality: snapToNearest(quality, qualities) };
};

export const imagePath = (id: string, variant: ImageVariant) =>
  `/img/${id}?w=${variant.width}&q=${variant.quality}&fmt=${variant.format}`;

/** JS snippet defining `imageUrl(id, variant)`. It must stay aligned with `imagePath`. */
export const buildBrowserImageUrlHelper = () =>
  `var imageUrl = function(id, variant) {
    return '/img/' + id + '?w=' + variant.width + '&q=' + variant.quality + '&fmt=' + variant.format;
  };`;

export type ImageCacheKeyParts = {
  id: string;
  width: number | undefined;
  quality: number;
  format: OutputFormat;
};

export const mediaCacheKey = (origin: string, id: string): string => `${origin}/media/${id}`;

export const imageCacheKey = (origin: string, key: ImageCacheKeyParts): string =>
  `${origin}/img/${key.id}?w=${key.width ?? 'orig'}&q=${key.quality}&_accept=${key.format}`;

/** The gallery's first photo-list page, the only list response kept in the edge cache. */
export const GALLERY_FIRST_PAGE_PATH = '/api/images?limit=200';

// Free-plan Workers allow 50 Cache API calls per request; calls past that fail.
export const CACHE_API_CALL_BUDGET = 50;

export const purgeImageCacheTargets = (id: string, origin: string) => {
  const sizes: VariantSize[] = [ORIGINAL_SIZE, ...ALL_VARIANTS];
  const cacheKeys = sizes.flatMap(({ width, quality }) =>
    FORMAT_VARIANTS.map((format) => imageCacheKey(origin, { id, width, quality, format })),
  );

  return [mediaCacheKey(origin, id), ...new Set(cacheKeys), `${origin}${GALLERY_FIRST_PAGE_PATH}`];
};
