import { parseApiError } from "../../../lib/parseApiError.js";

export function clampQuantity(quantity: number, maxAvailable: number): number {
  if (maxAvailable <= 0) {
    return 1;
  }
  const parsed = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  return Math.min(Math.max(1, parsed), maxAvailable);
}

export function isValidReserveQuantity(quantity: number, maxAvailable: number): boolean {
  return (
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    maxAvailable >= 1 &&
    quantity <= maxAvailable
  );
}

export type CanReserveParams = {
  isAuthenticated: boolean;
  isReserving: boolean;
  hasActiveReservation: boolean;
  isSoldOut: boolean;
  hasProduct: boolean;
  quantity: number;
  maxAvailable: number;
};

export function computeCanReserve(params: CanReserveParams): boolean {
  return (
    params.isAuthenticated &&
    !params.isReserving &&
    !params.hasActiveReservation &&
    !params.isSoldOut &&
    params.hasProduct &&
    isValidReserveQuantity(params.quantity, params.maxAvailable)
  );
}

export function mapReserveErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  if (parsed.statusCode === 409) {
    return "Sold out or race lost — someone else got the last units.";
  }
  if (parsed.statusCode === 410) {
    return "Reservation expired.";
  }
  return parsed.message;
}

export type CanCheckoutParams = {
  hasActiveReservation: boolean;
  isExpired: boolean;
  isCheckingOut: boolean;
};

export function computeCanCheckout(params: CanCheckoutParams): boolean {
  return params.hasActiveReservation && !params.isExpired && !params.isCheckingOut;
}

export function mapCheckoutErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  if (parsed.statusCode === 404) {
    return "Reservation not found.";
  }
  if (parsed.statusCode === 409) {
    return "This reservation is no longer available for checkout.";
  }
  if (parsed.statusCode === 410) {
    return "Reservation expired — checkout window closed.";
  }
  return parsed.message;
}
