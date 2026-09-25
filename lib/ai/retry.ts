import { AiProviderError } from "./errors";

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** When true, timeout errors are not retried — they rethrow immediately. */
  skipTimeouts?: boolean;
  /** Injected for testing — defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 4_000;

/**
 * Execute `fn` with retries for transient failures only.
 *
 * Non-transient {@link AiProviderError}s are rethrown immediately.
 * When `skipTimeouts` is set, timeout errors also rethrow immediately
 * so the fallback chain can advance to the next provider instead of
 * burning retries on a slow endpoint.
 * Generic (non-AiProviderError) exceptions are retried as a precaution.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleepFn = opts.sleep ?? defaultSleep;
  const skipTimeouts = opts.skipTimeouts ?? false;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt) break;

      if (err instanceof AiProviderError && !err.transient) break;

      if (
        skipTimeouts &&
        err instanceof AiProviderError &&
        err.message.includes("timed out")
      ) {
        break;
      }

      const exponentialDelay = baseDelay * 2 ** attempt;
      const capped = Math.min(exponentialDelay, maxDelay);
      const jitter = capped * (0.5 + Math.random() * 0.5);
      await sleepFn(jitter);
    }
  }

  throw lastError;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
