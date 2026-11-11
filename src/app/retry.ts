export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export type RetryPolicy = {
  attempts: number;
  baseMs: number;
  capMs: number;
  timeoutMs?: number;
};

const BACKOFF = { baseMs: 100, capMs: 1000 };

export const RETRY_POLICIES = {
  indexRead: { attempts: 3, timeoutMs: 5000, ...BACKOFF },
  indexList: { attempts: 2, timeoutMs: 5000, ...BACKOFF },
  // No timeout: an abandoned write can still land after we give up.
  indexWrite: { attempts: 2, ...BACKOFF },
  r2Read: { attempts: 2, timeoutMs: 5000, ...BACKOFF },
  r2Delete: { attempts: 3, ...BACKOFF },
  jwks: { attempts: 3, timeoutMs: 3000, ...BACKOFF },
} satisfies Record<string, RetryPolicy>;

const backoffDelay = (attempt: number, baseMs: number, capMs: number, random: () => number) =>
  random() * Math.min(capMs, baseMs * 2 ** attempt);

export const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

type RetryOptions = RetryPolicy & {
  label?: string;
  retryOn?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Only use it for idempotent operations. A timed-out attempt keeps running, so only set
 * `timeoutMs` for reads or calls that are safe to abandon.
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  {
    attempts,
    baseMs,
    capMs,
    timeoutMs,
    label = 'operation',
    retryOn = () => true,
    sleep = realSleep,
    random = Math.random,
  }: RetryOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const pending = fn(attempt);
      return await (timeoutMs === undefined ? pending : withTimeout(pending, timeoutMs, label));
    } catch (error) {
      if (attempt + 1 >= attempts || !retryOn(error)) throw error;
      await sleep(backoffDelay(attempt, baseMs, capMs, random));
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
