import type { CompletionProvider } from "./types";
import { AiProviderError } from "./errors";
import { CircuitBreaker } from "./circuit-breaker";
import { withRetry, type RetryOptions } from "./retry";

export interface ProviderEntry {
  name: string;
  provider: CompletionProvider;
  model: string;
  apiKey: string;
}

export interface FallbackChainOptions {
  maxRetries?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
  /** Injected for testing — forwarded to withRetry. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for testing — forwarded to CircuitBreaker. */
  now?: () => number;
}

/**
 * Build a CompletionProvider that walks through `entries` in order,
 * retrying transient errors with backoff inside each entry and
 * advancing to the next entry on persistent or exhausted failures.
 *
 * Each entry has its own circuit breaker — after N consecutive
 * failures the entry is skipped until the cooldown expires.
 */
export function createFallbackProvider(
  entries: ProviderEntry[],
  opts: FallbackChainOptions = {},
): CompletionProvider {
  if (entries.length === 0) {
    return async () => {
      throw new AiProviderError("No AI providers configured", {
        transient: false,
      });
    };
  }

  const breakers = new Map<string, CircuitBreaker>();
  for (const entry of entries) {
    breakers.set(
      entry.name,
      new CircuitBreaker({
        threshold: opts.circuitBreakerThreshold ?? 5,
        resetTimeMs: opts.circuitBreakerResetMs ?? 30_000,
        now: opts.now,
      }),
    );
  }

  const retryOpts: RetryOptions = {
    maxRetries: opts.maxRetries ?? 2,
    sleep: opts.sleep,
  };

  return async (prompt, callerOpts) => {
    let lastError: unknown;

    for (const entry of entries) {
      const breaker = breakers.get(entry.name)!;
      if (breaker.isOpen) continue;

      try {
        const result = await withRetry(
          () =>
            entry.provider(prompt, {
              model: entry.model,
              apiKey: entry.apiKey,
              system: callerOpts.system,
            }),
          retryOpts,
        );
        breaker.recordSuccess();
        return result;
      } catch (err) {
        breaker.recordFailure();
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    throw new AiProviderError("All AI providers are circuit-broken", {
      transient: true,
    });
  };
}
