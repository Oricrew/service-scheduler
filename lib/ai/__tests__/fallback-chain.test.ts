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

function failingProvider(err: AiProviderError): CompletionProvider {
  return vi.fn().mockRejectedValue(err);
}

const transientErr = new AiProviderError("service unavailable", {
  transient: true,
  statusCode: 503,
});

const permanentErr = new AiProviderError("bad request", {
  transient: false,
  statusCode: 400,
});

const timeoutErr = new AiProviderError("AI provider request timed out", {
  transient: true,
});

const safetyBlockErr = new AiProviderError(
  "AI provider response was blocked or empty",
  { transient: false },
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

  it("passes entry-specific model, apiKey, maxTokens, and timeoutMs", async () => {
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
      timeoutMs: 15_000,
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
      // Simulate a provider that always times out after consuming its
      // full timeoutMs budget.  With skipTimeouts the chain never retries
      // a timeout, so each entry consumes at most the remaining budget.
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

    it("passes remaining budget as timeoutMs to each attempt", async () => {
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
        now: () => now,
      });

      await provider("prompt", callOpts);

      const secondaryCall = (secondary as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, { timeoutMs: number }];
      expect(secondaryCall[1].timeoutMs).toBe(5000);
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

      // Primary was still called every time — not circuit-broken
      expect(primary).toHaveBeenCalledTimes(3);
    });

    it("4xx errors do NOT trip the circuit breaker", async () => {
      const http400Err = new AiProviderError("AI provider returned HTTP 400", {
        transient: false,
        statusCode: 400,
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
});
