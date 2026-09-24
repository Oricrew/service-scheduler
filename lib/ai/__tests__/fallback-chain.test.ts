import { describe, expect, it, vi } from "vitest";

import { AiProviderError } from "../errors";
import { createFallbackProvider, type ProviderEntry } from "../fallback-chain";
import type { CompletionProvider } from "../types";

const noopSleep = vi.fn().mockResolvedValue(undefined);
const callOpts = { model: "ignored", apiKey: "ignored", system: undefined };

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

describe("createFallbackProvider", () => {
  it("returns result from primary provider on success", async () => {
    const primary = mockProvider("primary-ok");
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, { sleep: noopSleep });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("primary-ok");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(secondary).not.toHaveBeenCalled();
  });

  it("falls back to secondary when primary fails with transient error", async () => {
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
  });

  it("falls back to secondary when primary fails with permanent error", async () => {
    const primary = failingProvider(permanentErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
  });

  it("retries transient errors before falling back", async () => {
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 2,
      sleep: noopSleep,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("secondary-ok");
    expect(primary).toHaveBeenCalledTimes(3);
  });

  it("throws the last error when all providers fail", async () => {
    const primary = failingProvider(transientErr);
    const secondary = failingProvider(permanentErr);
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
    });

    await expect(provider("prompt", callOpts)).rejects.toThrow("bad request");
  });

  it("throws when no providers are configured", async () => {
    const provider = createFallbackProvider([]);
    await expect(provider("prompt", callOpts)).rejects.toThrow(
      "No AI providers configured",
    );
  });

  it("passes entry-specific model and apiKey (not caller values)", async () => {
    const primary = vi.fn().mockResolvedValue("ok");
    const entries: ProviderEntry[] = [
      {
        name: "primary",
        provider: primary,
        model: "entry-model",
        apiKey: "entry-key",
      },
    ];

    const provider = createFallbackProvider(entries, { sleep: noopSleep });
    await provider("prompt", {
      model: "caller-model",
      apiKey: "caller-key",
      system: "sys",
    });

    expect(primary).toHaveBeenCalledWith("prompt", {
      model: "entry-model",
      apiKey: "entry-key",
      system: "sys",
    });
  });

  it("skips circuit-broken providers", async () => {
    const now = 0;
    const primary = failingProvider(transientErr);
    const secondary = mockProvider("secondary-ok");
    const entries: ProviderEntry[] = [
      { name: "primary", provider: primary, model: "m1", apiKey: "k1" },
      { name: "secondary", provider: secondary, model: "m2", apiKey: "k2" },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 10_000,
      sleep: noopSleep,
      now: () => now,
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
      { name: "primary", provider: primaryFn, model: "m1", apiKey: "k1" },
      {
        name: "secondary",
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
      { name: "gemini-primary", provider: primary, model: "pro", apiKey: "k" },
      {
        name: "gemini-fallback",
        provider: secondary,
        model: "flash",
        apiKey: "k",
      },
      {
        name: "openai-fallback",
        provider: tertiary,
        model: "gpt-4o-mini",
        apiKey: "ok",
      },
    ];

    const provider = createFallbackProvider(entries, {
      maxRetries: 0,
      sleep: noopSleep,
    });
    const result = await provider("prompt", callOpts);

    expect(result).toBe("openai-result");
    expect(callOrder).toEqual(["primary", "secondary", "openai"]);
  });
});
