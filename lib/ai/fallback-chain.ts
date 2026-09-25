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
 * Module-level circuit breaker registry.
 *
 * Keyed by provider name so that breaker state persists across
 * calls to `createFallbackProvider` and across requests within
 * a single process. This avoids rebuilding breakers on every
 * `completeJson` invocation.
 */
const breakerRegistry = new Map<string, CircuitBreaker>();

/** Visible for testing — clears all stored breakers. */
export function _resetBreakers(): void {
  breakerRegistry.clear();
}

function getOrCreateBreaker(
  name: string,
  threshold: number,
  resetMs: number,
  now?: () => number,
): CircuitBreaker {
  const existing = breakerRegistry.get(name);
  if (existing) return existing;

  const breaker = new CircuitBreaker({
    threshold,
    resetTimeMs: resetMs,
    now,
  });
  breakerRegistry.set(name, breaker);
  return breaker;
}

/**
 * Build a {@link CompletionProvider} that walks through `entries` in
 * order, retrying transient errors with backoff inside each entry and
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

  const threshold = opts.circuitBreakerThreshold ?? 5;
  const resetMs = opts.circuitBreakerResetMs ?? 30_000;

  const breakers = entries.map((e) =>
    getOrCreateBreaker(e.name, threshold, resetMs, opts.now),
  );

  const retryOpts: RetryOptions = {
    maxRetries: opts.maxRetries ?? 2,
    sleep: opts.sleep,
  };

  return async (prompt, callerOpts) => {
    let lastError: unknown;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const breaker = breakers[i];
      if (breaker.isOpen) continue;

      try {
        const result = await withRetry(
          () =>
            entry.provider(prompt, {
              model: entry.model,
              apiKey: entry.apiKey,
              system: callerOpts.system,
              maxTokens: callerOpts.maxTokens,
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
