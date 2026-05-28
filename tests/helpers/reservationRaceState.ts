export type ReservationStatus = "PENDING" | "COMPLETED" | "EXPIRED" | "CANCELLED";

/** Shared reservation row used to simulate checkout vs expiry races */
export class ReservationRaceState {
  status: ReservationStatus = "PENDING";

  constructor(
    readonly reservationId: string,
    readonly userId: string,
    readonly productId: string,
    readonly quantity: number,
    public expiresAt: Date,
  ) {}

  tryCompleteCheckout(now: Date): boolean {
    if (this.status !== "PENDING" || this.expiresAt <= now) {
      return false;
    }
    this.status = "COMPLETED";
    return true;
  }

  tryExpire(now: Date): boolean {
    if (this.status !== "PENDING" || this.expiresAt > now) {
      return false;
    }
    this.status = "EXPIRED";
    return true;
  }
}
