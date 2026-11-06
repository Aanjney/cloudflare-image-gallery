import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitBrowserFetchHelper,
  emitBrowserPageWalker,
  emitThemeBootstrap,
} from '../src/client/buildClientScript';
import { buildGalleryScript } from '../src/client/gallery';
import { buildAdminHTML } from '../src/html/admin';
import { buildGalleryHTML } from '../src/html/gallery';

type Listener = (ev: any) => void;

class FakeEl {
  attrs: Record<string, string> = {};
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  listeners: Record<string, Listener[]> = {};
  style: Record<string, string> = {};
  className = '';
  textContent = '';
  innerHTML = '';
  src = '';
  srcset = '';
  open = false;
  complete = false;
  naturalWidth = 0;
  classList = {
    add: (c: string) => this.classList.toggle(c, true),
    remove: (c: string) => this.classList.toggle(c, false),
    contains: (c: string) => this.className.split(/\s+/).includes(c),
    toggle: (c: string, on?: boolean) => {
      const list = this.className.split(/\s+/).filter((x) => x && x !== c);
      const next = on ?? !this.classList.contains(c);
      this.className = (next ? [...list, c] : list).join(' ');
      return next;
    },
  };
  constructor(public tag: string) {}
  setAttribute(k: string, v: string) {
    this.attrs[k] = String(v);
  }
  getAttribute(k: string) {
    return k in this.attrs ? this.attrs[k] : null;
  }
  addEventListener(type: string, fn: Listener) {
    (this.listeners[type] ||= []).push(fn);
  }
  dispatch(type: string, ev: any = {}) {
    for (const fn of this.listeners[type] || []) {
      fn({ preventDefault() {}, stopPropagation() {}, target: this, ...ev });
    }
  }
  appendChild(child: FakeEl) {
    const moved = child.tag === 'fragment' ? child.children : [child];
    for (const c of moved) {
      c.parent = this;
      this.children.push(c);
    }
    if (child.tag === 'fragment') child.children = [];
    return child;
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  }
  get childElementCount() {
    return this.children.length;
  }
  contains(node: FakeEl | null): boolean {
    for (let n = node; n; n = n.parent) if (n === this) return true;
    return false;
  }
  closest() {
    return null;
  }
  focus() {}
  decode() {
    return new Promise(() => {});
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.dispatch('close');
  }
}

function runGallery(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  const byId = new Map<string, FakeEl>();
  const bySelector = new Map<string, FakeEl>();
  const docListeners = new FakeEl('document');
  const document = {
    documentElement: new FakeEl('html'),
    body: new FakeEl('body'),
    getElementById: (id: string) => byId.get(id) || byId.set(id, new FakeEl('div')).get(id),
    querySelector: (sel: string) =>
      bySelector.get(sel) || bySelector.set(sel, new FakeEl('div')).get(sel),
    createElement: (tag: string) => new FakeEl(tag),
    createDocumentFragment: () => new FakeEl('fragment'),
    addEventListener: (type: string, fn: Listener) => docListeners.addEventListener(type, fn),
    contains: () => true,
    activeElement: null,
  };
  const fetchMock = vi.fn(fetchImpl);
  const script = buildGalleryScript()
    .replace(/^<script>/, '')
    .replace(/<\/script>$/, '');
  new Function('document', 'localStorage', 'fetch', 'Image', 'navigator', script)(
    document,
    { getItem: () => null, setItem: () => {} },
    fetchMock,
    function () {
      return new FakeEl('img');
    },
    { clipboard: { writeText: () => Promise.resolve() } },
  );
  const grid = document.getElementById('grid')!;
  return {
    fetchMock,
    grid,
    carousel: document.getElementById('carousel')!,
    counter: () => document.getElementById('carouselCounter')!.textContent,
    tiles: () => grid.children.filter((c) => c.className === 'masonry-item'),
    tileIds: () =>
      grid.children
        .filter((c) => c.className === 'masonry-item')
        .map((t) => t.children[0].children.find((c) => c.tag === 'img')!.src.split('?')[0]),
    message: () => grid.children.find((c) => c.className === 'gallery-message')?.textContent,
    key: (key: string) => docListeners.dispatch('keydown', { key }),
  };
}

const page = (ids: string[], cursor: string | null) =>
  new Response(JSON.stringify({ items: ids.map((id) => ({ id, width: 1, height: 1 })), cursor }), {
    status: 200,
  });

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => prefix + i);

