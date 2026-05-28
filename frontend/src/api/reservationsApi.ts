import { apiRequest } from "./httpClient.js";
import type { PaginatedResponse, Reservation, ReserveResponse } from "../types/api.types.js";

export async function fetchActiveReservation(
  productId: string,
): Promise<Reservation | null> {
  const query = new URLSearchParams({
    status: "PENDING",
    productId,
    limit: "1",
    page: "1",
  });

  const result = await apiRequest<PaginatedResponse<Reservation>>(
    `/api/reservations?${query.toString()}`,
    { auth: true },
  );

  const reservation = result.data[0];
  if (!reservation) {
    return null;
  }

  const expiresAt = new Date(reservation.expiresAt).getTime();
  if (expiresAt <= Date.now()) {
    return null;
  }

  return reservation;
}

export async function createReservation(
  productId: string,
  quantity: number,
): Promise<ReserveResponse> {
  return apiRequest<ReserveResponse>("/api/reserve", {
    method: "POST",
    auth: true,
    body: { productId, quantity },
  });
}
