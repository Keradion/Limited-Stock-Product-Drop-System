import type { CheckoutResponse, Product, Reservation } from "../../../types/api.types.js";
import type { CountdownState } from "../hooks/useCountdown.js";

type CheckoutPanelProps = {
  product: Product;
  reservation: Reservation;
  countdown: CountdownState;
  isCheckingOut: boolean;
  checkoutError: string | null;
  canCheckout: boolean;
  completedOrder: CheckoutResponse | null;
  onCheckout: () => void;
};

export function CheckoutPanel({
  product,
  reservation,
  countdown,
  isCheckingOut,
  checkoutError,
  canCheckout,
  completedOrder,
  onCheckout,
}: CheckoutPanelProps) {
  if (completedOrder) {
    return (
      <section className="panel checkout-panel checkout-success">
        <h2>Order confirmed</h2>
        <p className="message success">Payment complete — your order is secured.</p>
        <dl className="checkout-details">
          <div>
            <dt>Product</dt>
            <dd>{product.productName}</dd>
          </div>
          <div>
            <dt>Quantity</dt>
            <dd>{reservation.quantity}</dd>
          </div>
          <div>
            <dt>Order ID</dt>
            <dd className="mono">{completedOrder.orderId}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{completedOrder.orderStatus}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <section className="panel checkout-panel">
      <h2>Checkout</h2>
      <p className="muted">Complete purchase before your reservation expires.</p>

      <dl className="checkout-details">
        <div>
          <dt>Product</dt>
          <dd>{product.productName}</dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>{reservation.quantity}</dd>
        </div>
        <div>
          <dt>Reservation</dt>
          <dd className="mono">{reservation.reservationId}</dd>
        </div>
      </dl>

      {!countdown.isExpired ? (
        <div className="countdown" role="timer" aria-live="polite">
          <p className="countdown-label">Time left to checkout</p>
          <p className="countdown-value">{countdown.formatted}</p>
        </div>
      ) : (
        <p className="message warning">Reservation expired — checkout is no longer available.</p>
      )}

      {checkoutError ? <p className="message error">{checkoutError}</p> : null}

      <button
        type="button"
        className="primary checkout-button"
        disabled={!canCheckout}
        onClick={onCheckout}
      >
        {isCheckingOut ? "Processing…" : countdown.isExpired ? "Expired" : "Complete checkout"}
      </button>
    </section>
  );
}
