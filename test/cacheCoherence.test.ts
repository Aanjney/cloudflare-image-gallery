import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { FakeCache, indexWorld } from './support/fakes';

const gate = () => {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

const makeWorld = () => {
  const world = indexWorld();
  return {
    ...world,
    get: (path: string) => world.run(path, { headers: { Accept: 'image/avif' } }),
  };
};

describe('edge cache after a delete', () => {
  let resizeFetch: Mock<any[], Promise<Response>>;

  beforeEach(() => {
    vi.stubGlobal('caches', { default: new FakeCache() });
    resizeFetch = vi.fn(
      async () => new Response('resized', { headers: { 'Content-Type': 'image/avif' } }),
    );
    vi.stubGlobal('fetch', resizeFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not resurrect /media when the R2 read finishes after the delete purge', async () => {
    const world = makeWorld();
    await world.seed('p1');
    const hold = gate();
    world.holdNextR2Get(hold.opened);

    const racing = world.get('/media/p1');
    await tick();
    expect((await world.del('p1')).status).toBe(200);
    hold.open();
    await racing;
    await world.flush();

    expect((await world.get('/media/p1')).status).toBe(404);
  });

  it('does not resurrect /img when the resize finishes after the delete purge', async () => {
    const world = makeWorld();
    await world.seed('p2');
    const hold = gate();
    resizeFetch.mockImplementation(async () => {
      await hold.opened;
      return new Response('resized', { headers: { 'Content-Type': 'image/avif' } });
    });

    const racing = world.get('/img/p2?w=480&q=78&fmt=auto');
    await tick();
    expect((await world.del('p2')).status).toBe(200);
    hold.open();
    await racing;
    await world.flush();

    expect((await world.get('/img/p2?w=480&q=78&fmt=auto')).status).toBe(404);
  });

  it('purges an /img width and quality pair that no named variant uses', async () => {
    const world = makeWorld();
    await world.seed('p3');
    expect((await world.get('/img/p3?w=1600&q=70')).status).toBe(200);
    await world.flush();

    expect((await world.del('p3')).status).toBe(200);

    expect((await world.get('/img/p3?w=1600&q=70')).status).toBe(404);
  });

  it('purges an /img original-size request with a non-default quality', async () => {
    const world = makeWorld();
    await world.seed('p5');
    expect((await world.get('/img/p5?q=70')).status).toBe(200);
    await world.flush();

    expect((await world.del('p5')).status).toBe(200);

    expect((await world.get('/img/p5?q=70')).status).toBe(404);
  });

  it('purges /media requested with a query string', async () => {
    const world = makeWorld();
    await world.seed('p4');
    expect((await world.get('/media/p4?v=1')).status).toBe(200);
    await world.flush();

    expect((await world.del('p4')).status).toBe(200);

    expect((await world.get('/media/p4?v=1')).status).toBe(404);
  });
});
