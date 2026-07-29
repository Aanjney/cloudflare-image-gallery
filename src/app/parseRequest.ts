import type { ImageMeta } from '../types';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function parseRequestJson(
  request: { json(): Promise<unknown> },
): Promise<ParseResult<unknown>> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}

export function parseIdBody(body: unknown): ParseResult<{ id: string }> {
  if (
    body &&
    typeof body === 'object' &&
    'id' in body &&
    typeof (body as Record<string, unknown>).id === 'string'
  ) {
    const id = (body as { id: string }).id.trim();
    if (id.length > 0) return { ok: true, data: { id } };
  }
  return { ok: false, error: 'id is required' };
}

export function parseImageUpdateBody(
  body: unknown,
): ParseResult<Partial<ImageMeta> & { id: string }> {
  if (
    body &&
    typeof body === 'object' &&
    'id' in body &&
    typeof (body as Record<string, unknown>).id === 'string' &&
    (body as { id: string }).id
  ) {
    return { ok: true, data: body as Partial<ImageMeta> & { id: string } };
  }
  return { ok: false, error: 'id is required' };
}
