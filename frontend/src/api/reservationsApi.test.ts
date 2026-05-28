import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchActiveReservation } from "./reservationsApi.js";
import * as httpClient from "./httpClient.js";

vi.mock("./httpClient.js", () => ({
  apiRequest: vi.fn(),
}));

const apiRequestMock = vi.mocked(httpClient.apiRequest);

const productId = "22222222-2222-2222-2222-222222222222";

describe("fetchActiveReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there are no pending reservations", async () => {
    apiRequestMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });

    const result = await fetchActiveReservation(productId);
    expect(result).to.equal(null);
  });

  it("returns the pending reservation when not expired", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const reservation = {
      reservationId: "res-1",
      reservationStatus: "PENDING",
      productId,
      quantity: 1,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    apiRequestMock.mockResolvedValue({
      data: [reservation],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await fetchActiveReservation(productId);
    expect(result).to.deep.equal(reservation);
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringContaining("status=PENDING"),
      { auth: true },
    );
  });

  it("returns null when the pending reservation is already past expiresAt", async () => {
    apiRequestMock.mockResolvedValue({
      data: [
        {
          reservationId: "res-old",
          reservationStatus: "PENDING",
          productId,
          quantity: 1,
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await fetchActiveReservation(productId);
    expect(result).to.equal(null);
  });
});
