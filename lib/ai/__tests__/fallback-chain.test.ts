import { describe, expect, it, vi, beforeEach } from "vitest";

import { AiProviderError } from "../errors";
import {
  createFallbackProvider,
  _resetBreakers,
  type ProviderEntry,
} from "../fallback-chain";
import type { CompletionProvider } from "../types";

const noopSleep = vi.fn().mockResolvedValue(undefined);
const callOpts = {
  model: "ignored",
  apiKey: "ignored",
  system: undefined,
  maxTokens: undefined,
};

function mockProvider(result: string): CompletionProvider {
  return vi.fn().mockResolvedValue(result);
}

function failingProvider(err: Error): CompletionProvider {
  return vi.fn().mockRejectedValue(err);
}

const transientErr = new AiProviderError("service unavailable", {
  transient: true,
  statusCode: 503,
  kind: "http",
});

const permanentErr = new AiProviderError("bad request", {
  transient: false,
  statusCode: 400,
  kind: "http",
});

const timeoutErr = new AiProviderError("AI provider request timed out", {
  transient: true,
  kind: "timeout",
});

const safetyBlockErr = new AiProviderError(
  "AI provider response was blocked or empty",
  { transient: false, kind: "blocked" },
);

beforeEach(() => {
  _resetBreakers();
  vi.unstubAllEnvs();
});

