import { describe, expect, it, vi, afterEach } from "vitest";

import { openaiProvider } from "../openai-provider";
import { AiProviderError } from "../errors";

const defaultOpts = {
  model: "gpt-4o-mini",
  apiKey: "test-key",
};

function mockFetchOk(content: string) {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

function mockFetchStatus(status: number) {
  return vi.fn().mockResolvedValue(new Response("error", { status }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openaiProvider", () => {
  it("returns content on success", async () => {
    vi.stubGlobal("fetch", mockFetchOk('{"title":"Haircut"}'));

    const result = await openaiProvider("test", defaultOpts);

    expect(result).toBe('{"title":"Haircut"}');
  });

  it("sends correct headers and body", async () => {
    const fetchMock = mockFetchOk('{"ok":true}');
    vi.stubGlobal("fetch", fetchMock);

    await openaiProvider("my prompt", {
      ...defaultOpts,
      system: "custom system",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      }),
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([
      { role: "system", content: "custom system" },
      { role: "user", content: "my prompt" },
    ]);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("passes maxTokens when provided", async () => {
    const fetchMock = mockFetchOk('{"ok":true}');
    vi.stubGlobal("fetch", fetchMock);

    await openaiProvider("prompt", { ...defaultOpts, maxTokens: 256 });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.max_tokens).toBe(256);
  });

  it("throws transient AiProviderError for 429", async () => {
    vi.stubGlobal("fetch", mockFetchStatus(429));

    try {
      await openaiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      const ae = err as AiProviderError;
      expect(ae.message).toBe("AI provider returned HTTP 429");
      expect(ae.transient).toBe(true);
      expect(ae.statusCode).toBe(429);
    }
  });

  it("throws transient AiProviderError for 500", async () => {
    vi.stubGlobal("fetch", mockFetchStatus(500));

    try {
      await openaiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      expect((err as AiProviderError).transient).toBe(true);
    }
  });

  it("throws non-transient AiProviderError for 401", async () => {
    vi.stubGlobal("fetch", mockFetchStatus(401));

    try {
      await openaiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      const ae = err as AiProviderError;
      expect(ae.transient).toBe(false);
      expect(ae.statusCode).toBe(401);
    }
  });

  it("throws for empty content", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ choices: [{ message: { content: "" } }] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    await expect(openaiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider returned an empty response",
    );
  });

  it("throws for network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    try {
      await openaiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError);
      expect((err as AiProviderError).transient).toBe(true);
      expect((err as AiProviderError).message).toBe(
        "AI provider request failed",
      );
    }
  });

  it("does not leak raw error details", async () => {
    vi.stubGlobal("fetch", mockFetchStatus(401));

    try {
      await openaiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toBe("AI provider returned HTTP 401");
      expect(msg).not.toContain("Unauthorized");
      expect(msg).not.toContain("API key");
    }
  });
});
