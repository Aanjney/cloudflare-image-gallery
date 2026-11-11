import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, isRetryableStatus, retry } from '../src/app/retry';
import { emitBrowserFetchHelper } from '../src/pages/shared/script';

describe('isRetryableStatus', () => {
  it('retries 429 and 5xx but not other 4xx', () => {
    expect([429, 500, 503].every(isRetryableStatus)).toBe(true);
    expect([400, 401, 404, 409].some(isRetryableStatus)).toBe(false);
  });
});

describe('retry', () => {
  const noSleep = { sleep: vi.fn(async () => {}), random: () => 1 };

  it('returns the first success without sleeping', async () => {
    const fn = vi.fn(async () => 'ok');
    await expect(retry(fn, { attempts: 3, baseMs: 100, capMs: 1000, ...noSleep })).resolves.toBe(
      'ok',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries failures with backoff delays and stops at the attempt cap', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const fn = vi.fn(async () => {
      throw new Error('down');
    });

    await expect(
      retry(fn, { attempts: 3, baseMs: 100, capMs: 1000, sleep, random: () => 1 }),
    ).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('caps the backoff and scales it by the jitter draw', async () => {
    const sleep = vi.fn(async (_ms: number) => {});
    const fail = async () => {
      throw new Error('down');
    };

    await expect(
      retry(fail, { attempts: 6, baseMs: 100, capMs: 1000, sleep, random: () => 0.5 }),
    ).rejects.toThrow('down');
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([50, 100, 200, 400, 500]);
  });

  it('does not retry errors that retryOn rejects', async () => {
    const fn = vi.fn(async () => {
      throw new Error('permanent');
    });
    await expect(
      retry(fn, { attempts: 5, baseMs: 1, capMs: 1, retryOn: () => false, ...noSleep }),
    ).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recovers when a later attempt succeeds', async () => {
    let calls = 0;
    const result = await retry(
      async (attempt) => {
        calls++;
        if (attempt < 2) throw new Error('flaky');
        return attempt;
      },
      { attempts: 4, baseMs: 1, capMs: 1, ...noSleep },
    );
    expect(result).toBe(2);
    expect(calls).toBe(3);
  });
});

describe('retry with a timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects with TimeoutError when an attempt does not settle in time', async () => {
    vi.useFakeTimers();
    const pending = retry(() => new Promise(() => {}), {
      attempts: 1,
      baseMs: 1,
      capMs: 1,
      timeoutMs: 50,
      label: 'jwks',
    });
    vi.advanceTimersByTime(50);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    await expect(pending).rejects.toThrow('jwks timed out after 50ms');
  });

  it('passes through a value that arrives in time', async () => {
    await expect(
      retry(async () => 7, { attempts: 1, baseMs: 1, capMs: 1, timeoutMs: 50 }),
    ).resolves.toBe(7);
  });
});

describe('browser fetchWithRetry', () => {
  type BrowserFetch = (
    url: string,
    init?: RequestInit,
    opts?: { attempts?: number; timeoutMs?: number; baseMs?: number; capMs?: number },
  ) => Promise<Response>;

  const load = (fetchImpl: (...args: unknown[]) => Promise<Response>): BrowserFetch =>
    new Function('fetch', `${emitBrowserFetchHelper()}\nreturn fetchWithRetry;`)(fetchImpl);

  it('retries a 503 and returns the later success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await load(fetchImpl)('/api', {}, { attempts: 3, baseMs: 1, capMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('gone', { status: 404 }));
    const res = await load(fetchImpl)('/api', {}, { attempts: 3, baseMs: 1, capMs: 1 });
    expect(res.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts and rejects a request that hangs past the timeout', async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: unknown, init: unknown) => {
      signal = (init as RequestInit).signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    await expect(load(fetchImpl)('/api', {}, { attempts: 1, timeoutMs: 20 })).rejects.toThrow(
      'Request timed out',
    );
    expect(signal?.aborted).toBe(true);
  });

  it('makes exactly one attempt when attempts is 1, even on network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(load(fetchImpl)('/api', {}, { attempts: 1 })).rejects.toThrow('Failed to fetch');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
