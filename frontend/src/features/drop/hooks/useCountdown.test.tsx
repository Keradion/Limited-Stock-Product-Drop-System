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

  it("cleans up interval when expiresAt changes to null", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const expiresAt = new Date("2026-05-28T12:05:00.000Z").toISOString();
    const { rerender } = renderHook(
      ({ expires }) => useCountdown(expires),
      { initialProps: { expires: expiresAt } },
    );

    rerender({ expires: null });

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("restarts interval when expiresAt changes", () => {
    const expiresAt1 = new Date("2026-05-28T12:05:00.000Z").toISOString();
    const expiresAt2 = new Date("2026-05-28T12:10:00.000Z").toISOString();

    const { result, rerender } = renderHook(
      ({ expires }) => useCountdown(expires),
      { initialProps: { expires: expiresAt1 } },
    );

    expect(result.current.formatted).to.equal("05:00");

    rerender({ expires: expiresAt2 });

    expect(result.current.formatted).to.equal("10:00");
  });

  it("handles countdown already expired on mount", () => {
    const expiresAt = new Date("2026-05-28T11:59:00.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.isExpired).to.equal(true);
    expect(result.current.formatted).to.equal("00:00");
    expect(result.current.remainingMs).to.equal(0);
  });

  it("never goes negative on remaining time", () => {
    const expiresAt = new Date("2026-05-28T12:00:02.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.remainingMs).to.be.greaterThanOrEqual(0);
    expect(result.current.isExpired).to.equal(true);
  });

  it("updates every second precisely", () => {
    const expiresAt = new Date("2026-05-28T12:01:00.000Z").toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    const updates: string[] = [result.current.formatted];

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      updates.push(result.current.formatted);
    }

    expect(updates).to.deep.equal([
      "01:00",
      "00:59",
      "00:58",
      "00:57",
      "00:56",
      "00:55",
    ]);
  });

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const expiresAt = new Date("2026-05-28T12:05:00.000Z").toISOString();
    const { unmount } = renderHook(() => useCountdown(expiresAt));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("getCountdownState returns correct values for positive time", () => {
    const expiresAt = new Date("2026-05-28T12:05:30.000Z").toISOString();
    const nowMs = new Date("2026-05-28T12:00:00.000Z").getTime();

    const state = getCountdownState(expiresAt, nowMs);

    expect(state.remainingMs).to.equal(330_000);
    expect(state.formatted).to.equal("05:30");
    expect(state.isExpired).to.equal(false);
  });

  it("getCountdownState clamps negative time to zero", () => {
    const expiresAt = new Date("2026-05-28T11:55:00.000Z").toISOString();
    const nowMs = new Date("2026-05-28T12:00:00.000Z").getTime();

    const state = getCountdownState(expiresAt, nowMs);

    expect(state.remainingMs).to.equal(0);
    expect(state.formatted).to.equal("00:00");
    expect(state.isExpired).to.equal(true);
  });
});
