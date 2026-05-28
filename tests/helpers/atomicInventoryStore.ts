/**
 * In-memory inventory counter with the same atomic semantics as Redis Lua scripts.
 * Redis processes commands serially; Node runs each hold/release to completion before the next.
 */
export class AtomicInventoryStore {
  private readonly stocks = new Map<string, number>();

  init(productId: string, available: number): void {
    if (!this.stocks.has(productId)) {
      this.stocks.set(productId, available);
    }
  }

  getAvailable(productId: string): number | undefined {
    return this.stocks.get(productId);
  }

  /** Mirrors HOLD_STOCK_SCRIPT return values: -2, -1, or remaining count */
  hold(productId: string, quantity: number): number {
    const available = this.stocks.get(productId);
    if (available === undefined) {
      return -2;
    }
    if (available < quantity) {
      return -1;
    }
    const remaining = available - quantity;
    this.stocks.set(productId, remaining);
    return remaining;
  }

  /** Mirrors RELEASE_STOCK_SCRIPT */
  release(productId: string, quantity: number): number {
    const current = this.stocks.get(productId) ?? 0;
    const next = current + quantity;
    this.stocks.set(productId, next);
    return next;
  }
}

export function mapHoldResult(raw: number): "SUCCESS" | "INSUFFICIENT" | "NOT_INITIALIZED" {
  if (raw === -2) {
    return "NOT_INITIALIZED";
  }
  if (raw === -1) {
    return "INSUFFICIENT";
  }
  return "SUCCESS";
}
