import { describe, expect, it } from 'vitest';
import { buildAdminScript } from '../src/pages/admin/script';
import { DESCRIPTIVE_FIELDS, META_FIELDS } from '../src/domain/imageMeta';

const WHITESPACE = /\s+/;

function stripScriptTag(html: string): string {
  return html.replace(/^<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
}

function makeEl(tag: string): any {
  const listeners: Record<string, Function[]> = {};
  const el: any = {
    tagName: tag.toUpperCase(),
    _children: [] as any[],
    _parent: null as any,
    _src: '',
    _innerHTML: '',
    style: {} as Record<string, string>,
    className: '',
    textContent: '',
    type: '',
    title: '',
    value: '',
    placeholder: '',
    disabled: false,
    colSpan: 1,
    alt: '',
    srcset: '',
    sizes: '',
    loading: '',
    decoding: '',
    fetchPriority: '',
    complete: false,
    naturalWidth: 0,
    naturalHeight: 0,
    onload: null as any,
    onerror: null as any,
    onclick: null as any,
  };

  const classList = {
    add(...c: string[]) {
      for (const x of c) {
        if (el.className.split(WHITESPACE).filter(Boolean).indexOf(x) === -1) {
          el.className = (el.className ? el.className + ' ' : '') + x;
        }
      }
    },
    remove(...c: string[]) {
      el.className = el.className
        .split(WHITESPACE)
        .filter((x: string) => c.indexOf(x) === -1)
        .join(' ');
    },
    toggle(c: string, force?: boolean) {
      const list = el.className.split(WHITESPACE).filter(Boolean);
      const has = list.indexOf(c) !== -1;
      const on = force === undefined ? !has : force;
      if (on && !has) el.className = (el.className ? el.className + ' ' : '') + c;
      else if (!on) el.className = list.filter((x: string) => x !== c).join(' ');
      return on;
    },
    contains(c: string) {
      return el.className.split(WHITESPACE).indexOf(c) !== -1;
    },
  };

  el.classList = classList;
  el.addEventListener = (type: string, fn: Function) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  };
  el.dispatch = (type: string, ev: any = {}) => {
    (listeners[type] || []).slice().forEach((fn) => fn(ev));
    if (type === 'click' && typeof el.onclick === 'function') el.onclick(ev);
  };
  el.removeEventListener = () => {};
  el.appendChild = (child: any) => {
    child._parent = el;
    el._children.push(child);
    return child;
  };
  el.remove = () => {
    if (el._parent) {
      el._parent._children = el._parent._children.filter((c: any) => c !== el);
      el._parent = null;
    }
  };
  el.after = (child: any) => {
    if (el._parent) {
      const i = el._parent._children.indexOf(el);
      el._parent._children.splice(i + 1, 0, child);
      child._parent = el._parent;
    }
  };
  el.querySelectorAll = (sel: string) => {
    const parts = sel.trim().split(WHITESPACE);
    const out: any[] = [];
    const walk = (node: any) => {
      for (const child of node._children) {
        if (matchesChain(child, parts)) out.push(child);
        walk(child);
      }
    };
    walk(el);
    return out;
  };
  el.querySelector = (sel: string) => {
    const found = el.querySelectorAll(sel);
    return found.length ? found[0] : null;
  };
  el.contains = (node: any) => {
    let cur = node;
    while (cur) {
      if (cur === el) return true;
      cur = cur._parent;
    }
    return false;
  };
  el.closest = () => null;
  el.setAttribute = (k: string, v: any) => {
    el[k] = v;
  };
  el.getAttribute = (k: string) => el[k];
  if (tag === 'canvas') {
    el.getContext = () => ({
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(576) }),
    });
  }
  Object.defineProperty(el, 'src', {
    get() {
      return el._src;
    },
    set(v: string) {
      el._src = v;
      (el.srcHistory ||= []).push(v);
    },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() {
      return el._innerHTML;
    },
    set(v: string) {
      el._innerHTML = v;
      el._children = [];
    },
  });
  Object.defineProperty(el, 'childElementCount', {
    get() {
      return el._children.length;
    },
  });
  return el;
}

