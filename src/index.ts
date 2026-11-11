import { Hono } from 'hono';
import { httpsRedirect, securityHeaders } from './app/security';
import { registerAdminRoutes } from './routes/admin';
import { registerGalleryRoutes } from './routes/gallery';
import { registerMediaRoutes } from './routes/media';
import { registerSiteMetaRoutes } from './routes/siteMeta';
import type { GalleryApp } from './types';

const app: GalleryApp = new Hono();

app.use('*', securityHeaders);
app.use('*', httpsRedirect);
registerAdminRoutes(app);
registerGalleryRoutes(app);
registerMediaRoutes(app);
registerSiteMetaRoutes(app);

export default app;
export { ImageIndex } from './do/ImageIndex';
