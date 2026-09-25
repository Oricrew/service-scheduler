/**
 * In-memory sliding-window rate limiter keyed by client IP.
 *
 * Two independent limits are enforced:
 *   1. RPM  – requests per minute  (env: AI_RATE_LIMIT_RPM,  default 5)
 *   2. Daily – requests per 24 h rolling window (env: AI_RATE_LIMIT_DAILY, default 25)
 *
 * Suitable for a single-process deployment.  Swap for Redis / Upstash
 * when horizontal scaling is needed.
 */

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 86_400_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRpmLimit(): number {
  return envInt("AI_RATE_LIMIT_RPM", 5);
}

export function getDailyLimit(): number {
  return envInt("AI_RATE_LIMIT_DAILY", 25);
}

const buckets = new Map<string, number[]>();

function prune(key: string, windowMs: number): number[] {
  const now = Date.now();
  const cutoff = now - windowMs;
  const timestamps = buckets.get(key) ?? [];
  const pruned = timestamps.filter((t) => t > cutoff);
  buckets.set(key, pruned);
  return pruned;
}

export type RateLimitResult =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number; kind: "rpm" | "daily" };

/**
 * Check + record a request for `key`.
 * Returns `{ limited: false }` when allowed, or
 * `{ limited: true, retryAfterSeconds, kind }` when blocked.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const rpmMax = getRpmLimit();
  const dailyMax = getDailyLimit();
  const now = Date.now();

  const minuteKey = `rpm:${key}`;
  const dayKey = `daily:${key}`;

  const minuteHits = prune(minuteKey, ONE_MINUTE_MS);
  if (minuteHits.length >= rpmMax) {
    const oldest = minuteHits[0];
    const retryAfterSeconds = Math.ceil((oldest + ONE_MINUTE_MS - now) / 1_000);
    return { limited: true, retryAfterSeconds, kind: "rpm" };
  }

  const dayHits = prune(dayKey, ONE_DAY_MS);
  if (dayHits.length >= dailyMax) {
    const oldest = dayHits[0];
    const retryAfterSeconds = Math.ceil((oldest + ONE_DAY_MS - now) / 1_000);
    return { limited: true, retryAfterSeconds, kind: "daily" };
  }

  minuteHits.push(now);
  dayHits.push(now);
  return { limited: false };
}

/** Visible for testing — clears all stored timestamps. */
export function _resetAllBuckets(): void {
  buckets.clear();
}
