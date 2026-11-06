import type { ImageMeta } from '../types';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

const EDITABLE_FIELD_MAX_LENGTH = {
  alt: 1000,
  name: 255,
  placeholder: 64,
  cameraBody: 200,
  filmStock: 200,
  location: 200,
  year: 32,
} as const;

type EditableField = keyof typeof EDITABLE_FIELD_MAX_LENGTH;

export type ImageMetaUpdate = { id: string } & Partial<Pick<ImageMeta, EditableField>>;

const EDITABLE_FIELDS = Object.keys(EDITABLE_FIELD_MAX_LENGTH) as EditableField[];

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

export function parseImageUpdateBody(body: unknown): ParseResult<ImageMetaUpdate> {
  const parsedId = parseIdBody(body);
  if (!parsedId.ok) return parsedId;

  const fields = body as Record<string, unknown>;
  const update: ImageMetaUpdate = parsedId.data;
  for (const field of EDITABLE_FIELDS) {
    const value = fields[field];
    if (value === undefined) continue;
    const maxLength = EDITABLE_FIELD_MAX_LENGTH[field];
    if (typeof value !== 'string' || value.length > maxLength) {
      return { ok: false, error: `${field} must be a string of at most ${maxLength} characters` };
    }
    update[field] = value;
  }
  return { ok: true, data: update };
}
