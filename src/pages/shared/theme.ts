export type ThemeColors = { dark: string; light: string };

const THEME_TOGGLE_ID = 'themeToggle';
const THEME_KEY = 'theme';

export function themeToggleButton(icons: { dark: string; light: string }): string {
  return `<button class="theme-toggle" id="${THEME_TOGGLE_ID}" type="button" aria-label="Toggle light/dark mode">
    <span aria-hidden="true" class="material-symbols-outlined icon-dark">${icons.dark}</span>
    <span aria-hidden="true" class="material-symbols-outlined icon-light">${icons.light}</span>
  </button>`;
}

/**
 * Inline head script that sets data-theme and theme-color before first paint. A stored choice
 * wins, otherwise the system preference. Place it after the theme-color meta.
 */
export function emitThemeBootstrap(colors: ThemeColors): string {
  return `<script>(function(){
  var t;
  try { t = localStorage.getItem('${THEME_KEY}'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'light' ? ${JSON.stringify(colors.light)} : ${JSON.stringify(colors.dark)});
})();</script>`;
}

/** Defines `initThemeToggle()`, which syncs the toggle to the data-theme the bootstrap set. */
export function emitThemeToggle(colors: ThemeColors): string {
  return `  function initThemeToggle() {
    var html = document.documentElement;
    var toggle = document.getElementById('${THEME_TOGGLE_ID}');
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    var colors = ${JSON.stringify(colors)};
    function applyTheme(theme) {
      html.setAttribute('data-theme', theme);
      toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      themeMeta.setAttribute('content', colors[theme]);
    }
    applyTheme(html.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    toggle.addEventListener('click', function(){
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('${THEME_KEY}', next); } catch (e) {}
    });
  }`;
}
