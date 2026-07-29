export type ImageFormat = 'auto' | 'webp';

export type ImageVariant = {
  width: number;
  quality: number;
  format: ImageFormat;
};

export const FORMAT_VARIANTS = ['avif', 'webp', 'jpeg'] as const;

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

export const imagePath = (id: string, variant: ImageVariant) =>
  `/img/${id}?w=${variant.width}&q=${variant.quality}&fmt=${variant.format}`;

/** JS snippet defining `imageUrl(id, variant)` — must stay aligned with `imagePath`. */
export const buildBrowserImageUrlHelper = () =>
  `var imageUrl = function(id, variant) {
    return '/img/' + id + '?w=' + variant.width + '&q=' + variant.quality + '&fmt=' + variant.format;
  };`;

export const purgeImagePaths = (id: string) => {
  const paths = [
    `/img/${id}`,
    ...GALLERY_GRID_VARIANTS.map((variant) => imagePath(id, variant)),
    ...CAROUSEL_VARIANTS.map((variant) => imagePath(id, variant)),
    ...UPLOAD_WARM_VARIANTS.map((variant) => imagePath(id, variant)),
    imagePath(id, ADMIN_THUMB_VARIANT),
    imagePath(id, ADMIN_BACKFILL_VARIANT),
  ];

  return [...new Set(paths)];
};

export const purgeImageCacheTargets = (id: string, base: URL) => {
  const targets = [new URL(`/media/${id}`, base).toString()];

  for (const path of purgeImagePaths(id)) {
    const fullUrl = new URL(path, base);
    targets.push(fullUrl.toString());
    for (const format of FORMAT_VARIANTS) {
      fullUrl.searchParams.set('_accept', format);
      targets.push(fullUrl.toString());
    }
  }

  targets.push(new URL('/api/images', base).toString());
  return targets;
};
