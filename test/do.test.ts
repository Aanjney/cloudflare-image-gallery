import { describe, it, expect } from 'vitest';
import { ImageIndex } from '../src/do/ImageIndex';
import { LIST_LIMITS } from '../src/domain/contract';
import type { ImageMeta } from '../src/domain/imageMeta';
import type { Env, ListResponse } from '../src/types';
import { FakeStorage } from './support/fakes';

const createStub = () => {
  const storage = new FakeStorage();
  const inst = new ImageIndex({ storage } as unknown as DurableObjectState, {} as Env);
  return { inst, storage };
};

const req = (url: string, init?: RequestInit) => new Request(url, init);

const meta = (partial: Partial<ImageMeta> & Pick<ImageMeta, 'id'>): ImageMeta => ({
  key: `k/${partial.id}`,
  createdAt: '2024-01-01T00:00:00Z',
  size: 100,
  contentType: 'image/jpeg',
  ...partial,
});

const post = (inst: ImageIndex, path: string, body: unknown) =>
  inst.fetch(
    req(`https://index${path}`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const add = (inst: ImageIndex, partial: Parameters<typeof meta>[0]) =>
  post(inst, '/add', meta(partial));

const list = async (inst: ImageIndex, query = '') =>
  (await (await inst.fetch(req(`https://index/list${query}`))).json()) as ListResponse;

describe('ImageIndex Durable Object', () => {
  describe('POST /add', () => {
    it('moves an existing id to the front when added again', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'a' });
      await add(inst, { id: 'b' });
      await add(inst, { id: 'a', key: 'k1-v2' });

      const data = await list(inst);
      expect(data.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(data.items[0].key).toBe('k1-v2');
    });

    it('returns 400 for invalid JSON', async () => {
      const { inst } = createStub();
      const r = await post(inst, '/add', 'not-json{');
      expect(r.status).toBe(400);
      expect(await r.text()).toBe('Invalid JSON');
    });

    it('returns 400 when id, key, or createdAt is missing', async () => {
      const { inst } = createStub();
      const r = await post(inst, '/add', { id: 'x', key: 'k' });
      expect(r.status).toBe(400);
      expect(await r.text()).toBe('Missing required fields');
    });

    it('persists optional metadata fields', async () => {
      const { inst } = createStub();
      const optional = { location: 'BERLIN', year: '2024', cameraBody: 'M6', filmStock: 'PORTRA' };
      await add(inst, { id: 'x', ...optional });

      const r = await inst.fetch(req('https://index/meta/x'));
      expect(r.ok).toBe(true);
      expect(await r.json()).toMatchObject(optional);
    });

    it('returns 409 when index is at capacity', async () => {
      const { inst, storage } = createStub();
      await storage.put(
        'order',
        Array.from({ length: LIST_LIMITS.maxPhotos }, (_, i) => `id-${i}`),
      );

      const r = await add(inst, { id: 'new-id' });
      expect(r.status).toBe(409);
      expect(await r.text()).toBe('Index at capacity');
    });

    it('allows re-adding an existing id when at capacity', async () => {
      const { inst, storage } = createStub();
      const ids = [
        'existing',
        ...Array.from({ length: LIST_LIMITS.maxPhotos - 1 }, (_, i) => `id-${i}`),
      ];
      await storage.put('order', ids);
      await storage.put('meta:existing', meta({ id: 'existing', key: 'old-key' }));

      const r = await add(inst, { id: 'existing', key: 'new-key' });
      expect(r.status).toBe(200);
      expect(((await r.json()) as ImageMeta).key).toBe('new-key');

      const order = (await storage.get<string[]>('order')) ?? [];
      expect(order).toHaveLength(LIST_LIMITS.maxPhotos);
      expect(order[0]).toBe('existing');
    });
  });

  describe('GET /stats', () => {
    it('returns aggregate counts and sizes', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'a', size: 1000 });
      await add(inst, { id: 'b', createdAt: '2024-01-02T00:00:00Z', size: 3000 });

      const r = await inst.fetch(req('https://index/stats'));
      expect(r.ok).toBe(true);
      expect(await r.json()).toMatchObject({
        total: 2,
        totalBytes: 4000,
        latestCreatedAt: '2024-01-02T00:00:00Z',
        avgSize: 2000,
      });
    });

    it('returns zeros when empty', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/stats'));
      expect(await r.json()).toMatchObject({ total: 0, totalBytes: 0, avgSize: 0 });
    });
  });

  describe('GET /list', () => {
    it('returns empty items and null cursor when nothing stored', async () => {
      const { inst } = createStub();
      expect(await list(inst)).toEqual({ items: [], cursor: null });
    });

    it('fits LIST_LIMITS.maxPhotos ids in one SQLite-backed storage value', async () => {
      const order = Array.from({ length: LIST_LIMITS.maxPhotos }, () => crypto.randomUUID());
      const bytes = new TextEncoder().encode(JSON.stringify(order)).byteLength;
      // SQLite-backed Durable Objects cap a key plus value at 2 MB. Keep at least 2x headroom.
      expect(bytes).toBeLessThan(1024 * 1024);
    });

    it('ignores invalid cursor and starts from offset 0', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'only' });
      const data = await list(inst, `?cursor=${encodeURIComponent('@@@')}`);
      expect(data.items.map((i) => i.id)).toEqual(['only']);
    });

    it('filters by search query q across metadata fields', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'tokyo', location: 'TOKYO' });
      await add(inst, { id: 'osaka', location: 'OSAKA' });

      const data = await list(inst, '?q=tokyo');
      expect(data.items.map((i) => i.id)).toEqual(['tokyo']);
    });

    const deleteId = (inst: ImageIndex, id: string) => post(inst, '/delete', { id });
    const page = (inst: ImageIndex, cursor?: string | null) =>
      list(inst, `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const ids = (...pages: ListResponse[]) => pages.flatMap((p) => p.items.map((i) => i.id));

    it('does not repeat an item when one is added between pages', async () => {
      const { inst } = createStub();
      for (const id of ['a', 'b', 'c']) await add(inst, { id });

      const p1 = await page(inst);
      await add(inst, { id: 'd' });
      const p2 = await page(inst, p1.cursor);

      expect(ids(p1, p2)).toEqual(['c', 'b', 'a']);
      expect(p2.cursor).toBeNull();
    });

    it('does not skip an item when an earlier one is deleted between pages', async () => {
      const { inst } = createStub();
      for (const id of ['a', 'b', 'c', 'd']) await add(inst, { id });

      const p1 = await page(inst);
      await deleteId(inst, 'd');
      const p2 = await page(inst, p1.cursor);

      expect(ids(p1, p2)).toEqual(['d', 'c', 'b', 'a']);
    });

    it('resumes after the last served item when that item is deleted', async () => {
      const { inst } = createStub();
      for (const id of ['a', 'b', 'c', 'd', 'e']) await add(inst, { id });

      const p1 = await page(inst);
      await deleteId(inst, 'd');
      await add(inst, { id: 'f' });
      await add(inst, { id: 'g' });
      const p2 = await page(inst, p1.cursor);

      expect(ids(p2)).toEqual(['c', 'b']);
    });
  });

  describe('GET /meta/:id', () => {
    it('returns 400 when id segment is missing', async () => {
      const { inst } = createStub();
      const r = await inst.fetch(req('https://index/meta/'));
      expect(r.status).toBe(400);
    });
  });

  describe('POST /update', () => {
    it('merges partial fields onto existing meta', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'u1', key: 'k', alt: 'old alt', location: 'PARIS' });

      const r = await post(inst, '/update', { id: 'u1', location: 'LYON' });
      expect(r.ok).toBe(true);
      expect(await r.json()).toMatchObject({ location: 'LYON', alt: 'old alt', key: 'k' });
    });

    it('returns 404 when id does not exist', async () => {
      const { inst } = createStub();
      const r = await post(inst, '/update', { id: 'nope', location: 'X' });
      expect(r.status).toBe(404);
    });

    it('returns 400 for missing id or invalid JSON', async () => {
      const { inst } = createStub();
      expect((await post(inst, '/update', { location: 'X' })).status).toBe(400);
      expect((await post(inst, '/update', '{')).status).toBe(400);
    });
  });

  describe('POST /delete', () => {
    it('removes meta and drops id from list order', async () => {
      const { inst } = createStub();
      await add(inst, { id: 'a' });
      await add(inst, { id: 'b' });

      const del = await post(inst, '/delete', { id: 'a' });
      expect(del.ok).toBe(true);
      expect(((await del.json()) as { removed: string }).removed).toBe('a');

      expect((await list(inst)).items.map((i) => i.id)).toEqual(['b']);
      expect((await inst.fetch(req('https://index/meta/a'))).status).toBe(404);
    });

    it('returns 404 for unknown id', async () => {
      const { inst } = createStub();
      expect((await post(inst, '/delete', { id: 'ghost' })).status).toBe(404);
    });

    it('returns 400 for missing id or invalid JSON', async () => {
      const { inst } = createStub();
      expect((await post(inst, '/delete', {})).status).toBe(400);
      expect((await post(inst, '/delete', 'x')).status).toBe(400);
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
