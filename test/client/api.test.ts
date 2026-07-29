import { describe, expect, it } from 'vitest';
import {
  adminDeleteUrl,
  adminUpdateUrl,
  adminUploadUrl,
  imagesListUrl,
  mediaPageUrl,
} from '../../src/client/api';

describe('client api', () => {
  it('builds public list URLs', () => {
    expect(imagesListUrl({ limit: 200 })).toBe('/api/images?limit=200');
    expect(imagesListUrl({ cursor: 'abc', q: 'portra' })).toBe('/api/images?cursor=abc&q=portra');
    expect(imagesListUrl()).toBe('/api/images');
  });

  it('builds admin endpoints', () => {
    expect(adminUploadUrl('/_admin')).toBe('/_admin/api/upload');
    expect(adminDeleteUrl('/_admin')).toBe('/_admin/api/images/delete');
    expect(adminUpdateUrl('/_admin')).toBe('/_admin/api/images/update');
  });

  it('builds media page URLs', () => {
    expect(mediaPageUrl('https://example.com', 'id1')).toBe('https://example.com/media/id1');
  });
});
