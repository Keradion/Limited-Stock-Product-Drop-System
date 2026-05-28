import { describe, expect, it } from "vitest";
import { formatCountdown } from "./formatTime.js";
import { getCountdownState } from "../hooks/useCountdown.js";

describe("formatCountdown", () => {
  it("formats minutes and seconds with zero padding", () => {
    expect(formatCountdown(125_000)).to.equal("02:05");
    expect(formatCountdown(59_000)).to.equal("00:59");
    expect(formatCountdown(0)).to.equal("00:00");
  });
});

describe("getCountdownState", () => {
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
  });
});
