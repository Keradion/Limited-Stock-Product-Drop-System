import { describe, expect, it } from "vitest";
import {
  clampQuantity,
  computeCanCheckout,
  computeCanReserve,
  isValidReserveQuantity,
  mapCheckoutErrorMessage,
  mapReserveErrorMessage,
} from "./dropPageLogic.js";

describe("clampQuantity", () => {
  it("clamps between 1 and max available", () => {
    expect(clampQuantity(0, 10)).to.equal(1);
    expect(clampQuantity(99, 10)).to.equal(10);
    expect(clampQuantity(3, 10)).to.equal(3);
  });
});

describe("computeCanReserve", () => {
  const base = {
    isAuthenticated: true,
    isReserving: false,
    hasActiveReservation: false,
    isSoldOut: false,
    hasProduct: true,
    quantity: 2,
    maxAvailable: 5,
  };

  it("allows reserve when all conditions pass", () => {
    expect(computeCanReserve(base)).to.equal(true);
  });

  it("blocks reserve when not authenticated", () => {
    expect(computeCanReserve({ ...base, isAuthenticated: false })).to.equal(false);
  });

  it("blocks reserve while a request is in flight", () => {
    expect(computeCanReserve({ ...base, isReserving: true })).to.equal(false);
  });

  it("blocks duplicate active reservations", () => {
    expect(computeCanReserve({ ...base, hasActiveReservation: true })).to.equal(false);
  });

  it("blocks reserve when sold out", () => {
    expect(computeCanReserve({ ...base, isSoldOut: true })).to.equal(false);
  });

  it("blocks reserve before product loads", () => {
    expect(computeCanReserve({ ...base, hasProduct: false })).to.equal(false);
  });

  it("blocks reserve when quantity exceeds available stock", () => {
    expect(computeCanReserve({ ...base, quantity: 6, maxAvailable: 5 })).to.equal(false);
    expect(isValidReserveQuantity(6, 5)).to.equal(false);
  });
});

describe("mapReserveErrorMessage", () => {
  it("maps race-condition 409 to a user-friendly message", () => {
    expect(
      mapReserveErrorMessage({ error: "Insufficient stock", statusCode: 409 }),
    ).to.equal("Sold out or race lost — someone else got the last units.");
  });

  it("maps expired reservation 410", () => {
    expect(
      mapReserveErrorMessage({ error: "Reservation expired", statusCode: 410 }),
    ).to.equal("Reservation expired.");
  });

  it("passes through other API errors", () => {
    expect(
      mapReserveErrorMessage({ error: "Inventory not available", statusCode: 503 }),
    ).to.equal("Inventory not available");
  });

  it("maps network errors", () => {
    expect(mapReserveErrorMessage(new TypeError("Failed to fetch"))).to.contain("Network error");
  });
});

describe("computeCanCheckout", () => {
  it("allows checkout with an active reservation", () => {
    expect(
      computeCanCheckout({
        hasActiveReservation: true,
        isExpired: false,
        isCheckingOut: false,
      }),
    ).to.equal(true);
  });

  it("blocks checkout when expired or already processing", () => {
    expect(
      computeCanCheckout({
        hasActiveReservation: true,
        isExpired: true,
        isCheckingOut: false,
      }),
    ).to.equal(false);
    expect(
      computeCanCheckout({
        hasActiveReservation: true,
        isExpired: false,
        isCheckingOut: true,
      }),
    ).to.equal(false);
  });
});

describe("mapCheckoutErrorMessage", () => {
  it("maps 409 and 410 to checkout-specific messages", () => {
    expect(
      mapCheckoutErrorMessage({ error: "Conflict", statusCode: 409 }),
    ).to.contain("no longer available");
    expect(
      mapCheckoutErrorMessage({ error: "Gone", statusCode: 410 }),
    ).to.contain("checkout window closed");
  });
});
