import type { Hono } from 'hono';
import type { ImageMeta } from './domain/imageMeta';

export type Env = {
  IMAGES_BUCKET: R2Bucket;
  IMAGE_INDEX: DurableObjectNamespace;
  ACCESS_BYPASS_DEV?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  R2_PUBLIC_HOST?: string;
  ADMIN_PATH?: string;
};

export type GalleryApp = Hono<{ Bindings: Env }>;

export type ListResponse = {
  items: ImageMeta[];
  cursor?: string | null;
};

export type StatsResponse = {
  total: number;
  totalBytes: number;
  latestCreatedAt: string | null;
  avgSize: number;
};
