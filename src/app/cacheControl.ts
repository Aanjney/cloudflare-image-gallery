export const PRIVATE_NO_STORE = 'private, no-store';

// Image URLs never change bytes; s-maxage bounds how long other colos serve a deleted photo.
export const PUBLIC_IMAGE_CACHE = 'public, max-age=31536000, s-maxage=86400, immutable';
