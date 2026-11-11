import { PRIVATE_NO_STORE } from '../app/cacheControl';
import type { IndexFailure } from '../do/client';
import { LIST_LIMITS } from '../domain/contract';

const errorResponse = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': PRIVATE_NO_STORE } });

export const notFoundResponse = () => errorResponse(404, 'Not found');

export const indexFailureResponse = ({ kind, detail }: IndexFailure): Response => {
  if (kind === 'unavailable') console.error(`index unavailable: ${detail}`);
  switch (kind) {
    case 'notFound':
      return notFoundResponse();
    case 'full':
      return errorResponse(
        409,
        `The archive is full (${LIST_LIMITS.maxPhotos} photos). Delete some photos before uploading more.`,
      );
    case 'unavailable':
      return errorResponse(503, 'Index unavailable');
  }
};
