import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchActiveReservation, createReservation } from "./reservationsApi.js";
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

  it("handles API errors gracefully", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Unauthorized",
      statusCode: 401,
    });

    try {
      await fetchActiveReservation(productId);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Unauthorized",
        statusCode: 401,
      });
    }
  });

  it("handles network errors", async () => {
    apiRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await fetchActiveReservation(productId);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.be.instanceOf(TypeError);
    }
  });

  it("handles timeout errors", async () => {
    apiRequestMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    try {
      await fetchActiveReservation(productId);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.be.instanceOf(DOMException);
      expect((error as DOMException).name).to.equal("AbortError");
    }
  });

  it("returns null when reservation is at exact expiration time", async () => {
    const expiresAt = new Date(Date.now()).toISOString();
    apiRequestMock.mockResolvedValue({
      data: [
        {
          reservationId: "res-expired",
          reservationStatus: "PENDING",
          productId,
          quantity: 1,
          expiresAt,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await fetchActiveReservation(productId);
    expect(result).to.equal(null);
  });

  it("handles malformed reservation data", async () => {
    apiRequestMock.mockResolvedValue({
      data: [
        {
          reservationId: "res-1",
          reservationStatus: "PENDING",
          productId,
          quantity: 1,
          expiresAt: "invalid-date",
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    const result = await fetchActiveReservation(productId);
    expect(result).to.not.be.null;
  });

  it("constructs correct query parameters", async () => {
    apiRequestMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 1, total: 0, totalPages: 0 },
    });

    await fetchActiveReservation(productId);

    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringContaining("status=PENDING"),
      { auth: true },
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringContaining(`productId=${productId}`),
      { auth: true },
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringContaining("limit=1"),
      { auth: true },
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.stringContaining("page=1"),
      { auth: true },
    );
  });
});

describe("createReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a reservation successfully", async () => {
    const response = {
      reservationId: "new-res-1",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };

    apiRequestMock.mockResolvedValue(response);

    const result = await createReservation(productId, 2);

    expect(result).to.deep.equal(response);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/reserve",
      {
        method: "POST",
        auth: true,
        body: { productId, quantity: 2 },
      },
    );
  });

  it("handles insufficient stock error", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Insufficient stock",
      statusCode: 409,
    });

    try {
      await createReservation(productId, 5);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Insufficient stock",
        statusCode: 409,
      });
    }
  });

  it("handles authentication errors", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Not authenticated",
      statusCode: 401,
    });

    try {
      await createReservation(productId, 1);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Not authenticated",
        statusCode: 401,
      });
    }
  });

  it("handles server errors", async () => {
    apiRequestMock.mockRejectedValue({
      error: "Internal server error",
      statusCode: 500,
    });

    try {
      await createReservation(productId, 1);
      expect.fail("Expected error");
    } catch (error) {
      expect(error).to.deep.equal({
        error: "Internal server error",
        statusCode: 500,
      });
    }
  });

  it("sends correct request parameters", async () => {
    apiRequestMock.mockResolvedValue({
      reservationId: "res-1",
      expiresAt: new Date().toISOString(),
    });

    await createReservation("prod-123", 3);

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/reserve",
      expect.objectContaining({
        method: "POST",
        auth: true,
        body: {
          productId: "prod-123",
          quantity: 3,
        },
      }),
    );
  });
});
