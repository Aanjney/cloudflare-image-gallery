import { describe, expect, it } from 'vitest';
import {
  ADMIN_BACKFILL_VARIANT,
  ADMIN_THUMB_VARIANT,
  GALLERY_GRID_VARIANTS,
  UPLOAD_WARM_VARIANTS,
  buildBrowserImageUrlHelper,
  imageCacheKey,
  imagePath,
  photoCacheKeys,
  snapVariant,
} from '../src/domain/imageVariants';
import {
  PLACEHOLDER_SAMPLE_SIZE,
  buildBrowserPlaceholderColorHelper,
} from '../src/domain/placeholderColor';

const FORMATS = ['avif', 'webp', 'jpeg'] as const;

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

  const loadPlaceholderHelper = (getImageData: (w: number, h: number) => { data: unknown }) =>
    new Function(
      'getImageData',
      `var document = {
        createElement: function() {
          return {
            getContext: function() {
              return {
                drawImage: function() {},
                getImageData: function(_x, _y, w, h) { return getImageData(w, h); }
              };
            }
          };
        }
      };
      ${buildBrowserPlaceholderColorHelper()}
      return placeholderFromImage;`,
    )(getImageData) as (img: unknown) => string;

  it('browser placeholder helper averages the sampled pixels', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 0, 255,
    ]);
    const sampleData = new Uint8ClampedArray(PLACEHOLDER_SAMPLE_SIZE * PLACEHOLDER_SAMPLE_SIZE * 4);
    for (let i = 0; i < sampleData.length; i += 4) {
      const src = i % 16;
      sampleData[i] = data[src];
      sampleData[i + 1] = data[src + 1];
      sampleData[i + 2] = data[src + 2];
      sampleData[i + 3] = data[src + 3];
    }

    const placeholderFromImage = loadPlaceholderHelper((w, h) => ({
      data: sampleData.slice(0, w * h * 4),
    }));

    expect(placeholderFromImage({})).toBe('rgb(96,96,64)');
  });

  it('browser placeholder helper falls back to the default color when the canvas is tainted', () => {
    const placeholderFromImage = loadPlaceholderHelper(() => {
      throw new Error('SecurityError');
    });

    expect(placeholderFromImage({})).toBe('#0e0e0e');
  });

  it('keeps every named variant canonical and purges it in every output format', () => {
    const targets = photoCacheKeys('abc', 'https://example.com');
    const variants = [
      ...GALLERY_GRID_VARIANTS,
      ...UPLOAD_WARM_VARIANTS,
      ADMIN_THUMB_VARIANT,
      ADMIN_BACKFILL_VARIANT,
    ];

    expect(targets[0]).toBe('https://example.com/media/abc');
    for (const { width, quality } of variants) {
      expect(snapVariant(width, quality)).toEqual({ width, quality });
      for (const format of FORMATS) {
        expect(targets).toContain(
          imageCacheKey('https://example.com', { id: 'abc', width, quality, format }),
        );
      }
    }
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('canonicalizes every requestable width and quality to a purged cache key', () => {
    const origin = 'https://example.com';
    const targets = new Set(photoCacheKeys('abc', origin));
    const widths = [undefined, 1, 100, 159, 161, 700, 1000, 1599, 1601, 5000];
    const qualities = [undefined, 1, 50, 70, 76, 79, 81, 83, 84, 99, 100];

    for (const w of widths) {
      for (const q of qualities) {
        const { width, quality } = snapVariant(w, q);
        for (const format of FORMATS) {
          expect(targets).toContain(imageCacheKey(origin, { id: 'abc', width, quality, format }));
        }
      }
    }
  });

  it('snaps out-of-range transform parameters to the nearest variant', () => {
    expect(snapVariant(5000, 99)).toEqual({ width: 1600, quality: 82 });
    expect(snapVariant(1600, 70)).toEqual({ width: 1600, quality: 82 });
    expect(snapVariant(1, 1)).toEqual({ width: 120, quality: 70 });
  });
});
