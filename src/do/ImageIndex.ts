import { Env, ImageMeta, ListResponse, StatsResponse } from '../types';

const ORDER_KEY = 'order';
const META_PREFIX = 'meta:';
// The order is one storage value. SQLite-backed objects allow 2 MB per key plus value,
// and 5000 UUIDs serialize to about 190 KB.
export const ORDER_LIMIT = 5000;
const META_READ_BATCH = 128;
// The cursor keeps the last few ids served, so a page resumes after the newest one that
// still exists. The offset is only a fallback for when all of them were deleted.
const CURSOR_ANCHOR_IDS = 5;

type ListCursor = { after: string[]; offset: number };

const encodeCursor = (cursor: ListCursor): string => btoa(JSON.stringify(cursor));

const decodeCursor = (raw: string | null): ListCursor => {
  const empty: ListCursor = { after: [], offset: 0 };
  if (!raw) return empty;
  try {
    const decoded = JSON.parse(atob(raw)) as Partial<ListCursor>;
    const after = Array.isArray(decoded.after)
      ? decoded.after.filter((id): id is string => typeof id === 'string')
      : [];
    const offset =
      typeof decoded.offset === 'number' && Number.isInteger(decoded.offset) && decoded.offset > 0
        ? decoded.offset
        : 0;
    return { after, offset };
  } catch {
    return empty;
  }
};

const resumeIndex = (source: string[], cursor: ListCursor): number => {
  for (const id of cursor.after) {
    const i = source.indexOf(id);
    if (i !== -1) return i + 1;
  }
  return cursor.offset;
};

