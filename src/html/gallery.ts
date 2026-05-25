import {
  CAROUSEL_DEFAULT_VARIANT,
  CAROUSEL_VARIANTS,
  GALLERY_GRID_DEFAULT_VARIANT,
  GALLERY_GRID_VARIANTS,
} from '../imageVariants';

export function buildGalleryHTML(baseUrl: string): string {
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'Stills from my film camera',
    description: 'A curated collection of photographs I took with my film camera.',
    url: baseUrl,
  });
  const gridDefaultVariant = JSON.stringify(GALLERY_GRID_DEFAULT_VARIANT);
  const gridVariants = JSON.stringify(GALLERY_GRID_VARIANTS);
  const carouselDefaultVariant = JSON.stringify(CAROUSEL_DEFAULT_VARIANT);
  const carouselVariants = JSON.stringify(CAROUSEL_VARIANTS);

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Stills from my film camera</title>
<meta name="description" content="A curated collection of photographs I took with my film camera." />
<meta name="theme-color" content="#000000" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Stills from my film camera" />
<meta property="og:description" content="A curated collection of photographs I took with my film camera." />
<meta property="og:url" content="${baseUrl}" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="canonical" href="${baseUrl}" />
<link rel="preload" href="/api/images?limit=200" as="fetch" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" media="print" onload="this.media='all'" />
<script type="application/ld+json">${structuredData}</script>
<style>
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
</style>
</head>
<body>
<a href="#gallery" class="skip-link">Skip to gallery</a>

<nav class="site-nav" role="navigation" aria-label="Main navigation">
  <a href="/" class="brand" aria-label="Home"></a>
  <div class="nav-actions">
    <a href="https://github.com/Aanjney/cloudflare-image-gallery" target="_blank" rel="noopener noreferrer" class="github-link" aria-label="View source on GitHub">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>
    </a>
    <button class="theme-toggle" type="button" id="themeToggle" aria-label="Toggle light/dark mode">
      <span class="material-symbols-outlined icon-light">light_mode</span>
      <span class="material-symbols-outlined icon-dark">dark_mode</span>
    </button>
  </div>
</nav>

<header class="hero">
  <h1 class="hero-title">Stills from my<br>film camera</h1>
  <p class="hero-sub">A project by Aanjney</p>
</header>

<main id="gallery">
  <div id="grid" class="masonry"></div>
  <div id="sentinel"></div>
</main>

<div class="carousel" id="carousel" role="dialog" aria-modal="true" aria-label="Image viewer">
  <button class="carousel-close" type="button" aria-label="Close viewer">
    <span class="material-symbols-outlined">close</span>
  </button>
  <button class="carousel-nav-btn carousel-prev" type="button" aria-label="Previous image">
    <span class="material-symbols-outlined">chevron_left</span>
  </button>
  <button class="carousel-nav-btn carousel-next" type="button" aria-label="Next image">
    <span class="material-symbols-outlined">chevron_right</span>
  </button>
  <div class="carousel-content">
    <div class="carousel-img-wrap">
      <img id="carouselImg" alt="" decoding="async" />
    </div>
    <div class="carousel-meta">
      <div class="carousel-details" id="carouselDetails"></div>
      <div class="carousel-counter" id="carouselCounter"></div>
      <div class="carousel-divider"></div>
    </div>
  </div>
</div>

<footer class="site-footer">
  <div class="footer-brand">A project by Aanjney</div>
  <div class="footer-links">
    <a href="/">Archives</a>
    <button type="button" id="contactBtn">Contact</button>
  </div>
  <div class="email-toast" id="emailToast">
    <span class="email-toast-addr">aanjneygupta43@gmail.com</span>
    <button class="email-toast-copy" type="button" id="copyEmail" aria-label="Copy email">
      <span class="material-symbols-outlined">content_copy</span>
    </button>
    <span class="email-toast-label" id="copyLabel">Copy</span>
  </div>
  <div class="footer-copyright">&copy; ${new Date().getFullYear()} Aanjney. All rights reserved.</div>
</footer>

