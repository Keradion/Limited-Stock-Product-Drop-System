import { describe, expect, it } from "vitest";
import { formatCountdown } from "./formatTime.js";
import { getCountdownState } from "../features/drop/hooks/useCountdown.js";

/** Default reservation window from backend (5 minutes). */
const FIVE_MINUTES_MS = 300_000;

describe("formatCountdown", () => {
  it("formats minutes and seconds with zero padding", () => {
    expect(formatCountdown(125_000)).to.equal("02:05");
    expect(formatCountdown(59_000)).to.equal("00:59");
    expect(formatCountdown(0)).to.equal("00:00");
  });

  it("formats a full five-minute reservation window", () => {
    expect(formatCountdown(FIVE_MINUTES_MS)).to.equal("05:00");
  });

  it("ceilings partial seconds so the UI never shows 00:00 while time remains", () => {
    expect(formatCountdown(1_500)).to.equal("00:02");
    expect(formatCountdown(1)).to.equal("00:01");
  });
});

describe("getCountdownState", () => {
  it("treats null expiresAt as expired", () => {
    const state = getCountdownState(null, Date.now());
    expect(state.isExpired).to.equal(true);
    expect(state.remainingMs).to.equal(0);
    expect(state.formatted).to.equal("00:00");
  });

  it("marks countdown as expired when expiresAt is in the past", () => {
    const state = getCountdownState("2020-01-01T00:00:00.000Z", Date.now());
    expect(state.isExpired).to.equal(true);
    expect(state.formatted).to.equal("00:00");
  });

  it("returns remaining time before expiration", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 90_000).toISOString();
    const state = getCountdownState(expiresAt, now);
    expect(state.isExpired).to.equal(false);
    expect(state.formatted).to.equal("01:30");
    expect(state.remainingMs).to.equal(90_000);
  });

  it("is expired when current time equals expiresAt", () => {
    const now = 1_000_000;
    const expiresAt = new Date(now).toISOString();
    const state = getCountdownState(expiresAt, now);
    expect(state.isExpired).to.equal(true);
    expect(state.remainingMs).to.equal(0);
  });

  it("counts down from five minutes at reservation start", () => {
    const now = Date.now();
    const expiresAt = new Date(now + FIVE_MINUTES_MS).toISOString();
    const state = getCountdownState(expiresAt, now);
    expect(state.isExpired).to.equal(false);
    expect(state.formatted).to.equal("05:00");
  });
});