describe("createFallbackProvider", () => {
  it("returns result from primary provider on success", async () => {
    const primary = mockProvider("primary-ok");
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("primary-ok");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).not.toHaveBeenCalled();
  });

  it("falls back to secondary when primary fails with transient error", async () => {
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
  });

  it("falls back to secondary when primary fails with permanent error", async () => {
    const primary = failingProvider(permanentErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
  });

  it("retries transient errors before falling back", async () => {
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 2,
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
    expect(primary).toHaveBeenCalledTimes(3);
  });

  it("throws the last error when all providers fail", async () => {
    const primary = failingProvider(transientErr);
    const secondary = failingProvider(permanentErr);
    const entries: ProviderEntry[] = [
      { name: "p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });

    await expect(provider("prompt", callOpts)).rejects.toThrow("bad request");
  });

  it("throws when no providers are configured", async () => {
    const provider = createFallbackProvider([]);
    await expect(provider("prompt", callOpts)).rejects.toThrow(
      "No AI providers configured",
    );
  });

  it("passes entry-specific model, apiKey, maxTokens, and capped timeoutMs", async () => {
    const now = 0;
    const primary = vi.fn().mockResolvedValue("ok");
    const entries: ProviderEntry[] = [
      {
        name: "p",
        provider: primary,
        model: "entry-model",
        apiKey: "entry-key",
      },
    ];

    const provider = createFallbackProvider(entries, {
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
      perAttemptMs: 8_000,
      now: () => now,
    });
    await provider("prompt", {
      model: "caller-model",
      apiKey: "caller-key",
      system: "sys",
      maxTokens: 512,
    });

    expect(primary).toHaveBeenCalledWith("prompt", {
      model: "entry-model",
      apiKey: "entry-key",
      system: "sys",
      maxTokens: 512,
      timeoutMs: 8_000,
    });
  });

  it("skips circuit-broken providers", async () => {
    const now = 0;
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "cb-p", provider: primary, model: "m1", apiKey: "k1" },
      { name: "cb-s", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 10_000,
      sleep: noopSleep,
      now: () => now,
      totalDeadlineMs: 15_000,
    });

    await provider("prompt1", callOpts);
    await provider("prompt2", callOpts);

    (primary as ReturnType<typeof vi.fn>).mockClear();
    (secondary as ReturnType<typeof vi.fn>).mockClear();

    const result = await provider("prompt3", callOpts);
    expect(result).toBe("secondary-ok");
    expect(primary).not.toHaveBeenCalled();
    expect(secondary).toHaveBeenCalledTimes(1);
  });

  it("re-probes circuit-broken provider after cooldown", async () => {
    let now = 0;
    const primaryFn = vi
      .fn()
      .mockRejectedValueOnce(transientErr)
      .mockRejectedValueOnce(transientErr)
      .mockResolvedValue("primary-recovered");

    const entries: ProviderEntry[] = [
      { name: "probe-p", provider: primaryFn, model: "m1", apiKey: "k1" },
      {
        name: "probe-s",
        provider: mockProvider("secondary-ok"),
        model: "m2",
        apiKey: "k2",
      },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 5000,
      sleep: noopSleep,
      now: () => now,
      totalDeadlineMs: 15_000,
    });

    await provider("p1", callOpts);
    await provider("p2", callOpts);

    now = 5000;
    const result = await provider("p3", callOpts);
    expect(result).toBe("primary-recovered");
  });

  it("walks the full chain: primary → secondary Gemini → OpenAI", async () => {
    const callOrder: string[] = [];
    const primary: CompletionProvider = vi.fn().mockImplementation(() => {
      callOrder.push("primary");
      throw transientErr;
    });
    const secondary: CompletionProvider = vi.fn().mockImplementation(() => {
      callOrder.push("secondary");
      throw transientErr;
    });
    const tertiary: CompletionProvider = vi.fn().mockImplementation(() => {
      callOrder.push("openai");
      return "openai-result";
    });

    const entries: ProviderEntry[] = [
      { name: "chain-gp", provider: primary, model: "pro", apiKey: "k" },
      {
        name: "chain-gf",
        provider: secondary,
        model: "flash",
        apiKey: "k",
      },
      {
        name: "chain-oa",
        provider: tertiary,
        model: "gpt-4o-mini",
        apiKey: "ok",
      },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
      totalDeadlineMs: 15_000,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("openai-result");
    expect(callOrder).toEqual(["primary", "secondary", "openai"]);
  });

  it("module-level breakers persist across createFallbackProvider calls", async () => {
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");

    const makeProvider = () =>
      createFallbackProvider(
        [
          {
            name: "persist-p",
            provider: primary,
            model: "m1",
            apiKey: "k1",
          },
          {
            name: "persist-s",
            provider: secondary,
            model: "m2",
            apiKey: "k2",
          },
        ],
        {
          maxRetries: 0,
          circuitBreakerThreshold: 2,
          sleep: noopSleep,
          totalDeadlineMs: 15_000,
        },
      );

    const p1 = makeProvider();
    await p1("a", callOpts);
    await p1("b", callOpts);

    (primary as ReturnType<typeof vi.fn>).mockClear();
    const p2 = makeProvider();
    const result = await p2("c", callOpts);

    expect(result).toBe("secondary-ok");
    expect(primary).not.toHaveBeenCalled();
  });

  describe("overall deadline", () => {
    it("stops the chain when deadline is exhausted", async () => {
      let now = 0;
      const slow: CompletionProvider = vi.fn().mockImplementation(async () => {
        now += 10_000;
        throw transientErr;
      });
      const secondary = mockProvider("secondary-ok");

      const entries: ProviderEntry[] = [
        { name: "slow-p", provider: slow, model: "m1", apiKey: "k1" },
        { name: "dl-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        sleep: noopSleep,
        totalDeadlineMs: 8_000,
        now: () => now,
      });

      await expect(provider("prompt", callOpts)).rejects.toThrow(
        "service unavailable",
      );
      expect(secondary).not.toHaveBeenCalled();
    });

    it("worst-case latency is bounded by deadline", async () => {
      let now = 0;
      const slow: CompletionProvider = vi
        .fn()
        .mockImplementation(
          async (_p: string, opts: { timeoutMs?: number }) => {
            now += opts.timeoutMs ?? 5000;
            throw timeoutErr;
          },
        );

      const entries: ProviderEntry[] = [
        { name: "wc-a", provider: slow, model: "m1", apiKey: "k1" },
        { name: "wc-b", provider: slow, model: "m2", apiKey: "k2" },
        { name: "wc-c", provider: slow, model: "m3", apiKey: "k3" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 2,
        sleep: noopSleep,
        totalDeadlineMs: 15_000,
        now: () => now,
      });

      const startNow = now;
      await expect(provider("prompt", callOpts)).rejects.toThrow();
      const elapsed = now - startNow;
      expect(elapsed).toBeLessThanOrEqual(15_000);
    });

    it("passes remaining budget as timeoutMs capped by perAttemptMs", async () => {
      let now = 0;
      const primary: CompletionProvider = vi
        .fn()
        .mockImplementation(async () => {
          now += 5000;
          throw transientErr;
        });
      const secondary = vi.fn().mockResolvedValue("ok");

      const entries: ProviderEntry[] = [
        { name: "bud-p", provider: primary, model: "m1", apiKey: "k1" },
        { name: "bud-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        sleep: noopSleep,
        totalDeadlineMs: 10_000,
        perAttemptMs: 8_000,
        now: () => now,
      });

      await provider("prompt", callOpts);

      const secondaryCall = (secondary as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, { timeoutMs: number }];
      expect(secondaryCall[1].timeoutMs).toBe(5000);
    });

    it("primary hangs but fallback still succeeds within deadline", async () => {
      let now = 0;
      const hanging: CompletionProvider = vi
        .fn()
        .mockImplementation(
          async (_p: string, opts: { timeoutMs?: number }) => {
            now += opts.timeoutMs ?? 8_000;
            throw timeoutErr;
          },
        );
      const fallback = vi.fn().mockImplementation(async () => {
        now += 500;
        return "fallback-ok";
      });

      const entries: ProviderEntry[] = [
        { name: "hang-p", provider: hanging, model: "m1", apiKey: "k1" },
        { name: "hang-f", provider: fallback, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        sleep: noopSleep,
        totalDeadlineMs: 15_000,
        perAttemptMs: 8_000,
        now: () => now,
      });

      const startNow = now;
      const result = await provider("prompt", callOpts);
      const elapsed = now - startNow;

      expect(result).toBe("fallback-ok");
      expect(elapsed).toBeLessThanOrEqual(15_000);
      expect(elapsed).toBe(8_500);
    });
  });

  describe("timeout handling", () => {
    it("does not retry timeouts — moves to next provider immediately", async () => {
      const primary = failingProvider(timeoutErr);
      const secondary = mockProvider("secondary-ok");
      const entries: ProviderEntry[] = [
        { name: "to-p", provider: primary, model: "m1", apiKey: "k1" },
        { name: "to-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 2,
        sleep: noopSleep,
        totalDeadlineMs: 15_000,
      });
      const result = await provider("prompt", callOpts);

      expect(result).toBe("secondary-ok");
      expect(primary).toHaveBeenCalledTimes(1);
    });
  });

  describe("breaker trip classification", () => {
    it("transient errors (5xx) trip the circuit breaker", async () => {
      const now = 0;
      const primary = failingProvider(transientErr);
      const secondary = mockProvider("secondary-ok");
      const entries: ProviderEntry[] = [
        { name: "trip-p", provider: primary, model: "m1", apiKey: "k1" },
        { name: "trip-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      await provider("a", callOpts);
      await provider("b", callOpts);

      (primary as ReturnType<typeof vi.fn>).mockClear();
      await provider("c", callOpts);
      expect(primary).not.toHaveBeenCalled();
    });

    it("safety blocks (non-transient) do NOT trip the circuit breaker", async () => {
      const now = 0;
      const primary = failingProvider(safetyBlockErr);
      const secondary = mockProvider("secondary-ok");
      const entries: ProviderEntry[] = [
        { name: "safe-p", provider: primary, model: "m1", apiKey: "k1" },
        { name: "safe-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      await provider("a", callOpts);
      await provider("b", callOpts);
      await provider("c", callOpts);

      expect(primary).toHaveBeenCalledTimes(3);
    });

    it("4xx errors do NOT trip the circuit breaker", async () => {
      const http400Err = new AiProviderError("AI provider returned HTTP 400", {
        transient: false,
        statusCode: 400,
        kind: "http",
      });
      const now = 0;
      const primary = failingProvider(http400Err);
      const secondary = mockProvider("secondary-ok");
      const entries: ProviderEntry[] = [
        { name: "4xx-p", provider: primary, model: "m1", apiKey: "k1" },
        { name: "4xx-s", provider: secondary, model: "m2", apiKey: "k2" },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      await provider("a", callOpts);
      await provider("b", callOpts);
      await provider("c", callOpts);

      expect(primary).toHaveBeenCalledTimes(3);
    });
  });

  describe("half-open probe slot release", () => {
    it("releases half-open slot when probe fails with non-transient 400", async () => {
      let now = 0;
      const primaryFn = vi
        .fn()
        .mockRejectedValueOnce(transientErr)
        .mockRejectedValueOnce(transientErr)
        // Probe attempt: non-transient 400
        .mockRejectedValueOnce(permanentErr)
        // Next call after probe closed the breaker
        .mockResolvedValue("primary-ok");

      const entries: ProviderEntry[] = [
        { name: "ho400-p", provider: primaryFn, model: "m1", apiKey: "k1" },
        {
          name: "ho400-s",
          provider: mockProvider("secondary-ok"),
          model: "m2",
          apiKey: "k2",
        },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 1000,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      // Trip the breaker with 2 transient failures
      await provider("a", callOpts);
      await provider("b", callOpts);

      // After cooldown, probe with a 400 — non-transient, but proves reachability
      now = 1000;
      const r1 = await provider("c", callOpts);
      // Falls back to secondary for this request (probe errored)
      expect(r1).toBe("secondary-ok");

      // Breaker should be closed now (recordSuccess on non-transient)
      // so next call tries primary again
      const r2 = await provider("d", callOpts);
      expect(r2).toBe("primary-ok");
    });

    it("releases half-open slot when probe fails with a plain Error", async () => {
      let now = 0;
      const plainError = new Error("unexpected");
      const primaryFn = vi
        .fn()
        .mockRejectedValueOnce(transientErr)
        .mockRejectedValueOnce(transientErr)
        // Probe: plain Error (not AiProviderError)
        .mockRejectedValueOnce(plainError)
        // Next call after probe closed breaker
        .mockResolvedValue("primary-ok");

      const entries: ProviderEntry[] = [
        {
          name: "hoplain-p",
          provider: primaryFn,
          model: "m1",
          apiKey: "k1",
        },
        {
          name: "hoplain-s",
          provider: mockProvider("secondary-ok"),
          model: "m2",
          apiKey: "k2",
        },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 1000,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      await provider("a", callOpts);
      await provider("b", callOpts);

      now = 1000;
      const r1 = await provider("c", callOpts);
      expect(r1).toBe("secondary-ok");

      // Breaker closed: primary is available again
      const r2 = await provider("d", callOpts);
      expect(r2).toBe("primary-ok");
    });

    it("transient probe failure reopens the breaker", async () => {
      let now = 0;
      const primaryFn = vi.fn().mockRejectedValue(transientErr);

      const entries: ProviderEntry[] = [
        {
          name: "hotrans-p",
          provider: primaryFn,
          model: "m1",
          apiKey: "k1",
        },
        {
          name: "hotrans-s",
          provider: mockProvider("secondary-ok"),
          model: "m2",
          apiKey: "k2",
        },
      ];

      const provider = createFallbackProvider(entries, {
        maxRetries: 0,
        circuitBreakerThreshold: 2,
        circuitBreakerResetMs: 1000,
        sleep: noopSleep,
        now: () => now,
        totalDeadlineMs: 15_000,
      });

      // Trip breaker
      await provider("a", callOpts);
      await provider("b", callOpts);

      // Probe after cooldown — transient failure reopens
      now = 1000;
      primaryFn.mockClear();
      await provider("c", callOpts);
      expect(primaryFn).toHaveBeenCalledTimes(1);

      // Still open — primary skipped
      primaryFn.mockClear();
      await provider("d", callOpts);
      expect(primaryFn).not.toHaveBeenCalled();
    });
  });
});
