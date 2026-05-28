import { useDropPage } from "../hooks/useDropPage.js";
import { CheckoutPanel } from "./CheckoutPanel.js";
import { LoginPanel } from "../../auth/components/LoginPanel.js";
import { QuantitySelector } from "./QuantitySelector.js";

type DropPageProps = {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  onLogin: (email: string, password: string) => Promise<boolean>;
  onRegister: (email: string, password: string) => Promise<boolean>;
  onLogout: () => void;
};

export function DropPage({
  isAuthenticated,
  isAuthenticating,
  authError,
  onLogin,
  onRegister,
  onLogout,
}: DropPageProps) {
  const drop = useDropPage(isAuthenticated);

  if (drop.productError) {
    return <p className="message error">{drop.productError}</p>;
  }

  if (!drop.product) {
    return <p className="message">Loading drop…</p>;
  }

  const checkoutReservation =
    drop.activeReservation ?? drop.lastCheckoutReservation;
  const showCheckoutPanel =
    isAuthenticated && checkoutReservation !== null;
  const showReservePanel = isAuthenticated && !drop.activeReservation;

  return (
    <div className="drop-layout">
      <header className="drop-header">
        <div>
          <p className="eyebrow">Limited drop</p>
          <h1>{drop.product.productName}</h1>
        </div>
        {isAuthenticated ? (
          <button type="button" className="secondary" onClick={onLogout}>
            Log out
          </button>
        ) : null}
      </header>

      <section className="panel stock-panel">
        <h2>Remaining stock</h2>
        {drop.isStockLoading && !drop.availability ? (
          <p>Refreshing…</p>
        ) : (
          <p className="stock-value">
            {drop.availability?.available ?? "—"}{" "}
            <span className="muted">/ {drop.product.productStock} total</span>
          </p>
        )}
        <p className="muted">Updates every 5 seconds</p>
        {drop.stockError ? <p className="message error">{drop.stockError}</p> : null}
      </section>

      {!isAuthenticated ? (
        <LoginPanel
          isAuthenticating={isAuthenticating}
          authError={authError}
          onLogin={onLogin}
          onRegister={onRegister}
        />
      ) : (
        <>
          {showCheckoutPanel && checkoutReservation ? (
            <CheckoutPanel
              product={drop.product}
              reservation={checkoutReservation}
              countdown={drop.countdown}
              isCheckingOut={drop.isCheckingOut}
              checkoutError={drop.checkoutError}
              canCheckout={drop.canCheckout}
              completedOrder={drop.completedOrder}
              onCheckout={() => void drop.checkout()}
            />
          ) : null}

          {showReservePanel ? (
            <section className="panel reserve-panel">
              <h2>{drop.completedOrder ? "Buy again" : "Reserve"}</h2>

              {drop.countdown.isExpired && drop.reserveMessage?.includes("expired") ? (
                <p className="message warning">Your reservation has expired.</p>
              ) : null}

              {drop.reserveMessage && !drop.completedOrder && !drop.countdown.isExpired ? (
                <p className="message success">{drop.reserveMessage}</p>
              ) : null}

              {drop.reserveError ? <p className="message error">{drop.reserveError}</p> : null}

              <QuantitySelector
                quantity={drop.quantity}
                maxAvailable={drop.maxReserveQuantity}
                disabled={drop.isReserving || drop.isSoldOut}
                onChange={drop.setQuantity}
              />

              <button
                type="button"
                className="primary"
                disabled={!drop.canReserve}
                onClick={() => void drop.reserve()}
              >
                {drop.isReserving
                  ? "Reserving…"
                  : drop.isSoldOut
                    ? "Sold out"
                    : drop.completedOrder
                      ? "Reserve again"
                      : "Reserve now"}
              </button>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
