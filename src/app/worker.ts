import type { Hono } from 'hono';
import type { Env } from '../types';

export type GalleryApp = Hono<{ Bindings: Env }>;

export const getIndexStub = (env: Env) => {
  const id = env.IMAGE_INDEX.idFromName('global');
  return env.IMAGE_INDEX.get(id);
};
