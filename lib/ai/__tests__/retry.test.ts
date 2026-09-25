import { describe, expect, it, vi } from "vitest";

import { AiProviderError } from "../errors";
import { withRetry } from "../retry";

const noopSleep = vi.fn().mockResolvedValue(undefined);

describe("withRetry", () => {
  it("returns immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { sleep: noopSleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(noopSleep).not.toHaveBeenCalled();
  });

  it("retries transient AiProviderError up to maxRetries", async () => {
    const transient = new AiProviderError("rate limited", {
      transient: true,
      statusCode: 429,
    });
    const fn = vi.fn().mockRejectedValue(transient);

    await expect(
      withRetry(fn, { maxRetries: 2, sleep: noopSleep }),
    ).rejects.toThrow("rate limited");

    expect(fn).toHaveBeenCalledTimes(3);
    expect(noopSleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient AiProviderError", async () => {
    const permanent = new AiProviderError("bad request", {
      transient: false,
      statusCode: 400,
    });
    const fn = vi.fn().mockRejectedValue(permanent);

    await expect(
      withRetry(fn, { maxRetries: 3, sleep: noopSleep }),
    ).rejects.toThrow("bad request");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(noopSleep).not.toHaveBeenCalled();
  });

  it("retries generic (non-AiProviderError) errors", async () => {
    const err = new TypeError("fetch failed");
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { maxRetries: 1, sleep: noopSleep }),
    ).rejects.toThrow("fetch failed");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("succeeds after transient failures followed by success", async () => {
    const transient = new AiProviderError("timeout", { transient: true });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, { maxRetries: 2, sleep: noopSleep });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("applies exponential backoff with jitter", async () => {
    const transient = new AiProviderError("timeout", { transient: true });
    const fn = vi.fn().mockRejectedValue(transient);
    const sleepSpy = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 1000,
        maxDelayMs: 10_000,
        sleep: sleepSpy,
      }),
    ).rejects.toThrow();

    expect(sleepSpy).toHaveBeenCalledTimes(2);
    const [first] = sleepSpy.mock.calls[0] as [number];
    const [second] = sleepSpy.mock.calls[1] as [number];
    expect(first).toBeGreaterThanOrEqual(500);
    expect(first).toBeLessThanOrEqual(1000);
    expect(second).toBeGreaterThanOrEqual(1000);
    expect(second).toBeLessThanOrEqual(2000);
  });

  it("caps delay at maxDelayMs", async () => {
    const transient = new AiProviderError("timeout", { transient: true });
    const fn = vi.fn().mockRejectedValue(transient);
    const sleepSpy = vi.fn().mockResolvedValue(undefined);

    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        sleep: sleepSpy,
      }),
    ).rejects.toThrow();

    for (const [ms] of sleepSpy.mock.calls as [number][]) {
      expect(ms).toBeLessThanOrEqual(2000);
    }
  });

  it("does not retry timeouts when skipTimeouts is true", async () => {
    const timeoutErr = new AiProviderError("AI provider request timed out", {
      transient: true,
    });
    const fn = vi.fn().mockRejectedValue(timeoutErr);

    await expect(
      withRetry(fn, { maxRetries: 3, sleep: noopSleep, skipTimeouts: true }),
    ).rejects.toThrow("timed out");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("still retries non-timeout transient errors when skipTimeouts is true", async () => {
    const transient = new AiProviderError("rate limited", {
      transient: true,
      statusCode: 429,
    });
    const fn = vi.fn().mockRejectedValue(transient);

    await expect(
      withRetry(fn, { maxRetries: 1, sleep: noopSleep, skipTimeouts: true }),
    ).rejects.toThrow("rate limited");

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
