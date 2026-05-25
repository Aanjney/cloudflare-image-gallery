import { Hono } from 'hono';
import { registerAdminRewrite } from './app/adminPath';
import { registerAdminRoutes } from './routes/admin';
import { registerGalleryRoutes } from './routes/gallery';
import { registerMediaRoutes } from './routes/media';
import { registerSiteMetaRoutes } from './routes/siteMeta';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

registerAdminRewrite(app);
registerGalleryRoutes(app);
registerMediaRoutes(app);
registerAdminRoutes(app);
registerSiteMetaRoutes(app);

export default app;
export { ImageIndex } from './do/ImageIndex';