describe('gallery loader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests the preloaded first page URL', async () => {
    const g = runGallery(async () => page(ids('a', 1), null));
    await vi.runAllTimersAsync();
    expect(g.fetchMock.mock.calls[0][0]).toBe('/api/images?limit=200');
  });

  it('renders the first page before later pages arrive', async () => {
    const g = runGallery((url) =>
      url.includes('cursor=')
        ? new Promise<Response>(() => {})
        : Promise.resolve(page(ids('a', 3), 'c1')),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(g.tiles()).toHaveLength(3);
  });

  it('stops following a repeated cursor', async () => {
    const g = runGallery(async (url) =>
      url.includes('cursor=') ? page(ids('b', 2), 'c1') : page(ids('a', 3), 'c1'),
    );
    await vi.runAllTimersAsync();
    expect(g.tiles()).toHaveLength(5);
    expect(g.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders one tile per photo id when pages overlap', async () => {
    const g = runGallery(async (url) =>
      url.includes('cursor=') ? page(['x1', 'x2'], null) : page(['x0', 'x1'], 'c1'),
    );
    await vi.runAllTimersAsync();
    expect(g.tileIds().sort()).toEqual(['/img/x0', '/img/x1', '/img/x2']);
  });

  it('retries a failing first page and then shows the error message', async () => {
    const g = runGallery(async () => new Response('down', { status: 503 }));
    await vi.runAllTimersAsync();
    expect(g.fetchMock).toHaveBeenCalledTimes(3);
    expect(g.message()).toBe("Photos didn't load. Refresh the page to try again.");
  });

  it('shows the error message for a non-ok first page instead of parsing it', async () => {
    const g = runGallery(async () => new Response('{"items":[{"id":"bogus"}]}', { status: 404 }));
    await vi.runAllTimersAsync();
    expect(g.tiles()).toHaveLength(0);
    expect(g.message()).toBe("Photos didn't load. Refresh the page to try again.");
  });

  it('keeps shown photos and stays quiet when a later page fails', async () => {
    const g = runGallery(async (url) =>
      url.includes('cursor=') ? new Response('down', { status: 503 }) : page(ids('a', 3), 'c1'),
    );
    await vi.runAllTimersAsync();
    expect(g.tiles()).toHaveLength(3);
    expect(g.message()).toBeUndefined();
  });

  it('times out a hung first page after 10 seconds per attempt', async () => {
    const g = runGallery(() => new Promise<Response>(() => {}));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(g.message()).toBeUndefined();
    await vi.runAllTimersAsync();
    expect(g.fetchMock).toHaveBeenCalledTimes(3);
    expect(g.message()).toBe("Photos didn't load. Refresh the page to try again.");
  });
});

describe('carousel while pages append', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the counter total and navigates past the old end', async () => {
    let releasePage2: (r: Response) => void = () => {};
    const g = runGallery((url) =>
      url.includes('cursor=')
        ? new Promise<Response>((r) => (releasePage2 = r))
        : Promise.resolve(page(ids('a', 3), 'c1')),
    );
    await vi.advanceTimersByTimeAsync(0);
    const tiles = g.tiles();
    tiles[tiles.length - 1].dispatch('click');
    expect(g.carousel.open).toBe(true);
    expect(g.counter()).toBe('03 / 03');

    releasePage2(page(ids('b', 2), null));
    await vi.advanceTimersByTimeAsync(0);
    expect(g.counter()).toBe('03 / 05');

    g.key('ArrowRight');
    expect(g.counter()).toBe('04 / 05');
    g.key('ArrowRight');
    g.key('ArrowRight');
    expect(g.counter()).toBe('01 / 05');
  });
});

describe('page walker', () => {
  const load = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) =>
    new Function(
      'fetch',
      `${emitBrowserFetchHelper()}\n${emitBrowserPageWalker()}\nreturn forEachImagePage;`,
    )(fetchImpl);

  it('passes init to every page request', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes('cursor=') ? page(['b'], null) : page(['a'], 'c1'),
    );
    await load(fetchImpl)('/api/images?limit=1', () => {}, undefined, { cache: 'no-store' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const call of fetchImpl.mock.calls) {
      expect(call[1]?.cache).toBe('no-store');
    }
  });

  it('reports a non-ok final response as an error', async () => {
    const onPage = vi.fn();
    const onError = vi.fn();
    await load(async () => new Response('{"items":[{"id":"a"}]}', { status: 403 }))(
      '/api/images?limit=1',
      onPage,
      onError,
    );
    expect(onPage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('theme bootstrap', () => {
  const colors = { dark: '#000', light: '#fff' };
  const run = (opts: {
    stored?: string | null;
    prefersLight?: boolean;
    storageThrows?: boolean;
  }) => {
    const html = new FakeEl('html');
    html.setAttribute('data-theme', 'dark');
    const meta = new FakeEl('meta');
    meta.setAttribute('content', colors.dark);
    const script = emitThemeBootstrap(colors)
      .replace(/^<script>/, '')
      .replace(/<\/script>$/, '');
    new Function('document', 'localStorage', 'window', script)(
      { documentElement: html, querySelector: () => meta },
      {
        getItem: () => {
          if (opts.storageThrows) throw new Error('SecurityError');
          return opts.stored ?? null;
        },
      },
      {
        matchMedia: (q: string) => ({
          matches: q === '(prefers-color-scheme: light)' && !!opts.prefersLight,
        }),
      },
    );
    return { theme: html.getAttribute('data-theme'), themeColor: meta.getAttribute('content') };
  };

  it('follows a light system preference when nothing is stored', () => {
    expect(run({ prefersLight: true })).toEqual({ theme: 'light', themeColor: '#fff' });
  });

  it('follows a dark system preference when nothing is stored', () => {
    expect(run({ prefersLight: false })).toEqual({ theme: 'dark', themeColor: '#000' });
  });

  it('lets a stored choice win over the system preference', () => {
    expect(run({ stored: 'dark', prefersLight: true })).toEqual({
      theme: 'dark',
      themeColor: '#000',
    });
    expect(run({ stored: 'light', prefersLight: false })).toEqual({
      theme: 'light',
      themeColor: '#fff',
    });
  });

  it('falls back to the system preference when storage is blocked', () => {
    expect(run({ storageThrows: true, prefersLight: true }).theme).toBe('light');
  });

  it.each([
    ['gallery', buildGalleryHTML('https://example.com/')],
    ['admin', buildAdminHTML()],
  ])('%s page sets the theme in the head before any stylesheet', (_name, html) => {
    const bootstrap = html.indexOf("localStorage.getItem('theme')");
    expect(bootstrap).toBeGreaterThan(html.indexOf('name="theme-color"'));
    expect(bootstrap).toBeLessThan(html.indexOf('stylesheet'));
    expect(bootstrap).toBeLessThan(html.indexOf('<style'));
    expect(bootstrap).toBeLessThan(html.indexOf('</head>'));
  });
});
