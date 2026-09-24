/**
 * Simple circuit breaker that opens after `threshold` consecutive failures
 * and resets after `resetTimeMs` of inactivity.
 *
 * States:
 *  - CLOSED  → requests flow through normally
 *  - OPEN    → requests are rejected immediately
 *  - HALF-OPEN → first request after cooldown is allowed as a probe
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeMs: number;
  private readonly nowFn: () => number;

  constructor(
    opts: {
      threshold?: number;
      resetTimeMs?: number;
      now?: () => number;
    } = {},
  ) {
    this.threshold = opts.threshold ?? 5;
    this.resetTimeMs = opts.resetTimeMs ?? 30_000;
    this.nowFn = opts.now ?? Date.now;
  }

  get isOpen(): boolean {
    if (this.consecutiveFailures < this.threshold) return false;
    if (this.nowFn() - this.lastFailureTime >= this.resetTimeMs) {
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = this.nowFn();
  }
}
