import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

import { completeJson } from "../complete-json";
import type { CompletionProvider } from "../types";

const SuggestionSchema = z.object({
  title: z.string(),
  duration: z.number().int().positive(),
});

function fakeProvider(response: string): CompletionProvider {
  return vi.fn().mockResolvedValue(response);
}

function failingProvider(error: string): CompletionProvider {
  return vi.fn().mockRejectedValue(new Error(error));
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("completeJson", () => {
  describe("when AI is disabled", () => {
    it("returns a disabled error without calling the provider", async () => {
      vi.stubEnv("AI_ENABLED", "false");
      vi.stubEnv("AI_API_KEY", "test-key");

      const provider = fakeProvider("{}");
      const result = await completeJson({
        prompt: "test",
        schema: SuggestionSchema,
        provider,
      });

      expect(result).toEqual({
        ok: false,
        error: "AI is disabled (AI_ENABLED is not true)",
      });
      expect(provider).not.toHaveBeenCalled();
    });

    it("returns disabled when AI_ENABLED is not set", async () => {
      vi.stubEnv("AI_ENABLED", "");
      vi.stubEnv("AI_API_KEY", "test-key");

      const result = await completeJson({
        prompt: "test",
        schema: SuggestionSchema,
        provider: fakeProvider("{}"),
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("when API key is missing", () => {
    it("returns an error about the missing key", async () => {
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AI_API_KEY", "");

      const result = await completeJson({
        prompt: "test",
        schema: SuggestionSchema,
        provider: fakeProvider("{}"),
      });

      expect(result).toEqual({
        ok: false,
        error: "AI_API_KEY is not set",
      });
    });
  });

  describe("with valid configuration", () => {
    beforeEach(() => {
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AI_API_KEY", "sk-test-key");
      vi.stubEnv("AI_MODEL", "test-model");
    });

    it("parses valid JSON matching the schema", async () => {
      const fixture = JSON.stringify({ title: "Haircut", duration: 30 });
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: fakeProvider(fixture),
      });

      expect(result).toEqual({
        ok: true,
        data: { title: "Haircut", duration: 30 },
      });
    });

    it("returns an error for JSON that fails schema validation", async () => {
      const fixture = JSON.stringify({ title: "Haircut", duration: -5 });
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: fakeProvider(fixture),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Schema validation failed");
      }
    });

    it("returns an error for JSON with missing required fields", async () => {
      const fixture = JSON.stringify({ title: "Haircut" });
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: fakeProvider(fixture),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Schema validation failed");
      }
    });

    it("returns an error when the provider responds with invalid JSON", async () => {
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: fakeProvider("not json at all"),
      });

      expect(result).toEqual({
        ok: false,
        error: "AI response is not valid JSON",
      });
    });

    it("returns an error when the provider throws", async () => {
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: failingProvider("connection refused"),
      });

      expect(result).toEqual({
        ok: false,
        error: "AI provider error: connection refused",
      });
    });

    it("passes model and apiKey to the provider", async () => {
      const provider = fakeProvider(
        JSON.stringify({ title: "Test", duration: 15 }),
      );

      await completeJson({
        prompt: "test prompt",
        schema: SuggestionSchema,
        provider,
      });

      expect(provider).toHaveBeenCalledWith("test prompt", {
        model: "test-model",
        apiKey: "sk-test-key",
      });
    });

    it("handles empty string response from provider", async () => {
      const result = await completeJson({
        prompt: "suggest a service",
        schema: SuggestionSchema,
        provider: fakeProvider(""),
      });

      expect(result.ok).toBe(false);
    });
  });
});
