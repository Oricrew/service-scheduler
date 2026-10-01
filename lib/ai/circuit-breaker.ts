/**
 * Circuit breaker with three states:
 *
 *  - CLOSED    → requests flow through normally
 *  - OPEN      → requests are rejected immediately
 *  - HALF-OPEN → exactly one probe request is allowed; concurrent
 *                callers are still rejected. If the probe succeeds
 *                the breaker closes; if it fails the breaker reopens
 *                with a fresh cooldown.
 */

type State = "closed" | "open" | "half-open";

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private state: State = "closed";
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
    if (this.state === "closed") return false;

    if (this.state === "open") {
      if (this.nowFn() - this.lastFailureTime >= this.resetTimeMs) {
        this.state = "half-open";
        return false;
      }
      return true;
    }

    // half-open: a probe is already in flight — reject concurrent callers
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = this.nowFn();

    if (
      this.state === "half-open" ||
      this.consecutiveFailures >= this.threshold
    ) {
      this.state = "open";
    }
  }
}
