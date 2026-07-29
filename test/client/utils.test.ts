import { describe, expect, it } from 'vitest';
import { buildAltFromMeta, esc, fmtDate, shuffle } from '../../src/client/utils';

describe('client utils', () => {
  it('escapes HTML', () => {
    expect(esc('a & b <c> "d"')).toBe('a &amp; b &lt;c&gt; &quot;d&quot;');
  });

  it('shuffles in place copy', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).toHaveLength(5);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('formats ISO dates', () => {
    expect(fmtDate('2024-06-15T12:00:00.000Z')).toMatch(/Jun/);
    expect(fmtDate('')).toBe('');
  });

  it('builds alt text from metadata', () => {
    expect(
      buildAltFromMeta({
        filmStock: 'Portra',
        cameraBody: 'M6',
        location: 'Iceland',
        year: '2024',
      }),
    ).toBe('Film photograph \u2014 Portra, M6, Iceland, 2024');
    expect(buildAltFromMeta({ fallback: 'shot.jpg' })).toBe('shot.jpg');
  });
});
