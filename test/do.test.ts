import { describe, it, expect, beforeEach } from 'vitest';
import { ImageIndex } from '../src/do/ImageIndex';
import type { Env, ImageMeta, ListResponse } from '../src/types';

class FakeStorage {
  private store = new Map<string, unknown>();
  async get<T>(key: string) {
    return this.store.get(key) as T | undefined;
  }
  async put(key: string, value: unknown) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

const createStub = () => {
  const storage = new FakeStorage();
  const state = { storage } as unknown as DurableObjectState;
  const env = {} as unknown as Env;
  const inst = new ImageIndex(state, env);
  return { inst, storage };
};

const req = (url: string, init?: RequestInit) => new Request(url, init);

const meta = (
  partial: Partial<ImageMeta> & Pick<ImageMeta, 'id' | 'key' | 'createdAt'>,
): ImageMeta => ({
  size: 100,
  contentType: 'image/jpeg',
  ...partial,
});

describe('ImageIndex Durable Object', () => {
  describe('POST /add', () => {
    let inst: ImageIndex;

    beforeEach(() => {
      inst = createStub().inst;
    });

    it('prepends new items so list is newest-first', async () => {
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'a', key: 'k1', createdAt: '2024-01-01T00:00:00Z' })),
        }),
      );
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'b', key: 'k2', createdAt: '2024-01-02T00:00:00Z' })),
        }),
      );

      const listResp = await inst.fetch(req('https://index/list'));
      const data = (await listResp.json()) as ListResponse;
      expect(data.items.map((i) => i.id)).toEqual(['b', 'a']);
    });

    it('moves an existing id to the front when added again', async () => {
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'a', key: 'k1', createdAt: '2024-01-01T00:00:00Z' })),
        }),
      );
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'b', key: 'k2', createdAt: '2024-01-02T00:00:00Z' })),
        }),
      );
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'a', key: 'k1-v2', createdAt: '2024-01-03T00:00:00Z' })),
        }),
      );

      const listResp = await inst.fetch(req('https://index/list'));
      const data = (await listResp.json()) as ListResponse;
      expect(data.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(data.items[0].key).toBe('k1-v2');
    });

    it('returns 400 for invalid JSON', async () => {
      const r = await inst.fetch(req('https://index/add', { method: 'POST', body: 'not-json{' }));
      expect(r.status).toBe(400);
      expect(await r.text()).toBe('Invalid JSON');
    });

    it('returns 400 when id, key, or createdAt is missing', async () => {
      const r = await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify({ id: 'x', key: 'k' }),
        }),
      );
      expect(r.status).toBe(400);
      expect(await r.text()).toBe('Missing required fields');
    });

    it('persists optional metadata fields', async () => {
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(
            meta({
              id: 'x',
              key: 'kx',
              createdAt: '2024-01-01T00:00:00Z',
              location: 'BERLIN',
              year: '2024',
              cameraBody: 'M6',
              filmStock: 'PORTRA',
            }),
          ),
        }),
      );
      const r = await inst.fetch(req('https://index/meta/x'));
      expect(r.ok).toBe(true);
      const m = (await r.json()) as ImageMeta;
      expect(m.location).toBe('BERLIN');
      expect(m.year).toBe('2024');
      expect(m.cameraBody).toBe('M6');
      expect(m.filmStock).toBe('PORTRA');
    });
  });

  describe('GET /list', () => {
    it('returns empty items and null cursor when nothing stored', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/list'));
      const data = (await r.json()) as ListResponse;
      expect(data.items).toEqual([]);
      expect(data.cursor).toBeNull();
    });

    it('paginates with limit and cursor', async () => {
      const { inst } = createStub();
      for (let i = 0; i < 3; i++) {
        await inst.fetch(
          req('https://index/add', {
            method: 'POST',
            body: JSON.stringify(
              meta({
                id: `id-${i}`,
                key: `k${i}`,
                createdAt: `2024-01-0${i + 1}T00:00:00Z`,
              }),
            ),
          }),
        );
      }

      const p1 = await inst.fetch(req('https://index/list?limit=1'));
      const d1 = (await p1.json()) as ListResponse;
      expect(d1.items).toHaveLength(1);
      expect(d1.items[0].id).toBe('id-2');
      expect(d1.cursor).toBeTruthy();

      const p2 = await inst.fetch(
        req(`https://index/list?limit=1&cursor=${encodeURIComponent(d1.cursor!)}`),
      );
      const d2 = (await p2.json()) as ListResponse;
      expect(d2.items).toHaveLength(1);
      expect(d2.items[0].id).toBe('id-1');
    });

    it('ignores invalid cursor and starts from offset 0', async () => {
      const { inst } = createStub();
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'only', key: 'k', createdAt: '2024-01-01T00:00:00Z' })),
        }),
      );
      const r = await inst.fetch(req(`https://index/list?cursor=${encodeURIComponent('@@@')}`));
      const data = (await r.json()) as ListResponse;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe('only');
    });

    it('filters by search query q across metadata fields', async () => {
      const { inst } = createStub();
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(
            meta({
              id: 'tokyo',
              key: 'k1',
              createdAt: '2024-01-01T00:00:00Z',
              location: 'TOKYO',
            }),
          ),
        }),
      );
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(
            meta({
              id: 'osaka',
              key: 'k2',
              createdAt: '2024-01-02T00:00:00Z',
              location: 'OSAKA',
            }),
          ),
        }),
      );

      const r = await inst.fetch(req('https://index/list?q=tokyo'));
      const data = (await r.json()) as ListResponse;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe('tokyo');
    });
  });

  describe('GET /meta/:id', () => {
    it('returns 404 for unknown id', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/meta/missing'));
      expect(r.status).toBe(404);
    });

    it('returns 400 when id segment is missing', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/meta/'));
      expect(r.status).toBe(400);
    });
  });

  describe('POST /update', () => {
    it('merges partial fields onto existing meta', async () => {
      const { inst } = createStub();
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(
            meta({
              id: 'u1',
              key: 'k',
              createdAt: '2024-01-01T00:00:00Z',
              alt: 'old alt',
              location: 'PARIS',
            }),
          ),
        }),
      );

      const r = await inst.fetch(
        req('https://index/update', {
          method: 'POST',
          body: JSON.stringify({ id: 'u1', location: 'LYON' }),
        }),
      );
      expect(r.ok).toBe(true);
      const updated = (await r.json()) as ImageMeta;
      expect(updated.location).toBe('LYON');
      expect(updated.alt).toBe('old alt');
      expect(updated.key).toBe('k');
    });

    it('returns 404 when id does not exist', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(
        req('https://index/update', {
          method: 'POST',
          body: JSON.stringify({ id: 'nope', location: 'X' }),
        }),
      );
      expect(r.status).toBe(404);
    });

    it('returns 400 for missing id', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(
        req('https://index/update', {
          method: 'POST',
          body: JSON.stringify({ location: 'X' }),
        }),
      );
      expect(r.status).toBe(400);
    });

    it('returns 400 for invalid JSON', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/update', { method: 'POST', body: '{' }));
      expect(r.status).toBe(400);
    });
  });

  describe('POST /delete', () => {
    it('removes meta and drops id from list order', async () => {
      const { inst } = createStub();
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'a', key: 'k1', createdAt: '2024-01-01T00:00:00Z' })),
        }),
      );
      await inst.fetch(
        req('https://index/add', {
          method: 'POST',
          body: JSON.stringify(meta({ id: 'b', key: 'k2', createdAt: '2024-01-02T00:00:00Z' })),
        }),
      );

      const del = await inst.fetch(
        req('https://index/delete', {
          method: 'POST',
          body: JSON.stringify({ id: 'a' }),
        }),
      );
      expect(del.ok).toBe(true);
      expect(((await del.json()) as { removed: string }).removed).toBe('a');

      const list = (await (await inst.fetch(req('https://index/list'))).json()) as ListResponse;
      expect(list.items.map((i) => i.id)).toEqual(['b']);

      const metaR = await inst.fetch(req('https://index/meta/a'));
      expect(metaR.status).toBe(404);
    });

    it('returns 404 for unknown id', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(
        req('https://index/delete', {
          method: 'POST',
          body: JSON.stringify({ id: 'ghost' }),
        }),
      );
      expect(r.status).toBe(404);
    });

    it('returns 400 for missing id or invalid JSON', async () => {
      const { inst } = createStub();
      const r1 = await inst.fetch(
        req('https://index/delete', { method: 'POST', body: JSON.stringify({}) }),
      );
      expect(r1.status).toBe(400);

      const r2 = await inst.fetch(req('https://index/delete', { method: 'POST', body: 'x' }));
      expect(r2.status).toBe(400);
    });
  });

  describe('routing', () => {
    it('returns 404 for unknown path or method', async () => {
      const { inst } = createStub();
      expect((await inst.fetch(req('https://index/nope'))).status).toBe(404);
      expect((await inst.fetch(req('https://index/add', { method: 'GET' }))).status).toBe(404);
    });
  });
});
