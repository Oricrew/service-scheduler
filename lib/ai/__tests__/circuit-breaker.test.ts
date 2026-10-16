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

  it("stays open during cooldown", () => {
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
  });

  it("transitions to half-open after cooldown and allows exactly one probe", () => {
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
    // First check transitions to half-open — probe is allowed
    expect(cb.isOpen).toBe(false);
    // Second concurrent check while probe is in-flight — rejected
    expect(cb.isOpen).toBe(true);
  });

  it("closes when probe succeeds in half-open state", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      threshold: 2,
      resetTimeMs: 1000,
      now: () => now,
    });

    cb.recordFailure();
    cb.recordFailure();
    now = 1000;

    expect(cb.isOpen).toBe(false); // half-open: probe allowed
    cb.recordSuccess();

    // Fully closed now — multiple calls allowed
    expect(cb.isOpen).toBe(false);
    expect(cb.isOpen).toBe(false);
  });

  it("reopens with fresh cooldown when probe fails in half-open state", () => {
    let now = 0;
    const cb = new CircuitBreaker({
      threshold: 2,
      resetTimeMs: 1000,
      now: () => now,
    });

    cb.recordFailure();
    cb.recordFailure();
    now = 1000;

    expect(cb.isOpen).toBe(false); // half-open: probe allowed
    cb.recordFailure(); // probe failed

    // Immediately open again
    expect(cb.isOpen).toBe(true);

    // New cooldown starts from the last failure time (now=1000)
    now = 1999;
    expect(cb.isOpen).toBe(true);
    now = 2000;
    expect(cb.isOpen).toBe(false); // half-open again
  });

  it("uses default threshold of 5", () => {
    const cb = new CircuitBreaker();
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });
});
