export const UPLOAD_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const ALLOWED_UPLOAD_MIME_TYPES = [...UPLOAD_EXTENSIONS.keys()];
export const UPLOAD_ACCEPT_ATTRIBUTE = ALLOWED_UPLOAD_MIME_TYPES.join(',');
export const UPLOAD_FORMAT_LABEL = 'JPEG, PNG, WebP';

// The admin client sends one file per request, and formData() buffers the whole body,
// so cap each request well under the 128 MB Worker memory limit.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '50 MB';
// Room for multipart boundaries, part headers, and the metadata fields.
export const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
// Sanity cap on the reported width and height for every format. 65535 is the JPEG maximum.
export const MAX_IMAGE_DIMENSION = 65535;
