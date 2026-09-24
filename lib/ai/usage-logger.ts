/**
 * Lightweight AI-usage logger.
 *
 * Logs every prefill request (user, IP, latency, outcome) to stdout
 * as structured JSON so any log aggregator can ingest it.
 *
 * When the number of requests in the trailing window exceeds a
 * configurable spike threshold (env: AI_SPIKE_THRESHOLD, default 50
 * per 5 min), an additional `[AI_SPIKE_ALERT]` marker is emitted.
 */

const SPIKE_WINDOW_MS = 5 * 60_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSpikeThreshold(): number {
  return envInt("AI_SPIKE_THRESHOLD", 50);
}

const recentTimestamps: number[] = [];

function pruneWindow(): void {
  const cutoff = Date.now() - SPIKE_WINDOW_MS;
  while (recentTimestamps.length > 0 && recentTimestamps[0] <= cutoff) {
    recentTimestamps.shift();
  }
}

export type UsageEntry = {
  userId: string;
  ip: string;
  durationMs: number;
  outcome: "success" | "error" | "no_fields";
  error?: string;
};

export function logPrefillUsage(entry: UsageEntry): void {
  const now = Date.now();
  recentTimestamps.push(now);
  pruneWindow();

  const record = {
    event: "ai_prefill",
    ts: new Date(now).toISOString(),
    ...entry,
  };

  console.log(JSON.stringify(record));

  if (recentTimestamps.length >= getSpikeThreshold()) {
    console.warn(
      `[AI_SPIKE_ALERT] ${recentTimestamps.length} AI prefill requests in the last 5 min (threshold: ${getSpikeThreshold()})`,
    );
  }
}

/** Visible for testing. */
export function _resetUsageTimestamps(): void {
  recentTimestamps.length = 0;
}
