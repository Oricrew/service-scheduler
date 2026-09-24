import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";

import { geminiProvider } from "../provider";

let mockGenerateContent: ReturnType<typeof vi.fn>;

vi.mock("@google/generative-ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/generative-ai")>();
  return {
    ...actual,
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return { generateContent: mockGenerateContent };
      }
    },
  };
});

const defaultOpts = {
  model: "gemini-2.0-flash",
  apiKey: "test-key",
};

beforeEach(() => {
  mockGenerateContent = vi.fn();
});

describe("geminiProvider error sanitization", () => {
  it("converts GoogleGenerativeAIFetchError to a sanitized HTTP status message", async () => {
    const sdkError = new GoogleGenerativeAIFetchError(
      'got status: 429 Too Many Requests. {"error":{"message":"Resource exhausted"}}',
      429,
      "Too Many Requests",
      [
        {
          "@type": "type.googleapis.com/google.rpc.ErrorInfo",
          reason: "RATE_LIMIT_EXCEEDED",
          domain: "googleapis.com",
        },
      ],
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    await expect(geminiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider returned HTTP 429",
    );
  });

  it("does not leak raw SDK message for fetch errors", async () => {
    const sdkError = new GoogleGenerativeAIFetchError(
      'got status: 401 Unauthorized. {"error":{"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}',
      401,
      "Unauthorized",
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    try {
      await geminiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toBe("AI provider returned HTTP 401");
      expect(msg).not.toContain("API key not valid");
      expect(msg).not.toContain("INVALID_ARGUMENT");
    }
  });

  it("converts GoogleGenerativeAIAbortError to a timeout message", async () => {
    const sdkError = new GoogleGenerativeAIAbortError(
      "Request timed out after 20000ms",
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    await expect(geminiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider request timed out",
    );
  });

  it("converts GoogleGenerativeAIResponseError to a blocked-or-empty message", async () => {
    const sdkError = new GoogleGenerativeAIResponseError(
      "Response was blocked due to SAFETY with detailed filter categories and scores",
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    await expect(geminiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider response was blocked or empty",
    );
  });

  it("converts unknown errors to a generic failure message", async () => {
    mockGenerateContent.mockRejectedValue(new TypeError("fetch failed"));

    await expect(geminiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider request failed",
    );
  });

  it("converts response.text() errors to a blocked-or-empty message", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text() {
          throw new GoogleGenerativeAIResponseError(
            "Content blocked by safety filters: HARM_CATEGORY_DANGEROUS_CONTENT",
            { candidates: [] },
          );
        },
      },
    });

    try {
      await geminiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toBe("AI provider response was blocked or empty");
      expect(msg).not.toContain("HARM_CATEGORY");
      expect(msg).not.toContain("safety filters");
    }
  });

  it("returns content on success", async () => {
    const fixture = '{"title":"Haircut","duration":30}';
    mockGenerateContent.mockResolvedValue({
      response: { text: () => fixture },
    });

    const result = await geminiProvider("test prompt", defaultOpts);
    expect(result).toBe(fixture);
  });

  it("throws for empty response text", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "" },
    });

    await expect(geminiProvider("test", defaultOpts)).rejects.toThrow(
      "AI provider returned an empty response",
    );
  });

  it("converts fetch error without status to HTTP 0", async () => {
    const sdkError = new GoogleGenerativeAIFetchError(
      "network error with sensitive internal details",
    );
    mockGenerateContent.mockRejectedValue(sdkError);

    try {
      await geminiProvider("test", defaultOpts);
      expect.unreachable("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toBe("AI provider returned HTTP 0");
      expect(msg).not.toContain("sensitive");
      expect(msg).not.toContain("network error");
    }
  });
});
