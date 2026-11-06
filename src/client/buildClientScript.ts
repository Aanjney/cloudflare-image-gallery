import { buildBrowserImageUrlHelper } from '../domain/imageVariants';

export function wrapClientIife(body: string): string {
  return `<script>\n(function(){\n${body}\n})();\n</script>`;
}

export function emitBrowserImageUrlHelpers(): string {
  return `${buildBrowserImageUrlHelper()}
  var imageSrcset = function(id, variants) {
    return variants.map(function(variant) {
      return imageUrl(id, variant) + ' ' + variant.width + 'w';
    }).join(', ');
  };`;
}

export function emitBrowserEscHelper(): string {
  return `  var ESC_CHARS = /[&<>"']/g;
  var ESC_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function(s) {
    return String(s).replace(ESC_CHARS, function(ch) { return ESC_ENTITIES[ch]; });
  };`;
}

export function emitBrowserAltHelper(): string {
  return `  var altFromMeta = function(meta, fallback) {
    var parts = [meta.filmStock, meta.cameraBody, meta.location, meta.year].filter(Boolean);
    return parts.length ? 'Film photograph: ' + parts.join(', ') : fallback;
  };`;
}

/**
 * Browser fetch with a per-attempt timeout and capped full-jitter retries on network errors,
 * timeouts, 429 and 5xx. Mirrors src/app/retry.ts. Pass attempts: 1 for non-idempotent calls.
 */
export function emitBrowserFetchHelper(): string {
  return `  var fetchWithRetry = function(url, init, opts) {
    opts = opts || {};
    var attempts = opts.attempts || 1;
    var timeoutMs = opts.timeoutMs || 15000;
    var baseMs = opts.baseMs || 500;
    var capMs = opts.capMs || 4000;
    var attemptOnce = function() {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var reqInit = {};
      for (var k in (init || {})) reqInit[k] = init[k];
      if (controller) reqInit.signal = controller.signal;
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          if (controller) controller.abort();
          var err = new Error('Request timed out');
          err.name = 'TimeoutError';
          reject(err);
        }, timeoutMs);
        fetch(url, reqInit).then(function(r) { clearTimeout(timer); resolve(r); },
          function(e) { clearTimeout(timer); reject(e); });
      });
    };
    var run = function(attempt) {
      var retryLater = function(result, isError) {
        if (attempt + 1 >= attempts) return isError ? Promise.reject(result) : result;
        var delay = Math.random() * Math.min(capMs, baseMs * Math.pow(2, attempt));
        return new Promise(function(r) { setTimeout(r, delay); }).then(function() { return run(attempt + 1); });
      };
      return attemptOnce().then(function(r) {
        return (r.status === 429 || r.status >= 500) ? retryLater(r, false) : r;
      }, function(e) { return retryLater(e, true); });
    };
    return run(0);
  };`;
}

/**
 * Calls onPage with each page's items. Resolves after the last page, a repeated cursor, or an
 * error. Needs emitBrowserFetchHelper() earlier in the same script.
 */
export function emitBrowserPageWalker(): string {
  return `  var forEachImagePage = function(firstUrl, onPage, onError, init) {
    var seen = {};
    var load = function(url) {
      return fetchWithRetry(url, init, { attempts: 3, timeoutMs: 10000 }).then(function(r){
        if (!r.ok) throw new Error('Image list request failed: HTTP ' + r.status);
        return r.json();
      }).then(function(d){
        onPage(d.items || []);
        var cursor = d.cursor;
        if (!cursor || seen[cursor]) return;
        seen[cursor] = true;
        return load(firstUrl + '&cursor=' + encodeURIComponent(cursor));
      }).catch(function(err){
        if (onError) onError(err);
      });
    };
    return load(firstUrl);
  };`;
}

/**
 * Inline head script that sets data-theme and theme-color before first paint. A stored choice
 * wins, otherwise the system preference. Place it after the theme-color meta.
 */
export function emitThemeBootstrap(colors: { dark: string; light: string }): string {
  return `<script>(function(){
  var t;
  try { t = localStorage.getItem('theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'light' ? ${JSON.stringify(colors.light)} : ${JSON.stringify(colors.dark)});
})();</script>`;
}

/** Syncs the toggle to the data-theme that emitThemeBootstrap() set in the head. */
export function emitThemeToggle(): string {
  return `  var html = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var applyTheme = function(theme) {
    html.setAttribute('data-theme', theme);
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    if (themeMeta && typeof getComputedStyle === 'function') {
      var bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
      if (bg) themeMeta.setAttribute('content', bg);
    }
  };
  applyTheme(html.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  toggle.addEventListener('click', function(){
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });`;
}
