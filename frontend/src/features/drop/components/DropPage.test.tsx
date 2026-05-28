import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DropPage } from "./DropPage.js";
import type { useDropPage } from "../hooks/useDropPage.js";

type DropPageState = ReturnType<typeof useDropPage>;

const product = {
  productId: "22222222-2222-2222-2222-222222222222",
  productName: "Nike Air Drop Exclusive",
  productStock: 10,
  createdAt: new Date().toISOString(),
};

const activeReservation = {
  reservationId: "44444444-4444-4444-4444-444444444444",
  reservationStatus: "PENDING",
  productId: product.productId,
  quantity: 1,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  createdAt: new Date().toISOString(),
};

function buildDropState(overrides: Partial<DropPageState>): DropPageState {
  return {
    product,
    productError: null,
    availability: { productId: product.productId, available: 5, productStock: 10, soldOut: false },
    stockError: null,
    isStockLoading: false,
    activeReservation: null,
    expiresAt: null,
    countdown: { remainingMs: 0, formatted: "00:00", isExpired: true },
    isReserving: false,
    reserveError: null,
    reserveMessage: null,
    isSoldOut: false,
    quantity: 1,
    maxReserveQuantity: 5,
    setQuantity: vi.fn(),
    canReserve: true,
    isCheckingOut: false,
    checkoutError: null,
    canCheckout: false,
    completedOrder: null,
    lastCheckoutReservation: null,
    reserve: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    refreshReservation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const useDropPageMock = vi.fn();

vi.mock("../hooks/useDropPage.js", () => ({
  useDropPage: (isAuthenticated: boolean) => useDropPageMock(isAuthenticated),
}));

const authProps = {
  isAuthenticating: false,
  authError: null,
  onLogin: vi.fn().mockResolvedValue(true),
  onRegister: vi.fn().mockResolvedValue(true),
  onLogout: vi.fn(),
};

describe("DropPage", () => {
  beforeEach(() => {
    useDropPageMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows product and remaining stock", () => {
    useDropPageMock.mockReturnValue(buildDropState({}));

    render(<DropPage isAuthenticated={true} {...authProps} />);

    expect(screen.getByRole("heading", { name: product.productName })).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText(/Updates every 5 seconds/)).toBeTruthy();
  });

  it("disables reserve when sold out", () => {
    useDropPageMock.mockReturnValue(
      buildDropState({
        isSoldOut: true,
        canReserve: false,
        availability: { productId: product.productId, available: 0, productStock: 10, soldOut: true },
      }),
    );

    render(<DropPage isAuthenticated={true} {...authProps} />);

    const button = screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement;
    expect(button.disabled).to.equal(true);
  });

  it("shows checkout panel with countdown while reservation is active", () => {
    useDropPageMock.mockReturnValue(
      buildDropState({
        activeReservation,
        expiresAt: activeReservation.expiresAt,
        countdown: { remainingMs: 120_000, formatted: "02:00", isExpired: false },
        canReserve: false,
        canCheckout: true,
      }),
    );

    render(<DropPage isAuthenticated={true} {...authProps} />);

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeTruthy();
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(screen.getByText("02:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete checkout" })).toBeTruthy();
  });

  it("shows expiration message when countdown ends", () => {
    useDropPageMock.mockReturnValue(
      buildDropState({
        activeReservation,
        reserveMessage: "Your reservation has expired.",
        countdown: { remainingMs: 0, formatted: "00:00", isExpired: true },
        canReserve: false,
        canCheckout: false,
      }),
    );

    render(<DropPage isAuthenticated={true} {...authProps} />);

    expect(screen.getByText("Reservation expired — checkout is no longer available.")).toBeTruthy();
  });

  it("shows race-condition error from reserve", () => {
    useDropPageMock.mockReturnValue(
      buildDropState({
        reserveError: "Sold out or race lost — someone else got the last units.",
        canReserve: false,
      }),
    );

    render(<DropPage isAuthenticated={true} {...authProps} />);

    expect(
      screen.getByText("Sold out or race lost — someone else got the last units."),
    ).toBeTruthy();
  });

  it("shows login panel when not authenticated", () => {
    useDropPageMock.mockReturnValue(buildDropState({}));

    render(<DropPage isAuthenticated={false} {...authProps} />);

    expect(screen.getByRole("heading", { name: "Sign in to reserve" })).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: "Reserve now" })).to.have.length(0);
  });
});