<script>
(function(){
  /* ── Theme toggle ── */
  var html = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') html.setAttribute('data-theme', stored);
  toggle.addEventListener('click', function(){
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  var grid = document.getElementById('grid');
  var carousel = document.getElementById('carousel');
  var cImg = document.getElementById('carouselImg');
  var cDetails = document.getElementById('carouselDetails');
  var cCounter = document.getElementById('carouselCounter');
  var prevBtn = document.querySelector('.carousel-prev');
  var nextBtn = document.querySelector('.carousel-next');
  var closeBtn = document.querySelector('.carousel-close');

  var allItems = [];
  var currentIndex = -1;
  var touchStartX = 0;
  var touchStartY = 0;
  var GRID_DEFAULT_VARIANT = ${gridDefaultVariant};
  var GRID_VARIANTS = ${gridVariants};
  var CAROUSEL_DEFAULT_VARIANT = ${carouselDefaultVariant};
  var CAROUSEL_VARIANTS = ${carouselVariants};

  var esc = function(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  var imageUrl = function(id, variant) {
    return '/img/' + id + '?w=' + variant.width + '&q=' + variant.quality + '&fmt=' + variant.format;
  };
  var imageSrcset = function(id, variants) {
    return variants.map(function(variant) {
      return imageUrl(id, variant) + ' ' + variant.width + 'w';
    }).join(', ');
  };

  var renderItems = function(items) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var el = document.createElement('div');
      el.className = 'masonry-item';
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.setAttribute('aria-label','View photograph' + (item.location ? ' from ' + item.location : ''));

      var wrap = document.createElement('div');
      wrap.className = 'img-wrap';
      if (item.width && item.height) {
        wrap.style.aspectRatio = item.width + ' / ' + item.height;
      }

      var ph = document.createElement('div');
      ph.className = 'ph';
      ph.style.background = item.placeholder || 'var(--surface)';
      wrap.appendChild(ph);

      var img = document.createElement('img');
      var isAboveFold = (grid.childElementCount + frag.childElementCount) < 3;
      img.loading = isAboveFold ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.alt = item.name || item.alt || 'Film photograph';
      img.src = imageUrl(item.id, GRID_DEFAULT_VARIANT);
      img.srcset = imageSrcset(item.id, GRID_VARIANTS);
      img.sizes = '(max-width:420px) 96vw,(max-width:640px) 88vw,(max-width:900px) 50vw,(max-width:1200px) 36vw,28vw';
      if (isAboveFold) {
        img.fetchPriority = 'high';
      }
      (function(phEl, imgEl) {
        imgEl.addEventListener('load', function() {
          phEl.style.opacity = '0';
          setTimeout(function(){ phEl.remove(); }, 400);
          imgEl.classList.add('loaded');
        });
      })(ph, img);

      wrap.appendChild(img);
      el.appendChild(wrap);

      var caption = document.createElement('div');
      caption.className = 'caption';
      var parts = [];
      if (item.location) parts.push(item.location);
      if (item.year) parts.push(item.year);
      if (parts.length) {
        var p = document.createElement('p');
        p.textContent = parts.join(' \\u2022 ');
        caption.appendChild(p);
      }
      el.appendChild(caption);

      (function(itemId) {
        el.addEventListener('click', function(){ openCarousel(itemId); });
        el.addEventListener('keydown', function(e){
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCarousel(itemId); }
        });
      })(item.id);

      frag.appendChild(el);
    }
    grid.appendChild(frag);
  };

  var shuffle = function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  };

  var fetchInitial = function() {
    fetch('/api/images?limit=200')
      .then(function(r){ return r.json(); })
      .then(function(data){
        var items = shuffle(data.items || []);
        allItems = allItems.concat(items);
        renderItems(items);
      })
      .catch(function(){});
  };

  /* ── Carousel ── */
  var imgCache = {};
  var carouselUrl = function(id) { return imageUrl(id, CAROUSEL_DEFAULT_VARIANT); };

  var preloadImage = function(id) {
    if (imgCache[id]) return imgCache[id];
    var img = new Image();
    img.src = carouselUrl(id);
    img.srcset = imageSrcset(id, CAROUSEL_VARIANTS);
    img.sizes = '90vw';
    imgCache[id] = img;
    return img;
  };

  var preloadNeighbors = function(idx) {
    var offsets = [-2, -1, 1, 2];
    for (var o = 0; o < offsets.length; o++) {
      var ni = (idx + offsets[o] + allItems.length) % allItems.length;
      if (ni !== idx && allItems[ni]) preloadImage(allItems[ni].id);
    }
  };

  var updateMeta = function(idx) {
    var item = allItems[idx];
    var html = '';
    if (item.cameraBody) {
      html += '<div class="detail-item"><span class="material-symbols-outlined">photo_camera</span><span>' + esc(item.cameraBody) + '</span></div>';
    }
    if (item.filmStock) {
      html += '<div class="detail-item"><span class="material-symbols-outlined">camera_roll</span><span>' + esc(item.filmStock) + '</span></div>';
    }
    if (item.location) {
      html += '<div class="detail-item"><span class="material-symbols-outlined">location_on</span><span>' + esc(item.location) + '</span></div>';
    }
    if (item.year) {
      html += '<div class="detail-item"><span class="material-symbols-outlined">calendar_today</span><span>' + esc(item.year) + '</span></div>';
    }
    cDetails.innerHTML = html;
    cCounter.textContent = String(idx+1).padStart(2,'0') + ' / ' + String(allItems.length).padStart(2,'0');
  };

  var showCarouselIndex = function(idx) {
    if (idx < 0 || idx >= allItems.length) return;
    currentIndex = idx;
    var item = allItems[idx];
    updateMeta(idx);
    carousel.classList.add('open');
    document.body.style.overflow = 'hidden';

    var pre = preloadImage(item.id);
    cImg.alt = item.name || item.alt || 'Film photograph';

    if (pre.complete && pre.naturalWidth > 0) {
      cImg.classList.remove('loading');
      cImg.src = pre.src;
      cImg.srcset = pre.srcset;
      cImg.sizes = '90vw';
    } else {
      cImg.classList.add('loading');
      pre.decode().then(function(){
        if (currentIndex !== idx) return;
        cImg.src = pre.src;
        cImg.srcset = pre.srcset;
        cImg.sizes = '90vw';
        cImg.classList.remove('loading');
      }).catch(function(){
        if (currentIndex !== idx) return;
        cImg.src = pre.src;
        cImg.srcset = pre.srcset;
        cImg.sizes = '90vw';
        cImg.classList.remove('loading');
      });
    }

    preloadNeighbors(idx);
  };

  var openCarousel = function(id) {
    var idx = -1;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === id) { idx = i; break; } }
    if (idx !== -1) showCarouselIndex(idx);
  };

  var closeCarouselFn = function() {
    carousel.classList.remove('open');
    document.body.style.overflow = '';
  };

  carousel.addEventListener('click', function(e) {
    if (e.target === carousel || !e.target.closest('.carousel-content')) closeCarouselFn();
  });
  closeBtn.addEventListener('click', function(e){ e.stopPropagation(); closeCarouselFn(); });
  prevBtn.addEventListener('click', function(e){
    e.stopPropagation();
    showCarouselIndex((currentIndex - 1 + allItems.length) % allItems.length);
  });
  nextBtn.addEventListener('click', function(e){
    e.stopPropagation();
    showCarouselIndex((currentIndex + 1) % allItems.length);
  });
  cImg.addEventListener('click', function(e){ e.stopPropagation(); });
  document.addEventListener('keydown', function(e){
    if (!carousel.classList.contains('open')) return;
    if (e.key === 'Escape') closeCarouselFn();
    if (e.key === 'ArrowRight') showCarouselIndex((currentIndex + 1) % allItems.length);
    if (e.key === 'ArrowLeft') showCarouselIndex((currentIndex - 1 + allItems.length) % allItems.length);
  });
  carousel.addEventListener('touchstart', function(e){
    if (e.touches[0]) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
  });
  carousel.addEventListener('touchend', function(e){
    var touch = e.changedTouches[0]; if (!touch) return;
    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx < 0) showCarouselIndex((currentIndex + 1) % allItems.length);
      else showCarouselIndex((currentIndex - 1 + allItems.length) % allItems.length);
    }
  });

  /* ── Contact toast ── */
  var emailToast = document.getElementById('emailToast');
  var contactBtn = document.getElementById('contactBtn');
  var copyEmailBtn = document.getElementById('copyEmail');
  var copyLabel = document.getElementById('copyLabel');
  var toastTimer = null;
  contactBtn.addEventListener('click', function(){
    emailToast.classList.toggle('visible');
    if (emailToast.classList.contains('visible')) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ emailToast.classList.remove('visible'); }, 6000);
    }
  });
  copyEmailBtn.addEventListener('click', function(){
    navigator.clipboard.writeText('aanjneygupta43@gmail.com').then(function(){
      copyLabel.textContent = 'Copied';
      setTimeout(function(){ copyLabel.textContent = 'Copy'; }, 1500);
    }).catch(function(){});
  });
  document.addEventListener('click', function(e){
    if (!emailToast.contains(e.target) && e.target !== contactBtn) {
      emailToast.classList.remove('visible');
    }
  });

  fetchInitial();
})();
</script>
</body>
</html>`;
}
