import {
  CAROUSEL_DEFAULT_VARIANT,
  CAROUSEL_VARIANTS,
  GALLERY_GRID_DEFAULT_VARIANT,
  GALLERY_GRID_VARIANTS,
} from '../../domain/imageVariants';

export function buildGalleryScript(): string {
  const gridDefaultVariant = JSON.stringify(GALLERY_GRID_DEFAULT_VARIANT);
  const gridVariants = JSON.stringify(GALLERY_GRID_VARIANTS);
  const carouselDefaultVariant = JSON.stringify(CAROUSEL_DEFAULT_VARIANT);
  const carouselVariants = JSON.stringify(CAROUSEL_VARIANTS);

  return `<script>
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
</script>`;
}
