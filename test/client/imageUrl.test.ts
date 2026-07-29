import { describe, expect, it } from 'vitest';
import { GALLERY_GRID_VARIANTS } from '../../src/domain/imageVariants';
import { imagePath } from '../../src/domain/imageVariants';
import { imageSrcset, imageUrl, mediaUrl, thumbUrl } from '../../src/client/imageUrl';
import { ADMIN_THUMB_VARIANT } from '../../src/domain/imageVariants';

describe('client imageUrl', () => {
  it('matches server imagePath', () => {
    const variant = { width: 960, quality: 80, format: 'auto' as const };
    expect(imageUrl('abc', variant)).toBe(imagePath('abc', variant));
  });

  it('builds srcset entries', () => {
    expect(imageSrcset('abc', GALLERY_GRID_VARIANTS.slice(0, 2))).toBe(
      '/img/abc?w=240&q=75&fmt=auto 240w, /img/abc?w=320&q=78&fmt=auto 320w',
    );
  });

  it('builds media and thumb URLs', () => {
    expect(mediaUrl('xyz')).toBe('/media/xyz');
    expect(thumbUrl('xyz', ADMIN_THUMB_VARIANT)).toBe('/img/xyz?w=160&q=75&fmt=webp');
  });
});
