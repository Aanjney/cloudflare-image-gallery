import { readMetaFields, type MetaFields } from '../domain/imageMeta';

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function parseRequestJson(request: {
  json(): Promise<unknown>;
}): Promise<ParseResult<unknown>> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}

export function parseIdBody(body: unknown): ParseResult<{ id: string }> {
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id === 'string' && id.trim()) return { ok: true, data: { id: id.trim() } };
  return { ok: false, error: 'id is required' };
}

export function parseImageUpdateBody(body: unknown): ParseResult<{ id: string } & MetaFields> {
  const parsedId = parseIdBody(body);
  if (!parsedId.ok) return parsedId;
  const fields = readMetaFields((field) => (body as Record<string, unknown>)[field]);
  if (!fields.ok) return fields;
  return { ok: true, data: { ...parsedId.data, ...fields.fields } };
}