function matchesSimple(el: any, token: string): boolean {
  const tagMatch = token.match(/^[a-zA-Z0-9-]+/);
  const classes = Array.from(token.matchAll(/\.([a-zA-Z0-9-]+)/g)).map((m) => m[1]);
  const attrs = Array.from(
    token.matchAll(/\[([a-zA-Z0-9-]+)(?:=(?:'([^']*)'|"([^"]*)"|([^\]'"]*)))?\]/g),
  ).map((m) => ({ key: m[1], value: m[2] ?? m[3] ?? m[4] }));

  if (tagMatch && el.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
  for (const c of classes) {
    if (!el.classList.contains(c)) return false;
  }
  for (const a of attrs) {
    if (a.value !== undefined) {
      if (el.getAttribute(a.key) !== a.value) return false;
    } else if (el.getAttribute(a.key) === undefined || el.getAttribute(a.key) === null) {
      return false;
    }
  }
  return true;
}

function matchesChain(el: any, parts: string[]): boolean {
  if (!matchesSimple(el, parts[parts.length - 1])) return false;
  let node = el._parent;
  for (let i = parts.length - 2; i >= 0; i--) {
    let found = false;
    while (node) {
      if (matchesSimple(node, parts[i])) {
        found = true;
        break;
      }
      node = node._parent;
    }
    if (!found) return false;
    node = node ? node._parent : null;
  }
  return true;
}

async function settle() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    setTimeout: (fn: () => void, ms = 0) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
    async advance(ms: number) {
      const end = now + ms;
      await settle();
      for (;;) {
        let nextId = -1;
        let next: { at: number; fn: () => void } | null = null;
        for (const [id, t] of timers) {
          if (t.at <= end && (!next || t.at < next.at)) {
            next = t;
            nextId = id;
          }
        }
        if (!next) break;
        timers.delete(nextId);
        now = next.at;
        next.fn();
        await settle();
      }
      now = end;
      await settle();
    },
  };
}

const reply = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}

type Upload = {
  name: string;
  fields: Map<string, unknown>;
  xhr: any;
  settled: boolean;
  respond(status: number, body: unknown): Promise<void>;
  fail(): Promise<void>;
};

