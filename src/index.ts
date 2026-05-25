import { Hono } from 'hono';
import { registerAdminRewrite } from './http';
import { registerAdminRoutes } from './routes/admin';
import { registerMediaRoutes } from './routes/media';
import { registerPublicRoutes } from './routes/public';
import { registerSeoRoutes } from './routes/seo';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

registerAdminRewrite(app);
registerPublicRoutes(app);
registerMediaRoutes(app);
registerAdminRoutes(app);
registerSeoRoutes(app);

export default app;
export { ImageIndex } from './do/ImageIndex';
