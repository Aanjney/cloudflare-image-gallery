import { describe, expect, it } from 'vitest';
import {
  ADMIN_BACKFILL_VARIANT,
  ADMIN_THUMB_VARIANT,
  CAROUSEL_VARIANTS,
  FORMAT_VARIANTS,
  GALLERY_GRID_VARIANTS,
  UPLOAD_WARM_VARIANTS,
  buildBrowserImageUrlHelper,
  imagePath,
  purgeImageCacheTargets,
  purgeImagePaths,
} from '../src/domain/imageVariants';
import {
  PLACEHOLDER_DEFAULT,
  PLACEHOLDER_SAMPLE_SIZE,
  averageRgbFromImageData,
  buildBrowserPlaceholderColorHelper,
} from '../src/domain/placeholderColor';

describe('image variant registry', () => {
  it('builds stable image URLs from one canonical variant shape', () => {
    expect(imagePath('abc', { width: 960, quality: 80, format: 'auto' })).toBe(
      '/img/abc?w=960&q=80&fmt=auto',
    );
  });

  it('browser imageUrl helper matches imagePath', () => {
    const variant = { width: 960, quality: 80, format: 'auto' as const };
    const imageUrl = new Function(`${buildBrowserImageUrlHelper()}; return imageUrl;`)() as (
      id: string,
      v: typeof variant,
    ) => string;
    expect(imageUrl('abc', variant)).toBe(imagePath('abc', variant));
  });

  it('browser placeholder helper matches averageRgbFromImageData', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 0, 255,
    ]);
    expect(averageRgbFromImageData(data, 2)).toBe('rgb(96,96,64)');

    const sampleData = new Uint8ClampedArray(PLACEHOLDER_SAMPLE_SIZE * PLACEHOLDER_SAMPLE_SIZE * 4);
    for (let i = 0; i < sampleData.length; i += 4) {
      const src = i % 16;
      sampleData[i] = data[src];
      sampleData[i + 1] = data[src + 1];
      sampleData[i + 2] = data[src + 2];
      sampleData[i + 3] = data[src + 3];
    }
    const expected = averageRgbFromImageData(sampleData, PLACEHOLDER_SAMPLE_SIZE);

    const placeholderFromImage = new Function(
      `var tile = new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,128,128,0,255]);
      var sampleData = new Uint8ClampedArray(576);
      for (var i = 0; i < sampleData.length; i += 4) {
        var src = i % 16;
        sampleData[i] = tile[src];
        sampleData[i + 1] = tile[src + 1];
        sampleData[i + 2] = tile[src + 2];
        sampleData[i + 3] = tile[src + 3];
      }
      var document = {
        createElement: function() {
          return {
            width: 0,
            height: 0,
            getContext: function() {
              return {
                drawImage: function() {},
                getImageData: function(_x, _y, w, h) {
                  return { data: sampleData.slice(0, w * h * 4) };
                }
              };
            }
          };
        }
      };
      ${buildBrowserPlaceholderColorHelper()}
      return placeholderFromImage;`,
    )() as (img: unknown) => string;

    expect(placeholderFromImage({})).toBe(expected);
    expect(buildBrowserPlaceholderColorHelper()).toContain(PLACEHOLDER_DEFAULT);
    expect(buildBrowserPlaceholderColorHelper()).toContain(String(PLACEHOLDER_SAMPLE_SIZE));
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
