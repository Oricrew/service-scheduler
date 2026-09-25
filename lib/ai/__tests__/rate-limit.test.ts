import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  checkRateLimit,
  _resetAllBuckets,
  getRpmLimit,
  getDailyLimit,
} from "../rate-limit";

beforeEach(() => {
  _resetAllBuckets();
  vi.unstubAllEnvs();
});

describe("getRpmLimit / getDailyLimit", () => {
  it("returns defaults when env vars are unset", () => {
    expect(getRpmLimit()).toBe(5);
    expect(getDailyLimit()).toBe(25);
  });

  it("respects AI_RATE_LIMIT_RPM", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "5");
    expect(getRpmLimit()).toBe(5);
  });

  it("respects AI_RATE_LIMIT_DAILY", () => {
    vi.stubEnv("AI_RATE_LIMIT_DAILY", "200");
    expect(getDailyLimit()).toBe(200);
  });

  it("falls back to default for non-numeric values", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "abc");
    expect(getRpmLimit()).toBe(5);
  });
});

describe("checkRateLimit", () => {
  it("allows requests under the RPM limit", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "3");
    expect(checkRateLimit("user1").limited).toBe(false);
    expect(checkRateLimit("user1").limited).toBe(false);
    expect(checkRateLimit("user1").limited).toBe(false);
  });

  it("blocks when RPM limit is exceeded", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "2");
    checkRateLimit("user2");
    checkRateLimit("user2");
    const result = checkRateLimit("user2");
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.kind).toBe("rpm");
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("uses separate buckets for different keys", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "1");
    expect(checkRateLimit("a").limited).toBe(false);
    expect(checkRateLimit("b").limited).toBe(false);
    expect(checkRateLimit("a").limited).toBe(true);
  });

  it("blocks when daily limit is exceeded", () => {
    vi.stubEnv("AI_RATE_LIMIT_RPM", "999");
    vi.stubEnv("AI_RATE_LIMIT_DAILY", "3");

    checkRateLimit("user3");
    checkRateLimit("user3");
    checkRateLimit("user3");

    const result = checkRateLimit("user3");
    expect(result.limited).toBe(true);
    if (result.limited) {
      expect(result.kind).toBe("daily");
    }
  });
});
