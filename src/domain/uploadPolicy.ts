export const ALLOWED_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ALLOWED_UPLOAD_TYPE_SET = new Set<string>(ALLOWED_UPLOAD_MIME_TYPES);
export const UPLOAD_ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_MIME_TYPES.join(',');
export const UPLOAD_FORMAT_LABEL = 'JPEG, PNG, WebP';