type FetchImpl = (url: string, init?: any) => unknown;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function runAdmin(fetchImpl: FetchImpl, opts: { crypto?: unknown } = {}) {
  const all: any[] = [];
  const byId = new Map<string, any>();
  const docListeners: Record<string, Function[]> = {};
  const document: any = {
    activeElement: null,
    documentElement: makeEl('html'),
    body: makeEl('body'),
    getElementById(id: string) {
      if (!byId.has(id)) byId.set(id, track(makeEl(id === 'manageBody' ? 'tbody' : 'div')));
      return byId.get(id);
    },
    createElement: (tag: string) => track(makeEl(tag)),
    querySelector(sel: string) {
      const parts = sel.trim().split(WHITESPACE);
      return all.find((el) => matchesChain(el, parts)) || track(makeEl('div'));
    },
    querySelectorAll(sel: string) {
      const parts = sel.trim().split(WHITESPACE);
      return all.filter((el) => matchesChain(el, parts));
    },
    addEventListener(type: string, fn: Function) {
      (docListeners[type] = docListeners[type] || []).push(fn);
    },
  };
  function track(el: any) {
    el.focus = () => {
      document.activeElement = el;
    };
    all.push(el);
    return el;
  }

  const clock = fakeClock();
  const createdImages: any[] = [];
  const fetchCalls: Array<{ url: string; init?: any }> = [];
  const uploads: Upload[] = [];
  const alerts: string[] = [];
  const mqlListeners: Function[] = [];
  const mql = {
    matches: true,
    addEventListener: (_: string, fn: Function) => mqlListeners.push(fn),
    addListener: (fn: Function) => mqlListeners.push(fn),
  };

  class FakeXhr {
    upload: any = { onprogress: null, onload: null };
    onload: any = null;
    onerror: any = null;
    onabort: any = null;
    status = 0;
    responseText = '';
    aborted = false;
    url = '';
    open(_method: string, url: string) {
      this.url = url;
    }
    setRequestHeader() {}
    abort() {
      this.aborted = true;
      if (this.onabort) this.onabort();
    }
    send(body: any) {
      const xhr = this;
      const fields = new Map<string, unknown>(body.entries);
      uploads.push({
        name: String(fields.get('name')),
        fields,
        xhr,
        settled: false,
        async respond(status, payload) {
          this.settled = true;
          xhr.status = status;
          xhr.responseText = JSON.stringify(payload);
          if (xhr.upload.onload) xhr.upload.onload({});
          if (xhr.onload) xhr.onload({});
          await settle();
        },
        async fail() {
          this.settled = true;
          if (xhr.onerror) xhr.onerror({});
          await settle();
        },
      });
    }
  }

  const sandbox: Record<string, unknown> = {
    document,
    window: {
      location: { origin: 'https://example.com' },
      innerWidth: 1200,
      matchMedia: () => mql,
    },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    localStorage: { getItem: () => null, setItem: () => {} },
    alert: (m: string) => alerts.push(String(m)),
    confirm: () => true,
    prompt: () => '',
    fetch: (url: string, init?: any) => {
      fetchCalls.push({ url, init });
      return Promise.resolve(fetchImpl(url, init));
    },
    XMLHttpRequest: FakeXhr,
    crypto: opts.crypto ?? globalThis.crypto,
    Image: function () {
      const img = track(makeEl('img'));
      createdImages.push(img);
      return img;
    },
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    URLSearchParams: globalThis.URLSearchParams,
    FormData: function (this: any) {
      this.entries = [] as Array<[string, unknown]>;
      this.append = (k: string, v: unknown) => this.entries.push([k, v]);
    },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
  };

  const names = Object.keys(sandbox);
  const fn = new Function(...names, stripScriptTag(buildAdminScript('/_admin')));
  fn(...names.map((k) => sandbox[k]));

  const dispatchDoc = (type: string, ev: unknown) =>
    (docListeners[type] || []).forEach((f) => f(ev));
  const fireViewport = (matches: boolean) => {
    mql.matches = matches;
    mqlListeners.forEach((f) => f({ matches }));
  };
  return {
    all,
    byId,
    document,
    clock,
    createdImages,
    fetchCalls,
    uploads,
    alerts,
    dispatchDoc,
    fireViewport,
  };
}

type Harness = ReturnType<typeof runAdmin>;

const STATS = { total: 0, totalBytes: 0, latestCreatedAt: null, avgSize: 0 };

const listOf = (items: unknown[]) => (url: string) => {
  if (url.includes('/api/stats')) return reply(200, STATS);
  if (url.includes('/api/images')) return reply(200, { items, cursor: null });
  return reply(404, {});
};

async function addFiles(h: Harness, names: string[]) {
  const before = h.createdImages.length;
  const picker = h.byId.get('filePicker');
  picker.files = names.map((name) => ({ name, type: 'image/jpeg' }));
  picker.dispatch('change');
  await settle();
  for (const img of h.createdImages.slice(before)) {
    img.naturalWidth = 800;
    img.naturalHeight = 600;
    img.onload();
  }
  await settle();
}

const queueRows = (h: Harness) =>
  h.byId
    .get('queueList')
    .querySelectorAll('.queue-item')
    .map((row: any) => ({
      row,
      name: row.querySelector('.queue-item-file-label').textContent,
      badge: row.querySelector('.status-badge')?.textContent ?? 'Queued',
      remove: row.querySelector('button.btn-danger-text'),
    }));

async function finishUploads(h: Harness) {
  for (let i = 0; i < 20; i++) {
    const u = h.uploads.find((x) => !x.settled);
    if (!u) return;
    await u.respond(200, { ok: true, image: { id: 'id-' + u.name } });
    await h.clock.advance(0);
  }
}

