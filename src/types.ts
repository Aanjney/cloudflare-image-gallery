export type Env = {
  IMAGES_BUCKET: R2Bucket;
  IMAGE_INDEX: DurableObjectNamespace;
  ACCESS_BYPASS_DEV?: string;
  R2_PUBLIC_HOST?: string;
  ADMIN_PATH?: string;
};

export type ImageMeta = {
  id: string;
  key: string;
  createdAt: string;
  size: number;
  contentType: string;
  width?: number;
  height?: number;
  alt?: string;
  name?: string;
  placeholder?: string;
  cameraBody?: string;
  filmStock?: string;
  location?: string;
  year?: string;
};

export type ListResponse = {
  items: ImageMeta[];
  cursor?: string | null;
};
