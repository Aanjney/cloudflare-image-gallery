# Cloudflare-image-gallery

A self-hosted image gallery running entirely on Cloudflare's free tier: Workers, R2, Durable Objects, and Image Resizing.
Just wanted to build something to document and showcase my film photography journey.

**Live:** [mr-schwartz.pics](https://mr-schwartz.pics)

## Features

- Responsive masonry gallery
- Carousel viewer with `Image.decode()`-based preloading
- Light/dark theme with shared preference across pages
- Admin dashboard with drag-and-drop upload, inline metadata editing, and progress tracking
- Automatic AVIF/WebP/JPEG content negotiation
- Responsive `srcset` with several width breakpoints
- Cache API edge caching with format-aware cache keys
- Fully free-tier compatible (no paid Cloudflare features required)

## Design

Design is inspired by this brilliant page: [objective.framer.website/people](https://objective.framer.website/people). I also browsed through dozens of other portfolios, stock image platforms, and galleries to get a sense of what I'd want in my own project. Vibe coded most of the UI with Claude, lol, and spent way too long battling random CSS properties and HTML structure.


| Screen  | Preview |
| ------- | ------- |
| Gallery |         |
| Upload  |         |
| Manage  |         |


## Tech stack

Went through a ton of tutorials, guides, and blogs trying to learn about deploying a project like this. Even started developing mindlessly and wasted a ton of time procrastinating when nothing seemed to be working. Finally came across [this video](https://youtu.be/DJtOn_Vt1uw?si=kqS-QjO0yB8mxnMh) and a couple of others from the same creator, which inspired me to take a deeper look into Cloudflare's offerings, and the more I read their documentation, the more I realised this might be the way to go.


| Layer              | Technology                            |
| ------------------ | ------------------------------------- |
| Runtime            | Cloudflare Workers                    |
| Framework          | [Hono](https://hono.dev)              |
| Storage            | Cloudflare R2                         |
| Metadata           | Durable Objects (SQLite-backed)       |
| Image optimization | Cloudflare Image Resizing + Cache API |
| Auth               | Cloudflare Access (admin routes)      |


Every other option I considered (Vercel, Cloudinary, AWS) would either involve stitching together more services, or I feared exhausting the free tier, or felt like I might have to pay up eventually for infrastructure (especially with AWS ugh).

The only comparable alternative is deploying everything on an Oracle Free ARM VPS. That approach would mean handling everything myself, which is great for learning end-to-end deployment, and I'd actually do it for some other project. It would just lack the edge capabilities (not that people from all across the world, or those nasty AI bots  are dying to look at the pictures I clicked).

Cloudflare R2 does support custom metadata on objects, so technically I could have skipped the Durable Object entirely and stored everything alongside the images. But the moment I wanted search, inline editing, custom sort order, and fast listing without scanning the entire bucket on every page load, it made way more sense to use a Durable Object with SQLite. A little more complexity, but a lot more flexibility.

## Project structure

```
src/
  index.ts              Worker entry point and route registration
  types.ts              Shared TypeScript types
  app/                  Worker helpers for auth, cache, admin paths, and bindings
  domain/               Image variant and upload policy rules
  do/ImageIndex.ts      Durable Object for image metadata storage
  routes/               Hono route modules for gallery, media, admin, and site metadata
  html/admin/           Admin page markup, styles, and browser scripts
  html/gallery/         Public gallery markup, styles, and browser script
test/
  do.test.ts            Vitest tests for ImageIndex
  imageVariants.test.ts Image variant and cache purge tests
  routes.test.ts        Admin route behavior tests
```

## Setup

```bash
npm install
```

Copy the example config and fill in your own values:

```bash
cp wrangler.toml.example wrangler.toml
```

Then edit `wrangler.toml` with your account, routes, R2 bucket name, and any optional vars. At minimum you will add something like:

```toml
account_id = "<your-account-id>"
routes = [
  { pattern = "yourdomain.com/*", zone_id = "<your-zone-id>" },
]

[vars]
ADMIN_PATH = "/your-secret-admin-path"
```

`ADMIN_PATH` controls where the admin dashboard lives. Pick something non-obvious, and use the same path in your Cloudflare Access application (e.g. `yourdomain.com/your-secret-admin-path/*`).

For local `wrangler dev` without going through Access, you can temporarily set `ACCESS_BYPASS_DEV = "true"` in `[vars]`. **Do not leave that enabled in production.** See comments in `wrangler.toml.example` for optional `R2_PUBLIC_HOST` and other knobs.

## Development

```bash
npm run dev          # Start local dev server on :8787
npm run check        # Wrangler types / project check
npm test             # Run tests (Vitest)
npm run format       # Format with Prettier
```

## Deployment

```bash
npx wrangler deploy
```

## Admin authentication

The admin dashboard is protected by Cloudflare Access. Configure an Access application in the Cloudflare dashboard to cover `yourdomain.com/<your-admin-path>/*`. The Worker checks for the `cf-access-authenticated-user-email` (or `cf-access-verified-email`) header on admin routes.

## API routes


| Method | Path                         | Auth   | Description                                   |
| ------ | ---------------------------- | ------ | --------------------------------------------- |
| GET    | `/`                          | Public | Gallery page                                  |
| GET    | `/api/images`                | Public | List images (supports `cursor`, `limit`, `q`) |
| GET    | `/media/:id`                 | Public | Original image from R2                        |
| GET    | `/img/:id`                   | Public | Resized/optimized image                       |
| GET    | `/<admin>/`                  | Admin  | Dashboard UI                                  |
| POST   | `/<admin>/api/upload`        | Admin  | Upload image(s)                               |
| POST   | `/<admin>/api/images/update` | Admin  | Update image metadata                         |
| POST   | `/<admin>/api/images/delete` | Admin  | Delete image                                  |


`<admin>` is whatever you set as `ADMIN_PATH` (default in code is `/_admin` if unset).