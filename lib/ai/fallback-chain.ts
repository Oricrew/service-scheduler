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
  /** Hard deadline across the entire chain in ms. */
  totalDeadlineMs?: number;
  /** Per-attempt timeout cap in ms (default 8 000). */
  perAttemptMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
  /** Injected for testing — forwarded to withRetry. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for testing — forwarded to CircuitBreaker and deadline logic. */
  now?: () => number;
}

/**
 * Module-level circuit breaker registry.
 *
 * Keyed by `name:model` so that breaker state persists across calls
 * and across requests within a single process. Switching models
 * (e.g. via env change) gets a fresh breaker automatically.
 */
const breakerRegistry = new Map<string, CircuitBreaker>();

/** Visible for testing — clears all stored breakers. */
export function _resetBreakers(): void {
  breakerRegistry.clear();
}

function breakerKey(name: string, model: string): string {
  return `${name}:${model}`;
}

function getOrCreateBreaker(
  key: string,
  threshold: number,
  resetMs: number,
  now?: () => number,
): CircuitBreaker {
  const existing = breakerRegistry.get(key);
  if (existing) return existing;

  const breaker = new CircuitBreaker({
    threshold,
    resetTimeMs: resetMs,
    now,
  });
  breakerRegistry.set(key, breaker);
  return breaker;
}

/**
 * Whether an error should count toward the circuit breaker.
 *
 * Only transient failures (5xx, 429, timeout, network) trip the breaker.
 * Safety blocks, empty/invalid responses, and 4xx auth/validation errors
 * do not — they indicate a content or config problem, not an outage.
 */
function shouldTripBreaker(err: unknown): boolean {
  if (!(err instanceof AiProviderError)) return false;
  return err.transient;
}

const DEFAULT_TOTAL_DEADLINE_MS = 15_000;
const DEFAULT_PER_ATTEMPT_MS = 8_000;

/**
 * Build a {@link CompletionProvider} that walks through `entries` in
 * order, retrying transient errors with backoff inside each entry and
 * advancing to the next entry on persistent or exhausted failures.
 *
 * Timeout errors are never retried on the same entry — they immediately
 * advance to the next provider.  An overall deadline caps worst-case
 * latency across the whole chain.  Each individual attempt is capped
 * at min(perAttemptMs, remaining deadline) so a hung primary leaves
 * time for the fallbacks.
 *
 * Each entry has its own circuit breaker (keyed by `name:model`) —
 * after N consecutive *transient* failures the entry is skipped until
 * the cooldown expires.  Non-transient errors (safety blocks, 4xx)
 * prove reachability and release the half-open probe slot without
 * tripping the breaker.
 */
export function createFallbackProvider(
  entries: ProviderEntry[],
  opts: FallbackChainOptions = {},
): CompletionProvider {
  if (entries.length === 0) {
    return async () => {
      throw new AiProviderError("No AI providers configured", {
        transient: false,
        kind: "unknown",
      });
    };
  }

  const threshold = opts.circuitBreakerThreshold ?? 5;
  const resetMs = opts.circuitBreakerResetMs ?? 30_000;
  const totalDeadline = opts.totalDeadlineMs ?? DEFAULT_TOTAL_DEADLINE_MS;
  const perAttemptCap = opts.perAttemptMs ?? DEFAULT_PER_ATTEMPT_MS;
  const nowFn = opts.now ?? Date.now;

  const breakers = entries.map((e) =>
    getOrCreateBreaker(
      breakerKey(e.name, e.model),
      threshold,
      resetMs,
      opts.now,
    ),
  );

  return async (prompt, callerOpts) => {
    const chainStart = nowFn();
    const deadlineTs = chainStart + totalDeadline;
    let lastError: unknown;

    for (let i = 0; i < entries.length; i++) {
      const remaining = deadlineTs - nowFn();
      if (remaining <= 0) break;

      const entry = entries[i];
      const breaker = breakers[i];
      if (breaker.isOpen) continue;

      const attemptTimeout = Math.min(perAttemptCap, remaining);

      const retryOpts: RetryOptions = {
        maxRetries: opts.maxRetries ?? 2,
        sleep: opts.sleep,
        skipTimeouts: true,
        deadlineTs,
        now: nowFn,
      };

      try {
        const result = await withRetry(
          () =>
            entry.provider(prompt, {
              model: entry.model,
              apiKey: entry.apiKey,
              system: callerOpts.system,
              maxTokens: callerOpts.maxTokens,
              timeoutMs: attemptTimeout,
            }),
          retryOpts,
        );
        breaker.recordSuccess();
        return result;
      } catch (err) {
        if (shouldTripBreaker(err)) {
          breaker.recordFailure();
        } else {
          // Non-transient errors (safety block, 4xx, plain Error) prove
          // the provider is reachable — release the half-open probe slot.
          breaker.recordSuccess();
        }
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    throw new AiProviderError("All AI providers are circuit-broken", {
      transient: true,
      kind: "unknown",
    });
  };
}