describe('admin upload queue', () => {
  it('keeps the uploading row and uploads every other file once', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg', 'c.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const uploading = queueRows(h)[0];
    expect(uploading.badge).toBe('Uploading');
    if (uploading.remove) uploading.remove.dispatch('click');
    await finishUploads(h);

    expect(h.uploads.map((u) => u.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(queueRows(h)).toEqual([]);
    expect(h.byId.get('uploadStatus').textContent).toBe('3 photos uploaded');
  });

  it('removing a queued file mid-run does not mark another file Done', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg', 'c.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    queueRows(h)[1].remove.dispatch('click');
    await h.uploads[0].respond(500, { error: 'boom' });
    await h.clock.advance(10000);
    await h.uploads[1].respond(500, { error: 'boom' });
    await h.clock.advance(10000);
    await h.uploads[2].respond(500, { error: 'boom' });
    await finishUploads(h);

    expect(h.uploads.map((u) => u.name)).toEqual(['a.jpg', 'a.jpg', 'a.jpg', 'c.jpg']);
    expect(queueRows(h).map((r: any) => [r.name, r.badge])).toEqual([['a.jpg', 'Error']]);
  });

  it('Clear all mid-run keeps the in-flight upload and uploads files added afterwards', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    h.byId.get('clearQueue').dispatch('click');
    await addFiles(h, ['x.jpg']);
    await finishUploads(h);

    expect(h.uploads.map((u) => u.name)).toEqual(['a.jpg', 'x.jpg']);
    expect(queueRows(h)).toEqual([]);
    expect(h.byId.get('uploadStatus').textContent).toBe('2 photos uploaded');
  });

  it('ignores a second Upload click while a run is in progress', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    const start = h.byId.get('startUpload');
    start.dispatch('click');
    await settle();
    start.dispatch('click');
    await settle();

    expect(h.uploads.filter((u) => !u.settled)).toHaveLength(1);
    expect(start.disabled).toBe(true);
    await finishUploads(h);
    expect(h.uploads.map((u) => u.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(queueRows(h)).toEqual([]);
    expect(start.disabled).toBe(true);
  });

  it('counts files added mid-run in the progress total', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();
    await addFiles(h, ['b.jpg']);
    await h.uploads[0].respond(200, { ok: true, image: { id: 'id-a' } });

    expect(h.byId.get('uploadCount').textContent).toBe('1 / 2');
  });

  it('makes the uploading file read-only so no typed metadata is dropped', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const [a, b] = queueRows(h).map((r: any) => r.row.querySelectorAll('input'));
    expect(a.map((i: any) => i.readOnly)).toEqual([true, true, true, true]);
    expect(b.map((i: any) => i.readOnly)).toEqual([false, false, false, false]);

    b[2].value = 'Lisbon';
    b[2].dispatch('input');
    await h.uploads[0].respond(200, { ok: true, image: { id: 'id-a' } });
    await h.clock.advance(0);
    expect(b.map((i: any) => i.readOnly)).toEqual([true, true, true, true]);
    expect(h.uploads[1].fields.get('location')).toBe('LISBON');
  });

  it('trims and uppercases typed metadata before upload', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    const location = h.byId.get('queueList').querySelectorAll('input[data-field]')[2];
    location.value = '  Lisbon ';
    location.dispatch('input');
    h.byId.get('startUpload').dispatch('click');
    await settle();

    expect(h.uploads[0].fields.get('location')).toBe('LISBON');
  });

  it('shows the server message for a rejected upload and falls back to a generic one', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();
    await h.uploads[0].respond(400, { error: 'Location is too long.' });
    await h.clock.advance(0);
    await h.uploads[1].respond(400, {});
    await h.clock.advance(0);

    const messages = queueRows(h).map((r: any) => r.row.querySelector('.error-text').textContent);
    expect(messages[0]).toBe('Location is too long.');
    expect(messages[1]).toContain('isn’t a supported photo');
  });

  it('limits the upload inputs to the metadata field lengths', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    const inputs = h.byId.get('queueList').querySelectorAll('input[data-field]');
    expect(inputs.map((i: any) => i.maxLength)).toEqual(
      DESCRIPTIVE_FIELDS.map((name) => META_FIELDS[name].maxLength),
    );
  });

  it('keeps a finished file read-only until the run ends, so late edits are not dropped', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const a = queueRows(h)[0].row.querySelectorAll('input');
    await h.uploads[0].respond(200, { ok: true, image: { id: 'id-a' } });
    await h.clock.advance(0);

    expect(a.map((i: any) => i.readOnly)).toEqual([true, true, true, true]);
  });

  it("keeps focus on a waiting file's Remove button while another upload finishes", async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg', 'c.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const remove = queueRows(h)[2].row.querySelector('.btn-danger-text');
    remove.focus();
    await h.uploads[0].respond(200, { ok: true, image: { id: 'id-a' } });
    await h.clock.advance(0);

    expect(h.document.activeElement).toBe(remove);
    expect(queueRows(h)[2].row.querySelectorAll('.btn-danger-text')).toContain(remove);
  });

  it('keeps focus in the next file while the current upload finishes', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const location = queueRows(h)[1].row.querySelector('[data-field=location]');
    location.focus();
    await h.uploads[0].respond(200, { ok: true, image: { id: 'id-a' } });

    expect(h.document.activeElement).toBe(location);
    expect(h.byId.get('queueList').querySelectorAll('input')).toContain(location);
  });

  it('disables Upload to archive while the queue is empty', async () => {
    const h = runAdmin(listOf([]));
    const start = h.byId.get('startUpload');
    expect(start.disabled).toBe(true);

    await addFiles(h, ['a.jpg']);
    expect(start.disabled).toBe(false);

    h.byId.get('clearQueue').dispatch('click');
    expect(start.disabled).toBe(true);
  });

  it('sends a per-file uploadId and reuses it when retrying a dropped connection', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg', 'b.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    await h.uploads[0].fail();
    await h.clock.advance(10000);
    await finishUploads(h);

    const ids = h.uploads.map((u) => [u.name, u.fields.get('uploadId')]);
    expect(ids.map((x) => x[0])).toEqual(['a.jpg', 'a.jpg', 'b.jpg']);
    expect(ids[0][1]).toMatch(UUID_V4);
    expect(ids[1][1]).toBe(ids[0][1]);
    expect(ids[2][1]).toMatch(UUID_V4);
    expect(ids[2][1]).not.toBe(ids[0][1]);
    expect(h.byId.get('uploadStatus').textContent).toBe('2 photos uploaded');
  });

  it('builds a v4 uploadId from getRandomValues when randomUUID is missing', async () => {
    const h = runAdmin(listOf([]), {
      crypto: { getRandomValues: (a: Uint8Array) => globalThis.crypto.getRandomValues(a) },
    });
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();
    expect(h.uploads[0].fields.get('uploadId')).toMatch(UUID_V4);
  });

  it('retries a 5xx three times, keeps the failed file and its details, and retries on the next click', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    const camera = h.byId.get('queueList').querySelectorAll('input[data-field]')[0];
    camera.value = 'Leica';
    camera.dispatch('input');
    h.byId.get('startUpload').dispatch('click');
    await settle();

    for (let i = 0; i < 3; i++) {
      await h.uploads[i].respond(500, { ok: false, error: 'boom' });
      await h.clock.advance(10000);
    }

    expect(h.uploads).toHaveLength(3);
    expect(h.uploads[0].fields.get('alt')).toBe('Film photograph: Leica');
    const rows = queueRows(h);
    expect(rows.map((r: any) => r.badge)).toEqual(['Error']);
    expect(rows[0].row.querySelectorAll('input[data-field]')[0].value).toBe('Leica');
    const err = rows[0].row.querySelector('.error-text').textContent;
    expect(err).not.toContain('boom');
    expect(err).toContain('Upload to archive');

    h.byId.get('startUpload').dispatch('click');
    await settle();
    expect(h.uploads).toHaveLength(4);
  });

  it('shows the server message for a 409 and does not retry it', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    await h.uploads[0].respond(409, { error: 'The archive is full. Delete photos to make room.' });
    await h.clock.advance(10000);

    expect(h.uploads).toHaveLength(1);
    expect(h.byId.get('uploadCount').textContent).toBe('1 / 1');
    expect(queueRows(h)[0].row.querySelector('.error-text').textContent).toBe(
      'The archive is full. Delete photos to make room.',
    );
  });

  it('aborts and retries an upload with no progress for 30 seconds', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const xhr = h.uploads[0].xhr;
    expect(xhr).toBeTruthy();
    await h.clock.advance(29000);
    xhr.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
    await h.clock.advance(29000);
    expect(xhr.aborted).toBe(false);
    expect(h.byId.get('uploadFill').style.transform).toBe('scaleX(0.5)');
    await h.clock.advance(2000);
    expect(xhr.aborted).toBe(true);
    await h.clock.advance(10000);
    expect(h.uploads).toHaveLength(2);
    expect(h.uploads[1].fields.get('uploadId')).toBe(h.uploads[0].fields.get('uploadId'));
  });

  it('waits 60 seconds for a response after the body is sent', async () => {
    const h = runAdmin(listOf([]));
    await addFiles(h, ['a.jpg']);
    h.byId.get('startUpload').dispatch('click');
    await settle();

    const xhr = h.uploads[0].xhr;
    xhr.upload.onload({});
    await h.clock.advance(59000);
    expect(xhr.aborted).toBe(false);
    await h.clock.advance(2000);
    expect(xhr.aborted).toBe(true);
  });
});

