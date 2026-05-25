import { describe, expect, it } from 'vitest';
import {
  ADMIN_BACKFILL_VARIANT,
  ADMIN_THUMB_VARIANT,
  CAROUSEL_VARIANTS,
  FORMAT_VARIANTS,
  GALLERY_GRID_VARIANTS,
  UPLOAD_WARM_VARIANTS,
  imagePath,
  purgeImageCacheTargets,
  purgeImagePaths,
} from '../src/domain/imageVariants';

describe('image variant registry', () => {
  it('builds stable image URLs from one canonical variant shape', () => {
    expect(imagePath('abc', { width: 960, quality: 80, format: 'auto' })).toBe(
      '/img/abc?w=960&q=80&fmt=auto',
    );
  });

  it('purges every variant used by gallery, admin, and upload warmup', () => {
    const purged = purgeImagePaths('abc');
    const expected = [
      '/img/abc',
      ...GALLERY_GRID_VARIANTS.map((variant) => imagePath('abc', variant)),
      ...CAROUSEL_VARIANTS.map((variant) => imagePath('abc', variant)),
      ...UPLOAD_WARM_VARIANTS.map((variant) => imagePath('abc', variant)),
      imagePath('abc', ADMIN_THUMB_VARIANT),
      imagePath('abc', ADMIN_BACKFILL_VARIANT),
    ];

    for (const path of expected) {
      expect(purged).toContain(path);
    }
    expect(new Set(purged).size).toBe(purged.length);
  });

  it('keeps all cache accept variants explicit', () => {
    expect(FORMAT_VARIANTS).toEqual(['avif', 'webp', 'jpeg']);
  });

  it('builds delete purge targets for media, API, and accept-keyed image caches', () => {
    const base = new URL('https://example.com/_admin/api/images/delete');
    const targets = purgeImageCacheTargets('abc', base);
    const imagePaths = purgeImagePaths('abc');

    expect(targets[0]).toBe('https://example.com/media/abc');
    expect(targets).toContain('https://example.com/api/images');

    for (const path of imagePaths) {
      const fullUrl = new URL(path, base).toString();
      expect(targets).toContain(fullUrl);
      for (const format of FORMAT_VARIANTS) {
        const accepted = new URL(fullUrl);
        accepted.searchParams.set('_accept', format);
        expect(targets).toContain(accepted.toString());
      }
    }
  });
});
