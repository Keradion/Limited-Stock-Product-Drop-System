import { useEffect, useState } from "react";
import { formatCountdown } from "../lib/formatTime.js";

export type CountdownState = {
  remainingMs: number;
  formatted: string;
  isExpired: boolean;
};

export function getCountdownState(expiresAt: string | null, nowMs: number): CountdownState {
  if (!expiresAt) {
    return { remainingMs: 0, formatted: "00:00", isExpired: true };
  }

  const remainingMs = new Date(expiresAt).getTime() - nowMs;
  const clamped = Math.max(0, remainingMs);

  return {
    remainingMs: clamped,
    formatted: formatCountdown(clamped),
    isExpired: remainingMs <= 0,
  };
}

export function useCountdown(expiresAt: string | null): CountdownState {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  return getCountdownState(expiresAt, nowMs);
}
