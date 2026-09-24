import { describe, expect, it } from "vitest";

import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen).toBe(false);
  });

  it("stays closed below the threshold", () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });

  it("opens after reaching the threshold", () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it("resets on success", () => {
    const cb = new CircuitBreaker({ threshold: 3 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });

  it("resets after cooldown period", () => {
    let now = 1000;
    const cb = new CircuitBreaker({
      threshold: 2,
      resetTimeMs: 5000,
      now: () => now,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);

    now += 4999;
    expect(cb.isOpen).toBe(true);

    now += 1;
    expect(cb.isOpen).toBe(false);
  });

  it("allows a probe request after cooldown (half-open)", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      threshold: 2,
      resetTimeMs: 1000,
      now: () => now,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);

    now = 1000;
    expect(cb.isOpen).toBe(false);

    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it("uses default threshold of 5", () => {
    const cb = new CircuitBreaker();
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });
});
