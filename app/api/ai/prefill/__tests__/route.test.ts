import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@/lib/env", () => ({
  isAiConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/ai/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ limited: false }),
}));

vi.mock("@/lib/ai/usage-logger", () => ({
  logPrefillUsage: vi.fn(),
}));

vi.mock("@/lib/ai/prefill", () => ({
  executePrefill: vi.fn(),
  MAX_DESCRIPTION_LENGTH: 500,
}));

import { POST } from "../route";
import { executePrefill } from "@/lib/ai/prefill";
import { isAiConfigured } from "@/lib/env";
import { checkRateLimit } from "@/lib/ai/rate-limit";

const mockedExecutePrefill = vi.mocked(executePrefill);
const mockedIsAiConfigured = vi.mocked(isAiConfigured);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/prefill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedIsAiConfigured.mockReturnValue(true);
  mockedCheckRateLimit.mockReturnValue({ limited: false });
  mockedExecutePrefill.mockReset();
});

describe("POST /api/ai/prefill", () => {
  describe("graceful degradation", () => {
    it("returns 200 with { ok: false } when AI fails (aiError)", async () => {
      mockedExecutePrefill.mockResolvedValue({
        ok: false,
        error: "aiError",
      });

      const res = await POST(makeRequest({ description: "fix my AC" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: false, error: "aiError" });
    });

    it("returns 200 with { ok: false } when no fields extracted (noFields)", async () => {
      mockedExecutePrefill.mockResolvedValue({
        ok: false,
        error: "noFields",
      });

      const res = await POST(makeRequest({ description: "hello" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: false, error: "noFields" });
    });
  });

  describe("client errors still return proper status codes", () => {
    it("returns 400 for empty description", async () => {
      mockedExecutePrefill.mockResolvedValue({
        ok: false,
        error: "empty",
      });

      const res = await POST(makeRequest({ description: "" }));
      expect(res.status).toBe(400);
    });

    it("returns 413 for too-long description", async () => {
      mockedExecutePrefill.mockResolvedValue({
        ok: false,
        error: "tooLong",
      });

      const res = await POST(makeRequest({ description: "x".repeat(501) }));
      expect(res.status).toBe(413);
    });

    it("returns 503 when AI is disabled", async () => {
      mockedIsAiConfigured.mockReturnValue(false);

      const res = await POST(makeRequest({ description: "test" }));
      expect(res.status).toBe(503);
    });

    it("returns 429 when rate-limited", async () => {
      mockedCheckRateLimit.mockReturnValue({
        limited: true,
        retryAfterSeconds: 30,
        kind: "rpm",
      });

      const res = await POST(makeRequest({ description: "test" }));
      expect(res.status).toBe(429);
    });
  });

  describe("success", () => {
    it("returns 200 with prefill data", async () => {
      mockedExecutePrefill.mockResolvedValue({
        ok: true,
        data: {
          serviceSlug: "repair",
          city: "Palermo",
          equipmentType: "split",
          problemDescription: "not cooling",
          brandModel: null,
          clientNotes: null,
        },
      });

      const res = await POST(makeRequest({ description: "AC not cooling" }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.serviceSlug).toBe("repair");
    });
  });
});
