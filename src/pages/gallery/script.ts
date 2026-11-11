import { GALLERY_FIRST_PAGE_PATH } from '../../domain/contract';
import {
  GALLERY_GRID_DEFAULT_VARIANT,
  GALLERY_GRID_VARIANTS,
  buildBrowserImageUrlHelper,
} from '../../domain/imageVariants';
import {
  emitBrowserByIdHelper,
  emitBrowserFetchHelper,
  emitBrowserPageWalker,
  wrapClientIife,
} from '../shared/script';
import { emitThemeToggle } from '../shared/theme';
import { CLS, CONTACT_EMAIL, ICON, ID } from './markup';
import { PLACEHOLDER_FADE_MS, THEME_COLORS, TILE_SIZES } from './styles';

const CAROUSEL_DETAILS = [
  ['cameraBody', ICON.photo_camera],
  ['filmStock', ICON.camera_roll],
  ['location', ICON.location_on],
  ['year', ICON.calendar_today],
];

export function buildGalleryScript(): string {
  return wrapClientIife(`${emitBrowserByIdHelper()}
${buildBrowserImageUrlHelper()}
  var ESC_CHARS = /[&<>"']/g;
  var ESC_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s).replace(ESC_CHARS, function(ch) { return ESC_ENTITIES[ch]; });
  }
  function imageSrcset(id, variants) {
    return variants.map(function(variant) {
      return imageUrl(id, variant) + ' ' + variant.width + 'w';
    }).join(', ');
  }
${emitBrowserFetchHelper()}
${emitBrowserPageWalker()}
${emitThemeToggle(THEME_COLORS)}

  var grid = byId('${ID.grid}');
  var carousel = byId('${ID.carousel}');
  var cImg = byId('${ID.carouselImg}');
  var cDetails = byId('${ID.carouselDetails}');
  var cCounter = byId('${ID.carouselCounter}');
  var prevBtn = document.querySelector('.${CLS.carouselPrev}');
  var nextBtn = document.querySelector('.${CLS.carouselNext}');
  var closeBtn = document.querySelector('.${CLS.carouselClose}');
  var emailToast = byId('${ID.emailToast}');
  var contactBtn = byId('${ID.contactBtn}');
  var copyEmailBtn = byId('${ID.copyEmail}');
  var copyLabel = byId('${ID.copyLabel}');

  var GRID_DEFAULT_VARIANT = ${JSON.stringify(GALLERY_GRID_DEFAULT_VARIANT)};
  var GRID_VARIANTS = ${JSON.stringify(GALLERY_GRID_VARIANTS)};
  var CONTACT_EMAIL = ${JSON.stringify(CONTACT_EMAIL)};
  var CAROUSEL_DETAILS = ${JSON.stringify(CAROUSEL_DETAILS)};
  var FIRST_SCREEN_TIMEOUT_MS = 4000;

  var allItems = [];
  var currentIndex = -1;
  var touchStartX = 0;
  var touchStartY = 0;
  var lastFocus = null;
  var tileImgs = {};
  /* null until the first page is laid out, then the count of first-screen images still loading. */
  var firstScreenLeft = null;
  var waitingTiles = [];
  var imgCache = {};
  var toastTimer = null;

  function setTileSrc(img, id) {
    img.src = imageUrl(id, GRID_DEFAULT_VARIANT);
    img.srcset = imageSrcset(id, GRID_VARIANTS);
  }

  /* Offscreen tiles wait for the first screen, so on slow links they don't split its bandwidth. */
  function releaseWaitingTiles() {
    firstScreenLeft = 0;
    while (waitingTiles.length) {
      var t = waitingTiles.shift();
      setTileSrc(t.img, t.id);
    }
  }
  function firstScreenSettled() {
    if (firstScreenLeft > 0 && --firstScreenLeft === 0) releaseWaitingTiles();
  }

  /* .masonry uses CSS columns, which fill top to bottom, so measure what is on screen. */
  function startTileLoads(tiles) {
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
  }

  function renderItems(items) {
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
      wrap.style.aspectRatio = item.width && item.height ? item.width + ' / ' + item.height : '3 / 2';

      var ph = document.createElement('div');
      ph.className = 'ph';
      if (item.placeholder) ph.style.background = item.placeholder;
      wrap.appendChild(ph);

      var img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = item.alt || 'Film photograph';
      img.sizes = '${TILE_SIZES}';
      tiles.push({ el: el, img: img, id: item.id });
      (function(phEl, imgEl) {
        imgEl.addEventListener('load', function() {
          phEl.style.opacity = '0';
          setTimeout(function(){ phEl.remove(); }, ${PLACEHOLDER_FADE_MS});
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
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function messageEl(text) {
    var div = document.createElement('div');
    div.className = 'gallery-message';
    div.textContent = text;
    return div;
  }

  function fetchInitial() {
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
  }

  /* The carousel uses the grid variants, so on a phone it reuses the image its tile already loaded. */
  function preloadImage(id) {
    if (imgCache[id]) return imgCache[id];
    var img = new Image();
    setTileSrc(img, id);
    img.sizes = '90vw';
    imgCache[id] = img;
    return img;
  }

  function preloadNeighbors(idx) {
    var offsets = [-2, -1, 1, 2];
    for (var o = 0; o < offsets.length; o++) {
      var ni = (idx + offsets[o] + allItems.length) % allItems.length;
      if (ni !== idx && allItems[ni]) preloadImage(allItems[ni].id);
    }
  }

  function updateMeta(idx) {
    var item = allItems[idx];
    var html = '';
    CAROUSEL_DETAILS.forEach(function(d) {
      if (!item[d[0]]) return;
      html += '<div class="detail-item"><span class="material-symbols-outlined" aria-hidden="true">' + d[1] + '</span><span>' + esc(item[d[0]]) + '</span></div>';
    });
    cDetails.innerHTML = html;
    cCounter.textContent = String(idx+1).padStart(2,'0') + ' / ' + String(allItems.length).padStart(2,'0');
  }

  function showCarouselIndex(idx) {
    if (idx < 0 || idx >= allItems.length) return;
    currentIndex = idx;
    var item = allItems[idx];
    updateMeta(idx);
    if (!carousel.open) carousel.showModal();
    document.body.style.overflow = 'hidden';

    var pre = preloadImage(item.id);
    cImg.alt = item.alt || 'Film photograph';

    function showFull() {
      if (currentIndex !== idx) return;
      cImg.srcset = pre.srcset;
      cImg.sizes = pre.sizes;
      cImg.src = pre.src;
      cImg.classList.remove('loading');
      carousel.removeAttribute('aria-busy');
      preloadNeighbors(idx);
    }

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
  }

  function openCarousel(id) {
    var idx = -1;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === id) { idx = i; break; } }
    if (idx !== -1) {
      lastFocus = document.activeElement;
      showCarouselIndex(idx);
    }
  }

  function closeCarousel() {
    if (carousel.open) carousel.close();
    document.body.style.overflow = '';
  }

  initThemeToggle();

  carousel.addEventListener('close', function() {
    document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
  carousel.addEventListener('click', function(e) {
    if (e.target === carousel || !e.target.closest('.${CLS.carouselContent}')) closeCarousel();
  });
  closeBtn.addEventListener('click', function(e){ e.stopPropagation(); closeCarousel(); });
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

  contactBtn.addEventListener('click', function(){
    emailToast.classList.toggle('visible');
    if (emailToast.classList.contains('visible')) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function(){ emailToast.classList.remove('visible'); }, 6000);
    }
  });
  copyEmailBtn.addEventListener('click', function(){
    navigator.clipboard.writeText(CONTACT_EMAIL).then(function(){
      copyLabel.textContent = 'Copied';
      setTimeout(function(){ copyLabel.textContent = 'Copy'; }, 1500);
    }).catch(function(){ prompt('Copy email:', CONTACT_EMAIL); });
  });
  document.addEventListener('click', function(e){
    if (!emailToast.contains(e.target) && e.target !== contactBtn) {
      emailToast.classList.remove('visible');
    }
  });

  fetchInitial();`);
}
