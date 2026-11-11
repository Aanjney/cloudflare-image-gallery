import { PUBLIC_PATHS } from './contract';

type ImageFormat = 'auto' | 'webp';

type ImageVariant = {
  width: number;
  quality: number;
  format: ImageFormat;
};

const FORMAT_VARIANTS = ['avif', 'webp', 'jpeg'] as const;

type OutputFormat = (typeof FORMAT_VARIANTS)[number];

const DEFAULT_QUALITY = 85;

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

type VariantSize = { width: number | undefined; quality: number };

const ORIGINAL_SIZE: VariantSize = { width: undefined, quality: DEFAULT_QUALITY };

/**
 * Maps any requested width and quality to a size in the variant registry, so every
 * cache key /img can write is in `photoCacheKeys`.
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
  `${PUBLIC_PATHS.img}${id}?w=${variant.width}&q=${variant.quality}&fmt=${variant.format}`;

/** JS snippet defining `imageUrl(id, variant)`. It must stay aligned with `imagePath`. */
export const buildBrowserImageUrlHelper = () =>
  `function imageUrl(id, variant) {
    return ${JSON.stringify(PUBLIC_PATHS.img)} + id + '?w=' + variant.width + '&q=' + variant.quality + '&fmt=' + variant.format;
  }`;

export const formatPref = (accept = ''): OutputFormat =>
  FORMAT_VARIANTS.find((format) => accept.includes(`image/${format}`)) ?? 'jpeg';

type ImageVariantKey = VariantSize & { id: string; format: OutputFormat };

/** The /img edge cache key, its ETag and the resize cache key all derive from this. */
export const variantKey = ({ id, width, quality, format }: ImageVariantKey): string =>
  `${id}-${width ?? 'orig'}-${quality}-${format}`;

export const mediaUrl = (origin: string, id: string): string =>
  `${origin}${PUBLIC_PATHS.media}${id}`;

export const imageCacheKey = (origin: string, key: ImageVariantKey): string =>
  `${origin}${PUBLIC_PATHS.img}${variantKey(key)}`;

/** Every edge cache key a GET can create for this photo. */
export const photoCacheKeys = (id: string, origin: string): string[] => {
  const sizes: VariantSize[] = [ORIGINAL_SIZE, ...ALL_VARIANTS];
  const imageKeys = sizes.flatMap(({ width, quality }) =>
    FORMAT_VARIANTS.map((format) => imageCacheKey(origin, { id, width, quality, format })),
  );
  return [mediaUrl(origin, id), ...new Set(imageKeys)];
};
