import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckoutPanel } from "./CheckoutPanel.js";

const product = {
  productId: "22222222-2222-2222-2222-222222222222",
  productName: "Nike Air Drop Exclusive",
  productStock: 10,
  createdAt: new Date().toISOString(),
};

const reservation = {
  reservationId: "44444444-4444-4444-4444-444444444444",
  reservationStatus: "PENDING",
  productId: product.productId,
  quantity: 1,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  createdAt: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
});

describe("CheckoutPanel", () => {
  it("renders checkout details and pay button", () => {
    render(
      <CheckoutPanel
        product={product}
        reservation={reservation}
        countdown={{ remainingMs: 120_000, formatted: "02:00", isExpired: false }}
        isCheckingOut={false}
        checkoutError={null}
        canCheckout={true}
        completedOrder={null}
        onCheckout={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Checkout" })).toBeTruthy();
    expect(screen.getByText("02:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete checkout" })).toBeTruthy();
  });

  it("shows order confirmation after success", () => {
    render(
      <CheckoutPanel
        product={product}
        reservation={reservation}
        countdown={{ remainingMs: 0, formatted: "00:00", isExpired: true }}
        isCheckingOut={false}
        checkoutError={null}
        canCheckout={false}
        completedOrder={{
          orderId: "order-99",
          reservationId: reservation.reservationId,
          orderStatus: "PAID",
        }}
        onCheckout={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Order confirmed" })).toBeTruthy();
    expect(screen.getByText("order-99")).toBeTruthy();
    expect(screen.getByText("PAID")).toBeTruthy();
  });
});
