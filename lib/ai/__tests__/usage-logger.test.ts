import { describe, expect, it, beforeEach, vi } from "vitest";

import { logPrefillUsage, _resetUsageTimestamps } from "../usage-logger";

beforeEach(() => {
  _resetUsageTimestamps();
  vi.unstubAllEnvs();
});

describe("logPrefillUsage", () => {
  it("logs a structured JSON entry to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logPrefillUsage({
      ip: "1.2.3.4",
      durationMs: 350,
      outcome: "success",
    });

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.event).toBe("ai_prefill");
    expect(parsed.ip).toBe("1.2.3.4");
    expect(parsed.outcome).toBe("success");
    spy.mockRestore();
  });

  it("emits AI_SPIKE_ALERT when threshold is exceeded", () => {
    vi.stubEnv("AI_SPIKE_THRESHOLD", "3");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const entry = {
      ip: "1.2.3.4",
      durationMs: 100,
      outcome: "success" as const,
    };

    logPrefillUsage(entry);
    logPrefillUsage(entry);
    expect(warnSpy).not.toHaveBeenCalled();

    logPrefillUsage(entry);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("[AI_SPIKE_ALERT]");

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