const PHOTOS = [
  { id: 'A', name: 'a.jpg', size: 1024, createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 'B', name: 'b.jpg', size: 1024, createdAt: '2024-01-01T00:00:00.000Z' },
];

const manageRow = (h: Harness, id: string) =>
  h.byId
    .get('manageBody')
    ._children.find((tr: any) => tr.querySelector('img')?.alt === id.toLowerCase() + '.jpg');
const rowButton = (h: Harness, id: string, label: string) =>
  manageRow(h, id)
    .querySelectorAll('button')
    .find((b: any) => b.getAttribute('aria-label') === label);
const editRow = (h: Harness) => h.byId.get('manageBody').querySelector('.edit-row');

describe('admin manage table', () => {
  it('keeps an open edit form and its draft when another row is deleted', async () => {
    const h = runAdmin((url) => {
      if (url.includes('/delete')) return reply(200, { ok: true });
      return listOf(PHOTOS)(url);
    });
    await settle();

    rowButton(h, 'B', 'Edit details').dispatch('click');
    const input = editRow(h).querySelectorAll('input')[0];
    input.value = 'Nikon';
    input.dispatch('input');
    rowButton(h, 'A', 'Delete photo').dispatch('click');
    await settle();

    const body = h.byId.get('manageBody')._children;
    expect(manageRow(h, 'A')).toBeUndefined();
    expect(body.indexOf(editRow(h))).toBe(body.indexOf(manageRow(h, 'B')) + 1);
    expect(editRow(h).querySelectorAll('input')[0].value).toBe('Nikon');
  });

  it('keeps the row and alerts when the delete answers 503', async () => {
    const h = runAdmin((url) => {
      if (url.includes('/delete')) return reply(503, { error: 'Index unavailable' });
      return listOf(PHOTOS)(url);
    });
    await settle();

    rowButton(h, 'A', 'Delete photo').dispatch('click');
    await settle();
    await h.clock.advance(5000);

    expect(manageRow(h, 'A')).toBeDefined();
    expect(rowButton(h, 'A', 'Delete photo').disabled).toBe(false);
    expect(h.alerts).toHaveLength(1);
  });

  it('keeps row B draft when the save of row A finishes', async () => {
    const save = deferred<unknown>();
    const h = runAdmin((url) => {
      if (url.includes('/update')) return save.promise;
      return listOf(PHOTOS)(url);
    });
    await settle();

    rowButton(h, 'A', 'Edit details').dispatch('click');
    editRow(h).querySelector('button.btn-save').dispatch('click');
    rowButton(h, 'B', 'Edit details').dispatch('click');
    const input = editRow(h).querySelectorAll('input')[1];
    input.value = 'Kodak';
    input.dispatch('input');
    save.resolve(reply(200, { ok: true, image: { ...PHOTOS[0], location: 'FAROE' } }));
    await settle();

    expect(manageRow(h, 'A').querySelector('.manage-title').textContent).toBe('FAROE');
    expect(editRow(h).querySelectorAll('input')[1].value).toBe('Kodak');
  });

  it('opens the editor with one click after its row left and came back', async () => {
    const h = runAdmin((url) => {
      if (url.includes('q=zzz')) return reply(200, { items: [], cursor: null });
      return listOf(PHOTOS)(url);
    });
    await settle();

    rowButton(h, 'B', 'Edit details').dispatch('click');
    const search = h.byId.get('searchInput');
    search.value = 'zzz';
    search.dispatch('input');
    await h.clock.advance(300);
    search.value = '';
    search.dispatch('input');
    await h.clock.advance(300);

    expect(editRow(h)).toBeNull();
    rowButton(h, 'B', 'Edit details').dispatch('click');
    expect(editRow(h)).not.toBeNull();
  });

  it('loads admin lists with cache: no-store', async () => {
    const h = runAdmin(listOf([]));
    await settle();
    const manageLists = h.fetchCalls.filter((c) => c.url.startsWith('/api/images')).length;
    h.byId.get('backfillPlaceholders').dispatch('click');
    await settle();

    const lists = h.fetchCalls.filter((c) => c.url.startsWith('/api/images'));
    expect(manageLists).toBeGreaterThan(0);
    expect(lists.length).toBeGreaterThan(manageLists);
    for (const c of lists) expect(c.init?.cache).toBe('no-store');
  });

  it('reports a failed stats load instead of leaving dashes', async () => {
    const h = runAdmin((url) => {
      if (url.includes('/api/stats')) return reply(500, {});
      return reply(200, { items: [], cursor: null });
    });
    await h.clock.advance(10_000);
    expect(h.byId.get('statsError').textContent).toContain('Couldn’t load the archive stats');
  });

  it('starts the stats request without waiting for the first list', async () => {
    const h = runAdmin((url) => {
      if (url.includes('/api/stats')) return reply(200, STATS);
      return new Promise(() => {});
    });
    await settle();
    expect(h.fetchCalls.some((c) => c.url === '/_admin/api/stats')).toBe(true);
  });

  it('falls back to the original image once when the thumbnail keeps failing', async () => {
    const h = runAdmin(listOf([PHOTOS[0]]));
    await settle();
    const thumb = manageRow(h, 'A').querySelector('img');
    expect(thumb.src.indexOf('/img/')).toBe(0);
    for (let i = 0; i < 3; i++) thumb.onerror?.();

    expect(thumb.src).toBe('/media/A');
    expect(thumb.srcHistory.filter((src: string) => src === '/media/A')).toHaveLength(1);
  });

  it('tells a search miss apart from an empty archive', async () => {
    const archive = runAdmin(listOf([]));
    await settle();
    expect(archive.byId.get('manageEmpty').textContent).toContain('No photos yet');

    const search = runAdmin(listOf([]));
    search.byId.get('searchInput').value = 'faroe';
    await settle();
    expect(search.byId.get('manageEmpty').textContent).toContain('No photos match');
  });

  it('reports a failed load instead of showing an empty archive', async () => {
    const h = runAdmin((url) => {
      if (url.includes('/api/stats')) return reply(200, STATS);
      return reply(500, { items: [] });
    });
    await h.clock.advance(10000);
    expect(h.byId.get('manageError').textContent).toContain('Couldn’t load photos');
    expect(h.byId.get('manageEmpty').style.display).toBe('none');
  });

  it('removes the row when a retried delete finds the photo already gone', async () => {
    let deletes = 0;
    const h = runAdmin((url) => {
      if (url.includes('/delete')) return ++deletes === 1 ? reply(503, {}) : reply(404, {});
      return listOf(PHOTOS)(url);
    });
    await settle();

    rowButton(h, 'A', 'Delete photo').dispatch('click');
    await h.clock.advance(10000);

    expect(deletes).toBe(2);
    expect(manageRow(h, 'A')).toBeUndefined();
    expect(h.alerts).toEqual([]);
  });
});

