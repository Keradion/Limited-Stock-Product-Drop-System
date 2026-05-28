import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCountdownState, useCountdown } from "./useCountdown.js";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with the correct remaining time", () => {
    const expiresAt = new Date("2026-05-28T12:05:00.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.formatted).to.equal("05:00");
    expect(result.current.isExpired).to.equal(false);
  });

  it("ticks down every second", () => {
    const expiresAt = new Date("2026-05-28T12:00:10.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.formatted).to.equal("00:10");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.formatted).to.equal("00:09");

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.formatted).to.equal("00:05");
  });

  it("marks expired after the deadline passes", () => {
    const expiresAt = new Date("2026-05-28T12:00:03.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.isExpired).to.equal(true);
    expect(result.current.formatted).to.equal("00:00");
  });

  it("does not schedule intervals when expiresAt is null", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderHook(() => useCountdown(null));
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(getCountdownState(null, Date.now()).isExpired).to.equal(true);
  });
});
