export function buildGalleryStyles(): string {
  return `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}

/* ── Theme tokens ── */
:root,[data-theme="dark"]{
  --bg:#000;--surface:#0a0a0a;--surface-high:#111;
  --text:#fff;--text-dim:rgba(255,255,255,0.4);--text-muted:rgba(255,255,255,0.25);
  --nav-bg:rgba(0,0,0,0.80);--border:rgba(255,255,255,0.05);
  --carousel-bg:#131313;
}
[data-theme="light"]{
  --bg:#f5f3f0;--surface:#eae7e3;--surface-high:#ddd9d4;
  --text:#1a1a1a;--text-dim:rgba(0,0,0,0.45);--text-muted:rgba(0,0,0,0.2);
  --nav-bg:rgba(245,243,240,0.85);--border:rgba(0,0,0,0.08);
  --carousel-bg:#f5f3f0;
}

body{
  background:var(--bg);color:var(--text);
  font-family:'Inter',system-ui,-apple-system,sans-serif;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  min-height:100vh;display:flex;flex-direction:column;
  transition:background 0.4s,color 0.4s;
}
::selection{background:var(--text);color:var(--bg)}
:focus-visible{outline:2px solid var(--text-dim);outline-offset:2px}
.skip-link{
  position:absolute;top:-100%;left:1rem;padding:0.5rem 1rem;
  background:var(--text);color:var(--bg);z-index:200;font-size:0.875rem;text-decoration:none;
}
.skip-link:focus{top:1rem}
.material-symbols-outlined{
  font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;
  vertical-align:middle;
}

/* ── Navigation ── */
.site-nav{
  position:fixed;top:0;width:100%;z-index:50;
  display:flex;justify-content:space-between;align-items:center;
  padding:1.5rem 2rem;
  background:var(--nav-bg);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  transition:background 0.4s;
}
.brand{
  font-family:'Epilogue',sans-serif;font-size:0.875rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.2em;color:var(--text);text-decoration:none;
  transition:color 0.4s;
}
.nav-actions{display:flex;align-items:center;gap:2rem}
.theme-toggle,.github-link{
  background:none;border:none;cursor:pointer;padding:0;
  color:var(--text-dim);transition:color 0.3s;font-size:0;line-height:1;
  display:inline-flex;align-items:center;
}
.theme-toggle:hover,.github-link:hover{color:var(--text)}
.theme-toggle .material-symbols-outlined{font-size:20px}
.github-link svg{width:20px;height:20px;fill:currentColor}
.icon-dark,.icon-light{display:none}
[data-theme="dark"] .icon-light{display:inline}
[data-theme="light"] .icon-dark{display:inline}

/* ── Hero ── */
.hero{
  padding:12rem 2rem 8rem;text-align:center;
  max-width:1800px;margin:0 auto;width:100%;
}
.hero-title{
  font-family:'Epilogue',sans-serif;
  font-size:clamp(2.5rem,10vw,8rem);
  line-height:0.85;font-weight:900;
  letter-spacing:-0.04em;text-transform:uppercase;color:var(--text);
  margin-bottom:1.5rem;transition:color 0.4s;
}
.hero-sub{
  font-family:'Epilogue',sans-serif;font-size:0.7rem;
  text-transform:uppercase;letter-spacing:0.4em;
  color:var(--text-dim);font-weight:600;transition:color 0.4s;
}

/* ── Masonry Grid ── */
.masonry{
  column-count:1;column-gap:2rem;
  max-width:1800px;margin:0 auto;padding:0 2rem 6rem;
}
@media(min-width:768px){.masonry{column-count:2}}
@media(min-width:1280px){.masonry{column-count:3}}
.masonry-item{break-inside:avoid;margin-bottom:3rem;cursor:pointer}
.img-wrap{
  overflow:hidden;background:var(--surface);margin-bottom:1.5rem;position:relative;
  transition:background 0.4s;
}
.img-wrap .ph{
  position:absolute;inset:0;filter:blur(20px);transform:scale(1.1);
  transition:opacity 0.4s ease;z-index:1;
}
.masonry-item img{
  width:100%;height:auto;display:block;object-fit:cover;
  opacity:0;transition:transform 1s cubic-bezier(0.16,1,0.3,1),opacity 0.4s ease;
  position:relative;z-index:2;
}
.masonry-item img.loaded{opacity:1}
.masonry-item:hover img{transform:scale(1.05)}
.caption p{
  font-family:'Epilogue',sans-serif;font-size:0.6rem;
  text-transform:uppercase;letter-spacing:0.15em;
  color:var(--text);font-weight:700;transition:color 0.4s;
}
#sentinel{height:2px}

/* ── Carousel / Lightbox ── */
.carousel{
  position:fixed;inset:0;z-index:100;background:var(--carousel-bg);
  display:none;flex-direction:column;align-items:center;justify-content:center;
  overflow:hidden;transition:background 0.4s;
}
.carousel.open{display:flex}
.carousel-nav-btn{
  position:absolute;top:50%;transform:translateY(-50%);z-index:110;
  background:none;border:none;cursor:pointer;padding:1rem;
  color:var(--text-muted);transition:color 0.3s;
}
.carousel-nav-btn:hover{color:var(--text)}
.carousel-nav-btn .material-symbols-outlined{
  font-size:2.5rem;
  font-variation-settings:'FILL' 0,'wght' 200,'GRAD' 0,'opsz' 48;
}
.carousel-prev{left:1rem}
.carousel-next{right:1rem}
@media(min-width:768px){.carousel-prev{left:3rem}.carousel-next{right:3rem}}
.carousel-close{
  position:absolute;top:1.5rem;right:2rem;z-index:110;
  background:none;border:none;cursor:pointer;
  color:var(--text-dim);transition:color 0.3s;font-size:0;line-height:1;
}
.carousel-close:hover{color:var(--text)}
.carousel-close .material-symbols-outlined{font-size:24px}
.carousel-content{
  width:100%;max-width:1400px;padding:5rem 2rem 2rem;
  display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;
}
.carousel-img-wrap{
  flex:1;display:flex;align-items:center;justify-content:center;
  width:100%;overflow:hidden;min-height:0;
}
.carousel-img-wrap img{max-width:100%;max-height:70vh;object-fit:contain;display:block;transition:opacity 0.2s ease}
.carousel-img-wrap img.loading{opacity:0.4}
.carousel-meta{margin-top:2rem;text-align:center;width:100%}
.carousel-details{
  display:flex;flex-wrap:wrap;justify-content:center;align-items:center;
  gap:1.5rem 3rem;
  font-family:'Epilogue',sans-serif;font-size:0.6875rem;
  text-transform:uppercase;letter-spacing:0.2em;
  color:var(--text-dim);font-weight:700;transition:color 0.4s;
}
.detail-item{display:flex;align-items:center;gap:0.5rem}
.detail-item .material-symbols-outlined{font-size:1rem}
.carousel-counter{
  margin-top:1.5rem;
  font-family:'Inter',sans-serif;font-size:0.625rem;
  text-transform:uppercase;letter-spacing:0.3em;
  color:var(--text-muted);font-weight:700;transition:color 0.4s;
}
.carousel-divider{width:2rem;height:1px;background:var(--text-muted);margin:0.75rem auto 0;transition:background 0.4s}

/* ── Footer ── */
.site-footer{
  width:100%;display:flex;flex-direction:column;align-items:center;gap:2.5rem;
  border-top:1px solid var(--border);padding:6rem 0 3rem;margin-top:auto;
  transition:border-color 0.4s;
}
.footer-brand{
  font-family:'Epilogue',sans-serif;font-size:0.65rem;
  letter-spacing:0.4em;text-transform:uppercase;
  color:var(--text-muted);font-weight:600;transition:color 0.4s;
}
.footer-links{display:flex;gap:3rem}
.footer-links a,.footer-links button{
  font-family:'Epilogue',sans-serif;font-size:0.7rem;
  text-transform:uppercase;letter-spacing:0.2em;font-weight:700;
  color:var(--text-dim);text-decoration:none;background:none;border:none;cursor:pointer;
  transition:all 0.3s;text-underline-offset:0.5rem;padding:0;
}
.footer-links a:hover,.footer-links button:hover{color:var(--text);text-decoration:underline}
.footer-copyright{
  font-family:'Inter',sans-serif;font-size:0.6rem;
  letter-spacing:0.1em;color:var(--text-muted);
  transition:color 0.4s;
}
.email-toast{
  position:fixed;bottom:-5rem;left:50%;transform:translateX(-50%);z-index:200;
  display:flex;align-items:center;gap:1rem;
  background:var(--surface-high);border:1px solid var(--border);
  padding:1rem 1.5rem;
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  transition:bottom 0.4s cubic-bezier(0.16,1,0.3,1);
}
.email-toast.visible{bottom:2rem}
.email-toast-addr{
  font-family:'Inter',sans-serif;font-size:0.875rem;font-weight:500;
  color:var(--text);letter-spacing:0.02em;user-select:all;
}
.email-toast-copy{
  background:none;border:none;cursor:pointer;color:var(--text-dim);
  transition:color 0.3s;padding:0;font-size:0;line-height:1;
}
.email-toast-copy:hover{color:var(--text)}
.email-toast-copy .material-symbols-outlined{font-size:18px}
.email-toast-label{
  font-family:'Inter',sans-serif;font-size:0.625rem;
  color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;
}
</style>`;
}
