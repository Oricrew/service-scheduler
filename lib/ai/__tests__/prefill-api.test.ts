import { describe, expect, it, vi, beforeEach } from "vitest";

import { executePrefill, MAX_DESCRIPTION_LENGTH } from "../prefill";

vi.mock("../complete-json", () => ({
  completeJson: vi.fn(),
}));

import { completeJson } from "../complete-json";
const mockedCompleteJson = vi.mocked(completeJson);

beforeEach(() => {
  vi.unstubAllEnvs();
  mockedCompleteJson.mockReset();
});

describe("executePrefill", () => {
  describe("kill switch (AI_ENABLED=false)", () => {
    it("returns disabled when AI is not configured", async () => {
      vi.stubEnv("AI_ENABLED", "false");
      vi.stubEnv("AI_API_KEY", "");

      const result = await executePrefill("en", "fix my AC");
      expect(result).toEqual({ ok: false, error: "disabled" });
      expect(mockedCompleteJson).not.toHaveBeenCalled();
    });
  });

  describe("body validation", () => {
    beforeEach(() => {
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AI_API_KEY", "sk-test");
    });

    it("rejects empty description", async () => {
      const result = await executePrefill("en", "");
      expect(result).toEqual({ ok: false, error: "empty" });
    });

    it("rejects whitespace-only description", async () => {
      const result = await executePrefill("en", "   ");
      expect(result).toEqual({ ok: false, error: "empty" });
    });

    it("rejects description exceeding max length", async () => {
      const longText = "a".repeat(MAX_DESCRIPTION_LENGTH + 1);
      const result = await executePrefill("en", longText);
      expect(result).toEqual({ ok: false, error: "tooLong" });
    });
  });

  describe("max output tokens", () => {
    beforeEach(() => {
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AI_API_KEY", "sk-test");
      vi.stubEnv("AI_MODEL", "test-model");
    });

    it("passes maxTokens to completeJson", async () => {
      mockedCompleteJson.mockResolvedValue({
        ok: true,
        data: {
          serviceSlug: "repair",
          city: null,
          equipmentType: null,
          problemDescription: "not cooling",
          brandModel: null,
          clientNotes: null,
        },
      });

      await executePrefill("en", "my AC is broken");

      expect(mockedCompleteJson).toHaveBeenCalledOnce();
      const callArgs = mockedCompleteJson.mock.calls[0][0];
      expect(callArgs.maxTokens).toBe(512);
    });
  });

  describe("successful prefill", () => {
    beforeEach(() => {
      vi.stubEnv("AI_ENABLED", "true");
      vi.stubEnv("AI_API_KEY", "sk-test");
      vi.stubEnv("AI_MODEL", "test-model");
    });

    it("returns sanitized data on success", async () => {
      mockedCompleteJson.mockResolvedValue({
        ok: true,
        data: {
          serviceSlug: "repair",
          city: "Palermo",
          equipmentType: "split",
          problemDescription: "not cooling",
          brandModel: "Samsung",
          clientNotes: null,
        },
      });

      const result = await executePrefill("en", "AC not cooling in Palermo");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.serviceSlug).toBe("repair");
        expect(result.data.city).toBe("Palermo");
      }
    });

    it("returns noFields when all fields are null", async () => {
      mockedCompleteJson.mockResolvedValue({
        ok: true,
        data: {
          serviceSlug: null,
          city: null,
          equipmentType: null,
          problemDescription: null,
          brandModel: null,
          clientNotes: null,
        },
      });

      const result = await executePrefill("en", "hello");
      expect(result).toEqual({ ok: false, error: "noFields" });
    });

    it("returns aiError when provider fails", async () => {
      mockedCompleteJson.mockResolvedValue({
        ok: false,
        error: "AI provider error: timeout",
      });

      const result = await executePrefill("en", "fix my AC");
      expect(result).toEqual({ ok: false, error: "aiError" });
    });
  });
});
