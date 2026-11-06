export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/** Full-jitter exponential backoff: a random delay in [0, min(capMs, baseMs * 2^attempt)). */
export const backoffDelay = (
  attempt: number,
  baseMs: number,
  capMs: number,
  random: () => number = Math.random,
): number => random() * Math.min(capMs, baseMs * 2 ** attempt);

export const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

export type RetryOptions = {
  attempts: number;
  baseMs: number;
  capMs: number;
  retryOn?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs fn up to `attempts` times. Only use it for idempotent operations. */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  { attempts, baseMs, capMs, retryOn = () => true, sleep = realSleep, random }: RetryOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt + 1 >= attempts || !retryOn(error)) throw error;
      await sleep(backoffDelay(attempt, baseMs, capMs, random));
    }
  }
}

/**
 * Rejects with TimeoutError if `promise` has not settled after `ms`. The underlying
 * operation keeps running, so only wrap reads or calls that are safe to abandon.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