export class ImageIndex {
  private readonly state: DurableObjectState;
  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/add') {
      return this.handleAdd(request);
    }

    if (request.method === 'POST' && url.pathname === '/update') {
      return this.handleUpdate(request);
    }

    if (request.method === 'GET' && url.pathname === '/list') {
      return this.handleList(url);
    }

    if (request.method === 'GET' && url.pathname === '/stats') {
      return this.handleStats();
    }

    if (request.method === 'GET' && url.pathname.startsWith('/meta/')) {
      const [, , id] = url.pathname.split('/');
      if (!id) return new Response('Missing id', { status: 400 });
      return this.handleGet(id);
    }

    if (request.method === 'POST' && url.pathname === '/delete') {
      return this.handleDelete(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleAdd(request: Request) {
    const payload = await this.readJson<ImageMeta>(request);
    if (!payload) return new Response('Invalid JSON', { status: 400 });

    if (!payload.id || !payload.key || !payload.createdAt) {
      return new Response('Missing required fields', { status: 400 });
    }

    const meta: ImageMeta = {
      id: payload.id,
      key: payload.key,
      createdAt: payload.createdAt,
      size: payload.size ?? 0,
      contentType: payload.contentType ?? 'image/jpeg',
      width: payload.width,
      height: payload.height,
      alt: payload.alt,
      name: payload.name,
      placeholder: payload.placeholder,
      cameraBody: payload.cameraBody,
      filmStock: payload.filmStock,
      location: payload.location,
      year: payload.year,
    };

    const order = await this.getOrder();
    const isExisting = order.includes(meta.id);
    if (!isExisting && order.length >= ORDER_LIMIT) {
      return new Response('Index at capacity', { status: 409 });
    }

    const newOrder = [meta.id, ...order.filter((i) => i !== meta.id)];

    await Promise.all([
      this.state.storage.put(`${META_PREFIX}${meta.id}`, meta),
      this.state.storage.put(ORDER_KEY, newOrder),
    ]);

    return Response.json(meta);
  }

  private async handleStats() {
    const order = await this.getOrder();
    const metaById = await this.getMetaById(order);
    let total = 0;
    let totalBytes = 0;
    let latestCreatedAt: string | null = null;

    for (const id of order) {
      const m = metaById.get(id);
      if (!m) continue;
      total += 1;
      totalBytes += m.size ?? 0;
      if (m.createdAt && (!latestCreatedAt || m.createdAt > latestCreatedAt)) {
        latestCreatedAt = m.createdAt;
      }
    }

    const body: StatsResponse = {
      total,
      totalBytes,
      latestCreatedAt,
      avgSize: total ? Math.round(totalBytes / total) : 0,
    };
    return Response.json(body);
  }

  private async handleList(url: URL) {
    const limitParam = url.searchParams.get('limit');
    const cursorParam = url.searchParams.get('cursor');
    const q = url.searchParams.get('q')?.toLowerCase().trim() || '';

    const limit = Math.min(500, Math.max(1, limitParam ? Number(limitParam) || 20 : 20));

    const order = await this.getOrder();

    let listSource = order;
    let metaById: Map<string, ImageMeta> | null = null;

    if (q) {
      const allMeta = await this.getMetaById(order);
      metaById = allMeta;
      listSource = order.filter((id) => {
        const m = allMeta.get(id);
        return m ? this.matchesQuery(m, q) : false;
      });
    }

    const offset = resumeIndex(listSource, decodeCursor(cursorParam));
    const slice = listSource.slice(offset, offset + limit);
    if (!metaById) metaById = await this.getMetaById(slice);

    const items = slice.map((id) => metaById.get(id)).filter((m): m is ImageMeta => Boolean(m));
    const nextOffset = offset + slice.length;
    const nextCursor =
      nextOffset < listSource.length
        ? encodeCursor({ after: slice.slice(-CURSOR_ANCHOR_IDS).reverse(), offset: nextOffset })
        : null;

    const body: ListResponse = { items, cursor: nextCursor };
    return Response.json(body);
  }

  private async handleUpdate(request: Request) {
    const payload = await this.readJson<Partial<ImageMeta>>(request);
    if (!payload) return new Response('Invalid JSON', { status: 400 });
    if (!payload.id) return new Response('Missing id', { status: 400 });

    const metaKey = `${META_PREFIX}${payload.id}`;
    const existing = await this.state.storage.get<ImageMeta>(metaKey);
    if (!existing) return new Response('Not found', { status: 404 });

    const updated: ImageMeta = {
      ...existing,
      alt: payload.alt ?? existing.alt,
      name: payload.name ?? existing.name,
      width: payload.width ?? existing.width,
      height: payload.height ?? existing.height,
      placeholder: payload.placeholder ?? existing.placeholder,
      cameraBody: payload.cameraBody ?? existing.cameraBody,
      filmStock: payload.filmStock ?? existing.filmStock,
      location: payload.location ?? existing.location,
      year: payload.year ?? existing.year,
    };

    await this.state.storage.put(metaKey, updated);
    return Response.json(updated);
  }

  private async handleGet(id: string) {
    const meta = await this.state.storage.get<ImageMeta>(`${META_PREFIX}${id}`);
    if (!meta) return new Response('Not found', { status: 404 });
    return Response.json(meta);
  }

  private async handleDelete(request: Request) {
    const payload = await this.readJson<{ id?: string }>(request);
    if (!payload) return new Response('Invalid JSON', { status: 400 });
    if (!payload.id) return new Response('Missing id', { status: 400 });

    const metaKey = `${META_PREFIX}${payload.id}`;
    const meta = await this.state.storage.get<ImageMeta>(metaKey);
    if (!meta) return new Response('Not found', { status: 404 });

    const order = await this.getOrder();
    const newOrder = order.filter((i) => i !== payload.id);

    await Promise.all([
      this.state.storage.delete(metaKey),
      this.state.storage.put(ORDER_KEY, newOrder),
    ]);

    return Response.json({ ok: true, removed: payload.id });
  }

  private async getOrder(): Promise<string[]> {
    return (await this.state.storage.get<string[]>(ORDER_KEY)) ?? [];
  }

  // Only this Worker calls the index, so the payload shape is trusted.
  private async readJson<T>(request: Request): Promise<T | null> {
    try {
      return (await request.json()) as T;
    } catch {
      return null;
    }
  }

  private async getMetaById(ids: string[]): Promise<Map<string, ImageMeta>> {
    const map = new Map<string, ImageMeta>();
    for (let i = 0; i < ids.length; i += META_READ_BATCH) {
      const chunk = ids.slice(i, i + META_READ_BATCH);
      const metas = await Promise.all(
        chunk.map((id) => this.state.storage.get<ImageMeta>(`${META_PREFIX}${id}`)),
      );
      chunk.forEach((id, j) => {
        const m = metas[j];
        if (m) map.set(id, m);
      });
    }
    return map;
  }

  private matchesQuery(m: ImageMeta, q: string): boolean {
    return (
      (m.alt?.toLowerCase().includes(q) ?? false) ||
      (m.name?.toLowerCase().includes(q) ?? false) ||
      (m.location?.toLowerCase().includes(q) ?? false) ||
      (m.cameraBody?.toLowerCase().includes(q) ?? false) ||
      (m.filmStock?.toLowerCase().includes(q) ?? false) ||
      (m.year?.toLowerCase().includes(q) ?? false) ||
      m.id.toLowerCase().includes(q)
    );
  }
}
