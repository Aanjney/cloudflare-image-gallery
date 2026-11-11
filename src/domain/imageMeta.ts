/** Every text field a photo carries besides its storage facts. Upload, edit, search and the admin forms derive from this. */
export const META_FIELDS = {
  alt: { maxLength: 1000 },
  name: { maxLength: 255 },
  placeholder: { maxLength: 64 },
  cameraBody: { maxLength: 200, label: 'Camera body', example: 'Leica M6' },
  filmStock: { maxLength: 200, label: 'Film stock', example: 'Kodak Portra 400' },
  location: { maxLength: 200, label: 'Location', example: 'Faroe Islands' },
  year: { maxLength: 32, label: 'Year', example: '2024' },
} as const;

type MetaField = keyof typeof META_FIELDS;
export type MetaFields = { [K in MetaField]?: string };

/** A photo: its storage facts plus the text fields. */
export type ImageMeta = MetaFields & {
  id: string;
  key: string;
  createdAt: string;
  size: number;
  contentType: string;
  width?: number;
  height?: number;
};

const META_FIELD_NAMES = Object.keys(META_FIELDS) as MetaField[];

type LabeledField = {
  [K in MetaField]: (typeof META_FIELDS)[K] extends { label: string } ? K : never;
}[MetaField];

/** The fields the admin types per photo, in display order. */
export const DESCRIPTIVE_FIELDS = META_FIELD_NAMES.filter(
  (field): field is LabeledField => 'label' in META_FIELDS[field],
);

export const SEARCHABLE_FIELDS: MetaField[] = ['alt', 'name', ...DESCRIPTIVE_FIELDS];

type FieldsResult = { ok: true; fields: MetaFields } | { ok: false; error: string };

/** Reads the known text fields from untrusted input and trims them. Missing fields are skipped; anything else must be a short enough string. */
export function readMetaFields(input: (field: MetaField) => unknown): FieldsResult {
  const fields: MetaFields = {};
  for (const field of META_FIELD_NAMES) {
    const value = input(field);
    if (value === undefined) continue;
    const { maxLength } = META_FIELDS[field];
    const text = typeof value === 'string' ? value.trim() : value;
    if (typeof text !== 'string' || text.length > maxLength) {
      return { ok: false, error: `${field} must be a string of at most ${maxLength} characters` };
    }
    fields[field] = text;
  }
  return { ok: true, fields };
}
