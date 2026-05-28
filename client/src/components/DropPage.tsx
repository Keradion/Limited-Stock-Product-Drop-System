import { useDropPage } from "../hooks/useDropPage.js";
import { LoginPanel } from "./LoginPanel.js";

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

  const showCountdown = drop.expiresAt !== null && !drop.countdown.isExpired;
  const showExpired = drop.countdown.isExpired && drop.reserveMessage?.includes("expired");

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
        <section className="panel reserve-panel">
          <h2>Reserve</h2>

          {showCountdown ? (
            <div className="countdown" role="timer" aria-live="polite">
              <p className="countdown-label">Time left to checkout</p>
              <p className="countdown-value">{drop.countdown.formatted}</p>
            </div>
          ) : null}

          {showExpired ? (
            <p className="message warning">Your reservation has expired.</p>
          ) : null}

          {drop.reserveMessage && !showExpired ? (
            <p className="message success">{drop.reserveMessage}</p>
          ) : null}

          {drop.reserveError ? <p className="message error">{drop.reserveError}</p> : null}

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
                : drop.expiresAt && !drop.countdown.isExpired
                  ? "Reservation active"
                  : "Reserve now"}
          </button>

          {drop.expiresAt && !drop.countdown.isExpired ? (
            <p className="muted">You already have an active reservation for this drop.</p>
          ) : null}
        </section>
      )}
    </div>
  );
}
