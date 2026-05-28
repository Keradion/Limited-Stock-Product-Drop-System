import { apiRequest } from "./httpClient.js";
import type { CheckoutResponse } from "../types/api.types.js";

export async function checkoutReservation(reservationId: string): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>("/api/checkout", {
    method: "POST",
    auth: true,
    body: { reservationId },
  });
}
