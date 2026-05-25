export function buildGalleryBody(): string {
  return `<a href="#gallery" class="skip-link">Skip to gallery</a>

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
</footer>`;
}
