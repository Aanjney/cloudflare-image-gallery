import { describe, expect, it } from 'vitest';
import {
  PRIVATE_NO_STORE,
  PUBLIC_IMAGE_CACHE,
  buildR2ImageResponse,
  buildTransformedImageResponse,
  notFoundResponse,
  r2ObjectEtag,
} from '../src/app/mediaResponse';
import { parseIdBody, parseImageUpdateBody } from '../src/app/parseRequest';

describe('mediaResponse', () => {
  it('returns 404 JSON without security headers by default', async () => {
    const resp = notFoundResponse();
    expect(resp.status).toBe(404);
    expect(resp.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
    expect(resp.headers.get('Strict-Transport-Security')).toBeNull();
    await expect(resp.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('adds security headers to secured not-found responses', () => {
    const resp = notFoundResponse(true);
    expect(resp.status).toBe(404);
    expect(resp.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('builds immutable image cache headers for transformed responses', () => {
    const upstream = new Response('bytes', {
      headers: { 'Content-Type': 'image/webp' },
    });
    const resp = buildTransformedImageResponse(upstream, '"v-img"');
    expect(resp.headers.get('ETag')).toBe('"v-img"');
    expect(resp.headers.get('Cache-Control')).toBe(PUBLIC_IMAGE_CACHE);
    expect(resp.headers.get('Vary')).toBe('Accept');
    expect(resp.headers.get('Content-Type')).toBe('image/webp');
  });

  it('builds R2 image responses with etag fallback from metadata', () => {
    const obj = {
      body: new ReadableStream(),
      size: 42,
    };
    const resp = buildR2ImageResponse(obj, {
      id: 'img-1',
      size: 99,
      contentType: 'image/png',
    });
    expect(resp.headers.get('Content-Type')).toBe('image/png');
    expect(resp.headers.get('Cache-Control')).toBe(PUBLIC_IMAGE_CACHE);
    expect(resp.headers.get('ETag')).toBe('"img-1-99"');
    expect(resp.headers.get('Content-Length')).toBe('42');
    expect(r2ObjectEtag({ body: null, httpEtag: '"from-r2"' }, { id: 'x', size: 1 })).toBe(
      '"from-r2"',
    );
  });
});

describe('parseRequest helpers', () => {
  it('parses delete id bodies', () => {
    expect(parseIdBody({ id: ' img-1 ' })).toEqual({ ok: true, data: { id: 'img-1' } });
    expect(parseIdBody({ id: '' })).toEqual({ ok: false, error: 'id is required' });
    expect(parseIdBody({})).toEqual({ ok: false, error: 'id is required' });
  });

  it('parses image update bodies requiring a truthy id', () => {
    expect(parseImageUpdateBody({ id: 'img-1', alt: 'sunset' })).toEqual({
      ok: true,
      data: { id: 'img-1', alt: 'sunset' },
    });
    expect(parseImageUpdateBody({ id: '' })).toEqual({ ok: false, error: 'id is required' });
  });

  it('keeps only editable string fields in image update bodies', () => {
    expect(parseImageUpdateBody({ id: 'img-1', year: '2024', key: 'x', size: 1 })).toEqual({
      ok: true,
      data: { id: 'img-1', year: '2024' },
    });
    expect(parseImageUpdateBody({ id: 'img-1', location: 'x'.repeat(201) })).toEqual({
      ok: false,
      error: 'location must be a string of at most 200 characters',
    });
  });
});