describe('admin backfill', () => {
  const needColor = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'p' + i + '.jpg' }));

  function backfillHarness(
    items: unknown[],
    thumb: (url: string) => unknown = () => ({
      ok: true,
      status: 200,
      blob: () => Promise.resolve({}),
    }),
  ) {
    const h = runAdmin((url, init) => {
      if (url.startsWith('/img/')) return thumb(url);
      if (url.includes('/update')) return reply(200, { ok: true, image: JSON.parse(init.body) });
      return listOf(items)(url);
    });
    const loaded = new Set<any>();
    const decodeImages = async () => {
      for (let i = 0; i < 20; i++) {
        const fresh = h.createdImages.filter((img) => !loaded.has(img) && img.onload);
        if (!fresh.length) return;
        for (const img of fresh) {
          loaded.add(img);
          img.onload();
        }
        await settle();
      }
    };
    return { h, decodeImages };
  }

  it('fetches three thumbnails at a time and reports how many photos got a color', async () => {
    const items = [...needColor(5), { id: 'done', name: 'done.jpg', placeholder: '#123' }];
    const { h, decodeImages } = backfillHarness(items, (url) =>
      url.includes('/p3')
        ? reply(404, {})
        : { ok: true, status: 200, blob: () => Promise.resolve({}) },
    );
    await settle();
    h.byId.get('backfillPlaceholders').dispatch('click');
    await settle();

    expect(h.fetchCalls.filter((c) => c.url.startsWith('/img/'))).toHaveLength(3);
    await decodeImages();

    expect(h.fetchCalls.filter((c) => c.url.startsWith('/img/'))).toHaveLength(5);
    expect(h.fetchCalls.filter((c) => c.url.endsWith('/update'))).toHaveLength(4);
    expect(h.alerts).toEqual(['Added placeholder colors to 4 photos.']);
    expect(h.byId.get('backfillPlaceholders').textContent).toBe('Backfill colors');
  });

  it('shows Cancelling while stopping and reports the partial count', async () => {
    const { h, decodeImages } = backfillHarness(needColor(5));
    await settle();
    const btn = h.byId.get('backfillPlaceholders');
    btn.dispatch('click');
    await settle();

    btn.dispatch('click');
    expect(btn.textContent).toBe('Cancelling…');
    expect(btn.disabled).toBe(true);
    await decodeImages();

    expect(h.fetchCalls.filter((c) => c.url.startsWith('/img/'))).toHaveLength(3);
    expect(h.alerts).toEqual(['Stopped. Added colors to 3 of 5 photos.']);
    expect(btn.textContent).toBe('Backfill colors');
    expect(btn.disabled).toBe(false);
  });
});

describe('admin sidebar', () => {
  it('closes on Escape and returns focus to the menu button', async () => {
    const h = runAdmin(listOf([]));
    const toggle = h.byId.get('mobileToggle');
    const sidebar = h.byId.get('sidebar');
    toggle.dispatch('click');
    expect(sidebar.classList.contains('open')).toBe(true);

    h.dispatchDoc('keydown', { key: 'Escape' });
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(h.document.activeElement).toBe(toggle);
  });

  it('closes when the viewport crosses the 960px breakpoint', async () => {
    const h = runAdmin(listOf([]));
    const toggle = h.byId.get('mobileToggle');
    toggle.dispatch('click');
    h.fireViewport(false);
    expect(h.byId.get('sidebar').classList.contains('open')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
