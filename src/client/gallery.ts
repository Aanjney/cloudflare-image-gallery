import {
  GALLERY_GRID_DEFAULT_VARIANT,
  GALLERY_GRID_VARIANTS,
  GALLERY_FIRST_PAGE_PATH,
} from '../domain/imageVariants';
import {
  emitBrowserEscHelper,
  emitBrowserFetchHelper,
  emitBrowserImageUrlHelpers,
  emitBrowserPageWalker,
  emitThemeToggle,
  wrapClientIife,
} from './buildClientScript';

export function buildGalleryScript(): string {
  const gridDefaultVariant = JSON.stringify(GALLERY_GRID_DEFAULT_VARIANT);
  const gridVariants = JSON.stringify(GALLERY_GRID_VARIANTS);

  return wrapClientIife(`  /* ── Theme toggle ── */
${emitThemeToggle()}

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
  var lastFocus = null;
  var GRID_DEFAULT_VARIANT = ${gridDefaultVariant};
  var GRID_VARIANTS = ${gridVariants};
  var tileImgs = {};
  /* null until the first page is laid out, then the count of first-screen images still loading. */
  var firstScreenLeft = null;
  var waitingTiles = [];
  var FIRST_SCREEN_TIMEOUT_MS = 4000;

${emitBrowserEscHelper()}
${emitBrowserImageUrlHelpers()}
${emitBrowserFetchHelper()}
${emitBrowserPageWalker()}

  var setTileSrc = function(img, id) {
    img.src = imageUrl(id, GRID_DEFAULT_VARIANT);
    img.srcset = imageSrcset(id, GRID_VARIANTS);
  };

  /* Offscreen tiles wait for the first screen, so on slow links they don't split its bandwidth. */
  var releaseWaitingTiles = function() {
    firstScreenLeft = 0;
    while (waitingTiles.length) {
      var t = waitingTiles.shift();
      setTileSrc(t.img, t.id);
    }
  };
  var firstScreenSettled = function() {
    if (firstScreenLeft > 0 && --firstScreenLeft === 0) releaseWaitingTiles();
  };

  /* .masonry uses CSS columns, which fill top to bottom, so measure what is on screen. */
  var startTileLoads = function(tiles) {
    if (firstScreenLeft !== null) {
      for (var i = 0; i < tiles.length; i++) {
        if (firstScreenLeft > 0) waitingTiles.push(tiles[i]);
        else setTileSrc(tiles[i].img, tiles[i].id);
      }
      return;
    }
    firstScreenLeft = 0;
    for (var j = 0; j < tiles.length; j++) {
      var t = tiles[j];
      if (t.el.getBoundingClientRect().top < innerHeight) {
        firstScreenLeft++;
        t.img.loading = 'eager';
        t.img.fetchPriority = 'high';
        t.img.addEventListener('load', firstScreenSettled);
        t.img.addEventListener('error', firstScreenSettled);
        setTileSrc(t.img, t.id);
      } else {
        waitingTiles.push(t);
      }
    }
    if (firstScreenLeft === 0) releaseWaitingTiles();
    else setTimeout(releaseWaitingTiles, FIRST_SCREEN_TIMEOUT_MS);
  };

  var renderItems = function(items) {
    var frag = document.createDocumentFragment();
    var tiles = [];
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
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = item.alt || 'Film photograph';
      img.sizes = '(max-width:420px) 96vw,(max-width:640px) 88vw,(max-width:900px) 50vw,(max-width:1200px) 36vw,28vw';
      tiles.push({ el: el, img: img, id: item.id });
      (function(phEl, imgEl) {
        imgEl.addEventListener('load', function() {
          phEl.style.opacity = '0';
          setTimeout(function(){ phEl.remove(); }, 400);
          imgEl.classList.add('loaded');
        });
      })(ph, img);

      tileImgs[item.id] = img;
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
    startTileLoads(tiles);
  };

  var shuffle = function(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  };

  /* The first URL matches the <link rel="preload"> in the page head. */
  var messageEl = function(text) {
    var div = document.createElement('div');
    div.className = 'gallery-message';
    div.textContent = text;
    return div;
  };

  var fetchInitial = function() {
    var failed = false;
    var seenIds = {};
    forEachImagePage(${JSON.stringify(GALLERY_FIRST_PAGE_PATH)}, function(items) {
      /* Pages can overlap when photos are added or deleted between requests. */
      var page = shuffle(items.filter(function(item) {
        if (seenIds[item.id]) return false;
        seenIds[item.id] = true;
        return true;
      }));
      allItems = allItems.concat(page);
      renderItems(page);
      if (carousel.open && currentIndex >= 0) updateMeta(currentIndex);
    }, function() {
      failed = true;
    }).then(function() {
      if (!allItems.length) {
        grid.appendChild(messageEl(failed ? 'Photos didn\\'t load. Refresh the page to try again.' : 'No photos yet.'));
      }
    });
  };

  /* ── Carousel ── */
  var imgCache = {};

  /* The carousel uses the grid variants, so on a phone it reuses the image its tile already loaded. */
  var preloadImage = function(id) {
    if (imgCache[id]) return imgCache[id];
    var img = new Image();
    img.src = imageUrl(id, GRID_DEFAULT_VARIANT);
    img.srcset = imageSrcset(id, GRID_VARIANTS);
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
      html += '<div class="detail-item"><span class="material-symbols-outlined" aria-hidden="true">photo_camera</span><span>' + esc(item.cameraBody) + '</span></div>';
    }
    if (item.filmStock) {
      html += '<div class="detail-item"><span class="material-symbols-outlined" aria-hidden="true">camera_roll</span><span>' + esc(item.filmStock) + '</span></div>';
    }
    if (item.location) {
      html += '<div class="detail-item"><span class="material-symbols-outlined" aria-hidden="true">location_on</span><span>' + esc(item.location) + '</span></div>';
    }
    if (item.year) {
      html += '<div class="detail-item"><span class="material-symbols-outlined" aria-hidden="true">calendar_today</span><span>' + esc(item.year) + '</span></div>';
    }
    cDetails.innerHTML = html;
    cCounter.textContent = String(idx+1).padStart(2,'0') + ' / ' + String(allItems.length).padStart(2,'0');
  };

  var showCarouselIndex = function(idx) {
    if (idx < 0 || idx >= allItems.length) return;
    currentIndex = idx;
    var item = allItems[idx];
    updateMeta(idx);
    if (!carousel.open) carousel.showModal();
    document.body.style.overflow = 'hidden';

    var pre = preloadImage(item.id);
    cImg.alt = item.alt || 'Film photograph';

    var showFull = function() {
      if (currentIndex !== idx) return;
      cImg.srcset = pre.srcset;
      cImg.sizes = pre.sizes;
      cImg.src = pre.src;
      cImg.classList.remove('loading');
      carousel.removeAttribute('aria-busy');
      preloadNeighbors(idx);
    };

    if (pre.complete && pre.naturalWidth > 0) {
      showFull();
    } else {
      var tile = tileImgs[item.id];
      cImg.srcset = '';
      if (tile && tile.complete && tile.naturalWidth > 0) cImg.src = tile.currentSrc;
      else cImg.removeAttribute('src');
      cImg.classList.add('loading');
      carousel.setAttribute('aria-busy', 'true');
      pre.decode().then(showFull, showFull);
    }
  };

  var openCarousel = function(id) {
    var idx = -1;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === id) { idx = i; break; } }
    if (idx !== -1) {
      lastFocus = document.activeElement;
      showCarouselIndex(idx);
    }
  };

  var closeCarouselFn = function() {
    if (carousel.open) carousel.close();
    document.body.style.overflow = '';
  };

  carousel.addEventListener('close', function() {
    document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });

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
    if (!carousel.open) return;
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

  fetchInitial();`);
}
