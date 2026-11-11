export function wrapClientIife(body: string): string {
  return `<script>\n(function(){\n${body}\n})();\n</script>`;
}

export function emitBrowserByIdHelper(): string {
  return `  function byId(id) { return document.getElementById(id); }`;
}

/**
 * `retryWithBackoff(attemptOnce, shouldRetry, attempts, baseMs, capMs)` retries a rejection or a
 * result that `shouldRetry` accepts, after a capped full-jitter delay. `fetchWithRetry` adds a
 * per-attempt timeout and retries network errors, timeouts, 429 and 5xx. Mirrors
 * src/app/retry.ts. Pass attempts: 1 for non-idempotent calls.
 */
export function emitBrowserFetchHelper(): string {
  return `  function retryWithBackoff(attemptOnce, shouldRetry, attempts, baseMs, capMs) {
    function run(attempt) {
      function retryLater(result, isError) {
        if (attempt + 1 >= attempts) return isError ? Promise.reject(result) : result;
        var delay = Math.random() * Math.min(capMs, baseMs * Math.pow(2, attempt));
        return new Promise(function(r) { setTimeout(r, delay); }).then(function() { return run(attempt + 1); });
      }
      return attemptOnce().then(function(r) {
        return shouldRetry(r) ? retryLater(r, false) : r;
      }, function(e) { return retryLater(e, true); });
    }
    return run(0);
  }
  function fetchWithRetry(url, init, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 15000;
    function attemptOnce() {
      var controller = new AbortController();
      var reqInit = {};
      for (var k in (init || {})) reqInit[k] = init[k];
      reqInit.signal = controller.signal;
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          controller.abort();
          var err = new Error('Request timed out');
          err.name = 'TimeoutError';
          reject(err);
        }, timeoutMs);
        fetch(url, reqInit).then(function(r) { clearTimeout(timer); resolve(r); },
          function(e) { clearTimeout(timer); reject(e); });
      });
    }
    function isRetryable(r) { return r.status === 429 || r.status >= 500; }
    return retryWithBackoff(attemptOnce, isRetryable, opts.attempts || 1, opts.baseMs || 500, opts.capMs || 4000);
  }`;
}

/**
 * Calls onPage with each page's items. Resolves after the last page, a repeated cursor, or an
 * error. Needs emitBrowserFetchHelper() in the same script.
 */
export function emitBrowserPageWalker(): string {
  return `  function forEachImagePage(firstUrl, onPage, onError, init) {
    var seen = {};
    function load(url) {
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
    }
    return load(firstUrl);
  }`;
}
